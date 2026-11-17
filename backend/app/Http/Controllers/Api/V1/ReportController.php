<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Account;
use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Services\AccountingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ReportController extends Controller
{
    public function __construct(private AccountingService $accounting) {}

    private function range(Request $request): array
    {
        $data = $request->validate([
            'from' => 'nullable|date',
            'to'   => 'nullable|date|after_or_equal:from',
        ]);
        return [$data['from'] ?? now()->startOfMonth()->toDateString(), $data['to'] ?? now()->toDateString()];
    }

    /** Accounts of the given types with natural-sign balances for the period. */
    private function balances(array $types, ?string $from, ?string $to): Collection
    {
        $business = app('current_business');
        $this->accounting->ensureChart($business);
        $totals = $this->accounting->totals($business, $from, $to);

        return Account::whereIn('type', $types)->orderBy('code')->get()->map(function (Account $a) use ($totals) {
            $t = $totals->get($a->id);
            return [
                'id' => $a->id, 'code' => $a->code, 'name' => $a->name, 'type' => $a->type, 'system_key' => $a->system_key,
                'debit' => round((float) ($t->debit ?? 0), 2), 'credit' => round((float) ($t->credit ?? 0), 2),
                'balance' => $this->accounting->balance($a, (float) ($t->debit ?? 0), (float) ($t->credit ?? 0)),
            ];
        });
    }

    public function profitLoss(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);
        $income   = $this->balances(['income'], $from, $to)->filter(fn ($a) => $a['balance'] != 0)->values();
        $expenses = $this->balances(['expense'], $from, $to)->filter(fn ($a) => $a['balance'] != 0)->values();

        $revenue = round($income->sum('balance'), 2);
        $cogs    = round($expenses->where('system_key', 'cogs')->sum('balance'), 2);
        $opex    = round($expenses->where('system_key', '!=', 'cogs')->sum('balance'), 2);

        return response()->json(['success' => true, 'data' => [
            'from' => $from, 'to' => $to,
            'income' => $income, 'expenses' => $expenses,
            'total_income' => $revenue,
            'cost_of_sales' => $cogs,
            'gross_profit' => round($revenue - $cogs, 2),
            'operating_expenses' => $opex,
            'net_profit' => round($revenue - $cogs - $opex, 2),
        ]]);
    }

    public function balanceSheet(Request $request): JsonResponse
    {
        $asOf = $request->validate(['as_of' => 'nullable|date'])['as_of'] ?? now()->toDateString();

        $assets      = $this->balances(['asset'], null, $asOf)->filter(fn ($a) => $a['balance'] != 0)->values();
        $liabilities = $this->balances(['liability'], null, $asOf)->filter(fn ($a) => $a['balance'] != 0)->values();
        $equity      = $this->balances(['equity'], null, $asOf)->filter(fn ($a) => $a['balance'] != 0)->values();

        // Unclosed profit to date belongs to equity.
        $earnings = round($this->balances(['income'], null, $asOf)->sum('balance') - $this->balances(['expense'], null, $asOf)->sum('balance'), 2);

        $totalAssets = round($assets->sum('balance'), 2);
        $totalLiab   = round($liabilities->sum('balance'), 2);
        $totalEquity = round($equity->sum('balance') + $earnings, 2);

        return response()->json(['success' => true, 'data' => [
            'as_of' => $asOf,
            'assets' => $assets, 'liabilities' => $liabilities, 'equity' => $equity,
            'current_earnings' => $earnings,
            'total_assets' => $totalAssets, 'total_liabilities' => $totalLiab, 'total_equity' => $totalEquity,
            'balanced' => abs($totalAssets - $totalLiab - $totalEquity) < 0.01,
        ]]);
    }

    public function trialBalance(Request $request): JsonResponse
    {
        $asOf = $request->validate(['as_of' => 'nullable|date'])['as_of'] ?? now()->toDateString();
        $rows = $this->balances(['asset', 'liability', 'equity', 'income', 'expense'], null, $asOf)
            ->filter(fn ($a) => $a['debit'] != 0 || $a['credit'] != 0)
            ->map(function ($a) {
                $net = round($a['debit'] - $a['credit'], 2);
                return $a + ['debit_balance' => max($net, 0), 'credit_balance' => max(-$net, 0)];
            })->values();

        return response()->json(['success' => true, 'data' => [
            'as_of' => $asOf, 'accounts' => $rows,
            'total_debit' => round($rows->sum('debit_balance'), 2),
            'total_credit' => round($rows->sum('credit_balance'), 2),
        ]]);
    }

    public function sales(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);

        $orders = Order::whereIn('status', ['completed', 'returned'])
            ->whereDate('completed_at', '>=', $from)->whereDate('completed_at', '<=', $to)
            ->get();

        $daily = $orders->groupBy(fn ($o) => $o->completed_at->toDateString())->map(fn ($g, $day) => [
            'date' => $day,
            'orders' => $g->count(),
            'gross' => round($g->sum(fn ($o) => (float) $o->total), 2),
            'returns' => round($g->sum(fn ($o) => (float) $o->returned_total), 2),
            'tax' => round($g->sum(fn ($o) => (float) $o->tax_total), 2),
            'discount' => round($g->sum(fn ($o) => (float) $o->discount_total), 2),
            'net' => round($g->sum(fn ($o) => $o->netTotal()), 2),
        ])->sortKeys()->values();

        $top = OrderItem::whereIn('order_id', $orders->pluck('id'))
            ->get()
            ->groupBy('product_id')
            ->map(fn ($g) => [
                'product_id' => $g->first()->product_id,
                'name' => $g->first()->name,
                'quantity' => round($g->sum(fn ($i) => (float) $i->quantity - (float) $i->returned_quantity), 3),
                'revenue' => round($g->sum(fn ($i) => (float) $i->line_total * ((float) $i->quantity - (float) $i->returned_quantity) / max((float) $i->quantity, 0.001)), 2),
            ])
            ->sortByDesc('revenue')->take(10)->values();

        $payments = Payment::whereDate('paid_at', '>=', $from)->whereDate('paid_at', '<=', $to)->get()
            ->groupBy('method')
            ->map(fn ($g, $method) => [
                'method' => $method,
                'amount' => round($g->sum(fn ($p) => $p->type === 'refund' ? -(float) $p->amount : (float) $p->amount), 2),
            ])->values();

        return response()->json(['success' => true, 'data' => [
            'from' => $from, 'to' => $to,
            'daily' => $daily,
            'totals' => [
                'orders' => $orders->count(),
                'gross' => round($orders->sum(fn ($o) => (float) $o->total), 2),
                'returns' => round($orders->sum(fn ($o) => (float) $o->returned_total), 2),
                'tax' => round($orders->sum(fn ($o) => (float) $o->tax_total), 2),
                'net' => round($orders->sum(fn ($o) => $o->netTotal()), 2),
                'average_order' => $orders->count() ? round($orders->sum(fn ($o) => $o->netTotal()) / $orders->count(), 2) : 0,
            ],
            'top_products' => $top,
            'payments' => $payments,
        ]]);
    }

    public function inventory(): JsonResponse
    {
        $products = Product::where('track_stock', true)->with('category:id,name')
            ->withSum('stocks as qty', 'quantity')->get();

        $byCategory = $products->groupBy(fn ($p) => $p->category?->name ?? 'Uncategorised')->map(fn ($g, $cat) => [
            'category' => $cat,
            'products' => $g->count(),
            'quantity' => round($g->sum(fn ($p) => (float) $p->qty), 3),
            'cost_value' => round($g->sum(fn ($p) => (float) $p->qty * (float) $p->cost_price), 2),
            'retail_value' => round($g->sum(fn ($p) => (float) $p->qty * (float) $p->sell_price), 2),
        ])->sortBy('category')->values();

        return response()->json(['success' => true, 'data' => [
            'by_category' => $byCategory,
            'total_cost_value' => round($byCategory->sum('cost_value'), 2),
            'total_retail_value' => round($byCategory->sum('retail_value'), 2),
            'low_stock' => $products->filter(fn ($p) => (float) $p->qty <= (float) $p->reorder_level)->count(),
        ]]);
    }

    public function expenses(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);
        $rows = Expense::where('status', 'approved')->whereDate('date', '>=', $from)->whereDate('date', '<=', $to)
            ->with('account:id,code,name')->get()
            ->groupBy('account_id')
            ->map(fn ($g) => ['account' => $g->first()->account?->name, 'code' => $g->first()->account?->code, 'count' => $g->count(), 'amount' => round($g->sum(fn ($e) => (float) $e->amount), 2)])
            ->sortByDesc('amount')->values();

        return response()->json(['success' => true, 'data' => ['from' => $from, 'to' => $to, 'by_account' => $rows, 'total' => round($rows->sum('amount'), 2)]]);
    }
}
