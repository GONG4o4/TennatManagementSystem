<?php

declare(strict_types=1);

function landlordIdForUser(PDO $pdo, array $user): int
{
    if (($user['role'] ?? null) !== 'landlord') {
        throw new ApiException(403, 'Landlord access is required.');
    }

    $statement = $pdo->prepare(
        'SELECT landlord_id FROM landlord WHERE user_id = :user_id LIMIT 1',
    );
    $statement->execute(['user_id' => $user['user_id']]);
    $landlord = $statement->fetch();

    if (!$landlord) {
        throw new ApiException(404, 'Landlord profile was not found.');
    }

    return (int) $landlord['landlord_id'];
}

function tenantIdForUser(PDO $pdo, array $user): int
{
    if (($user['role'] ?? null) !== 'tenant') {
        throw new ApiException(403, 'Tenant access is required.');
    }

    $statement = $pdo->prepare(
        'SELECT tenant_id FROM tenant WHERE user_id = :user_id LIMIT 1',
    );
    $statement->execute(['user_id' => $user['user_id']]);
    $tenant = $statement->fetch();

    if (!$tenant) {
        throw new ApiException(404, 'Tenant profile was not found.');
    }

    return (int) $tenant['tenant_id'];
}

function profileUser(PDO $pdo, array $user): array
{
    if (($user['role'] ?? null) === 'landlord') {
        $statement = $pdo->prepare(
            'SELECT l.landlord_id, l.user_id, l.first_name, l.last_name, l.phone, l.business_name, u.email, u.role
             FROM landlord l
             JOIN users u ON u.user_id = l.user_id
             WHERE l.user_id = :user_id LIMIT 1',
        );
        $statement->execute(['user_id' => $user['user_id']]);
        $profile = $statement->fetch();
        if (!$profile) {
            throw new ApiException(404, 'Landlord profile was not found.');
        }

        $profile['name'] = trim(($profile['first_name'] ?? '') . ' ' . ($profile['last_name'] ?? ''));
        return $profile;
    }

    $statement = $pdo->prepare(
        'SELECT t.tenant_id, t.user_id, t.first_name, t.last_name, t.email, t.phone, t.current_address, t.emergency_contact_name, t.emergency_contact_phone, u.email AS login_email, u.role
         FROM tenant t
         JOIN users u ON u.user_id = t.user_id
         WHERE t.user_id = :user_id LIMIT 1',
    );
    $statement->execute(['user_id' => $user['user_id']]);
    $profile = $statement->fetch();
    if (!$profile) {
        throw new ApiException(404, 'Tenant profile was not found.');
    }

    $profile['email'] = $profile['login_email'] ?? $profile['email'];
    $profile['name'] = trim(($profile['first_name'] ?? '') . ' ' . ($profile['last_name'] ?? ''));
    return $profile;
}

function splitPersonName(string $name): array
{
    $trimmed = trim($name);
    if ($trimmed === '') {
        return ['', ''];
    }

    $parts = preg_split('/\s+/u', $trimmed, 2, PREG_SPLIT_NO_EMPTY);
    if ($parts === false || count($parts) === 0) {
        return ['', ''];
    }
    if (count($parts) === 1) {
        return [$parts[0], ''];
    }

    return [$parts[0], $parts[1]];
}

function propertyBelongsToLandlord(PDO $pdo, int $propertyId, int $landlordId): bool
{
    $statement = $pdo->prepare(
        'SELECT 1 FROM property WHERE property_id = :property_id AND landlord_id = :landlord_id LIMIT 1',
    );
    $statement->execute([
        'property_id' => $propertyId,
        'landlord_id' => $landlordId,
    ]);

    return (bool) $statement->fetch();
}

function unitBelongsToLandlord(PDO $pdo, int $unitId, int $landlordId): bool
{
    $statement = $pdo->prepare(
        'SELECT 1
         FROM rental_unit u
         JOIN property p ON p.property_id = u.property_id
         WHERE u.unit_id = :unit_id AND p.landlord_id = :landlord_id
         LIMIT 1',
    );
    $statement->execute([
        'unit_id' => $unitId,
        'landlord_id' => $landlordId,
    ]);

    return (bool) $statement->fetch();
}

function invoiceBelongsToUser(PDO $pdo, int $invoiceId, array $user): bool
{
    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        $statement = $pdo->prepare(
            'SELECT 1
             FROM rent_invoice i
             JOIN lease l ON l.lease_id = i.lease_id
             JOIN tenant_application a ON a.application_id = l.application_id
             WHERE i.invoice_id = :invoice_id AND a.landlord_id = :landlord_id
             LIMIT 1',
        );
        $statement->execute([
            'invoice_id' => $invoiceId,
            'landlord_id' => $landlordId,
        ]);
        return (bool) $statement->fetch();
    }

    if (($user['role'] ?? null) === 'tenant') {
        $tenantId = tenantIdForUser($pdo, $user);
        $statement = $pdo->prepare(
            'SELECT 1
             FROM rent_invoice i
             JOIN lease_tenant lt ON lt.lease_id = i.lease_id
             WHERE i.invoice_id = :invoice_id AND lt.tenant_id = :tenant_id AND (lt.left_at IS NULL OR lt.left_at >= CURDATE())
             LIMIT 1',
        );
        $statement->execute([
            'invoice_id' => $invoiceId,
            'tenant_id' => $tenantId,
        ]);
        return (bool) $statement->fetch();
    }

    return false;
}

function profileGet(PDO $pdo, array $user): array
{
    return ['status' => 200, 'body' => ['user' => profileUser($pdo, $user)]];
}

