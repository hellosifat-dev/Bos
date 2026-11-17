<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PayrollRun extends Model
{
    use BusinessScoped;

    protected $fillable = [
        'tenant_id', 'business_id', 'period', 'period_start', 'period_end', 'working_days', 'status',
        'total_gross', 'total_deductions', 'total_net', 'approved_by', 'approved_at', 'paid_at', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d', 'period_end' => 'date:Y-m-d',
            'total_gross' => 'decimal:2', 'total_deductions' => 'decimal:2', 'total_net' => 'decimal:2',
            'approved_at' => 'datetime', 'paid_at' => 'datetime',
        ];
    }

    public function payslips(): HasMany { return $this->hasMany(Payslip::class); }
}
