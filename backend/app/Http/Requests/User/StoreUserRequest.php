<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'            => 'required|string|max:255',
            'email'           => 'required|email|unique:users,email',
            'phone'           => 'nullable|string|unique:users,phone',
            'password'        => 'required|string|min:8',
            'role_id'         => 'nullable|exists:roles,id',
            'branch_id'       => 'nullable|exists:branches,id',
            'department_id'   => 'nullable|exists:departments,id',
            'send_invitation' => 'boolean',
        ];
    }
}
