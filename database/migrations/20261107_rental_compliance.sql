-- Add rental regulation assessments, lease deposits, rent history, and lease notices.
-- Run once on an existing TenantFlow database. Back up the database first.

ALTER TABLE property
    ADD COLUMN rental_classification VARCHAR(20) NOT NULL DEFAULT 'unknown',
    ADD COLUMN construction_date DATE NULL,
    ADD CONSTRAINT property_rental_classification_chk
        CHECK (rental_classification IN ('residential', 'commercial', 'unknown'));

ALTER TABLE lease
    DROP CONSTRAINT lease_due_day_chk,
    ADD COLUMN regulation_id BIGINT UNSIGNED NULL,
    ADD COLUMN compliance_status VARCHAR(40) NOT NULL DEFAULT 'requires_manual_verification',
    ADD COLUMN compliance_assessment TEXT NULL,
    ADD CONSTRAINT lease_due_day_chk CHECK (payment_due_day BETWEEN 1 AND 31),
    ADD CONSTRAINT lease_compliance_status_chk
        CHECK (compliance_status IN ('compliant', 'not_covered', 'requires_manual_verification'));

ALTER TABLE payment
    ADD COLUMN refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN refund_date DATE NULL,
    ADD COLUMN refund_reason TEXT NULL,
    ADD CONSTRAINT payment_refund_amount_chk CHECK (refunded_amount >= 0 AND refunded_amount <= amount_paid);

CREATE TABLE rental_regulation (
    regulation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    regulation_code VARCHAR(60) NOT NULL,
    title VARCHAR(255) NOT NULL,
    applies_to VARCHAR(20) NOT NULL,
    monthly_rent_ceiling DECIMAL(12,2) NULL,
    annual_increase_percent DECIMAL(5,2) NULL,
    max_advance_months DECIMAL(4,2) NULL,
    max_security_deposit_months DECIMAL(4,2) NULL,
    same_lessee_required BOOLEAN NOT NULL DEFAULT FALSE,
    new_construction_cutoff DATE NULL,
    effective_from DATE NULL,
    effective_to DATE NULL,
    source_url VARCHAR(500) NULL,
    verification_status VARCHAR(30) NOT NULL DEFAULT 'requires_manual_verification',
    PRIMARY KEY (regulation_id),
    UNIQUE KEY rental_regulation_code_uq (regulation_code),
    KEY idx_rental_regulation_dates (effective_from, effective_to),
    CONSTRAINT rental_regulation_applies_chk CHECK (applies_to IN ('residential', 'all')),
    CONSTRAINT rental_regulation_rent_chk CHECK (monthly_rent_ceiling IS NULL OR monthly_rent_ceiling >= 0),
    CONSTRAINT rental_regulation_increase_chk CHECK (annual_increase_percent IS NULL OR annual_increase_percent >= 0),
    CONSTRAINT rental_regulation_advance_chk CHECK (max_advance_months IS NULL OR max_advance_months >= 0),
    CONSTRAINT rental_regulation_deposit_chk CHECK (max_security_deposit_months IS NULL OR max_security_deposit_months >= 0),
    CONSTRAINT rental_regulation_dates_chk CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
    CONSTRAINT rental_regulation_verification_chk CHECK (verification_status IN ('verified', 'requires_manual_verification'))
) ENGINE=InnoDB;

ALTER TABLE lease
    ADD CONSTRAINT lease_regulation_fk
        FOREIGN KEY (regulation_id) REFERENCES rental_regulation (regulation_id) ON DELETE RESTRICT;

CREATE TABLE lease_deposit (
    deposit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    lease_id BIGINT UNSIGNED NOT NULL,
    original_amount DECIMAL(12,2) NOT NULL,
    received_date DATE NULL,
    bank_deposit_date DATE NULL,
    bank_account_reference VARCHAR(255) NULL,
    accrued_interest DECIMAL(12,2) NOT NULL DEFAULT 0,
    refund_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    refund_date DATE NULL,
    settlement_status VARCHAR(30) NOT NULL DEFAULT 'pending',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (deposit_id),
    UNIQUE KEY lease_deposit_lease_uq (lease_id),
    CONSTRAINT lease_deposit_lease_fk FOREIGN KEY (lease_id) REFERENCES lease (lease_id) ON DELETE RESTRICT,
    CONSTRAINT lease_deposit_amount_chk CHECK (original_amount >= 0),
    CONSTRAINT lease_deposit_interest_chk CHECK (accrued_interest >= 0),
    CONSTRAINT lease_deposit_refund_chk CHECK (refund_amount >= 0),
    CONSTRAINT lease_deposit_status_chk CHECK (settlement_status IN ('pending', 'held', 'partially_refunded', 'refunded', 'settled'))
) ENGINE=InnoDB;

