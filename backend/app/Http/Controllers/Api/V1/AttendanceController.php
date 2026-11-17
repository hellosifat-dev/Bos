<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Employee;
use App\Services\AuditService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    public function __construct(private AuditService $audit) {}

    /** Attendance sheet for one day: every active employee with their record (if any). */
    public function sheet(Request $request): JsonResponse
    {
        $date = $request->validate(['date' => 'nullable|date'])['date'] ?? today()->toDateString();

        $records = Attendance::whereDate('date', $date)->get()->keyBy('employee_id');
        $rows = Employee::where('status', 'active')
            ->whereDate('join_date', '<=', $date)
            ->with(['department:id,name'])
            ->when($request->query('department_id'), fn ($q, $v) => $q->where('department_id', $v))
            ->orderBy('name')
            ->get()
            ->map(fn (Employee $e) => [
                'employee_id'   => $e->id,
                'employee_code' => $e->employee_code,
                'name'          => $e->name,
                'department'    => $e->department?->name,
                'status'        => $records[$e->id]->status ?? null,
                'check_in'      => isset($records[$e->id]) ? substr((string) $records[$e->id]->check_in, 0, 5) ?: null : null,
                'check_out'     => isset($records[$e->id]) ? substr((string) $records[$e->id]->check_out, 0, 5) ?: null : null,
                'note'          => $records[$e->id]->note ?? null,
            ]);

        return response()->json(['success' => true, 'data' => $rows, 'date' => $date]);
    }

    public function save(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date'                  => 'required|date|before_or_equal:today',
            'records'               => 'required|array|min:1',
            'records.*.employee_id' => ['required', Rule::exists('employees', 'id')->where('business_id', app('current_business')->id)],
            'records.*.status'      => 'nullable|in:present,absent,late,half_day,leave,holiday',
            'records.*.check_in'    => 'nullable|date_format:H:i',
            'records.*.check_out'   => 'nullable|date_format:H:i',
            'records.*.note'        => 'nullable|string|max:255',
        ]);

        DB::transaction(function () use ($data) {
            foreach ($data['records'] as $r) {
                if (empty($r['status'])) {
                    Attendance::where('employee_id', $r['employee_id'])->whereDate('date', $data['date'])->delete();
                    continue;
                }
                Attendance::record(
                    (int) $r['employee_id'],
                    $data['date'],
                    [
                        'status'      => $r['status'],
                        'check_in'    => $r['check_in'] ?? null,
                        'check_out'   => $r['check_out'] ?? null,
                        'note'        => $r['note'] ?? null,
                        'recorded_by' => auth()->id(),
                    ],
                );
            }
        });
        $this->audit->record('save', 'attendance', null, null, ['date' => $data['date'], 'count' => count($data['records'])]);

        return response()->json(['success' => true, 'message' => 'Attendance saved.']);
    }

    /** Per-employee totals for a month (YYYY-MM). */
    public function summary(Request $request): JsonResponse
    {
        $month = $request->validate(['month' => 'nullable|date_format:Y-m'])['month'] ?? now()->format('Y-m');
        $start = CarbonImmutable::createFromFormat('Y-m-d', "{$month}-01");

        $counts = Attendance::whereBetween('date', [$start->toDateString(), $start->endOfMonth()->toDateString()])
            ->get()->groupBy('employee_id');

        $rows = Employee::where('status', '!=', 'inactive')->orderBy('name')->get()->map(function ($e) use ($counts) {
            $c = ($counts[$e->id] ?? collect())->countBy('status');
            return [
                'employee_id' => $e->id, 'name' => $e->name, 'employee_code' => $e->employee_code,
                'present' => $c['present'] ?? 0, 'late' => $c['late'] ?? 0, 'half_day' => $c['half_day'] ?? 0,
                'absent' => $c['absent'] ?? 0, 'leave' => $c['leave'] ?? 0, 'holiday' => $c['holiday'] ?? 0,
            ];
        });

        return response()->json(['success' => true, 'data' => $rows, 'month' => $month]);
    }
}
