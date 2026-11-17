<?php

namespace App\Http\Requests\Branch;

use Illuminate\Foundation\Http\FormRequest;

class StoreBranchRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'             => 'required|string|max:255',
            'code'             => 'required|string|max:50',
            'manager_id'       => 'nullable|exists:users,id',
            'phone'            => 'nullable|string',
            'email'            => 'nullable|email',
            'address'          => 'nullable|array',
            'city'             => 'nullable|string|max:120',
            'state'            => 'nullable|string|max:120',
            'country'          => 'nullable|string|max:120',
            'is_headquarters'  => 'boolean',
            'status'           => 'in:active,inactive',
            'working_hours'    => 'nullable|array',
        ];
    }
}