INSERT INTO lease_deposit (lease_id, original_amount, settlement_status)
SELECT lease_id, security_deposit, IF(security_deposit > 0, 'pending', 'settled')
FROM lease;

CREATE TABLE lease_deposit_deduction (
    deduction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    deposit_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT NOT NULL,
    supporting_document_ref VARCHAR(500) NOT NULL,
    authorized_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    authorized_by BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (deduction_id),
    KEY idx_deposit_deduction_deposit (deposit_id),
    CONSTRAINT deposit_deduction_deposit_fk FOREIGN KEY (deposit_id) REFERENCES lease_deposit (deposit_id) ON DELETE RESTRICT,
    CONSTRAINT deposit_deduction_user_fk FOREIGN KEY (authorized_by) REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT deposit_deduction_amount_chk CHECK (amount > 0),
    CONSTRAINT deposit_deduction_reason_chk CHECK (CHAR_LENGTH(TRIM(reason)) > 0),
    CONSTRAINT deposit_deduction_evidence_chk CHECK (CHAR_LENGTH(TRIM(supporting_document_ref)) > 0)
) ENGINE=InnoDB;

CREATE TABLE rent_increase_history (
    rent_increase_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    lease_id BIGINT UNSIGNED NOT NULL,
    previous_monthly_rent DECIMAL(12,2) NOT NULL,
    proposed_monthly_rent DECIMAL(12,2) NOT NULL,
    approved_monthly_rent DECIMAL(12,2) NULL,
    increase_percent DECIMAL(7,4) NOT NULL,
    effective_date DATE NOT NULL,
    regulation_id BIGINT UNSIGNED NULL,
    approval_date DATE NULL,
    reason TEXT NOT NULL,
    assessment_status VARCHAR(40) NOT NULL,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (rent_increase_id),
    KEY idx_rent_increase_lease_date (lease_id, effective_date),
    CONSTRAINT rent_increase_lease_fk FOREIGN KEY (lease_id) REFERENCES lease (lease_id) ON DELETE RESTRICT,
    CONSTRAINT rent_increase_regulation_fk FOREIGN KEY (regulation_id) REFERENCES rental_regulation (regulation_id) ON DELETE RESTRICT,
    CONSTRAINT rent_increase_user_fk FOREIGN KEY (created_by) REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT rent_increase_previous_chk CHECK (previous_monthly_rent > 0),
    CONSTRAINT rent_increase_proposed_chk CHECK (proposed_monthly_rent > 0),
    CONSTRAINT rent_increase_approved_chk CHECK (approved_monthly_rent IS NULL OR approved_monthly_rent > 0),
    CONSTRAINT rent_increase_percent_chk CHECK (increase_percent >= 0),
    CONSTRAINT rent_increase_status_chk CHECK (assessment_status IN ('approved', 'not_covered', 'requires_manual_verification'))
) ENGINE=InnoDB;

CREATE TABLE lease_notice (
    notice_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    lease_id BIGINT UNSIGNED NOT NULL,
    notice_type VARCHAR(40) NOT NULL,
    notice_date DATE NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    legal_ground VARCHAR(80) NULL,
    written_sublease_consent BOOLEAN NOT NULL DEFAULT FALSE,
    supporting_document_ref VARCHAR(500) NULL,
    recorded_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notice_id),
    KEY idx_lease_notice_lease_date (lease_id, notice_date),
    CONSTRAINT lease_notice_lease_fk FOREIGN KEY (lease_id) REFERENCES lease (lease_id) ON DELETE RESTRICT,
    CONSTRAINT lease_notice_user_fk FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT lease_notice_type_chk CHECK (notice_type IN ('tenant_notice', 'payment_demand', 'lease_expiration', 'lease_termination', 'sublease_consent', 'other')),
    CONSTRAINT lease_notice_ground_chk CHECK (legal_ground IS NULL OR legal_ground IN ('unauthorized_sublease', 'rent_arrears', 'owner_or_family_use', 'necessary_repairs', 'lease_expiration', 'other'))
) ENGINE=InnoDB;

INSERT INTO rental_regulation
    (regulation_code, title, applies_to, monthly_rent_ceiling, annual_increase_percent,
     max_advance_months, max_security_deposit_months, same_lessee_required,
     new_construction_cutoff, effective_from, effective_to, source_url, verification_status)
VALUES
    ('RA9653-SEC7', 'Republic Act No. 9653, Section 7', 'residential', NULL, NULL,
     1, 2, FALSE, NULL, NULL, NULL,
     'https://lawphil.net/statutes/repacts/ra2009/ra_9653_2009.html', 'verified'),
    ('NHSB-2024-01', 'NHSB Resolution No. 2024-01 (2025-2026 rent increase cap)', 'residential',
     10000, 1, NULL, NULL, TRUE, NULL, '2025-01-01', '2026-12-31',
     NULL, 'requires_manual_verification');
