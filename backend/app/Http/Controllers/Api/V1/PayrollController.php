<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PayrollRun;
use App\Models\Payslip;
use App\Services\AuditService;
use App\Services\HrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PayrollController extends Controller
{
    public function __construct(protected HrService $hr, protected AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $page = PayrollRun::withCount('payslips')->orderByDesc('period')
            ->paginate(min((int) $request->query('per_page', 12), 100));

        return response()->json([
            'success' => true,
            'data'    => $page->items(),
            'meta'    => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $run = PayrollRun::with(['payslips.employee:id,name,employee_code,department_id,designation_id,bank_account', 'payslips.employee.department:id,name', 'payslips.employee.designation:id,name'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $run]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['period' => 'required|date_format:Y-m']);
        $run  = $this->hr->generatePayroll(app('current_business'), $data['period']);
        $this->audit->record('create', 'payroll', $run->id, null, $data);

        return response()->json(['success' => true, 'message' => 'Payroll generated.', 'data' => $run->loadCount('payslips')], 201);
    }

    public function updatePayslip(Request $request, string $id, string $slipId): JsonResponse
    {
        $data = $request->validate([
            'bonus'      => 'numeric|min:0',
            'allowances' => 'numeric|min:0',
            'deductions' => 'numeric|min:0',
            'note'       => 'nullable|string|max:255',
        ]);
        $run  = PayrollRun::findOrFail($id);
        $slip = $this->hr->updatePayslip(Payslip::where('payroll_run_id', $run->id)->findOrFail($slipId), $data);
        $this->audit->record('update', 'payroll', $run->id, null, ['payslip' => $slip->id] + $data);

        return response()->json(['success' => true, 'data' => $slip]);
    }

    public function approve(string $id): JsonResponse
    {
        $run = $this->hr->approve(PayrollRun::findOrFail($id));
        $this->audit->record('approve', 'payroll', $run->id);

        return response()->json(['success' => true, 'message' => 'Payroll approved.', 'data' => $run]);
    }

    public function pay(string $id): JsonResponse
    {
        $run = $this->hr->markPaid(PayrollRun::findOrFail($id));
        $this->audit->record('pay', 'payroll', $run->id);

        return response()->json(['success' => true, 'message' => 'Payroll marked as paid.', 'data' => $run]);
    }

    public function destroy(string $id): JsonResponse
    {
        $run = PayrollRun::findOrFail($id);
        if ($run->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Only draft payroll can be deleted.']]);
        }
        $run->delete();
        $this->audit->record('delete', 'payroll', $run->id);

        return response()->json(['success' => true, 'message' => 'Payroll deleted.']);
    }
}
