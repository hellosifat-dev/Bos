<?php

namespace App\Http\Requests\Business;

use Illuminate\Foundation\Http\FormRequest;

class StoreBusinessRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'          => 'required|string|max:255',
            'legal_name'    => 'nullable|string|max:255',
            'business_type' => 'required|in:retail,ecommerce,wholesale,b2b,restaurant,service,manufacturing,corporate,multi_branch,subscription',
            'email'         => 'nullable|email',
            'phone'         => 'nullable|string',
            'address'       => 'nullable|array',
            'address.line1' => 'nullable|string|max:255',
            'address.line2' => 'nullable|string|max:255',
            'address.city'  => 'nullable|string|max:120',
            'address.state' => 'nullable|string|max:120',
            'address.postal_code' => 'nullable|string|max:20',
            'country'       => 'required|string|size:2',
            'currency'      => 'required|string|size:3',
            'timezone'      => 'required|string',
            'language'      => 'nullable|string',
        ];
    }
}
