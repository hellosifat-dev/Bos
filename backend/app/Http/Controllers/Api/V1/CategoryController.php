<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Category;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class CategoryController extends CrudController
{
    protected string $model = Category::class;
    protected string $module = 'categories';
    protected array $with = ['parent:id,name'];
    protected array $filters = ['status', 'parent_id'];

    protected function rules(Request $request, ?Model $record = null): array
    {
        return [
            'name'        => [$record ? 'sometimes' : 'required', 'string', 'max:255'],
            'parent_id'   => ['nullable', $this->inBusiness('categories'), $record ? 'not_in:' . $record->id : 'nullable'],
            'description' => 'nullable|string',
            'status'      => 'in:active,inactive',
        ];
    }

    protected function present(Model $record): array
    {
        return $record->loadCount('products')->toArray();
    }

    protected function beforeDelete(Model $record): ?string
    {
        return $record->products()->exists() ? 'Category has products; reassign them first.' : null;
    }
}
