<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\LeaveRequest;
use App\Services\AuditService;
use App\Services\HrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LeaveController extends Controller
{
    public function __construct(private HrService $hr, private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $page = LeaveRequest::with(['employee:id,name,employee_code', 'reviewer:id,first_name,last_name'])
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->query('employee_id'), fn ($q, $v) => $q->where('employee_id', $v))
            ->when($request->query('type'), fn ($q, $v) => $q->where('type', $v))
            ->orderByDesc('start_date')
            ->paginate(min((int) $request->query('per_page', 15), 100));

        return response()->json([
            'success' => true,
            'data'    => $page->items(),
            'meta'    => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', Rule::exists('employees', 'id')->where('business_id', app('current_business')->id)],
            'type'        => 'required|in:annual,sick,casual,unpaid,other',
            'start_date'  => 'required|date',
            'end_date'    => 'required|date|after_or_equal:start_date',
            'reason'      => 'nullable|string',
        ]);

        $leave = $this->hr->requestLeave(app('current_business'), $data);
        $this->audit->record('create', 'leave', $leave->id, null, $data);

        return response()->json(['success' => true, 'message' => 'Leave requested.', 'data' => $leave->load('employee:id,name')], 201);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        return $this->review($request, $id, true);
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        return $this->review($request, $id, false);
    }

    private function review(Request $request, string $id, bool $approve): JsonResponse
    {
        $note  = $request->validate(['note' => 'nullable|string|max:255'])['note'] ?? null;
        $leave = $this->hr->review(LeaveRequest::findOrFail($id), $approve, $note);
        $this->audit->record($approve ? 'approve' : 'reject', 'leave', $leave->id);

        return response()->json(['success' => true, 'message' => $approve ? 'Leave approved.' : 'Leave rejected.', 'data' => $leave]);
    }

    public function destroy(string $id): JsonResponse
    {
        $leave = LeaveRequest::findOrFail($id);
        if ($leave->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['Only pending requests can be withdrawn.']]);
        }
        $leave->delete();
        $this->audit->record('delete', 'leave', $leave->id);

        return response()->json(['success' => true, 'message' => 'Leave request withdrawn.']);
    }
}
