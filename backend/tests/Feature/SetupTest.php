<?php

namespace Tests\Feature;

use App\Models\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SetupTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_from_env_and_permissions_are_created_on_first_login(): void
    {
        // No db:seed has run (like a host that only runs migrations).
        config(['bos.owner.email' => 'boss@example.com', 'bos.owner.password' => 'env-pass-123', 'bos.owner.name' => 'Boss']);
        $this->assertSame(0, Permission::count());

        $res = $this->postJson('/api/v1/auth/login', ['email' => 'boss@example.com', 'password' => 'env-pass-123'])->assertOk();
        $this->assertNotNull($res->json('data.token'));
        $this->assertGreaterThan(100, Permission::count());

        $h = ['Authorization' => 'Bearer ' . $res->json('data.token'), 'X-Tenant-ID' => $res->json('data.user.tenants.0.id')];
        $biz = $this->postJson('/api/v1/businesses', ['name' => 'Shop', 'business_type' => 'retail', 'country' => 'BD', 'currency' => 'BDT', 'timezone' => 'Asia/Dhaka'], $h)
            ->assertCreated();
        $this->assertContains('pos.create', $biz->json('permissions'));

        // Changing the env password later never overwrites the existing account.
        config(['bos.owner.password' => 'other-pass-123']);
        $this->postJson('/api/v1/auth/login', ['email' => 'boss@example.com', 'password' => 'other-pass-123'])->assertStatus(422);
    }

    public function test_signup_without_email_verification(): void
    {
        config(['bos.require_email_verification' => false]);

        $res = $this->postJson('/api/v1/auth/register', [
            'name' => 'Quick User', 'email' => 'quick@example.com',
            'password' => 'quick-pass-1', 'password_confirmation' => 'quick-pass-1',
        ])->assertCreated();

        $this->assertNotNull($res->json('data.token'));
        $this->assertFalse($res->json('data.requires_otp'));
        $this->getJson('/api/v1/auth/me', ['Authorization' => 'Bearer ' . $res->json('data.token')])->assertOk();
    }

    public function test_setup_command(): void
    {
        config(['bos.owner.email' => 'cli@example.com', 'bos.owner.password' => 'cli-pass-123']);
        $this->artisan('bos:setup')->expectsOutputToContain('Owner created: cli@example.com')->assertSuccessful();
        $this->artisan('bos:setup')->expectsOutputToContain('nothing to create')->assertSuccessful();
    }
}
