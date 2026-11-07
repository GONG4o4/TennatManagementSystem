<?php

declare(strict_types=1);

function accountProfile(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare(
        "SELECT u.user_id, u.email, u.role,
                COALESCE(l.first_name, t.first_name) AS first_name,
                COALESCE(l.last_name, t.last_name) AS last_name
         FROM users u
         LEFT JOIN landlord l ON l.user_id = u.user_id
         LEFT JOIN tenant t ON t.user_id = u.user_id
         WHERE u.user_id = :user_id AND u.account_status = 'active'",
    );
    $statement->execute(['user_id' => $userId]);
    $profile = $statement->fetch();

    if (!$profile) {
        throw new ApiException(401, 'The account is unavailable.');
    }

    $profile['user_id'] = (int) $profile['user_id'];
    $profile['name'] = trim($profile['first_name'] . ' ' . $profile['last_name']);

    return $profile;
}

function authRegister(PDO $pdo, array $input): array
{
    accessTokenKey();
    $name = trim((string) ($input['name'] ?? ''));
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $password = (string) ($input['password'] ?? '');
    $role = 'applicant';

    if (strlen($name) > 200 || count(preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY) ?: []) < 2) {
        throw new ApiException(422, 'Enter both a first name and a last name.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
        throw new ApiException(422, 'Enter a valid email address.');
    }
    if (strlen($password) < 8 || strlen($password) > 4096) {
        throw new ApiException(422, 'Password must be at least 8 characters long.');
    }
    $nameParts = preg_split('/\s+/u', $name, 2, PREG_SPLIT_NO_EMPTY);
    $firstName = $nameParts[0];
    $lastName = $nameParts[1];
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    try {
        $pdo->beginTransaction();
        $userStatement = $pdo->prepare(
            "INSERT INTO users (email, password_hash, role, account_status)
             VALUES (:email, :password_hash, :role, 'active')",
        );
        $userStatement->execute([
            'email' => $email,
            'password_hash' => $passwordHash,
            'role' => $role,
        ]);
        $userId = (int) $pdo->lastInsertId();

        $profileStatement = $pdo->prepare(
            'INSERT INTO tenant (user_id, first_name, last_name, email) VALUES (:user_id, :first_name, :last_name, :email)',
        );
        $profileStatement->bindValue(':email', $email);

        $profileStatement->bindValue(':user_id', $userId, PDO::PARAM_INT);
        $profileStatement->bindValue(':first_name', $firstName);
        $profileStatement->bindValue(':last_name', $lastName);
        $profileStatement->execute();
        $pdo->commit();
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($error->getCode() === '23000') {
            throw new ApiException(409, 'An account with this email already exists.');
        }

        throw $error;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    $user = accountProfile($pdo, $userId);
    return [
        'status' => 201,
        'body' => ['user' => $user, 'accessToken' => createAccessToken($userId, $role)],
    ];
}

function authLogin(PDO $pdo, array $input): array
{
    accessTokenKey();
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $password = (string) ($input['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
        throw new ApiException(422, 'A valid email address and password are required.');
    }

    $statement = $pdo->prepare(
        'SELECT user_id, password_hash, role, account_status FROM users WHERE email = :email',
    );
    $statement->execute(['email' => $email]);
    $account = $statement->fetch();

    if (
        !$account
        || $account['account_status'] !== 'active'
        || !password_verify($password, $account['password_hash'])
    ) {
        throw new ApiException(401, 'Email or password is incorrect.');
    }

    $userId = (int) $account['user_id'];
    return [
        'status' => 200,
        'body' => [
            'user' => accountProfile($pdo, $userId),
            'accessToken' => createAccessToken($userId, $account['role']),
        ],
    ];
}

function authChangePassword(PDO $pdo, array $user, array $input): array
{
    $currentPassword = (string) ($input['currentPassword'] ?? '');
    $newPassword = (string) ($input['newPassword'] ?? '');

    if (strlen($newPassword) < 8 || strlen($newPassword) > 4096) {
        throw new ApiException(422, 'New password must be at least 8 characters long.');
    }

    $statement = $pdo->prepare('SELECT password_hash FROM users WHERE user_id = :user_id');
    $statement->execute(['user_id' => $user['user_id']]);
    $account = $statement->fetch();
    if (!$account || !password_verify($currentPassword, $account['password_hash'])) {
        throw new ApiException(401, 'Current password is incorrect.');
    }

    $update = $pdo->prepare(
        'UPDATE users SET password_hash = :password_hash WHERE user_id = :user_id',
    );
    $update->execute([
        'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
        'user_id' => $user['user_id'],
    ]);

    return ['status' => 200, 'body' => ['message' => 'Password updated.']];
}
