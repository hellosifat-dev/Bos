<?php

namespace App\Services;

use App\Models\Business;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesService
{
    public function __construct(private InventoryService $inventory, private AccountingService $accounting) {}

    /**
     * Create an order. $data: customer_id?, warehouse_id?, branch_id?, channel, notes?, discount? (order level),
     * items: [{product_id, quantity, unit_price?, discount?}], complete: bool, payments: [{amount, method, reference?}]
     */
    public function create(Business $business, array $data): Order
    {
        return DB::transaction(function () use ($business, $data) {
            $warehouse = isset($data['warehouse_id'])
                ? Warehouse::findOrFail($data['warehouse_id'])
                : $this->inventory->defaultWarehouse($business);

            // Serialize numbering per business.
            Business::whereKey($business->id)->lockForUpdate()->first();
            $sequence = (int) Order::withoutGlobalScopes()->where('business_id', $business->id)->max('sequence') + 1;
            $prefix   = $data['channel'] === 'pos' ? 'POS' : 'SO';

            $order = Order::create([
                'tenant_id'    => $business->tenant_id,
                'business_id'  => $business->id,
                'sequence'     => $sequence,
                'number'       => sprintf('%s-%06d', $prefix, $sequence),
                'customer_id'  => $data['customer_id'] ?? null,
                'branch_id'    => $data['branch_id'] ?? $warehouse->branch_id,
                'warehouse_id' => $warehouse->id,
                'channel'      => $data['channel'],
                'status'       => 'draft',
                'notes'        => $data['notes'] ?? null,
                'created_by'   => auth()->id(),
            ]);

            $this->writeItems($order, $data['items'], (float) ($data['discount'] ?? 0));

            if (!empty($data['complete'])) {
                $this->complete($order);
            }

            foreach ($data['payments'] ?? [] as $p) {
                if ((float) $p['amount'] > 0) {
                    $this->addPayment($order, (float) $p['amount'], $p['method'] ?? 'cash', $p['reference'] ?? null);
                }
            }

            return $order->fresh(['items', 'payments', 'customer']);
        });
    }

    public function defaultWarehouseId(Business $business): int
    {
        return $this->inventory->defaultWarehouse($business)->id;
    }

    /** Replace a draft's lines. */
    public function updateDraft(Order $order, array $data): Order
    {
        if ($order->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Only draft orders can be edited.']]);
        }

        return DB::transaction(function () use ($order, $data) {
            $order->update(array_intersect_key($data, array_flip(['customer_id', 'notes', 'warehouse_id'])));
            if (isset($data['items'])) {
                $order->items()->delete();
                $this->writeItems($order, $data['items'], (float) ($data['discount'] ?? 0));
            }
            return $order->fresh(['items', 'payments', 'customer']);
        });
    }

    private function writeItems(Order $order, array $items, float $orderDiscount): void
    {
        if (!$items) {
            throw ValidationException::withMessages(['items' => ['Add at least one item.']]);
        }

        $subtotal = $lineDiscounts = $tax = $total = 0.0;

        foreach ($items as $i => $line) {
            $product = Product::find($line['product_id']);
            if (!$product || $product->status !== 'active') {
                throw ValidationException::withMessages(["items.{$i}.product_id" => ['Product is not available.']]);
            }

            $qty      = (float) $line['quantity'];
            $price    = isset($line['unit_price']) ? (float) $line['unit_price'] : (float) $product->sell_price;
            $gross    = round($qty * $price, 2);
            $discount = min(round((float) ($line['discount'] ?? 0), 2), $gross);
            $net      = $gross - $discount;
            $lineTax  = round($net * (float) $product->tax_rate / 100, 2);

            $order->items()->create([
                'product_id' => $product->id,
                'name'       => $product->name,
                'sku'        => $product->sku,
                'quantity'   => $qty,
                'unit_price' => $price,
                'unit_cost'  => (float) $product->cost_price,
                'discount'   => $discount,
                'tax_rate'   => (float) $product->tax_rate,
                'tax_amount' => $lineTax,
                'line_total' => $net + $lineTax,
            ]);

            $subtotal      += $gross;
            $lineDiscounts += $discount;
            $tax           += $lineTax;
            $total         += $net + $lineTax;
        }

        $orderDiscount = min(max($orderDiscount, 0), $total);

        $order->update([
            'subtotal'       => round($subtotal, 2),
            'discount_total' => round($lineDiscounts + $orderDiscount, 2),
            'tax_total'      => round($tax, 2),
            'total'          => round($total - $orderDiscount, 2),
        ]);
    }

    /** Finalise a draft: deduct stock. */
    public function complete(Order $order): Order
    {
        if ($order->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Only draft orders can be completed.']]);
        }

        return DB::transaction(function () use ($order) {
            $warehouse = $order->warehouse ?? $this->inventory->defaultWarehouse($order->business);

            foreach ($order->items()->with('product')->get() as $item) {
                if ($item->product && $item->product->track_stock) {
                    $this->inventory->move($item->product, $warehouse, -(float) $item->quantity, 'sale', $order, $order->number, (float) $item->unit_cost);
                }
            }

            $order->update(['status' => 'completed', 'completed_at' => now()]);
            $this->accounting->recordSale($order);
            $this->refreshPaymentStatus($order);

            return $order;
        });
    }

    public function cancel(Order $order): Order
    {
        if ($order->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Completed orders must be returned instead of cancelled.']]);
        }
        if ((float) $order->paid_total > 0) {
            throw ValidationException::withMessages(['status' => ['Refund the payments before cancelling.']]);
        }

        $order->update(['status' => 'cancelled']);
        return $order;
    }

    public function addPayment(Order $order, float $amount, string $method, ?string $reference = null): Payment
    {
        if (in_array($order->status, ['cancelled', 'returned'], true)) {
            throw ValidationException::withMessages(['amount' => ['This order no longer accepts payments.']]);
        }

        $due = $order->balance_due;
        if ($amount <= 0 || round($amount, 2) > $due) {
            throw ValidationException::withMessages(['amount' => ["Amount must be between 0.01 and the balance due ({$due})."]]);
        }

        return DB::transaction(function () use ($order, $amount, $method, $reference) {
            $payment = $order->payments()->create([
                'tenant_id'   => $order->tenant_id,
                'business_id' => $order->business_id,
                'type'        => 'payment',
                'amount'      => round($amount, 2),
                'method'      => $method,
                'reference'   => $reference,
                'paid_at'     => now(),
                'received_by' => auth()->id(),
            ]);
            $order->increment('paid_total', round($amount, 2));
            $this->accounting->recordPayment($payment);
            $this->refreshPaymentStatus($order->refresh());

            return $payment;
        });
    }

    /**
     * Return items from a completed order (all when $lines is empty): restock and refund.
     * $lines: [{item_id, quantity}]
     */
    public function returnItems(Order $order, array $lines, string $method = 'cash'): Order
    {
        if ($order->status !== 'completed') {
            throw ValidationException::withMessages(['status' => ['Only completed orders can be returned.']]);
        }

        return DB::transaction(function () use ($order, $lines, $method) {
            $items = $order->items()->with('product')->get()->keyBy('id');
            if (!$lines) {
                $lines = $items->map(fn ($i) => ['item_id' => $i->id, 'quantity' => (float) $i->quantity - (float) $i->returned_quantity])
                    ->filter(fn ($l) => $l['quantity'] > 0)->values()->all();
            }

            $warehouse = $order->warehouse ?? $this->inventory->defaultWarehouse($order->business);
            $value = 0.0;
            $returnedQty = [];

            foreach ($lines as $idx => $line) {
                $item = $items->get($line['item_id']);
                $qty  = (float) $line['quantity'];
                $left = $item ? (float) $item->quantity - (float) $item->returned_quantity : 0;
                if (!$item || $qty <= 0 || $qty > $left + 0.0005) {
                    throw ValidationException::withMessages(["lines.{$idx}.quantity" => ['Invalid return quantity.']]);
                }

                if ($item->product && $item->product->track_stock) {
                    $this->inventory->move($item->product, $warehouse, $qty, 'sale_return', $order, "Return {$order->number}", (float) $item->unit_cost);
                }
                $item->increment('returned_quantity', $qty);
                $returnedQty[$item->id] = ($returnedQty[$item->id] ?? 0) + $qty;
                $value += (float) $item->line_total * $qty / (float) $item->quantity;
            }

            // Spread any order-level discount proportionally.
            $linesTotal = (float) $order->items()->sum('line_total');
            if ($linesTotal > 0) {
                $value *= (float) $order->total / $linesTotal;
            }

            $value = round($value, 2);
            $order->increment('returned_total', $value);
            $this->accounting->recordReturn($order, $value, $returnedQty);
            $order->refresh();

            // Refund whatever was paid beyond the reduced order value.
            $refund = round(max($order->netPaid() - $order->netTotal(), 0), 2);
            if ($refund > 0) {
                $refundPayment = $order->payments()->create([
                    'tenant_id'   => $order->tenant_id,
                    'business_id' => $order->business_id,
                    'type'        => 'refund',
                    'amount'      => $refund,
                    'method'      => $method,
                    'reference'   => "Return {$order->number}",
                    'paid_at'     => now(),
                    'received_by' => auth()->id(),
                ]);
                $order->increment('refunded_total', $refund);
                $this->accounting->recordPayment($refundPayment);
            }

            $fullyReturned = $order->items()->get()->every(fn ($i) => (float) $i->returned_quantity >= (float) $i->quantity);
            if ($fullyReturned) {
                $order->update(['status' => 'returned']);
            }
            $this->refreshPaymentStatus($order->refresh());

            return $order->fresh(['items', 'payments', 'customer']);
        });
    }

    private function refreshPaymentStatus(Order $order): void
    {
        $refunded = (float) $order->refunded_total;
        $net      = $order->netPaid();

        $status = match (true) {
            $refunded > 0 && $net <= 0.004              => 'refunded',
            $net + 0.004 >= $order->netTotal() && $net > 0.004 => 'paid',
            $net <= 0.004                               => 'unpaid',
            default                                     => 'partial',
        };

        $order->update(['payment_status' => $status]);
    }
}
