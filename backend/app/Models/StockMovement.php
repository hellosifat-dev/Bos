<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    use BusinessScoped;

    protected $fillable = [
        'tenant_id', 'business_id', 'product_id', 'warehouse_id', 'type', 'quantity', 'balance_after',
        'unit_cost', 'reference_type', 'reference_id', 'note', 'user_id',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:3', 'balance_after' => 'decimal:3', 'unit_cost' => 'decimal:2'];
    }

    public function product(): BelongsTo { return $this->belongsTo(Product::class)->withTrashed(); }
    public function warehouse(): BelongsTo { return $this->belongsTo(Warehouse::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
