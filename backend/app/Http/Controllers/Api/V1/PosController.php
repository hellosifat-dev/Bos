<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PosController extends OrderController
{
    /** Active products with availability in the chosen warehouse. */
    public function products(Request $request): JsonResponse
    {
        $warehouseId = $request->query('warehouse_id')
            ?: $this->sales->defaultWarehouseId(app('current_business'));

        $products = Product::query()
            ->where('status', 'active')
            ->with(['category:id,name', 'unit:id,short_name'])
            ->withSum(['stocks as available' => fn ($q) => $q->where('warehouse_id', $warehouseId)], 'quantity')
            ->when($request->query('category_id'), fn ($q, $v) => $q->where('category_id', $v))
            ->when($request->query('search'), function ($q, $s) {
                $t = '%' . strtolower($s) . '%';
                $q->where(fn ($q2) => $q2->whereRaw('LOWER(name) LIKE ?', [$t])
                    ->orWhereRaw('LOWER(sku) LIKE ?', [$t])
                    ->orWhere('barcode', $s));
            })
            ->orderBy('name')
            ->limit(60)
            ->get(['id', 'name', 'sku', 'barcode', 'sell_price', 'tax_rate', 'track_stock', 'category_id', 'unit_id'])
            ->each(fn ($p) => $p->available = (float) $p->available);

        return response()->json(['success' => true, 'data' => $products, 'warehouse_id' => (int) $warehouseId]);
    }

    /** One-step sale: completed order plus payment(s). */
    public function checkout(Request $request): JsonResponse
    {
        $rules = $this->orderRules();
        $rules['tendered'] = 'nullable|numeric|min:0';
        $data = $request->validate($rules);

        $order = $this->sales->create(app('current_business'), [
            ...$data,
            'channel'  => 'pos',
            'complete' => true,
        ]);
        $this->audit->record('create', 'pos', $order->id, null, ['number' => $order->number, 'total' => $order->total]);

        $paid = (float) collect($data['payments'] ?? [])->sum('amount');
        $tendered = (float) ($data['tendered'] ?? $paid);

        return response()->json([
            'success' => true,
            'message' => 'Sale completed.',
            'data'    => $order,
            'change'  => round(max($tendered - (float) $order->total, 0), 2),
        ], 201);
    }
}
