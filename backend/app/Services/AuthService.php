<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserOtp;
use App\Models\UserSession;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function __construct(
        private AuditService $auditService
    ) {}

    public function register(array $data): array
    {
        $user = User::create([
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => $data['password'],
            'status' => 'pending',
            'timezone' => $data['timezone'] ?? 'UTC',
            'locale' => $data['locale'] ?? 'en',
        ]);

        $this->sendEmailVerificationOtp($user);

        $this->auditService->log(
            event: 'user.registered',
            description: "New user registered: {$user->email}",
            user: $user
        );

        return [
            'user' => $user,
            'message' => 'Registration successful. Please verify your email.',
        ];
    }

    public function login(array $credentials, array $deviceInfo = []): array
    {
        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            $this->auditService->log(
                event: 'auth.login_failed',
                description: "Failed login attempt for: {$credentials['email']}",
                severity: 'warning'
            );
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->status === 'suspended') {
            throw ValidationException::withMessages([
                'email' => ['Your account has been suspended. Please contact support.'],
            ]);
        }

        if ($user->status === 'inactive') {
            throw ValidationException::withMessages([
                'email' => ['Your account is inactive. Please contact support.'],
            ]);
        }

        if ($user->two_factor_enabled) {
            $tempToken = $this->generateTwoFactorToken($user);
            return [
                'requires_2fa' => true,
                'temp_token' => $tempToken,
                'user_id' => $user->id,
            ];
        }

        return $this->createSession($user, $deviceInfo);
    }

    public function verifyTwoFactor(int $userId, string $code, array $deviceInfo = []): array
    {
        $user = User::findOrFail($userId);

        $otp = $user->otps()
            ->where('type', 'two_factor')
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (!$otp || $otp->otp !== $code) {
            if ($otp) {
                $otp->increment('attempts');
            }
            throw ValidationException::withMessages([
                'code' => ['Invalid or expired two-factor code.'],
            ]);
        }

        $otp->update(['is_used' => true, 'used_at' => now()]);

        return $this->createSession($user, $deviceInfo);
    }

    public function logout(User $user, string $token): void
    {
        UserSession::where('token', $token)->update(['is_active' => false]);

        $this->auditService->log(
            event: 'auth.logout',
            description: "User logged out: {$user->email}",
            user: $user
        );
    }

    public function sendEmailVerificationOtp(User $user): UserOtp
    {
        $user->otps()->where('type', 'email_verification')->whereNull('used_at')->update(['is_used' => true]);

        $otp = $user->otps()->create([
            'otp' => $this->generateOtp(),
            'type' => 'email_verification',
            'identifier' => $user->email,
            'expires_at' => now()->addMinutes(15),
        ]);

        // In production, dispatch a mail job here
        // Mail::to($user->email)->send(new EmailVerificationMail($otp->otp));

        return $otp;
    }

    public function verifyEmail(int $userId, string $code): User
    {
        $user = User::findOrFail($userId);

        $otp = $user->otps()
            ->where('type', 'email_verification')
            ->where('is_used', false)
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (!$otp || $otp->otp !== $code) {
            if ($otp) {
                $otp->increment('attempts');
            }
            throw ValidationException::withMessages([
                'otp' => ['Invalid or expired verification code.'],
            ]);
        }

        $otp->update(['is_used' => true, 'used_at' => now()]);

        $user->update([
            'email_verified' => true,
            'email_verified_at' => now(),
            'status' => 'active',
        ]);

        $this->auditService->log(
            event: 'user.email_verified',
            description: "Email verified for: {$user->email}",
            user: $user
        );

        return $user;
    }

    public function sendPasswordResetOtp(string $email): void
    {
        $user = User::where('email', $email)->first();

        if (!$user) {
            return; // Silent fail for security
        }

        $user->otps()->where('type', 'password_reset')->whereNull('used_at')->update(['is_used' => true]);

        $otp = $user->otps()->create([
            'otp' => $this->generateOtp(),
            'type' => 'password_reset',
            'identifier' => $email,
            'expires_at' => now()->addMinutes(15),
        ]);

        // Mail::to($user->email)->send(new PasswordResetMail($otp->otp));
    }

    public function resetPassword(string $email, string $code, string $password): void
    {
        $user = User::where('email', $email)->firstOrFail();

        $otp = $user->otps()
            ->where('type', 'password_reset')
            ->where('is_used', false)
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (!$otp || $otp->otp !== $code) {
            if ($otp) {
                $otp->increment('attempts');
            }
            throw ValidationException::withMessages([
                'otp' => ['Invalid or expired reset code.'],
            ]);
        }

        $otp->update(['is_used' => true, 'used_at' => now()]);
        $user->update(['password' => $password]);

        // Invalidate all sessions
        $user->sessions()->update(['is_active' => false]);

        $this->auditService->log(
            event: 'auth.password_reset',
            description: "Password reset for: {$user->email}",
            user: $user,
            severity: 'warning'
        );
    }

    private function createSession(User $user, array $deviceInfo = []): array
    {
        $token = Str::random(80);
        $refreshToken = Str::random(80);

        $session = UserSession::create([
            'user_id' => $user->id,
            'token' => $token,
            'refresh_token' => $refreshToken,
            'device_type' => $deviceInfo['device_type'] ?? null,
            'device_name' => $deviceInfo['device_name'] ?? null,
            'browser' => $deviceInfo['browser'] ?? null,
            'platform' => $deviceInfo['platform'] ?? null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'last_active_at' => now(),
            'expires_at' => now()->addDays(30),
            'is_active' => true,
        ]);

        $user->update([
            'last_login_at' => now(),
            'last_login_ip' => request()->ip(),
        ]);

        $this->auditService->log(
            event: 'auth.login',
            description: "User logged in: {$user->email}",
            user: $user
        );

        return [
            'user' => $user,
            'token' => $token,
            'refresh_token' => $refreshToken,
            'expires_at' => $session->expires_at,
        ];
    }

    private function generateOtp(int $length = 6): string
    {
        return str_pad((string) random_int(0, 999999), $length, '0', STR_PAD_LEFT);
    }

    private function generateTwoFactorToken(User $user): string
    {
        $otp = $user->otps()->create([
            'otp' => $this->generateOtp(),
            'type' => 'two_factor',
            'expires_at' => now()->addMinutes(5),
        ]);

        // Send OTP via email or SMS
        return Str::random(40);
    }

    public function refreshToken(string $refreshToken): array
    {
        $session = UserSession::where('refresh_token', $refreshToken)
            ->where('is_active', true)
            ->first();

        if (!$session || $session->isExpired()) {
            throw ValidationException::withMessages([
                'refresh_token' => ['Invalid or expired refresh token.'],
            ]);
        }

        $newToken = Str::random(80);
        $newRefreshToken = Str::random(80);

        $session->update([
            'token' => $newToken,
            'refresh_token' => $newRefreshToken,
            'last_active_at' => now(),
            'expires_at' => now()->addDays(30),
        ]);

        return [
            'token' => $newToken,
            'refresh_token' => $newRefreshToken,
            'expires_at' => $session->expires_at,
        ];
    }
}
