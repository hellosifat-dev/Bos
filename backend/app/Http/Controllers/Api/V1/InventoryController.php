<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Warehouse;
use App\Services\AuditService;
use App\Services\InventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function __construct(private InventoryService $inventory, private AuditService $audit) {}

    private function exists(string $table): \Illuminate\Validation\Rules\Exists
    {
        return Rule::exists($table, 'id')->where('business_id', app('current_business')->id);
    }

    /** Stock levels per product (optionally for one warehouse). */
    public function index(Request $request): JsonResponse
    {
        $warehouseId = $request->query('warehouse_id');

        $query = Product::query()
            ->where('track_stock', true)
            ->with(['category:id,name', 'unit:id,short_name'])
            ->withSum(['stocks as quantity' => fn ($q) => $warehouseId ? $q->where('warehouse_id', $warehouseId) : $q], 'quantity')
            ->when($request->query('search'), function ($q, $s) {
                $t = '%' . strtolower($s) . '%';
                $q->where(fn ($q2) => $q2->whereRaw('LOWER(name) LIKE ?', [$t])->orWhereRaw('LOWER(sku) LIKE ?', [$t]));
            })
            ->orderBy('name');

        $rows = $query->get()->map(function (Product $p) {
            $qty = (float) ($p->quantity ?? 0);
            return [
                'product_id'    => $p->id,
                'name'          => $p->name,
                'sku'           => $p->sku,
                'category'      => $p->category?->name,
                'unit'          => $p->unit?->short_name,
                'quantity'      => $qty,
                'reorder_level' => (float) $p->reorder_level,
                'cost_price'    => (float) $p->cost_price,
                'value'         => round($qty * (float) $p->cost_price, 2),
                'low_stock'     => $qty <= (float) $p->reorder_level,
            ];
        });

        if ($request->boolean('low_stock')) {
            $rows = $rows->where('low_stock', true);
        }

        $perPage = min((int) $request->query('per_page', 20), 100);
        $page    = max((int) $request->query('page', 1), 1);

        return response()->json([
            'success' => true,
            'data'    => $rows->values()->forPage($page, $perPage)->values(),
            'meta'    => [
                'current_page' => $page,
                'last_page'    => max((int) ceil($rows->count() / $perPage), 1),
                'per_page'     => $perPage,
                'total'        => $rows->count(),
                'total_value'  => round($rows->sum('value'), 2),
                'low_stock'    => $rows->where('low_stock', true)->count(),
            ],
        ]);
    }

    /** Quantities of one product in each warehouse. */
    public function product(string $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        return response()->json([
            'success' => true,
            'data'    => Stock::where('product_id', $product->id)->with('warehouse:id,name,code')->get(),
        ]);
    }

    public function adjust(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id'   => ['required', $this->exists('products')],
            'warehouse_id' => ['nullable', $this->exists('warehouses')],
            'quantity'     => 'required|numeric|not_in:0',
            'note'         => 'nullable|string|max:255',
        ]);

        $product   = Product::findOrFail($data['product_id']);
        $warehouse = isset($data['warehouse_id'])
            ? Warehouse::findOrFail($data['warehouse_id'])
            : $this->inventory->defaultWarehouse(app('current_business'));

        $movement = $this->inventory->move($product, $warehouse, (float) $data['quantity'], 'adjustment', null, $data['note'] ?? null);
        $this->audit->record('adjust', 'inventory', $product->id, null, $data);

        return response()->json(['success' => true, 'message' => 'Stock adjusted.', 'data' => $movement], 201);
    }

    public function transfer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_id'        => ['required', $this->exists('products')],
            'from_warehouse_id' => ['required', $this->exists('warehouses')],
            'to_warehouse_id'   => ['required', $this->exists('warehouses')],
            'quantity'          => 'required|numeric|gt:0',
            'note'              => 'nullable|string|max:255',
        ]);

        $this->inventory->transfer(
            Product::findOrFail($data['product_id']),
            Warehouse::findOrFail($data['from_warehouse_id']),
            Warehouse::findOrFail($data['to_warehouse_id']),
            (float) $data['quantity'],
            $data['note'] ?? null,
        );
        $this->audit->record('transfer', 'inventory', $data['product_id'], null, $data);

        return response()->json(['success' => true, 'message' => 'Stock transferred.'], 201);
    }

    public function movements(Request $request): JsonResponse
    {
        $page = StockMovement::query()
            ->with(['product:id,name,sku', 'warehouse:id,name', 'user:id,first_name,last_name'])
            ->when($request->query('product_id'), fn ($q, $v) => $q->where('product_id', $v))
            ->when($request->query('warehouse_id'), fn ($q, $v) => $q->where('warehouse_id', $v))
            ->when($request->query('type'), fn ($q, $v) => $q->where('type', $v))
            ->orderByDesc('id')
            ->paginate(min((int) $request->query('per_page', 20), 100));

        return response()->json([
            'success' => true,
            'data'    => collect($page->items())->map(fn ($m) => $m->toArray() + ['user_name' => $m->user?->name]),
            'meta'    => [
                'current_page' => $page->currentPage(),
                'last_page'    => $page->lastPage(),
                'per_page'     => $page->perPage(),
                'total'        => $page->total(),
            ],
        ]);
    }
}
