<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserOtp extends Model
{
    protected $fillable = [
        'user_id',
        'otp',
        'type',
        'identifier',
        'is_used',
        'attempts',
        'expires_at',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'is_used' => 'boolean',
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isValid(): bool
    {
        return !$this->is_used && $this->expires_at->isFuture() && $this->attempts < 5;
    }

    public function scopeUnused($query)
    {
        return $query->where('is_used', false)->where('expires_at', '>', now());
    }
}
