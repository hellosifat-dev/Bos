<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BranchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'               => $this->id,
            'name'             => $this->name,
            'code'             => $this->code,
            'phone'            => $this->phone,
            'email'            => $this->email,
            'address'          => $this->address,
            'is_active'        => $this->status === 'active',
            'is_headquarters'  => $this->is_headquarters,
            'status'           => $this->status,
            'working_hours'    => $this->working_hours,
            'manager'          => new UserResource($this->whenLoaded('manager')),
            'employees_count'  => $this->when(isset($this->employees_count), $this->employees_count),
            'created_at'       => $this->created_at,
            'updated_at'       => $this->updated_at,
        ];
    }
}
