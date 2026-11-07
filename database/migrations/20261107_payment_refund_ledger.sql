-- Retain each refund independently instead of overwriting aggregate payment fields.
-- Run once after 20261107_rental_compliance.sql.

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

INSERT INTO payment_refund (payment_id, amount, reason, refunded_at)
SELECT payment_id, refunded_amount,
       COALESCE(NULLIF(TRIM(refund_reason), ''), 'Legacy refund - original details were not recorded.'),
       COALESCE(refund_date, DATE(payment_date))
FROM payment
WHERE refunded_amount > 0;
