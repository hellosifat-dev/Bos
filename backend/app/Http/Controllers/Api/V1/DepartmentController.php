<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Department;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class DepartmentController extends CrudController
{
    protected string $model = Department::class;
    protected string $module = 'departments';
    protected array $with = ['branch:id,name'];
    protected array $searchable = ['name', 'code'];
    protected array $filters = ['status', 'branch_id'];

    protected function query(Request $request): Builder
    {
        return parent::query($request)->withCount('employees');
    }

    protected function rules(Request $request, ?Model $record = null): array
    {
        return [
            'name'        => [$record ? 'sometimes' : 'required', 'string', 'max:255'],
            'code'        => 'nullable|string|max:32',
            'branch_id'   => ['nullable', $this->inBusiness('branches')],
            'description' => 'nullable|string',
            'status'      => 'in:active,inactive',
        ];
    }

    protected function beforeDelete(Model $record): ?string
    {
        return $record->employees()->exists() ? 'Department has employees; move them first.' : null;
    }
}
