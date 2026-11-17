<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Business;
use App\Models\Expense;
use App\Models\JournalEntry;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PayrollRun;
use App\Models\StockMovement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Double-entry ledger. Operational modules call the record* methods; every
 * posting is balanced (sum of debits == sum of credits).
 */
class AccountingService
{
    /** [code, name, type, system_key] */
    public const DEFAULT_CHART = [
        ['1000', 'Cash', 'asset', 'cash'],
        ['1010', 'Bank', 'asset', 'bank'],
        ['1100', 'Accounts Receivable', 'asset', 'receivable'],
        ['1200', 'Inventory', 'asset', 'inventory'],
        ['2000', 'Accounts Payable', 'liability', 'payable'],
        ['2100', 'Sales Tax Payable', 'liability', 'tax_payable'],
        ['2200', 'Payroll Deductions Payable', 'liability', 'payroll_liabilities'],
        ['3000', "Owner's Equity", 'equity', 'owner_equity'],
        ['3100', 'Opening Balance Equity', 'equity', 'opening_equity'],
        ['3200', 'Retained Earnings', 'equity', 'retained_earnings'],
        ['4000', 'Sales Revenue', 'income', 'sales'],
        ['4100', 'Sales Returns', 'income', 'sales_returns'],
        ['4900', 'Other Income', 'income', null],
        ['5000', 'Cost of Goods Sold', 'expense', 'cogs'],
        ['5100', 'Inventory Adjustments', 'expense', 'inventory_adjustments'],
        ['6000', 'Salaries & Wages', 'expense', 'salaries'],
        ['6100', 'Rent', 'expense', null],
        ['6200', 'Utilities', 'expense', null],
        ['6300', 'Office Supplies', 'expense', null],
        ['6400', 'Marketing', 'expense', null],
        ['6900', 'General Expenses', 'expense', 'general_expense'],
    ];

    /** Create the default chart of accounts for a business (idempotent). */
    public function ensureChart(Business $business): void
    {
        if (Account::withoutGlobalScopes()->where('business_id', $business->id)->exists()) {
            return;
        }

        foreach (self::DEFAULT_CHART as [$code, $name, $type, $key]) {
            Account::withoutGlobalScopes()->create([
                'tenant_id'   => $business->tenant_id,
                'business_id' => $business->id,
                'code'        => $code,
                'name'        => $name,
                'type'        => $type,
                'system_key'  => $key,
            ]);
        }
    }

    public function account(Business $business, string $key): Account
    {
        $this->ensureChart($business);

        return Account::withoutGlobalScopes()
            ->where('business_id', $business->id)->where('system_key', $key)->firstOrFail();
    }

    /**
     * @param array<int, array{account: Account|int, debit?: float, credit?: float, description?: string}> $lines
     */
    public function post(Business $business, string $date, string $description, array $lines, ?Model $source = null, ?string $reference = null): ?JournalEntry
    {
        $lines = array_values(array_filter(array_map(function ($l) {
            $l['debit']  = round((float) ($l['debit'] ?? 0), 2);
            $l['credit'] = round((float) ($l['credit'] ?? 0), 2);
            return $l;
        }, $lines), fn ($l) => $l['debit'] > 0 || $l['credit'] > 0));

        if (!$lines) {
            return null; // nothing to post (e.g. zero-value event)
        }

        $debits  = round(array_sum(array_column($lines, 'debit')), 2);
        $credits = round(array_sum(array_column($lines, 'credit')), 2);
        if (abs($debits - $credits) > 0.004) {
            throw ValidationException::withMessages(['lines' => ["Journal entry is not balanced (debits {$debits}, credits {$credits})."]]);
        }

        return DB::transaction(function () use ($business, $date, $description, $lines, $source, $reference, $debits) {
            Business::whereKey($business->id)->lockForUpdate()->first();
            $sequence = (int) JournalEntry::withoutGlobalScopes()->where('business_id', $business->id)->max('sequence') + 1;

            $entry = JournalEntry::withoutGlobalScopes()->create([
                'tenant_id'   => $business->tenant_id,
                'business_id' => $business->id,
                'sequence'    => $sequence,
                'number'      => sprintf('JE-%06d', $sequence),
                'date'        => $date,
                'reference'   => $reference,
                'description' => $description,
                'source_type' => $source?->getMorphClass(),
                'source_id'   => $source?->getKey(),
                'total'       => $debits,
                'created_by'  => auth()->id(),
            ]);

            foreach ($lines as $l) {
                $entry->lines()->create([
                    'account_id'  => $l['account'] instanceof Account ? $l['account']->id : $l['account'],
                    'debit'       => $l['debit'],
                    'credit'      => $l['credit'],
                    'description' => $l['description'] ?? null,
                ]);
            }

            return $entry;
        });
    }

    // ── Automatic postings ──────────────────────────────────────────────────

    public function recordSale(Order $order): void
    {
        $b     = $order->business;
        $total = (float) $order->total;
        $tax   = (float) $order->tax_total;
        $cost  = $this->costOf($order, fn ($i) => (float) $i->quantity);

        $this->post($b, $this->day($order->completed_at), "Sale {$order->number}", [
            ['account' => $this->account($b, 'receivable'), 'debit' => $total],
            ['account' => $this->account($b, 'sales'), 'credit' => $total - $tax],
            ['account' => $this->account($b, 'tax_payable'), 'credit' => $tax],
            ['account' => $this->account($b, 'cogs'), 'debit' => $cost],
            ['account' => $this->account($b, 'inventory'), 'credit' => $cost],
        ], $order, $order->number);
    }

