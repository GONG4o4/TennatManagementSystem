ALTER TABLE users DROP CONSTRAINT users_role_chk;

ALTER TABLE users
    ADD CONSTRAINT users_role_chk CHECK (role IN ('landlord', 'applicant', 'tenant'));

UPDATE users u
JOIN tenant t ON t.user_id = u.user_id
SET u.role = 'applicant'
WHERE u.role = 'tenant'
  AND NOT EXISTS (
      SELECT 1
      FROM tenant_application a
      WHERE a.tenant_id = t.tenant_id
        AND a.application_status = 'approved'
  );

UPDATE users u
JOIN tenant t ON t.user_id = u.user_id
JOIN tenant_application a ON a.tenant_id = t.tenant_id
SET u.role = 'tenant'
WHERE u.role = 'applicant'
  AND a.application_status = 'approved';

DELIMITER //

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

DELIMITER ;
