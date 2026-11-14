<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $systemRoles = [
            [
                'name'        => 'Super Administrator',
                'slug'        => 'super_admin',
                'description' => 'Platform-level super administrator with full access.',
                'scope'       => 'global',
                'is_system'   => true,
                'permissions' => '*', // all
            ],
            [
                'name'        => 'Business Owner',
                'slug'        => 'business_owner',
                'description' => 'Owner of the business with full access to their business.',
                'scope'       => 'business',
                'is_system'   => true,
                'permissions' => '*',
            ],
            [
                'name'        => 'Business Administrator',
                'slug'        => 'business_admin',
                'description' => 'Administrator of the business.',
                'scope'       => 'business',
                'is_system'   => true,
                'permissions' => '*',
            ],
            [
                'name'        => 'Branch Manager',
                'slug'        => 'branch_manager',
                'description' => 'Manages a specific branch.',
                'scope'       => 'branch',
                'is_system'   => true,
                'permissions' => [
                    'products.view', 'products.edit', 'products.export',
                    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.adjust',
                    'orders.view', 'orders.create', 'orders.edit', 'orders.cancel', 'orders.export',
                    'sales.view', 'sales.create', 'sales.edit', 'sales.export',
                    'customers.view', 'customers.create', 'customers.edit', 'customers.export',
                    'employees.view', 'attendance.view', 'attendance.create', 'attendance.edit',
                    'leave.view', 'leave.approve', 'leave.reject',
                    'reports.view', 'reports.export',
                    'expenses.view', 'expenses.create', 'expenses.approve',
                ],
            ],
            [
                'name'        => 'Sales Manager',
                'slug'        => 'sales_manager',
                'description' => 'Manages sales operations.',
                'scope'       => 'branch',
                'is_system'   => true,
                'permissions' => [
                    'products.view', 'products.export',
                    'orders.view', 'orders.create', 'orders.edit', 'orders.cancel', 'orders.export',
                    'sales.view', 'sales.create', 'sales.edit', 'sales.export',
                    'customers.view', 'customers.create', 'customers.edit',
                    'payments.view', 'payments.create',
                    'reports.view', 'reports.export',
                ],
            ],
            [
                'name'        => 'Sales Staff',
                'slug'        => 'sales_staff',
                'description' => 'Regular sales staff.',
                'scope'       => 'branch',
                'is_system'   => true,
                'permissions' => [
                    'products.view',
                    'orders.view', 'orders.create', 'orders.edit',
                    'sales.view', 'sales.create',
                    'customers.view', 'customers.create',
                    'payments.view', 'payments.create',
                ],
            ],
            [
                'name'        => 'Cashier',
                'slug'        => 'cashier',
                'description' => 'POS cashier.',
                'scope'       => 'branch',
                'is_system'   => true,
                'permissions' => [
                    'products.view',
                    'pos.view', 'pos.create', 'pos.refund',
                    'customers.view',
                    'payments.view', 'payments.create',
                ],
            ],
            [
                'name'        => 'Inventory Manager',
                'slug'        => 'inventory_manager',
                'description' => 'Manages inventory and stock.',
                'scope'       => 'business',
                'is_system'   => true,
                'permissions' => [
                    'products.view', 'products.create', 'products.edit', 'products.import', 'products.export',
                    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.adjust', 'inventory.transfer', 'inventory.export',
                    'warehouses.view', 'warehouses.manage',
                    'suppliers.view', 'suppliers.create', 'suppliers.edit',
                    'purchasing.view', 'purchasing.create', 'purchasing.edit', 'purchasing.receive', 'purchasing.export',
                    'reports.view', 'reports.export',
                ],
            ],
            [
                'name'        => 'HR Manager',
                'slug'        => 'hr_manager',
                'description' => 'Manages human resources.',
                'scope'       => 'business',
                'is_system'   => true,
                'permissions' => [
                    'employees.view', 'employees.create', 'employees.edit', 'employees.export',
                    'attendance.view', 'attendance.create', 'attendance.edit', 'attendance.approve', 'attendance.export',
                    'shifts.view', 'shifts.create', 'shifts.edit', 'shifts.manage',
                    'leave.view', 'leave.create', 'leave.edit', 'leave.approve', 'leave.reject', 'leave.export',
                    'salary.view', 'salary.create', 'salary.edit', 'salary.manage',
                    'payroll.view', 'payroll.create', 'payroll.edit', 'payroll.approve', 'payroll.export',
                    'commission.view', 'commission.create', 'commission.manage',
                    'reports.view', 'reports.export',
                ],
            ],
            [
                'name'        => 'Accountant',
                'slug'        => 'accountant',
                'description' => 'Manages financial records.',
                'scope'       => 'business',
                'is_system'   => true,
                'permissions' => [
                    'accounting.view', 'accounting.create', 'accounting.edit', 'accounting.export',
                    'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.approve', 'expenses.export',
                    'payments.view', 'payments.export',
                    'payroll.view', 'payroll.approve', 'payroll.export',
                    'reports.view', 'reports.export', 'reports.print',
                    'analytics.view',
                ],
            ],
            [
                'name'        => 'Employee',
                'slug'        => 'employee',
                'description' => 'Regular employee.',
                'scope'       => 'own',
                'is_system'   => true,
                'permissions' => [
                    'attendance.view', 'attendance.create',
                    'leave.view', 'leave.create',
                ],
            ],
        ];

        $allPermissions = Permission::pluck('id', 'slug')->toArray();

        foreach ($systemRoles as $roleData) {
            $permSlugs = $roleData['permissions'];
            unset($roleData['permissions']);

            $role = Role::updateOrCreate(
                ['slug' => $roleData['slug'], 'is_system' => true],
                array_merge($roleData, ['business_id' => null, 'tenant_id' => null])
            );

            if ($permSlugs === '*') {
                $role->permissions()->sync(array_values($allPermissions));
            } else {
                $ids = collect($permSlugs)
                    ->map(fn($s) => $allPermissions[$s] ?? null)
                    ->filter()
                    ->values()
                    ->toArray();
                $role->permissions()->sync($ids);
            }
        }

        $this->command->info('System roles seeded: ' . count($systemRoles));
    }
}
