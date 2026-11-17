<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use BusinessScoped;

    protected $fillable = [
        'tenant_id', 'business_id', 'sequence', 'number', 'customer_id', 'branch_id', 'warehouse_id', 'channel',
        'status', 'payment_status', 'subtotal', 'discount_total', 'tax_total', 'total', 'paid_total',
        'refunded_total', 'returned_total', 'notes', 'created_by', 'completed_at',
    ];

    protected $appends = ['balance_due'];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2', 'discount_total' => 'decimal:2', 'tax_total' => 'decimal:2',
            'total' => 'decimal:2', 'paid_total' => 'decimal:2', 'refunded_total' => 'decimal:2', 'returned_total' => 'decimal:2',
            'completed_at' => 'datetime',
        ];
    }

    public function getBalanceDueAttribute(): float
    {
        if ($this->status === 'cancelled') {
            return 0.0;
        }
        return round(max($this->netTotal() - $this->netPaid(), 0), 2);
    }

    /** Order value after returns. */
    public function netTotal(): float
    {
        return round((float) $this->total - (float) $this->returned_total, 2);
    }

    public function netPaid(): float
    {
        return round((float) $this->paid_total - (float) $this->refunded_total, 2);
    }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class)->withTrashed(); }
    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
    public function warehouse(): BelongsTo { return $this->belongsTo(Warehouse::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function items(): HasMany { return $this->hasMany(OrderItem::class); }
    public function payments(): HasMany { return $this->hasMany(Payment::class); }
}
