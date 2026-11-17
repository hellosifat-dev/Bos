<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Unit extends Model
{
    use BusinessScoped;

    protected $fillable = ['tenant_id', 'business_id', 'name', 'short_name'];

    public function products(): HasMany { return $this->hasMany(Product::class); }
}
