<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBusinessRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'       => 'sometimes|string|max:255',
            'legal_name' => 'nullable|string|max:255',
            'email'      => 'sometimes|email',
            'phone'      => 'nullable|string',
            'address'    => 'nullable|array',
            'currency'   => 'sometimes|string|size:3',
            'timezone'   => 'sometimes|string',
            'language'   => 'nullable|string',
            'logo'       => 'nullable|string',
            'favicon'    => 'nullable|string',
            'settings'   => 'nullable|array',
        ];
    }
}
