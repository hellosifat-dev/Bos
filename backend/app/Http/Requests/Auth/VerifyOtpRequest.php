<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class VerifyOtpRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email' => 'required_without:phone|email',
            'phone' => 'required_without:email|string',
            'code'  => 'required|string|size:6',
            'type'  => 'required|in:email_verification,phone_verification,password_reset,login',
        ];
    }
}
