<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Employee;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EmployeeController extends CrudController
{
    protected string $model = Employee::class;
    protected string $module = 'employees';
    protected array $with = ['branch:id,name', 'department:id,name', 'designation:id,name'];
    protected array $searchable = ['name', 'employee_code', 'email', 'phone'];
    protected array $filters = ['status', 'department_id', 'designation_id', 'branch_id', 'employment_type'];

    protected function rules(Request $request, ?Model $record = null): array
    {
        $req = $record ? 'sometimes' : 'required';

        return [
            'name'            => [$req, 'string', 'max:255'],
            'employee_code'   => [$req, 'string', 'max:32', $this->uniqueInBusiness('employees', 'employee_code', $record)],
            'email'           => 'nullable|email|max:255',
            'phone'           => 'nullable|string|max:50',
            'join_date'       => [$req, 'date'],
            'employment_type' => 'in:full_time,part_time,contract,intern',
            'branch_id'       => ['nullable', $this->inBusiness('branches')],
            'department_id'   => ['nullable', $this->inBusiness('departments')],
            'designation_id'  => ['nullable', $this->inBusiness('designations')],
            'user_id'         => ['nullable', Rule::exists('user_roles', 'user_id')->where('business_id', app('current_business')->id)],
            'basic_salary'    => 'numeric|min:0',
            'allowances'      => 'numeric|min:0',
            'deductions'      => 'numeric|min:0',
            'bank_account'    => 'nullable|string|max:64',
            'status'          => 'in:active,inactive,terminated',
            'terminated_at'   => 'nullable|date|required_if:status,terminated',
        ];
    }

    protected function beforeDelete(Model $record): ?string
    {
        return \App\Models\Payslip::where('employee_id', $record->id)->exists()
            ? 'Employee has payroll history; mark them terminated instead.'
            : null;
    }
}
