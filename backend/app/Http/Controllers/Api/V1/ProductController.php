<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Product;
use App\Models\Warehouse;
use App\Services\AuditService;
use App\Services\InventoryService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class ProductController extends CrudController
{
    protected string $model = Product::class;
    protected string $module = 'products';
    protected array $with = ['category:id,name', 'brand:id,name', 'unit:id,name,short_name'];
    protected array $searchable = ['name', 'sku', 'barcode'];
    protected array $filters = ['status', 'category_id', 'brand_id', 'type'];

    public function __construct(AuditService $audit, private InventoryService $inventory)
    {
        parent::__construct($audit);
    }

    protected function query(Request $request): Builder
    {
        return parent::query($request)->withSum('stocks as stock_quantity', 'quantity');
    }

    protected function rules(Request $request, ?Model $record = null): array
    {
        $req = $record ? 'sometimes' : 'required';

        return [
            'name'          => [$req, 'string', 'max:255'],
            'sku'           => [$req, 'string', 'max:64', $this->uniqueInBusiness('products', 'sku', $record)],
            'barcode'       => 'nullable|string|max:64',
            'description'   => 'nullable|string',
            'type'          => 'in:standard,service',
            'category_id'   => ['nullable', $this->inBusiness('categories')],
            'brand_id'      => ['nullable', $this->inBusiness('brands')],
            'unit_id'       => ['nullable', $this->inBusiness('units')],
            'cost_price'    => 'numeric|min:0',
            'sell_price'    => 'numeric|min:0',
            'tax_rate'      => 'numeric|min:0|max:100',
            'track_stock'   => 'boolean',
            'reorder_level' => 'numeric|min:0',
            'status'        => 'in:active,inactive',
            // creation only
            'opening_stock' => $record ? 'prohibited' : 'nullable|numeric|min:0',
            'warehouse_id'  => ['nullable', $this->inBusiness('warehouses')],
        ];
    }

    protected function prepare(array $data, Request $request, ?Model $record = null): array
    {
        if (!$record) {
            $data += ['type' => 'standard', 'track_stock' => true, 'status' => 'active'];
        }
        if (($data['type'] ?? $record?->type) === 'service') {
            $data['track_stock'] = false;
        }
        unset($data['opening_stock'], $data['warehouse_id']);
        return $data;
    }

    protected function afterSave(Model $record, array $data, Request $request): void
    {
        $qty = (float) $request->input('opening_stock', 0);
        if (!$record->wasRecentlyCreated || $qty <= 0 || !$record->track_stock) {
            return;
        }
        $warehouse = $request->filled('warehouse_id')
            ? Warehouse::findOrFail($request->input('warehouse_id'))
            : $this->inventory->defaultWarehouse(app('current_business'));

        $this->inventory->move($record, $warehouse, $qty, 'opening', null, 'Opening stock');
    }
}
