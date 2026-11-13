-- =====================================================================
-- Landlord-Tenant Management System  |  MySQL / MariaDB schema (XAMPP friendly)
-- From Logical ERD v1 - 25 tables.
-- Requires: MariaDB 10.4+ (XAMPP) or MySQL 8.0.16+ (CHECK constraints enforced).
-- Times are stored as DATETIME in UTC (MySQL has no TIMESTAMPTZ).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS landlord_tenant
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;   -- unicode_ci = case-insensitive text (so emails are unique ignoring case)
USE landlord_tenant;

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- ACCOUNTS
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    email           VARCHAR(255)    NOT NULL,
    password_hash   TEXT            NOT NULL,
    role            VARCHAR(20)     NOT NULL,
    account_status  VARCHAR(30)     NOT NULL DEFAULT 'active',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    UNIQUE KEY users_email_uq (email),
    CONSTRAINT users_role_chk   CHECK (role IN ('landlord', 'applicant', 'tenant')),
    CONSTRAINT users_status_chk CHECK (account_status IN ('pending_verification', 'active', 'disabled')),
    CONSTRAINT users_email_chk  CHECK (CHAR_LENGTH(TRIM(email)) > 0 AND CHAR_LENGTH(email) = CHAR_LENGTH(TRIM(email))),
    CONSTRAINT users_hash_chk   CHECK (CHAR_LENGTH(TRIM(password_hash)) > 0)
) ENGINE=InnoDB;

CREATE TABLE landlord (
    landlord_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id        BIGINT UNSIGNED NOT NULL,
    first_name     VARCHAR(100)    NOT NULL,
    last_name      VARCHAR(100)    NOT NULL,
    phone          VARCHAR(30)     NULL,
    business_name  VARCHAR(150)    NULL,
    PRIMARY KEY (landlord_id),
    UNIQUE KEY landlord_user_uq (user_id),
    CONSTRAINT landlord_user_fk  FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT landlord_first_chk CHECK (CHAR_LENGTH(TRIM(first_name)) > 0),
    CONSTRAINT landlord_last_chk  CHECK (CHAR_LENGTH(TRIM(last_name))  > 0)
) ENGINE=InnoDB;

CREATE TABLE tenant (
    tenant_id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id                  BIGINT UNSIGNED NULL,          -- NULL = tenant has no login yet
    first_name               VARCHAR(100)    NOT NULL,
    middle_name              VARCHAR(100)    NULL,
    last_name                VARCHAR(100)    NOT NULL,
    birthdate                DATE            NULL,
    email                    VARCHAR(255)    NULL,
    phone                    VARCHAR(30)     NULL,
    current_address          TEXT            NULL,
    emergency_contact_name   VARCHAR(150)    NULL,
    emergency_contact_phone  VARCHAR(30)     NULL,
    employment_status        VARCHAR(30)     NULL,
    monthly_income           DECIMAL(12,2)   NULL,
    created_at               DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tenant_id),
    UNIQUE KEY tenant_user_uq (user_id),                    -- MySQL allows many NULLs in a UNIQUE column
    CONSTRAINT tenant_user_fk   FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT tenant_first_chk CHECK (CHAR_LENGTH(TRIM(first_name)) > 0),
    CONSTRAINT tenant_last_chk  CHECK (CHAR_LENGTH(TRIM(last_name))  > 0),
    CONSTRAINT tenant_income_chk CHECK (monthly_income IS NULL OR monthly_income >= 0)
) ENGINE=InnoDB;

