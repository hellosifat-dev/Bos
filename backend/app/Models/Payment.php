<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use BusinessScoped;

    protected $fillable = ['tenant_id', 'business_id', 'order_id', 'type', 'amount', 'method', 'reference', 'paid_at', 'received_by'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'paid_at' => 'datetime'];
    }

    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function receiver(): BelongsTo { return $this->belongsTo(User::class, 'received_by'); }
}
