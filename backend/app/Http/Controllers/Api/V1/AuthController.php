<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\VerifyEmailRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Models\UserSession;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(
        private AuthService $authService
    ) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        return response()->json([
            'success' => true,
            'message' => $result['message'],
            'data' => [
                'user' => new UserResource($result['user']),
            ],
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $deviceInfo = [
            'device_type' => $request->header('X-Device-Type', 'web'),
            'device_name' => $request->header('X-Device-Name'),
            'browser' => $request->header('X-Browser'),
            'platform' => $request->header('X-Platform'),
        ];

        $result = $this->authService->login($request->validated(), $deviceInfo);

        if (isset($result['requires_2fa'])) {
            return response()->json([
                'success' => true,
                'requires_2fa' => true,
                'temp_token' => $result['temp_token'],
                'user_id' => $result['user_id'],
                'message' => 'Two-factor authentication required.',
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'data' => [
                'user' => new UserResource($result['user']),
                'token' => $result['token'],
                'refresh_token' => $result['refresh_token'],
                'expires_at' => $result['expires_at'],
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->bearerToken();
        if ($token) {
            $this->authService->logout($request->user(), $token);
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }

    public function logoutAllDevices(Request $request): JsonResponse
    {
        $request->user()->sessions()->update(['is_active' => false]);

        return response()->json([
            'success' => true,
            'message' => 'Logged out from all devices.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => new UserResource($request->user()->load('tenants')),
        ]);
    }

    public function refreshToken(Request $request): JsonResponse
    {
        $request->validate(['refresh_token' => 'required|string']);

        $result = $this->authService->refreshToken($request->refresh_token);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function verifyEmail(VerifyEmailRequest $request): JsonResponse
    {
        $user = $this->authService->verifyEmail($request->user_id, $request->otp);

        return response()->json([
            'success' => true,
            'message' => 'Email verified successfully.',
            'data' => new UserResource($user),
        ]);
    }

    public function resendEmailVerification(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);
        $user = User::where('email', $request->email)->firstOrFail();
        $this->authService->sendEmailVerificationOtp($user);

        return response()->json([
            'success' => true,
            'message' => 'Verification email sent.',
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $this->authService->sendPasswordResetOtp($request->email);

        return response()->json([
            'success' => true,
            'message' => 'If that email exists, a reset code has been sent.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $this->authService->resetPassword(
            $request->email,
            $request->otp,
            $request->password
        );

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully. Please log in.',
        ]);
    }

    public function verifyTwoFactor(VerifyOtpRequest $request): JsonResponse
    {
        $deviceInfo = [
            'device_type' => $request->header('X-Device-Type', 'web'),
        ];

        $result = $this->authService->verifyTwoFactor(
            $request->user_id,
            $request->code,
            $deviceInfo
        );

        return response()->json([
            'success' => true,
            'message' => 'Two-factor verification successful.',
            'data' => [
                'user' => new UserResource($result['user']),
                'token' => $result['token'],
                'refresh_token' => $result['refresh_token'],
                'expires_at' => $result['expires_at'],
            ],
        ]);
    }

    public function activeSessions(Request $request): JsonResponse
    {
        $sessions = $request->user()
            ->sessions()
            ->where('is_active', true)
            ->orderByDesc('last_active_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $sessions,
        ]);
    }

    public function revokeSession(Request $request, int $sessionId): JsonResponse
    {
        UserSession::where('id', $sessionId)
            ->where('user_id', $request->user()->id)
            ->update(['is_active' => false]);

        return response()->json([
            'success' => true,
            'message' => 'Session revoked.',
        ]);
    }
}
