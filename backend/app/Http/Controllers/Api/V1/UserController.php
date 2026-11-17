<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Models\UserRole;
use App\Services\AuditService;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class UserController extends Controller
{
    public function __construct(
        private AuditService $auditService,
        private PermissionService $permissionService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenantId   = $request->header('X-Tenant-ID');
        $businessId = $request->header('X-Business-ID');

        $users = User::whereHas('tenants', fn($q) => $q->where('tenant_id', $tenantId))
            ->with(['roles' => fn($q) => $q->wherePivot('business_id', $businessId)])
            ->when($request->search, fn($q) => $q->where(function ($q2) use ($request) {
                $term = '%' . strtolower($request->search) . '%';
                $q2->whereRaw('LOWER(first_name) LIKE ?', [$term])
                   ->orWhereRaw('LOWER(last_name) LIKE ?', [$term])
                   ->orWhereRaw('LOWER(email) LIKE ?', [$term]);
            }))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderBy('first_name')
            ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data'    => UserResource::collection($users),
            'meta'    => [
                'current_page' => $users->currentPage(),
                'last_page'    => $users->lastPage(),
                'per_page'     => $users->perPage(),
                'total'        => $users->total(),
            ],
        ]);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $data             = $request->validated();
        $tenantId         = $request->header('X-Tenant-ID');
        $businessId       = $request->header('X-Business-ID');
        $data['status']   = 'active';

        $user = User::create(Arr::except($data, ['role_id', 'branch_id', 'department_id', 'send_invitation']));

        // Attach to tenant
        $user->tenants()->attach($tenantId, ['role' => 'member', 'status' => 'active', 'joined_at' => now()]);

        // Assign role
        if (!empty($data['role_id'])) {
            UserRole::create([
                'user_id'     => $user->id,
                'role_id'     => $data['role_id'],
                'business_id' => $businessId,
                'tenant_id'   => $tenantId,
                'branch_id'   => $data['branch_id'] ?? null,
            ]);
        }

        // Send invitation if requested
        if ($request->send_invitation) {
            // TODO: dispatch invitation email job
        }

        $this->auditService->record('create', 'users', $user->id, null, Arr::except($data, ['password']));

        return response()->json([
            'success' => true,
            'data'    => new UserResource($user->load('roles')),
            'message' => 'User created successfully.',
        ], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->header('X-Tenant-ID');

        $user = User::whereHas('tenants', fn($q) => $q->where('tenant_id', $tenantId))
            ->with(['roles' => fn($q) => $q->wherePivot('business_id', $request->header('X-Business-ID'))])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data'    => new UserResource($user),
        ]);
    }

    public function update(UpdateUserRequest $request, string $id): JsonResponse
    {
        $tenantId = $request->header('X-Tenant-ID');

        $user = User::whereHas('tenants', fn($q) => $q->where('tenant_id', $tenantId))
            ->findOrFail($id);

        $old  = $user->toArray();
        $data = $request->validated();

        if (!empty($data['password'])) {
            } else {
            unset($data['password']);
        }

        $user->update($data);
        $this->auditService->record('update', 'users', $user->id, $old, Arr::except($data, ['password']));

        return response()->json([
            'success' => true,
            'data'    => new UserResource($user->fresh(['roles'])),
            'message' => 'User updated successfully.',
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $tenantId = $request->header('X-Tenant-ID');

        $user = User::whereHas('tenants', fn($q) => $q->where('tenant_id', $tenantId))
            ->findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Cannot delete your own account.'], 422);
        }

        $this->auditService->record('delete', 'users', $user->id, $user->toArray(), null);
        $user->delete();

        return response()->json(['success' => true, 'message' => 'User deleted successfully.']);
    }

    public function assignRole(Request $request, string $id): JsonResponse
    {
        $request->validate(['role_id' => 'required|exists:roles,id', 'branch_id' => 'nullable|exists:branches,id']);

        $tenantId   = $request->header('X-Tenant-ID');
        $businessId = $request->header('X-Business-ID');

        $user = User::whereHas('tenants', fn($q) => $q->where('tenant_id', $tenantId))->findOrFail($id);

        UserRole::firstOrCreate([
            'user_id'     => $user->id,
            'role_id'     => $request->role_id,
            'business_id' => $businessId,
            'tenant_id'   => $tenantId,
        ], ['branch_id' => $request->branch_id]);

        $this->auditService->record('assign_role', 'users', $user->id, null, ['role_id' => $request->role_id]);

        return response()->json(['success' => true, 'message' => 'Role assigned successfully.']);
    }

    public function revokeRole(Request $request, string $id): JsonResponse
    {
        $request->validate(['role_id' => 'required|exists:roles,id']);

        $tenantId   = $request->header('X-Tenant-ID');
        $businessId = $request->header('X-Business-ID');

        UserRole::where('user_id', $id)
            ->where('role_id', $request->role_id)
            ->where('business_id', $businessId)
            ->where('tenant_id', $tenantId)
            ->delete();

        $this->auditService->record('revoke_role', 'users', $id, null, ['role_id' => $request->role_id]);

        return response()->json(['success' => true, 'message' => 'Role revoked successfully.']);
    }
}
