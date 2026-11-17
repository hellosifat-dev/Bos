<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\SetupService;
use Illuminate\Console\Command;

/** One command for release/start hooks: migrate, seed, and create the env-configured owner. */
class Setup extends Command
{
    protected $signature = 'bos:setup';
    protected $description = 'Run migrations, seed permissions/roles, and create the BOS_OWNER_* account';

    public function handle(SetupService $setup): int
    {
        $this->call('migrate', ['--force' => true]);

        $email   = strtolower((string) config('bos.owner.email'));
        $existed = $email && User::where('email', $email)->exists();

        $this->call('db:seed', ['--force' => true]);   // also creates the BOS_OWNER_* account
        $setup->ensureOwnerFromEnv();

        $created = $email && !$existed && User::where('email', $email)->exists();
        $this->info($created ? "Owner created: {$email}" : 'Owner: nothing to create (BOS_OWNER_* unset or user exists).');

        return self::SUCCESS;
    }
}
