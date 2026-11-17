<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\VerifyOtpRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuthService;
use App\Services\PermissionService;
use App\Services\SetupService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function __construct(
        private AuthService $auth,
        private PermissionService $permissions,
    ) {}

    private function userPayload(User $user): UserResource
    {
        return new UserResource($user->load('tenants'));
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $user = $this->auth->register($request->validated());
        $active = $user->status === 'active';

        return response()->json([
            'success' => true,
            'message' => $active ? 'Registration successful.' : 'Registration successful. Please verify your email.',
            'data'    => [
                'user'         => $this->userPayload($user),
                'token'        => $active ? $user->createToken('web', ['*'])->plainTextToken : null,
                'requires_otp' => !$active,
            ],
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        // First-run self-healing: seed permissions and create the BOS_OWNER_* account if needed.
        app(SetupService::class)->bootstrap();

        $result = $this->auth->login($request->validated());

        return response()->json([
            'success' => true,
            'message' => isset($result['requires_otp']) ? 'Please verify your email to continue.' : 'Login successful.',
            'data'    => [
                'user'         => $this->userPayload($result['user']),
                'token'        => $result['token'],
                'requires_2fa' => $result['requires_2fa'] ?? false,
                'requires_otp' => $result['requires_otp'] ?? false,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout($request->user());

        return response()->json(['success' => true, 'message' => 'Logged out successfully.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $this->userPayload($user)->resolve();

        // When a business context is supplied, include the effective permission list.
        $businessId = $request->header('X-Business-ID');
        if ($businessId) {
            $data['permissions'] = $this->permissions->getUserPermissions($user, (int) $businessId)->values();
        }

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function refresh(Request $request): JsonResponse
    {
        $token = $this->auth->refresh($request->user());

        return response()->json(['success' => true, 'data' => ['token' => $token]]);
    }

    // ── OTP ─────────────────────────────────────────────────────────────────

    public function sendOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required_without:phone|nullable|email',
            'phone' => 'required_without:email|nullable|string',
            'type'  => 'required|in:email_verification,phone_verification',
        ]);

        $user = isset($data['email'])
            ? User::where('email', $data['email'])->first()
            : User::where('phone', $data['phone'])->first();

        // Do not reveal whether the account exists.
        if ($user) {
            $this->auth->sendOtp($user, $data['type']);
        }

        return response()->json(['success' => true, 'message' => 'If the account exists, a code has been sent.']);
    }

    public function verifyOtp(VerifyOtpRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = isset($data['email'])
            ? User::where('email', $data['email'])->first()
            : User::where('phone', $data['phone'])->first();

        if (!$user) {
            throw ValidationException::withMessages(['code' => ['Invalid or expired code.']]);
        }

        $user = $this->auth->verifyOtp($user, $data['type'], $data['code']);

        $token = null;
        if ($data['type'] === 'email_verification' && $user->status === 'active' && !$user->two_factor_enabled) {
            $token = $user->createToken('web', ['*'])->plainTextToken;
        }

        return response()->json([
            'success' => true,
            'message' => 'Verified successfully.',
            'data'    => ['user' => $this->userPayload($user), 'token' => $token],
        ]);
    }

    // ── Password reset (Laravel broker) ─────────────────────────────────────

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        Password::sendResetLink($request->only('email'));

        return response()->json([
            'success' => true,
            'message' => 'If that email exists, a reset link has been sent.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                $user->tokens()->delete();
                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => [__($status)]]);
        }

        return response()->json(['success' => true, 'message' => 'Password reset successfully. Please log in.']);
    }

    // ── Two-factor ──────────────────────────────────────────────────────────

    public function enable2FA(Request $request): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->auth->beginTwoFactor($request->user())]);
    }

    public function verify2FA(Request $request): JsonResponse
    {
        $data  = $request->validate(['code' => 'required|string']);
        $user  = $request->user();
        $token = $this->auth->verifyTwoFactor($user, $data['code']);

        return response()->json([
            'success' => true,
            'message' => $token ? 'Login successful.' : 'Two-factor authentication enabled.',
            'data'    => ['user' => $this->userPayload($user->fresh()), 'token' => $token],
        ]);
    }

    public function disable2FA(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => 'required|string']);
        $this->auth->disableTwoFactor($request->user(), $data['code']);

        return response()->json(['success' => true, 'message' => 'Two-factor authentication disabled.']);
    }

    // ── Sessions (API tokens) ───────────────────────────────────────────────

    public function sessions(Request $request): JsonResponse
    {
        $currentId = $request->user()->currentAccessToken()?->id;

        $sessions = $request->user()->tokens()
            ->orderByDesc('last_used_at')
            ->get()
            ->map(fn (PersonalAccessToken $t) => [
                'id'           => $t->id,
                'name'         => $t->name,
                'last_used_at' => $t->last_used_at,
                'created_at'   => $t->created_at,
                'current'      => $t->id === $currentId,
            ]);

        return response()->json(['success' => true, 'data' => $sessions]);
    }

    public function revokeSession(Request $request, int $id): JsonResponse
    {
        $request->user()->tokens()->where('id', $id)->delete();

        return response()->json(['success' => true, 'message' => 'Session revoked.']);
    }
}
