<?php

namespace App\Support;

/**
 * Minimal RFC 6238 TOTP implementation (SHA-1, 6 digits, 30s step).
 */
class Totp
{
    private const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function generateSecret(int $bytes = 20): string
    {
        $raw = random_bytes($bytes);
        $bits = '';
        foreach (str_split($raw) as $char) {
            $bits .= str_pad(decbin(ord($char)), 8, '0', STR_PAD_LEFT);
        }
        $out = '';
        foreach (str_split($bits, 5) as $chunk) {
            $out .= self::ALPHABET[bindec(str_pad($chunk, 5, '0'))];
        }
        return $out;
    }

    public static function verify(string $secret, string $code, int $window = 1): bool
    {
        $code = preg_replace('/\s+/', '', $code);
        if (!preg_match('/^\d{6}$/', $code)) {
            return false;
        }
        $counter = (int) floor(time() / 30);
        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals(self::at($secret, $counter + $i), $code)) {
                return true;
            }
        }
        return false;
    }

    public static function at(string $secret, int $counter): string
    {
        $key  = self::base32Decode($secret);
        $hash = hash_hmac('sha1', pack('N*', 0, $counter), $key, true);
        $off  = ord($hash[19]) & 0xf;
        $bin  = ((ord($hash[$off]) & 0x7f) << 24)
              | ((ord($hash[$off + 1]) & 0xff) << 16)
              | ((ord($hash[$off + 2]) & 0xff) << 8)
              |  (ord($hash[$off + 3]) & 0xff);

        return str_pad((string) ($bin % 1000000), 6, '0', STR_PAD_LEFT);
    }

    public static function uri(string $secret, string $account, string $issuer): string
    {
        return sprintf(
            'otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30',
            rawurlencode($issuer), rawurlencode($account), $secret, rawurlencode($issuer)
        );
    }

    private static function base32Decode(string $input): string
    {
        $bits = '';
        foreach (str_split(strtoupper($input)) as $char) {
            $pos = strpos(self::ALPHABET, $char);
            if ($pos === false) {
                continue;
            }
            $bits .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        $out = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $out .= chr(bindec($byte));
            }
        }
        return $out;
    }
}
