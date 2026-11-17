<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\BusinessController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

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

            // Audit Logs
            Route::get('audit-logs', [AuditLogController::class, 'index'])->middleware('permission:view,audit_logs');
        });
    });
});
