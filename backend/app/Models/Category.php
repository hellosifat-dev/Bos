<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    use BusinessScoped;

    protected $fillable = ['tenant_id', 'business_id', 'parent_id', 'name', 'description', 'status'];

    public function parent(): BelongsTo { return $this->belongsTo(Category::class, 'parent_id'); }
    public function products(): HasMany { return $this->hasMany(Product::class); }
}
