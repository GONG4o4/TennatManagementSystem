-- Classify documented deposit deductions as an unpaid obligation or damage.
-- Run once after 20261107_rental_compliance.sql.

ALTER TABLE lease_deposit_deduction
    ADD COLUMN basis VARCHAR(30) NOT NULL DEFAULT 'unpaid_obligation',
    ADD CONSTRAINT deposit_deduction_basis_chk CHECK (basis IN ('unpaid_obligation', 'damage'));
