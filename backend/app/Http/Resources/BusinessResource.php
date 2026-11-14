<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BusinessResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'                  => $this->id,
            'name'                => $this->name,
            'legal_name'          => $this->legal_name,
            'slug'                => $this->slug,
            'business_type'       => $this->business_type,
            'email'               => $this->email,
            'phone'               => $this->phone,
            'address'             => $this->address,
            'country'             => $this->country,
            'currency'            => $this->currency,
            'timezone'            => $this->timezone,
            'language'            => $this->language,
            'logo'                => $this->logo,
            'favicon'             => $this->favicon,
            'status'              => $this->status,
            'setup_completed_at'  => $this->setup_completed_at,
            'setup_progress'      => $this->when(isset($this->setup_progress), $this->setup_progress),
            'branches_count'      => $this->when(isset($this->branches_count), $this->branches_count),
            'owner'               => new UserResource($this->whenLoaded('owner')),
            'branches'            => BranchResource::collection($this->whenLoaded('branches')),
            'created_at'          => $this->created_at,
            'updated_at'          => $this->updated_at,
        ];
    }
}
