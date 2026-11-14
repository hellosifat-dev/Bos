<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Tenant extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'domain',
        'subdomain',
        'logo',
        'favicon',
        'primary_color',
        'secondary_color',
        'status',
        'plan',
        'trial_ends_at',
        'subscription_ends_at',
        'max_businesses',
        'max_branches_per_business',
        'max_users',
        'features',
        'settings',
        'timezone',
        'currency',
        'date_format',
        'time_format',
        'owner_id',
    ];

    protected function casts(): array
    {
        return [
            'trial_ends_at' => 'datetime',
            'subscription_ends_at' => 'datetime',
            'features' => 'array',
            'settings' => 'array',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'tenant_users')
            ->withPivot('role', 'is_primary', 'status', 'joined_at')
            ->withTimestamps();
    }

    public function businesses(): HasMany
    {
        return $this->hasMany(Business::class);
    }

    public function roles(): HasMany
    {
        return $this->hasMany(Role::class);
    }

    public function isOnTrial(): bool
    {
        return $this->status === 'trial' && $this->trial_ends_at?->isFuture();
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
