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

        if (!$businessId) {
            return response()->json(['success' => false, 'message' => 'Business identifier is required.'], 400);
        }

        $tenant   = $request->attributes->get('tenant');
        $business = Business::where('id', $businessId)
            ->when($tenant, fn ($q) => $q->where('tenant_id', $tenant->id))
            ->first();

        if (!$business) {
            return response()->json(['success' => false, 'message' => 'Business not found.'], 404);
        }

        $user = $request->user();
        if ($user && !$this->canAccess($user, $business, $tenant)) {
            return response()->json(['success' => false, 'message' => 'Access denied to this business.'], 403);
        }

        app()->instance('current_business', $business);
        $request->attributes->set('business', $business);

        return $next($request);
    }

    private function canAccess($user, Business $business, $tenant): bool
    {
        if ($user->is_super_admin || $business->owner_id === $user->id) {
            return true;
        }

        $isTenantOwner = $user->tenants()
            ->where('tenants.id', $business->tenant_id)
            ->wherePivotIn('role', ['owner', 'admin'])
            ->exists();

        return $isTenantOwner || $user->userRoles()->where('business_id', $business->id)->exists();
    }
}
