<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Business\StoreBusinessRequest;
use App\Http\Requests\Business\UpdateBusinessRequest;
use App\Http\Resources\BusinessResource;
use App\Models\Business;
use App\Services\BusinessService;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BusinessController extends Controller
{
    public function __construct(
        private BusinessService $businessService,
        private PermissionService $permissions,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $user = $request->user();
        $businesses = Business::forTenant($tenant->id)
            ->when(!$this->seesAllBusinesses($user, $tenant), fn ($q) => $q->where(function ($q2) use ($user) {
                $q2->where('owner_id', $user->id)
                   ->orWhereIn('id', $user->userRoles()->select('business_id'));
            }))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->whereRaw('LOWER(name) LIKE ?', ['%' . strtolower($s) . '%']))
            ->withCount('branches')
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data' => BusinessResource::collection($businesses),
            'meta' => [
                'total' => $businesses->total(),
                'per_page' => $businesses->perPage(),
                'current_page' => $businesses->currentPage(),
                'last_page' => $businesses->lastPage(),
            ],
        ]);
    }

    public function store(StoreBusinessRequest $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');
        $business = $this->businessService->create(
            $request->validated(),
            $tenant,
            $request->user()
        );

        return response()->json([
            'success' => true,
            'message' => 'Business created successfully.',
            'data' => new BusinessResource($business->load('branches')),
            'permissions' => $this->permissions->getUserPermissions($request->user(), $business->id)->values(),
        ], 201);
    }

    public function show(Request $request, Business $business): JsonResponse
    {
        $this->authorizeBusinessAccess($request, $business);

        return response()->json([
            'success' => true,
            'data' => new BusinessResource(
                $business->load(['branches', 'departments', 'owner'])
            ),
        ]);
    }

    public function update(UpdateBusinessRequest $request, Business $business): JsonResponse
    {
        $this->authorizeBusinessAccess($request, $business);

        $business = $this->businessService->update($business, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'Business updated successfully.',
            'data' => new BusinessResource($business),
        ]);
    }

    public function destroy(Request $request, Business $business): JsonResponse
    {
        $this->authorizeBusinessAccess($request, $business);

        $this->businessService->delete($business);

        return response()->json([
            'success' => true,
            'message' => 'Business deleted successfully.',
        ]);
    }

    public function uploadLogo(Request $request, Business $business): JsonResponse
    {
        $request->validate(['logo' => 'required|image|max:2048']);
        $this->authorizeBusinessAccess($request, $business);

        $business = $this->businessService->uploadLogo($business, $request->file('logo'));

        return response()->json([
            'success' => true,
            'message' => 'Logo uploaded successfully.',
            'data' => ['logo' => $business->logo],
        ]);
    }

    public function setupProgress(Request $request, Business $business): JsonResponse
    {
        $this->authorizeBusinessAccess($request, $business);

        return response()->json([
            'success' => true,
            'data' => [
                'progress' => $business->setup_progress,
                'steps' => $business->setup_steps,
                'status' => $business->status,
            ],
        ]);
    }

    public function updateSetupStep(Request $request, Business $business, string $step): JsonResponse
    {
        $this->authorizeBusinessAccess($request, $business);

        $this->businessService->markSetupStepComplete($business, $step);

        return response()->json([
            'success' => true,
            'message' => "Setup step '{$step}' marked as complete.",
            'data' => [
                'progress' => $business->fresh()->setup_progress,
                'steps' => $business->fresh()->setup_steps,
            ],
        ]);
    }

    public function enableModule(Request $request, Business $business): JsonResponse
    {
        $request->validate(['module' => 'required|string']);
        $this->authorizeBusinessAccess($request, $business);
        $this->businessService->enableModule($business, $request->module);

        return response()->json([
            'success' => true,
            'message' => "Module '{$request->module}' enabled.",
        ]);
    }

    public function disableModule(Request $request, Business $business): JsonResponse
    {
        $request->validate(['module' => 'required|string']);
        $this->authorizeBusinessAccess($request, $business);
        $this->businessService->disableModule($business, $request->module);

        return response()->json([
            'success' => true,
            'message' => "Module '{$request->module}' disabled.",
        ]);
    }

    /** Select a business as the working context; returns it with the caller's permissions. */
    public function switch(Request $request, Business $business): JsonResponse
    {
        $this->authorizeBusinessAccess($request, $business);

        return response()->json([
            'success' => true,
            'data' => [
                'business'    => new BusinessResource($business),
                'permissions' => $this->permissions->getUserPermissions($request->user(), $business->id)->values(),
            ],
        ]);
    }

    private function seesAllBusinesses($user, $tenant): bool
    {
        return $user->is_super_admin
            || $user->tenants()->where('tenants.id', $tenant->id)->wherePivotIn('role', ['owner', 'admin'])->exists();
    }

    private function authorizeBusinessAccess(Request $request, Business $business): void
    {
        $tenant = $request->attributes->get('tenant');
        if ((int) $business->tenant_id !== (int) $tenant->id) {
            abort(403, 'Access denied to this business.');
        }

        $user = $request->user();
        $allowed = $this->seesAllBusinesses($user, $tenant)
            || $business->owner_id === $user->id
            || $user->userRoles()->where('business_id', $business->id)->exists();

        if (!$allowed) {
            abort(403, 'Access denied to this business.');
        }
    }
}
