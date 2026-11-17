<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Expense;
use App\Services\AccountingService;
use App\Services\AuditService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ExpenseController extends CrudController
{
    protected string $model = Expense::class;
    protected string $module = 'expenses';
    protected array $with = ['account:id,code,name', 'paymentAccount:id,code,name', 'branch:id,name'];
    protected array $searchable = ['payee', 'reference', 'description'];
    protected array $filters = ['status', 'account_id', 'branch_id'];
    protected string $orderBy = 'date';
    protected string $orderDir = 'desc';

    public function __construct(AuditService $audit, private AccountingService $accounting)
    {
        parent::__construct($audit);
    }

    protected function rules(Request $request, ?Model $record = null): array
    {
        if ($record && $record->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['Only pending expenses can be edited.']]);
        }
        $req = $record ? 'sometimes' : 'required';
        $bid = app('current_business')->id;

        return [
            'date'               => [$req, 'date'],
            'account_id'         => [$req, Rule::exists('accounts', 'id')->where('business_id', $bid)->where('type', 'expense')],
            'payment_account_id' => [$req, Rule::exists('accounts', 'id')->where('business_id', $bid)->whereIn('system_key', ['cash', 'bank', 'payable'])],
            'amount'             => [$req, 'numeric', 'gt:0'],
            'payee'              => 'nullable|string|max:255',
            'reference'          => 'nullable|string|max:255',
            'description'        => 'nullable|string',
            'branch_id'          => ['nullable', $this->inBusiness('branches')],
        ];
    }

    protected function prepare(array $data, Request $request, ?Model $record = null): array
    {
        if (!$record) {
            $data['created_by'] = auth()->id();
            $data['status'] = 'pending';
        }
        return $data;
    }

    protected function beforeDelete(Model $record): ?string
    {
        return $record->status === 'approved' ? 'Approved expenses are posted to the ledger and cannot be deleted.' : null;
    }

    public function approve(string $id): JsonResponse
    {
        $expense = Expense::findOrFail($id);
        if ($expense->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['This expense has already been reviewed.']]);
        }

        DB::transaction(function () use ($expense) {
            $expense->update(['status' => 'approved', 'approved_by' => auth()->id(), 'approved_at' => now()]);
            $this->accounting->recordExpense($expense);
        });
        $this->audit->record('approve', 'expenses', $expense->id);

        return response()->json(['success' => true, 'message' => 'Expense approved and posted.', 'data' => $expense->fresh($this->with)]);
    }

    public function reject(string $id): JsonResponse
    {
        $expense = Expense::findOrFail($id);
        if ($expense->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['This expense has already been reviewed.']]);
        }
        $expense->update(['status' => 'rejected', 'approved_by' => auth()->id(), 'approved_at' => now()]);
        $this->audit->record('reject', 'expenses', $expense->id);

        return response()->json(['success' => true, 'message' => 'Expense rejected.', 'data' => $expense->fresh($this->with)]);
    }
}
