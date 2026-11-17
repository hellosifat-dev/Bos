<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            PermissionSeeder::class,
            RoleSeeder::class,
        ]);

        // Create the BOS_OWNER_* account when configured.
        app(\App\Services\SetupService::class)->ensureOwnerFromEnv();
    }
}
