<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesBusiness;
use Tests\TestCase;

class AccountingTest extends TestCase
{
    use RefreshDatabase, CreatesBusiness;

    public function test_operations_post_balanced_books_and_reports(): void
    {
        $this->seed(DatabaseSeeder::class);
        $h = $this->ownerWithBusiness();

        $accounts = collect($this->getJson('/api/v1/accounts?all=1', $h)->assertOk()->json('data'))->keyBy('system_key');
        $this->assertCount(21, $this->getJson('/api/v1/accounts?all=1', $h)->json('data'));

        // Opening stock: Dr Inventory 10 / Cr Opening equity 10
        $cola = $this->postJson('/api/v1/products', [
            'name' => 'Cola', 'sku' => 'COLA', 'cost_price' => 1, 'sell_price' => 2, 'tax_rate' => 10, 'opening_stock' => 10,
        ], $h)->json('data.id');

        // Sale of 3 incl. 10% tax = 6.60, paid cash
        $order = $this->postJson('/api/v1/pos/checkout', [
            'items' => [['product_id' => $cola, 'quantity' => 3]],
            'payments' => [['amount' => 6.60, 'method' => 'cash']],
        ], $h)->assertCreated();
        $orderId = $order->json('data.id');
        $itemId  = $order->json('data.items.0.id');

        // Shrinkage of 1 unit
        $this->postJson('/api/v1/inventory/adjust', ['product_id' => $cola, 'quantity' => -1, 'note' => 'Broken'], $h)->assertCreated();

        // Return 1 unit (2.20 refunded in cash)
        $this->postJson("/api/v1/orders/{$orderId}/return", ['lines' => [['item_id' => $itemId, 'quantity' => 1]]], $h)->assertOk();

        // Rent expense 5 paid in cash: pending until approved
        $expense = $this->postJson('/api/v1/expenses', [
            'date' => now()->toDateString(), 'account_id' => $accounts['general_expense']['id'],
            'payment_account_id' => $accounts['cash']['id'], 'amount' => 5, 'payee' => 'Landlord',
        ], $h)->assertCreated()->json('data.id');
        $this->postJson('/api/v1/expenses', [
            'date' => now()->toDateString(), 'account_id' => $accounts['cash']['id'], // not an expense account
            'payment_account_id' => $accounts['cash']['id'], 'amount' => 5,
        ], $h)->assertStatus(422);
        $this->postJson("/api/v1/expenses/{$expense}/approve", [], $h)->assertOk();
        $this->putJson("/api/v1/expenses/{$expense}", ['amount' => 6], $h)->assertStatus(422);
        $this->deleteJson("/api/v1/expenses/{$expense}", [], $h)->assertStatus(422);

        // Payroll of 100 paid from the bank
        $this->postJson('/api/v1/employees', ['name' => 'Ann', 'employee_code' => 'E1', 'join_date' => '2026-01-01', 'basic_salary' => 100], $h)->assertCreated();
        $run = $this->postJson('/api/v1/payroll', ['period' => '2026-10'], $h)->json('data.id');
        $this->postJson("/api/v1/payroll/{$run}/approve", [], $h)->assertOk();
        $this->postJson("/api/v1/payroll/{$run}/pay", [], $h)->assertOk();

        $range = '?from=2026-01-01&to=' . now()->toDateString();

        $pl = $this->getJson('/api/v1/reports/profit-loss' . $range, $h)->assertOk();
        $this->assertEquals(4.00, $pl->json('data.total_income'));      // 6 sales − 2 returns
        $this->assertEquals(2.00, $pl->json('data.cost_of_sales'));     // 3 sold − 1 returned at cost 1
        $this->assertEquals(2.00, $pl->json('data.gross_profit'));
        $this->assertEquals(106.00, $pl->json('data.operating_expenses')); // 1 shrinkage + 5 rent + 100 salary
        $this->assertEquals(-104.00, $pl->json('data.net_profit'));

        $bs = $this->getJson('/api/v1/reports/balance-sheet', $h)->assertOk();
        $this->assertTrue($bs->json('data.balanced'));
        $this->assertEquals(-93.60, $bs->json('data.total_assets'));
        $this->assertEquals(0.40, $bs->json('data.total_liabilities'));   // tax 0.60 − 0.20
        $this->assertEquals(-94.00, $bs->json('data.total_equity'));
        $inventory = collect($bs->json('data.assets'))->firstWhere('system_key', 'inventory');
        $this->assertEquals(7.00, $inventory['balance']);

        $tb = $this->getJson('/api/v1/reports/trial-balance', $h)->assertOk();
        $this->assertEquals($tb->json('data.total_debit'), $tb->json('data.total_credit'));

        $ledger = $this->getJson('/api/v1/accounts/' . $accounts['cash']['id'] . '/ledger', $h)->assertOk();
        $this->assertEquals(-0.60, $ledger->json('data.closing_balance'));
        $this->assertCount(3, $ledger->json('data.lines'));

        $sales = $this->getJson('/api/v1/reports/sales' . $range, $h)->assertOk();
        $this->assertEquals(1, $sales->json('data.totals.orders'));
        $this->assertEquals(4.40, $sales->json('data.totals.net'));
        $this->assertEquals(2, $sales->json('data.top_products.0.quantity'));
        $this->assertEquals(4.40, $sales->json('data.payments.0.amount'));

        $inv = $this->getJson('/api/v1/reports/inventory', $h)->assertOk();
        $this->assertEquals(7.00, $inv->json('data.total_cost_value'));
        $this->assertEquals(5.00, $this->getJson('/api/v1/reports/expenses' . $range, $h)->json('data.total'));

        // Manual entries must balance
        $this->postJson('/api/v1/journal-entries', [
            'date' => now()->toDateString(), 'description' => 'Bad',
            'lines' => [['account_id' => $accounts['cash']['id'], 'debit' => 10], ['account_id' => $accounts['owner_equity']['id'], 'credit' => 9]],
        ], $h)->assertStatus(422);
        $je = $this->postJson('/api/v1/journal-entries', [
            'date' => now()->toDateString(), 'description' => 'Owner investment',
            'lines' => [['account_id' => $accounts['bank']['id'], 'debit' => 1000], ['account_id' => $accounts['owner_equity']['id'], 'credit' => 1000]],
        ], $h)->assertCreated();
        $this->getJson('/api/v1/journal-entries/' . $je->json('data.id'), $h)->assertOk()->assertJsonCount(2, 'data.lines');
        $this->assertTrue($this->getJson('/api/v1/reports/balance-sheet', $h)->json('data.balanced'));

        // System accounts are protected
        $this->deleteJson('/api/v1/accounts/' . $accounts['cash']['id'], [], $h)->assertStatus(422);
        $custom = $this->postJson('/api/v1/accounts', ['code' => '6500', 'name' => 'Travel', 'type' => 'expense'], $h)->assertCreated()->json('data.id');
        $this->deleteJson("/api/v1/accounts/{$custom}", [], $h)->assertOk();
    }
}
