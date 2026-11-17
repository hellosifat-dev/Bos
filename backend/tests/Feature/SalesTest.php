<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesBusiness;
use Tests\TestCase;

class SalesTest extends TestCase
{
    use RefreshDatabase, CreatesBusiness;

    private array $h;
    private int $cola;
    private int $chips;
    private int $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
        $this->h = $this->ownerWithBusiness();
        $this->cola = $this->postJson('/api/v1/products', [
            'name' => 'Cola', 'sku' => 'COLA', 'sell_price' => 2, 'cost_price' => 1, 'tax_rate' => 10, 'opening_stock' => 10,
        ], $this->h)->json('data.id');
        $this->chips = $this->postJson('/api/v1/products', [
            'name' => 'Chips', 'sku' => 'CHIPS', 'sell_price' => 3, 'cost_price' => 1.5, 'opening_stock' => 5,
        ], $this->h)->json('data.id');
        $this->service = $this->postJson('/api/v1/products', [
            'name' => 'Gift wrap', 'sku' => 'WRAP', 'type' => 'service', 'sell_price' => 1,
        ], $this->h)->json('data.id');
    }

    private function stock(int $productId): float
    {
        return (float) $this->getJson("/api/v1/products/{$productId}", $this->h)->json('data.stock_quantity');
    }

    public function test_pos_checkout_deducts_stock_and_takes_payment(): void
    {
        $res = $this->postJson('/api/v1/pos/checkout', [
            'items' => [
                ['product_id' => $this->cola, 'quantity' => 3],                 // 6.00 + 0.60 tax
                ['product_id' => $this->chips, 'quantity' => 1, 'discount' => 0.5], // 2.50
                ['product_id' => $this->service, 'quantity' => 1],              // 1.00
            ],
            'payments' => [['amount' => 10.10, 'method' => 'cash']],
            'tendered' => 20,
        ], $this->h)->assertCreated();

        $res->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.payment_status', 'paid')
            ->assertJsonPath('data.total', '10.10')
            ->assertJsonPath('data.tax_total', '0.60')
            ->assertJsonPath('data.number', 'POS-000001')
            ->assertJsonPath('change', 9.9);

        $this->assertEquals(7, $this->stock($this->cola));
        $this->assertEquals(4, $this->stock($this->chips));

        // overselling is blocked
        $this->postJson('/api/v1/pos/checkout', ['items' => [['product_id' => $this->chips, 'quantity' => 99]]], $this->h)
            ->assertStatus(422);
        $this->assertEquals(4, $this->stock($this->chips));

        $this->getJson('/api/v1/pos/products?search=col', $this->h)->assertOk()->assertJsonPath('data.0.available', 7);
        $stats = $this->getJson('/api/v1/dashboard/stats', $this->h)->assertOk();
        $this->assertEquals(10.1, $stats->json('data.sales_today'));
    }

    public function test_manual_order_lifecycle_with_partial_payment_and_return(): void
    {
        $customer = $this->postJson('/api/v1/customers', ['name' => 'Ann', 'phone' => '555'], $this->h)->assertCreated()->json('data.id');

        $order = $this->postJson('/api/v1/orders', [
            'customer_id' => $customer,
            'items' => [['product_id' => $this->chips, 'quantity' => 2, 'unit_price' => 5]],
        ], $this->h)->assertCreated();
        $id = $order->json('data.id');
        $order->assertJsonPath('data.status', 'draft')->assertJsonPath('data.number', 'SO-000001');
        $this->assertEquals(5, $this->stock($this->chips)); // drafts don't touch stock

        $this->putJson("/api/v1/orders/{$id}", ['items' => [['product_id' => $this->chips, 'quantity' => 4, 'unit_price' => 5]]], $this->h)
            ->assertOk()->assertJsonPath('data.total', '20.00');

        $this->postJson("/api/v1/orders/{$id}/complete", [], $this->h)->assertOk();
        $this->assertEquals(1, $this->stock($this->chips));
        $this->putJson("/api/v1/orders/{$id}", ['notes' => 'x'], $this->h)->assertStatus(422);
        $this->postJson("/api/v1/orders/{$id}/cancel", [], $this->h)->assertStatus(422);

        $this->postJson("/api/v1/orders/{$id}/payments", ['amount' => 25, 'method' => 'cash'], $this->h)->assertStatus(422);
        $this->postJson("/api/v1/orders/{$id}/payments", ['amount' => 15, 'method' => 'card'], $this->h)->assertCreated();
        $this->getJson("/api/v1/orders/{$id}", $this->h)->assertJsonPath('data.payment_status', 'partial')->assertJsonPath('data.balance_due', 5);

        $cust = $this->getJson("/api/v1/customers/{$customer}", $this->h)->assertOk();
        $this->assertEquals(5, $cust->json('data.balance_due'));

        // Return 2 of 4 (value 10): customer paid 15 of a now-10 order -> refund 5
        $itemId = $this->getJson("/api/v1/orders/{$id}", $this->h)->json('data.items.0.id');
        $this->postJson("/api/v1/orders/{$id}/return", ['lines' => [['item_id' => $itemId, 'quantity' => 2]]], $this->h)
            ->assertOk()->assertJsonPath('data.status', 'completed')->assertJsonPath('data.refunded_total', '5.00')
            ->assertJsonPath('data.payment_status', 'paid')->assertJsonPath('data.balance_due', 0);
        $this->assertEquals(3, $this->stock($this->chips));

        // Return the rest -> fully returned & refunded
        $this->postJson("/api/v1/orders/{$id}/return", [], $this->h)
            ->assertOk()->assertJsonPath('data.status', 'returned')->assertJsonPath('data.payment_status', 'refunded');
        $this->assertEquals(5, $this->stock($this->chips));
        $this->postJson("/api/v1/orders/{$id}/return", [], $this->h)->assertStatus(422);

        // A draft can be cancelled
        $d = $this->postJson('/api/v1/orders', ['items' => [['product_id' => $this->cola, 'quantity' => 1]]], $this->h)->json('data.id');
        $this->postJson("/api/v1/orders/{$d}/cancel", [], $this->h)->assertOk()->assertJsonPath('data.status', 'cancelled');

        $this->getJson('/api/v1/orders?status=returned', $this->h)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/orders?search=so-000001', $this->h)->assertOk()->assertJsonCount(1, 'data');
    }
}
