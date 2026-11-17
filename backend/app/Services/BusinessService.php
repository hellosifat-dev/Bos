<?php

namespace App\Services;

use App\Models\Business;
use App\Models\Branch;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class BusinessService
{
    public function __construct(
        private AuditService $auditService,
        private PermissionService $permissions,
    ) {}

    public function create(array $data, Tenant $tenant, User $owner): Business
    {
        $this->checkBusinessLimit($tenant);

        $slug = $this->generateSlug($data['name'], $tenant->id);

        $setupSteps = $this->getDefaultSetupSteps();

        $address = $data['address'] ?? null;

        $business = Business::create([
            'tenant_id' => $tenant->id,
            'name' => $data['name'],
            'slug' => $slug,
            'legal_name' => $data['legal_name'] ?? null,
            'business_type' => $data['business_type'] ?? null,
            'industry' => $data['industry'] ?? null,
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'website' => $data['website'] ?? null,
            'description' => $data['description'] ?? null,
            'address' => $address,
            'city' => $address['city'] ?? ($data['city'] ?? null),
            'state' => $address['state'] ?? ($data['state'] ?? null),
            'country' => $data['country'] ?? 'US',
            'postal_code' => $address['postal_code'] ?? ($data['postal_code'] ?? null),
            'language' => $data['language'] ?? 'en',
            'timezone' => $data['timezone'] ?? $tenant->timezone,
            'currency' => $data['currency'] ?? $tenant->currency,
            'status' => 'setup',
            'setup_progress' => 8,
            'setup_steps' => $setupSteps,
            'owner_id' => $owner->id,
            'modules_enabled' => ['dashboard', 'users', 'branches', 'roles'],
        ]);

        // Create headquarters branch
        $this->createHeadquartersBranch($business, $data);

        // The creator becomes the business owner.
        $ownerRole = Role::where('slug', 'business_owner')->where('is_system', true)->first();
        if ($ownerRole) {
            $this->permissions->assignRoleToUser($owner, $ownerRole, $business->id, null, $owner->id);
        }

        $this->auditService->log(
            event: 'business.created',
            description: "Business created: {$business->name}",
            user: $owner,
            business: $business
        );

        return $business;
    }

    public function update(Business $business, array $data): Business
    {
        if (isset($data['name']) && $data['name'] !== $business->name) {
            $data['slug'] = $this->generateSlug($data['name'], $business->tenant_id, $business->id);
        }

        $business->update($data);

        $this->markSetupStepComplete($business, 'basic_info');

        $this->auditService->log(
            event: 'business.updated',
            description: "Business updated: {$business->name}",
            business: $business
        );

        return $business;
    }

    public function delete(Business $business): void
    {
        if ($business->branches()->count() > 0) {
            $business->branches()->delete();
        }

        $business->delete();

        $this->auditService->log(
            event: 'business.deleted',
            description: "Business deleted: {$business->name}",
        );
    }

    public function markSetupStepComplete(Business $business, string $stepKey): void
    {
        $steps = $business->setup_steps ?? [];

        foreach ($steps as &$step) {
            if ($step['key'] === $stepKey) {
                $step['completed'] = true;
                $step['completed_at'] = now()->toISOString();
                break;
            }
        }

        $business->setup_steps = $steps;
        $business->save();
        $business->updateSetupProgress();

        if ($business->setup_progress >= 100) {
            $business->update(['status' => 'active', 'setup_completed_at' => now()]);
        }
    }

    public function uploadLogo(Business $business, $file): Business
    {
        $path = $file->store("businesses/{$business->id}/logos", 'public');
        $business->update(['logo' => $path]);
        $this->markSetupStepComplete($business, 'branding');
        return $business;
    }

    public function enableModule(Business $business, string $module): void
    {
        $modules = $business->modules_enabled ?? [];
        if (!in_array($module, $modules)) {
            $modules[] = $module;
            $business->update(['modules_enabled' => $modules]);
        }
    }

    public function disableModule(Business $business, string $module): void
    {
        $core = ['dashboard', 'users', 'branches', 'roles'];
        if (in_array($module, $core)) {
            throw ValidationException::withMessages([
                'module' => ["Cannot disable core module: {$module}"],
            ]);
        }
        $modules = array_diff($business->modules_enabled ?? [], [$module]);
        $business->update(['modules_enabled' => array_values($modules)]);
    }

    private function createHeadquartersBranch(Business $business, array $data): Branch
    {
        return Branch::create([
            'business_id' => $business->id,
            'tenant_id' => $business->tenant_id,
            'name' => 'Headquarters',
            'code' => 'HQ',
            'is_headquarters' => true,
            'address' => $data['address'] ?? null,
            'city' => $data['address']['city'] ?? null,
            'country' => $data['country'] ?? 'US',
            'status' => 'active',
        ]);
    }

    private function checkBusinessLimit(Tenant $tenant): void
    {
        $max = $tenant->max_businesses;
        if ($max !== -1 && $tenant->businesses()->count() >= $max) {
            throw ValidationException::withMessages([
                'tenant' => ["You have reached the maximum number of businesses ({$max}) for your plan."],
            ]);
        }
    }

    private function getDefaultSetupSteps(): array
    {
        return [
            ['key' => 'basic_info', 'label' => 'Basic Information', 'completed' => true, 'order' => 1],
            ['key' => 'branding', 'label' => 'Branding & Logo', 'completed' => false, 'order' => 2],
            ['key' => 'address', 'label' => 'Business Address', 'completed' => false, 'order' => 3],
            ['key' => 'departments', 'label' => 'Departments Setup', 'completed' => false, 'order' => 4],
            ['key' => 'roles', 'label' => 'Roles & Permissions', 'completed' => false, 'order' => 5],
            ['key' => 'users', 'label' => 'Invite Users', 'completed' => false, 'order' => 6],
            ['key' => 'branches', 'label' => 'Branch Setup', 'completed' => false, 'order' => 7],
            ['key' => 'modules', 'label' => 'Enable Modules', 'completed' => false, 'order' => 8],
            ['key' => 'billing', 'label' => 'Billing Setup', 'completed' => false, 'order' => 9],
            ['key' => 'integrations', 'label' => 'Integrations', 'completed' => false, 'order' => 10],
            ['key' => 'notifications', 'label' => 'Notification Settings', 'completed' => false, 'order' => 11],
            ['key' => 'security', 'label' => 'Security Settings', 'completed' => false, 'order' => 12],
            ['key' => 'go_live', 'label' => 'Go Live', 'completed' => false, 'order' => 13],
        ];
    }

    private function generateSlug(string $name, int $tenantId, ?int $excludeId = null): string
    {
        $slug = Str::slug($name);
        $original = $slug;
        $count = 1;

        while (
            Business::where('tenant_id', $tenantId)
                ->where('slug', $slug)
                ->when($excludeId, fn ($q) => $q->where('id', '!=', $excludeId))
                ->exists()
        ) {
            $slug = "{$original}-{$count}";
            $count++;
        }

        return $slug;
    }
}
