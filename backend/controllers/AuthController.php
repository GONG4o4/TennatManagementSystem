<?php

declare(strict_types=1);

function accountProfile(PDO $pdo, int $userId): array
{
    $statement = $pdo->prepare(
        "SELECT u.user_id, u.email, u.role,
                COALESCE(l.first_name, t.first_name) AS first_name,
                COALESCE(l.last_name, t.last_name) AS last_name,
                t.middle_name, t.birthdate
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
    $profile['name'] = trim(implode(' ', array_filter([
        $profile['first_name'],
        $profile['middle_name'],
        $profile['last_name'],
    ])));

    return $profile;
}

function authRegister(PDO $pdo, array $input): array
{
    accessTokenKey();
    $firstName = trim((string) ($input['first_name'] ?? ''));
    $middleName = trim((string) ($input['middle_name'] ?? ''));
    $lastName = trim((string) ($input['last_name'] ?? ''));
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    $password = (string) ($input['password'] ?? '');
    $birthdate = trim((string) ($input['birthdate'] ?? ''));
    $phone = trim((string) ($input['phone'] ?? ''));
    $currentAddress = trim((string) ($input['current_address'] ?? ''));
    $emergencyContactName = trim((string) ($input['emergency_contact_name'] ?? ''));
    $emergencyContactPhone = trim((string) ($input['emergency_contact_phone'] ?? ''));
    $employmentStatus = trim((string) ($input['employment_status'] ?? ''));
    $monthlyIncome = $input['monthly_income'] ?? '';
    $role = 'applicant';

    if ($firstName === '' || strlen($firstName) > 100 || $lastName === '' || strlen($lastName) > 100) {
        throw new ApiException(422, 'First and last names are required and must be no longer than 100 characters.');
    }
    if (strlen($middleName) > 100) {
        throw new ApiException(422, 'Middle name must be no longer than 100 characters.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
        throw new ApiException(422, 'Enter a valid email address.');
    }
    if (strlen($password) < 8 || strlen($password) > 4096) {
        throw new ApiException(422, 'Password must be at least 8 characters long.');
    }

    $birthdateFormatted = null;
    if ($birthdate !== '') {
        $birthdateValue = DateTimeImmutable::createFromFormat('!Y-m-d', $birthdate);
        if (!$birthdateValue || $birthdateValue->format('Y-m-d') !== $birthdate || $birthdateValue >= new DateTimeImmutable('today')) {
            throw new ApiException(422, 'Enter a valid birthdate in the past.');
        }
        $birthdateFormatted = $birthdateValue->format('Y-m-d');
    }

    if (strlen($phone) > 30) {
        throw new ApiException(422, 'Phone number must be no longer than 30 characters.');
    }
    if (strlen($currentAddress) > 4000) {
        throw new ApiException(422, 'Current address must be no longer than 4000 characters.');
    }
    if (strlen($emergencyContactName) > 150) {
        throw new ApiException(422, 'Emergency contact name must be no longer than 150 characters.');
    }
    if (strlen($emergencyContactPhone) > 30) {
        throw new ApiException(422, 'Emergency contact phone must be no longer than 30 characters.');
    }
    if ($employmentStatus !== '' && !in_array($employmentStatus, ['full_time', 'part_time', 'contract', 'self_employed', 'unemployed', 'other'], true)) {
        throw new ApiException(422, 'Select a valid employment status.');
    }

    $monthlyIncomeFormatted = null;
    if ($monthlyIncome !== '' && $monthlyIncome !== null) {
        if (!is_numeric($monthlyIncome) || (float) $monthlyIncome < 0 || (float) $monthlyIncome > 9999999999.99) {
            throw new ApiException(422, 'Enter a valid non-negative monthly income.');
        }
        $monthlyIncomeFormatted = number_format((float) $monthlyIncome, 2, '.', '');
    }

    $documents = validateRegistrationDocuments($_FILES);
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $storedFiles = [];

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
            'INSERT INTO tenant (user_id, first_name, middle_name, last_name, birthdate, email, phone, current_address, emergency_contact_name, emergency_contact_phone, employment_status, monthly_income)
             VALUES (:user_id, :first_name, :middle_name, :last_name, :birthdate, :email, :phone, :current_address, :emergency_contact_name, :emergency_contact_phone, :employment_status, :monthly_income)',
        );
        $profileStatement->execute([
            'user_id' => $userId,
            'first_name' => $firstName,
            'middle_name' => $middleName !== '' ? $middleName : null,
            'last_name' => $lastName,
            'birthdate' => $birthdateFormatted,
            'email' => $email,
            'phone' => $phone !== '' ? $phone : null,
            'current_address' => $currentAddress !== '' ? $currentAddress : null,
            'emergency_contact_name' => $emergencyContactName !== '' ? $emergencyContactName : null,
            'emergency_contact_phone' => $emergencyContactPhone !== '' ? $emergencyContactPhone : null,
            'employment_status' => $employmentStatus !== '' ? $employmentStatus : null,
            'monthly_income' => $monthlyIncomeFormatted,
        ]);
        $tenantId = (int) $pdo->lastInsertId();

        $directory = dirname(__DIR__) . '/storage/private-documents';
        if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new ApiException(500, 'Private document storage is unavailable.');
        }
        $documentInsert = $pdo->prepare(
            'INSERT INTO tenant_document (tenant_id, document_type, file_path, original_name, content_type, file_size)
             VALUES (:tenant_id, :document_type, :file_path, :original_name, :content_type, :file_size)',
        );
        foreach ($documents as $document) {
            $filename = bin2hex(random_bytes(24)) . $document['extension'];
            $destination = $directory . '/' . $filename;
            if (!move_uploaded_file($document['temporary_path'], $destination)) {
                throw new ApiException(500, 'Unable to save an uploaded document.');
            }
            $storedFiles[] = $destination;
            $documentInsert->execute([
                'tenant_id' => $tenantId,
                'document_type' => $document['document_type'],
                'file_path' => $filename,
                'original_name' => $document['original_name'],
                'content_type' => $document['content_type'],
                'file_size' => $document['file_size'],
            ]);
        }
        $pdo->commit();
    } catch (PDOException $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        deleteRegistrationFiles($storedFiles);
        if ($error->getCode() === '23000') {
            throw new ApiException(409, 'An account with this email already exists.');
        }

        throw $error;
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        deleteRegistrationFiles($storedFiles);
        throw $error;
    }

    $user = accountProfile($pdo, $userId);
    return [
        'status' => 201,
        'body' => ['user' => $user, 'accessToken' => createAccessToken($userId, $role)],
    ];
}

