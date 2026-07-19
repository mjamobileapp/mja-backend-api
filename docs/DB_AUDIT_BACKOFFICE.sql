CREATE TABLE IF NOT EXISTS tbl_audit_backoffice (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NULL,
  username VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  actionType VARCHAR(50) NOT NULL,
  entityName VARCHAR(100) NOT NULL,
  entityId VARCHAR(100) NULL,
  oldValues JSON NULL,
  newValues JSON NULL,
  ipAddress VARCHAR(45) NULL,
  userAgent TEXT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_backoffice_user FOREIGN KEY (userId) REFERENCES tbl_users(id) ON DELETE SET NULL,
  INDEX idx_audit_backoffice_user (userId),
  INDEX idx_audit_backoffice_action (actionType),
  INDEX idx_audit_backoffice_entity (entityName, entityId),
  INDEX idx_audit_backoffice_created (createdAt)
);
