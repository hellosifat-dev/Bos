<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Account;
use App\Models\JournalLine;
use App\Services\AccountingService;
use App\Services\AuditService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends CrudController
{
    protected string $model = Account::class;
    protected string $module = 'accounting';
    protected array $searchable = ['name', 'code'];
    protected array $filters = ['type', 'status'];
    protected string $orderBy = 'code';

    public function __construct(AuditService $audit, private AccountingService $accounting)
    {
        parent::__construct($audit);
    }

    protected function query(Request $request): Builder
    {
        $this->accounting->ensureChart(app('current_business'));
        return parent::query($request);
    }

    protected function rules(Request $request, ?Model $record = null): array
    {
        $req = $record ? 'sometimes' : 'required';
        return [
            'code'        => [$req, 'string', 'max:20', $this->uniqueInBusiness('accounts', 'code', $record)],
            'name'        => [$req, 'string', 'max:255'],
            // The type of a system account is fixed.
            'type'        => [$record?->system_key ? 'prohibited' : $req, 'in:asset,liability,equity,income,expense'],
            'parent_id'   => ['nullable', $this->inBusiness('accounts')],
            'description' => 'nullable|string',
            'status'      => 'in:active,inactive',
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $response = parent::index($request);
        $payload  = $response->getData(true);

        // Attach balances (all-time) to each row.
        $totals = $this->accounting->totals(app('current_business'), null, null);
        $payload['data'] = collect($payload['data'])->map(function ($row) use ($totals) {
            $t = $totals->get($row['id']);
            $debitNormal = in_array($row['type'], ['asset', 'expense'], true);
            $d = (float) ($t->debit ?? 0);
            $c = (float) ($t->credit ?? 0);
            return $row + ['balance' => round($debitNormal ? $d - $c : $c - $d, 2)];
        })->all();

        return response()->json($payload);
    }

    protected function beforeDelete(Model $record): ?string
    {
        if ($record->system_key) {
            return 'System accounts cannot be deleted.';
        }
        return $record->lines()->exists() ? 'Account has journal entries; deactivate it instead.' : null;
    }

    /** Account ledger with running balance. */
    public function ledger(Request $request, string $id): JsonResponse
    {
        $account = Account::findOrFail($id);
        $from = $request->query('from');
        $to   = $request->query('to');

        $opening = 0.0;
        if ($from) {
            $t = $this->accounting->totals(app('current_business'), null, date('Y-m-d', strtotime("{$from} -1 day")))->get($account->id);
            $opening = $this->accounting->balance($account, (float) ($t->debit ?? 0), (float) ($t->credit ?? 0));
        }

        $lines = JournalLine::where('account_id', $account->id)
            ->join('journal_entries as e', 'e.id', '=', 'journal_lines.journal_entry_id')
            ->when($from, fn ($q) => $q->whereDate('e.date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('e.date', '<=', $to))
            ->orderBy('e.date')->orderBy('e.id')
            ->get(['journal_lines.*', 'e.number', 'e.date', 'e.description as entry_description', 'e.reference']);

        $running = $opening;
        $rows = $lines->map(function ($l) use (&$running, $account) {
            $running += $this->accounting->balance($account, (float) $l->debit, (float) $l->credit);
            return [
                'id' => $l->id, 'journal_entry_id' => $l->journal_entry_id, 'number' => $l->number,
                'date' => substr((string) $l->date, 0, 10), 'description' => $l->description ?: $l->entry_description,
                'reference' => $l->reference, 'debit' => (float) $l->debit, 'credit' => (float) $l->credit,
                'balance' => round($running, 2),
            ];
        });

        return response()->json([
            'success' => true,
            'data'    => ['account' => $account, 'opening_balance' => round($opening, 2), 'closing_balance' => round($running, 2), 'lines' => $rows],
        ]);
    }
}
