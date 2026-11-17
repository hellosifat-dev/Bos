<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $business   = $request->attributes->get('business');
        $tenantId   = $business->tenant_id;
        $businessId = $business->id;

        $logs = AuditLog::where('tenant_id', $tenantId)
            ->when($businessId, fn($q) => $q->where('business_id', $businessId))
            ->when($request->module, fn($q) => $q->where('module', $request->module))
            ->when($request->user_id, fn($q) => $q->where('user_id', $request->user_id))
            ->when($request->search, fn($q) => $q->where(function ($q2) use ($request) {
                $term = '%' . strtolower($request->search) . '%';
                $q2->whereRaw('LOWER(description) LIKE ?', [$term])->orWhereRaw('LOWER(module) LIKE ?', [$term]);
            }))
            ->when($request->action, fn($q) => $q->where('action', $request->action))
            ->when($request->date_from, fn($q) => $q->where('created_at', '>=', $request->date_from))
            ->when($request->date_to, fn($q) => $q->where('created_at', '<=', $request->date_to . ' 23:59:59'))
            ->with('user:id,first_name,last_name,email')
            ->orderByDesc('created_at')
            ->paginate($request->per_page ?? 20);

        return response()->json([
            'success' => true,
            'data'    => AuditLogResource::collection($logs),
            'meta'    => [
                'current_page' => $logs->currentPage(),
                'last_page'    => $logs->lastPage(),
                'per_page'     => $logs->perPage(),
                'total'        => $logs->total(),
            ],
        ]);
    }
}
