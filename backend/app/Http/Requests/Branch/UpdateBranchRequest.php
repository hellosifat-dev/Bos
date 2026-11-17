<?php

namespace App\Http\Requests\Branch;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBranchRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'          => 'sometimes|string|max:255',
            'code'          => 'sometimes|string|max:50',
            'is_headquarters' => 'boolean',
            'city'          => 'nullable|string|max:120',
            'state'         => 'nullable|string|max:120',
            'country'       => 'nullable|string|max:120',
            'manager_id'    => 'nullable|exists:users,id',
            'phone'         => 'nullable|string',
            'email'         => 'nullable|email',
            'address'       => 'nullable|array',
            'status'        => 'in:active,inactive',
            'working_hours' => 'nullable|array',
        ];
    }
}
