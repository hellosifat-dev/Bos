<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    use BusinessScoped;

    protected $fillable = ['tenant_id', 'business_id', 'employee_id', 'date', 'status', 'check_in', 'check_out', 'note', 'recorded_by'];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d'];
    }

    /** Insert or update the record for one employee/day (date compared as a date, not a string). */
    public static function record(int $employeeId, string $date, array $attributes): self
    {
        $row = static::where('employee_id', $employeeId)->whereDate('date', $date)->first();
        if ($row) {
            $row->update($attributes);
            return $row;
        }
        return static::create(['employee_id' => $employeeId, 'date' => $date] + $attributes);
    }

    public function employee(): BelongsTo { return $this->belongsTo(Employee::class)->withTrashed(); }
}
