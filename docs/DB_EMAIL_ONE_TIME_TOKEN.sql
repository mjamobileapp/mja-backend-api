CREATE TABLE IF NOT EXISTS tbl_email_one_time_token (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  jti CHAR(36) NOT NULL,
  username VARCHAR(255) NOT NULL,
  tokenType VARCHAR(50) NOT NULL,
  expiresAt DATETIME NOT NULL,
  usedAt DATETIME NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_one_time_token_jti (jti),
  INDEX idx_email_one_time_token_lookup (jti, username, tokenType, usedAt, expiresAt)
);
