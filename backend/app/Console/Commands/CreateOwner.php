<?php

namespace App\Console\Commands;

use App\Services\SetupService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/**
 * Create a verified owner account (with its organisation) from the server shell —
 * useful for the first login before outgoing email is configured.
 */
class CreateOwner extends Command
{
    protected $signature = 'bos:create-owner {email} {name} {--password= : Leave empty to generate one}';
    protected $description = 'Create a verified owner account and organisation';

    public function handle(SetupService $setup): int
    {
        $password = $this->option('password') ?: Str::password(16, symbols: false);
        $user = $setup->createOwner($this->argument('email'), $password, $this->argument('name'));

        if (!$user) {
            $this->error('A user with that email already exists.');
            return self::FAILURE;
        }

        $this->info("Owner created: {$user->email}");
        if (!$this->option('password')) {
            $this->line("Password: {$password}");
        }

        return self::SUCCESS;
    }
}
