-- Extend existing screening records without deleting prior applications or evaluations.
-- Run once on existing TenantFlow databases.

ALTER TABLE screening_criteria
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE screening_result
    ADD COLUMN evaluated_by BIGINT UNSIGNED NULL,
    ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD KEY idx_result_evaluator (evaluated_by),
    ADD CONSTRAINT result_evaluator_fk
        FOREIGN KEY (evaluated_by) REFERENCES users (user_id) ON DELETE SET NULL;

CREATE TABLE screening_criteria_defaults_initialized (
    landlord_id BIGINT UNSIGNED NOT NULL,
    initialized_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (landlord_id),
    CONSTRAINT screening_defaults_landlord_fk
        FOREIGN KEY (landlord_id) REFERENCES landlord (landlord_id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO screening_criteria (landlord_id, criteria_name, description, is_active)
SELECT l.landlord_id, defaults.criteria_name, defaults.description, TRUE
FROM landlord l
CROSS JOIN (
    SELECT 'Proof of income' AS criteria_name,
           'Applicant must provide proof of a stable and sufficient source of income, such as payslips, certificate of employment, bank statements, or business income records. The landlord should assess whether the applicant can reasonably afford the monthly rent.' AS description
    UNION ALL SELECT 'Valid government-issued ID',
           'Applicant must provide a valid government-issued identification document to verify their identity and ensure that the information provided in the rental application is accurate.'
    UNION ALL SELECT 'Employment verification',
           'Applicant should provide supporting documents confirming their current employment, business activity, or other legitimate source of income. Self-employed applicants may submit relevant business or income records.'
    UNION ALL SELECT 'Previous rental history',
           'Applicant may provide previous landlord references or rental records to help assess their history of fulfilling rental obligations, maintaining rental properties, and following lease agreements.'
    UNION ALL SELECT 'Personal references',
           'Applicant should provide contact information for at least one verifiable personal or professional reference who can confirm relevant information about the applicant.'
    UNION ALL SELECT 'Application document completeness',
           'Applicant must submit all required application information and supporting documents requested by the landlord before the screening process can be completed.'
) AS defaults
WHERE NOT EXISTS (
    SELECT 1 FROM screening_criteria existing
    WHERE existing.landlord_id = l.landlord_id
      AND LOWER(existing.criteria_name) = LOWER(defaults.criteria_name)
);

INSERT IGNORE INTO screening_criteria_defaults_initialized (landlord_id)
SELECT landlord_id FROM landlord;
