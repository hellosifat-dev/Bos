<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Designation extends Model
{
    use BusinessScoped, HasFactory, SoftDeletes;

    protected $fillable = [
        'business_id',
        'department_id',
        'tenant_id',
        'name',
        'code',
        'description',
        'level',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'level' => 'integer',
        ];
    }


    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function employees(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
