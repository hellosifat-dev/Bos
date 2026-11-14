<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSession extends Model
{
    protected $fillable = [
        'user_id',
        'token',
        'refresh_token',
        'device_type',
        'device_name',
        'browser',
        'platform',
        'ip_address',
        'user_agent',
        'location',
        'last_active_at',
        'expires_at',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'last_active_at' => 'datetime',
            'expires_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
