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

function applicantTenantIdForUser(PDO $pdo, array $user): int
{
    if (!in_array($user['role'] ?? null, ['applicant', 'tenant'], true)) {
        throw new ApiException(403, 'Applicant access is required.');
    }

    $statement = $pdo->prepare('SELECT tenant_id FROM tenant WHERE user_id = :user_id LIMIT 1');
    $statement->execute(['user_id' => $user['user_id']]);
    $tenant = $statement->fetch();
    if (!$tenant) {
        throw new ApiException(404, 'Applicant profile was not found.');
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
        'SELECT t.tenant_id, t.user_id, t.first_name, t.middle_name, t.last_name, t.birthdate, t.email, t.phone, t.current_address, t.emergency_contact_name, t.emergency_contact_phone, t.employment_status, t.monthly_income, u.email AS login_email, u.role
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
    $profile['name'] = trim(implode(' ', array_filter([
        $profile['first_name'] ?? '',
        $profile['middle_name'] ?? '',
        $profile['last_name'] ?? '',
    ])));

    $docsStatement = $pdo->prepare(
        'SELECT document_id, document_type, original_name, file_size, content_type, verification_status, uploaded_at
         FROM tenant_document WHERE tenant_id = :tenant_id ORDER BY uploaded_at DESC',
    );
    $docsStatement->execute(['tenant_id' => $profile['tenant_id']]);
    $profile['documents'] = $docsStatement->fetchAll();

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
    if (!in_array($user['role'] ?? null, ['applicant', 'tenant'], true)) {
        throw new ApiException(403, 'Only applicants and tenants may view the landlord directory.');
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
                sc.criteria_name, sc.is_active AS criteria_is_active,
                CONCAT(t.first_name, " ", t.last_name) AS tenant_name
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

function seedDefaultScreeningCriteria(PDO $pdo, int $landlordId): void
{
    $defaults = [
        [
            'Proof of income',
            'Applicant must provide proof of a stable and sufficient source of income, such as payslips, certificate of employment, bank statements, or business income records. The landlord should assess whether the applicant can reasonably afford the monthly rent.',
        ],
        [
            'Valid government-issued ID',
            'Applicant must provide a valid government-issued identification document to verify their identity and ensure that the information provided in the rental application is accurate.',
        ],
        [
            'Employment verification',
            'Applicant should provide supporting documents confirming their current employment, business activity, or other legitimate source of income. Self-employed applicants may submit relevant business or income records.',
        ],
        [
            'Previous rental history',
            'Applicant may provide previous landlord references or rental records to help assess their history of fulfilling rental obligations, maintaining rental properties, and following lease agreements.',
        ],
        [
            'Personal references',
            'Applicant should provide contact information for at least one verifiable personal or professional reference who can confirm relevant information about the applicant.',
        ],
        [
            'Application document completeness',
            'Applicant must submit all required application information and supporting documents requested by the landlord before the screening process can be completed.',
        ],
    ];
    $ownsTransaction = !$pdo->inTransaction();
    if ($ownsTransaction) {
        $pdo->beginTransaction();
    }
    try {
        $marker = $pdo->prepare(
            'INSERT IGNORE INTO screening_criteria_defaults_initialized (landlord_id) VALUES (:landlord_id)',
        );
        $marker->execute(['landlord_id' => $landlordId]);
        if ($marker->rowCount() > 0) {
            $insert = $pdo->prepare(
                'INSERT IGNORE INTO screening_criteria (landlord_id, criteria_name, description, is_active)
                 SELECT :landlord_id, :criteria_name, :description, 1
                 WHERE NOT EXISTS (
                     SELECT 1 FROM screening_criteria
                     WHERE landlord_id = :existing_landlord_id
                       AND LOWER(criteria_name) = LOWER(:existing_name)
                 )',
            );
            foreach ($defaults as [$name, $description]) {
                $insert->execute([
                    'landlord_id' => $landlordId,
                    'criteria_name' => $name,
                    'description' => $description,
                    'existing_landlord_id' => $landlordId,
                    'existing_name' => $name,
                ]);
            }
        }
        if ($ownsTransaction) {
            $pdo->commit();
        }
    } catch (Throwable $error) {
        if ($ownsTransaction && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
}

function screeningEvaluationGet(PDO $pdo, array $user, int $applicationId): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $applicationQuery = $pdo->prepare(
        'SELECT a.application_id, a.application_status, a.application_date, a.desired_move_in_date,
                a.employment_status, a.monthly_income, a.additional_notes,
                CONCAT(t.first_name, " ", t.last_name) AS tenant_name
         FROM tenant_application a
         JOIN tenant t ON t.tenant_id = a.tenant_id
         WHERE a.application_id = :application_id AND a.landlord_id = :landlord_id',
    );
    $applicationQuery->execute(['application_id' => $applicationId, 'landlord_id' => $landlordId]);
    $application = $applicationQuery->fetch();
    if (!$application) {
        throw new ApiException(404, 'Application not found for this landlord.');
    }
    if ($application['application_status'] === 'withdrawn') {
        throw new ApiException(409, 'Withdrawn applications cannot be screened.');
    }

    $screeningResponse = screeningCreate($pdo, $user, $applicationId, []);
    $screening = $screeningResponse['body'];
    $criteriaQuery = $pdo->prepare(
        'SELECT c.criteria_id, c.criteria_name, c.description, c.is_active,
                sr.result_id, sr.result_status, sr.remarks, sr.verified_at,
                sr.evaluated_by, sr.created_at AS evaluation_created_at, sr.updated_at AS evaluation_updated_at,
                CONCAT(evaluator.first_name, " ", evaluator.last_name) AS evaluated_by_name
         FROM screening_criteria c
         LEFT JOIN screening_result sr ON sr.criteria_id = c.criteria_id AND sr.screening_id = :screening_id
         LEFT JOIN users evaluator_user ON evaluator_user.user_id = sr.evaluated_by
         LEFT JOIN landlord evaluator ON evaluator.user_id = evaluator_user.user_id
         WHERE c.landlord_id = :landlord_id
           AND (c.is_active = TRUE OR sr.result_id IS NOT NULL)
         ORDER BY c.is_active DESC, c.criteria_name ASC',
    );
    $criteriaQuery->execute(['screening_id' => $screening['screening_id'], 'landlord_id' => $landlordId]);
    $criteria = $criteriaQuery->fetchAll();

    $documentsQuery = $pdo->prepare(
        'SELECT document_type, verification_status, uploaded_at
         FROM application_document WHERE application_id = :application_id
         ORDER BY uploaded_at DESC',
    );
    $documentsQuery->execute(['application_id' => $applicationId]);
    $documents = $documentsQuery->fetchAll();

    $summary = [
        'total' => count($criteria),
        'passed' => 0,
        'failed' => 0,
        'pending' => 0,
        'not_applicable' => 0,
    ];
    foreach ($criteria as $criterion) {
        $status = $criterion['result_status'] ?? 'pending';
        if (array_key_exists($status, $summary)) {
            $summary[$status]++;
        }
    }
    $evaluated = $summary['passed'] + $summary['failed'] + $summary['not_applicable'];
    $summary['completion_percent'] = $summary['total'] > 0
        ? (int) round(($evaluated / $summary['total']) * 100)
        : 0;

    return ['status' => 200, 'body' => [
        'application' => $application,
        'screening' => $screening,
        'criteria' => $criteria,
        'documents' => $documents,
        'summary' => $summary,
    ]];
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
        $tenantId = applicantTenantIdForUser($pdo, $user);
        $params = ['tenant_id' => $tenantId];
        $changes = [];

        if (array_key_exists('first_name', $input)) {
            $firstName = trim((string) $input['first_name']);
            if ($firstName !== '') {
                $changes[] = 'first_name = :first_name';
                $params['first_name'] = $firstName;
            }
        }

        if (array_key_exists('middle_name', $input)) {
            $middleName = trim((string) $input['middle_name']);
            $changes[] = 'middle_name = :middle_name';
            $params['middle_name'] = $middleName !== '' ? $middleName : null;
        }

        if (array_key_exists('last_name', $input)) {
            $lastName = trim((string) $input['last_name']);
            if ($lastName !== '') {
                $changes[] = 'last_name = :last_name';
                $params['last_name'] = $lastName;
            }
        }

        if (array_key_exists('name', $input) && !array_key_exists('first_name', $input)) {
            $name = trim((string) $input['name']);
            if ($name !== '') {
                [$firstName, $lastName] = splitPersonName($name);
                $changes[] = 'first_name = :split_first_name';
                $changes[] = 'last_name = :split_last_name';
                $params['split_first_name'] = $firstName;
                $params['split_last_name'] = $lastName;
            }
        }

        if (array_key_exists('birthdate', $input)) {
            $birthdate = trim((string) $input['birthdate']);
            if ($birthdate !== '') {
                $birthdateValue = DateTimeImmutable::createFromFormat('!Y-m-d', $birthdate);
                if (!$birthdateValue || $birthdateValue->format('Y-m-d') !== $birthdate || $birthdateValue >= new DateTimeImmutable('today')) {
                    throw new ApiException(422, 'Enter a valid birthdate in the past.');
                }
                $changes[] = 'birthdate = :birthdate';
                $params['birthdate'] = $birthdateValue->format('Y-m-d');
            } else {
                $changes[] = 'birthdate = :birthdate';
                $params['birthdate'] = null;
            }
        }

        if (array_key_exists('phone', $input)) {
            $phone = trim((string) $input['phone']);
            $changes[] = 'phone = :phone';
            $params['phone'] = $phone !== '' ? $phone : null;
        }

        if (array_key_exists('current_address', $input)) {
            $currentAddress = trim((string) $input['current_address']);
            $changes[] = 'current_address = :current_address';
            $params['current_address'] = $currentAddress !== '' ? $currentAddress : null;
        }

        if (array_key_exists('emergency_contact_name', $input)) {
            $emergencyName = trim((string) $input['emergency_contact_name']);
            $changes[] = 'emergency_contact_name = :emergency_contact_name';
            $params['emergency_contact_name'] = $emergencyName !== '' ? $emergencyName : null;
        }

        if (array_key_exists('emergency_contact_phone', $input)) {
            $emergencyPhone = trim((string) $input['emergency_contact_phone']);
            $changes[] = 'emergency_contact_phone = :emergency_contact_phone';
            $params['emergency_contact_phone'] = $emergencyPhone !== '' ? $emergencyPhone : null;
        }

        if (array_key_exists('employment_status', $input)) {
            $emp = trim((string) $input['employment_status']);
            if ($emp !== '' && !in_array($emp, ['full_time', 'part_time', 'contract', 'self_employed', 'unemployed', 'other'], true)) {
                throw new ApiException(422, 'Select a valid employment status.');
            }
            $changes[] = 'employment_status = :employment_status';
            $params['employment_status'] = $emp !== '' ? $emp : null;
        }

        if (array_key_exists('monthly_income', $input)) {
            $income = $input['monthly_income'];
            if ($income !== '' && $income !== null) {
                if (!is_numeric($income) || (float) $income < 0 || (float) $income > 9999999999.99) {
                    throw new ApiException(422, 'Enter a valid non-negative monthly income.');
                }
                $changes[] = 'monthly_income = :monthly_income';
                $params['monthly_income'] = number_format((float) $income, 2, '.', '');
            } else {
                $changes[] = 'monthly_income = :monthly_income';
                $params['monthly_income'] = null;
            }
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

function publicListingList(PDO $pdo): array
{
    $statement = $pdo->query(
        "SELECT p.property_id, p.property_name, p.property_type, p.address, p.description,
                p.construction_date, u.unit_id, u.unit_number, u.unit_type, u.bedroom_count,
                u.bathroom_count, u.monthly_rent, u.security_deposit, u.description AS unit_description,
                l.business_name, l.first_name AS landlord_first_name, l.last_name AS landlord_last_name,
                COALESCE(r.average_rating, 0) AS average_rating, COALESCE(r.review_count, 0) AS review_count
         FROM property p
         JOIN rental_unit u ON u.property_id = p.property_id AND u.unit_status = 'vacant'
         JOIN landlord l ON l.landlord_id = p.landlord_id
         LEFT JOIN (
             SELECT property_id, AVG(rating) AS average_rating, COUNT(*) AS review_count
             FROM property_review
             GROUP BY property_id
         ) r ON r.property_id = p.property_id
         WHERE p.property_status = 'active' AND p.rental_classification <> 'commercial'
         ORDER BY p.created_at DESC, u.unit_number ASC",
    );
    $listings = $statement->fetchAll();
    $images = $pdo->prepare(
        'SELECT image_id, image_path FROM rental_unit_image WHERE unit_id = :unit_id ORDER BY image_id',
    );
    foreach ($listings as &$listing) {
        $images->execute(['unit_id' => $listing['unit_id']]);
        $listing['images'] = array_map(
            static fn (array $image): array => [
                'image_id' => (int) $image['image_id'],
                'image_url' => unitImageUrl((string) $image['image_path']),
            ],
            $images->fetchAll(),
        );
        $listing['unit_id'] = (int) $listing['unit_id'];
        $listing['property_id'] = (int) $listing['property_id'];
        $listing['bedroom_count'] = (int) $listing['bedroom_count'];
        $listing['bathroom_count'] = (int) $listing['bathroom_count'];
        $listing['average_rating'] = round((float) $listing['average_rating'], 1);
        $listing['review_count'] = (int) $listing['review_count'];
    }
    unset($listing);

    return ['status' => 200, 'body' => $listings];
}

function propertyReviewList(PDO $pdo, int $propertyId): array
{
    $property = $pdo->prepare(
        'SELECT 1 FROM property
         WHERE property_id = :property_id AND property_status = \'active\'
           AND rental_classification <> \'commercial\'
         LIMIT 1',
    );
    $property->execute(['property_id' => $propertyId]);
    if (!$property->fetch()) {
        throw new ApiException(404, 'Listing was not found.');
    }

    $reviews = $pdo->prepare(
        "SELECT r.review_id, r.rating, r.review_text, r.created_at,
                CONCAT(t.first_name, ' ', LEFT(t.last_name, 1), '.') AS reviewer_name
         FROM property_review r
         JOIN tenant t ON t.tenant_id = r.tenant_id
         WHERE r.property_id = :property_id
         ORDER BY r.created_at DESC, r.review_id DESC",
    );
    $reviews->execute(['property_id' => $propertyId]);
    return ['status' => 200, 'body' => $reviews->fetchAll()];
}

function propertyReviewCreate(PDO $pdo, array $user, int $propertyId, array $input): array
{
    if (($user['role'] ?? null) !== 'tenant') {
        throw new ApiException(403, 'Only current or former tenants may review a listing.');
    }

    $tenantId = tenantIdForUser($pdo, $user);
    $rating = filter_var($input['rating'] ?? null, FILTER_VALIDATE_INT);
    $reviewText = trim((string) ($input['review_text'] ?? ''));
    if ($rating === false || $rating < 1 || $rating > 5) {
        throw new ApiException(422, 'Choose a rating from 1 to 5 stars.');
    }
    if ($reviewText === '' || mb_strlen($reviewText) > 3000) {
        throw new ApiException(422, 'Write a review of 1 to 3000 characters.');
    }

    $lease = $pdo->prepare(
        "SELECT 1
         FROM tenant_application a
         JOIN lease l ON l.application_id = a.application_id
         JOIN rental_unit u ON u.unit_id = l.unit_id
         WHERE a.tenant_id = :tenant_id AND u.property_id = :property_id
           AND l.lease_status IN ('active', 'ended')
         LIMIT 1",
    );
    $lease->execute(['tenant_id' => $tenantId, 'property_id' => $propertyId]);
    if (!$lease->fetch()) {
        throw new ApiException(403, 'A current or former lease at this property is required to leave a review.');
    }

    try {
        $insert = $pdo->prepare(
            'INSERT INTO property_review (property_id, tenant_id, rating, review_text)
             VALUES (:property_id, :tenant_id, :rating, :review_text)',
        );
        $insert->execute([
            'property_id' => $propertyId,
            'tenant_id' => $tenantId,
            'rating' => $rating,
            'review_text' => $reviewText,
        ]);
    } catch (PDOException $error) {
        if ($error->getCode() === '23000') {
            throw new ApiException(409, 'You have already reviewed this listing.');
        }
        throw $error;
    }

    return ['status' => 201, 'body' => ['message' => 'Your review has been published.']];
}

function propertyCreate(PDO $pdo, array $user, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $propertyName = trim((string) ($input['property_name'] ?? $input['name'] ?? ''));
    $propertyType = strtolower(trim((string) ($input['property_type'] ?? '')));
    $address = trim((string) ($input['address'] ?? ''));
    $description = trim((string) ($input['description'] ?? ''));
    $rentalClassification = strtolower(trim((string) ($input['rental_classification'] ?? 'unknown')));
    $constructionDate = trim((string) ($input['construction_date'] ?? ''));

    if ($propertyName === '') {
        throw new ApiException(422, 'Property name is required.');
    }
    if ($address === '') {
        throw new ApiException(422, 'Property address is required.');
    }
    if (!in_array($propertyType, ['apartment', 'house', 'condo', 'townhouse', 'boarding_house', 'commercial', 'other'], true)) {
        throw new ApiException(422, 'Property type is invalid.');
    }
    if (!in_array($rentalClassification, ['residential', 'commercial', 'unknown'], true)) {
        throw new ApiException(422, 'Rental classification must be residential, commercial, or unknown.');
    }
    if ($constructionDate !== '' && !rentalDateIsValid($constructionDate)) {
        throw new ApiException(422, 'Construction date must be a valid calendar date.');
    }

    $existingProperty = $pdo->prepare(
        'SELECT 1 FROM property WHERE landlord_id = :landlord_id AND property_name = :property_name LIMIT 1',
    );
    $existingProperty->execute(['landlord_id' => $landlordId, 'property_name' => $propertyName]);
    if ($existingProperty->fetch()) {
        throw new ApiException(409, 'A property with this name already exists in your account.');
    }

    $statement = $pdo->prepare(
        'INSERT INTO property (landlord_id, property_name, property_type, address, description, rental_classification, construction_date, property_status)
         VALUES (:landlord_id, :property_name, :property_type, :address, :description, :rental_classification, :construction_date, :property_status)',
    );
    $statement->execute([
        'landlord_id' => $landlordId,
        'property_name' => $propertyName,
        'property_type' => $propertyType,
        'address' => $address,
        'description' => $description !== '' ? $description : null,
        'rental_classification' => $rentalClassification,
        'construction_date' => $constructionDate !== '' ? $constructionDate : null,
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

    $allowed = ['property_name', 'property_type', 'address', 'description', 'property_status', 'rental_classification', 'construction_date'];
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
        if ($field === 'rental_classification' && !in_array(strtolower($value), ['residential', 'commercial', 'unknown'], true)) {
            throw new ApiException(422, 'Rental classification must be residential, commercial, or unknown.');
        }
        if ($field === 'construction_date' && $value !== '' && !rentalDateIsValid($value)) {
            throw new ApiException(422, 'Construction date must be a valid calendar date.');
        }
        if ($field === 'construction_date' && $value === '') {
            $updates[] = 'construction_date = NULL';
            continue;
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
    } elseif (in_array($user['role'] ?? null, ['applicant', 'tenant'], true)) {
        $statement = $pdo->query(
            "SELECT u.*, p.property_name, p.address
             FROM rental_unit u
             JOIN property p ON p.property_id = u.property_id
             WHERE u.unit_status = 'vacant' AND p.property_status = 'active'
             ORDER BY p.property_name, u.unit_number",
        );
    } else {
        throw new ApiException(403, 'Applicant or tenant access is required.');
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
            'SELECT a.*, CONCAT_WS(" ", t.first_name, NULLIF(t.middle_name, ""), t.last_name) AS tenant_name,
                    t.birthdate, t.phone, t.current_address, t.emergency_contact_name, t.emergency_contact_phone,
                    p.property_name, u.unit_number
             FROM tenant_application a
             JOIN tenant t ON t.tenant_id = a.tenant_id
             LEFT JOIN rental_unit u ON u.unit_id = a.unit_id
             LEFT JOIN property p ON p.property_id = u.property_id
             WHERE a.landlord_id = :landlord_id
             ORDER BY a.application_date DESC',
        );
        $statement->execute(['landlord_id' => $landlordId]);
        return ['status' => 200, 'body' => $statement->fetchAll()];
    }

    $tenantId = applicantTenantIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT a.*, CONCAT_WS(" ", t.first_name, NULLIF(t.middle_name, ""), t.last_name) AS tenant_name,
                p.property_name, u.unit_number
         FROM tenant_application a
         JOIN tenant t ON t.tenant_id = a.tenant_id
         LEFT JOIN rental_unit u ON u.unit_id = a.unit_id
         LEFT JOIN property p ON p.property_id = u.property_id
         WHERE a.tenant_id = :tenant_id
         ORDER BY a.application_date DESC',
    );
    $statement->execute(['tenant_id' => $tenantId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function applicationCreate(PDO $pdo, array $user, array $input): array
{
    if (!in_array($user['role'] ?? null, ['applicant', 'tenant'], true)) {
        throw new ApiException(403, 'Only applicants and tenants may create applications.');
    }

    $tenantId = applicantTenantIdForUser($pdo, $user);
    $unitId = (int) ($input['unit_id'] ?? 0);
    if ($unitId <= 0) {
        throw new ApiException(422, 'Choose a listing before submitting an application.');
    }

    $desiredMoveIn = $input['desired_move_in_date'] ?? null;
    $notes = trim((string) ($input['additional_notes'] ?? ''));
    if ($desiredMoveIn !== null && $desiredMoveIn !== '' && !rentalDateIsValid((string) $desiredMoveIn)) {
        throw new ApiException(422, 'Desired move-in date must be a valid calendar date.');
    }

    $unit = $pdo->prepare(
        "SELECT u.unit_id, p.landlord_id, u.unit_status
         FROM rental_unit u
         JOIN property p ON p.property_id = u.property_id
         WHERE u.unit_id = :unit_id AND p.property_status = 'active'
         LIMIT 1",
    );
    $unit->execute(['unit_id' => $unitId]);
    $listing = $unit->fetch();
    if (!$listing || $listing['unit_status'] !== 'vacant') {
        throw new ApiException(409, 'This listing is no longer available.');
    }
    $landlordId = (int) $listing['landlord_id'];
    $duplicate = $pdo->prepare(
        "SELECT 1 FROM tenant_application
         WHERE tenant_id = :tenant_id AND unit_id = :unit_id
           AND application_status NOT IN ('rejected', 'withdrawn')
         LIMIT 1",
    );
    $duplicate->execute(['tenant_id' => $tenantId, 'unit_id' => $unitId]);
    if ($duplicate->fetch()) {
        throw new ApiException(409, 'You already have an active application for this listing.');
    }

    $tenantProfile = $pdo->prepare('SELECT * FROM tenant WHERE tenant_id = :tenant_id');
    $tenantProfile->execute(['tenant_id' => $tenantId]);
    $profile = $tenantProfile->fetch();

    $docsStmt = $pdo->prepare('SELECT document_type FROM tenant_document WHERE tenant_id = :tenant_id');
    $docsStmt->execute(['tenant_id' => $tenantId]);
    $docTypes = $docsStmt->fetchAll(PDO::FETCH_COLUMN);

    $missing = [];
    if (empty($profile['phone'])) $missing[] = 'phone number';
    if (empty($profile['current_address'])) $missing[] = 'current address';
    if (empty($profile['birthdate'])) $missing[] = 'birthdate';
    if (empty($profile['emergency_contact_name']) || empty($profile['emergency_contact_phone'])) $missing[] = 'emergency contact details';
    if (!in_array('government_id', $docTypes, true)) $missing[] = 'government-issued photo ID';
    if (!in_array('proof_of_income', $docTypes, true)) $missing[] = 'proof of income';

    if (count($missing) > 0) {
        throw new ApiException(422, 'Please complete your profile and upload required documents before applying. Missing: ' . implode(', ', $missing) . '.');
    }

    $insert = $pdo->prepare(
        'INSERT INTO tenant_application (tenant_id, landlord_id, unit_id, desired_move_in_date, employment_status, monthly_income, additional_notes, application_status, reviewed_at)
         VALUES (:tenant_id, :landlord_id, :unit_id, :desired_move_in_date, :employment_status, :monthly_income, :additional_notes, :application_status, NULL)',
    );
    $insert->execute([
        'tenant_id' => $tenantId,
        'landlord_id' => $landlordId,
        'unit_id' => $unitId,
        'desired_move_in_date' => $desiredMoveIn !== null && $desiredMoveIn !== '' ? $desiredMoveIn : null,
        'employment_status' => $profile['employment_status'],
        'monthly_income' => $profile['monthly_income'],
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
    } elseif (in_array($user['role'] ?? null, ['applicant', 'tenant'], true)) {
        $tenantId = applicantTenantIdForUser($pdo, $user);
        if ((int) $application['tenant_id'] !== $tenantId) {
            throw new ApiException(403, 'You do not have access to this application.');
        }
        if (!in_array($status, ['submitted', 'withdrawn'], true)) {
            throw new ApiException(403, 'Applicants may only withdraw their own applications.');
        }
    } else {
        throw new ApiException(403, 'Access denied.');
    }

    $reviewedAt = in_array($status, ['approved', 'rejected', 'under_review'], true) ? date('Y-m-d H:i:s') : null;
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare(
            'UPDATE tenant_application SET application_status = :status, reviewed_at = :reviewed_at WHERE application_id = :application_id',
        );
        $statement->execute([
            'status' => $status,
            'reviewed_at' => $reviewedAt,
            'application_id' => $applicationId,
        ]);
        if (($user['role'] ?? null) === 'landlord' && $status === 'approved') {
            $promoteApplicant = $pdo->prepare(
                "UPDATE users u
                 JOIN tenant t ON t.user_id = u.user_id
                 SET u.role = 'tenant'
                 WHERE t.tenant_id = :tenant_id AND u.role = 'applicant'",
            );
            $promoteApplicant->execute(['tenant_id' => $application['tenant_id']]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

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

    assertApplicationDocumentAccess($pdo, $user, $application);

    $documents = $pdo->prepare(
        "SELECT document_id, document_type, original_name AS file_path, verification_status,
                uploaded_at, 'tenant' AS document_source
         FROM tenant_document WHERE tenant_id = :tenant_id
         UNION ALL
         SELECT document_id, document_type, file_path, verification_status,
                uploaded_at, 'application' AS document_source
         FROM application_document WHERE application_id = :application_id
         ORDER BY uploaded_at DESC",
    );
    $documents->execute([
        'tenant_id' => $application['tenant_id'],
        'application_id' => $applicationId,
    ]);
    return ['status' => 200, 'body' => $documents->fetchAll()];
}

function assertTenantDocumentAccess(PDO $pdo, array $user, int $tenantId): void
{
    if (($user['role'] ?? null) === 'landlord') {
        $landlordId = landlordIdForUser($pdo, $user);
        $statement = $pdo->prepare(
            'SELECT 1 FROM tenant_application
             WHERE tenant_id = :tenant_id AND landlord_id = :landlord_id LIMIT 1',
        );
        $statement->execute(['tenant_id' => $tenantId, 'landlord_id' => $landlordId]);
        if ($statement->fetch()) {
            return;
        }
        throw new ApiException(403, 'You do not have access to this document.');
    }

    if (in_array($user['role'] ?? null, ['applicant', 'tenant'], true)
        && $tenantId === applicantTenantIdForUser($pdo, $user)) {
        return;
    }

    throw new ApiException(403, 'You do not have access to this document.');
}

function tenantDocumentDownload(PDO $pdo, array $user, int $documentId): array
{
    $statement = $pdo->prepare('SELECT * FROM tenant_document WHERE document_id = :document_id LIMIT 1');
    $statement->execute(['document_id' => $documentId]);
    $document = $statement->fetch();
    if (!$document) {
        throw new ApiException(404, 'Document was not found.');
    }
    assertTenantDocumentAccess($pdo, $user, (int) $document['tenant_id']);

    $path = dirname(__DIR__) . '/storage/private-documents/' . basename((string) $document['file_path']);
    if (!is_file($path) || !is_readable($path)) {
        throw new ApiException(404, 'The document file is unavailable.');
    }

    return ['status' => 200, 'file' => [
        'path' => $path,
        'content_type' => $document['content_type'],
        'original_name' => $document['original_name'],
    ]];
}

function tenantDocumentVerificationUpdate(PDO $pdo, array $user, int $documentId, array $input): array
{
    $status = strtolower(trim((string) ($input['verification_status'] ?? '')));
    if (!in_array($status, ['pending', 'verified', 'rejected'], true)) {
        throw new ApiException(422, 'Verification status is invalid.');
    }

    $statement = $pdo->prepare('SELECT * FROM tenant_document WHERE document_id = :document_id LIMIT 1');
    $statement->execute(['document_id' => $documentId]);
    $document = $statement->fetch();
    if (!$document) {
        throw new ApiException(404, 'Document was not found.');
    }
    assertTenantDocumentAccess($pdo, $user, (int) $document['tenant_id']);
    if (($user['role'] ?? null) !== 'landlord' && $status !== 'pending') {
        throw new ApiException(403, 'Applicants and tenants may only reset document verification to pending.');
    }

    $update = $pdo->prepare(
        'UPDATE tenant_document SET verification_status = :status WHERE document_id = :document_id',
    );
    $update->execute(['status' => $status, 'document_id' => $documentId]);
    return ['status' => 200, 'body' => [
        'document_id' => (int) $documentId,
        'verification_status' => $status,
    ]];
}

function tenantDocumentUpload(PDO $pdo, array $user, array $uploads, array $input): array
{
    if (!in_array($user['role'] ?? null, ['applicant', 'tenant'], true)) {
        throw new ApiException(403, 'Applicant or tenant access is required.');
    }
    $tenantId = applicantTenantIdForUser($pdo, $user);

    $allowedTypes = ['government_id', 'proof_of_income', 'reference_letter'];
    $allowedMimeTypes = [
        'application/pdf' => '.pdf',
        'image/jpeg' => '.jpg',
        'image/png' => '.png',
    ];

    $documentType = strtolower(trim((string) ($input['document_type'] ?? '')));
    $upload = null;
    if ($documentType !== '' && isset($uploads['file']) && is_array($uploads['file'])) {
        $upload = $uploads['file'];
    } elseif ($documentType !== '' && isset($uploads[$documentType]) && is_array($uploads[$documentType])) {
        $upload = $uploads[$documentType];
    } else {
        foreach ($allowedTypes as $type) {
            if (isset($uploads[$type]) && is_array($uploads[$type]) && ($uploads[$type]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $documentType = $type;
                $upload = $uploads[$type];
                break;
            }
        }
    }

    if (!in_array($documentType, $allowedTypes, true)) {
        throw new ApiException(422, 'Select a valid document type: government_id, proof_of_income, or reference_letter.');
    }

    if (!is_array($upload) || ($upload['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        throw new ApiException(422, 'Please choose a document file to upload.');
    }
    if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new ApiException(422, 'File upload failed. The file must be no larger than 10 MB.');
    }

    $temporaryPath = (string) ($upload['tmp_name'] ?? '');
    $fileSize = (int) ($upload['size'] ?? 0);
    if ($fileSize <= 0 || $fileSize > 10 * 1024 * 1024 || !is_uploaded_file($temporaryPath)) {
        throw new ApiException(422, 'Document file must be a valid upload no larger than 10 MB.');
    }

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo === false) {
        throw new ApiException(500, 'Document validation is unavailable.');
    }
    $contentType = finfo_file($finfo, $temporaryPath);
    finfo_close($finfo);

    if (!isset($allowedMimeTypes[$contentType])) {
        throw new ApiException(422, 'Document must be a PDF, JPEG, or PNG file.');
    }

    $extension = $allowedMimeTypes[$contentType];
    $originalName = basename((string) ($upload['name'] ?? 'document'));
    if ($originalName === '' || strlen($originalName) > 255) {
        throw new ApiException(422, 'Document file name must be no longer than 255 characters.');
    }

    $directory = dirname(__DIR__) . '/storage/private-documents';
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new ApiException(500, 'Private document storage is unavailable.');
    }

    $filename = bin2hex(random_bytes(24)) . $extension;
    $destination = $directory . '/' . $filename;
    if (!move_uploaded_file($temporaryPath, $destination)) {
        throw new ApiException(500, 'Unable to save the uploaded document.');
    }

    $existingStmt = $pdo->prepare('SELECT document_id, file_path FROM tenant_document WHERE tenant_id = :tenant_id AND document_type = :document_type LIMIT 1');
    $existingStmt->execute(['tenant_id' => $tenantId, 'document_type' => $documentType]);
    $existing = $existingStmt->fetch();

    if ($existing) {
        $oldFile = $directory . '/' . basename((string) $existing['file_path']);
        if (is_file($oldFile)) {
            @unlink($oldFile);
        }
        $updateStmt = $pdo->prepare(
            'UPDATE tenant_document
             SET file_path = :file_path, original_name = :original_name, content_type = :content_type, file_size = :file_size, verification_status = "pending", uploaded_at = CURRENT_TIMESTAMP
             WHERE document_id = :document_id',
        );
        $updateStmt->execute([
            'file_path' => $filename,
            'original_name' => $originalName,
            'content_type' => $contentType,
            'file_size' => $fileSize,
            'document_id' => $existing['document_id'],
        ]);
        $documentId = (int) $existing['document_id'];
    } else {
        $insertStmt = $pdo->prepare(
            'INSERT INTO tenant_document (tenant_id, document_type, file_path, original_name, content_type, file_size, verification_status, uploaded_at)
             VALUES (:tenant_id, :document_type, :file_path, :original_name, :content_type, :file_size, "pending", CURRENT_TIMESTAMP)',
        );
        $insertStmt->execute([
            'tenant_id' => $tenantId,
            'document_type' => $documentType,
            'file_path' => $filename,
            'original_name' => $originalName,
            'content_type' => $contentType,
            'file_size' => $fileSize,
        ]);
        $documentId = (int) $pdo->lastInsertId();
    }

    $listStmt = $pdo->prepare(
        'SELECT document_id, document_type, original_name, file_size, content_type, verification_status, uploaded_at
         FROM tenant_document WHERE tenant_id = :tenant_id ORDER BY uploaded_at DESC',
    );
    $listStmt->execute(['tenant_id' => $tenantId]);
    $documents = $listStmt->fetchAll();

    return [
        'status' => 200,
        'body' => [
            'message' => 'Document uploaded successfully.',
            'document_id' => $documentId,
            'documents' => $documents,
        ],
    ];
}

function tenantDocumentsList(PDO $pdo, array $user): array
{
    if (!in_array($user['role'] ?? null, ['applicant', 'tenant'], true)) {
        throw new ApiException(403, 'Applicant or tenant access is required.');
    }
    $tenantId = applicantTenantIdForUser($pdo, $user);

    $listStmt = $pdo->prepare(
        'SELECT document_id, document_type, original_name, file_size, content_type, verification_status, uploaded_at
         FROM tenant_document WHERE tenant_id = :tenant_id ORDER BY uploaded_at DESC',
    );
    $listStmt->execute(['tenant_id' => $tenantId]);
    return ['status' => 200, 'body' => $listStmt->fetchAll()];
}

function tenantDocumentDelete(PDO $pdo, array $user, int $documentId): array
{
    if (!in_array($user['role'] ?? null, ['applicant', 'tenant'], true)) {
        throw new ApiException(403, 'Applicant or tenant access is required.');
    }
    $tenantId = applicantTenantIdForUser($pdo, $user);

    $stmt = $pdo->prepare('SELECT * FROM tenant_document WHERE document_id = :document_id AND tenant_id = :tenant_id LIMIT 1');
    $stmt->execute(['document_id' => $documentId, 'tenant_id' => $tenantId]);
    $document = $stmt->fetch();
    if (!$document) {
        throw new ApiException(404, 'Document not found.');
    }

    $path = dirname(__DIR__) . '/storage/private-documents/' . basename((string) $document['file_path']);
    if (is_file($path)) {
        @unlink($path);
    }

    $deleteStmt = $pdo->prepare('DELETE FROM tenant_document WHERE document_id = :document_id');
    $deleteStmt->execute(['document_id' => $documentId]);

    $listStmt = $pdo->prepare(
        'SELECT document_id, document_type, original_name, file_size, content_type, verification_status, uploaded_at
         FROM tenant_document WHERE tenant_id = :tenant_id ORDER BY uploaded_at DESC',
    );
    $listStmt->execute(['tenant_id' => $tenantId]);

    return ['status' => 200, 'body' => [
        'message' => 'Document deleted.',
        'documents' => $listStmt->fetchAll(),
    ]];
}

function applicationDocumentCreate(PDO $pdo, array $user, int $applicationId, array $input): array
{
    $statement = $pdo->prepare('SELECT * FROM tenant_application WHERE application_id = :application_id LIMIT 1');
    $statement->execute(['application_id' => $applicationId]);
    $application = $statement->fetch();
    if (!$application) {
        throw new ApiException(404, 'Application not found.');
    }

    if (!in_array($user['role'] ?? null, ['landlord', 'applicant', 'tenant'], true)) {
        throw new ApiException(403, 'Access denied.');
    }
    assertApplicationDocumentAccess($pdo, $user, $application);

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
        if ((int) $document['landlord_id'] !== landlordIdForUser($pdo, $user)) {
            throw new ApiException(403, 'You do not have access to this document.');
        }
    } elseif (in_array($user['role'] ?? null, ['applicant', 'tenant'], true)) {
        if ((int) $document['tenant_id'] !== applicantTenantIdForUser($pdo, $user)) {
            throw new ApiException(403, 'You do not have access to this document.');
        }
        if ($status !== 'pending') {
            throw new ApiException(403, 'Applicants and tenants may only set document verification back to pending.');
        }
    } else {
        throw new ApiException(403, 'Access denied.');
    }

    $update = $pdo->prepare('UPDATE application_document SET verification_status = :status WHERE document_id = :document_id');
    $update->execute(['status' => $status, 'document_id' => $documentId]);

    $row = $pdo->prepare('SELECT * FROM application_document WHERE document_id = :document_id LIMIT 1');
    $row->execute(['document_id' => $documentId]);
    return ['status' => 200, 'body' => $row->fetch()];
}

function assertApplicationDocumentAccess(PDO $pdo, array $user, array $application): void
{
    if (($user['role'] ?? null) === 'landlord') {
        if ((int) $application['landlord_id'] !== landlordIdForUser($pdo, $user)) {
            throw new ApiException(403, 'You do not have access to this application.');
        }
        return;
    }
    if (in_array($user['role'] ?? null, ['applicant', 'tenant'], true)
        && (int) $application['tenant_id'] === applicantTenantIdForUser($pdo, $user)) {
        return;
    }
    throw new ApiException(403, 'You do not have access to this application.');
}

function screeningCriteriaList(PDO $pdo, array $user): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    seedDefaultScreeningCriteria($pdo, $landlordId);
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
    $description = trim((string) ($input['description'] ?? ''));
    if ($name === '' || mb_strlen($name) > 150) {
        throw new ApiException(422, 'Criteria name is required and must be 150 characters or fewer.');
    }
    if (mb_strlen($description) > 5000) {
        throw new ApiException(422, 'Criterion description must be 5000 characters or fewer.');
    }
    if (array_key_exists('is_active', $input)
        && !in_array($input['is_active'], [true, false, 0, 1, '0', '1'], true)) {
        throw new ApiException(422, 'Criterion active state must be a boolean.');
    }
    $duplicate = $pdo->prepare(
        'SELECT criteria_id FROM screening_criteria
         WHERE landlord_id = :landlord_id AND LOWER(criteria_name) = LOWER(:criteria_name) LIMIT 1',
    );
    $duplicate->execute(['landlord_id' => $landlordId, 'criteria_name' => $name]);
    if ($duplicate->fetchColumn()) {
        throw new ApiException(409, 'A screening criterion with this name already exists.');
    }

    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare(
            'INSERT INTO screening_criteria (landlord_id, criteria_name, description, is_active)
             VALUES (:landlord_id, :criteria_name, :description, :is_active)',
        );
        $statement->execute([
            'landlord_id' => $landlordId,
            'criteria_name' => $name,
            'description' => $description !== '' ? $description : null,
            'is_active' => array_key_exists('is_active', $input) ? (bool) $input['is_active'] : true,
        ]);

        $criteriaId = (int) $pdo->lastInsertId();
        recordAudit($pdo, $user, 'screening_criterion_created', 'screening_criteria', $criteriaId, [
            'criteria_name' => $name,
            'is_active' => array_key_exists('is_active', $input) ? (bool) $input['is_active'] : true,
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($error instanceof PDOException && (string) $error->getCode() === '23000') {
            throw new ApiException(409, 'A screening criterion with this name already exists.');
        }
        throw $error;
    }
    $row = $pdo->prepare('SELECT * FROM screening_criteria WHERE criteria_id = :criteria_id LIMIT 1');
    $row->execute(['criteria_id' => $criteriaId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function screeningCriterionUpdate(PDO $pdo, array $user, int $criteriaId, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare('SELECT * FROM screening_criteria WHERE criteria_id = :criteria_id AND landlord_id = :landlord_id LIMIT 1');
    $statement->execute(['criteria_id' => $criteriaId, 'landlord_id' => $landlordId]);
    $criterion = $statement->fetch();
    if (!$criterion) {
        throw new ApiException(404, 'Screening criterion not found.');
    }

    $name = array_key_exists('criteria_name', $input) || array_key_exists('name', $input)
        ? trim((string) ($input['criteria_name'] ?? $input['name'] ?? ''))
        : (string) $criterion['criteria_name'];
    $description = array_key_exists('description', $input)
        ? trim((string) ($input['description'] ?? ''))
        : $criterion['description'];
    if ($name === '' || mb_strlen($name) > 150) {
        throw new ApiException(422, 'Criteria name is required and must be 150 characters or fewer.');
    }
    if ($description !== null && mb_strlen((string) $description) > 5000) {
        throw new ApiException(422, 'Criterion description must be 5000 characters or fewer.');
    }
    if (array_key_exists('is_active', $input)
        && !in_array($input['is_active'], [true, false, 0, 1, '0', '1'], true)) {
        throw new ApiException(422, 'Criterion active state must be a boolean.');
    }
    $duplicate = $pdo->prepare(
        'SELECT criteria_id FROM screening_criteria
         WHERE landlord_id = :landlord_id AND LOWER(criteria_name) = LOWER(:criteria_name)
           AND criteria_id <> :criteria_id LIMIT 1',
    );
    $duplicate->execute([
        'landlord_id' => $landlordId,
        'criteria_name' => $name,
        'criteria_id' => $criteriaId,
    ]);
    if ($duplicate->fetchColumn()) {
        throw new ApiException(409, 'A screening criterion with this name already exists.');
    }

    $updates = [];
    $params = ['criteria_id' => $criteriaId];

    $updates[] = 'criteria_name = :criteria_name';
    $params['criteria_name'] = $name;
    $updates[] = 'description = :description';
    $params['description'] = $description !== null && $description !== '' ? $description : null;
    $updates[] = 'is_active = :is_active';
    $params['is_active'] = array_key_exists('is_active', $input)
        ? (bool) $input['is_active']
        : (bool) $criterion['is_active'];

    $pdo->beginTransaction();
    try {
        $sql = 'UPDATE screening_criteria SET ' . implode(', ', $updates) . ' WHERE criteria_id = :criteria_id';
        $pdo->prepare($sql)->execute($params);
        recordAudit($pdo, $user, 'screening_criterion_updated', 'screening_criteria', $criteriaId, [
            'criteria_name' => $name,
            'is_active' => (bool) $params['is_active'],
        ]);
        $screenings = $pdo->prepare(
            'SELECT s.screening_id FROM screening s
             JOIN tenant_application a ON a.application_id = s.application_id
             WHERE a.landlord_id = :landlord_id',
        );
        $screenings->execute(['landlord_id' => $landlordId]);
        foreach ($screenings->fetchAll(PDO::FETCH_COLUMN) as $screeningId) {
            refreshScreeningStatus($pdo, (int) $screeningId, $landlordId);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($error instanceof PDOException && (string) $error->getCode() === '23000') {
            throw new ApiException(409, 'A screening criterion with this name already exists.');
        }
        throw $error;
    }

    $row = $pdo->prepare('SELECT * FROM screening_criteria WHERE criteria_id = :criteria_id LIMIT 1');
    $row->execute(['criteria_id' => $criteriaId]);
    return ['status' => 200, 'body' => $row->fetch()];
}

function screeningCriterionDelete(PDO $pdo, array $user, int $criteriaId): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare(
            'SELECT * FROM screening_criteria
             WHERE criteria_id = :criteria_id AND landlord_id = :landlord_id FOR UPDATE',
        );
        $statement->execute(['criteria_id' => $criteriaId, 'landlord_id' => $landlordId]);
        $criterion = $statement->fetch();
        if (!$criterion) {
            throw new ApiException(404, 'Screening criterion not found.');
        }
        $usage = $pdo->prepare('SELECT COUNT(*) FROM screening_result WHERE criteria_id = :criteria_id');
        $usage->execute(['criteria_id' => $criteriaId]);
        if ((int) $usage->fetchColumn() > 0) {
            throw new ApiException(409, 'This criterion has evaluation history and cannot be deleted. Deactivate it to preserve the record.');
        }
        $pdo->prepare('DELETE FROM screening_criteria WHERE criteria_id = :criteria_id')
            ->execute(['criteria_id' => $criteriaId]);
        recordAudit($pdo, $user, 'screening_criterion_deleted', 'screening_criteria', $criteriaId, [
            'criteria_name' => $criterion['criteria_name'],
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($error instanceof PDOException && (string) $error->getCode() === '23000') {
            throw new ApiException(409, 'This criterion has evaluation history and cannot be deleted. Deactivate it to preserve the record.');
        }
        throw $error;
    }
    return ['status' => 200, 'body' => ['deleted' => true, 'criteria_id' => $criteriaId]];
}

function refreshScreeningStatus(PDO $pdo, int $screeningId, int $landlordId): void
{
    $activeCountQuery = $pdo->prepare(
        'SELECT COUNT(*) FROM screening_criteria
         WHERE landlord_id = :landlord_id AND is_active = TRUE',
    );
    $activeCountQuery->execute(['landlord_id' => $landlordId]);
    $activeCount = (int) $activeCountQuery->fetchColumn();
    $resultCounts = $pdo->prepare(
        "SELECT
            SUM(CASE WHEN sr.result_status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
            SUM(CASE WHEN sr.result_status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
            COUNT(sr.result_id) AS result_count
         FROM screening_result sr
         JOIN screening_criteria sc ON sc.criteria_id = sr.criteria_id
         WHERE sr.screening_id = :screening_id AND sc.is_active = TRUE",
    );
    $resultCounts->execute(['screening_id' => $screeningId]);
    $counts = $resultCounts->fetch();
    $pendingCount = (int) $counts['pending_count'] + max(0, $activeCount - (int) $counts['result_count']);
    $status = (int) $counts['failed_count'] > 0
        ? 'failed'
        : ($activeCount > 0 && $pendingCount === 0 ? 'passed' : 'in_progress');
    $pdo->prepare('UPDATE screening SET screening_status = :status WHERE screening_id = :screening_id')
        ->execute(['status' => $status, 'screening_id' => $screeningId]);
}

function screeningCreate(PDO $pdo, array $user, int $applicationId, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $remarks = trim((string) ($input['remarks'] ?? ''));
    if (mb_strlen($remarks) > 5000) {
        throw new ApiException(422, 'Reviewer remarks must be 5000 characters or fewer.');
    }
    seedDefaultScreeningCriteria($pdo, $landlordId);
    $pdo->beginTransaction();
    try {
        $applicationQuery = $pdo->prepare(
            'SELECT * FROM tenant_application WHERE application_id = :application_id FOR UPDATE',
        );
        $applicationQuery->execute(['application_id' => $applicationId]);
        $application = $applicationQuery->fetch();
        if (!$application) {
            throw new ApiException(404, 'Application not found.');
        }
        if ((int) $application['landlord_id'] !== $landlordId) {
            throw new ApiException(403, 'You do not have access to this application.');
        }
        if ($application['application_status'] === 'withdrawn') {
            throw new ApiException(409, 'Withdrawn applications cannot be screened.');
        }

        $existing = $pdo->prepare('SELECT * FROM screening WHERE application_id = :application_id');
        $existing->execute(['application_id' => $applicationId]);
        $screening = $existing->fetch();
        if (!$screening && in_array($application['application_status'], ['approved', 'rejected'], true)) {
            throw new ApiException(409, 'A screening must be started before an application receives a final decision.');
        }
        if ($screening) {
            $screeningId = (int) $screening['screening_id'];
        } else {
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
            recordAudit($pdo, $user, 'screening_started', 'screening', $screeningId, [
                'application_id' => $applicationId,
            ]);
        }
        $pdo->prepare(
            "INSERT IGNORE INTO screening_result (screening_id, criteria_id, result_status)
             SELECT :screening_id, criteria_id, 'pending'
             FROM screening_criteria WHERE landlord_id = :landlord_id AND is_active = TRUE",
        )->execute(['screening_id' => $screeningId, 'landlord_id' => $landlordId]);
        refreshScreeningStatus($pdo, $screeningId, $landlordId);
        if ($remarks !== '') {
            $pdo->prepare('UPDATE screening SET remarks = :remarks WHERE screening_id = :screening_id')
                ->execute(['remarks' => $remarks, 'screening_id' => $screeningId]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    $row = $pdo->prepare('SELECT * FROM screening WHERE screening_id = :screening_id LIMIT 1');
    $row->execute(['screening_id' => $screeningId]);
    return ['status' => $screening ? 200 : 201, 'body' => $row->fetch()];
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
    $criterion = $statement->fetch();
    if (!$criterion) {
        throw new ApiException(404, 'Criteria does not belong to this landlord.');
    }

    $status = strtolower(trim((string) ($input['result_status'] ?? $input['status'] ?? 'pending')));
    if (!in_array($status, ['pending', 'passed', 'failed', 'not_applicable'], true)) {
        throw new ApiException(422, 'Result status is invalid.');
    }

    $remarks = trim((string) ($input['remarks'] ?? ''));
    if (mb_strlen($remarks) > 5000) {
        throw new ApiException(422, 'Evaluation remarks must be 5000 characters or fewer.');
    }
    $verifiedAt = $status === 'pending' ? null : date('Y-m-d H:i:s');
    $pdo->beginTransaction();
    try {
        $applicationStatus = $pdo->prepare(
            'SELECT a.application_status
             FROM screening s JOIN tenant_application a ON a.application_id = s.application_id
             WHERE s.screening_id = :screening_id FOR UPDATE',
        );
        $applicationStatus->execute(['screening_id' => $screeningId]);
        $currentApplicationStatus = $applicationStatus->fetchColumn();
        if ($currentApplicationStatus === false) {
            throw new ApiException(404, 'Screening not found.');
        }
        if (in_array($currentApplicationStatus, ['approved', 'rejected', 'withdrawn'], true)) {
            throw new ApiException(409, 'Screening results cannot be changed after the application has a final status.');
        }
        $existingQuery = $pdo->prepare(
            'SELECT result_id, result_status, remarks FROM screening_result
             WHERE screening_id = :screening_id AND criteria_id = :criteria_id FOR UPDATE',
        );
        $existingQuery->execute(['screening_id' => $screeningId, 'criteria_id' => $criteriaId]);
        $existing = $existingQuery->fetch();
        if (!$criterion['is_active'] && !$existing) {
            throw new ApiException(409, 'Inactive criteria cannot be added to a new evaluation.');
        }
        $pdo->prepare(
            'INSERT INTO screening_result
                (screening_id, criteria_id, result_status, remarks, verified_at, evaluated_by)
             VALUES (:screening_id, :criteria_id, :result_status, :remarks, :verified_at, :evaluated_by)
             ON DUPLICATE KEY UPDATE
                result_status = VALUES(result_status),
                remarks = VALUES(remarks),
                verified_at = VALUES(verified_at),
                evaluated_by = VALUES(evaluated_by)',
        )->execute([
            'screening_id' => $screeningId,
            'criteria_id' => $criteriaId,
            'result_status' => $status,
            'remarks' => $remarks !== '' ? $remarks : null,
            'verified_at' => $verifiedAt,
            'evaluated_by' => $user['user_id'],
        ]);
        $resultQuery = $pdo->prepare(
            'SELECT result_id FROM screening_result
             WHERE screening_id = :screening_id AND criteria_id = :criteria_id',
        );
        $resultQuery->execute(['screening_id' => $screeningId, 'criteria_id' => $criteriaId]);
        $resultId = (int) $resultQuery->fetchColumn();

        refreshScreeningStatus($pdo, $screeningId, $landlordId);
        recordAudit($pdo, $user, 'screening_evaluation_saved', 'screening_result', $resultId, [
            'application_id' => (int) $screening['application_id'],
            'criteria_id' => $criteriaId,
            'criteria_name' => $criterion['criteria_name'],
            'previous_status' => $existing['result_status'] ?? null,
            'result_status' => $status,
            'previous_remarks' => $existing['remarks'] ?? null,
            'remarks' => $remarks !== '' ? $remarks : null,
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    $row = $pdo->prepare(
        'SELECT sr.*, CONCAT(l.first_name, " ", l.last_name) AS evaluated_by_name
         FROM screening_result sr
         LEFT JOIN users u ON u.user_id = sr.evaluated_by
         LEFT JOIN landlord l ON l.user_id = u.user_id
         WHERE sr.result_id = :result_id LIMIT 1',
    );
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

function rentalRegulationList(PDO $pdo, array $user): array
{
    landlordIdForUser($pdo, $user);
    $statement = $pdo->query(
        'SELECT regulation_code, title, applies_to, monthly_rent_ceiling, annual_increase_percent,
                max_advance_months, max_security_deposit_months, same_lessee_required,
                new_construction_cutoff, effective_from, effective_to, source_url, verification_status
         FROM rental_regulation
         ORDER BY effective_from DESC, regulation_id',
    );
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function landlordLeaseRecord(PDO $pdo, array $user, int $leaseId, bool $forUpdate = false): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT l.*, a.landlord_id, a.tenant_id, u.unit_number, u.property_id,
                p.property_name, p.address, p.rental_classification, p.construction_date,
                t.first_name AS tenant_first_name, t.last_name AS tenant_last_name,
                t.email AS tenant_email, t.phone AS tenant_phone,
                ld.first_name AS landlord_first_name, ld.last_name AS landlord_last_name,
                ld.phone AS landlord_phone, ld.business_name, lu.email AS landlord_email
         FROM lease l
         JOIN tenant_application a ON a.application_id = l.application_id
         JOIN rental_unit u ON u.unit_id = l.unit_id
         JOIN property p ON p.property_id = u.property_id
         JOIN tenant t ON t.tenant_id = a.tenant_id
         JOIN landlord ld ON ld.landlord_id = a.landlord_id
         JOIN users lu ON lu.user_id = ld.user_id
         WHERE l.lease_id = :lease_id AND a.landlord_id = :landlord_id'
        . ($forUpdate ? ' FOR UPDATE' : ''),
    );
    $statement->execute(['lease_id' => $leaseId, 'landlord_id' => $landlordId]);
    $lease = $statement->fetch();
    if (!$lease) {
        throw new ApiException(404, 'Lease not found for this landlord.');
    }
    return $lease;
}

function recordAudit(PDO $pdo, array $user, string $action, string $entity, int $recordId, array $values): void
{
    $pdo->prepare(
        'INSERT INTO audit_log (user_id, action, entity_name, record_id, new_values)
         VALUES (:user_id, :action, :entity_name, :record_id, :new_values)',
    )->execute([
        'user_id' => $user['user_id'],
        'action' => $action,
        'entity_name' => $entity,
        'record_id' => $recordId,
        'new_values' => json_encode($values, JSON_THROW_ON_ERROR),
    ]);
}

function leaseAgreementDataGet(PDO $pdo, array $user, int $leaseId): array
{
    $lease = landlordLeaseRecord($pdo, $user, $leaseId);
    return ['status' => 200, 'body' => ['lease' => $lease]];
}

function leaseDepositGet(PDO $pdo, array $user, int $leaseId): array
{
    landlordLeaseRecord($pdo, $user, $leaseId);
    $statement = $pdo->prepare(
        'SELECT d.*,
                (SELECT COALESCE(SUM(dd.amount), 0) FROM lease_deposit_deduction dd WHERE dd.deposit_id = d.deposit_id) AS deductions_total
         FROM lease_deposit d WHERE d.lease_id = :lease_id LIMIT 1',
    );
    $statement->execute(['lease_id' => $leaseId]);
    $deposit = $statement->fetch();
    if (!$deposit) {
        throw new ApiException(404, 'Deposit record not found.');
    }
    $deductions = $pdo->prepare(
        'SELECT deduction_id, amount, reason, supporting_document_ref, authorized_at
         FROM lease_deposit_deduction WHERE deposit_id = :deposit_id ORDER BY authorized_at',
    );
    $deductions->execute(['deposit_id' => $deposit['deposit_id']]);
    $deposit['deductions'] = $deductions->fetchAll();
    return ['status' => 200, 'body' => ['deposit' => $deposit]];
}

function leaseDepositUpdate(PDO $pdo, array $user, int $leaseId, array $input): array
{
    $lease = landlordLeaseRecord($pdo, $user, $leaseId);
    $receivedDate = trim((string) ($input['received_date'] ?? ''));
    $bankDate = trim((string) ($input['bank_deposit_date'] ?? ''));
    $bankReference = trim((string) ($input['bank_account_reference'] ?? ''));
    $interestInput = $input['accrued_interest'] ?? 0;
    $refundInput = $input['refund_amount'] ?? 0;
    $refundDate = trim((string) ($input['refund_date'] ?? ''));
    $status = strtolower(trim((string) ($input['settlement_status'] ?? 'pending')));

    foreach ([$receivedDate, $bankDate, $refundDate] as $date) {
        if ($date !== '' && !rentalDateIsValid($date)) {
            throw new ApiException(422, 'Deposit dates must be valid calendar dates.');
        }
    }
    if (!is_numeric($interestInput) || !is_numeric($refundInput) || (float) $interestInput < 0 || (float) $refundInput < 0) {
        throw new ApiException(422, 'Accrued interest and refund amount must be zero or greater.');
    }
    if (!in_array($status, ['pending', 'held', 'partially_refunded', 'refunded', 'settled'], true)) {
        throw new ApiException(422, 'Deposit settlement status is invalid.');
    }
    if ($bankDate !== '' && ($receivedDate === '' || $bankDate < $receivedDate || $bankReference === '')) {
        throw new ApiException(422, 'Record the received date and bank account reference before recording a bank deposit.');
    }
    if ($refundDate === '' && (float) $refundInput > 0) {
        throw new ApiException(422, 'A refund date is required when a refund amount is recorded.');
    }
    if ($status === 'refunded' && ($refundDate === '' || (float) $refundInput <= 0)) {
        throw new ApiException(422, 'A deposit cannot be marked refunded without a dated refund amount.');
    }

    $pdo->beginTransaction();
    try {
        $depositQuery = $pdo->prepare(
            'SELECT * FROM lease_deposit WHERE lease_id = :lease_id FOR UPDATE',
        );
        $depositQuery->execute(['lease_id' => $leaseId]);
        $deposit = $depositQuery->fetch();
        if (!$deposit) {
            throw new ApiException(404, 'Deposit record not found.');
        }
        $deductionsQuery = $pdo->prepare('SELECT COALESCE(SUM(amount), 0) FROM lease_deposit_deduction WHERE deposit_id = :deposit_id');
        $deductionsQuery->execute(['deposit_id' => $deposit['deposit_id']]);
        $deductions = (float) $deductionsQuery->fetchColumn();
        $available = (float) $deposit['original_amount'] + (float) $interestInput - $deductions;
        if ((float) $refundInput > $available) {
            throw new ApiException(422, 'Refund amount cannot exceed the deposit and accrued interest after documented deductions.');
        }
        $pdo->prepare(
            'UPDATE lease_deposit
             SET received_date = :received_date, bank_deposit_date = :bank_deposit_date,
                 bank_account_reference = :bank_account_reference, accrued_interest = :accrued_interest,
                 refund_amount = :refund_amount, refund_date = :refund_date, settlement_status = :settlement_status
             WHERE deposit_id = :deposit_id',
        )->execute([
            'received_date' => $receivedDate !== '' ? $receivedDate : null,
            'bank_deposit_date' => $bankDate !== '' ? $bankDate : null,
            'bank_account_reference' => $bankReference !== '' ? $bankReference : null,
            'accrued_interest' => number_format((float) $interestInput, 2, '.', ''),
            'refund_amount' => number_format((float) $refundInput, 2, '.', ''),
            'refund_date' => $refundDate !== '' ? $refundDate : null,
            'settlement_status' => $status,
            'deposit_id' => $deposit['deposit_id'],
        ]);
        recordAudit($pdo, $user, 'lease_deposit_updated', 'lease_deposit', (int) $deposit['deposit_id'], [
            'received_date' => $receivedDate ?: null,
            'bank_deposit_date' => $bankDate ?: null,
            'accrued_interest' => (float) $interestInput,
            'refund_amount' => (float) $refundInput,
            'settlement_status' => $status,
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    return leaseDepositGet($pdo, $user, $leaseId);
}

function leaseDepositDeductionCreate(PDO $pdo, array $user, int $leaseId, array $input): array
{
    landlordLeaseRecord($pdo, $user, $leaseId);
    $amount = $input['amount'] ?? null;
    $basis = strtolower(trim((string) ($input['basis'] ?? '')));
    $reason = trim((string) ($input['reason'] ?? ''));
    $evidence = trim((string) ($input['supporting_document_ref'] ?? ''));
    if (!is_numeric($amount) || (float) $amount <= 0 || !in_array($basis, ['unpaid_obligation', 'damage'], true) || $reason === '' || $evidence === '') {
        throw new ApiException(422, 'A positive deduction amount, supported basis, reason, and supporting document reference are required.');
    }
    $pdo->beginTransaction();
    try {
        $depositQuery = $pdo->prepare('SELECT * FROM lease_deposit WHERE lease_id = :lease_id FOR UPDATE');
        $depositQuery->execute(['lease_id' => $leaseId]);
        $deposit = $depositQuery->fetch();
        if (!$deposit) {
            throw new ApiException(404, 'Deposit record not found.');
        }
        $sumQuery = $pdo->prepare('SELECT COALESCE(SUM(amount), 0) FROM lease_deposit_deduction WHERE deposit_id = :deposit_id');
        $sumQuery->execute(['deposit_id' => $deposit['deposit_id']]);
        $deductions = (float) $sumQuery->fetchColumn();
        $available = (float) $deposit['original_amount'] + (float) $deposit['accrued_interest'] - $deductions - (float) $deposit['refund_amount'];
        if ((float) $amount > $available) {
            throw new ApiException(422, 'Deduction exceeds the remaining deposit and interest balance.');
        }
        $statement = $pdo->prepare(
            'INSERT INTO lease_deposit_deduction (deposit_id, amount, basis, reason, supporting_document_ref, authorized_by)
             VALUES (:deposit_id, :amount, :basis, :reason, :supporting_document_ref, :authorized_by)',
        );
        $statement->execute([
            'deposit_id' => $deposit['deposit_id'],
            'amount' => number_format((float) $amount, 2, '.', ''),
            'basis' => $basis,
            'reason' => $reason,
            'supporting_document_ref' => $evidence,
            'authorized_by' => $user['user_id'],
        ]);
        $deductionId = (int) $pdo->lastInsertId();
        recordAudit($pdo, $user, 'lease_deposit_deduction_added', 'lease_deposit_deduction', $deductionId, [
            'lease_id' => $leaseId,
            'amount' => (float) $amount,
            'reason' => $reason,
            'supporting_document_ref' => $evidence,
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    return leaseDepositGet($pdo, $user, $leaseId);
}

function leaseRentIncreaseList(PDO $pdo, array $user, int $leaseId): array
{
    landlordLeaseRecord($pdo, $user, $leaseId);
    $statement = $pdo->prepare(
        'SELECT h.*, r.title AS regulation_title
         FROM rent_increase_history h LEFT JOIN rental_regulation r ON r.regulation_id = h.regulation_id
         WHERE h.lease_id = :lease_id ORDER BY h.effective_date DESC, h.rent_increase_id DESC',
    );
    $statement->execute(['lease_id' => $leaseId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function leaseRentIncreaseCreate(PDO $pdo, array $user, int $leaseId, array $input): array
{
    $pdo->beginTransaction();
    try {
        $lease = landlordLeaseRecord($pdo, $user, $leaseId, true);
        $proposed = $input['proposed_monthly_rent'] ?? null;
        $effectiveDate = trim((string) ($input['effective_date'] ?? ''));
        $reason = trim((string) ($input['reason'] ?? ''));
        if (!is_numeric($proposed) || (float) $proposed <= 0 || !rentalDateIsValid($effectiveDate)
            || $effectiveDate < $lease['lease_start_date'] || $reason === '') {
            throw new ApiException(422, 'A positive proposed rent, valid effective date on or after lease start, and reason are required.');
        }

        $newRent = (float) $proposed;
        $oldRent = (float) $lease['monthly_rent'];
        $increasePercent = (($newRent - $oldRent) / $oldRent) * 100;
        if ($increasePercent < 0) {
            throw new ApiException(422, 'Rent increase history cannot be used to reduce rent; use a lease amendment workflow.');
        }
        $assessment = rentalComplianceAssessment($pdo, $lease, $newRent, $effectiveDate, true);
        $status = $assessment['status'];
        $regulation = $assessment['regulation'] ?? null;
        if ($status === 'compliant' && $assessment['same_lessee_required']) {
            $lastEffective = $lease['lease_start_date'];
            $history = $pdo->prepare(
                "SELECT MAX(effective_date) FROM rent_increase_history
                 WHERE lease_id = :lease_id AND assessment_status = 'approved'",
            );
            $history->execute(['lease_id' => $leaseId]);
            $lastEffective = max($lastEffective, (string) ($history->fetchColumn() ?: $lastEffective));
            $earliestAllowed = (new DateTimeImmutable($lastEffective))->modify('+1 year')->format('Y-m-d');
            if ($effectiveDate < $earliestAllowed) {
                throw new ApiException(422, 'Rent increases under this rule may not take effect more than once in a 12-month period.');
            }
            $maximum = $oldRent * (1 + (float) $regulation['annual_increase_percent'] / 100);
            if ($newRent > $maximum + 0.0001) {
                throw new ApiException(422, 'Proposed rent exceeds the configured annual increase limit for this continuing lessee.');
            }
        }
        if ($status === 'requires_manual_verification') {
            $statement = $pdo->prepare(
                'INSERT INTO rent_increase_history
                 (lease_id, previous_monthly_rent, proposed_monthly_rent, increase_percent, effective_date, regulation_id, reason, assessment_status, created_by)
                 VALUES (:lease_id, :previous_monthly_rent, :proposed_monthly_rent, :increase_percent, :effective_date, :regulation_id, :reason, :assessment_status, :created_by)',
            );
            $statement->execute([
                'lease_id' => $leaseId,
                'previous_monthly_rent' => number_format($oldRent, 2, '.', ''),
                'proposed_monthly_rent' => number_format($newRent, 2, '.', ''),
                'increase_percent' => number_format($increasePercent, 4, '.', ''),
                'effective_date' => $effectiveDate,
                'regulation_id' => $regulation['regulation_id'] ?? null,
                'reason' => $reason . ' [Not approved: ' . $assessment['message'] . ']',
                'assessment_status' => 'requires_manual_verification',
                'created_by' => $user['user_id'],
            ]);
            $proposalId = (int) $pdo->lastInsertId();
            recordAudit($pdo, $user, 'rent_increase_requires_review', 'rent_increase_history', $proposalId, [
                'lease_id' => $leaseId,
                'proposed_monthly_rent' => $newRent,
                'effective_date' => $effectiveDate,
                'assessment' => $assessment['message'],
            ]);
            $pdo->commit();
            return ['status' => 202, 'body' => ['message' => 'Rent change was not applied. The proposal was recorded for manual legal verification: ' . $assessment['message']]];
        }

        $statement = $pdo->prepare(
            'INSERT INTO rent_increase_history
             (lease_id, previous_monthly_rent, proposed_monthly_rent, approved_monthly_rent, increase_percent, effective_date, regulation_id, approval_date, reason, assessment_status, created_by)
             VALUES (:lease_id, :previous_monthly_rent, :proposed_monthly_rent, :approved_monthly_rent, :increase_percent, :effective_date, :regulation_id, CURDATE(), :reason, :assessment_status, :created_by)',
        );
        $statement->execute([
            'lease_id' => $leaseId,
            'previous_monthly_rent' => number_format($oldRent, 2, '.', ''),
            'proposed_monthly_rent' => number_format($newRent, 2, '.', ''),
            'approved_monthly_rent' => number_format($newRent, 2, '.', ''),
            'increase_percent' => number_format($increasePercent, 4, '.', ''),
            'effective_date' => $effectiveDate,
            'regulation_id' => $regulation['regulation_id'] ?? null,
            'reason' => $reason,
            'assessment_status' => $status === 'not_covered' ? 'not_covered' : 'approved',
            'created_by' => $user['user_id'],
        ]);
        $recordId = (int) $pdo->lastInsertId();
        $pdo->prepare('UPDATE lease SET monthly_rent = :rent WHERE lease_id = :lease_id')
            ->execute(['rent' => number_format($newRent, 2, '.', ''), 'lease_id' => $leaseId]);
        recordAudit($pdo, $user, 'lease_rent_increased', 'lease', $leaseId, [
            'rent_increase_id' => $recordId,
            'previous_monthly_rent' => $oldRent,
            'approved_monthly_rent' => $newRent,
            'effective_date' => $effectiveDate,
            'regulation_id' => $regulation['regulation_id'] ?? null,
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    return leaseRentIncreaseList($pdo, $user, $leaseId);
}

function leaseNoticeList(PDO $pdo, array $user, int $leaseId): array
{
    landlordLeaseRecord($pdo, $user, $leaseId);
    $statement = $pdo->prepare('SELECT * FROM lease_notice WHERE lease_id = :lease_id ORDER BY notice_date DESC, notice_id DESC');
    $statement->execute(['lease_id' => $leaseId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function leaseNoticeCreate(PDO $pdo, array $user, int $leaseId, array $input): array
{
    landlordLeaseRecord($pdo, $user, $leaseId);
    $type = strtolower(trim((string) ($input['notice_type'] ?? '')));
    $date = trim((string) ($input['notice_date'] ?? ''));
    $recipient = trim((string) ($input['recipient'] ?? ''));
    $description = trim((string) ($input['description'] ?? ''));
    $ground = trim((string) ($input['legal_ground'] ?? ''));
    $consent = filter_var($input['written_sublease_consent'] ?? false, FILTER_VALIDATE_BOOLEAN);
    $document = trim((string) ($input['supporting_document_ref'] ?? ''));
    $types = ['tenant_notice', 'payment_demand', 'lease_expiration', 'lease_termination', 'sublease_consent', 'other'];
    $grounds = ['unauthorized_sublease', 'rent_arrears', 'owner_or_family_use', 'necessary_repairs', 'lease_expiration', 'other'];
    if (!in_array($type, $types, true) || !rentalDateIsValid($date) || $recipient === '' || $description === '') {
        throw new ApiException(422, 'A valid notice type, date, recipient, and description are required.');
    }
    if ($type === 'sublease_consent' && (!$consent || $document === '')) {
        throw new ApiException(422, 'Written sublease consent requires a supporting document reference.');
    }
    if ($type === 'lease_termination' && (!in_array($ground, $grounds, true) || $ground === '')) {
        throw new ApiException(422, 'Record a recognized termination ground; the system does not terminate leases automatically.');
    }
    $pdo->beginTransaction();
    try {
        $statement = $pdo->prepare(
            'INSERT INTO lease_notice (lease_id, notice_type, notice_date, recipient, description, legal_ground, written_sublease_consent, supporting_document_ref, recorded_by)
             VALUES (:lease_id, :notice_type, :notice_date, :recipient, :description, :legal_ground, :written_sublease_consent, :supporting_document_ref, :recorded_by)',
        );
        $statement->execute([
            'lease_id' => $leaseId,
            'notice_type' => $type,
            'notice_date' => $date,
            'recipient' => $recipient,
            'description' => $description,
            'legal_ground' => $ground !== '' ? $ground : null,
            'written_sublease_consent' => $consent ? 1 : 0,
            'supporting_document_ref' => $document !== '' ? $document : null,
            'recorded_by' => $user['user_id'],
        ]);
        $noticeId = (int) $pdo->lastInsertId();
        recordAudit($pdo, $user, 'lease_notice_recorded', 'lease_notice', $noticeId, ['lease_id' => $leaseId, 'notice_type' => $type, 'legal_ground' => $ground ?: null]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    return leaseNoticeList($pdo, $user, $leaseId);
}

function leaseCreate(PDO $pdo, array $user, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $applicationId = (int) ($input['application_id'] ?? 0);
    $unitId = (int) ($input['unit_id'] ?? 0);
    if ($applicationId <= 0 || $unitId <= 0) {
        throw new ApiException(422, 'Application ID and unit ID are required.');
    }

    $startDate = (string) ($input['lease_start_date'] ?? '');
    $endDate = (string) ($input['lease_end_date'] ?? '');
    $rentInput = $input['monthly_rent'] ?? null;
    $depositInput = $input['security_deposit'] ?? 0;
    $advanceInput = $input['advance_payment'] ?? 0;
    $dueDayInput = $input['payment_due_day'] ?? null;
    if (!rentalDateIsValid($startDate) || !rentalDateIsValid($endDate) || $endDate <= $startDate) {
        throw new ApiException(422, 'Lease dates must be valid, and the end date must be later than the start date.');
    }
    if (!is_numeric($rentInput) || !is_numeric($depositInput) || !is_numeric($advanceInput)
        || !is_numeric($dueDayInput) || (int) $dueDayInput < 1 || (int) $dueDayInput > 31) {
        throw new ApiException(422, 'Rent, deposit, advance rent, and a payment due day from 1 through 31 are required.');
    }
    $monthlyRent = (float) $rentInput;
    $securityDeposit = (float) $depositInput;
    $advanceRent = (float) $advanceInput;

    $pdo->beginTransaction();
    try {
        $applicationStatement = $pdo->prepare(
            'SELECT * FROM tenant_application WHERE application_id = :application_id FOR UPDATE',
        );
        $applicationStatement->execute(['application_id' => $applicationId]);
        $application = $applicationStatement->fetch();
        if (!$application) {
            throw new ApiException(404, 'Application not found.');
        }
        if ((int) $application['landlord_id'] !== $landlordId) {
            throw new ApiException(403, 'You do not have access to this application.');
        }
        if ($application['application_status'] !== 'approved') {
            throw new ApiException(422, 'Only approved applications can be converted into a lease.');
        }
        if ($application['unit_id'] !== null && (int) $application['unit_id'] !== $unitId) {
            throw new ApiException(422, 'Lease unit must match the listing selected in the rental application.');
        }
        $existingLease = $pdo->prepare('SELECT lease_id FROM lease WHERE application_id = :application_id LIMIT 1');
        $existingLease->execute(['application_id' => $applicationId]);
        if ($existingLease->fetchColumn()) {
            throw new ApiException(409, 'This approved application already has a lease.');
        }

        $unitStatement = $pdo->prepare(
            'SELECT u.*, p.landlord_id, p.rental_classification, p.construction_date
             FROM rental_unit u JOIN property p ON p.property_id = u.property_id
             WHERE u.unit_id = :unit_id FOR UPDATE',
        );
        $unitStatement->execute(['unit_id' => $unitId]);
        $unit = $unitStatement->fetch();
        if (!$unit || (int) $unit['landlord_id'] !== $landlordId) {
            throw new ApiException(422, 'Unit does not belong to this landlord.');
        }
        if (!in_array($unit['unit_status'], ['vacant', 'reserved', 'occupied'], true)) {
            throw new ApiException(422, 'This unit is not available for lease creation.');
        }
        $overlap = $pdo->prepare(
            "SELECT lease_id FROM lease
             WHERE unit_id = :unit_id AND lease_status IN ('pending', 'active')
               AND lease_start_date <= :end_date AND lease_end_date >= :start_date
             LIMIT 1",
        );
        $overlap->execute(['unit_id' => $unitId, 'end_date' => $endDate, 'start_date' => $startDate]);
        if ($overlap->fetchColumn()) {
            throw new ApiException(409, 'This unit already has a pending or active lease that overlaps these dates.');
        }

        $priorLease = $pdo->prepare(
            "SELECT l.lease_id
             FROM lease l
             JOIN tenant_application a ON a.application_id = l.application_id
             WHERE l.unit_id = :unit_id AND a.tenant_id = :tenant_id
               AND l.lease_status IN ('active', 'ended')
               AND l.lease_end_date >= DATE_SUB(:lease_start_date_for_gap, INTERVAL 1 DAY)
               AND l.lease_start_date < :lease_start_date_for_before
             ORDER BY l.lease_end_date DESC LIMIT 1",
        );
        $priorLease->execute([
            'unit_id' => $unitId,
            'tenant_id' => $application['tenant_id'],
            'lease_start_date_for_gap' => $startDate,
            'lease_start_date_for_before' => $startDate,
        ]);
        $continuingLessee = (bool) $priorLease->fetchColumn();
        $assessment = rentalComplianceAssessment($pdo, $unit, $monthlyRent, $startDate, $continuingLessee);
        validateLeaseFinancialTerms($pdo, $assessment, $monthlyRent, $advanceRent, $securityDeposit);
        $regulation = $assessment['regulation'] ?? $assessment['deposit_regulation'] ?? null;
        $assessmentText = $assessment['message'];
        if ($regulation) {
            $assessmentText .= ' Rule: ' . $regulation['title'] . '; effective '
                . ($regulation['effective_from'] ?: 'date requires verification') . ' through '
                . ($regulation['effective_to'] ?: 'no configured end date') . '.';
        }

        $insert = $pdo->prepare(
            'INSERT INTO lease (application_id, unit_id, lease_start_date, lease_end_date, monthly_rent, security_deposit, advance_payment, payment_due_day, regulation_id, compliance_status, compliance_assessment, lease_status)
             VALUES (:application_id, :unit_id, :lease_start_date, :lease_end_date, :monthly_rent, :security_deposit, :advance_payment, :payment_due_day, :regulation_id, :compliance_status, :compliance_assessment, :lease_status)',
        );
        $insert->execute([
            'application_id' => $applicationId,
            'unit_id' => $unitId,
            'lease_start_date' => $startDate,
            'lease_end_date' => $endDate,
            'monthly_rent' => number_format($monthlyRent, 2, '.', ''),
            'security_deposit' => number_format($securityDeposit, 2, '.', ''),
            'advance_payment' => number_format($advanceRent, 2, '.', ''),
            'payment_due_day' => (int) $dueDayInput,
            'regulation_id' => $regulation['regulation_id'] ?? null,
            'compliance_status' => $assessment['status'],
            'compliance_assessment' => $assessmentText,
            'lease_status' => 'pending',
        ]);
        $leaseId = (int) $pdo->lastInsertId();
        $pdo->prepare(
            'INSERT INTO lease_tenant (lease_id, tenant_id, tenant_type, joined_at, left_at)
             VALUES (:lease_id, :tenant_id, :tenant_type, :joined_at, NULL)',
        )->execute([
            'lease_id' => $leaseId,
            'tenant_id' => $application['tenant_id'],
            'tenant_type' => 'primary',
            'joined_at' => $startDate,
        ]);
        $pdo->prepare(
            'INSERT INTO lease_deposit (lease_id, original_amount, settlement_status)
             VALUES (:lease_id, :original_amount, :settlement_status)',
        )->execute([
            'lease_id' => $leaseId,
            'original_amount' => number_format($securityDeposit, 2, '.', ''),
            'settlement_status' => $securityDeposit > 0 ? 'pending' : 'settled',
        ]);
        $activeUnitLease = $pdo->prepare(
            "SELECT lease_id FROM lease
             WHERE unit_id = :unit_id AND lease_status = 'active'
               AND lease_start_date <= CURDATE() AND lease_end_date >= CURDATE()
             LIMIT 1",
        );
        $activeUnitLease->execute(['unit_id' => $unitId]);
        $unitStatus = $activeUnitLease->fetchColumn() ? 'occupied' : 'reserved';
        $pdo->prepare('UPDATE rental_unit SET unit_status = :unit_status WHERE unit_id = :unit_id')
            ->execute(['unit_status' => $unitStatus, 'unit_id' => $unitId]);
        $pdo->prepare(
            'INSERT INTO audit_log (user_id, action, entity_name, record_id, new_values)
             VALUES (:user_id, :action, :entity_name, :record_id, :new_values)',
        )->execute([
            'user_id' => $user['user_id'],
            'action' => 'lease_created',
            'entity_name' => 'lease',
            'record_id' => $leaseId,
            'new_values' => json_encode([
                'unit_id' => $unitId,
                'application_id' => $applicationId,
                'monthly_rent' => $monthlyRent,
                'security_deposit' => $securityDeposit,
                'compliance_status' => $assessment['status'],
            ], JSON_THROW_ON_ERROR),
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

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
    if (array_key_exists('monthly_rent', $input)) {
        throw new ApiException(422, 'Use the rent-increase workflow to change rent so the change is assessed and retained in lease history.');
    }

    $allowed = ['lease_start_date', 'lease_end_date', 'payment_due_day', 'lease_status'];
    $updates = [];
    $params = ['lease_id' => $leaseId];

    foreach ($allowed as $field) {
        if (!array_key_exists($field, $input)) {
            continue;
        }

        $value = $input[$field];
        if ($field === 'lease_status') {
            $value = strtolower((string) $value);
            if (!in_array($value, ['pending', 'active', 'ended', 'terminated', 'cancelled'], true)) {
                throw new ApiException(422, 'Lease status is invalid.');
            }
        }
        if ($field === 'payment_due_day' && (!is_numeric($value) || (int) $value < 1 || (int) $value > 31)) {
            throw new ApiException(422, 'Payment due day must be between 1 and 31.');
        }

        $updates[] = $field . ' = :' . $field;
        $params[$field] = $value;
    }

    $startDate = (string) ($input['lease_start_date'] ?? $lease['lease_start_date']);
    $endDate = (string) ($input['lease_end_date'] ?? $lease['lease_end_date']);
    if (!rentalDateIsValid($startDate) || !rentalDateIsValid($endDate) || $endDate <= $startDate) {
        throw new ApiException(422, 'Lease dates must be valid, and the end date must be later than the start date.');
    }

    $pdo->beginTransaction();
    try {
        if (count($updates) > 0) {
            $overlap = $pdo->prepare(
                "SELECT lease_id FROM lease
                 WHERE unit_id = :unit_id AND lease_id <> :lease_id
                   AND lease_status IN ('pending', 'active')
                   AND lease_start_date <= :end_date AND lease_end_date >= :start_date
                 LIMIT 1",
            );
            $overlap->execute([
                'unit_id' => $lease['unit_id'],
                'lease_id' => $leaseId,
                'end_date' => $endDate,
                'start_date' => $startDate,
            ]);
            if ($overlap->fetchColumn()) {
                throw new ApiException(409, 'This unit already has a pending or active lease that overlaps these dates.');
            }
            $pdo->prepare('UPDATE lease SET ' . implode(', ', $updates) . ' WHERE lease_id = :lease_id')->execute($params);
        }

        $status = strtolower((string) ($input['lease_status'] ?? $lease['lease_status']));
        if (in_array($status, ['active', 'pending', 'ended', 'terminated', 'cancelled'], true)) {
            $currentLease = $pdo->prepare(
                "SELECT lease_status FROM lease
                 WHERE unit_id = :unit_id AND lease_status IN ('active', 'pending')
                   AND lease_start_date <= CURDATE() AND lease_end_date >= CURDATE()
                 ORDER BY CASE lease_status WHEN 'active' THEN 0 ELSE 1 END LIMIT 1",
            );
            $currentLease->execute(['unit_id' => $lease['unit_id']]);
            $currentLeaseStatus = $currentLease->fetchColumn();
            $futureLease = $pdo->prepare(
                "SELECT lease_id FROM lease
                 WHERE unit_id = :unit_id AND lease_status IN ('active', 'pending')
                   AND lease_start_date > CURDATE() LIMIT 1",
            );
            $futureLease->execute(['unit_id' => $lease['unit_id']]);
            $unitStatus = $currentLeaseStatus === 'active'
                ? 'occupied'
                : (($currentLeaseStatus === 'pending' || $futureLease->fetchColumn()) ? 'reserved' : 'vacant');
            $pdo->prepare('UPDATE rental_unit SET unit_status = :unit_status WHERE unit_id = :unit_id')
                ->execute(['unit_status' => $unitStatus, 'unit_id' => $lease['unit_id']]);
        }
        if (count($updates) > 0) {
            recordAudit($pdo, $user, 'lease_updated', 'lease', $leaseId, [
                'changed_fields' => array_keys(array_intersect_key($input, array_flip(['lease_start_date', 'lease_end_date', 'payment_due_day', 'lease_status']))),
            ]);
        }
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
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

    $periodStart = (string) ($input['billing_period_start'] ?? date('Y-m-01'));
    $periodEnd = (string) ($input['billing_period_end'] ?? date('Y-m-t'));
    $issueDate = (string) ($input['issue_date'] ?? date('Y-m-d'));
    $dueDate = (string) ($input['due_date'] ?? leasePaymentDueDate($periodStart, (int) $lease['payment_due_day']));
    $amount = $input['total_amount'] ?? null;
    if (!rentalDateIsValid($periodStart) || !rentalDateIsValid($periodEnd) || !rentalDateIsValid($issueDate)
        || !rentalDateIsValid($dueDate) || $periodEnd < $periodStart || $dueDate < $issueDate
        || !is_numeric($amount) || (float) $amount <= 0) {
        throw new ApiException(422, 'Invoice dates and amount are invalid.');
    }

    $pdo->beginTransaction();
    try {
    $insert = $pdo->prepare(
        'INSERT INTO rent_invoice (lease_id, invoice_number, billing_period_start, billing_period_end, issue_date, due_date, total_amount, invoice_status)
         VALUES (:lease_id, :invoice_number, :billing_period_start, :billing_period_end, :issue_date, :due_date, :total_amount, :invoice_status)',
    );
    $insert->execute([
        'lease_id' => $leaseId,
        'invoice_number' => $invoiceNumber,
        'billing_period_start' => $periodStart,
        'billing_period_end' => $periodEnd,
        'issue_date' => $issueDate,
        'due_date' => $dueDate,
        'total_amount' => number_format((float) $amount, 2, '.', ''),
        'invoice_status' => 'unpaid',
    ]);

    $invoiceId = (int) $pdo->lastInsertId();
    recordAudit($pdo, $user, 'invoice_created', 'rent_invoice', $invoiceId, [
        'lease_id' => $leaseId,
        'invoice_number' => $invoiceNumber,
        'total_amount' => (float) $amount,
        'due_date' => $dueDate,
    ]);
    $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    $row = $pdo->prepare('SELECT * FROM rent_invoice WHERE invoice_id = :invoice_id LIMIT 1');
    $row->execute(['invoice_id' => $invoiceId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function invoiceStatusUpdate(PDO $pdo, array $user, int $invoiceId, array $input): array
{
    $status = strtolower(trim((string) ($input['status'] ?? '')));
    if (($user['role'] ?? null) !== 'landlord') {
        throw new ApiException(403, 'Only landlords can update invoice status.');
    }
    $allowed = ['unpaid', 'overdue', 'void'];
    if (!in_array($status, $allowed, true)) {
        throw new ApiException(422, 'Invoice status is invalid. Payment-derived statuses are updated only by confirmed payment records.');
    }

    $invoice = $pdo->prepare(
        'SELECT i.invoice_id, i.invoice_status, a.landlord_id
         FROM rent_invoice i
         JOIN lease l ON l.lease_id = i.lease_id
         JOIN tenant_application a ON a.application_id = l.application_id
         WHERE i.invoice_id = :invoice_id LIMIT 1',
    );
    $invoice->execute(['invoice_id' => $invoiceId]);
    $invoiceRow = $invoice->fetch();
    if (!$invoiceRow) {
        throw new ApiException(404, 'Invoice not found.');
    }
    if ((int) $invoiceRow['landlord_id'] !== landlordIdForUser($pdo, $user)) {
        throw new ApiException(403, 'You do not have access to this invoice.');
    }
    if ($status === 'void' && $invoiceRow['invoice_status'] === 'paid') {
        throw new ApiException(422, 'A paid invoice cannot be voided.');
    }
    if (in_array($invoiceRow['invoice_status'], ['paid', 'partially_paid'], true) && $status !== 'void') {
        throw new ApiException(422, 'Payment-derived invoice status cannot be overwritten manually.');
    }
    $pdo->prepare('UPDATE rent_invoice SET invoice_status = :status WHERE invoice_id = :invoice_id')
        ->execute(['status' => $status, 'invoice_id' => $invoiceId]);

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
            'SELECT pa.*, p.payment_id, p.receipt_number, p.payment_status, p.refunded_amount, p.refund_date,
                    i.invoice_number, l.lease_id
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
        'SELECT pa.*, p.payment_id, p.receipt_number, p.payment_status, p.refunded_amount, p.refund_date,
                i.invoice_number, l.lease_id
         FROM payment_attempt pa
         JOIN rent_invoice i ON i.invoice_id = pa.invoice_id
         JOIN lease l ON l.lease_id = i.lease_id
         LEFT JOIN payment p ON p.attempt_id = pa.attempt_id
         WHERE pa.tenant_id = :tenant_id
         ORDER BY pa.initiated_at DESC',
    );
    $statement->execute(['tenant_id' => $tenantId]);
    return ['status' => 200, 'body' => $statement->fetchAll()];
}

function paymentInitiate(PDO $pdo, array $user, array $input): array
{
    if (($user['role'] ?? null) !== 'tenant') {
        throw new ApiException(403, 'Only a tenant on the lease can initiate a payment attempt.');
    }
    $invoiceId = (int) ($input['invoice_id'] ?? 0);
    if ($invoiceId <= 0) {
        throw new ApiException(422, 'Invoice ID is required.');
    }
    if (!invoiceBelongsToUser($pdo, $invoiceId, $user)) {
        throw new ApiException(403, 'You do not have access to this invoice.');
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
    $gatewayName = 'hitpay';
    $gatewayReference = 'HP-' . bin2hex(random_bytes(16));
    if (!in_array($method, ['card', 'bank_transfer', 'e_wallet', 'cash', 'other'], true)) {
        throw new ApiException(422, 'Payment method is invalid.');
    }
    $amountInput = $input['amount'] ?? null;
    if ($amountInput !== null && (!is_numeric($amountInput) || (float) $amountInput <= 0)) {
        throw new ApiException(422, 'Payment amount must be greater than zero.');
    }
    $pdo->beginTransaction();
    try {
        $invoice = $pdo->prepare('SELECT i.*, p.property_name, u.unit_number FROM rent_invoice i JOIN lease l ON l.lease_id = i.lease_id JOIN rental_unit u ON u.unit_id = l.unit_id JOIN property p ON p.property_id = u.property_id WHERE i.invoice_id = :invoice_id FOR UPDATE');
        $invoice->execute(['invoice_id' => $invoiceId]);
        $invoiceRow = $invoice->fetch();
        if (!$invoiceRow) {
            throw new ApiException(404, 'Invoice not found.');
        }
        $amount = (float) ($amountInput ?? $invoiceRow['total_amount']);
        $paid = $pdo->prepare(
            "SELECT COALESCE(SUM(p.amount_paid - p.refunded_amount), 0)
             FROM payment p JOIN payment_attempt pa ON pa.attempt_id = p.attempt_id
             WHERE pa.invoice_id = :invoice_id AND p.payment_status <> 'reversed'",
        );
        $paid->execute(['invoice_id' => $invoiceId]);
        $alreadyPaid = (float) $paid->fetchColumn();
        $outstanding = max(0, (float) $invoiceRow['total_amount'] - $alreadyPaid);
        if ($amount > $outstanding) {
            throw new ApiException(422, 'Payment amount cannot exceed the invoice balance.');
        }

        // Create HitPay payment request
        $checkoutUrl = null;
        $hitpayId = null;
        try {
            $frontendUrl = appEnv('APP_FRONTEND_URL', 'http://localhost:5175');
            $hitpayResponse = HitPayService::createPaymentRequest([
                'amount' => $amount,
                'purpose' => "Invoice #{$invoiceRow['invoice_number']} - {$invoiceRow['property_name']} Unit {$invoiceRow['unit_number']}",
                'redirect_url' => "{$frontendUrl}/tenant/payments?status=verify",
                'email' => $user['email'] ?? '',
                'name' => $user['name'] ?? '',
                'reference_number' => "INV-{$invoiceId}-" . time(),
            ]);
            $checkoutUrl = $hitpayResponse['url'] ?? null;
            $hitpayId = $hitpayResponse['id'] ?? null;
            if ($hitpayId) {
                $gatewayReference = (string) $hitpayId;
            }
        } catch (Throwable $hitpayErr) {
            // Log or throw if HitPay fails
            throw $hitpayErr;
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
            'attempt_status' => 'pending',
            'completed_at' => null,
        ]);
        $attemptId = (int) $pdo->lastInsertId();
        recordAudit($pdo, $user, 'payment_attempt_created', 'payment_attempt', $attemptId, [
            'invoice_id' => $invoiceId,
            'amount' => $amount,
            'payment_method' => $method,
            'gateway_reference' => $gatewayReference,
            'attempt_status' => 'pending',
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }

    $row = $pdo->prepare('SELECT pa.*, p.payment_id, p.receipt_number, p.payment_status FROM payment_attempt pa LEFT JOIN payment p ON p.attempt_id = pa.attempt_id WHERE pa.attempt_id = :attempt_id LIMIT 1');
    $row->execute(['attempt_id' => $attemptId]);
    $body = $row->fetch();
    $body['checkout_url'] = $checkoutUrl;
    return ['status' => 201, 'body' => $body];
}

function paymentConfirm(PDO $pdo, array $user, int $attemptId, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $reference = trim((string) ($input['transaction_reference'] ?? ''));
    $pdo->beginTransaction();
    try {
        $invoiceIdQuery = $pdo->prepare(
            'SELECT invoice_id FROM payment_attempt WHERE attempt_id = :attempt_id LIMIT 1',
        );
        $invoiceIdQuery->execute(['attempt_id' => $attemptId]);
        $invoiceId = $invoiceIdQuery->fetchColumn();
        if (!$invoiceId) {
            throw new ApiException(404, 'Payment attempt not found.');
        }
        $invoiceLock = $pdo->prepare(
            'SELECT invoice_id FROM rent_invoice WHERE invoice_id = :invoice_id FOR UPDATE',
        );
        $invoiceLock->execute(['invoice_id' => $invoiceId]);
        if (!$invoiceLock->fetchColumn()) {
            throw new ApiException(404, 'Invoice not found.');
        }
        $statement = $pdo->prepare(
            'SELECT pa.*, i.total_amount, a.landlord_id
             FROM payment_attempt pa
             JOIN rent_invoice i ON i.invoice_id = pa.invoice_id
             JOIN lease l ON l.lease_id = i.lease_id
             JOIN tenant_application a ON a.application_id = l.application_id
             WHERE pa.attempt_id = :attempt_id FOR UPDATE',
        );
        $statement->execute(['attempt_id' => $attemptId]);
        $attempt = $statement->fetch();
        if (!$attempt) {
            throw new ApiException(404, 'Payment attempt not found.');
        }
        if ((int) $attempt['landlord_id'] !== $landlordId) {
            throw new ApiException(403, 'You do not have access to this payment attempt.');
        }
        if ($attempt['attempt_status'] !== 'pending') {
            throw new ApiException(409, 'Only pending payment attempts can be confirmed.');
        }
        if (!in_array($attempt['payment_method'], ['card', 'e_wallet', 'cash', 'bank_transfer', 'other'], true)) {
            throw new ApiException(422, 'Payment method not eligible for confirmation.');
        }
        $paid = $pdo->prepare(
            "SELECT COALESCE(SUM(p.amount_paid - p.refunded_amount), 0)
             FROM payment p JOIN payment_attempt pa ON pa.attempt_id = p.attempt_id
             WHERE pa.invoice_id = :invoice_id AND p.payment_status <> 'reversed'",
        );
        $paid->execute(['invoice_id' => $attempt['invoice_id']]);
        $alreadyPaid = (float) $paid->fetchColumn();
        $outstanding = max(0, (float) $attempt['total_amount'] - $alreadyPaid);
        $amount = (float) $attempt['amount'];
        if ($amount <= 0 || $amount > $outstanding) {
            throw new ApiException(409, 'The invoice balance changed and this payment attempt cannot be confirmed for that amount.');
        }
        $transactionReference = $reference !== '' ? $reference : 'MAN-' . bin2hex(random_bytes(12));
        $receiptNumber = 'RCPT-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(5)));
        $pdo->prepare(
            "UPDATE payment_attempt SET attempt_status = 'successful', completed_at = NOW()
             WHERE attempt_id = :attempt_id",
        )->execute(['attempt_id' => $attemptId]);
        $pdo->prepare(
            'INSERT INTO payment (attempt_id, amount_paid, refunded_amount, transaction_reference, receipt_number, payment_status, payment_date)
             VALUES (:attempt_id, :amount_paid, 0, :transaction_reference, :receipt_number, :payment_status, NOW())',
        )->execute([
            'attempt_id' => $attemptId,
            'amount_paid' => number_format($amount, 2, '.', ''),
            'transaction_reference' => $transactionReference,
            'receipt_number' => $receiptNumber,
            'payment_status' => 'completed',
        ]);
        $newPaid = $alreadyPaid + $amount;
        $newStatus = $newPaid >= (float) $attempt['total_amount'] ? 'paid' : 'partially_paid';
        $pdo->prepare('UPDATE rent_invoice SET invoice_status = :status WHERE invoice_id = :invoice_id')
            ->execute(['status' => $newStatus, 'invoice_id' => $attempt['invoice_id']]);
        recordAudit($pdo, $user, 'payment_confirmed', 'payment_attempt', $attemptId, [
            'invoice_id' => (int) $attempt['invoice_id'],
            'amount' => $amount,
            'receipt_number' => $receiptNumber,
            'payment_method' => $attempt['payment_method'],
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    $row = $pdo->prepare(
        'SELECT pa.*, p.payment_id, p.receipt_number, p.payment_status
         FROM payment_attempt pa LEFT JOIN payment p ON p.attempt_id = pa.attempt_id
         WHERE pa.attempt_id = :attempt_id LIMIT 1',
    );
    $row->execute(['attempt_id' => $attemptId]);
    return ['status' => 201, 'body' => $row->fetch()];
}

function paymentAttemptCancel(PDO $pdo, array $user, int $attemptId): array
{
    $tenantId = tenantIdForUser($pdo, $user);
    $statement = $pdo->prepare(
        'SELECT attempt_id, tenant_id, attempt_status FROM payment_attempt WHERE attempt_id = :attempt_id LIMIT 1',
    );
    $statement->execute(['attempt_id' => $attemptId]);
    $attempt = $statement->fetch();
    if (!$attempt) {
        throw new ApiException(404, 'Payment attempt not found.');
    }
    if ((int) $attempt['tenant_id'] !== $tenantId) {
        throw new ApiException(403, 'You do not have access to this payment attempt.');
    }
    if ($attempt['attempt_status'] !== 'pending') {
        throw new ApiException(409, 'Only pending payment attempts can be cancelled.');
    }
    $pdo->prepare(
        "UPDATE payment_attempt SET attempt_status = 'cancelled', completed_at = NOW()
         WHERE attempt_id = :attempt_id AND attempt_status = 'pending'",
    )->execute(['attempt_id' => $attemptId]);
    recordAudit($pdo, $user, 'payment_attempt_cancelled', 'payment_attempt', $attemptId, []);
    return paymentStatusGet($pdo, $user, $attemptId);
}

function paymentRefund(PDO $pdo, array $user, int $attemptId, array $input): array
{
    $landlordId = landlordIdForUser($pdo, $user);
    $reason = trim((string) ($input['reason'] ?? ''));
    if ($reason === '') {
        throw new ApiException(422, 'A refund reason is required.');
    }
    $pdo->beginTransaction();
    try {
        $invoiceIdQuery = $pdo->prepare(
            'SELECT invoice_id FROM payment_attempt WHERE attempt_id = :attempt_id LIMIT 1',
        );
        $invoiceIdQuery->execute(['attempt_id' => $attemptId]);
        $invoiceId = $invoiceIdQuery->fetchColumn();
        if (!$invoiceId) {
            throw new ApiException(404, 'Confirmed payment not found.');
        }
        $invoiceLock = $pdo->prepare(
            'SELECT invoice_id FROM rent_invoice WHERE invoice_id = :invoice_id FOR UPDATE',
        );
        $invoiceLock->execute(['invoice_id' => $invoiceId]);
        if (!$invoiceLock->fetchColumn()) {
            throw new ApiException(404, 'Invoice not found.');
        }
        $statement = $pdo->prepare(
            'SELECT p.*, pa.invoice_id, a.landlord_id, i.total_amount
             FROM payment p JOIN payment_attempt pa ON pa.attempt_id = p.attempt_id
             JOIN rent_invoice i ON i.invoice_id = pa.invoice_id
             JOIN lease l ON l.lease_id = i.lease_id
             JOIN tenant_application a ON a.application_id = l.application_id
             WHERE pa.attempt_id = :attempt_id FOR UPDATE',
        );
        $statement->execute(['attempt_id' => $attemptId]);
        $payment = $statement->fetch();
        if (!$payment) {
            throw new ApiException(404, 'Confirmed payment not found.');
        }
        if ((int) $payment['landlord_id'] !== $landlordId) {
            throw new ApiException(403, 'You do not have access to this payment.');
        }
        $refundAmount = $input['amount'] ?? $payment['amount_paid'];
        if (!is_numeric($refundAmount) || (float) $refundAmount <= 0
            || (float) $refundAmount > (float) $payment['amount_paid'] - (float) $payment['refunded_amount']) {
            throw new ApiException(422, 'Refund amount must be positive and no greater than the unrefunded payment amount.');
        }
        $newRefund = (float) $payment['refunded_amount'] + (float) $refundAmount;
        $newPaymentStatus = $newRefund >= (float) $payment['amount_paid'] ? 'refunded' : 'completed';
        $pdo->prepare(
            'INSERT INTO payment_refund (payment_id, amount, reason, refunded_by)
             VALUES (:payment_id, :amount, :reason, :refunded_by)',
        )->execute([
            'payment_id' => $payment['payment_id'],
            'amount' => number_format((float) $refundAmount, 2, '.', ''),
            'reason' => $reason,
            'refunded_by' => $user['user_id'],
        ]);
        $pdo->prepare(
            'UPDATE payment SET refunded_amount = :refunded_amount, payment_status = :payment_status,
                    refund_date = CURDATE(), refund_reason = :refund_reason
             WHERE payment_id = :payment_id',
        )->execute([
            'refunded_amount' => number_format($newRefund, 2, '.', ''),
            'payment_status' => $newPaymentStatus,
            'refund_reason' => $reason,
            'payment_id' => $payment['payment_id'],
        ]);
        $sum = $pdo->prepare(
            "SELECT COALESCE(SUM(amount_paid - refunded_amount), 0)
             FROM payment p JOIN payment_attempt pa ON pa.attempt_id = p.attempt_id
             WHERE pa.invoice_id = :invoice_id AND p.payment_status IN ('completed', 'refunded')",
        );
        $sum->execute(['invoice_id' => $payment['invoice_id']]);
        $netPaid = (float) $sum->fetchColumn();
        $status = $netPaid >= (float) $payment['total_amount'] ? 'paid' : ($netPaid > 0 ? 'partially_paid' : 'unpaid');
        $pdo->prepare('UPDATE rent_invoice SET invoice_status = :status WHERE invoice_id = :invoice_id')
            ->execute(['status' => $status, 'invoice_id' => $payment['invoice_id']]);
        recordAudit($pdo, $user, 'payment_refunded', 'payment', (int) $payment['payment_id'], [
            'refund_amount' => (float) $refundAmount,
            'refund_reason' => $reason,
            'invoice_id' => (int) $payment['invoice_id'],
        ]);
        $pdo->commit();
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $error;
    }
    return paymentStatusGet($pdo, $user, $attemptId);
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

    // Auto-verify with HitPay if attempt is still pending and gateway is hitpay
    if ($payment['attempt_status'] === 'pending' && $payment['gateway_name'] === 'hitpay' && !empty($payment['gateway_reference'])) {
        try {
            $hpStatus = HitPayService::getPaymentRequestStatus($payment['gateway_reference']);
            if (($hpStatus['status'] ?? '') === 'completed') {
                // Confirm payment internally
                paymentConfirmInternal($pdo, (int) $payment['attempt_id'], $payment['gateway_reference']);
                // Reload payment
                $statement->execute(['attempt_id' => $attemptId]);
                $payment = $statement->fetch();
            } elseif (in_array(($hpStatus['status'] ?? ''), ['failed', 'canceled', 'expired'], true)) {
                $pdo->prepare("UPDATE payment_attempt SET attempt_status = 'failed', completed_at = NOW() WHERE attempt_id = :id")
                    ->execute(['id' => $payment['attempt_id']]);
                $payment['attempt_status'] = 'failed';
            }
        } catch (Throwable) {
            // Log silently and return current record
        }
    }

    if ($payment['payment_id'] !== null) {
        $payment['refunds'] = paymentRefundHistory($pdo, (int) $payment['payment_id']);
    }

    return ['status' => 200, 'body' => $payment];
}

function paymentWebhookHitPay(PDO $pdo): array
{
    $postData = $_POST;
    if (empty($postData)) {
        $postData = requestJsonOrEmpty();
    }

    $paymentRequestId = $postData['payment_request_id'] ?? $postData['id'] ?? null;
    $status = $postData['status'] ?? null;
    $reference = $postData['reference_number'] ?? $paymentRequestId ?? '';

    if (!$paymentRequestId) {
        return ['status' => 400, 'body' => ['error' => 'Missing payment_request_id']];
    }

    $stmt = $pdo->prepare('SELECT attempt_id, attempt_status FROM payment_attempt WHERE gateway_reference = :ref LIMIT 1');
    $stmt->execute(['ref' => (string) $paymentRequestId]);
    $attempt = $stmt->fetch();

    if ($attempt) {
        if ($status === 'completed' && $attempt['attempt_status'] === 'pending') {
            paymentConfirmInternal($pdo, (int) $attempt['attempt_id'], (string) $reference);
        } elseif (in_array($status, ['failed', 'canceled', 'expired'], true)) {
            $pdo->prepare("UPDATE payment_attempt SET attempt_status = 'failed', completed_at = NOW() WHERE attempt_id = :id")
                ->execute(['id' => $attempt['attempt_id']]);
        }
    }

    return ['status' => 200, 'body' => ['received' => true]];
}

function paymentConfirmInternal(PDO $pdo, int $attemptId, string $reference): void
{
    $pdo->beginTransaction();
    try {
        $invoiceLock = $pdo->prepare(
            'SELECT pa.*, i.total_amount, i.invoice_id
             FROM payment_attempt pa
             JOIN rent_invoice i ON i.invoice_id = pa.invoice_id
             WHERE pa.attempt_id = :attempt_id FOR UPDATE',
        );
        $invoiceLock->execute(['attempt_id' => $attemptId]);
        $attempt = $invoiceLock->fetch();
        if (!$attempt || $attempt['attempt_status'] === 'successful') {
            $pdo->commit();
            return;
        }

        $paid = $pdo->prepare(
            "SELECT COALESCE(SUM(p.amount_paid - p.refunded_amount), 0)
             FROM payment p JOIN payment_attempt pa ON pa.attempt_id = p.attempt_id
             WHERE pa.invoice_id = :invoice_id AND p.payment_status <> 'reversed'",
        );
        $paid->execute(['invoice_id' => $attempt['invoice_id']]);
        $alreadyPaid = (float) $paid->fetchColumn();
        $amount = (float) $attempt['amount'];
        $receiptNumber = 'RCPT-' . gmdate('Ymd') . '-' . strtoupper(bin2hex(random_bytes(5)));

        $pdo->prepare(
            "UPDATE payment_attempt SET attempt_status = 'successful', completed_at = NOW()
             WHERE attempt_id = :attempt_id",
        )->execute(['attempt_id' => $attemptId]);

        $pdo->prepare(
            'INSERT INTO payment (attempt_id, amount_paid, refunded_amount, transaction_reference, receipt_number, payment_status, payment_date)
             VALUES (:attempt_id, :amount_paid, 0, :transaction_reference, :receipt_number, :payment_status, NOW())',
        )->execute([
            'attempt_id' => $attemptId,
            'amount_paid' => number_format($amount, 2, '.', ''),
            'transaction_reference' => $reference,
            'receipt_number' => $receiptNumber,
            'payment_status' => 'completed',
        ]);

        $newPaid = $alreadyPaid + $amount;
        $newStatus = $newPaid >= (float) $attempt['total_amount'] ? 'paid' : 'partially_paid';
        $pdo->prepare('UPDATE rent_invoice SET invoice_status = :status WHERE invoice_id = :invoice_id')
            ->execute(['status' => $newStatus, 'invoice_id' => $attempt['invoice_id']]);

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function paymentRefundHistory(PDO $pdo, int $paymentId): array
{
    $statement = $pdo->prepare(
        'SELECT amount, reason, refunded_at
         FROM payment_refund WHERE payment_id = :payment_id ORDER BY refunded_at, refund_id',
    );
    $statement->execute(['payment_id' => $paymentId]);
    return $statement->fetchAll();
}

function paymentReceiptGet(PDO $pdo, array $user, int $attemptId): array
{
    $statement = $pdo->prepare(
        'SELECT pa.*, p.*, i.invoice_number, i.lease_id, i.total_amount AS invoice_total,
                i.billing_period_start, i.billing_period_end
         FROM payment_attempt pa
         JOIN payment p ON p.attempt_id = pa.attempt_id
         JOIN rent_invoice i ON i.invoice_id = pa.invoice_id
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
    $payment['refunds'] = paymentRefundHistory($pdo, (int) $payment['payment_id']);

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
