<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Business;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PayrollRun;
use App\Models\Payslip;
use Carbon\CarbonImmutable;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class HrService
{
    public function __construct(private AccountingService $accounting) {}

    public function weekendDays(Business $business): array
    {
        return $business->settings['weekend_days'] ?? config('bos.weekend_days', [0, 6]);
    }

    /** Working days between two dates (inclusive), excluding the weekend. */
    public function workingDays(Business $business, string $from, string $to): int
    {
        $weekend = $this->weekendDays($business);
        $count = 0;
        foreach (CarbonPeriod::create($from, $to) as $day) {
            if (!in_array($day->dayOfWeek, $weekend, true)) {
                $count++;
            }
        }
        return $count;
    }

    // ── Leave ───────────────────────────────────────────────────────────────

    public function requestLeave(Business $business, array $data): LeaveRequest
    {
        $days = $this->workingDays($business, $data['start_date'], $data['end_date']);
        if ($days < 1) {
            throw ValidationException::withMessages(['end_date' => ['The selected range contains no working days.']]);
        }

        $overlap = LeaveRequest::where('employee_id', $data['employee_id'])
            ->whereIn('status', ['pending', 'approved'])
            ->where('start_date', '<=', $data['end_date'])
            ->where('end_date', '>=', $data['start_date'])
            ->exists();
        if ($overlap) {
            throw ValidationException::withMessages(['start_date' => ['This overlaps an existing leave request.']]);
        }

        return LeaveRequest::create($data + ['days' => $days, 'status' => 'pending']);
    }

    public function review(LeaveRequest $leave, bool $approve, ?string $note = null): LeaveRequest
    {
        if ($leave->status !== 'pending') {
            throw ValidationException::withMessages(['status' => ['This request has already been reviewed.']]);
        }

        return DB::transaction(function () use ($leave, $approve, $note) {
            $leave->update([
                'status'      => $approve ? 'approved' : 'rejected',
                'reviewed_by' => auth()->id(),
                'reviewed_at' => now(),
                'review_note' => $note,
            ]);

            if ($approve) {
                $weekend = $this->weekendDays($leave->business);
                foreach (CarbonPeriod::create($leave->start_date, $leave->end_date) as $day) {
                    if (in_array($day->dayOfWeek, $weekend, true)) {
                        continue;
                    }
                    Attendance::record(
                        $leave->employee_id,
                        $day->toDateString(),
                        ['status' => 'leave', 'note' => ucfirst($leave->type) . ' leave', 'recorded_by' => auth()->id()],
                    );
                }
            }

            return $leave;
        });
    }

    // ── Payroll ─────────────────────────────────────────────────────────────

    public function generatePayroll(Business $business, string $period): PayrollRun
    {
        $start = CarbonImmutable::createFromFormat('Y-m-d', "{$period}-01")->startOfDay();
        $end   = $start->endOfMonth();

        if (PayrollRun::where('period', $period)->exists()) {
            throw ValidationException::withMessages(['period' => ["Payroll for {$period} already exists."]]);
        }

        return DB::transaction(function () use ($business, $period, $start, $end) {
            $run = PayrollRun::create([
                'period'       => $period,
                'period_start' => $start->toDateString(),
                'period_end'   => $end->toDateString(),
                'working_days' => $this->workingDays($business, $start->toDateString(), $end->toDateString()),
                'status'       => 'draft',
            ]);

            $employees = Employee::where('status', '!=', 'inactive')
                ->whereDate('join_date', '<=', $end)
                ->where(fn ($q) => $q->whereNull('terminated_at')->orWhereDate('terminated_at', '>=', $start))
                ->orderBy('name')->get();

            foreach ($employees as $employee) {
                $this->buildPayslip($run, $employee);
            }

            $this->refreshTotals($run);

            return $run;
        });
    }

    private function buildPayslip(PayrollRun $run, Employee $employee): Payslip
    {
        $records = Attendance::where('employee_id', $employee->id)
            ->whereBetween('date', [$run->period_start->toDateString(), $run->period_end->toDateString()])
            ->get();

        $unpaidLeaveDays = (float) LeaveRequest::where('employee_id', $employee->id)
            ->where('status', 'approved')->where('type', 'unpaid')
            ->get()
            ->sum(fn ($l) => $this->overlapWorkingDays($run, $l->start_date->toDateString(), $l->end_date->toDateString()));

        $present = $records->whereIn('status', ['present', 'late'])->count() + 0.5 * $records->where('status', 'half_day')->count();
        $absent  = $records->where('status', 'absent')->count() + 0.5 * $records->where('status', 'half_day')->count();

        $slip = new Payslip([
            'employee_id'       => $employee->id,
            'working_days'      => $run->working_days,
            'present_days'      => $present,
            'absent_days'       => $absent,
            'unpaid_leave_days' => $unpaidLeaveDays,
            'basic'             => (float) $employee->basic_salary,
            'allowances'        => (float) $employee->allowances,
            'deductions'        => (float) $employee->deductions,
            'bonus'             => 0,
        ]);
        $this->calculate($slip, $run);
        $run->payslips()->save($slip);

        return $slip;
    }

    private function overlapWorkingDays(PayrollRun $run, string $from, string $to): int
    {
        $from = max($from, $run->period_start->toDateString());
        $to   = min($to, $run->period_end->toDateString());
        return $from > $to ? 0 : $this->workingDays($run->business, $from, $to);
    }

    private function calculate(Payslip $slip, PayrollRun $run): void
    {
        $dayRate = $run->working_days > 0 ? (float) $slip->basic / $run->working_days : 0;
        $missed  = min((float) $slip->absent_days + (float) $slip->unpaid_leave_days, (float) $run->working_days);

        $slip->absence_deduction = round($dayRate * $missed, 2);
        $slip->gross = round((float) $slip->basic + (float) $slip->allowances + (float) $slip->bonus, 2);
        $slip->net   = round(max((float) $slip->gross - (float) $slip->deductions - (float) $slip->absence_deduction, 0), 2);
    }

    public function updatePayslip(Payslip $slip, array $data): Payslip
    {
        $run = $slip->run;
        if ($run->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Only draft payroll can be edited.']]);
        }
        $slip->fill($data);
        $this->calculate($slip, $run);
        $slip->save();
        $this->refreshTotals($run);

        return $slip;
    }

    public function refreshTotals(PayrollRun $run): void
    {
        $slips = $run->payslips()->get();
        $run->update([
            'total_gross'      => round($slips->sum(fn ($s) => (float) $s->gross), 2),
            'total_deductions' => round($slips->sum(fn ($s) => (float) $s->deductions + (float) $s->absence_deduction), 2),
            'total_net'        => round($slips->sum(fn ($s) => (float) $s->net), 2),
        ]);
    }

    public function approve(PayrollRun $run): PayrollRun
    {
        if ($run->status !== 'draft') {
            throw ValidationException::withMessages(['status' => ['Payroll is not a draft.']]);
        }
        $run->update(['status' => 'approved', 'approved_by' => auth()->id(), 'approved_at' => now()]);
        return $run;
    }

    public function markPaid(PayrollRun $run): PayrollRun
    {
        if ($run->status !== 'approved') {
            throw ValidationException::withMessages(['status' => ['Approve the payroll before paying it.']]);
        }
        return DB::transaction(function () use ($run) {
            $run->update(['status' => 'paid', 'paid_at' => now()]);
            $this->accounting->recordPayroll($run);
            return $run;
        });
    }
}
