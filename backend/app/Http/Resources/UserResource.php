<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                 => $this->id,
            'name'               => $this->name,
            'email'              => $this->email,
            'phone'              => $this->phone,
            'status'             => $this->status,
            'email_verified_at'  => $this->email_verified_at,
            'phone_verified_at'  => $this->phone_verified_at,
            'two_factor_enabled' => (bool) $this->two_factor_enabled,
            'last_login_at'      => $this->last_login_at,
            'roles'              => RoleResource::collection($this->whenLoaded('roles')),
            'tenants'            => $this->whenLoaded('tenants', fn () => $this->tenants->map(fn ($t) => [
                'id'         => $t->id,
                'name'       => $t->name,
                'slug'       => $t->slug,
                'role'       => $t->pivot->role,
                'is_primary' => (bool) $t->pivot->is_primary,
            ])->values()),
            'created_at'         => $this->created_at,
            'updated_at'         => $this->updated_at,
        ];
    }
}
