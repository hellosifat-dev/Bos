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
            'email'         => 'required|email',
            'phone'         => 'nullable|string',
            'address'       => 'nullable|array',
            'country'       => 'required|string|size:2',
            'currency'      => 'required|string|size:3',
            'timezone'      => 'required|string',
            'language'      => 'nullable|string',
            'plan'          => 'nullable|in:starter,business,professional,enterprise',
        ];
    }
}
