<?php

namespace App\Http\Middleware;

use App\Models\Business;
use Closure;
use Illuminate\Http\Request;

class BusinessMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $businessId = $request->header('X-Business-ID');
        $tenantId   = $request->header('X-Tenant-ID');

        if (!$businessId) {
            return response()->json([
                'success' => false,
                'message' => 'Business identifier is required.',
            ], 400);
        }

        $business = Business::where('id', $businessId)
            ->where('tenant_id', $tenantId)
            ->where('status', '!=', 'deleted')
            ->first();

        if (!$business) {
            return response()->json([
                'success' => false,
                'message' => 'Business not found.',
            ], 404);
        }

        // Verify user has access to this business
        $user = $request->user();
        if ($user) {
            $hasAccess = $user->roles()
                ->where('business_id', $businessId)
                ->exists();

            // Business owner always has access
            if (!$hasAccess && $business->owner_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied to this business.',
                ], 403);
            }
        }

        app()->instance('current_business', $business);
        $request->attributes->set('business', $business);

        return $next($request);
    }
}
