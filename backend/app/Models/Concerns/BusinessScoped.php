<?php

namespace App\Models\Concerns;

use App\Models\Business;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Rows owned by a business. When a business context is active (set by
 * BusinessMiddleware) queries are automatically scoped to it and new rows
 * inherit its tenant_id / business_id.
 */
trait BusinessScoped
{
    public static function bootBusinessScoped(): void
    {
        static::addGlobalScope('business', function (Builder $query) {
            if ($business = static::currentBusiness()) {
                $query->where($query->getModel()->getTable() . '.business_id', $business->id);
            }
        });

        static::creating(function ($model) {
            if ($business = static::currentBusiness()) {
                $model->business_id ??= $business->id;
                $model->tenant_id   ??= $business->tenant_id;
            }
        });
    }

    protected static function currentBusiness(): ?Business
    {
        return app()->bound('current_business') ? app('current_business') : null;
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }
}
