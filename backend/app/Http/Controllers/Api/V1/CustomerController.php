<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class CustomerController extends CrudController
{
    protected string $model = Customer::class;
    protected string $module = 'customers';
    protected array $searchable = ['name', 'email', 'phone'];
    protected array $filters = ['status'];

    protected function query(Request $request): Builder
    {
        return parent::query($request)
            ->withCount(['orders' => fn ($q) => $q->where('status', '!=', 'cancelled')])
            ->withSum(['orders as total_spent' => fn ($q) => $q->whereIn('status', ['completed', 'returned'])], 'total');
    }

    protected function rules(Request $request, ?Model $record = null): array
    {
        return [
            'name'       => [$record ? 'sometimes' : 'required', 'string', 'max:255'],
            'email'      => 'nullable|email|max:255',
            'phone'      => 'nullable|string|max:50',
            'address'    => 'nullable|string|max:255',
            'tax_number' => 'nullable|string|max:64',
            'notes'      => 'nullable|string',
            'status'     => 'in:active,inactive',
        ];
    }

    protected function present(Model $record): array
    {
        $balance = $record->orders()->where('status', 'completed')->get()->sum(fn ($o) => $o->balance_due);
        return $record->toArray() + ['balance_due' => round($balance, 2)];
    }
}
