<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;

class TenantMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $tenantId = $request->header('X-Tenant-ID');

        if (!$tenantId) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant identifier is required.',
            ], 400);
        }

        $tenant = Tenant::where('id', $tenantId)
            ->whereIn('status', ['active', 'trial'])
            ->first();

        if (!$tenant) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant not found or inactive.',
            ], 404);
        }

        // Verify user belongs to this tenant
        $user = $request->user();
        if ($user && !$user->tenants()->where('tenant_id', $tenantId)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied to this tenant.',
            ], 403);
        }

        // Make tenant available throughout the request
        app()->instance('current_tenant', $tenant);
        $request->attributes->set('tenant', $tenant);

        return $next($request);
    }
}
