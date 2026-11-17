<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id', 'product_id', 'name', 'sku', 'quantity', 'returned_quantity', 'unit_price', 'unit_cost',
        'discount', 'tax_rate', 'tax_amount', 'line_total',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:3', 'returned_quantity' => 'decimal:3', 'unit_price' => 'decimal:2',
            'unit_cost' => 'decimal:2', 'discount' => 'decimal:2', 'tax_rate' => 'decimal:2',
            'tax_amount' => 'decimal:2', 'line_total' => 'decimal:2',
        ];
    }

    public function order(): BelongsTo { return $this->belongsTo(Order::class); }
    public function product(): BelongsTo { return $this->belongsTo(Product::class)->withTrashed(); }
}
