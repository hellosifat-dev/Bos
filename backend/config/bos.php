<?php

return [

    // Allow sales/adjustments to drive stock below zero.
    'allow_negative_stock' => env('BOS_ALLOW_NEGATIVE_STOCK', false),

    // First owner account, created automatically when no user with this email exists
    // (on db:seed, bos:setup, or the first login attempt). Handy on hosts without a shell.
    'owner' => [
        'email'    => env('BOS_OWNER_EMAIL'),
        'password' => env('BOS_OWNER_PASSWORD'),
        'name'     => env('BOS_OWNER_NAME', 'Owner'),
    ],

    // When false, sign-ups are active immediately (no emailed code). Use until SMTP is configured.
    'require_email_verification' => (bool) env('BOS_REQUIRE_EMAIL_VERIFICATION', true),

    // Default weekend (Carbon dayOfWeek: 0 = Sunday … 6 = Saturday). Override per business via settings.weekend_days.
    'weekend_days' => [0, 6],


    /*
    |--------------------------------------------------------------------------
    | BOS Platform Configuration
    |--------------------------------------------------------------------------
    */

    'name'    => env('BOS_PLATFORM_NAME', 'Business Operating System'),
    'version' => '1.0.0',

    /*
    |--------------------------------------------------------------------------
    | Subscription Plans
    |--------------------------------------------------------------------------
    */
    'plans' => [
        'starter' => [
            'name'           => 'Starter',
            'price'          => 0,
            'billing_cycle'  => 'monthly',
            'user_limit'     => 5,
            'branch_limit'   => 1,
            'storage_gb'     => 2,
            'features'       => ['products', 'inventory', 'orders', 'customers', 'pos', 'basic_reports'],
        ],
        'business' => [
            'name'           => 'Business',
            'price'          => 29,
            'billing_cycle'  => 'monthly',
            'user_limit'     => 25,
            'branch_limit'   => 3,
            'storage_gb'     => 20,
            'features'       => [
                'products', 'inventory', 'orders', 'customers', 'pos', 'reports',
                'employees', 'payroll', 'expenses', 'accounting', 'website', 'crm',
            ],
        ],
        'professional' => [
            'name'           => 'Professional',
            'price'          => 79,
            'billing_cycle'  => 'monthly',
            'user_limit'     => 100,
            'branch_limit'   => 10,
            'storage_gb'     => 100,
            'features'       => [
                'products', 'inventory', 'orders', 'customers', 'pos', 'reports', 'analytics',
                'employees', 'payroll', 'expenses', 'accounting', 'website', 'crm',
                'marketing', 'loyalty', 'b2b', 'wholesale', 'purchasing', 'warehouses',
                'support', 'integrations', 'api',
            ],
        ],
        'enterprise' => [
            'name'           => 'Enterprise',
            'price'          => null, // custom
            'billing_cycle'  => 'custom',
            'user_limit'     => -1, // unlimited
            'branch_limit'   => -1,
            'storage_gb'     => -1,
            'features'       => ['*'], // all features
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Feature Flags (default state)
    |--------------------------------------------------------------------------
    */
    'features' => [
        'products'       => true,
        'inventory'      => true,
        'orders'         => true,
        'customers'      => true,
        'pos'            => true,
        'website'        => true,
        'cms'            => true,
        'employees'      => true,
        'payroll'        => true,
        'expenses'       => true,
        'accounting'     => true,
        'reports'        => true,
        'analytics'      => false,
        'marketing'      => false,
        'loyalty'        => false,
        'crm'            => false,
        'b2b'            => false,
        'wholesale'      => false,
        'manufacturing'  => false,
        'restaurant'     => false,
        'service'        => false,
        'subscription'   => false,
        'support'        => false,
        'integrations'   => false,
        'api_access'     => false,
        'white_label'    => false,
        'mobile_app'     => false,
    ],

    /*
    |--------------------------------------------------------------------------
    | Business Types
    |--------------------------------------------------------------------------
    */
    'business_types' => [
        'retail'        => 'Retail Shop',
        'ecommerce'     => 'E-commerce Business',
        'wholesale'     => 'Wholesale & Distribution',
        'b2b'           => 'B2B Business',
        'restaurant'    => 'Restaurant & Cafe',
        'service'       => 'Service Company',
        'manufacturing' => 'Manufacturing Business',
        'corporate'     => 'Corporate Organization',
        'multi_branch'  => 'Multi-Branch Business',
        'subscription'  => 'Subscription-based Business',
    ],

    /*
    |--------------------------------------------------------------------------
    | Business Setup Steps
    |--------------------------------------------------------------------------
    */
    'setup_steps' => [
        'business_info', 'business_type', 'branding', 'currency_language',
        'tax', 'branch', 'warehouse', 'employees', 'payment',
        'delivery', 'products', 'website',
    ],

    /*
    |--------------------------------------------------------------------------
    | OTP Configuration
    |--------------------------------------------------------------------------
    */
    'otp' => [
        'length'     => 6,
        'expires_in' => 10, // minutes
        'max_attempts' => 5,
    ],

    /*
    |--------------------------------------------------------------------------
    | Session Configuration
    |--------------------------------------------------------------------------
    */
    'session' => [
        'token_expires_in' => 60 * 24 * 30, // 30 days in minutes
        'refresh_threshold' => 60 * 24 * 7,  // refresh if less than 7 days
    ],

];
