<?php

namespace App\Services;

use App\Models\Business;
use App\Models\Product;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    /** The business's default warehouse; created on first use. */
    public function defaultWarehouse(Business $business): Warehouse
    {
        $warehouse = Warehouse::withoutGlobalScopes()
            ->where('business_id', $business->id)
            ->orderByDesc('is_default')->orderBy('id')
            ->first();

        return $warehouse ?? Warehouse::create([
            'tenant_id'   => $business->tenant_id,
            'business_id' => $business->id,
            'branch_id'   => $business->branches()->where('is_headquarters', true)->value('id'),
            'name'        => 'Main Warehouse',
            'code'        => 'MAIN',
            'is_default'  => true,
        ]);
    }

    /**
     * Apply a signed quantity change and record the movement.
     * Must be called inside a transaction when combined with other writes.
     */
    public function move(
        Product $product,
        Warehouse $warehouse,
        float $quantity,
        string $type,
        ?Model $reference = null,
        ?string $note = null,
        ?float $unitCost = null,
    ): StockMovement {
        if (!$product->track_stock || $product->type === 'service') {
            throw ValidationException::withMessages(['product_id' => ["{$product->name} does not track stock."]]);
        }

        return DB::transaction(function () use ($product, $warehouse, $quantity, $type, $reference, $note, $unitCost) {
            $stock = Stock::withoutGlobalScopes()->firstOrCreate(
                ['product_id' => $product->id, 'warehouse_id' => $warehouse->id],
                ['tenant_id' => $product->tenant_id, 'business_id' => $product->business_id, 'quantity' => 0],
            );
            $stock = Stock::withoutGlobalScopes()->whereKey($stock->id)->lockForUpdate()->first();

            $balance = round((float) $stock->quantity + $quantity, 3);
            if ($balance < 0 && !config('bos.allow_negative_stock', false)) {
                throw ValidationException::withMessages([
                    'quantity' => ["Insufficient stock for {$product->name} in {$warehouse->name} (available: " . (float) $stock->quantity . ').'],
                ]);
            }

            $stock->update(['quantity' => $balance]);

            return StockMovement::create([
                'tenant_id'      => $product->tenant_id,
                'business_id'    => $product->business_id,
                'product_id'     => $product->id,
                'warehouse_id'   => $warehouse->id,
                'type'           => $type,
                'quantity'       => $quantity,
                'balance_after'  => $balance,
                'unit_cost'      => $unitCost ?? (float) $product->cost_price,
                'reference_type' => $reference ? $reference->getMorphClass() : null,
                'reference_id'   => $reference?->getKey(),
                'note'           => $note,
                'user_id'        => auth()->id(),
            ]);
        });
    }

    public function transfer(Product $product, Warehouse $from, Warehouse $to, float $quantity, ?string $note = null): void
    {
        if ($from->is($to)) {
            throw ValidationException::withMessages(['to_warehouse_id' => ['Choose a different destination warehouse.']]);
        }

        DB::transaction(function () use ($product, $from, $to, $quantity, $note) {
            $this->move($product, $from, -$quantity, 'transfer_out', null, $note ?? "Transfer to {$to->name}");
            $this->move($product, $to, $quantity, 'transfer_in', null, $note ?? "Transfer from {$from->name}");
        });
    }

    public function available(Product $product, Warehouse $warehouse): float
    {
        return (float) Stock::withoutGlobalScopes()
            ->where('product_id', $product->id)->where('warehouse_id', $warehouse->id)->value('quantity');
    }
}
