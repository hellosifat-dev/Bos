<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use BusinessScoped, SoftDeletes;

    protected $fillable = ['tenant_id', 'business_id', 'name', 'email', 'phone', 'address', 'tax_number', 'notes', 'status'];

    public function orders(): HasMany { return $this->hasMany(Order::class); }
}