function landlordDirectoryList(PDO $pdo, array $user): array
{
    if (($user['role'] ?? null) !== 'tenant') {
        throw new ApiException(403, 'Only tenants may view the landlord directory.');
    }

    $statement = $pdo->query(
        'SELECT landlord_id, first_name, last_name, business_name
         FROM landlord
         ORDER BY business_name, last_name, first_name',
    );
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function screeningList(PDO $pdo, array $user): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT sr.*, s.screening_id, s.application_id, s.screening_status, s.screening_date,
                sc.criteria_name, CONCAT(t.first_name, " ", t.last_name) AS tenant_name
         FROM screening_result sr
         JOIN screening s ON s.screening_id = sr.screening_id
         JOIN tenant_application a ON a.application_id = s.application_id
         JOIN tenant t ON t.tenant_id = a.tenant_id
         JOIN screening_criteria sc ON sc.criteria_id = sr.criteria_id
         WHERE a.landlord_id = :landlord_id
         ORDER BY sr.verified_at DESC, sr.result_id DESC',
    );
    $statement->execute(['landlord_id' => $landlordId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function profilePatch(PDO $pdo, array $user, array $input): array
{
    $role = (string) ($user['role'] ?? '');

    if ($role === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        $params = ['landlord_id' => $landlordId];
        $changes = [];

        if (array_key_exists('name', $input)) {
            $name = trim((string) $input['name']);
            if ($name !== '') {
                [$firstName, $lastName] = splitPersonName($name);
                $changes[] = 'first_name = :first_name';
                $changes[] = 'last_name = :last_name';
                $params['first_name'] = $firstName;
                $params['last_name'] = $lastName;
            }
        }

        if (array_key_exists('phone', $input)) {
            $changes[] = 'phone = :phone';
            $params['phone'] = trim((string) $input['phone']);
        }

        if (array_key_exists('business_name', $input)) {
            $changes[] = 'business_name = :business_name';
            $params['business_name'] = trim((string) $input['business_name']);
        }

        if (count($changes) > 0) {
            $sql = 'UPDATE landlord SET ' . implode(', ', $changes) . ' WHERE landlord_id = :landlord_id';
            $pdo->prepare($sql)->execute($params);
        }
    } else {
        $tenantId = tenantIdForUser($pdo, $user);
        $params = ['tenant_id' => $tenantId];
        $changes = [];

        if (array_key_exists('name', $input)) {
            $name = trim((string) $input['name']);
            if ($name !== '') {
                [$firstName, $lastName] = splitPersonName($name);
                $changes[] = 'first_name = :first_name';
                $changes[] = 'last_name = :last_name';
                $params['first_name'] = $firstName;
                $params['last_name'] = $lastName;
            }
        }

        if (array_key_exists('phone', $input)) {
            $changes[] = 'phone = :phone';
            $params['phone'] = trim((string) $input['phone']);
        }

        if (array_key_exists('current_address', $input)) {
            $changes[] = 'current_address = :current_address';
            $params['current_address'] = trim((string) $input['current_address']);
        }

        if (array_key_exists('emergency_contact_name', $input)) {
            $changes[] = 'emergency_contact_name = :emergency_contact_name';
            $params['emergency_contact_name'] = trim((string) $input['emergency_contact_name']);
        }

        if (array_key_exists('emergency_contact_phone', $input)) {
            $changes[] = 'emergency_contact_phone = :emergency_contact_phone';
            $params['emergency_contact_phone'] = trim((string) $input['emergency_contact_phone']);
        }

        if (count($changes) > 0) {
            $sql = 'UPDATE tenant SET ' . implode(', ', $changes) . ' WHERE tenant_id = :tenant_id';
            $pdo->prepare($sql)->execute($params);
        }
    }

    return ['status' => 200, 'body' => ['user' => profileUser($pdo, $user)]];
}

function propertyList(PDO $pdo, array $user): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT p.*, COALESCE((SELECT COUNT(*) FROM rental_unit u WHERE u.property_id = p.property_id), 0) AS unit_count
         FROM property p
         WHERE p.landlord_id = :landlord_id
         ORDER BY p.created_at DESC',
    );
    $statement->execute(['landlord_id' => $landlordId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function propertyCreate(PDO $pdo, array $user, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $propertyName = trim((string) ($input['property_name'] ?? $input['name'] ?? ''));
    $propertyType = strtolower(trim((string) ($input['property_type'] ?? '')));
    $address = trim((string) ($input['address'] ?? ''));
    $description = trim((string) ($input['description'] ?? ''));

    if ($propertyName === '') {
        throw new ApiException(422, 'Property name is required.');
    }
    if ($address === '') {
        throw new ApiException(422, 'Property address is required.');
    }
    if (!in_array($propertyType, ['apartment', 'house', 'condo', 'townhouse', 'boarding_house', 'commercial', 'other'], true)) {
        throw new ApiException(422, 'Property type is invalid.');
    }

    $existingProperty = $pdo->prepare(
        'SELECT 1 FROM property WHERE landlord_id = :landlord_id AND property_name = :property_name LIMIT 1',
    );
    $existingProperty->execute(['landlord_id' => $landlordId, 'property_name' => $propertyName]);
    if ($existingProperty->fetch()) {
        throw new ApiException(409, 'A property with this name already exists in your account.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO property (landlord_id, property_name, property_type, address, description, property_status)
         VALUES (:landlord_id, :property_name, :property_type, :address, :description, :property_status)',
    );
    $statement->execute([
        'landlord_id' => $landlordId,
        'property_name' => $propertyName,
        'property_type' => $propertyType,
        'address' => $address,
        'description' => $description !== '' ? $description : null,
        'property_status' => 'active',
    ]);

    $propertyId = (int) $pdo->lastInsertId();
    $row = $pdo->prepare('SELECT * FROM property WHERE property_id = :property_id LIMIT 1');
    $row->execute(['property_id' => $propertyId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function propertyUpdate(PDO $pdo, array $user, int $propertyId, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    if (!propertyBelongsToLandlord($pdo, $propertyId, $landlordId)) {
        throw new ApiException(404, 'Property not found for this landlord.');
    }

    $allowed = ['property_name', 'property_type', 'address', 'description', 'property_status'];
    $updates = [];
    $params = ['property_id' => $propertyId];

    foreach ($allowed as $field) {
        if (!array_key_exists($field, $input)) {
            continue;
        }

        if ($field === 'description' && $input[$field] === null) {
            $updates[] = 'description = NULL';
            continue;
        }

        $value = trim((string) $input[$field]);
        if ($field === 'property_name' && $value === '') {
            throw new ApiException(422, 'Property name is required.');
        }
        if ($field === 'address' && $value === '') {
            throw new ApiException(422, 'Property address is required.');
        }
        if ($field === 'property_type' && !in_array(strtolower($value), ['apartment', 'house', 'condo', 'townhouse', 'boarding_house', 'commercial', 'other'], true)) {
            throw new ApiException(422, 'Property type is invalid.');
        }
        if ($field === 'property_status' && !in_array(strtolower($value), ['active', 'inactive', 'archived'], true)) {
            throw new ApiException(422, 'Property status is invalid.');
        }

        $updates[] = $field . ' = :' . $field;
        $params[$field] = $value;
    }

    if (count($updates) > 0) {
        $pdo->prepare('UPDATE property SET ' . implode(', ', $updates) . ' WHERE property_id = :property_id')->execute($params);
    }

    $statement = $pdo->prepare('SELECT * FROM property WHERE property_id = :property_id LIMIT 1');
    $statement->execute(['property_id' => $propertyId]);
    return ['status' => 200, 'body' => $statement->fetch()];
}

function unitList(PDO $pdo, array $user): array
{
    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        $statement = $pdo->prepare(
            'SELECT u.*, p.property_name, p.address
             FROM rental_unit u
             JOIN property p ON p.property_id = u.property_id
             WHERE p.landlord_id = :landlord_id
             ORDER BY p.property_name, u.unit_number',
        );
        $statement->execute(['landlord_id' => $landlordId]);
    } else {
        $statement = $pdo->query(
            "SELECT u.*, p.property_name, p.address
             FROM rental_unit u
             JOIN property p ON p.property_id = u.property_id
             WHERE u.unit_status = 'vacant' AND p.property_status = 'active'
             ORDER BY p.property_name, u.unit_number",
        );
    }
    $units = $statement->fetchAll();
    if ($units === []) {
        return ['status' => 200, 'body' => []];
    }

    $unitIds = array_map(static fn (array $unit): int => (int) $unit['unit_id'], $units);
    $placeholders = implode(',', array_fill(0, count($unitIds), '?'));
    $imagesStatement = $pdo->prepare(
        "SELECT image_id, unit_id, image_path FROM rental_unit_image WHERE unit_id IN ({$placeholders}) ORDER BY image_id",
    );
    $imagesStatement->execute($unitIds);
    $imagesByUnit = [];
    foreach ($imagesStatement->fetchAll() as $image) {
        $imagesByUnit[(int) $image['unit_id']][] = [
            'image_id' => (int) $image['image_id'],
            'image_url' => unitImageUrl((string) $image['image_path']),
        ];
    }
    foreach ($units as &$unit) {
        $unit['images'] = $imagesByUnit[(int) $unit['unit_id']] ?? [];
    }
    unset($unit);

    return ['status' => 200, 'body' => $units];
}

function unitCreate(PDO $pdo, array $user, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $propertyId = (int) ($input['property_id'] ?? 0);
    if (!propertyBelongsToLandlord($pdo, $propertyId, $landlordId)) {
        throw new ApiException(422, 'Property does not belong to this landlord.');
    }

    $unitNumber = trim((string) ($input['unit_number'] ?? ''));
    $monthlyRent = (float) ($input['monthly_rent'] ?? 0);
    $securityDeposit = (float) ($input['security_deposit'] ?? 0);

    if ($unitNumber === '') {
        throw new ApiException(422, 'Unit number is required.');
    }
    if ($monthlyRent <= 0) {
        throw new ApiException(422, 'Monthly rent must be greater than zero.');
    }

    $existingUnit = $pdo->prepare(
        'SELECT 1 FROM rental_unit WHERE property_id = :property_id AND unit_number = :unit_number LIMIT 1',
    );
    $existingUnit->execute(['property_id' => $propertyId, 'unit_number' => $unitNumber]);
    if ($existingUnit->fetch()) {
        throw new ApiException(409, 'A unit with this number already exists for the selected property.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO rental_unit (property_id, unit_number, unit_type, bedroom_count, bathroom_count, monthly_rent, security_deposit, unit_status, description)
         VALUES (:property_id, :unit_number, :unit_type, :bedroom_count, :bathroom_count, :monthly_rent, :security_deposit, :unit_status, :description)',
    );
    $statement->execute([
        'property_id' => $propertyId,
        'unit_number' => $unitNumber,
        'unit_type' => trim((string) ($input['unit_type'] ?? '')) !== '' ? trim((string) $input['unit_type']) : null,
        'bedroom_count' => max(0, (int) ($input['bedroom_count'] ?? 0)),
        'bathroom_count' => max(0, (int) ($input['bathroom_count'] ?? 1)),
        'monthly_rent' => number_format($monthlyRent, 2, '.', ''),
        'security_deposit' => number_format($securityDeposit, 2, '.', ''),
        'unit_status' => in_array(strtolower((string) ($input['unit_status'] ?? '')), ['vacant', 'reserved', 'occupied', 'maintenance', 'inactive'], true) ? strtolower((string) $input['unit_status']) : 'vacant',
        'description' => trim((string) ($input['description'] ?? '')) !== '' ? trim((string) $input['description']) : null,
    ]);

    $unitId = (int) $pdo->lastInsertId();
    $row = $pdo->prepare('SELECT * FROM rental_unit WHERE unit_id = :unit_id LIMIT 1');
    $row->execute(['unit_id' => $unitId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function unitUpdate(PDO $pdo, array $user, int $unitId, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    if (!unitBelongsToLandlord($pdo, $unitId, $landlordId)) {
        throw new ApiException(404, 'Unit not found for this landlord.');
    }

    $allowed = ['property_id', 'unit_number', 'unit_type', 'bedroom_count', 'bathroom_count', 'monthly_rent', 'security_deposit', 'unit_status', 'description'];
    $updates = [];
    $params = ['unit_id' => $unitId];

    foreach ($allowed as $field) {
        if (!array_key_exists($field, $input)) {
            continue;
        }

        if ($field === 'property_id') {
            $propertyId = (int) $input[$field];
            if (!propertyBelongsToLandlord($pdo, $propertyId, $landlordId)) {
                throw new ApiException(422, 'Property does not belong to this landlord.');
            }
            $updates[] = 'property_id = :property_id';
            $params['property_id'] = $propertyId;
            continue;
        }

        if ($field === 'unit_number') {
            $value = trim((string) $input[$field]);
            if ($value === '') {
                throw new ApiException(422, 'Unit number is required.');
            }
            $updates[] = 'unit_number = :unit_number';
            $params['unit_number'] = $value;
            continue;
        }

        if ($field === 'monthly_rent') {
            $value = (float) $input[$field];
            if ($value <= 0) {
                throw new ApiException(422, 'Monthly rent must be greater than zero.');
            }
            $updates[] = 'monthly_rent = :monthly_rent';
            $params['monthly_rent'] = number_format($value, 2, '.', '');
            continue;
        }

        if ($field === 'security_deposit') {
            $value = (float) $input[$field];
            $updates[] = 'security_deposit = :security_deposit';
            $params['security_deposit'] = number_format($value, 2, '.', '');
            continue;
        }

        $value = $input[$field];
        if ($field === 'description') {
            $value = trim((string) $value);
            $updates[] = 'description = :description';
            $params['description'] = $value !== '' ? $value : null;
            continue;
        }
        if ($field === 'unit_status' && !in_array(strtolower((string) $value), ['vacant', 'reserved', 'occupied', 'maintenance', 'inactive'], true)) {
            throw new ApiException(422, 'Unit status is invalid.');
        }
        $updates[] = $field . ' = :' . $field;
        $params[$field] = $value;
    }

    if (count($updates) > 0) {
        $pdo->prepare('UPDATE rental_unit SET ' . implode(', ', $updates) . ' WHERE unit_id = :unit_id')->execute($params);
    }

    $statement = $pdo->prepare('SELECT * FROM rental_unit WHERE unit_id = :unit_id LIMIT 1');
    $statement->execute(['unit_id' => $unitId]);
    return ['status' => 200, 'body' => $statement->fetch()];
}

function unitImagesCreate(PDO $pdo, array $user, int $unitId): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    if (!unitBelongsToLandlord($pdo, $unitId, $landlordId)) {
        throw new ApiException(404, 'Unit not found for this landlord.');
    }

    $upload = $_FILES['images'] ?? null;
    if (!is_array($upload) || !isset($upload['name']) || !is_array($upload['name'])) {
        throw new ApiException(400, 'Choose at least one image to upload.');
    }
    $count = count($upload['name']);
    if ($count < 1 || $count > 8) {
        throw new ApiException(422, 'Upload between 1 and 8 images at a time.');
    }

    $allowedTypes = [
        'image/jpeg' => '.jpg',
        'image/png' => '.png',
        'image/webp' => '.webp',
    ];
    $directory = dirname(__DIR__) . '/public/uploads/units';
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new ApiException(500, 'Image storage is unavailable.');
    }

    $validatedFiles = [];
    $totalSize = 0;
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo === false) {
        throw new ApiException(500, 'Image validation is unavailable.');
    }
    try {
        foreach ($upload['name'] as $index => $originalName) {
            $error = $upload['error'][$index] ?? UPLOAD_ERR_NO_FILE;
            if ($error !== UPLOAD_ERR_OK) {
                throw new ApiException(422, 'An image upload failed. Each image must be no larger than 5 MB.');
            }
            $temporaryPath = (string) ($upload['tmp_name'][$index] ?? '');
            $size = (int) ($upload['size'][$index] ?? 0);
            if ($size <= 0 || $size > 5 * 1024 * 1024 || !is_uploaded_file($temporaryPath)) {
                throw new ApiException(422, 'Each image must be a valid upload no larger than 5 MB.');
            }
            $totalSize += $size;
            if ($totalSize > 30 * 1024 * 1024) {
                throw new ApiException(422, 'The total size of uploaded images must not exceed 30 MB.');
            }
            $mimeType = finfo_file($finfo, $temporaryPath);
            if (!isset($allowedTypes[$mimeType])) {
                throw new ApiException(422, 'Images must be JPEG, PNG, or WebP files.');
            }
            $imageInfo = getimagesize($temporaryPath);
            if ($imageInfo === false || ($imageInfo['mime'] ?? '') !== $mimeType) {
                throw new ApiException(422, 'One of the uploaded files is not a valid image.');
            }
            $validatedFiles[] = ['temporary_path' => $temporaryPath, 'extension' => $allowedTypes[$mimeType]];
        }
    } finally {
        finfo_close($finfo);
    }

    $storedFiles = [];
    try {
        $pdo->beginTransaction();
        $insert = $pdo->prepare('INSERT INTO rental_unit_image (unit_id, image_path) VALUES (:unit_id, :image_path)');
        foreach ($validatedFiles as $file) {
            $filename = bin2hex(random_bytes(16)) . $file['extension'];
            $destination = $directory . '/' . $filename;
            if (!move_uploaded_file($file['temporary_path'], $destination)) {
                throw new ApiException(500, 'Unable to save an uploaded image.');
            }
            $storedFiles[] = $destination;
            $insert->execute(['unit_id' => $unitId, 'image_path' => $filename]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        foreach ($storedFiles as $path) {
            if (is_file($path)) {
                unlink($path);
            }
        }
        throw $error;
    }

    return ['status' => 201, 'body' => ['uploaded' => count($storedFiles)]];
}

function unitImageUrl(string $filename): string
{
    $scriptDirectory = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php')), '/');
    return $scriptDirectory . '/uploads/units/' . rawurlencode(basename($filename));
}

function applicationList(PDO $pdo, array $user): array
{
    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        $statement = $pdo->prepare(
            'SELECT a.*, CONCAT(t.first_name, " ", t.last_name) AS tenant_name
             FROM tenant_application a
             JOIN tenant t ON t.tenant_id = a.tenant_id
             WHERE a.landlord_id = :landlord_id
             ORDER BY a.application_date DESC',
        );
        $statement->execute(['landlord_id' => $landlordId]);
        return ['status' => 200, 'body' => $statement->fetchAll()];
    }

    $tenantId = tenantIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT a.*, CONCAT(t.first_name, " ", t.last_name) AS tenant_name
         FROM tenant_application a
         JOIN tenant t ON t.tenant_id = a.tenant_id
         WHERE a.tenant_id = :tenant_id
         ORDER BY a.application_date DESC',
    );
    $statement->execute(['tenant_id' => $tenantId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function applicationCreate(PDO $pdo, array $user, array $input): array
{
    if (($user['role'] ?? null) !== 'tenant') {
        throw new ApiException(403, 'Only tenants may create applications.');
    }

    $tenantId = tenantIdForUser($pdo, $user);
    $landlordId = (int) ($input['landlord_id'] ?? 0);
    if ($landlordId <= 0) {
        throw new ApiException(422, 'A landlord is required.');
    }

    $statement = $pdo->prepare('SELECT landlord_id FROM landlord WHERE landlord_id = :landlord_id LIMIT 1');
    $statement->execute(['landlord_id' => $landlordId]);
    if (!$statement->fetch()) {
        throw new ApiException(404, 'Landlord was not found.');
    }

    $desiredMoveIn = $input['desired_move_in_date'] ?? null;
    $employmentStatus = trim((string) ($input['employment_status'] ?? ''));
    $monthlyIncome = isset($input['monthly_income']) ? (float) $input['monthly_income'] : null;
    $notes = trim((string) ($input['additional_notes'] ?? ''));

    $insert = $pdo->prepare(
        'INSERT INTO tenant_application (tenant_id, landlord_id, desired_move_in_date, employment_status, monthly_income, additional_notes, application_status, reviewed_at)
         VALUES (:tenant_id, :landlord_id, :desired_move_in_date, :employment_status, :monthly_income, :additional_notes, :application_status, NULL)',
    );
    $insert->execute([
        'tenant_id' => $tenantId,
        'landlord_id' => $landlordId,
        'desired_move_in_date' => $desiredMoveIn !== null && $desiredMoveIn !== '' ? $desiredMoveIn : null,
        'employment_status' => $employmentStatus !== '' ? $employmentStatus : null,
        'monthly_income' => $monthlyIncome !== null && $monthlyIncome > 0 ? number_format($monthlyIncome, 2, '.', '') : null,
        'additional_notes' => $notes !== '' ? $notes : null,
        'application_status' => 'submitted',
    ]);

    $applicationId = (int) $pdo->lastInsertId();
    $row = $pdo->prepare('SELECT * FROM tenant_application WHERE application_id = :application_id LIMIT 1');
    $row->execute(['application_id' => $applicationId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function applicationStatusUpdate(PDO $pdo, array $user, int $applicationId, array $input): array
{
    $status = strtolower(trim((string) ($input['status'] ?? '')));
    $allowed = ['submitted', 'under_review', 'approved', 'rejected', 'withdrawn'];
    if (!in_array($status, $allowed, true)) {
        throw new ApiException(422, 'Application status is invalid.');
    }

    $statement = $pdo->prepare('SELECT * FROM tenant_application WHERE application_id = :application_id LIMIT 1');
    $statement->execute(['application_id' => $applicationId]);
    $application = $statement->fetch();
    if (!$application) {
        throw new ApiException(404, 'Application not found.');
    }

    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        if ((int) $application['landlord_id'] !== $landlordId) {
            throw new ApiException(403, 'You do not have access to this application.');
        }
    } elseif (($user['role'] ?? null) === 'tenant') {
        $tenantId = tenantIdForUser($pdo, $user);
        if ((int) $application['tenant_id'] !== $tenantId) {
            throw new ApiException(403, 'You do not have access to this application.');
        }
        if (!in_array($status, ['submitted', 'withdrawn'], true)) {
            throw new ApiException(403, 'Tenants may only withdraw applications.');
        }
    } else {
        throw new ApiException(403, 'Access denied.');
    }

    $reviewedAt = in_array($status, ['approved', 'rejected', 'under_review'], true) ? date('Y-m-d H:i:s') : null;
    $statement = $pdo->prepare(
        'UPDATE tenant_application SET application_status = :status, reviewed_at = :reviewed_at WHERE application_id = :application_id',
    );
    $statement->execute([
        'status' => $status,
        'reviewed_at' => $reviewedAt,
        'application_id' => $applicationId,
    ]);

    $statement = $pdo->prepare('SELECT * FROM tenant_application WHERE application_id = :application_id LIMIT 1');
    $statement->execute(['application_id' => $applicationId]);
    return ['status' => 200, 'body' => $statement->fetch()];
}

function applicationDocumentsList(PDO $pdo, array $user, int $applicationId): array
{
    $statement = $pdo->prepare('SELECT * FROM tenant_application WHERE application_id = :application_id LIMIT 1');
    $statement->execute(['application_id' => $applicationId]);
    $application = $statement->fetch();
    if (!$application) {
        throw new ApiException(404, 'Application not found.');
    }

    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        if ((int) $application['landlord_id'] !== $landlordId) {
            throw new ApiException(403, 'You do not have access to this application.');
        }
    } elseif (($user['role'] ?? null) === 'tenant') {
        $tenantId = tenantIdForUser($pdo, $user);
        if ((int) $application['tenant_id'] !== $tenantId) {
            throw new ApiException(403, 'You do not have access to this application.');
        }
    }

    $documents = $pdo->prepare('SELECT * FROM application_document WHERE application_id = :application_id ORDER BY uploaded_at DESC');
    $documents->execute(['application_id' => $applicationId]);
    return ['status' => 200, 'body' => $documents->fetchAll()];
}

function applicationDocumentCreate(PDO $pdo, array $user, int $applicationId, array $input): array
{
    $statement = $pdo->prepare('SELECT * FROM tenant_application WHERE application_id = :application_id LIMIT 1');
    $statement->execute(['application_id' => $applicationId]);
    $application = $statement->fetch();
    if (!$application) {
        throw new ApiException(404, 'Application not found.');
    }

    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        if ((int) $application['landlord_id'] !== $landlordId) {
            throw new ApiException(403, 'You do not have access to this application.');
        }
    } elseif (($user['role'] ?? null) === 'tenant') {
        $tenantId = tenantIdForUser($pdo, $user);
        if ((int) $application['tenant_id'] !== $tenantId) {
            throw new ApiException(403, 'You do not have access to this application.');
        }
    }

    $documentType = strtolower(trim((string) ($input['document_type'] ?? '')));
    $filePath = trim((string) ($input['file_path'] ?? ''));
    $allowedTypes = ['government_id', 'proof_of_income', 'employment_certificate', 'bank_statement', 'reference_letter', 'other'];
    if (!in_array($documentType, $allowedTypes, true)) {
        throw new ApiException(422, 'Document type is invalid.');
    }
    if ($filePath === '') {
        throw new ApiException(422, 'File path is required.');
    }

    $insert = $pdo->prepare(
        'INSERT INTO application_document (application_id, document_type, file_path, verification_status)
         VALUES (:application_id, :document_type, :file_path, :verification_status)',
    );
    $insert->execute([
        'application_id' => $applicationId,
        'document_type' => $documentType,
        'file_path' => $filePath,
        'verification_status' => 'pending',
    ]);

    $documentId = (int) $pdo->lastInsertId();
    $row = $pdo->prepare('SELECT * FROM application_document WHERE document_id = :document_id LIMIT 1');
    $row->execute(['document_id' => $documentId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function applicationDocumentVerificationUpdate(PDO $pdo, array $user, int $documentId, array $input): array
{
    $status = strtolower(trim((string) ($input['verification_status'] ?? $input['status'] ?? '')));
    if (!in_array($status, ['pending', 'verified', 'rejected'], true)) {
        throw new ApiException(422, 'Verification status is invalid.');
    }

    $statement = $pdo->prepare('SELECT d.*, a.landlord_id, a.tenant_id FROM application_document d JOIN tenant_application a ON a.application_id = d.application_id WHERE d.document_id = :document_id LIMIT 1');
    $statement->execute(['document_id' => $documentId]);
    $document = $statement->fetch();
    if (!$document) {
        throw new ApiException(404, 'Document not found.');
    }

    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        if ((int) $document['landlord_id'] !== $landlordId) {
            throw new ApiException(403, 'You do not have access to this document.');
        }
    } elseif (($user['role'] ?? null) === 'tenant') {
        $tenantId = tenantIdForUser($pdo, $user);
        if ((int) $document['tenant_id'] !== $tenantId) {
            throw new ApiException(403, 'You do not have access to this document.');
        }
        if ($status !== 'pending') {
            throw new ApiException(403, 'Tenants may only set document verification back to pending.');
        }
    }

    $update = $pdo->prepare('UPDATE application_document SET verification_status = :status WHERE document_id = :document_id');
    $update->execute(['status' => $status, 'document_id' => $documentId]);

    $row = $pdo->prepare('SELECT * FROM application_document WHERE document_id = :document_id LIMIT 1');
    $row->execute(['document_id' => $documentId]);
    return ['status' => 200, 'body' => $row->fetch()];
}

function screeningCriteriaList(PDO $pdo, array $user): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT * FROM screening_criteria WHERE landlord_id = :landlord_id ORDER BY criteria_name ASC',
    );
    $statement->execute(['landlord_id' => $landlordId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function screeningCriterionCreate(PDO $pdo, array $user, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $name = trim((string) ($input['criteria_name'] ?? $input['name'] ?? ''));
    if ($name === '') {
        throw new ApiException(422, 'Criteria name is required.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO screening_criteria (landlord_id, criteria_name, description, is_active)
         VALUES (:landlord_id, :criteria_name, :description, :is_active)',
    );
    $statement->execute([
        'landlord_id' => $landlordId,
        'criteria_name' => $name,
        'description' => trim((string) ($input['description'] ?? '')) !== '' ? trim((string) $input['description']) : null,
        'is_active' => (bool) ($input['is_active'] ?? true),
    ]);

    $criteriaId = (int) $pdo->lastInsertId();
    $row = $pdo->prepare('SELECT * FROM screening_criteria WHERE criteria_id = :criteria_id LIMIT 1');
    $row->execute(['criteria_id' => $criteriaId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function screeningCriterionUpdate(PDO $pdo, array $user, int $criteriaId, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare('SELECT * FROM screening_criteria WHERE criteria_id = :criteria_id AND landlord_id = :landlord_id LIMIT 1');
    $statement->execute(['criteria_id' => $criteriaId, 'landlord_id' => $landlordId]);
    if (!$statement->fetch()) {
        throw new ApiException(404, 'Screening criterion not found.');
    }

    $name = trim((string) ($input['criteria_name'] ?? $input['name'] ?? ''));
    $description = $input['description'] ?? null;
    $isActive = array_key_exists('is_active', $input) ? (bool) $input['is_active'] : null;

    $updates = [];
    $params = ['criteria_id' => $criteriaId];

    if ($name !== '') {
        $updates[] = 'criteria_name = :criteria_name';
        $params['criteria_name'] = $name;
    }
    if (array_key_exists('description', $input)) {
        $updates[] = 'description = :description';
        $params['description'] = $description !== null && trim((string) $description) !== '' ? trim((string) $description) : null;
    }
    if ($isActive !== null) {
        $updates[] = 'is_active = :is_active';
        $params['is_active'] = $isActive ? 1 : 0;
    }

    if (count($updates) > 0) {
        $sql = 'UPDATE screening_criteria SET ' . implode(', ', $updates) . ' WHERE criteria_id = :criteria_id';
        $pdo->prepare($sql)->execute($params);
    }

    $row = $pdo->prepare('SELECT * FROM screening_criteria WHERE criteria_id = :criteria_id LIMIT 1');
    $row->execute(['criteria_id' => $criteriaId]);
    return ['status' => 200, 'body' => $row->fetch()];
}

function screeningCreate(PDO $pdo, array $user, int $applicationId, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare('SELECT * FROM tenant_application WHERE application_id = :application_id LIMIT 1');
    $statement->execute(['application_id' => $applicationId]);
    $application = $statement->fetch();
    if (!$application) {
        throw new ApiException(404, 'Application not found.');
    }
    if ((int) $application['landlord_id'] !== $landlordId) {
        throw new ApiException(403, 'You do not have access to this application.');
    }

    $existing = $pdo->prepare('SELECT * FROM screening WHERE application_id = :application_id LIMIT 1');
    $existing->execute(['application_id' => $applicationId]);
    $screening = $existing->fetch();
    if ($screening) {
        return ['status' => 200, 'body' => $screening];
    }

    $remarks = trim((string) ($input['remarks'] ?? ''));
    $statement = $pdo->prepare(
        'INSERT INTO screening (application_id, screened_by, screening_status, remarks)
         VALUES (:application_id, :screened_by, :screening_status, :remarks)',
    );
    $statement->execute([
        'application_id' => $applicationId,
        'screened_by' => $user['user_id'],
        'screening_status' => 'in_progress',
        'remarks' => $remarks !== '' ? $remarks : null,
    ]);

    $screeningId = (int) $pdo->lastInsertId();
    $row = $pdo->prepare('SELECT * FROM screening WHERE screening_id = :screening_id LIMIT 1');
    $row->execute(['screening_id' => $screeningId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function screeningResultCreate(PDO $pdo, array $user, int $screeningId, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT s.*, a.landlord_id FROM screening s JOIN tenant_application a ON a.application_id = s.application_id WHERE s.screening_id = :screening_id LIMIT 1',
    );
    $statement->execute(['screening_id' => $screeningId]);
    $screening = $statement->fetch();
    if (!$screening) {
        throw new ApiException(404, 'Screening not found.');
    }
    if ((int) $screening['landlord_id'] !== $landlordId) {
        throw new ApiException(403, 'You do not have access to this screening.');
    }

    $criteriaId = (int) ($input['criteria_id'] ?? 0);
    if ($criteriaId <= 0) {
        throw new ApiException(422, 'Criteria ID is required.');
    }

    $statement = $pdo->prepare('SELECT * FROM screening_criteria WHERE criteria_id = :criteria_id AND landlord_id = :landlord_id LIMIT 1');
    $statement->execute(['criteria_id' => $criteriaId, 'landlord_id' => $landlordId]);
    if (!$statement->fetch()) {
        throw new ApiException(404, 'Criteria does not belong to this landlord.');
    }

    $status = strtolower(trim((string) ($input['result_status'] ?? $input['status'] ?? 'pending')));
    if (!in_array($status, ['pending', 'passed', 'failed', 'not_applicable'], true)) {
        throw new ApiException(422, 'Result status is invalid.');
    }

    $remarks = trim((string) ($input['remarks'] ?? ''));
    $verifiedAt = $status === 'pending' ? null : date('Y-m-d H:i:s');

    $insert = $pdo->prepare(
        'INSERT INTO screening_result (screening_id, criteria_id, result_status, remarks, verified_at)
         VALUES (:screening_id, :criteria_id, :result_status, :remarks, :verified_at)
         ON DUPLICATE KEY UPDATE result_status = VALUES(result_status), remarks = VALUES(remarks), verified_at = VALUES(verified_at)',
    );
    $insert->execute([
        'screening_id' => $screeningId,
        'criteria_id' => $criteriaId,
        'result_status' => $status,
        'remarks' => $remarks !== '' ? $remarks : null,
        'verified_at' => $verifiedAt,
    ]);

    $resultId = (int) $pdo->lastInsertId();
    if ($resultId === 0) {
        $existing = $pdo->prepare('SELECT result_id FROM screening_result WHERE screening_id = :screening_id AND criteria_id = :criteria_id LIMIT 1');
        $existing->execute(['screening_id' => $screeningId, 'criteria_id' => $criteriaId]);
        $resultId = (int) $existing->fetchColumn();
    }

    $statusStatement = $pdo->prepare(
        "SELECT
            SUM(CASE WHEN result_status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
            COUNT(*) AS result_count,
            (SELECT COUNT(*) FROM screening_criteria WHERE landlord_id = :landlord_id AND is_active = TRUE) AS active_count
         FROM screening_result WHERE screening_id = :screening_id",
    );
    $statusStatement->execute([
        'landlord_id' => $landlordId,
        'screening_id' => $screeningId,
    ]);
    $summary = $statusStatement->fetch();
    $screeningStatus = (int) $summary['failed_count'] > 0
        ? 'failed'
        : ((int) $summary['result_count'] >= (int) $summary['active_count'] ? 'passed' : 'in_progress');
    $pdo->prepare('UPDATE screening SET screening_status = :status WHERE screening_id = :screening_id')
        ->execute(['status' => $screeningStatus, 'screening_id' => $screeningId]);

    $row = $pdo->prepare('SELECT * FROM screening_result WHERE result_id = :result_id LIMIT 1');
    $row->execute(['result_id' => $resultId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function leaseList(PDO $pdo, array $user): array
{
    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        $statement = $pdo->prepare(
            'SELECT l.*, u.unit_number, p.property_name, a.tenant_id, CONCAT(t.first_name, " ", t.last_name) AS tenant_name
             FROM lease l
             JOIN rental_unit u ON u.unit_id = l.unit_id
             JOIN property p ON p.property_id = u.property_id
             JOIN tenant_application a ON a.application_id = l.application_id
             JOIN tenant t ON t.tenant_id = a.tenant_id
             WHERE p.landlord_id = :landlord_id
             ORDER BY l.created_at DESC',
        );
        $statement->execute(['landlord_id' => $landlordId]);
        return ['status' => 200, 'body' => $statement->fetchAll()];
    }

    $tenantId = tenantIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT l.*, u.unit_number, p.property_name
         FROM lease_tenant lt
         JOIN lease l ON l.lease_id = lt.lease_id
         JOIN rental_unit u ON u.unit_id = l.unit_id
         JOIN property p ON p.property_id = u.property_id
         WHERE lt.tenant_id = :tenant_id
         ORDER BY l.created_at DESC',
    );
    $statement->execute(['tenant_id' => $tenantId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function leaseCreate(PDO $pdo, array $user, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $applicationId = (int) ($input['application_id'] ?? 0);
    $unitId = (int) ($input['unit_id'] ?? 0);
    if ($applicationId <= 0 || $unitId <= 0) {
        throw new ApiException(422, 'Application ID and unit ID are required.');
    }

    $statement = $pdo->prepare('SELECT * FROM tenant_application WHERE application_id = :application_id LIMIT 1');
    $statement->execute(['application_id' => $applicationId]);
    $application = $statement->fetch();
    if (!$application) {
        throw new ApiException(404, 'Application not found.');
    }
    if ((int) $application['landlord_id'] !== $landlordId) {
        throw new ApiException(403, 'You do not have access to this application.');
    }
    if ($application['application_status'] !== 'approved') {
        throw new ApiException(422, 'Only approved applications can be converted into a lease.');
    }
    if (!unitBelongsToLandlord($pdo, $unitId, $landlordId)) {
        throw new ApiException(422, 'Unit does not belong to this landlord.');
    }

    $startDate = (string) ($input['lease_start_date'] ?? '');
    $endDate = (string) ($input['lease_end_date'] ?? '');
    $monthlyRent = (float) ($input['monthly_rent'] ?? 0);

    if ($startDate === '' || $endDate === '') {
        throw new ApiException(422, 'Lease start and end dates are required.');
    }
    if ($monthlyRent <= 0) {
        throw new ApiException(422, 'Monthly rent must be greater than zero.');
    }

    $insert = $pdo->prepare(
        'INSERT INTO lease (application_id, unit_id, lease_start_date, lease_end_date, monthly_rent, security_deposit, advance_payment, payment_due_day, lease_status)
         VALUES (:application_id, :unit_id, :lease_start_date, :lease_end_date, :monthly_rent, :security_deposit, :advance_payment, :payment_due_day, :lease_status)',
    );
    $insert->execute([
        'application_id' => $applicationId,
        'unit_id' => $unitId,
        'lease_start_date' => $startDate,
        'lease_end_date' => $endDate,
        'monthly_rent' => number_format($monthlyRent, 2, '.', ''),
        'security_deposit' => number_format((float) ($input['security_deposit'] ?? 0), 2, '.', ''),
        'advance_payment' => number_format((float) ($input['advance_payment'] ?? 0), 2, '.', ''),
        'payment_due_day' => max(1, min(28, (int) ($input['payment_due_day'] ?? 1))),
        'lease_status' => 'pending',
    ]);

    $leaseId = (int) $pdo->lastInsertId();
    $tenantId = (int) $application['tenant_id'];
    $link = $pdo->prepare(
        'INSERT INTO lease_tenant (lease_id, tenant_id, tenant_type, joined_at, left_at)
         VALUES (:lease_id, :tenant_id, :tenant_type, CURDATE(), NULL)',
    );
    $link->execute([
        'lease_id' => $leaseId,
        'tenant_id' => $tenantId,
        'tenant_type' => 'primary',
    ]);
    $pdo->prepare("UPDATE rental_unit SET unit_status = 'reserved' WHERE unit_id = :unit_id")
        ->execute(['unit_id' => $unitId]);

    $row = $pdo->prepare('SELECT * FROM lease WHERE lease_id = :lease_id LIMIT 1');
    $row->execute(['lease_id' => $leaseId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function leaseUpdate(PDO $pdo, array $user, int $leaseId, array $input): array
{
    if (($user['role'] ?? null) !== 'landlord') {
        throw new ApiException(403, 'Only landlords can update leases.');
    }

    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT l.*, a.landlord_id
         FROM lease l
         JOIN tenant_application a ON a.application_id = l.application_id
         WHERE l.lease_id = :lease_id LIMIT 1',
    );
    $statement->execute(['lease_id' => $leaseId]);
    $lease = $statement->fetch();
    if (!$lease) {
        throw new ApiException(404, 'Lease not found.');
    }
    if ((int) $lease['landlord_id'] !== $landlordId) {
        throw new ApiException(403, 'You do not have access to this lease.');
    }

    $allowed = ['lease_start_date', 'lease_end_date', 'monthly_rent', 'security_deposit', 'advance_payment', 'payment_due_day', 'lease_status'];
    $updates = [];
    $params = ['lease_id' => $leaseId];

    foreach ($allowed as $field) {
        if (!array_key_exists($field, $input)) {
            continue;
        }

        $value = $input[$field];
        if ($field === 'monthly_rent') {
            $number = (float) $value;
            if ($number <= 0) {
                throw new ApiException(422, 'Monthly rent must be greater than zero.');
            }
            $updates[] = 'monthly_rent = :monthly_rent';
            $params['monthly_rent'] = number_format($number, 2, '.', '');
            continue;
        }

        if ($field === 'lease_status' && !in_array(strtolower((string) $value), ['pending', 'active', 'ended', 'terminated', 'cancelled'], true)) {
            throw new ApiException(422, 'Lease status is invalid.');
        }

        $updates[] = $field . ' = :' . $field;
        $params[$field] = $value;
    }

    if (count($updates) > 0) {
        $pdo->prepare('UPDATE lease SET ' . implode(', ', $updates) . ' WHERE lease_id = :lease_id')->execute($params);
    }

    if (array_key_exists('lease_status', $input)) {
        $status = strtolower((string) $input['lease_status']);
        if ($status === 'active') {
            $pdo->prepare("UPDATE rental_unit SET unit_status = 'occupied' WHERE unit_id = :unit_id")
                ->execute(['unit_id' => $lease['unit_id']]);
        } elseif (in_array($status, ['ended', 'terminated', 'cancelled'], true)) {
            $activeLease = $pdo->prepare(
                "SELECT lease_status FROM lease
                 WHERE unit_id = :unit_id AND lease_id <> :lease_id
                 AND lease_status IN ('active', 'pending')
                 ORDER BY CASE lease_status WHEN 'active' THEN 0 ELSE 1 END
                 LIMIT 1",
            );
            $activeLease->execute(['unit_id' => $lease['unit_id'], 'lease_id' => $leaseId]);
            $otherStatus = $activeLease->fetchColumn();
            $unitStatus = $otherStatus === 'active' ? 'occupied' : ($otherStatus === 'pending' ? 'reserved' : 'vacant');
            $pdo->prepare('UPDATE rental_unit SET unit_status = :unit_status WHERE unit_id = :unit_id')
                ->execute(['unit_status' => $unitStatus, 'unit_id' => $lease['unit_id']]);
        }
    }

    $row = $pdo->prepare('SELECT * FROM lease WHERE lease_id = :lease_id LIMIT 1');
    $row->execute(['lease_id' => $leaseId]);
    return ['status' => 200, 'body' => $row->fetch()];
}

function invoiceList(PDO $pdo, array $user): array
{
    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        $statement = $pdo->prepare(
            'SELECT i.*, CONCAT(t.first_name, " ", t.last_name) AS tenant_name
             FROM rent_invoice i
             JOIN lease l ON l.lease_id = i.lease_id
             JOIN tenant_application a ON a.application_id = l.application_id
             JOIN tenant t ON t.tenant_id = a.tenant_id
             WHERE a.landlord_id = :landlord_id
             ORDER BY i.created_at DESC',
        );
        $statement->execute(['landlord_id' => $landlordId]);
        return ['status' => 200, 'body' => $statement->fetchAll()];
    }

    $tenantId = tenantIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT i.*, CONCAT(t.first_name, " ", t.last_name) AS tenant_name
         FROM rent_invoice i
         JOIN lease l ON l.lease_id = i.lease_id
         JOIN tenant_application a ON a.application_id = l.application_id
         JOIN tenant t ON t.tenant_id = a.tenant_id
         WHERE a.tenant_id = :tenant_id
         ORDER BY i.created_at DESC',
    );
    $statement->execute(['tenant_id' => $tenantId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function invoiceCreate(PDO $pdo, array $user, array $input): array
{
    if (($user['role'] ?? null) !== 'landlord') {
        throw new ApiException(403, 'Only landlords can create invoices.');
    }

    $landlordId = landlordIdForUser($pdo, $user);
    $leaseId = (int) ($input['lease_id'] ?? 0);
    $invoiceNumber = trim((string) ($input['invoice_number'] ?? ''));
    if ($leaseId <= 0 || $invoiceNumber === '') {
        throw new ApiException(422, 'Lease ID and invoice number are required.');
    }

    $statement = $pdo->prepare(
        'SELECT l.*, a.landlord_id
         FROM lease l
         JOIN tenant_application a ON a.application_id = l.application_id
         WHERE l.lease_id = :lease_id LIMIT 1',
    );
    $statement->execute(['lease_id' => $leaseId]);
    $lease = $statement->fetch();
    if (!$lease) {
        throw new ApiException(404, 'Lease not found.');
    }
    if ((int) $lease['landlord_id'] !== $landlordId) {
        throw new ApiException(403, 'You do not have access to this lease.');
    }

    $insert = $pdo->prepare(
        'INSERT INTO rent_invoice (lease_id, invoice_number, billing_period_start, billing_period_end, issue_date, due_date, total_amount, invoice_status)
         VALUES (:lease_id, :invoice_number, :billing_period_start, :billing_period_end, :issue_date, :due_date, :total_amount, :invoice_status)',
    );
    $insert->execute([
        'lease_id' => $leaseId,
        'invoice_number' => $invoiceNumber,
        'billing_period_start' => (string) ($input['billing_period_start'] ?? date('Y-m-01')),
        'billing_period_end' => (string) ($input['billing_period_end'] ?? date('Y-m-t')),
        'issue_date' => (string) ($input['issue_date'] ?? date('Y-m-d')),
        'due_date' => (string) ($input['due_date'] ?? date('Y-m-d')),
        'total_amount' => number_format((float) ($input['total_amount'] ?? 0), 2, '.', ''),
        'invoice_status' => 'unpaid',
    ]);

    $invoiceId = (int) $pdo->lastInsertId();
    $row = $pdo->prepare('SELECT * FROM rent_invoice WHERE invoice_id = :invoice_id LIMIT 1');
    $row->execute(['invoice_id' => $invoiceId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function invoiceStatusUpdate(PDO $pdo, array $user, int $invoiceId, array $input): array
{
    $status = strtolower(trim((string) ($input['status'] ?? '')));
    $allowed = ['unpaid', 'partially_paid', 'paid', 'overdue', 'void'];
    if (!in_array($status, $allowed, true)) {
        throw new ApiException(422, 'Invoice status is invalid.');
    }

    if (!invoiceBelongsToUser($pdo, $invoiceId, $user)) {
        throw new ApiException(403, 'You do not have access to this invoice.');
    }

    $update = $pdo->prepare('UPDATE rent_invoice SET invoice_status = :status WHERE invoice_id = :invoice_id');
    $update->execute(['status' => $status, 'invoice_id' => $invoiceId]);

    $row = $pdo->prepare('SELECT * FROM rent_invoice WHERE invoice_id = :invoice_id LIMIT 1');
    $row->execute(['invoice_id' => $invoiceId]);
    return ['status' => 200, 'body' => $row->fetch()];
}

function invoiceVerify(PDO $pdo, array $user, int $invoiceId, array $input): array
{
    return invoiceStatusUpdate($pdo, $user, $invoiceId, ['status' => (string) ($input['status'] ?? 'paid')]);
}

function paymentMethodsList(): array
{
    return ['status' => 200, 'body' => ['methods' => ['card', 'bank_transfer', 'e_wallet', 'cash', 'other']]];
}

function paymentList(PDO $pdo, array $user): array
{
    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        $statement = $pdo->prepare(
            'SELECT pa.*, p.payment_id, p.receipt_number, p.payment_status
             FROM payment_attempt pa
             JOIN rent_invoice i ON i.invoice_id = pa.invoice_id
             JOIN lease l ON l.lease_id = i.lease_id
             JOIN tenant_application a ON a.application_id = l.application_id
             LEFT JOIN payment p ON p.attempt_id = pa.attempt_id
             WHERE a.landlord_id = :landlord_id
             ORDER BY pa.initiated_at DESC',
        );
        $statement->execute(['landlord_id' => $landlordId]);
        return ['status' => 200, 'body' => $statement->fetchAll()];
    }

    $tenantId = tenantIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT pa.*, p.payment_id, p.receipt_number, p.payment_status
         FROM payment_attempt pa
         LEFT JOIN payment p ON p.attempt_id = pa.attempt_id
         WHERE pa.tenant_id = :tenant_id
         ORDER BY pa.initiated_at DESC',
    );
    $statement->execute(['tenant_id' => $tenantId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function paymentInitiate(PDO $pdo, array $user, array $input): array
{
    $invoiceId = (int) ($input['invoice_id'] ?? 0);
    if ($invoiceId <= 0) {
        throw new ApiException(422, 'Invoice ID is required.');
    }
    if (!invoiceBelongsToUser($pdo, $invoiceId, $user)) {
        throw new ApiException(403, 'You do not have access to this invoice.');
    }

    $invoice = $pdo->prepare('SELECT * FROM rent_invoice WHERE invoice_id = :invoice_id LIMIT 1');
    $invoice->execute(['invoice_id' => $invoiceId]);
    $invoiceRow = $invoice->fetch();
    if (!$invoiceRow) {
        throw new ApiException(404, 'Invoice not found.');
    }

    $tenantId = 0;
    if (($user['role'] ?? null) === 'tenant') {
        $tenantId = tenantIdForUser($pdo, $user);
    } else {
        $row = $pdo->prepare(
            'SELECT lt.tenant_id FROM lease_tenant lt JOIN lease l ON l.lease_id = lt.lease_id WHERE l.lease_id = (SELECT lease_id FROM rent_invoice WHERE invoice_id = :invoice_id) LIMIT 1',
        );
        $row->execute(['invoice_id' => $invoiceId]);
        $tenant = $row->fetch();
        $tenantId = $tenant ? (int) $tenant['tenant_id'] : 0;
    }

    $method = strtolower(trim((string) ($input['payment_method'] ?? 'card')));
    $gatewayName = trim((string) ($input['gateway_name'] ?? 'manual'));
    $gatewayReference = trim((string) ($input['gateway_reference'] ?? 'PAY-' . uniqid('', true)));
    $amount = (float) ($input['amount'] ?? $invoiceRow['total_amount'] ?? 0);
    $attemptStatus = strtolower(trim((string) ($input['attempt_status'] ?? 'pending')));
    if (!in_array($method, ['card', 'bank_transfer', 'e_wallet', 'cash', 'other'], true)) {
        throw new ApiException(422, 'Payment method is invalid.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO payment_attempt (invoice_id, tenant_id, gateway_name, gateway_reference, amount, payment_method, attempt_status, initiated_at, completed_at)
         VALUES (:invoice_id, :tenant_id, :gateway_name, :gateway_reference, :amount, :payment_method, :attempt_status, NOW(), :completed_at)',
    );
    $statement->execute([
        'invoice_id' => $invoiceId,
        'tenant_id' => $tenantId,
        'gateway_name' => $gatewayName,
        'gateway_reference' => $gatewayReference,
        'amount' => number_format($amount, 2, '.', ''),
        'payment_method' => $method,
        'attempt_status' => $attemptStatus,
        'completed_at' => in_array($attemptStatus, ['successful', 'failed', 'cancelled', 'expired'], true) ? date('Y-m-d H:i:s') : null,
    ]);

    $attemptId = (int) $pdo->lastInsertId();
    if ($attemptStatus === 'successful') {
        $receiptNumber = 'RCPT-' . uniqid('', true);
        $transactionReference = 'TXN-' . uniqid('', true);
        $paymentInsert = $pdo->prepare(
            'INSERT INTO payment (attempt_id, amount_paid, transaction_reference, receipt_number, payment_status, payment_date)
             VALUES (:attempt_id, :amount_paid, :transaction_reference, :receipt_number, :payment_status, NOW())',
        );
        $paymentInsert->execute([
            'attempt_id' => $attemptId,
            'amount_paid' => number_format($amount, 2, '.', ''),
            'transaction_reference' => $transactionReference,
            'receipt_number' => $receiptNumber,
            'payment_status' => 'completed',
        ]);
    }

    $row = $pdo->prepare('SELECT pa.*, p.payment_id, p.receipt_number, p.payment_status FROM payment_attempt pa LEFT JOIN payment p ON p.attempt_id = pa.attempt_id WHERE pa.attempt_id = :attempt_id LIMIT 1');
    $row->execute(['attempt_id' => $attemptId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function paymentStatusGet(PDO $pdo, array $user, int $attemptId): array
{
    $statement = $pdo->prepare(
        'SELECT pa.*, p.payment_id, p.receipt_number, p.payment_status
         FROM payment_attempt pa
         LEFT JOIN payment p ON p.attempt_id = pa.attempt_id
         WHERE pa.attempt_id = :attempt_id LIMIT 1',
    );
    $statement->execute(['attempt_id' => $attemptId]);
    $payment = $statement->fetch();
    if (!$payment) {
        throw new ApiException(404, 'Payment attempt not found.');
    }

    if (!invoiceBelongsToUser($pdo, (int) $payment['invoice_id'], $user)) {
        throw new ApiException(403, 'You do not have access to this payment.');
    }

    return ['status' => 200, 'body' => $payment];
}

function paymentReceiptGet(PDO $pdo, array $user, int $attemptId): array
{
    $statement = $pdo->prepare(
        'SELECT pa.*, p.*
         FROM payment_attempt pa
         JOIN payment p ON p.attempt_id = pa.attempt_id
         WHERE pa.attempt_id = :attempt_id LIMIT 1',
    );
    $statement->execute(['attempt_id' => $attemptId]);
    $payment = $statement->fetch();
    if (!$payment) {
        throw new ApiException(404, 'Receipt not found.');
    }
    if (!invoiceBelongsToUser($pdo, (int) $payment['invoice_id'], $user)) {
        throw new ApiException(403, 'You do not have access to this receipt.');
    }

    return ['status' => 200, 'body' => ['receipt' => $payment]];
}

function expenseList(PDO $pdo, array $user): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT e.*, p.property_name
         FROM expense e
         JOIN property p ON p.property_id = e.property_id
         WHERE p.landlord_id = :landlord_id
         ORDER BY e.expense_date DESC, e.created_at DESC',
    );
    $statement->execute(['landlord_id' => $landlordId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function expenseCreate(PDO $pdo, array $user, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $propertyId = (int) ($input['property_id'] ?? 0);
    if (!propertyBelongsToLandlord($pdo, $propertyId, $landlordId)) {
        throw new ApiException(422, 'Property does not belong to this landlord.');
    }

    $category = strtolower(trim((string) ($input['expense_category'] ?? '')));
    if (!in_array($category, ['maintenance', 'repairs', 'utilities', 'taxes', 'insurance', 'management', 'supplies', 'other'], true)) {
        throw new ApiException(422, 'Expense category is invalid.');
    }

    $insert = $pdo->prepare(
        'INSERT INTO expense (property_id, recorded_by, expense_category, description, amount, expense_date)
         VALUES (:property_id, :recorded_by, :expense_category, :description, :amount, :expense_date)',
    );
    $insert->execute([
        'property_id' => $propertyId,
        'recorded_by' => $user['user_id'],
        'expense_category' => $category,
        'description' => trim((string) ($input['description'] ?? '')) !== '' ? trim((string) $input['description']) : null,
        'amount' => number_format((float) ($input['amount'] ?? 0), 2, '.', ''),
        'expense_date' => (string) ($input['expense_date'] ?? date('Y-m-d')),
    ]);

    $expenseId = (int) $pdo->lastInsertId();
    $row = $pdo->prepare('SELECT * FROM expense WHERE expense_id = :expense_id LIMIT 1');
    $row->execute(['expense_id' => $expenseId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function expenseDelete(PDO $pdo, array $user, int $expenseId): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT e.* FROM expense e JOIN property p ON p.property_id = e.property_id WHERE e.expense_id = :expense_id AND p.landlord_id = :landlord_id LIMIT 1',
    );
    $statement->execute(['expense_id' => $expenseId, 'landlord_id' => $landlordId]);
    if (!$statement->fetch()) {
        throw new ApiException(404, 'Expense not found for this landlord.');
    }

    $delete = $pdo->prepare('DELETE FROM expense WHERE expense_id = :expense_id');
    $delete->execute(['expense_id' => $expenseId]);
    return ['status' => 200, 'body' => ['message' => 'Expense deleted.']];
}

function expenseSummary(PDO $pdo, array $user): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT e.expense_category, SUM(e.amount) AS total_amount
         FROM expense e
         JOIN property p ON p.property_id = e.property_id
         WHERE p.landlord_id = :landlord_id
         GROUP BY e.expense_category
         ORDER BY total_amount DESC',
    );
    $statement->execute(['landlord_id' => $landlordId]);
    $categories = $statement->fetchAll();
    $overall = $pdo->prepare(
        'SELECT SUM(e.amount) AS total_amount FROM expense e JOIN property p ON p.property_id = e.property_id WHERE p.landlord_id = :landlord_id',
    );
    $overall->execute(['landlord_id' => $landlordId]);
    $total = $overall->fetch();

    return ['status' => 200, 'body' => ['categories' => $categories, 'total_amount' => (float) ($total['total_amount'] ?? 0)]];
}

function maintenanceList(PDO $pdo, array $user): array
{
    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        $statement = $pdo->prepare(
            'SELECT mr.*, CONCAT(t.first_name, " ", t.last_name) AS tenant_name, u.unit_number
             FROM maintenance_request mr
             JOIN lease l ON l.lease_id = mr.lease_id
             JOIN tenant_application a ON a.application_id = l.application_id
             JOIN tenant t ON t.tenant_id = mr.tenant_id
             JOIN rental_unit u ON u.unit_id = l.unit_id
             WHERE a.landlord_id = :landlord_id
             ORDER BY mr.submitted_at DESC',
        );
        $statement->execute(['landlord_id' => $landlordId]);
        return ['status' => 200, 'body' => $statement->fetchAll()];
    }

    $tenantId = tenantIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT mr.*, CONCAT(t.first_name, " ", t.last_name) AS tenant_name, u.unit_number
         FROM maintenance_request mr
         JOIN tenant t ON t.tenant_id = mr.tenant_id
         JOIN lease l ON l.lease_id = mr.lease_id
         JOIN rental_unit u ON u.unit_id = l.unit_id
         WHERE mr.tenant_id = :tenant_id
         ORDER BY mr.submitted_at DESC',
    );
    $statement->execute(['tenant_id' => $tenantId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function maintenanceCreate(PDO $pdo, array $user, array $input): array
{
    if (($user['role'] ?? null) !== 'tenant') {
        throw new ApiException(403, 'Only tenants can create maintenance requests.');
    }

    $tenantId = tenantIdForUser($pdo, $user);
    $leaseId = (int) ($input['lease_id'] ?? 0);
    $title = trim((string) ($input['title'] ?? ''));
    $description = trim((string) ($input['description'] ?? ''));
    if ($leaseId <= 0 || $title === '' || $description === '') {
        throw new ApiException(422, 'Lease ID, title, and description are required.');
    }

    $statement = $pdo->prepare('SELECT 1 FROM lease_tenant WHERE lease_id = :lease_id AND tenant_id = :tenant_id AND (left_at IS NULL OR left_at >= CURDATE()) LIMIT 1');
    $statement->execute(['lease_id' => $leaseId, 'tenant_id' => $tenantId]);
    if (!$statement->fetch()) {
        throw new ApiException(403, 'This tenant is not assigned to the selected lease.');
    }

    $priority = strtolower(trim((string) ($input['priority'] ?? 'normal')));
    if (!in_array($priority, ['low', 'normal', 'high', 'urgent'], true)) {
        throw new ApiException(422, 'Priority is invalid.');
    }

    $insert = $pdo->prepare(
        'INSERT INTO maintenance_request (lease_id, tenant_id, title, description, priority, request_status)
         VALUES (:lease_id, :tenant_id, :title, :description, :priority, :request_status)',
    );
    $insert->execute([
        'lease_id' => $leaseId,
        'tenant_id' => $tenantId,
        'title' => $title,
        'description' => $description,
        'priority' => $priority,
        'request_status' => 'open',
    ]);

    $requestId = (int) $pdo->lastInsertId();
    $row = $pdo->prepare('SELECT * FROM maintenance_request WHERE request_id = :request_id LIMIT 1');
    $row->execute(['request_id' => $requestId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function maintenanceStatusUpdate(PDO $pdo, array $user, int $requestId, array $input): array
{
    $status = strtolower(trim((string) ($input['status'] ?? '')));
    if (!in_array($status, ['open', 'in_progress', 'completed', 'cancelled'], true)) {
        throw new ApiException(422, 'Maintenance status is invalid.');
    }

    $statement = $pdo->prepare(
        'SELECT mr.*, l.lease_id, a.landlord_id, a.tenant_id
         FROM maintenance_request mr
         JOIN lease l ON l.lease_id = mr.lease_id
         JOIN tenant_application a ON a.application_id = l.application_id
         WHERE mr.request_id = :request_id LIMIT 1',
    );
    $statement->execute(['request_id' => $requestId]);
    $request = $statement->fetch();
    if (!$request) {
        throw new ApiException(404, 'Maintenance request not found.');
    }

    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        if ((int) $request['landlord_id'] !== $landlordId) {
            throw new ApiException(403, 'You do not have access to this maintenance request.');
        }
    } elseif (($user['role'] ?? null) === 'tenant') {
        $tenantId = tenantIdForUser($pdo, $user);
        if ((int) $request['tenant_id'] !== $tenantId) {
            throw new ApiException(403, 'You do not have access to this maintenance request.');
        }
        if (!in_array($status, ['open', 'cancelled'], true)) {
            throw new ApiException(403, 'Tenants may only open or cancel maintenance requests.');
        }
    }

    $completedAt = $status === 'completed' ? date('Y-m-d H:i:s') : null;
    $update = $pdo->prepare('UPDATE maintenance_request SET request_status = :status, completed_at = :completed_at WHERE request_id = :request_id');
    $update->execute(['status' => $status, 'completed_at' => $completedAt, 'request_id' => $requestId]);

    $row = $pdo->prepare('SELECT * FROM maintenance_request WHERE request_id = :request_id LIMIT 1');
    $row->execute(['request_id' => $requestId]);
    return ['status' => 200, 'body' => $row->fetch()];
}

function notificationsList(PDO $pdo, array $user): array
{
    $statement = $pdo->prepare(
        'SELECT * FROM notification WHERE user_id = :user_id ORDER BY created_at DESC',
    );
    $statement->execute(['user_id' => $user['user_id']]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function notificationMarkRead(PDO $pdo, array $user, int $notificationId): array
{
    $statement = $pdo->prepare('SELECT * FROM notification WHERE notification_id = :notification_id AND user_id = :user_id LIMIT 1');
    $statement->execute(['notification_id' => $notificationId, 'user_id' => $user['user_id']]);
    if (!$statement->fetch()) {
        throw new ApiException(404, 'Notification not found.');
    }

    $update = $pdo->prepare('UPDATE notification SET is_read = TRUE WHERE notification_id = :notification_id');
    $update->execute(['notification_id' => $notificationId]);

    $row = $pdo->prepare('SELECT * FROM notification WHERE notification_id = :notification_id LIMIT 1');
    $row->execute(['notification_id' => $notificationId]);
    return ['status' => 200, 'body' => $row->fetch()];
}

function auditLogList(PDO $pdo, array $user): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT a.*
         FROM audit_log a
         JOIN users u ON u.user_id = a.user_id
         JOIN landlord l ON l.user_id = u.user_id
         WHERE l.landlord_id = :landlord_id
         ORDER BY a.created_at DESC',
    );
    $statement->execute(['landlord_id' => $landlordId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}
