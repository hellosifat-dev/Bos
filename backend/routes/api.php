<?php

use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BranchController;
use App\Http\Controllers\Api\V1\BusinessController;
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
        Route::post('/verify-email',    [AuthController::class, 'verifyEmail']);
        Route::post('/send-otp',        [AuthController::class, 'sendOtp']);
        Route::post('/verify-otp',      [AuthController::class, 'verifyOtp']);
    });

    // ── AUTHENTICATED ────────────────────────────────────────────────────
    Route::middleware('auth:sanctum')->group(function () {

        // Auth management
        Route::prefix('auth')->group(function () {
            Route::post('/logout',          [AuthController::class, 'logout']);
            Route::post('/refresh',         [AuthController::class, 'refresh']);
            Route::post('/2fa/enable',      [AuthController::class, 'enable2FA']);
            Route::post('/2fa/disable',     [AuthController::class, 'disable2FA']);
            Route::post('/2fa/verify',      [AuthController::class, 'verify2FA']);
            Route::get('/sessions',         [AuthController::class, 'sessions']);
            Route::delete('/sessions/{id}', [AuthController::class, 'revokeSession']);
            Route::get('/me',               [AuthController::class, 'me']);
        });

        // Businesses (tenant-scoped via header)
        Route::middleware('tenant')->prefix('businesses')->group(function () {
            Route::get('/',                         [BusinessController::class, 'index']);
            Route::post('/',                        [BusinessController::class, 'store']);
            Route::get('/{id}',                     [BusinessController::class, 'show']);
            Route::put('/{id}',                     [BusinessController::class, 'update']);
            Route::get('/{id}/setup-progress',      [BusinessController::class, 'setupProgress']);
            Route::post('/{id}/switch',             [BusinessController::class, 'switch']);
            Route::post('/{id}/setup/{step}',       [BusinessController::class, 'updateSetupStep']);
        });

        // Business-scoped routes (require both Tenant + Business headers)
        Route::middleware(['tenant', 'business'])->group(function () {

            // Branches
            Route::apiResource('branches', BranchController::class);

            // Users
            Route::get('users',               [UserController::class, 'index']);
            Route::post('users',              [UserController::class, 'store']);
            Route::get('users/{id}',          [UserController::class, 'show']);
            Route::put('users/{id}',          [UserController::class, 'update']);
            Route::delete('users/{id}',       [UserController::class, 'destroy']);
            Route::post('users/{id}/roles',   [UserController::class, 'assignRole']);
            Route::delete('users/{id}/roles', [UserController::class, 'revokeRole']);

            // Roles
            Route::get('roles',                        [RoleController::class, 'index']);
            Route::post('roles',                       [RoleController::class, 'store']);
            Route::get('roles/{id}',                   [RoleController::class, 'show']);
            Route::put('roles/{id}',                   [RoleController::class, 'update']);
            Route::delete('roles/{id}',                [RoleController::class, 'destroy']);
            Route::post('roles/{id}/permissions',      [RoleController::class, 'syncPermissions']);

            // Permissions (read-only)
            Route::get('permissions', [PermissionController::class, 'index']);

            // Audit Logs
            Route::get('audit-logs', [AuditLogController::class, 'index']);
        });
    });
});
