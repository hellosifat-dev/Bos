<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserOtp;
use App\Support\Totp;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthService
{
    public const PENDING_2FA = '2fa-pending';

    public function __construct(
        private AuditService $audit,
        private TenantService $tenants,
    ) {}

    /** Create a user, their tenant (organisation) and send a verification code. */
    public function register(array $data): User
    {
        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name'     => $data['name'],
                'email'    => $data['email'],
                'phone'    => $data['phone'] ?? null,
                'password' => $data['password'],
                'status'   => 'pending',
            ]);

            // Without email verification the account is usable immediately.
            if (!config('bos.require_email_verification')) {
                $user->update(['status' => 'active', 'email_verified' => true, 'email_verified_at' => now()]);
            }

            $this->tenants->create(['name' => $data['name'] . "'s Organization"], $user);

            return $user;
        });

        if ($user->status === 'pending') {
            $this->sendOtp($user, 'email_verification');
        }
        $this->audit->log('user.registered', "New user registered: {$user->email}", $user);

        return $user;
    }

    /**
     * @return array{user: User, token: ?string, requires_2fa?: bool, requires_otp?: bool}
     */
    public function login(array $credentials): array
    {
        $user = isset($credentials['email'])
            ? User::where('email', $credentials['email'])->first()
            : User::where('phone', $credentials['phone'] ?? null)->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            $this->audit->log('auth.login_failed', 'Failed login attempt', null, severity: 'warning');
            throw ValidationException::withMessages(['email' => ['The provided credentials are incorrect.']]);
        }

        if (in_array($user->status, ['suspended', 'inactive'], true)) {
            throw ValidationException::withMessages([
                'email' => ["Your account is {$user->status}. Please contact support."],
            ]);
        }

        if ($user->status === 'pending') {
            $this->sendOtp($user, 'email_verification');
            return ['user' => $user, 'token' => null, 'requires_otp' => true];
        }

        if ($user->two_factor_enabled) {
            $token = $user->createToken('2fa-challenge', [self::PENDING_2FA], now()->addMinutes(10))->plainTextToken;
            return ['user' => $user, 'token' => $token, 'requires_2fa' => true];
        }

        return ['user' => $user, 'token' => $this->startSession($user)];
    }

    public function logout(User $user): void
    {
        $user->currentAccessToken()?->delete();
        $this->audit->log('auth.logout', "User logged out: {$user->email}", $user);
    }

    public function refresh(User $user): string
    {
        $user->currentAccessToken()?->delete();
        return $user->createToken('web', ['*'])->plainTextToken;
    }

    // ── OTP ─────────────────────────────────────────────────────────────────

    public function sendOtp(User $user, string $type): void
    {
        $user->otps()->where('type', $type)->where('is_used', false)->update(['is_used' => true]);

        $otp = $user->otps()->create([
            'otp'        => str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT),
            'type'       => $type,
            'identifier' => $type === 'phone_verification' ? $user->phone : $user->email,
            'expires_at' => now()->addMinutes(15),
        ]);

        // Delivered through the configured mailer (MAIL_MAILER=log writes it to the log in dev).
        try {
            Mail::raw("Your BOS verification code is {$otp->otp}. It expires in 15 minutes.", function ($m) use ($user) {
                $m->to($user->email)->subject('Your BOS verification code');
            });
        } catch (\Throwable $e) {
            Log::warning('OTP mail failed: ' . $e->getMessage());
        }
    }

    /** Verify a code; returns the user, activating them for email_verification. */
    public function verifyOtp(User $user, string $type, string $code): User
    {
        $otp = $user->otps()
            ->where('type', $type)
            ->where('is_used', false)
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();

        if (!$otp || $otp->attempts >= 5) {
            throw ValidationException::withMessages(['code' => ['Invalid or expired code.']]);
        }

        if (!hash_equals($otp->otp, $code)) {
            $otp->increment('attempts');
            throw ValidationException::withMessages(['code' => ['Invalid or expired code.']]);
        }

        $otp->update(['is_used' => true, 'used_at' => now()]);

        if ($type === 'email_verification') {
            $user->update([
                'email_verified'    => true,
                'email_verified_at' => now(),
                'status'            => $user->status === 'pending' ? 'active' : $user->status,
            ]);
            $this->audit->log('user.email_verified', "Email verified: {$user->email}", $user);
        } elseif ($type === 'phone_verification') {
            $user->update(['phone_verified' => true, 'phone_verified_at' => now()]);
        }

        return $user->fresh();
    }

    // ── Two-factor (TOTP) ───────────────────────────────────────────────────

    /** Generate a secret; 2FA only becomes active once a code is verified. */
    public function beginTwoFactor(User $user): array
    {
        $secret = Totp::generateSecret();
        $user->update(['two_factor_secret' => encrypt($secret)]);

        return [
            'secret' => $secret,
            'qr_url' => Totp::uri($secret, $user->email, config('app.name', 'BOS')),
        ];
    }

    private function twoFactorSecret(User $user): ?string
    {
        return $user->two_factor_secret ? decrypt($user->two_factor_secret) : null;
    }

    /**
     * Confirm a TOTP code. For a login challenge token this completes the login;
     * for a full session it activates 2FA.
     */
    public function verifyTwoFactor(User $user, string $code): ?string
    {
        $secret = $this->twoFactorSecret($user);
        if (!$secret || !Totp::verify($secret, $code)) {
            throw ValidationException::withMessages(['code' => ['Invalid authentication code.']]);
        }

        $token = $user->currentAccessToken();
        if ($token instanceof PersonalAccessToken && in_array(self::PENDING_2FA, $token->abilities ?? [], true)) {
            $token->delete();
            return $this->startSession($user);
        }

        $user->update(['two_factor_enabled' => true]);
        $this->audit->log('auth.2fa_enabled', "2FA enabled: {$user->email}", $user, severity: 'warning');

        return null;
    }

    public function disableTwoFactor(User $user, string $code): void
    {
        $secret = $this->twoFactorSecret($user);
        if (!$secret || !Totp::verify($secret, $code)) {
            throw ValidationException::withMessages(['code' => ['Invalid authentication code.']]);
        }
        $user->update(['two_factor_enabled' => false, 'two_factor_secret' => null]);
        $this->audit->log('auth.2fa_disabled', "2FA disabled: {$user->email}", $user, severity: 'warning');
    }

    private function startSession(User $user): string
    {
        $user->update(['last_login_at' => now(), 'last_login_ip' => request()->ip()]);
        $this->audit->log('auth.login', "User logged in: {$user->email}", $user);

        return $user->createToken('web', ['*'])->plainTextToken;
    }
}
