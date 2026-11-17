<?php

namespace App\Http\Middleware;

use App\Services\PermissionService;
use Closure;
use Illuminate\Http\Request;

/**
 * Usage: ->middleware('permission:view,branches')  (action, module)
 */
class PermissionMiddleware
{
    public function __construct(private PermissionService $permissions) {}

    public function handle(Request $request, Closure $next, string $action, string $module)
    {
        $user       = $request->user();
        $businessId = $request->attributes->get('business')?->id ?? $request->header('X-Business-ID');

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        if (!$businessId || !$this->permissions->userCan($user, "{$module}.{$action}", (int) $businessId)) {
            return response()->json([
                'success' => false,
                'message' => "You do not have permission to {$action} {$module}.",
            ], 403);
        }

        return $next($request);
    }
}
