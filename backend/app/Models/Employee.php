<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Employee extends Model
{
    use BusinessScoped, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'business_id', 'user_id', 'branch_id', 'department_id', 'designation_id', 'employee_code',
        'name', 'email', 'phone', 'join_date', 'employment_type', 'basic_salary', 'allowances', 'deductions',
        'bank_account', 'status', 'terminated_at',
    ];

    protected function casts(): array
    {
        return [
            'join_date' => 'date:Y-m-d', 'terminated_at' => 'date:Y-m-d',
            'basic_salary' => 'decimal:2', 'allowances' => 'decimal:2', 'deductions' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
    public function department(): BelongsTo { return $this->belongsTo(Department::class); }
    public function designation(): BelongsTo { return $this->belongsTo(Designation::class); }
    public function attendances(): HasMany { return $this->hasMany(Attendance::class); }
    public function leaveRequests(): HasMany { return $this->hasMany(LeaveRequest::class); }
}
