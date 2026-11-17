<?php

namespace Tests\Feature;

use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesBusiness;
use Tests\TestCase;

class InventoryTest extends TestCase
{
    use RefreshDatabase, CreatesBusiness;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    public function test_catalog_and_stock_flow(): void
    {
        $h = $this->ownerWithBusiness();

        $cat   = $this->postJson('/api/v1/categories', ['name' => 'Drinks'], $h)->assertCreated()->json('data.id');
        $brand = $this->postJson('/api/v1/brands', ['name' => 'Acme'], $h)->assertCreated()->json('data.id');
        $unit  = $this->postJson('/api/v1/units', ['name' => 'Piece', 'short_name' => 'pc'], $h)->assertCreated()->json('data.id');

        $main = $this->postJson('/api/v1/warehouses', ['name' => 'Main', 'code' => 'MAIN', 'is_default' => true], $h)->assertCreated()->json('data.id');
        $back = $this->postJson('/api/v1/warehouses', ['name' => 'Back', 'code' => 'BACK'], $h)->assertCreated()->json('data.id');
        $this->postJson('/api/v1/warehouses', ['name' => 'Dup', 'code' => 'MAIN'], $h)->assertStatus(422);

        $p = $this->postJson('/api/v1/products', [
            'name' => 'Cola', 'sku' => 'COLA-1', 'category_id' => $cat, 'brand_id' => $brand, 'unit_id' => $unit,
            'cost_price' => 0.5, 'sell_price' => 1.25, 'reorder_level' => 5,
            'opening_stock' => 20, 'warehouse_id' => $main,
        ], $h)->assertCreated();
        $pid = $p->json('data.id');
        $this->assertEquals(20, (float) $p->json('data.stock_quantity'));
        $this->assertEquals('Drinks', $p->json('data.category.name'));

        $this->postJson('/api/v1/products', ['name' => 'Cola 2', 'sku' => 'COLA-1'], $h)->assertStatus(422);
        $this->getJson('/api/v1/products?search=cola', $h)->assertOk()->assertJsonCount(1, 'data');

        $this->postJson('/api/v1/inventory/transfer', [
            'product_id' => $pid, 'from_warehouse_id' => $main, 'to_warehouse_id' => $back, 'quantity' => 8,
        ], $h)->assertCreated();
        $this->postJson('/api/v1/inventory/adjust', ['product_id' => $pid, 'warehouse_id' => $main, 'quantity' => -10], $h)->assertCreated();

        // only 2 left in main: going below zero is rejected
        $this->postJson('/api/v1/inventory/adjust', ['product_id' => $pid, 'warehouse_id' => $main, 'quantity' => -3], $h)->assertStatus(422);

        $inv = $this->getJson('/api/v1/inventory', $h)->assertOk();
        $this->assertEquals(10, $inv->json('data.0.quantity'));
        $this->assertEquals(5, $inv->json('meta.total_value'));
        $this->assertEquals(0, $inv->json('meta.low_stock'));

        $this->getJson("/api/v1/inventory?warehouse_id={$main}", $h)->assertJsonPath('data.0.quantity', 2)->assertJsonPath('data.0.low_stock', true);
        $this->assertCount(4, $this->getJson('/api/v1/inventory/movements', $h)->json('data'));
        $this->assertCount(2, $this->getJson("/api/v1/inventory/products/{$pid}", $h)->json('data'));

        // deleting guarded resources
        $this->deleteJson("/api/v1/categories/{$cat}", [], $h)->assertStatus(422);
        $this->deleteJson("/api/v1/warehouses/{$back}", [], $h)->assertStatus(422);
        $this->putJson("/api/v1/products/{$pid}", ['sell_price' => 1.5], $h)->assertOk()->assertJsonPath('data.sell_price', '1.50');

        // services never track stock
        $svc = $this->postJson('/api/v1/products', ['name' => 'Repair', 'sku' => 'SVC-1', 'type' => 'service'], $h)
            ->assertCreated()->json('data.id');
        $this->postJson('/api/v1/inventory/adjust', ['product_id' => $svc, 'quantity' => 1], $h)->assertStatus(422);
    }

    public function test_data_is_isolated_between_businesses(): void
    {
        $a = $this->ownerWithBusiness('a@example.com');
        $pid = $this->postJson('/api/v1/products', ['name' => 'Secret', 'sku' => 'S1'], $a)->assertCreated()->json('data.id');

        $b = $this->ownerWithBusiness('b@example.com');
        $this->getJson('/api/v1/products', $b)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/v1/products/{$pid}", $b)->assertNotFound();
        $this->postJson('/api/v1/products', ['name' => 'X', 'sku' => 'S1'], $b)->assertCreated(); // SKU unique per business only
        $this->postJson('/api/v1/inventory/adjust', ['product_id' => $pid, 'quantity' => 5], $b)->assertStatus(422);
    }
}
