<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Warehouse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class WarehouseController extends CrudController
{
    protected string $model = Warehouse::class;
    protected string $module = 'warehouses';
    protected array $with = ['branch:id,name'];
    protected array $searchable = ['name', 'code'];
    protected array $filters = ['status', 'branch_id'];

    protected function rules(Request $request, ?Model $record = null): array
    {
        return [
            'name'       => [$record ? 'sometimes' : 'required', 'string', 'max:255'],
            'code'       => [$record ? 'sometimes' : 'required', 'string', 'max:20', $this->uniqueInBusiness('warehouses', 'code', $record)],
            'branch_id'  => ['nullable', $this->inBusiness('branches')],
            'address'    => 'nullable|string|max:255',
            'is_default' => 'boolean',
            'status'     => 'in:active,inactive',
        ];
    }

    protected function afterSave(Model $record, array $data, Request $request): void
    {
        if (!empty($data['is_default'])) {
            Warehouse::where('id', '!=', $record->id)->update(['is_default' => false]);
        }
    }

    protected function present(Model $record): array
    {
        return $record->loadSum('stocks as stock_quantity', 'quantity')->toArray();
    }

    protected function beforeDelete(Model $record): ?string
    {
        return $record->stocks()->where('quantity', '!=', 0)->exists() ? 'Warehouse still holds stock; transfer it first.' : null;
    }
}
