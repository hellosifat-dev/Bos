<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AuditLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'action'      => $this->action,
            'module'      => $this->module,
            'record_type' => $this->auditable_type,
            'record_id'   => $this->auditable_id,
            'description' => $this->description,
            'old_values'  => $this->old_values,
            'new_values'  => $this->new_values,
            'ip_address'  => $this->ip_address,
            'user_agent'  => $this->user_agent,
            'user'        => new UserResource($this->whenLoaded('user')),
            'created_at'  => $this->created_at,
        ];
    }
}
