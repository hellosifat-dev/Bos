<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Brand;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class BrandController extends CrudController
{
    protected string $model = Brand::class;
    protected string $module = 'brands';
    protected array $filters = ['status'];

    protected function rules(Request $request, ?Model $record = null): array
    {
        return [
            'name'        => [$record ? 'sometimes' : 'required', 'string', 'max:255'],
            'description' => 'nullable|string',
            'status'      => 'in:active,inactive',
        ];
    }

    protected function beforeDelete(Model $record): ?string
    {
        return $record->products()->exists() ? 'Brand has products; reassign them first.' : null;
    }
}
