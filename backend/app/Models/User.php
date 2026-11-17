<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    protected $fillable = [
        'name',
        'first_name',
        'last_name',
        'email',
        'phone',
        'password',
        'avatar',
        'status',
        'gender',
        'date_of_birth',
        'address',
        'city',
        'state',
        'country',
        'postal_code',
        'timezone',
        'locale',
        'email_verified',
        'email_verified_at',
        'phone_verified',
        'phone_verified_at',
        'two_factor_enabled',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'is_super_admin',
        'last_login_at',
        'last_login_ip',
        'preferences',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'phone_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'date_of_birth' => 'date',
            'email_verified' => 'boolean',
            'phone_verified' => 'boolean',
            'two_factor_enabled' => 'boolean',
            'is_super_admin' => 'boolean',
            'preferences' => 'array',
            'password' => 'hashed',
        ];
    }

    /** Full name — the API exposes a single `name`; storage keeps first/last. */
    protected function name(): Attribute
    {
        return Attribute::make(
            get: fn ($value, array $attrs) => trim(($attrs['first_name'] ?? '') . ' ' . ($attrs['last_name'] ?? '')),
            set: function (string $value) {
                $parts = preg_split('/\s+/', trim($value), 2);
                return [
                    'first_name' => $parts[0] ?? '',
                    'last_name'  => $parts[1] ?? '',
                ];
            },
        );
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles')
            ->withPivot('business_id', 'branch_id', 'tenant_id')
            ->withTimestamps();
    }

    public function otps(): HasMany
    {
        return $this->hasMany(UserOtp::class);
    }

    public function tenants(): BelongsToMany
    {
        return $this->belongsToMany(Tenant::class, 'tenant_users')
            ->withPivot('role', 'is_primary', 'status', 'joined_at')
            ->withTimestamps();
    }

    public function userRoles(): HasMany
    {
        return $this->hasMany(UserRole::class);
    }

    public function rolesForBusiness(int $businessId): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'user_roles')
            ->wherePivot('business_id', $businessId)
            ->withPivot('branch_id', 'tenant_id', 'assigned_at', 'expires_at')
            ->withTimestamps();
    }

    public function hasPermission(string $permissionSlug, int $businessId): bool
    {
        return $this->userRoles()
            ->where('business_id', $businessId)
            ->with('role.permissions')
            ->get()
            ->flatMap(fn ($ur) => $ur->role->permissions ?? collect())
            ->contains('slug', $permissionSlug);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
