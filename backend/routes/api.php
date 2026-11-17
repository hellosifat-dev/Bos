<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\BusinessController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\BrandController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DepartmentController;
use App\Http\Controllers\Api\V1\DesignationController;
use App\Http\Controllers\Api\V1\EmployeeController;
use App\Http\Controllers\Api\V1\LeaveController;
use App\Http\Controllers\Api\V1\PayrollController;
use App\Http\Controllers\Api\V1\InventoryController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PosController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\WarehouseController;
use Illuminate\Support\Facades\Route;

/** Register permission-guarded CRUD routes for a business-scoped resource. */
if (!function_exists('crud')) {
    function crud(string $uri, string $controller, string $module): void
    {
        Route::get($uri, [$controller, 'index'])->middleware("permission:view,{$module}");
        Route::post($uri, [$controller, 'store'])->middleware("permission:create,{$module}");
        Route::get("{$uri}/{id}", [$controller, 'show'])->middleware("permission:view,{$module}");
        Route::put("{$uri}/{id}", [$controller, 'update'])->middleware("permission:edit,{$module}");
        Route::delete("{$uri}/{id}", [$controller, 'destroy'])->middleware("permission:delete,{$module}");
    }
}

/*
|--------------------------------------------------------------------------
| API Routes — Business Operating System v1
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function () {

    // ── PUBLIC AUTH ─────────────────────────────────────────────────────
    Route::prefix('auth')->group(function () {
        Route::post('/register',        [AuthController::class, 'register']);
        Route::post('/login',           [AuthController::class, 'login']);
        Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('/reset-password',  [AuthController::class, 'resetPassword']);
        Route::post('/send-otp',        [AuthController::class, 'sendOtp']);
        Route::post('/verify-otp',      [AuthController::class, 'verifyOtp']);
    });

    // ── 2FA CHALLENGE (accepts the limited "2fa-pending" token or a full one) ──
    Route::middleware('auth:sanctum')->post('/auth/2fa/verify', [AuthController::class, 'verify2FA']);

    // ── AUTHENTICATED (full-access tokens only) ──────────────────────────
    Route::middleware(['auth:sanctum', 'abilities:*'])->group(function () {

        Route::prefix('auth')->group(function () {
            Route::post('/logout',          [AuthController::class, 'logout']);
            Route::post('/refresh',         [AuthController::class, 'refresh']);
            Route::post('/2fa/enable',      [AuthController::class, 'enable2FA']);
            Route::post('/2fa/disable',     [AuthController::class, 'disable2FA']);
            Route::get('/sessions',         [AuthController::class, 'sessions']);
            Route::delete('/sessions/{id}', [AuthController::class, 'revokeSession']);
            Route::get('/me',               [AuthController::class, 'me']);
        });

        // Businesses (tenant-scoped via header)
        Route::middleware('tenant')->prefix('businesses')->group(function () {
            Route::get('/',                          [BusinessController::class, 'index']);
            Route::post('/',                         [BusinessController::class, 'store']);
            Route::get('/{business}',                [BusinessController::class, 'show']);
            Route::put('/{business}',                [BusinessController::class, 'update']);
            Route::delete('/{business}',             [BusinessController::class, 'destroy']);
            Route::get('/{business}/setup-progress', [BusinessController::class, 'setupProgress']);
            Route::post('/{business}/switch',        [BusinessController::class, 'switch']);
            Route::post('/{business}/setup/{step}',  [BusinessController::class, 'updateSetupStep']);
        });

        // Business-scoped routes (require both Tenant + Business headers)
        Route::middleware(['tenant', 'business'])->group(function () {

            Route::get('dashboard/stats', [DashboardController::class, 'stats']);

            // Branches
            Route::get('branches',          [BranchController::class, 'index'])->middleware('permission:view,branches');
            Route::post('branches',         [BranchController::class, 'store'])->middleware('permission:create,branches');
            Route::get('branches/{id}',     [BranchController::class, 'show'])->middleware('permission:view,branches');
            Route::put('branches/{id}',     [BranchController::class, 'update'])->middleware('permission:edit,branches');
            Route::delete('branches/{id}',  [BranchController::class, 'destroy'])->middleware('permission:delete,branches');

            // Users
            Route::get('users',               [UserController::class, 'index'])->middleware('permission:view,users');
            Route::post('users',              [UserController::class, 'store'])->middleware('permission:create,users');
            Route::get('users/{id}',          [UserController::class, 'show'])->middleware('permission:view,users');
            Route::put('users/{id}',          [UserController::class, 'update'])->middleware('permission:edit,users');
            Route::delete('users/{id}',       [UserController::class, 'destroy'])->middleware('permission:delete,users');
            Route::post('users/{id}/roles',   [UserController::class, 'assignRole'])->middleware('permission:edit,users');
            Route::delete('users/{id}/roles', [UserController::class, 'revokeRole'])->middleware('permission:edit,users');

            // Roles
            Route::get('roles',                   [RoleController::class, 'index'])->middleware('permission:view,roles');
            Route::post('roles',                  [RoleController::class, 'store'])->middleware('permission:create,roles');
            Route::get('roles/{id}',              [RoleController::class, 'show'])->middleware('permission:view,roles');
            Route::put('roles/{id}',              [RoleController::class, 'update'])->middleware('permission:edit,roles');
            Route::delete('roles/{id}',           [RoleController::class, 'destroy'])->middleware('permission:delete,roles');
            Route::post('roles/{id}/permissions', [RoleController::class, 'syncPermissions'])->middleware('permission:edit,roles');

            // Permissions (read-only)
            Route::get('permissions', [PermissionController::class, 'index'])->middleware('permission:view,roles');

            // ── Phase 2: Products & Inventory ───────────────────────────
            crud('categories', CategoryController::class, 'categories');
            crud('brands', BrandController::class, 'brands');
            crud('units', UnitController::class, 'products');
            crud('products', ProductController::class, 'products');
            crud('warehouses', WarehouseController::class, 'warehouses');

            Route::get('inventory',               [InventoryController::class, 'index'])->middleware('permission:view,inventory');
            Route::get('inventory/movements',     [InventoryController::class, 'movements'])->middleware('permission:view,inventory');
            Route::get('inventory/products/{id}', [InventoryController::class, 'product'])->middleware('permission:view,inventory');
            Route::post('inventory/adjust',       [InventoryController::class, 'adjust'])->middleware('permission:adjust,inventory');
            Route::post('inventory/transfer',     [InventoryController::class, 'transfer'])->middleware('permission:transfer,inventory');

            // ── Phase 3: Sales & POS ────────────────────────────────────
            crud('customers', CustomerController::class, 'customers');

            Route::get('orders',                  [OrderController::class, 'index'])->middleware('permission:view,orders');
            Route::post('orders',                 [OrderController::class, 'store'])->middleware('permission:create,orders');
            Route::get('orders/{id}',             [OrderController::class, 'show'])->middleware('permission:view,orders');
            Route::put('orders/{id}',             [OrderController::class, 'update'])->middleware('permission:edit,orders');
            Route::post('orders/{id}/complete',   [OrderController::class, 'complete'])->middleware('permission:edit,orders');
            Route::post('orders/{id}/cancel',     [OrderController::class, 'cancel'])->middleware('permission:cancel,orders');
            Route::post('orders/{id}/payments',   [OrderController::class, 'addPayment'])->middleware('permission:create,payments');
            Route::post('orders/{id}/return',     [OrderController::class, 'returnItems'])->middleware('permission:refund,orders');

            Route::get('pos/products',  [PosController::class, 'products'])->middleware('permission:view,pos');
            Route::post('pos/checkout', [PosController::class, 'checkout'])->middleware('permission:create,pos');

            // ── Phase 4: HR & Payroll ───────────────────────────────────
            crud('departments', DepartmentController::class, 'employees');
            crud('designations', DesignationController::class, 'employees');
            crud('employees', EmployeeController::class, 'employees');

            Route::get('attendance',          [AttendanceController::class, 'sheet'])->middleware('permission:view,attendance');
            Route::get('attendance/summary',  [AttendanceController::class, 'summary'])->middleware('permission:view,attendance');
            Route::post('attendance',         [AttendanceController::class, 'save'])->middleware('permission:create,attendance');

            Route::get('leave-requests',               [LeaveController::class, 'index'])->middleware('permission:view,leave');
            Route::post('leave-requests',              [LeaveController::class, 'store'])->middleware('permission:create,leave');
            Route::post('leave-requests/{id}/approve', [LeaveController::class, 'approve'])->middleware('permission:approve,leave');
            Route::post('leave-requests/{id}/reject',  [LeaveController::class, 'reject'])->middleware('permission:reject,leave');
            Route::delete('leave-requests/{id}',       [LeaveController::class, 'destroy'])->middleware('permission:create,leave');

            Route::get('payroll',                          [PayrollController::class, 'index'])->middleware('permission:view,payroll');
            Route::post('payroll',                         [PayrollController::class, 'store'])->middleware('permission:create,payroll');
            Route::get('payroll/{id}',                     [PayrollController::class, 'show'])->middleware('permission:view,payroll');
            Route::put('payroll/{id}/payslips/{slipId}',   [PayrollController::class, 'updatePayslip'])->middleware('permission:edit,payroll');
            Route::post('payroll/{id}/approve',            [PayrollController::class, 'approve'])->middleware('permission:approve,payroll');
            Route::post('payroll/{id}/pay',                [PayrollController::class, 'pay'])->middleware('permission:approve,payroll');
            Route::delete('payroll/{id}',                  [PayrollController::class, 'destroy'])->middleware('permission:create,payroll');

            // Audit Logs
            Route::get('audit-logs', [AuditLogController::class, 'index'])->middleware('permission:view,audit_logs');
        });
    });
});
