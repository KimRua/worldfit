CREATE DATABASE IF NOT EXISTS verifit
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE verifit;

CREATE TABLE IF NOT EXISTS company_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_name VARCHAR(120) NOT NULL,
  company_email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  account_locked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_company_users_email (company_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  marketing_consent TINYINT(1) NOT NULL DEFAULT 0,
  world_id_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_candidate_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_email_verifications (
  company_email VARCHAR(255) NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  resend_available_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_email_verifications (
  email VARCHAR(255) NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  resend_available_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_world_id_verifications (
  email VARCHAR(255) NOT NULL,
  action VARCHAR(120) NOT NULL,
  nullifier_hash VARCHAR(255) NOT NULL,
  signal_hash VARCHAR(255) NOT NULL,
  credential_type VARCHAR(64) NOT NULL,
  protocol_version VARCHAR(16) NOT NULL,
  environment VARCHAR(32) NOT NULL,
  verified_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (email),
  UNIQUE KEY uq_candidate_world_id_nullifier (nullifier_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_unlock_verifications (
  company_email VARCHAR(255) NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  verified_at DATETIME NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  resend_available_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
