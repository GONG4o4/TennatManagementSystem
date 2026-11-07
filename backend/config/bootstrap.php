<?php

declare(strict_types=1);

final class ApiException extends RuntimeException
{
    public function __construct(
        public readonly int $status,
        string $message,
    ) {
        parent::__construct($message);
    }
}

$envFile = dirname(__DIR__) . '/.env';
if (is_file($envFile)) {
    $values = parse_ini_file($envFile, false, INI_SCANNER_RAW);
    if ($values === false) {
        throw new RuntimeException('Unable to read backend/.env');
    }

    foreach ($values as $key => $value) {
        $environmentValue = getenv($key);
        $invalidEnvironmentKey = $key === 'APP_KEY'
            && ($environmentValue === false
                || strlen($environmentValue) < 32
                || str_starts_with($environmentValue, 'replace_with_'));
        $_ENV[$key] = $environmentValue === false || $invalidEnvironmentKey
            ? $value
            : $environmentValue;
    }
}

function appEnv(string $name, string $default = ''): string
{
    if (isset($_ENV[$name])) {
        return (string) $_ENV[$name];
    }

    $value = getenv($name);
    return $value === false ? $default : $value;
}

function jsonResponse(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function requestJson(): array
{
    try {
        $payload = json_decode(file_get_contents('php://input') ?: '', true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new ApiException(400, 'Request body must be valid JSON.');
    }

    if (!is_array($payload)) {
        throw new ApiException(400, 'Request body must be a JSON object.');
    }

    return $payload;
}

function requestJsonOrEmpty(): array
{
    $raw = trim((string) file_get_contents('php://input'));
    if ($raw === '') {
        return [];
    }

    try {
        $payload = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new ApiException(400, 'Request body must be valid JSON.');
    }

    if (!is_array($payload)) {
        throw new ApiException(400, 'Request body must be a JSON object.');
    }

    return $payload;
}
