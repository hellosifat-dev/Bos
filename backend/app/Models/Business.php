<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Business extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id',
        'name',
        'slug',
        'legal_name',
        'business_type',
        'industry',
        'registration_number',
        'tax_number',
        'vat_number',
        'email',
        'phone',
        'website',
        'logo',
        'description',
        'address',
        'city',
        'state',
        'country',
        'postal_code',
        'timezone',
        'currency',
        'date_format',
        'fiscal_year_start',
        'status',
        'setup_progress',
        'setup_steps',
        'settings',
        'modules_enabled',
        'owner_id',
    ];

    protected function casts(): array
    {
        return [
            'setup_steps' => 'array',
            'settings' => 'array',
            'modules_enabled' => 'array',
            'setup_progress' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function departments(): HasMany
    {
        return $this->hasMany(Department::class);
    }

    public function designations(): HasMany
    {
        return $this->hasMany(Designation::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    public function headquarters()
    {
        return $this->branches()->where('is_headquarters', true)->first();
    }

    public function updateSetupProgress(): void
    {
        $steps = $this->setup_steps ?? [];
        $completed = collect($steps)->where('completed', true)->count();
        $total = count($steps);
        $this->setup_progress = $total > 0 ? (int) round(($completed / $total) * 100) : 0;
        $this->save();
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeForTenant($query, int $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }
}
