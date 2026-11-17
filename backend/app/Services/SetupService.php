<?php

namespace App\Services;

use App\Models\Permission;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Self-healing first-run setup so the app works on hosts that only run
 * migrations (or let you set environment variables but give no shell).
 */
class SetupService
{
    public function __construct(private TenantService $tenants) {}

    /** Seed permissions and system roles if they are missing. */
    public function ensureSeeded(): void
    {
        if (!Permission::query()->exists()) {
            Artisan::call('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true]);
        }
    }

    /** Create a verified owner (and organisation) for the given credentials if absent. */
    public function createOwner(string $email, string $password, string $name): ?User
    {
        $email = strtolower(trim($email));
        if (User::where('email', $email)->exists()) {
            return null;
        }

        return DB::transaction(function () use ($email, $password, $name) {
            $user = User::create([
                'name'              => $name,
                'email'             => $email,
                'password'          => $password,
                'status'            => 'active',
                'email_verified'    => true,
                'email_verified_at' => now(),
            ]);
            $this->tenants->create(['name' => "{$name}'s Organization"], $user);

            return $user;
        });
    }

    /** Owner from BOS_OWNER_EMAIL / BOS_OWNER_PASSWORD, if configured. */
    public function ensureOwnerFromEnv(): ?User
    {
        $email    = config('bos.owner.email');
        $password = config('bos.owner.password');
        if (!$email || !$password) {
            return null;
        }

        return $this->createOwner($email, $password, config('bos.owner.name') ?: 'Owner');
    }

    /** Best-effort: never let setup problems block a login request. */
    public function bootstrap(): void
    {
        try {
            $this->ensureSeeded();
            $this->ensureOwnerFromEnv();
        } catch (\Throwable $e) {
            Log::warning('BOS bootstrap skipped: ' . $e->getMessage());
        }
    }
}
