<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Guards cache the resolved user between requests inside one test; reset so each
     * simulated HTTP request authenticates from its own bearer token.
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $this->app['auth']->forgetGuards();
        $this->app->forgetInstance('current_business');
        $this->app->forgetInstance('current_tenant');

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }
}
