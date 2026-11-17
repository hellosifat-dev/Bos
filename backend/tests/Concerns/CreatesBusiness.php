<?php

namespace Tests\Concerns;

use App\Models\User;

trait CreatesBusiness
{
    /** Register + verify an owner, create a business; returns request headers. */
    protected function ownerWithBusiness(string $email = 'owner@example.com'): array
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Owner Person', 'email' => $email,
            'password' => 'secret-pass-1', 'password_confirmation' => 'secret-pass-1',
        ])->assertCreated();

        $user = User::where('email', $email)->first();
        $code = $user->otps()->where('type', 'email_verification')->latest('id')->value('otp');
        $res  = $this->postJson('/api/v1/auth/verify-otp', ['email' => $email, 'code' => $code, 'type' => 'email_verification']);

        $token  = $res->json('data.token');
        $tenant = $res->json('data.user.tenants.0.id');

        $business = $this->postJson('/api/v1/businesses', [
            'name' => 'Shop ' . $email, 'business_type' => 'retail',
            'country' => 'US', 'currency' => 'USD', 'timezone' => 'UTC',
        ], ['Authorization' => "Bearer {$token}", 'X-Tenant-ID' => $tenant])->assertCreated()->json('data.id');

        return [
            'Authorization' => "Bearer {$token}",
            'X-Tenant-ID'   => $tenant,
            'X-Business-ID' => $business,
        ];
    }
}
