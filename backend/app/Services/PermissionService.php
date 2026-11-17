<?php

namespace App\Services;

use App\Models\Business;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Collection;

class PermissionService
{
    private array $permissionCache = [];

    public function getUserPermissions(User $user, int $businessId): Collection
    {
        $cacheKey = "user_{$user->id}_business_{$businessId}";

        if (isset($this->permissionCache[$cacheKey])) {
            return $this->permissionCache[$cacheKey];
        }

        if ($user->is_super_admin) {
            $permissions = Permission::all()->pluck('slug');
            $this->permissionCache[$cacheKey] = $permissions;
            return $permissions;
        }

        if ($this->isBusinessOwner($user, $businessId)) {
            $permissions = Permission::pluck('slug');
            $this->permissionCache[$cacheKey] = $permissions;
            return $permissions;
        }

        $permissions = $user->userRoles()
            ->where('business_id', $businessId)
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->with('role.permissions')
            ->get()
            ->flatMap(fn ($ur) => $ur->role ? $ur->role->permissions->pluck('slug') : collect())
            ->unique()
            ->values();

        $this->permissionCache[$cacheKey] = $permissions;
        return $permissions;
    }

    private function isBusinessOwner(User $user, int $businessId): bool
    {
        $business = Business::find($businessId);
        if (!$business) {
            return false;
        }

        return $business->owner_id === $user->id
            || $user->tenants()->where('tenants.id', $business->tenant_id)->wherePivot('role', 'owner')->exists();
    }

    public function userCan(User $user, string $permission, int $businessId): bool
    {
        if ($user->is_super_admin) {
            return true;
        }

        return $this->getUserPermissions($user, $businessId)->contains($permission);
    }

    public function userCanAny(User $user, array $permissions, int $businessId): bool
    {
        foreach ($permissions as $permission) {
            if ($this->userCan($user, $permission, $businessId)) {
                return true;
            }
        }
        return false;
    }

    public function userCanAll(User $user, array $permissions, int $businessId): bool
    {
        foreach ($permissions as $permission) {
            if (!$this->userCan($user, $permission, $businessId)) {
                return false;
            }
        }
        return true;
    }

    public function assignRoleToUser(
        User $user,
        Role $role,
        int $businessId,
        ?int $branchId = null,
        ?int $assignedBy = null
    ): void {
        $user->userRoles()->updateOrCreate(
            [
                'role_id' => $role->id,
                'business_id' => $businessId,
                'branch_id' => $branchId,
            ],
            [
                'tenant_id' => $role->tenant_id,
                'assigned_at' => now(),
                'assigned_by' => $assignedBy,
            ]
        );

        unset($this->permissionCache["user_{$user->id}_business_{$businessId}"]);
    }

    public function removeRoleFromUser(User $user, Role $role, int $businessId): void
    {
        $user->userRoles()
            ->where('role_id', $role->id)
            ->where('business_id', $businessId)
            ->delete();

        unset($this->permissionCache["user_{$user->id}_business_{$businessId}"]);
    }

    public function updateRolePermissions(Role $role, array $permissionIds): Role
    {
        $role->permissions()->sync($permissionIds);

        // Clear all user caches for this role
        $this->permissionCache = [];

        return $role->load('permissions');
    }

    public function getPermissionsGrouped(): array
    {
        return Permission::orderBy('group')->orderBy('sort_order')
            ->get()
            ->groupBy('module')
            ->map(fn ($perms) => $perms->groupBy('action'))
            ->toArray();
    }

    public function getPermissionMatrix(): array
    {
        $modules = Permission::select('module')->distinct()->pluck('module');
        $actions = Permission::select('action')->distinct()->pluck('action');
        $permissions = Permission::all()->keyBy(fn ($p) => "{$p->module}.{$p->action}");

        $matrix = [];
        foreach ($modules as $module) {
            $row = ['module' => $module, 'actions' => []];
            foreach ($actions as $action) {
                $key = "{$module}.{$action}";
                $row['actions'][$action] = $permissions->has($key) ? $permissions[$key]->id : null;
            }
            $matrix[] = $row;
        }

        return $matrix;
    }
}
