<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('domain')->nullable()->unique();
            $table->string('subdomain')->nullable()->unique();
            $table->string('logo')->nullable();
            $table->string('favicon')->nullable();
            $table->string('primary_color', 10)->default('#3B82F6');
            $table->string('secondary_color', 10)->default('#1E40AF');
            $table->enum('status', ['active', 'inactive', 'suspended', 'trial'])->default('trial');
            $table->enum('plan', ['free', 'starter', 'professional', 'enterprise'])->default('free');
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('subscription_ends_at')->nullable();
            $table->integer('max_businesses')->default(1);
            $table->integer('max_branches_per_business')->default(3);
            $table->integer('max_users')->default(10);
            $table->json('features')->nullable();
            $table->json('settings')->nullable();
            $table->string('timezone')->default('UTC');
            $table->string('currency', 5)->default('USD');
            $table->string('date_format')->default('Y-m-d');
            $table->string('time_format')->default('H:i');
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['slug', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
