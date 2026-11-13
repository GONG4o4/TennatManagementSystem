-- Add public rental listings, renter onboarding documents, and verified tenant reviews.
-- Run once on existing TenantFlow databases.

ALTER TABLE tenant
    ADD COLUMN middle_name VARCHAR(100) NULL AFTER first_name,
    ADD COLUMN birthdate DATE NULL AFTER last_name,
    ADD COLUMN employment_status VARCHAR(30) NULL,
    ADD COLUMN monthly_income DECIMAL(12,2) NULL;

ALTER TABLE tenant_application
    ADD COLUMN unit_id BIGINT UNSIGNED NULL AFTER landlord_id,
    ADD KEY idx_app_unit (unit_id),
    ADD CONSTRAINT app_unit_fk FOREIGN KEY (unit_id) REFERENCES rental_unit (unit_id) ON DELETE RESTRICT;

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
