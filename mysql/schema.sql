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

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  password_changed_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_portal_profiles (
  company_user_id BIGINT UNSIGNED NOT NULL,
  contact VARCHAR(64) NOT NULL,
  language VARCHAR(64) NOT NULL,
  verification_payload JSON NOT NULL,
  credit_balance_usd INT NOT NULL DEFAULT 10000,
  credit_monthly_usage_usd INT NOT NULL DEFAULT 0,
  wallet_address VARCHAR(255) NOT NULL,
  credit_exchange_rate DECIMAL(10,3) NOT NULL DEFAULT 0.147,
  usage_series JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_user_id),
  CONSTRAINT fk_company_portal_profiles_user
    FOREIGN KEY (company_user_id) REFERENCES company_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_agent_catalog (
  id VARCHAR(64) NOT NULL,
  icon VARCHAR(16) NOT NULL,
  name VARCHAR(120) NOT NULL,
  billing_label VARCHAR(64) NOT NULL,
  description VARCHAR(255) NOT NULL,
  default_selected TINYINT(1) NOT NULL DEFAULT 0,
  default_weight INT NOT NULL DEFAULT 0,
  locked TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_company_agent_catalog_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO company_agent_catalog (
  id, icon, name, billing_label, description, default_selected, default_weight, locked, sort_order
)
VALUES
  ('technical', '⚙', 'Technical Evaluator', 'Technical', '코드 구조·설계 품질·기술 이해도', 1, 35, 0, 10),
  ('reasoning', '🧠', 'Reasoning Evaluator', 'Reasoning', '문제 접근·논리 구조 분석', 1, 25, 0, 20),
  ('communication', '💬', 'Communication Evaluator', 'Communication', '표현 명확성·전달력', 1, 25, 0, 30),
  ('creativity', '✨', 'Creativity Evaluator', 'Creativity', '접근의 독창성·차별성', 1, 10, 0, 40),
  ('integrity', '🛡', 'Integrity Monitor', 'Integrity', 'AI 대필·표절·행동 이상', 1, 5, 0, 50),
  ('domain-fintech-1', '🌐', 'Domain Expert · Fintech', 'Domain', '도메인 지식 평가', 0, 0, 1, 60),
  ('domain-fintech-2', '🌐', 'Domain Expert · Payments', 'Domain', '결제 승인·정산·실패 복구 흐름 평가', 0, 0, 1, 70),
  ('domain-fintech-3', '🌐', 'Domain Expert · Lending', 'Domain', '여신 심사·상환 구조·신용 리스크 평가', 0, 0, 1, 80),
  ('domain-fintech-4', '🌐', 'Domain Expert · Compliance & KYC', 'Domain', 'KYC·AML·규제 대응 시나리오 평가', 0, 0, 1, 90),
  ('domain-fintech-5', '🌐', 'Domain Expert · Risk & Fraud', 'Domain', '이상 거래 탐지·리스크 운영 관점 평가', 0, 0, 1, 100)
ON DUPLICATE KEY UPDATE
  icon = VALUES(icon),
  name = VALUES(name),
  billing_label = VALUES(billing_label),
  description = VALUES(description),
  default_selected = VALUES(default_selected),
  default_weight = VALUES(default_weight),
  locked = VALUES(locked),
  sort_order = VALUES(sort_order);

CREATE TABLE IF NOT EXISTS company_jobs (
  id VARCHAR(64) NOT NULL,
  company_user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  session_type VARCHAR(32) NOT NULL,
  badge VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  applicants_count INT NOT NULL DEFAULT 0,
  progress INT NOT NULL DEFAULT 0,
  fraud_count INT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  detailed_description TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 0,
  capacity_display VARCHAR(16) NOT NULL DEFAULT 'exact',
  visibility_scope VARCHAR(32) NOT NULL DEFAULT '공개',
  eligible_age VARCHAR(16) NOT NULL DEFAULT 'all',
  eligible_countries JSON NOT NULL,
  expected_applicants INT NOT NULL DEFAULT 0,
  processes_payload JSON NOT NULL,
  agents_payload JSON NOT NULL,
  evaluation_criteria_payload JSON NULL,
  blind_candidates_payload JSON NOT NULL,
  report_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_company_jobs_company_user_id (company_user_id),
  CONSTRAINT fk_company_jobs_user
    FOREIGN KEY (company_user_id) REFERENCES company_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_fraud_cases (
  id VARCHAR(64) NOT NULL,
  company_user_id BIGINT UNSIGNED NOT NULL,
  job_id VARCHAR(64) NULL,
  title VARCHAR(160) NOT NULL,
  detail_id VARCHAR(120) NOT NULL,
  issue VARCHAR(120) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  confidence INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  evidence_title VARCHAR(160) NOT NULL,
  evidences_payload JSON NOT NULL,
  behavior_logs_payload JSON NOT NULL,
  occurred_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_company_fraud_cases_company_status (company_user_id, status),
  KEY idx_company_fraud_cases_job_id (job_id),
  CONSTRAINT fk_company_fraud_cases_user
    FOREIGN KEY (company_user_id) REFERENCES company_users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_company_fraud_cases_job
    FOREIGN KEY (job_id) REFERENCES company_jobs(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_credit_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_user_id BIGINT UNSIGNED NOT NULL,
  occurred_at DATETIME NOT NULL,
  amount_label VARCHAR(32) NOT NULL,
  transaction_type VARCHAR(16) NOT NULL DEFAULT 'charge',
  amount_usd INT NOT NULL DEFAULT 0,
  payment_token_key VARCHAR(16) NULL,
  payment_token_symbol VARCHAR(16) NULL,
  payment_token_amount_atomic VARCHAR(64) NULL,
  payment_token_amount_display VARCHAR(64) NULL,
  reference VARCHAR(64) NULL,
  external_transaction_id VARCHAR(128) NULL,
  external_transaction_hash VARCHAR(128) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_company_credit_transactions_reference (reference),
  UNIQUE KEY uq_company_credit_transactions_external_transaction_id (external_transaction_id),
  KEY idx_company_credit_transactions_company_occurred_at (company_user_id, occurred_at),
  CONSTRAINT fk_company_credit_transactions_user
    FOREIGN KEY (company_user_id) REFERENCES company_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_credit_charge_requests (
  id VARCHAR(64) NOT NULL,
  company_user_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(64) NOT NULL,
  payment_channel VARCHAR(16) NOT NULL DEFAULT 'mini_app',
  status VARCHAR(16) NOT NULL,
  requested_credit_usd INT NOT NULL,
  payment_token_key VARCHAR(16) NOT NULL,
  payment_token_symbol VARCHAR(16) NOT NULL,
  payment_token_contract_address VARCHAR(255) NULL,
  payment_token_decimals INT NOT NULL DEFAULT 18,
  payment_token_amount_atomic VARCHAR(64) NOT NULL,
  payment_token_amount_display VARCHAR(64) NOT NULL,
  receiver_address VARCHAR(255) NOT NULL,
  web_derived_index INT NULL,
  world_transaction_id VARCHAR(128) NULL,
  world_transaction_hash VARCHAR(128) NULL,
  payer_wallet_address VARCHAR(255) NULL,
  failure_reason VARCHAR(255) NULL,
  raw_transaction_payload JSON NULL,
  last_checked_block BIGINT UNSIGNED NULL,
  detected_token_amount_atomic VARCHAR(64) NULL,
  detected_token_amount_display VARCHAR(64) NULL,
  detected_transaction_hash VARCHAR(128) NULL,
  detected_block_number BIGINT UNSIGNED NULL,
  detected_at DATETIME NULL,
  quoted_token_price_usd DECIMAL(20,8) NULL,
  quoted_amount_usd DECIMAL(20,8) NULL,
  credited_amount_usd INT NULL,
  expires_at DATETIME NOT NULL,
  confirmed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_company_credit_charge_requests_reference (reference),
  UNIQUE KEY uq_company_credit_charge_requests_web_derived_index (web_derived_index),
  UNIQUE KEY uq_company_credit_charge_requests_world_transaction_id (world_transaction_id),
  KEY idx_company_credit_charge_requests_company_status (company_user_id, status),
  KEY idx_company_credit_charge_requests_expires_at (expires_at),
  CONSTRAINT fk_company_credit_charge_requests_user
    FOREIGN KEY (company_user_id) REFERENCES company_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
