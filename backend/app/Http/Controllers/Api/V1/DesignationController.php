<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Designation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class DesignationController extends CrudController
{
    protected string $model = Designation::class;
    protected string $module = 'designations';
    protected array $with = ['department:id,name'];
    protected array $searchable = ['name', 'code'];
    protected array $filters = ['status', 'department_id'];

    protected function query(Request $request): Builder
    {
        return parent::query($request)->withCount('employees');
    }

    protected function rules(Request $request, ?Model $record = null): array
    {
        return [
            'name'          => [$record ? 'sometimes' : 'required', 'string', 'max:255'],
            'code'          => 'nullable|string|max:32',
            'department_id' => ['nullable', $this->inBusiness('departments')],
            'level'         => 'integer|min:1|max:20',
            'description'   => 'nullable|string',
            'status'        => 'in:active,inactive',
        ];
    }

    protected function beforeDelete(Model $record): ?string
    {
        return $record->employees()->exists() ? 'Designation is assigned to employees.' : null;
    }
}
