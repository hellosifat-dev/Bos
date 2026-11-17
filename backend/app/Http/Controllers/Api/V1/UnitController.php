<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Unit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class UnitController extends CrudController
{
    protected string $model = Unit::class;
    protected string $module = 'units';
    protected array $searchable = ['name', 'short_name'];

    protected function rules(Request $request, ?Model $record = null): array
    {
        return [
            'name'       => [$record ? 'sometimes' : 'required', 'string', 'max:100'],
            'short_name' => [$record ? 'sometimes' : 'required', 'string', 'max:20'],
        ];
    }

    protected function beforeDelete(Model $record): ?string
    {
        return $record->products()->exists() ? 'Unit is used by products.' : null;
    }
}
