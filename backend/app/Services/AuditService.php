<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Business;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditService
{
    /**
     * Record a CRUD-style action against a module record.
     * e.g. record('create', 'branches', $branch->id, null, $data)
     */
    public function record(
        string $action,
        string $module,
        int|string|null $recordId = null,
        ?array $old = null,
        ?array $new = null,
    ): AuditLog {
        $user = auth()->user();

        return AuditLog::create([
            'user_id'        => $user?->id,
            'tenant_id'      => $this->tenantId($user),
            'business_id'    => $this->businessId(),
            'branch_id'      => request()->header('X-Branch-ID') ?: null,
            'event'          => "{$module}.{$action}",
            'auditable_type' => $module,
            'auditable_id'   => $recordId,
            'module'         => $module,
            'action'         => $action,
            'description'    => ucfirst(str_replace('_', ' ', $action)) . " {$module}" . ($recordId ? " #{$recordId}" : ''),
            'old_values'     => $this->scrub($old),
            'new_values'     => $this->scrub($new),
            'ip_address'     => request()->ip(),
            'user_agent'     => request()->userAgent(),
            'url'            => request()->fullUrl(),
            'method'         => request()->method(),
            'severity'       => 'info',
        ]);
    }

    /**
     * Record a free-form event ("module.action").
     */
    public function log(
        string $event,
        string $description = '',
        ?User $user = null,
        ?Business $business = null,
        ?Model $auditable = null,
        array $oldValues = [],
        array $newValues = [],
        array $metadata = [],
        string $severity = 'info',
    ): AuditLog {
        $actor = $user ?? auth()->user();
        [$module, $action] = array_pad(explode('.', $event, 2), 2, 'action');

        return AuditLog::create([
            'user_id'        => $actor?->id,
            'tenant_id'      => $this->tenantId($actor) ?? $business?->tenant_id,
            'business_id'    => $business?->id ?? $this->businessId(),
            'event'          => $event,
            'auditable_type' => $auditable ? $auditable::class : null,
            'auditable_id'   => $auditable?->getKey(),
            'module'         => $module,
            'action'         => $action,
            'description'    => $description,
            'old_values'     => $this->scrub($oldValues ?: null),
            'new_values'     => $this->scrub($newValues ?: null),
            'metadata'       => $metadata ?: null,
            'ip_address'     => request()->ip(),
            'user_agent'     => request()->userAgent(),
            'url'            => request()->fullUrl(),
            'method'         => request()->method(),
            'severity'       => $severity,
        ]);
    }

    private function scrub(?array $values): ?array
    {
        if (!$values) {
            return null;
        }
        foreach (['password', 'password_confirmation', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'] as $key) {
            unset($values[$key]);
        }
        return $values ?: null;
    }

    private function tenantId(?User $user): ?int
    {
        $header = request()->header('X-Tenant-ID');
        if ($header && $user && $user->tenants()->where('tenants.id', $header)->exists()) {
            return (int) $header;
        }
        return $user?->tenants()->value('tenants.id');
    }

    private function businessId(): ?int
    {
        $header = request()->header('X-Business-ID');
        return $header && Business::whereKey($header)->exists() ? (int) $header : null;
    }
}
