<?php

namespace App\Models;

use App\Models\Concerns\BusinessScoped;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class JournalEntry extends Model
{
    use BusinessScoped;

    protected $fillable = [
        'tenant_id', 'business_id', 'sequence', 'number', 'date', 'reference', 'description',
        'source_type', 'source_id', 'total', 'created_by',
    ];

    protected function casts(): array
    {
        return ['date' => 'date:Y-m-d', 'total' => 'decimal:2'];
    }

    public function lines(): HasMany { return $this->hasMany(JournalLine::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
}
