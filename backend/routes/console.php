<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

// Clean expired OTPs daily
Schedule::command('model:prune', ['--model' => ['App\Models\UserOtp']])->daily();

// Clean expired user sessions daily
Schedule::call(function () {
    \App\Models\UserSession::where('expires_at', '<', now())->delete();
})->daily()->name('clean-expired-sessions');
