<?php

namespace App\Http\Middleware;

use App\Services\PermissionService;
use Closure;
use Illuminate\Http\Request;

class PermissionMiddleware
{
    public function __construct(private PermissionService $permissionService) {}

    public function handle(Request $request, Closure $next, string $action, string $module)
    {
        $user       = $request->user();
        $businessId = $request->header('X-Business-ID');
        $branchId   = $request->header('X-Branch-ID');

        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        if (!$this->permissionService->can($user, $action, $module, $businessId, $branchId)) {
            return response()->json([
                'success' => false,
                'message' => "You do not have permission to {$action} {$module}.",
            ], 403);
        }

        return $next($request);
    }
}