function validateRegistrationDocuments(array $uploads): array
{
    $supportedTypes = [
        'government_id' => 'government_id',
        'proof_of_income' => 'proof_of_income',
        'reference_letter' => 'reference_letter',
    ];
    $allowedMimeTypes = [
        'application/pdf' => '.pdf',
        'image/jpeg' => '.jpg',
        'image/png' => '.png',
    ];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo === false) {
        throw new ApiException(500, 'Document validation is unavailable.');
    }

    $documents = [];
    try {
        foreach ($supportedTypes as $field => $documentType) {
            $upload = $uploads[$field] ?? null;
            if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
                continue;
            }
            if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
                throw new ApiException(422, 'A document upload failed. Each document must be no larger than 10 MB.');
            }

            $temporaryPath = (string) ($upload['tmp_name'] ?? '');
            $fileSize = (int) ($upload['size'] ?? 0);
            if ($fileSize <= 0 || $fileSize > 10 * 1024 * 1024 || !is_uploaded_file($temporaryPath)) {
                throw new ApiException(422, 'Each document must be a valid upload no larger than 10 MB.');
            }

            $contentType = finfo_file($finfo, $temporaryPath);
            if (!isset($allowedMimeTypes[$contentType])) {
                throw new ApiException(422, 'Documents must be PDF, JPEG, or PNG files.');
            }
            $originalName = basename((string) ($upload['name'] ?? 'document'));
            if ($originalName === '' || strlen($originalName) > 255) {
                throw new ApiException(422, 'Document file names must be no longer than 255 characters.');
            }
            $documents[] = [
                'document_type' => $documentType,
                'temporary_path' => $temporaryPath,
                'original_name' => $originalName,
                'content_type' => $contentType,
                'file_size' => $fileSize,
                'extension' => $allowedMimeTypes[$contentType],
            ];
        }
    } finally {
        finfo_close($finfo);
    }

    return $documents;
}

function deleteRegistrationFiles(array $files): void
{
    foreach ($files as $path) {
        if (is_file($path) && !unlink($path)) {
            error_log('Unable to remove a document after failed registration: ' . $path);
        }
    }
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
