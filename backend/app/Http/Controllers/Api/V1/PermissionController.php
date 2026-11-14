<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use Illuminate\Http\JsonResponse;

class PermissionController extends Controller
{
    public function index(): JsonResponse
    {
        $permissions = Permission::orderBy('module')->orderBy('action')->get();

        $grouped = $permissions->groupBy('module')->map(fn($perms) => $perms->map(fn($p) => [
            'id'     => $p->id,
            'name'   => $p->name,
            'slug'   => $p->slug,
            'action' => $p->action,
        ]));

        return response()->json([
            'success' => true,
            'data'    => $grouped,
        ]);
    }
}
