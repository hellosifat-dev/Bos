<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Totp;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class Phase1FlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    private function registerAndLogin(string $email = 'owner@example.com'): array
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Jane Owner', 'email' => $email,
            'password' => 'secret-pass-1', 'password_confirmation' => 'secret-pass-1',
        ])->assertCreated()->assertJsonPath('data.user.name', 'Jane Owner');

        $user = User::where('email', $email)->first();
        $code = $user->otps()->where('type', 'email_verification')->latest('id')->value('otp');

        $res = $this->postJson('/api/v1/auth/verify-otp', [
            'email' => $email, 'code' => $code, 'type' => 'email_verification',
        ])->assertOk();

        return [$user->fresh(), $res->json('data.token'), $res->json('data.user.tenants.0.id')];
    }

    private function h(string $token, $tenant, $business = null): array
    {
        return array_filter([
            'Authorization' => "Bearer {$token}",
            'X-Tenant-ID'   => $tenant,
            'X-Business-ID' => $business,
        ]);
    }

    public function test_full_phase_one_flow(): void
    {
        [$user, $token, $tenantId] = $this->registerAndLogin();
        $this->assertNotNull($token);
        $this->assertNotNull($tenantId);

        // unverified login is gated, wrong password rejected
        $this->postJson('/api/v1/auth/login', ['email' => 'owner@example.com', 'password' => 'bad-password'])->assertStatus(422);
        $this->postJson('/api/v1/auth/login', ['email' => 'owner@example.com', 'password' => 'secret-pass-1'])
            ->assertOk()->assertJsonPath('data.token', fn ($t) => is_string($t));

        $this->getJson('/api/v1/auth/me', $this->h($token, $tenantId))->assertOk()
            ->assertJsonPath('data.email', 'owner@example.com');

        // create business -> HQ branch + owner permissions
        $res = $this->postJson('/api/v1/businesses', [
            'name' => 'Acme Retail', 'business_type' => 'retail', 'email' => 'hello@acme.test',
            'country' => 'US', 'currency' => 'USD', 'timezone' => 'UTC',
            'address' => ['line1' => '1 Main St', 'city' => 'Austin', 'state' => 'TX'],
        ], $this->h($token, $tenantId))->assertCreated();
        $businessId = $res->json('data.id');
        $this->assertContains('branches.create', $res->json('permissions'));

        $h = $this->h($token, $tenantId, $businessId);

        $this->getJson('/api/v1/businesses', $this->h($token, $tenantId))->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/v1/businesses/{$businessId}/switch", [], $this->h($token, $tenantId))
            ->assertOk()->assertJsonPath('data.business.name', 'Acme Retail');

        // branches
        $this->getJson('/api/v1/branches', $h)->assertOk()->assertJsonCount(1, 'data');
        $b = $this->postJson('/api/v1/branches', [
            'name' => 'Downtown', 'code' => 'DT', 'address' => ['line1' => '2 Elm', 'city' => 'Austin'],
        ], $h)->assertCreated();
        $this->putJson('/api/v1/branches/' . $b->json('data.id'), ['name' => 'Downtown 2'], $h)
            ->assertOk()->assertJsonPath('data.name', 'Downtown 2');
        $this->getJson('/api/v1/branches/' . $b->json('data.id'), $h)->assertOk();
        $this->deleteJson('/api/v1/branches/' . $b->json('data.id'), [], $h)->assertOk();

        // roles & permissions
        $perms = $this->getJson('/api/v1/permissions', $h)->assertOk();
        $this->assertNotEmpty($perms->json('data.branches'));
        $viewBranches = collect($perms->json('data.branches'))->firstWhere('slug', 'branches.view')['id'];

        $roles = $this->getJson('/api/v1/roles', $h)->assertOk();
        $this->assertGreaterThanOrEqual(11, count($roles->json('data')));

        $role = $this->postJson('/api/v1/roles', [
            'name' => 'Branch Viewer', 'permission_ids' => [$viewBranches],
        ], $h)->assertCreated()->assertJsonPath('data.slug', 'branch_viewer');
        $roleId = $role->json('data.id');
        $this->putJson("/api/v1/roles/{$roleId}", ['name' => 'Branch Viewers'], $h)->assertOk();
        $this->postJson("/api/v1/roles/{$roleId}/permissions", ['permission_ids' => [$viewBranches]], $h)->assertOk();

        // users: create a limited user, verify RBAC enforcement
        $u = $this->postJson('/api/v1/users', [
            'name' => 'Bob Staff', 'email' => 'bob@example.com', 'password' => 'bob-pass-1234', 'role_id' => $roleId,
        ], $h)->assertCreated()->assertJsonPath('data.name', 'Bob Staff');
        $this->getJson('/api/v1/users?search=bob', $h)->assertOk()->assertJsonCount(1, 'data');
        $this->putJson('/api/v1/users/' . $u->json('data.id'), ['name' => 'Bob S', 'status' => 'active'], $h)->assertOk();

        $bobToken = $this->postJson('/api/v1/auth/login', ['email' => 'bob@example.com', 'password' => 'bob-pass-1234'])
            ->assertOk()->json('data.token');
        $this->assertNotNull($bobToken);
        $bh = $this->h($bobToken, $tenantId, $businessId);
        $this->getJson('/api/v1/branches', $bh)->assertOk();
        $this->postJson('/api/v1/branches', ['name' => 'X', 'code' => 'X'], $bh)->assertForbidden();
        $this->getJson('/api/v1/users', $bh)->assertForbidden();

        // audit log
        $logs = $this->getJson('/api/v1/audit-logs', $h)->assertOk();
        $this->assertGreaterThan(0, count($logs->json('data')));

        $this->getJson('/api/v1/dashboard/stats', $h)->assertOk()->assertJsonPath('data.branches', 1);

        // role delete blocked while assigned, allowed after revoke
        $this->deleteJson("/api/v1/roles/{$roleId}", [], $h)->assertStatus(422);
        $this->deleteJson('/api/v1/users/' . $u->json('data.id') . '/roles', ['role_id' => $roleId], $h)->assertOk();
        $this->deleteJson("/api/v1/roles/{$roleId}", [], $h)->assertOk();

        // tenant isolation: another tenant cannot use these headers
        [, $otherToken, $otherTenant] = $this->registerAndLogin('other@example.com');
        $this->getJson('/api/v1/branches', $this->h($otherToken, $tenantId, $businessId))->assertForbidden();
        $this->getJson('/api/v1/branches', $this->h($otherToken, $otherTenant, $businessId))->assertNotFound();

        // refresh + logout
        $new = $this->postJson('/api/v1/auth/refresh', [], $this->h($token, $tenantId))->assertOk()->json('data.token');
        $this->assertNotNull($new);
        $this->postJson('/api/v1/auth/logout', [], ['Authorization' => "Bearer {$new}"])->assertOk();
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->getJson('/api/v1/businesses')->assertUnauthorized();
    }

    public function test_password_reset_flow(): void
    {
        $this->registerAndLogin();
        $user = User::where('email', 'owner@example.com')->first();
        $token = Password::createToken($user);

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token, 'email' => 'owner@example.com',
            'password' => 'brand-new-pass', 'password_confirmation' => 'brand-new-pass',
        ])->assertOk();

        $this->postJson('/api/v1/auth/login', ['email' => 'owner@example.com', 'password' => 'brand-new-pass'])->assertOk();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk();
    }

    public function test_two_factor_flow(): void
    {
        [$user, $token, $tenantId] = $this->registerAndLogin();
        $h = ['Authorization' => "Bearer {$token}"];

        $setup = $this->postJson('/api/v1/auth/2fa/enable', [], $h)->assertOk();
        $secret = $setup->json('data.secret');
        $this->postJson('/api/v1/auth/2fa/verify', ['code' => '000000'], $h)->assertStatus(422);
        $this->postJson('/api/v1/auth/2fa/verify', ['code' => Totp::at($secret, (int) floor(time() / 30))], $h)->assertOk();

        $login = $this->postJson('/api/v1/auth/login', ['email' => 'owner@example.com', 'password' => 'secret-pass-1'])
            ->assertOk()->assertJsonPath('data.requires_2fa', true);
        $pending = $login->json('data.token');

        // a pending token cannot reach normal endpoints
        $this->getJson('/api/v1/auth/me', ['Authorization' => "Bearer {$pending}"])->assertForbidden();

        $done = $this->postJson('/api/v1/auth/2fa/verify', ['code' => Totp::at($secret, (int) floor(time() / 30))], ['Authorization' => "Bearer {$pending}"])
            ->assertOk();
        $this->getJson('/api/v1/auth/me', ['Authorization' => 'Bearer ' . $done->json('data.token')])->assertOk();
    }
}
