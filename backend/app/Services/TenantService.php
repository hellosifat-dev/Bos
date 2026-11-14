<?php

namespace App\Services;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TenantService
{
    public function __construct(
        private AuditService $auditService
    ) {}

    public function create(array $data, User $owner): Tenant
    {
        $slug = $this->generateSlug($data['name']);

        $tenant = Tenant::create([
            'name' => $data['name'],
            'slug' => $slug,
            'subdomain' => $data['subdomain'] ?? $slug,
            'status' => 'trial',
            'plan' => 'free',
            'trial_ends_at' => now()->addDays(14),
            'max_businesses' => 1,
            'max_branches_per_business' => 3,
            'max_users' => 10,
            'timezone' => $data['timezone'] ?? 'UTC',
            'currency' => $data['currency'] ?? 'USD',
            'owner_id' => $owner->id,
            'settings' => $data['settings'] ?? null,
        ]);

        // Attach owner as tenant admin
        $tenant->users()->attach($owner->id, [
            'role' => 'owner',
            'is_primary' => true,
            'status' => 'active',
            'joined_at' => now(),
        ]);

        $this->auditService->log(
            event: 'tenant.created',
            description: "Tenant created: {$tenant->name}",
            user: $owner
        );

        return $tenant;
    }

    public function update(Tenant $tenant, array $data): Tenant
    {
        if (isset($data['name']) && $data['name'] !== $tenant->name) {
            $data['slug'] = $this->generateSlug($data['name'], $tenant->id);
        }

        $tenant->update($data);

        $this->auditService->log(
            event: 'tenant.updated',
            description: "Tenant updated: {$tenant->name}",
            auditable: $tenant
        );

        return $tenant;
    }

    public function inviteUser(Tenant $tenant, string $email, string $role = 'member'): void
    {
        $user = User::where('email', $email)->first();

        if (!$user) {
            throw ValidationException::withMessages([
                'email' => ['User with this email does not exist.'],
            ]);
        }

        if ($tenant->users()->where('user_id', $user->id)->exists()) {
            throw ValidationException::withMessages([
                'email' => ['User is already a member of this tenant.'],
            ]);
        }

        $tenant->users()->attach($user->id, [
            'role' => $role,
            'is_primary' => false,
            'status' => 'invited',
        ]);
    }

    public function removeUser(Tenant $tenant, int $userId): void
    {
        $pivot = $tenant->users()->wherePivot('user_id', $userId)->first();

        if ($pivot && $pivot->pivot->role === 'owner') {
            throw ValidationException::withMessages([
                'user' => ['Cannot remove the tenant owner.'],
            ]);
        }

        $tenant->users()->detach($userId);
    }

    public function upgradePlan(Tenant $tenant, string $plan): Tenant
    {
        $limits = match ($plan) {
            'starter' => ['max_businesses' => 3, 'max_branches_per_business' => 5, 'max_users' => 25],
            'professional' => ['max_businesses' => 10, 'max_branches_per_business' => 15, 'max_users' => 100],
            'enterprise' => ['max_businesses' => -1, 'max_branches_per_business' => -1, 'max_users' => -1],
            default => ['max_businesses' => 1, 'max_branches_per_business' => 3, 'max_users' => 10],
        };

        $tenant->update([
            'plan' => $plan,
            'status' => 'active',
            'subscription_ends_at' => now()->addYear(),
            ...$limits,
        ]);

        return $tenant;
    }

    private function generateSlug(string $name, ?int $excludeId = null): string
    {
        $slug = Str::slug($name);
        $original = $slug;
        $count = 1;

        while (Tenant::where('slug', $slug)->when($excludeId, fn ($q) => $q->where('id', '!=', $excludeId))->exists()) {
            $slug = "{$original}-{$count}";
            $count++;
        }

        return $slug;
    }
}
