<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Account extends Model
{
    use BusinessScoped;

    protected $fillable = ['tenant_id', 'business_id', 'parent_id', 'code', 'name', 'type', 'system_key', 'description', 'status'];

    /** Debit-normal account types increase with debits. */
    public function isDebitNormal(): bool
    {
        return in_array($this->type, ['asset', 'expense'], true);
    }

    public function parent(): BelongsTo { return $this->belongsTo(Account::class, 'parent_id'); }
    public function lines(): HasMany { return $this->hasMany(JournalLine::class); }
}