    /** Returned goods: $value incl. tax, $quantities keyed by order item id. */
    public function recordReturn(Order $order, float $value, array $quantities): void
    {
        $b       = $order->business;
        $taxPart = (float) $order->total > 0 ? round($value * (float) $order->tax_total / (float) $order->total, 2) : 0;
        $cost    = $this->costOf($order, fn ($i) => (float) ($quantities[$i->id] ?? 0));

        $this->post($b, $this->day(now()), "Return on {$order->number}", [
            ['account' => $this->account($b, 'sales_returns'), 'debit' => $value - $taxPart],
            ['account' => $this->account($b, 'tax_payable'), 'debit' => $taxPart],
            ['account' => $this->account($b, 'receivable'), 'credit' => $value],
            ['account' => $this->account($b, 'inventory'), 'debit' => $cost],
            ['account' => $this->account($b, 'cogs'), 'credit' => $cost],
        ], $order, $order->number);
    }

    public function recordPayment(Payment $payment): void
    {
        $b      = $payment->order->business;
        $cash   = $this->account($b, $payment->method === 'cash' ? 'cash' : 'bank');
        $ar     = $this->account($b, 'receivable');
        $amount = (float) $payment->amount;
        $refund = $payment->type === 'refund';

        $this->post($b, $this->day($payment->paid_at), ($refund ? 'Refund' : 'Payment') . " for {$payment->order->number}", [
            ['account' => $cash, 'debit' => $refund ? 0 : $amount, 'credit' => $refund ? $amount : 0],
            ['account' => $ar, 'debit' => $refund ? $amount : 0, 'credit' => $refund ? 0 : $amount],
        ], $payment, $payment->reference);
    }

    public function recordStockMovement(StockMovement $m): void
    {
        if (!in_array($m->type, ['opening', 'adjustment'], true)) {
            return;
        }

        $b      = Business::find($m->business_id);
        $value  = round(abs((float) $m->quantity) * (float) $m->unit_cost, 2);
        $inv    = $this->account($b, 'inventory');
        $other  = $this->account($b, $m->type === 'opening' ? 'opening_equity' : 'inventory_adjustments');
        $inflow = (float) $m->quantity > 0;

        $this->post($b, $this->day($m->created_at), ucfirst($m->type) . ' stock: ' . ($m->product?->name ?? 'product'), [
            ['account' => $inv, 'debit' => $inflow ? $value : 0, 'credit' => $inflow ? 0 : $value],
            ['account' => $other, 'debit' => $inflow ? 0 : $value, 'credit' => $inflow ? $value : 0],
        ], $m, $m->note);
    }

    public function recordPayroll(PayrollRun $run): void
    {
        $b       = $run->business;
        $slips   = $run->payslips()->get();
        $expense = round($slips->sum(fn ($s) => (float) $s->gross - (float) $s->absence_deduction), 2);
        $net     = round($slips->sum(fn ($s) => (float) $s->net), 2);

        $this->post($b, $this->day($run->paid_at), "Payroll {$run->period}", [
            ['account' => $this->account($b, 'salaries'), 'debit' => $expense],
            ['account' => $this->account($b, 'bank'), 'credit' => $net],
            ['account' => $this->account($b, 'payroll_liabilities'), 'credit' => $expense - $net],
        ], $run, $run->period);
    }

    public function recordExpense(Expense $expense): void
    {
        $b = $expense->business;
        $this->post($b, $expense->date->toDateString(), 'Expense' . ($expense->payee ? ": {$expense->payee}" : ''), [
            ['account' => $expense->account_id, 'debit' => (float) $expense->amount, 'description' => $expense->description],
            ['account' => $expense->payment_account_id, 'credit' => (float) $expense->amount],
        ], $expense, $expense->reference);
    }

    private function costOf(Order $order, callable $qty): float
    {
        return round($order->items()->with('product')->get()
            ->filter(fn ($i) => $i->product && $i->product->track_stock)
            ->sum(fn ($i) => $qty($i) * (float) $i->unit_cost), 2);
    }

    private function day($date): string
    {
        return ($date ?? now())->toDateString();
    }

    // ── Balances ────────────────────────────────────────────────────────────

    /**
     * Debit/credit totals per account for entries dated within [from, to].
     * @return \Illuminate\Support\Collection<int, object{account_id:int, debit:float, credit:float}>
     */
    public function totals(Business $business, ?string $from, ?string $to)
    {
        return DB::table('journal_lines as l')
            ->join('journal_entries as e', 'e.id', '=', 'l.journal_entry_id')
            ->where('e.business_id', $business->id)
            ->when($from, fn ($q) => $q->whereDate('e.date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('e.date', '<=', $to))
            ->groupBy('l.account_id')
            ->selectRaw('l.account_id, SUM(l.debit) as debit, SUM(l.credit) as credit')
            ->get()
            ->keyBy('account_id');
    }

    /** Natural-sign balance of an account given its debit/credit totals. */
    public function balance(Account $account, float $debit, float $credit): float
    {
        return round($account->isDebitNormal() ? $debit - $credit : $credit - $debit, 2);
    }
}
