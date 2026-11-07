ALTER TABLE rental_unit
    ADD COLUMN description TEXT NULL;

CREATE TABLE rental_unit_image (
    image_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    unit_id      BIGINT UNSIGNED NOT NULL,
    image_path   VARCHAR(255)    NOT NULL,
    uploaded_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (image_id),
    KEY idx_unit_image_unit (unit_id),
    CONSTRAINT unit_image_unit_fk FOREIGN KEY (unit_id) REFERENCES rental_unit (unit_id) ON DELETE CASCADE
) ENGINE=InnoDB;
