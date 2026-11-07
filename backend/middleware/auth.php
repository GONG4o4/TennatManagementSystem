<?php

declare(strict_types=1);

function base64UrlEncode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function base64UrlDecode(string $value): string|false
{
    return base64_decode(strtr($value, '-_', '+/'), true);
}

function accessTokenKey(): string
{
    $key = appEnv('APP_KEY');
    if (strlen($key) < 32 || str_starts_with($key, 'replace_with_')) {
        throw new RuntimeException('Set APP_KEY in backend/.env to a random secret of at least 32 characters.');
    }

    return $key;
}

function createAccessToken(int $userId, string $role): string
{
    $now = time();
    $header = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
    $claims = base64UrlEncode(json_encode([
        'sub' => (string) $userId,
        'role' => $role,
        'iat' => $now,
        'exp' => $now + 7200,
    ], JSON_THROW_ON_ERROR));
    $unsignedToken = $header . '.' . $claims;
    $signature = base64UrlEncode(hash_hmac('sha256', $unsignedToken, accessTokenKey(), true));

    return $unsignedToken . '.' . $signature;
}

function authenticatedUser(PDO $pdo): array
{
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authorization = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if (!preg_match('/^Bearer\s+(\S+)$/i', $authorization, $matches)) {
        throw new ApiException(401, 'Authentication is required.');
    }

    $parts = explode('.', $matches[1]);
    if (count($parts) !== 3) {
        throw new ApiException(401, 'The access token is invalid or expired.');
    }

    [$encodedHeader, $encodedClaims, $providedSignature] = $parts;
    $expectedSignature = base64UrlEncode(hash_hmac(
        'sha256',
        $encodedHeader . '.' . $encodedClaims,
        accessTokenKey(),
        true,
    ));

    if (!hash_equals($expectedSignature, $providedSignature)) {
        throw new ApiException(401, 'The access token is invalid or expired.');
    }

    $headerJson = base64UrlDecode($encodedHeader);
    $claimsJson = base64UrlDecode($encodedClaims);
    if ($headerJson === false || $claimsJson === false) {
        throw new ApiException(401, 'The access token is invalid or expired.');
    }

    try {
        $header = json_decode($headerJson, true, 512, JSON_THROW_ON_ERROR);
        $claims = json_decode($claimsJson, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new ApiException(401, 'The access token is invalid or expired.');
    }

    if (
        ($header['alg'] ?? null) !== 'HS256'
        || !isset($claims['sub'], $claims['exp'])
        || !ctype_digit((string) $claims['sub'])
        || !is_int($claims['exp'])
        || $claims['exp'] <= time()
    ) {
        throw new ApiException(401, 'The access token is invalid or expired.');
    }

    $statement = $pdo->prepare(
        'SELECT user_id, email, role, account_status FROM users WHERE user_id = :user_id',
    );
    $statement->execute(['user_id' => $claims['sub']]);
    $user = $statement->fetch();

    if (!$user || $user['account_status'] !== 'active' || $user['role'] !== ($claims['role'] ?? null)) {
        throw new ApiException(401, 'The account is unavailable or the access token is invalid.');
    }

    return $user;
}
