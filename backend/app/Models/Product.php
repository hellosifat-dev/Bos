<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use BusinessScoped, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'business_id', 'category_id', 'brand_id', 'unit_id', 'name', 'sku', 'barcode',
        'description', 'type', 'cost_price', 'sell_price', 'tax_rate', 'track_stock', 'reorder_level', 'status',
    ];

    protected function casts(): array
    {
        return [
            'cost_price'    => 'decimal:2',
            'sell_price'    => 'decimal:2',
            'tax_rate'      => 'decimal:2',
            'reorder_level' => 'decimal:3',
            'track_stock'   => 'boolean',
        ];
    }

    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
    public function brand(): BelongsTo { return $this->belongsTo(Brand::class); }
    public function unit(): BelongsTo { return $this->belongsTo(Unit::class); }
    public function stocks(): HasMany { return $this->hasMany(Stock::class); }
}
