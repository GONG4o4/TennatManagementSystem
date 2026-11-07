<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/bootstrap.php';
require_once dirname(__DIR__) . '/config/database.php';
require_once dirname(__DIR__) . '/middleware/auth.php';
require_once dirname(__DIR__) . '/services/rentalCompliance.php';
require_once dirname(__DIR__) . '/controllers/AuthController.php';
require_once dirname(__DIR__) . '/controllers/ApiController.php';
require_once dirname(__DIR__) . '/routes/api.php';

$allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
}

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
$scriptDirectory = rtrim(str_replace('\\', '/', dirname($scriptName)), '/');

if ($scriptName !== '' && str_starts_with($requestPath, $scriptName)) {
    $requestPath = substr($requestPath, strlen($scriptName));
} elseif ($scriptDirectory !== '' && str_starts_with($requestPath, $scriptDirectory)) {
    $requestPath = substr($requestPath, strlen($scriptDirectory));
}

$requestPath = '/' . trim($requestPath, '/');

try {
    $pdo = databaseConnection();
    $result = dispatchApi(
        $pdo,
        strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
        $requestPath,
    );
    jsonResponse($result['body'], $result['status']);
} catch (ApiException $error) {
    jsonResponse(['message' => $error->getMessage()], $error->status);
} catch (PDOException $error) {
    if (($error->errorInfo[1] ?? null) === 1062) {
        jsonResponse(['message' => 'A record with the same unique value already exists. Check for an existing record and try again.'], 409);
    }

    error_log((string) $error);
    jsonResponse(['message' => 'An unexpected server error occurred.'], 500);
} catch (Throwable $error) {
    error_log((string) $error);
    jsonResponse(['message' => 'An unexpected server error occurred.'], 500);
}
