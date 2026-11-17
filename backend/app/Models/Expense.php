<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    use BusinessScoped;

    protected $fillable = [
        'tenant_id', 'business_id', 'branch_id', 'date', 'account_id', 'payment_account_id', 'amount', 'payee',
        'reference', 'description', 'status', 'created_by', 'approved_by', 'approved_at',
    ];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'amount' => 'decimal:2', 'approved_at' => 'datetime'];
    }

    public function account(): BelongsTo { return $this->belongsTo(Account::class); }
    public function paymentAccount(): BelongsTo { return $this->belongsTo(Account::class, 'payment_account_id'); }
    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}
