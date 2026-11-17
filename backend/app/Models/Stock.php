<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Stock extends Model
{
    use BusinessScoped;

    protected $fillable = ['tenant_id', 'business_id', 'product_id', 'warehouse_id', 'quantity'];

    protected function casts(): array
    {
        return ['quantity' => 'decimal:3'];
    }

    public function product(): BelongsTo { return $this->belongsTo(Product::class)->withTrashed(); }
    public function warehouse(): BelongsTo { return $this->belongsTo(Warehouse::class); }
}
