<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Branch\StoreBranchRequest;
use App\Http\Requests\Branch\UpdateBranchRequest;
use App\Http\Resources\BranchResource;
use App\Models\Branch;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BranchController extends Controller
{
    public function __construct(private AuditService $auditService) {}

    public function index(Request $request): JsonResponse
    {
        $businessId = $request->header('X-Business-ID');
        $tenantId   = $request->header('X-Tenant-ID');

        $branches = Branch::where('tenant_id', $tenantId)
            ->where('business_id', $businessId)
            ->with(['manager'])
            ->when($request->search, fn($q) => $q->where('name', 'like', "%{$request->search}%"))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->orderBy('name')
            ->paginate($request->per_page ?? 15);

        return response()->json([
            'success' => true,
            'data'    => BranchResource::collection($branches),
            'meta'    => [
                'current_page' => $branches->currentPage(),
                'last_page'    => $branches->lastPage(),
                'per_page'     => $branches->perPage(),
                'total'        => $branches->total(),
            ],
        ]);
    }

    public function store(StoreBranchRequest $request): JsonResponse
    {
        $data               = $request->validated();
        $data['business_id'] = $request->header('X-Business-ID');
        $data['tenant_id']  = $request->header('X-Tenant-ID');

        $branch = Branch::create($data);

        $this->auditService->log('create', 'branches', $branch->id, null, $data);

        return response()->json([
            'success' => true,
            'data'    => new BranchResource($branch),
            'message' => 'Branch created successfully.',
        ], 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $branch = Branch::where('tenant_id', $request->header('X-Tenant-ID'))
            ->where('business_id', $request->header('X-Business-ID'))
            ->with(['manager', 'employees', 'warehouses'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data'    => new BranchResource($branch),
        ]);
    }

    public function update(UpdateBranchRequest $request, string $id): JsonResponse
    {
        $branch = Branch::where('tenant_id', $request->header('X-Tenant-ID'))
            ->where('business_id', $request->header('X-Business-ID'))
            ->findOrFail($id);

        $old = $branch->toArray();
        $branch->update($request->validated());

        $this->auditService->log('update', 'branches', $branch->id, $old, $request->validated());

        return response()->json([
            'success' => true,
            'data'    => new BranchResource($branch->fresh()),
            'message' => 'Branch updated successfully.',
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $branch = Branch::where('tenant_id', $request->header('X-Tenant-ID'))
            ->where('business_id', $request->header('X-Business-ID'))
            ->findOrFail($id);

        if ($branch->is_headquarters) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete the headquarters branch.',
            ], 422);
        }

        $this->auditService->log('delete', 'branches', $branch->id, $branch->toArray(), null);
        $branch->delete();

        return response()->json([
            'success' => true,
            'message' => 'Branch deleted successfully.',
        ]);
    }
}
