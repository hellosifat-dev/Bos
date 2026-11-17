<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payslip extends Model
{
    protected $fillable = [
        'payroll_run_id', 'employee_id', 'working_days', 'present_days', 'absent_days', 'unpaid_leave_days',
        'basic', 'allowances', 'bonus', 'deductions', 'absence_deduction', 'gross', 'net', 'note',
    ];

    protected function casts(): array
    {
        $money = ['basic', 'allowances', 'bonus', 'deductions', 'absence_deduction', 'gross', 'net'];
        return array_fill_keys($money, 'decimal:2') + array_fill_keys(['working_days', 'present_days', 'absent_days', 'unpaid_leave_days'], 'decimal:1');
    }

    public function run(): BelongsTo { return $this->belongsTo(PayrollRun::class, 'payroll_run_id'); }
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class)->withTrashed(); }
}
