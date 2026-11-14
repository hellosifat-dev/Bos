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
            'manager_id'    => 'nullable|exists:users,id',
            'phone'         => 'nullable|string',
            'email'         => 'nullable|email',
            'address'       => 'nullable|array',
            'status'        => 'in:active,inactive',
            'working_hours' => 'nullable|array',
        ];
    }
}
