<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Role\StoreRoleRequest;
use App\Http\Requests\Role\UpdateRoleRequest;
use App\Http\Resources\RoleResource;
use App\Models\Permission;
use App\Models\Role;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function __construct(private AuditService $auditService) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId   = $request->header('X-Tenant-ID');
        $businessId = $request->header('X-Business-ID');

        $roles = Role::where(function ($q) use ($tenantId, $businessId) {
                $q->where('is_system', true)
                  ->orWhere(fn($q2) => $q2->where('tenant_id', $tenantId)->where('business_id', $businessId));
            })
            ->withCount('users')
            ->with('permissions')
            ->when($request->search, fn($q) => $q->where('name', 'like', "%{$request->search}%"))
            ->orderBy('is_system', 'desc')
            ->orderBy('name')
            ->paginate($request->per_page ?? 20);

        return response()->json([
            'success' => true,
            'data'    => RoleResource::collection($roles),
            'meta'    => ['current_page' => $roles->currentPage(), 'last_page' => $roles->lastPage(), 'total' => $roles->total()],
        ]);
    }

    public function store(StoreRoleRequest $request): JsonResponse
    {
        $data              = $request->validated();
        $data['tenant_id'] = $request->header('X-Tenant-ID');
        $data['business_id'] = $request->header('X-Business-ID');
        $data['is_system'] = false;

        $role = Role::create($data);

        if (!empty($data['permission_ids'])) {
            $role->permissions()->sync($data['permission_ids']);
        }

        $this->auditService->log('create', 'roles', $role->id, null, $data);

        return response()->json([
            'success' => true,
            'data'    => new RoleResource($role->load('permissions')),
            'message' => 'Role created successfully.',
        ], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $tenantId   = $request->header('X-Tenant-ID');
        $businessId = $request->header('X-Business-ID');

        $role = Role::where(function ($q) use ($tenantId, $businessId) {
                $q->where('is_system', true)
                  ->orWhere(fn($q2) => $q2->where('tenant_id', $tenantId)->where('business_id', $businessId));
            })
            ->with('permissions')
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => new RoleResource($role)]);
    }

    public function update(UpdateRoleRequest $request, string $id): JsonResponse
    {
        $role = Role::where('tenant_id', $request->header('X-Tenant-ID'))
            ->where('is_system', false)
            ->findOrFail($id);

        $old = $role->toArray();
        $role->update($request->safe()->except('permission_ids'));

        if ($request->has('permission_ids')) {
            $role->permissions()->sync($request->permission_ids);
        }

        $this->auditService->log('update', 'roles', $role->id, $old, $request->validated());

        return response()->json([
            'success' => true,
            'data'    => new RoleResource($role->load('permissions')),
            'message' => 'Role updated successfully.',
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $role = Role::where('tenant_id', $request->header('X-Tenant-ID'))
            ->where('is_system', false)
            ->findOrFail($id);

        if ($role->users()->count() > 0) {
            return response()->json(['success' => false, 'message' => 'Cannot delete role with assigned users.'], 422);
        }

        $this->auditService->log('delete', 'roles', $role->id, $role->toArray(), null);
        $role->delete();

        return response()->json(['success' => true, 'message' => 'Role deleted successfully.']);
    }

    public function syncPermissions(Request $request, string $id): JsonResponse
    {
        $request->validate(['permission_ids' => 'required|array', 'permission_ids.*' => 'exists:permissions,id']);

        $role = Role::where('tenant_id', $request->header('X-Tenant-ID'))
            ->where('is_system', false)
            ->findOrFail($id);

        $role->permissions()->sync($request->permission_ids);
        $this->auditService->log('sync_permissions', 'roles', $role->id, null, ['permission_ids' => $request->permission_ids]);

        return response()->json([
            'success' => true,
            'data'    => new RoleResource($role->load('permissions')),
            'message' => 'Permissions synced successfully.',
        ]);
    }
}