CREATE TABLE tenant_document (
    document_id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_id            BIGINT UNSIGNED NOT NULL,
    document_type        VARCHAR(40)     NOT NULL,
    file_path            VARCHAR(255)    NOT NULL,
    original_name        VARCHAR(255)    NOT NULL,
    content_type         VARCHAR(100)    NOT NULL,
    file_size            INT UNSIGNED    NOT NULL,
    verification_status  VARCHAR(20)     NOT NULL DEFAULT 'pending',
    uploaded_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id),
    KEY idx_tenant_document_tenant (tenant_id),
    CONSTRAINT tenant_document_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenant (tenant_id) ON DELETE CASCADE,
    CONSTRAINT tenant_document_type_chk CHECK (document_type IN ('government_id', 'proof_of_income', 'reference_letter')),
    CONSTRAINT tenant_document_status_chk CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    CONSTRAINT tenant_document_size_chk CHECK (file_size > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- PROPERTIES
-- ---------------------------------------------------------------------
CREATE TABLE property (
    property_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    landlord_id      BIGINT UNSIGNED NOT NULL,
    property_name    VARCHAR(150)    NOT NULL,
    property_type    VARCHAR(30)     NOT NULL,
    address          TEXT            NOT NULL,
    description      TEXT            NULL,
    rental_classification VARCHAR(20) NOT NULL DEFAULT 'unknown',
    construction_date DATE           NULL,
    property_status  VARCHAR(20)     NOT NULL DEFAULT 'active',
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (property_id),
    UNIQUE KEY property_name_uq (landlord_id, property_name),
    CONSTRAINT property_landlord_fk FOREIGN KEY (landlord_id) REFERENCES landlord (landlord_id) ON DELETE RESTRICT,
    CONSTRAINT property_name_chk   CHECK (CHAR_LENGTH(TRIM(property_name)) > 0),
    CONSTRAINT property_type_chk   CHECK (property_type IN ('apartment', 'house', 'condo', 'townhouse', 'boarding_house', 'commercial', 'other')),
    CONSTRAINT property_rental_classification_chk CHECK (rental_classification IN ('residential', 'commercial', 'unknown')),
    CONSTRAINT property_status_chk CHECK (property_status IN ('active', 'inactive', 'archived'))
) ENGINE=InnoDB;

CREATE TABLE rental_unit (
    unit_id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    property_id       BIGINT UNSIGNED NOT NULL,
    unit_number       VARCHAR(30)     NOT NULL,
    unit_type         VARCHAR(30)     NULL,
    bedroom_count     SMALLINT        NOT NULL DEFAULT 0,
    bathroom_count    SMALLINT        NOT NULL DEFAULT 1,
    monthly_rent      DECIMAL(12,2)   NOT NULL,
    security_deposit  DECIMAL(12,2)   NOT NULL DEFAULT 0,
    unit_status       VARCHAR(20)     NOT NULL DEFAULT 'vacant',
    description       TEXT            NULL,
    PRIMARY KEY (unit_id),
    UNIQUE KEY unit_number_uq (property_id, unit_number),
    KEY idx_unit_status (unit_status),
    CONSTRAINT unit_property_fk  FOREIGN KEY (property_id) REFERENCES property (property_id) ON DELETE RESTRICT,
    CONSTRAINT unit_number_chk   CHECK (CHAR_LENGTH(TRIM(unit_number)) > 0),
    CONSTRAINT unit_bedroom_chk  CHECK (bedroom_count  >= 0),
    CONSTRAINT unit_bathroom_chk CHECK (bathroom_count >= 0),
    CONSTRAINT unit_rent_chk     CHECK (monthly_rent > 0),
    CONSTRAINT unit_deposit_chk  CHECK (security_deposit >= 0),
    CONSTRAINT unit_status_chk   CHECK (unit_status IN ('vacant', 'reserved', 'occupied', 'maintenance', 'inactive'))
) ENGINE=InnoDB;

CREATE TABLE rental_unit_image (
    image_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    unit_id      BIGINT UNSIGNED NOT NULL,
    image_path   VARCHAR(255)    NOT NULL,
    uploaded_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (image_id),
    KEY idx_unit_image_unit (unit_id),
    CONSTRAINT unit_image_unit_fk FOREIGN KEY (unit_id) REFERENCES rental_unit (unit_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE property_review (
    review_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    property_id   BIGINT UNSIGNED NOT NULL,
    tenant_id     BIGINT UNSIGNED NOT NULL,
    rating        TINYINT UNSIGNED NOT NULL,
    review_text   TEXT            NOT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (review_id),
    UNIQUE KEY property_review_once_uq (property_id, tenant_id),
    KEY idx_property_review_property (property_id, created_at),
    CONSTRAINT property_review_property_fk FOREIGN KEY (property_id) REFERENCES property (property_id) ON DELETE CASCADE,
    CONSTRAINT property_review_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenant (tenant_id) ON DELETE CASCADE,
    CONSTRAINT property_review_rating_chk CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT property_review_text_chk CHECK (CHAR_LENGTH(TRIM(review_text)) > 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- APPLICATIONS & SCREENING
-- ---------------------------------------------------------------------
CREATE TABLE tenant_application (
    application_id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    tenant_id             BIGINT UNSIGNED NOT NULL,
    landlord_id           BIGINT UNSIGNED NOT NULL,
    unit_id               BIGINT UNSIGNED NULL,
    desired_move_in_date  DATE            NULL,
    employment_status     VARCHAR(30)     NULL,
    monthly_income        DECIMAL(12,2)   NULL,
    additional_notes      TEXT            NULL,
    application_status    VARCHAR(20)     NOT NULL DEFAULT 'submitted',
    application_date      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at           DATETIME        NULL,
    PRIMARY KEY (application_id),
    KEY idx_app_tenant (tenant_id),
    KEY idx_app_landlord_status (landlord_id, application_status),
    KEY idx_app_unit (unit_id),
    CONSTRAINT app_tenant_fk   FOREIGN KEY (tenant_id)  REFERENCES tenant   (tenant_id)   ON DELETE RESTRICT,
    CONSTRAINT app_landlord_fk FOREIGN KEY (landlord_id) REFERENCES landlord (landlord_id) ON DELETE RESTRICT,
    CONSTRAINT app_unit_fk FOREIGN KEY (unit_id) REFERENCES rental_unit (unit_id) ON DELETE RESTRICT,
    CONSTRAINT app_status_chk   CHECK (application_status IN ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn')),
    CONSTRAINT app_income_chk   CHECK (monthly_income IS NULL OR monthly_income >= 0),
    CONSTRAINT app_review_chk   CHECK (reviewed_at IS NULL OR reviewed_at >= application_date),
    CONSTRAINT app_decision_chk CHECK (application_status NOT IN ('approved', 'rejected') OR reviewed_at IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE application_document (
    document_id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    application_id       BIGINT UNSIGNED NOT NULL,
    document_type        VARCHAR(40)     NOT NULL,
    file_path            TEXT            NOT NULL,
    verification_status  VARCHAR(20)     NOT NULL DEFAULT 'pending',
    uploaded_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (document_id),
    KEY idx_appdoc_application (application_id),
    CONSTRAINT doc_application_fk FOREIGN KEY (application_id) REFERENCES tenant_application (application_id) ON DELETE CASCADE,
    CONSTRAINT doc_type_chk   CHECK (document_type IN ('government_id', 'proof_of_income', 'employment_certificate', 'bank_statement', 'reference_letter', 'other')),
    CONSTRAINT doc_path_chk   CHECK (CHAR_LENGTH(TRIM(file_path)) > 0),
    CONSTRAINT doc_status_chk CHECK (verification_status IN ('pending', 'verified', 'rejected'))
) ENGINE=InnoDB;

CREATE TABLE screening (
    screening_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    application_id    BIGINT UNSIGNED NOT NULL,              -- 1 : 0..1
    screened_by       BIGINT UNSIGNED NOT NULL,              -- must be a landlord (trigger below)
    screening_date    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    screening_status  VARCHAR(20)     NOT NULL DEFAULT 'in_progress',
    remarks           TEXT            NULL,
    PRIMARY KEY (screening_id),
    UNIQUE KEY screening_application_uq (application_id),
    KEY idx_screening_by (screened_by),
    CONSTRAINT screening_application_fk FOREIGN KEY (application_id) REFERENCES tenant_application (application_id) ON DELETE RESTRICT,
    CONSTRAINT screening_by_fk          FOREIGN KEY (screened_by)    REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT screening_status_chk CHECK (screening_status IN ('in_progress', 'passed', 'failed', 'cancelled'))
) ENGINE=InnoDB;

CREATE TABLE screening_criteria (
    criteria_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    landlord_id    BIGINT UNSIGNED NOT NULL,
    criteria_name  VARCHAR(150)    NOT NULL,
    description    TEXT            NULL,
    is_active      BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (criteria_id),
    UNIQUE KEY criteria_name_uq (landlord_id, criteria_name),
    CONSTRAINT criteria_landlord_fk FOREIGN KEY (landlord_id) REFERENCES landlord (landlord_id) ON DELETE RESTRICT,
    CONSTRAINT criteria_name_chk CHECK (CHAR_LENGTH(TRIM(criteria_name)) > 0)
) ENGINE=InnoDB;

CREATE TABLE screening_criteria_defaults_initialized (
    landlord_id BIGINT UNSIGNED NOT NULL,
    initialized_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (landlord_id),
    CONSTRAINT screening_defaults_landlord_fk
        FOREIGN KEY (landlord_id) REFERENCES landlord (landlord_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE screening_result (
    result_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    screening_id   BIGINT UNSIGNED NOT NULL,
    criteria_id    BIGINT UNSIGNED NOT NULL,
    result_status  VARCHAR(20)     NOT NULL DEFAULT 'pending',
    remarks        TEXT            NULL,
    verified_at    DATETIME        NULL,
    evaluated_by   BIGINT UNSIGNED NULL,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (result_id),
    UNIQUE KEY result_once_uq (screening_id, criteria_id),   -- one result per criterion per screening
    KEY idx_result_criteria (criteria_id),
    KEY idx_result_evaluator (evaluated_by),
    CONSTRAINT result_screening_fk FOREIGN KEY (screening_id) REFERENCES screening (screening_id) ON DELETE CASCADE,
    CONSTRAINT result_criteria_fk  FOREIGN KEY (criteria_id)  REFERENCES screening_criteria (criteria_id) ON DELETE RESTRICT,
    CONSTRAINT result_evaluator_fk FOREIGN KEY (evaluated_by) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT result_status_chk   CHECK (result_status IN ('pending', 'passed', 'failed', 'not_applicable')),
    CONSTRAINT result_verified_chk CHECK (result_status = 'pending' OR verified_at IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- LEASES
-- ---------------------------------------------------------------------
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

CREATE TABLE lease (
    lease_id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    application_id    BIGINT UNSIGNED NOT NULL,              -- 1 : 0..1
    unit_id           BIGINT UNSIGNED NOT NULL,
    lease_start_date  DATE            NOT NULL,
    lease_end_date    DATE            NOT NULL,
    monthly_rent      DECIMAL(12,2)   NOT NULL,              -- snapshot of the agreed rent
    security_deposit  DECIMAL(12,2)   NOT NULL DEFAULT 0,
    advance_payment   DECIMAL(12,2)   NOT NULL DEFAULT 0,
    payment_due_day   SMALLINT        NOT NULL DEFAULT 1,
    regulation_id     BIGINT UNSIGNED NULL,
    compliance_status VARCHAR(40)     NOT NULL DEFAULT 'requires_manual_verification',
    compliance_assessment TEXT        NULL,
    lease_status      VARCHAR(20)     NOT NULL DEFAULT 'pending',
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (lease_id),
    UNIQUE KEY lease_application_uq (application_id),
    KEY idx_lease_unit (unit_id),
    KEY idx_lease_status (lease_status),
    CONSTRAINT lease_application_fk FOREIGN KEY (application_id) REFERENCES tenant_application (application_id) ON DELETE RESTRICT,
    CONSTRAINT lease_unit_fk        FOREIGN KEY (unit_id)        REFERENCES rental_unit (unit_id) ON DELETE RESTRICT,
    CONSTRAINT lease_regulation_fk  FOREIGN KEY (regulation_id) REFERENCES rental_regulation (regulation_id) ON DELETE RESTRICT,
    CONSTRAINT lease_dates_chk   CHECK (lease_end_date > lease_start_date),
    CONSTRAINT lease_rent_chk    CHECK (monthly_rent > 0),
    CONSTRAINT lease_deposit_chk CHECK (security_deposit >= 0),
    CONSTRAINT lease_advance_chk CHECK (advance_payment  >= 0),
    CONSTRAINT lease_due_day_chk   CHECK (payment_due_day BETWEEN 1 AND 31),
    CONSTRAINT lease_compliance_status_chk CHECK (compliance_status IN ('compliant', 'not_covered', 'requires_manual_verification')),
    CONSTRAINT lease_status_chk  CHECK (lease_status IN ('pending', 'active', 'ended', 'terminated', 'cancelled'))
) ENGINE=InnoDB;

CREATE TABLE lease_tenant (
    lease_tenant_id  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    lease_id         BIGINT UNSIGNED NOT NULL,
    tenant_id        BIGINT UNSIGNED NOT NULL,
    tenant_type      VARCHAR(20)     NOT NULL DEFAULT 'primary',
    joined_at        DATE            NOT NULL DEFAULT (CURRENT_DATE),
    left_at          DATE            NULL,
    -- Helper columns that stand in for PostgreSQL "partial unique indexes".
    -- They hold a value only for current rows, and NULL otherwise (UNIQUE ignores NULLs).
    current_tenant_key   BIGINT UNSIGNED GENERATED ALWAYS AS (IF(left_at IS NULL, tenant_id, NULL)) STORED,
    current_primary_key  BIGINT UNSIGNED GENERATED ALWAYS AS (IF(left_at IS NULL AND tenant_type = 'primary', lease_id, NULL)) STORED,
    PRIMARY KEY (lease_tenant_id),
    UNIQUE KEY lt_history_uq     (lease_id, tenant_id, joined_at),
    UNIQUE KEY lt_one_current_uq (lease_id, current_tenant_key),   -- a tenant can be current on a lease only once
    UNIQUE KEY lt_one_primary_uq (current_primary_key),            -- only one current primary tenant per lease
    KEY idx_lt_tenant (tenant_id),
    CONSTRAINT lt_lease_fk  FOREIGN KEY (lease_id)  REFERENCES lease  (lease_id)  ON DELETE CASCADE,
    CONSTRAINT lt_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenant (tenant_id) ON DELETE RESTRICT,
    CONSTRAINT lt_type_chk  CHECK (tenant_type IN ('primary', 'co_tenant')),
    CONSTRAINT lt_dates_chk CHECK (left_at IS NULL OR left_at >= joined_at)
) ENGINE=InnoDB;

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

CREATE TABLE lease_deposit_deduction (
    deduction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    deposit_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    basis VARCHAR(30) NOT NULL,
    reason TEXT NOT NULL,
    supporting_document_ref VARCHAR(500) NOT NULL,
    authorized_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    authorized_by BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (deduction_id),
    KEY idx_deposit_deduction_deposit (deposit_id),
    CONSTRAINT deposit_deduction_deposit_fk FOREIGN KEY (deposit_id) REFERENCES lease_deposit (deposit_id) ON DELETE RESTRICT,
    CONSTRAINT deposit_deduction_user_fk FOREIGN KEY (authorized_by) REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT deposit_deduction_amount_chk CHECK (amount > 0),
    CONSTRAINT deposit_deduction_basis_chk CHECK (basis IN ('unpaid_obligation', 'damage')),
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

-- ---------------------------------------------------------------------
-- FINANCE
-- ---------------------------------------------------------------------
CREATE TABLE rent_invoice (
    invoice_id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    lease_id              BIGINT UNSIGNED NOT NULL,
    invoice_number        VARCHAR(50)     NOT NULL,
    billing_period_start  DATE            NOT NULL,
    billing_period_end    DATE            NOT NULL,
    issue_date            DATE            NOT NULL DEFAULT (CURRENT_DATE),
    due_date              DATE            NOT NULL,
    total_amount          DECIMAL(12,2)   NOT NULL,
    invoice_status        VARCHAR(20)     NOT NULL DEFAULT 'unpaid',
    created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Stand-in for a partial unique index: voided invoices don't count as duplicates.
    live_invoice_flag     TINYINT GENERATED ALWAYS AS (IF(invoice_status <> 'void', 1, NULL)) STORED,
    PRIMARY KEY (invoice_id),
    UNIQUE KEY invoice_number_uq (invoice_number),
    UNIQUE KEY inv_period_uq (lease_id, billing_period_start, live_invoice_flag),   -- no duplicate billing for a lease + period
    KEY idx_invoice_status_due (invoice_status, due_date),
    CONSTRAINT inv_lease_fk   FOREIGN KEY (lease_id) REFERENCES lease (lease_id) ON DELETE RESTRICT,
    CONSTRAINT inv_period_chk CHECK (billing_period_end >= billing_period_start),
    CONSTRAINT inv_due_chk    CHECK (due_date >= issue_date),
    CONSTRAINT inv_total_chk  CHECK (total_amount >= 0),
    CONSTRAINT inv_status_chk CHECK (invoice_status IN ('unpaid', 'partially_paid', 'paid', 'overdue', 'void'))
) ENGINE=InnoDB;

CREATE TABLE payment_attempt (
    attempt_id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id         BIGINT UNSIGNED NOT NULL,
    tenant_id          BIGINT UNSIGNED NOT NULL,             -- must be a tenant on the invoice's lease (trigger below)
    gateway_name       VARCHAR(50)     NOT NULL,
    gateway_reference  VARCHAR(100)    NOT NULL,
    amount             DECIMAL(12,2)   NOT NULL,
    payment_method     VARCHAR(30)     NOT NULL,
    attempt_status     VARCHAR(20)     NOT NULL DEFAULT 'pending',
    initiated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at       DATETIME        NULL,
    PRIMARY KEY (attempt_id),
    UNIQUE KEY gateway_reference_uq (gateway_reference),
    KEY idx_attempt_invoice (invoice_id),
    KEY idx_attempt_tenant (tenant_id),
    CONSTRAINT att_invoice_fk FOREIGN KEY (invoice_id) REFERENCES rent_invoice (invoice_id) ON DELETE RESTRICT,
    CONSTRAINT att_tenant_fk  FOREIGN KEY (tenant_id)  REFERENCES tenant (tenant_id) ON DELETE RESTRICT,
    CONSTRAINT att_amount_chk   CHECK (amount > 0),
    CONSTRAINT att_method_chk   CHECK (payment_method IN ('card', 'bank_transfer', 'e_wallet', 'cash', 'other')),
    CONSTRAINT att_status_chk   CHECK (attempt_status IN ('pending', 'successful', 'failed', 'cancelled', 'expired')),
    CONSTRAINT att_complete_chk CHECK (completed_at IS NULL OR completed_at >= initiated_at),
    CONSTRAINT att_final_chk    CHECK (attempt_status = 'pending' OR completed_at IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE payment (
    payment_id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    attempt_id             BIGINT UNSIGNED NOT NULL,         -- 1 : 0..1
    amount_paid            DECIMAL(12,2)   NOT NULL,
    refunded_amount        DECIMAL(12,2)   NOT NULL DEFAULT 0,
    refund_date            DATE            NULL,
    refund_reason          TEXT            NULL,
    transaction_reference  VARCHAR(100)    NOT NULL,
    receipt_number         VARCHAR(50)     NOT NULL,
    payment_status         VARCHAR(20)     NOT NULL DEFAULT 'completed',
    payment_date           DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (payment_id),
    UNIQUE KEY payment_attempt_uq (attempt_id),
    UNIQUE KEY transaction_reference_uq (transaction_reference),
    UNIQUE KEY receipt_number_uq (receipt_number),
    CONSTRAINT pay_attempt_fk FOREIGN KEY (attempt_id) REFERENCES payment_attempt (attempt_id) ON DELETE RESTRICT,
    CONSTRAINT pay_amount_chk CHECK (amount_paid > 0),
    CONSTRAINT payment_refund_amount_chk CHECK (refunded_amount >= 0 AND refunded_amount <= amount_paid),
    CONSTRAINT pay_status_chk CHECK (payment_status IN ('completed', 'refunded', 'reversed'))
) ENGINE=InnoDB;

CREATE TABLE payment_refund (
    refund_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT NOT NULL,
    refunded_by BIGINT UNSIGNED NULL,
    refunded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (refund_id),
    KEY idx_payment_refund_payment_date (payment_id, refunded_at),
    CONSTRAINT payment_refund_payment_fk FOREIGN KEY (payment_id) REFERENCES payment (payment_id) ON DELETE RESTRICT,
    CONSTRAINT payment_refund_user_fk FOREIGN KEY (refunded_by) REFERENCES users (user_id) ON DELETE SET NULL,
    CONSTRAINT payment_refund_amount_chk CHECK (amount > 0),
    CONSTRAINT payment_refund_reason_chk CHECK (CHAR_LENGTH(TRIM(reason)) > 0)
) ENGINE=InnoDB;

CREATE TABLE expense (
    expense_id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    property_id       BIGINT UNSIGNED NOT NULL,
    recorded_by       BIGINT UNSIGNED NOT NULL,              -- must be a landlord (trigger below)
    expense_category  VARCHAR(40)     NOT NULL,
    description       TEXT            NULL,
    amount            DECIMAL(12,2)   NOT NULL,
    expense_date      DATE            NOT NULL DEFAULT (CURRENT_DATE),
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (expense_id),
    KEY idx_expense_property_date (property_id, expense_date),
    KEY idx_expense_recorded_by (recorded_by),
    CONSTRAINT exp_property_fk FOREIGN KEY (property_id) REFERENCES property (property_id) ON DELETE RESTRICT,
    CONSTRAINT exp_user_fk     FOREIGN KEY (recorded_by) REFERENCES users (user_id) ON DELETE RESTRICT,
    CONSTRAINT exp_amount_chk   CHECK (amount > 0),
    CONSTRAINT exp_category_chk CHECK (expense_category IN ('maintenance', 'repairs', 'utilities', 'taxes', 'insurance', 'management', 'supplies', 'other'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- OPERATIONS
-- ---------------------------------------------------------------------
CREATE TABLE maintenance_request (
    request_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    lease_id        BIGINT UNSIGNED NOT NULL,
    tenant_id       BIGINT UNSIGNED NOT NULL,                -- must be a tenant on the lease (trigger below)
    title           VARCHAR(150)    NOT NULL,
    description     TEXT            NOT NULL,
    priority        VARCHAR(20)     NOT NULL DEFAULT 'normal',
    request_status  VARCHAR(20)     NOT NULL DEFAULT 'open',
    submitted_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    DATETIME        NULL,
    PRIMARY KEY (request_id),
    KEY idx_mr_lease (lease_id),
    KEY idx_mr_tenant (tenant_id),
    KEY idx_mr_status (request_status),
    CONSTRAINT mr_lease_fk  FOREIGN KEY (lease_id)  REFERENCES lease  (lease_id)  ON DELETE RESTRICT,
    CONSTRAINT mr_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenant (tenant_id) ON DELETE RESTRICT,
    CONSTRAINT mr_title_chk    CHECK (CHAR_LENGTH(TRIM(title)) > 0),
    CONSTRAINT mr_priority_chk CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CONSTRAINT mr_status_chk   CHECK (request_status IN ('open', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT mr_dates_chk    CHECK (completed_at IS NULL OR completed_at >= submitted_at),
    CONSTRAINT mr_done_chk     CHECK (request_status <> 'completed' OR completed_at IS NOT NULL)
) ENGINE=InnoDB;

CREATE TABLE notification (
    notification_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id            BIGINT UNSIGNED NOT NULL,
    title              VARCHAR(150)    NOT NULL,
    message            TEXT            NOT NULL,
    notification_type  VARCHAR(30)     NOT NULL,
    is_read            BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id),
    KEY idx_notif_user_unread (user_id, is_read),
    CONSTRAINT notif_user_fk FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    CONSTRAINT notif_type_chk CHECK (notification_type IN ('application', 'lease', 'invoice', 'payment', 'maintenance', 'system'))
) ENGINE=InnoDB;

CREATE TABLE audit_log (
    audit_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED NULL,                       -- kept as NULL if the user is later removed
    action       VARCHAR(50)     NOT NULL,
    entity_name  VARCHAR(100)    NOT NULL,
    record_id    BIGINT UNSIGNED NULL,
    old_values   JSON            NULL,
    new_values   JSON            NULL,
    created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (audit_id),
    KEY idx_audit_user (user_id),
    KEY idx_audit_entity (entity_name, record_id),
    CONSTRAINT audit_user_fk FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL
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

-- ---------------------------------------------------------------------
-- TRIGGERS: rules that a CHECK or FK cannot express
-- (phpMyAdmin: import this file as-is; in the SQL tab, set the Delimiter box to //)
-- ---------------------------------------------------------------------
DELIMITER //

-- ---- helper procedures that raise an error when a rule is broken ----

CREATE PROCEDURE sp_assert_landlord_user(IN p_user_id BIGINT UNSIGNED)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id AND role = 'landlord') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The referenced user must have the landlord role';
    END IF;
END//

CREATE PROCEDURE sp_assert_tenant_role_approved(IN p_user_id BIGINT UNSIGNED)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM tenant t
        JOIN tenant_application a ON a.tenant_id = t.tenant_id
        WHERE t.user_id = p_user_id AND a.application_status = 'approved'
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A user must have a landlord-approved application before becoming a tenant';
    END IF;
END//

CREATE PROCEDURE sp_assert_tenant_on_lease(IN p_lease_id BIGINT UNSIGNED, IN p_tenant_id BIGINT UNSIGNED)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM lease_tenant WHERE lease_id = p_lease_id AND tenant_id = p_tenant_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The tenant is not a tenant on this lease';
    END IF;
END//

CREATE PROCEDURE sp_assert_attempt_tenant(IN p_invoice_id BIGINT UNSIGNED, IN p_tenant_id BIGINT UNSIGNED)
BEGIN
    IF NOT EXISTS (SELECT 1
                   FROM rent_invoice i
                   JOIN lease_tenant lt ON lt.lease_id = i.lease_id
                   WHERE i.invoice_id = p_invoice_id AND lt.tenant_id = p_tenant_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The tenant is not a tenant on the lease of this invoice';
    END IF;
END//

CREATE PROCEDURE sp_assert_criteria_landlord(IN p_screening_id BIGINT UNSIGNED, IN p_criteria_id BIGINT UNSIGNED)
BEGIN
    IF NOT EXISTS (SELECT 1
                   FROM screening s
                   JOIN tenant_application a ON a.application_id = s.application_id
                   JOIN screening_criteria c ON c.landlord_id = a.landlord_id
                   WHERE s.screening_id = p_screening_id AND c.criteria_id = p_criteria_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The criteria does not belong to the landlord of this screening';
    END IF;
END//

CREATE PROCEDURE sp_assert_no_lease_overlap(
    IN p_lease_id BIGINT UNSIGNED, IN p_unit_id BIGINT UNSIGNED,
    IN p_start DATE, IN p_end DATE, IN p_status VARCHAR(20))
BEGIN
    IF p_status IN ('pending', 'active') THEN
        IF EXISTS (SELECT 1 FROM lease
                   WHERE unit_id = p_unit_id
                     AND lease_status IN ('pending', 'active')
                     AND lease_id <> IFNULL(p_lease_id, 0)
                     AND lease_start_date <= p_end
                     AND lease_end_date   >= p_start) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This unit already has a pending or active lease that overlaps these dates';
        END IF;
    END IF;
END//

-- ---- triggers (MySQL needs one for INSERT and one for UPDATE) ----

CREATE TRIGGER screening_role_ins BEFORE INSERT ON screening
FOR EACH ROW BEGIN CALL sp_assert_landlord_user(NEW.screened_by); END//
CREATE TRIGGER screening_role_upd BEFORE UPDATE ON screening
FOR EACH ROW BEGIN CALL sp_assert_landlord_user(NEW.screened_by); END//

CREATE TRIGGER users_tenant_role_ins BEFORE INSERT ON users
FOR EACH ROW BEGIN
    IF NEW.role = 'tenant' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Create the account as an applicant; landlord approval grants tenant role';
    END IF;
END//
CREATE TRIGGER users_tenant_role_upd BEFORE UPDATE ON users
FOR EACH ROW BEGIN
    IF NEW.role = 'tenant' AND OLD.role <> 'tenant' THEN
        CALL sp_assert_tenant_role_approved(NEW.user_id);
    END IF;
END//

CREATE TRIGGER applicant_approved_ins AFTER INSERT ON tenant_application
FOR EACH ROW BEGIN
    IF NEW.application_status = 'approved' THEN
        UPDATE users u
        JOIN tenant t ON t.user_id = u.user_id
        SET u.role = 'tenant'
        WHERE t.tenant_id = NEW.tenant_id AND u.role = 'applicant';
    END IF;
END//
CREATE TRIGGER applicant_approved_upd AFTER UPDATE ON tenant_application
FOR EACH ROW BEGIN
    IF NEW.application_status = 'approved' THEN
        UPDATE users u
        JOIN tenant t ON t.user_id = u.user_id
        SET u.role = 'tenant'
        WHERE t.tenant_id = NEW.tenant_id AND u.role = 'applicant';
    END IF;
END//

CREATE TRIGGER expense_role_ins BEFORE INSERT ON expense
FOR EACH ROW BEGIN CALL sp_assert_landlord_user(NEW.recorded_by); END//
CREATE TRIGGER expense_role_upd BEFORE UPDATE ON expense
FOR EACH ROW BEGIN CALL sp_assert_landlord_user(NEW.recorded_by); END//

CREATE TRIGGER maintenance_tenant_ins BEFORE INSERT ON maintenance_request
FOR EACH ROW BEGIN CALL sp_assert_tenant_on_lease(NEW.lease_id, NEW.tenant_id); END//
CREATE TRIGGER maintenance_tenant_upd BEFORE UPDATE ON maintenance_request
FOR EACH ROW BEGIN CALL sp_assert_tenant_on_lease(NEW.lease_id, NEW.tenant_id); END//

CREATE TRIGGER attempt_tenant_ins BEFORE INSERT ON payment_attempt
FOR EACH ROW BEGIN CALL sp_assert_attempt_tenant(NEW.invoice_id, NEW.tenant_id); END//
CREATE TRIGGER attempt_tenant_upd BEFORE UPDATE ON payment_attempt
FOR EACH ROW BEGIN CALL sp_assert_attempt_tenant(NEW.invoice_id, NEW.tenant_id); END//

CREATE TRIGGER result_criteria_ins BEFORE INSERT ON screening_result
FOR EACH ROW BEGIN CALL sp_assert_criteria_landlord(NEW.screening_id, NEW.criteria_id); END//
CREATE TRIGGER result_criteria_upd BEFORE UPDATE ON screening_result
FOR EACH ROW BEGIN CALL sp_assert_criteria_landlord(NEW.screening_id, NEW.criteria_id); END//

CREATE TRIGGER lease_overlap_ins BEFORE INSERT ON lease
FOR EACH ROW BEGIN CALL sp_assert_no_lease_overlap(NULL, NEW.unit_id, NEW.lease_start_date, NEW.lease_end_date, NEW.lease_status); END//
CREATE TRIGGER lease_overlap_upd BEFORE UPDATE ON lease
FOR EACH ROW BEGIN CALL sp_assert_no_lease_overlap(NEW.lease_id, NEW.unit_id, NEW.lease_start_date, NEW.lease_end_date, NEW.lease_status); END//

DELIMITER ;
