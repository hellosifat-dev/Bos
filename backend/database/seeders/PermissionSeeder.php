<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            'businesses' => ['view', 'create', 'edit', 'delete'],
            'branches'   => ['view', 'create', 'edit', 'delete'],
            'users'      => ['view', 'create', 'edit', 'delete'],
            'roles'      => ['view', 'create', 'edit', 'delete'],
            'products'   => ['view', 'create', 'edit', 'delete', 'import', 'export', 'print'],
            'categories' => ['view', 'create', 'edit', 'delete'],
            'brands'     => ['view', 'create', 'edit', 'delete'],
            'inventory'  => ['view', 'create', 'edit', 'adjust', 'transfer', 'export'],
            'warehouses' => ['view', 'create', 'edit', 'delete', 'manage'],
            'suppliers'  => ['view', 'create', 'edit', 'delete', 'export'],
            'purchasing' => ['view', 'create', 'edit', 'approve', 'reject', 'cancel', 'receive', 'export', 'print'],
            'customers'  => ['view', 'create', 'edit', 'delete', 'export'],
            'orders'     => ['view', 'create', 'edit', 'cancel', 'refund', 'approve', 'export', 'print'],
            'sales'      => ['view', 'create', 'edit', 'cancel', 'refund', 'export', 'print'],
            'pos'        => ['view', 'create', 'edit', 'refund', 'manage'],
            'payments'   => ['view', 'create', 'refund', 'export'],
            'delivery'   => ['view', 'create', 'edit', 'manage', 'export'],
            'returns'    => ['view', 'create', 'edit', 'approve', 'reject', 'export'],
            'employees'  => ['view', 'create', 'edit', 'delete', 'export', 'import'],
            'attendance' => ['view', 'create', 'edit', 'approve', 'export'],
            'shifts'     => ['view', 'create', 'edit', 'delete', 'manage'],
            'leave'      => ['view', 'create', 'edit', 'approve', 'reject', 'export'],
            'salary'     => ['view', 'create', 'edit', 'manage'],
            'payroll'    => ['view', 'create', 'edit', 'approve', 'export', 'print'],
            'commission' => ['view', 'create', 'edit', 'manage'],
            'expenses'   => ['view', 'create', 'edit', 'approve', 'reject', 'export', 'print'],
            'accounting' => ['view', 'create', 'edit', 'approve', 'export'],
            'reports'    => ['view', 'export', 'print'],
            'analytics'  => ['view'],
            'website'    => ['view', 'create', 'edit', 'delete', 'publish', 'manage'],
            'cms'        => ['view', 'create', 'edit', 'delete', 'publish'],
            'marketing'  => ['view', 'create', 'edit', 'delete', 'manage'],
            'loyalty'    => ['view', 'create', 'edit', 'manage'],
            'crm'        => ['view', 'create', 'edit', 'manage', 'export'],
            'support'    => ['view', 'create', 'edit', 'manage'],
            'users'      => ['view', 'create', 'edit', 'delete', 'manage'],
            'roles'      => ['view', 'create', 'edit', 'delete', 'manage'],
            'branches'   => ['view', 'create', 'edit', 'delete', 'manage'],
            'settings'   => ['view', 'edit', 'manage'],
            'audit_logs' => ['view', 'export'],
            'integrations' => ['view', 'manage'],
            'webhooks'   => ['view', 'create', 'edit', 'delete', 'manage'],
        ];

        $permissions = [];
        foreach ($modules as $module => $actions) {
            foreach ($actions as $action) {
                $slug = "{$module}.{$action}";
                $permissions[] = [
                    'name'        => ucfirst($action) . ' ' . ucwords(str_replace('_', ' ', $module)),
                    'slug'        => $slug,
                    'module'      => $module,
                    'action'      => $action,
                    'description' => "Can {$action} {$module}",
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ];
            }
        }

        // Upsert to avoid duplicates
        foreach (array_chunk($permissions, 50) as $chunk) {
            Permission::upsert($chunk, ['slug'], ['name', 'description', 'updated_at']);
        }

        $this->command->info('Permissions seeded: ' . count($permissions) . ' permissions across ' . count($modules) . ' modules.');
    }
}
