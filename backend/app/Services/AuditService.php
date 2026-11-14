<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Business;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditService
{
    public function log(
        string $event,
        string $description = '',
        ?User $user = null,
        ?Business $business = null,
        ?Model $auditable = null,
        array $oldValues = [],
        array $newValues = [],
        array $metadata = [],
        string $severity = 'info'
    ): AuditLog {
        $currentUser = $user ?? auth()->user();
        $currentBusiness = $business ?? $this->resolveCurrentBusiness();

        [$module, $action] = $this->parseEvent($event);

        return AuditLog::create([
            'user_id' => $currentUser?->id,
            'tenant_id' => $currentUser ? $this->resolveTenantId($currentUser) : null,
            'business_id' => $currentBusiness?->id,
            'event' => $event,
            'auditable_type' => $auditable ? get_class($auditable) : null,
            'auditable_id' => $auditable?->id,
            'module' => $module,
            'action' => $action,
            'description' => $description,
            'old_values' => !empty($oldValues) ? $oldValues : null,
            'new_values' => !empty($newValues) ? $newValues : null,
            'metadata' => !empty($metadata) ? $metadata : null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'url' => request()->fullUrl(),
            'method' => request()->method(),
            'severity' => $severity,
        ]);
    }

    public function logModelChange(
        Model $model,
        string $action,
        array $oldValues = [],
        array $newValues = [],
        ?User $user = null
    ): AuditLog {
        $modelName = class_basename($model);
        $event = strtolower("{$modelName}.{$action}");

        return $this->log(
            event: $event,
            description: "{$modelName} {$action}: ID {$model->id}",
            user: $user,
            auditable: $model,
            oldValues: $oldValues,
            newValues: $newValues
        );
    }

    public function getForBusiness(int $businessId, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $query = AuditLog::where('business_id', $businessId)
            ->with('user')
            ->orderByDesc('created_at');

        if (!empty($filters['module'])) {
            $query->where('module', $filters['module']);
        }

        if (!empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (!empty($filters['severity'])) {
            $query->where('severity', $filters['severity']);
        }

        if (!empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }

        if (!empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }

        return $query->paginate($filters['per_page'] ?? 25);
    }

    private function parseEvent(string $event): array
    {
        $parts = explode('.', $event);
        return [
            $parts[0] ?? 'system',
            $parts[1] ?? 'action',
        ];
    }

    private function resolveCurrentBusiness(): ?Business
    {
        $businessId = request()->header('X-Business-ID');
        if ($businessId) {
            return Business::find($businessId);
        }
        return null;
    }

    private function resolveTenantId(User $user): ?int
    {
        $tenantId = request()->header('X-Tenant-ID');
        if ($tenantId) {
            return (int) $tenantId;
        }
        return $user->tenants()->first()?->id;
    }
}
