<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Role;
use App\Models\UserRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $business = $request->attributes->get('business');

        return response()->json([
            'success' => true,
            'data' => [
                'branches' => Branch::where('business_id', $business->id)->count(),
                'roles'    => Role::where('is_system', true)->orWhere('business_id', $business->id)->count(),
                'users'    => UserRole::where('business_id', $business->id)->distinct('user_id')->count('user_id'),
                'setup_progress' => $business->setup_progress,
            ],
        ]);
    }
}
