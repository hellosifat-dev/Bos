<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\TenantService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Create a verified owner account (with its organisation) from the server shell —
 * useful for the first login before outgoing email is configured.
 */
class CreateOwner extends Command
{
    protected $signature = 'bos:create-owner {email} {name} {--password= : Leave empty to generate one}';
    protected $description = 'Create a verified owner account and organisation';

    public function handle(TenantService $tenants): int
    {
        $email = strtolower($this->argument('email'));
        if (User::where('email', $email)->exists()) {
            $this->error("A user with {$email} already exists.");
            return self::FAILURE;
        }

        $password = $this->option('password') ?: Str::password(16, symbols: false);

        DB::transaction(function () use ($email, $password, $tenants) {
            $user = User::create([
                'name'              => $this->argument('name'),
                'email'             => $email,
                'password'          => $password,
                'status'            => 'active',
                'email_verified'    => true,
                'email_verified_at' => now(),
            ]);
            $tenants->create(['name' => $this->argument('name') . "'s Organization"], $user);
        });

        $this->info("Owner created: {$email}");
        if (!$this->option('password')) {
            $this->line("Password: {$password}");
        }

        return self::SUCCESS;
    }
}
