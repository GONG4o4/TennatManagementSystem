<?php

declare(strict_types=1);

function databaseConnection(): PDO
{
    $host = appEnv('DB_HOST', '127.0.0.1');
    $port = appEnv('DB_PORT', '3306');
    $database = appEnv('DB_NAME', 'landlord_tenant');
    $username = appEnv('DB_USER', 'root');
    $password = appEnv('DB_PASSWORD');

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        $host,
        $port,
        $database,
    );

    return new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}
