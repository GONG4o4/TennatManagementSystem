<?php

declare(strict_types=1);

function rentalDateIsValid(string $value): bool
{
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    return $date !== false && $date->format('Y-m-d') === $value;
}

function leasePaymentDueDate(string $periodDate, int $dueDay): string
{
    if (!rentalDateIsValid($periodDate) || $dueDay < 1 || $dueDay > 31) {
        throw new ApiException(422, 'Billing period and payment due day must be valid.');
    }
    $period = new DateTimeImmutable($periodDate);
    $lastDay = (int) $period->format('t');
    return $period->setDate(
        (int) $period->format('Y'),
        (int) $period->format('m'),
        min($dueDay, $lastDay),
    )->format('Y-m-d');
}

function rentalRegulationForDate(PDO $pdo, string $date, string $code): ?array
{
    $statement = $pdo->prepare(
        'SELECT * FROM rental_regulation
         WHERE regulation_code = :code
           AND (effective_from IS NULL OR effective_from <= :effective_from)
           AND (effective_to IS NULL OR effective_to >= :effective_to)
         ORDER BY effective_from DESC
         LIMIT 1',
    );
    $statement->execute([
        'code' => $code,
        'effective_from' => $date,
        'effective_to' => $date,
    ]);
    $regulation = $statement->fetch();
    return $regulation ?: null;
}

function rentalComplianceAssessment(PDO $pdo, array $property, float $monthlyRent, string $effectiveDate, bool $continuingLessee): array
{
    if (!rentalDateIsValid($effectiveDate)) {
        throw new ApiException(422, 'A valid compliance assessment date is required.');
    }

    $classification = (string) ($property['rental_classification'] ?? 'unknown');
    if ($classification === 'commercial') {
        return [
            'status' => 'not_covered',
            'covered' => false,
            'regulation' => null,
            'message' => 'Commercial classification is not covered by the residential rent-control rules in this assessment.',
        ];
    }
    if ($classification !== 'residential' || empty($property['construction_date'])) {
        return [
            'status' => 'requires_manual_verification',
            'covered' => null,
            'regulation' => null,
            'message' => 'Confirm the property classification and construction date before assessing rent-control coverage.',
        ];
    }

    $increaseRule = rentalRegulationForDate($pdo, $effectiveDate, 'NHSB-2024-01');
    if (!$increaseRule) {
        return [
            'status' => 'requires_manual_verification',
            'covered' => null,
            'regulation' => null,
            'message' => 'No verified rent-increase rule is configured for this date. Check for a successor regulation.',
        ];
    }
    if ($increaseRule['verification_status'] !== 'verified' || empty($increaseRule['new_construction_cutoff'])) {
        return [
            'status' => 'requires_manual_verification',
            'covered' => null,
            'regulation' => $increaseRule,
            'message' => 'The applicable rule or the construction exclusion date requires manual legal verification.',
        ];
    }
    if ($monthlyRent > (float) $increaseRule['monthly_rent_ceiling']) {
        return [
            'status' => 'not_covered',
            'covered' => false,
            'regulation' => $increaseRule,
            'message' => 'Monthly rent exceeds the configured rent-control ceiling.',
        ];
    }
    if ($property['construction_date'] > $increaseRule['new_construction_cutoff']) {
        return [
            'status' => 'not_covered',
            'covered' => false,
            'regulation' => $increaseRule,
            'message' => 'The property construction date falls after the configured new-construction exclusion cutoff.',
        ];
    }

    $depositRule = rentalRegulationForDate($pdo, $effectiveDate, 'RA9653-SEC7');
    return [
        'status' => 'compliant',
        'covered' => true,
        'regulation' => $increaseRule,
        'deposit_regulation' => $depositRule,
        'same_lessee_required' => (bool) $increaseRule['same_lessee_required'],
        'continuing_lessee' => $continuingLessee,
        'message' => $continuingLessee
            ? 'The configured residential rent-control rule applies to this continuing lessee.'
            : 'This is not a continuing-lessee rent increase; the annual increase cap does not apply on that basis.',
    ];
}

function validateLeaseFinancialTerms(PDO $pdo, array $assessment, float $monthlyRent, float $advanceRent, float $securityDeposit): void
{
    if ($monthlyRent <= 0 || $advanceRent < 0 || $securityDeposit < 0) {
        throw new ApiException(422, 'Rent must be positive; advance rent and security deposit cannot be negative.');
    }
    if ($assessment['covered'] !== true) {
        return;
    }

    $rule = $assessment['deposit_regulation'] ?? null;
    if (!$rule || $rule['verification_status'] !== 'verified') {
        return;
    }
    $maximumAdvance = $monthlyRent * (float) $rule['max_advance_months'];
    $maximumDeposit = $monthlyRent * (float) $rule['max_security_deposit_months'];
    if ($advanceRent > $maximumAdvance) {
        throw new ApiException(422, 'Advance rent exceeds the configured limit of ' . $rule['max_advance_months'] . ' month(s) for covered residential leases.');
    }
    if ($securityDeposit > $maximumDeposit) {
        throw new ApiException(422, 'Security deposit exceeds the configured limit of ' . $rule['max_security_deposit_months'] . ' month(s) for covered residential leases.');
    }
}
