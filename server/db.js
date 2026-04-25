import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { defaultCompanyAgentCatalogSeed } from './company-agent-catalog.js';

dotenv.config();

const removedCompanyAgentIds = ['custom-rubric'];

const dbHost = process.env.DB_HOST ?? '127.0.0.1';
const dbPort = Number(process.env.DB_PORT ?? 3306);
const dbUser = process.env.DB_USER ?? 'root';
const dbPassword = process.env.DB_PASSWORD ?? '';
const dbName = process.env.DB_NAME ?? 'verifit';
const adminDefaultUsername = process.env.ADMIN_DEFAULT_USERNAME?.trim() || 'admin';
const adminDefaultPassword = process.env.ADMIN_DEFAULT_PASSWORD?.trim() || 'admin';

export const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

async function addColumnIfMissing(tableName, columnName, definition) {
  const [rows] = await pool.execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [dbName, tableName, columnName],
  );

  if (rows.length > 0) {
    return;
  }

  await pool.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

async function dropColumnIfExists(tableName, columnName) {
  const [rows] = await pool.execute(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [dbName, tableName, columnName],
  );

  if (rows.length === 0) {
    return;
  }

  await pool.execute(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
}

async function addIndexIfMissing(tableName, indexName, definition) {
  const [rows] = await pool.execute(
    `
      SELECT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
      LIMIT 1
    `,
    [dbName, tableName, indexName],
  );

  if (rows.length > 0) {
    return;
  }

  await pool.execute(`ALTER TABLE ${tableName} ADD ${definition}`);
}

async function seedCompanyAgentCatalog() {
  if (removedCompanyAgentIds.length > 0) {
    await pool.execute(
      `
        DELETE FROM company_agent_catalog
        WHERE id IN (${removedCompanyAgentIds.map(() => '?').join(', ')})
      `,
      removedCompanyAgentIds,
    );
  }

  for (const agent of defaultCompanyAgentCatalogSeed) {
    await pool.execute(
      `
        INSERT INTO company_agent_catalog (
          id,
          icon,
          name,
          billing_label,
          description,
          default_selected,
          default_weight,
          locked,
          sort_order
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          icon = VALUES(icon),
          name = VALUES(name),
          billing_label = VALUES(billing_label),
          description = VALUES(description),
          default_selected = VALUES(default_selected),
          default_weight = VALUES(default_weight),
          locked = VALUES(locked),
          sort_order = VALUES(sort_order)
      `,
      [
        agent.id,
        agent.icon,
        agent.name,
        agent.billingLabel,
        agent.description,
        agent.defaultSelected ? 1 : 0,
        agent.defaultWeight,
        agent.locked ? 1 : 0,
        agent.sortOrder,
      ],
    );
  }
}

async function seedAdminUser() {
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM admin_users
      WHERE username = ?
      LIMIT 1
    `,
    [adminDefaultUsername],
  );

  if (rows.length > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(adminDefaultPassword, 12);

  await pool.execute(
    `
      INSERT INTO admin_users (username, password_hash, password_changed_at, last_login_at)
      VALUES (?, ?, NULL, NULL)
    `,
    [adminDefaultUsername, passwordHash],
  );
}

export async function ensureDatabase() {
  const connection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.end();

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(
    'admin_users',
    'password_changed_at',
    'DATETIME NULL AFTER password_hash',
  );
  await addColumnIfMissing(
    'admin_users',
    'last_login_at',
    'DATETIME NULL AFTER password_changed_at',
  );

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(
    'company_users',
    'failed_login_attempts',
    'INT NOT NULL DEFAULT 0 AFTER password_hash',
  );
  await addColumnIfMissing(
    'company_users',
    'account_locked_at',
    'DATETIME NULL AFTER failed_login_attempts',
  );

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(
    'candidate_users',
    'world_id_verified',
    'TINYINT(1) NOT NULL DEFAULT 0 AFTER marketing_consent',
  );
  await dropColumnIfExists('candidate_users', 'birth_date');

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(
    'company_email_verifications',
    'failed_attempts',
    'INT NOT NULL DEFAULT 0 AFTER verified_at',
  );
  await addColumnIfMissing(
    'company_email_verifications',
    'resend_available_at',
    'DATETIME NULL AFTER failed_attempts',
  );

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(
    'candidate_email_verifications',
    'failed_attempts',
    'INT NOT NULL DEFAULT 0 AFTER verified_at',
  );
  await addColumnIfMissing(
    'candidate_email_verifications',
    'resend_available_at',
    'DATETIME NULL AFTER failed_attempts',
  );

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(
    'company_unlock_verifications',
    'failed_attempts',
    'INT NOT NULL DEFAULT 0 AFTER verified_at',
  );
  await addColumnIfMissing(
    'company_unlock_verifications',
    'resend_available_at',
    'DATETIME NULL AFTER failed_attempts',
  );

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await seedCompanyAgentCatalog();

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(
    'company_jobs',
    'evaluation_criteria_payload',
    'JSON NULL AFTER agents_payload',
  );

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS company_job_evaluations (
      id VARCHAR(64) NOT NULL,
      company_user_id BIGINT UNSIGNED NOT NULL,
      job_id VARCHAR(64) NOT NULL,
      anonymous_id VARCHAR(120) NOT NULL,
      candidate_label VARCHAR(120) NULL,
      human_verified TINYINT(1) NOT NULL DEFAULT 0,
      selected TINYINT(1) NOT NULL DEFAULT 0,
      overall_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      integrity_score INT NOT NULL DEFAULT 0,
      submission_payload JSON NOT NULL,
      evaluation_payload JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_company_job_evaluations_job (company_user_id, job_id),
      KEY idx_company_job_evaluations_score (job_id, overall_score),
      CONSTRAINT fk_company_job_evaluations_user
        FOREIGN KEY (company_user_id) REFERENCES company_users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_company_job_evaluations_job
        FOREIGN KEY (job_id) REFERENCES company_jobs(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
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
      KEY idx_company_credit_transactions_company_occurred_at (company_user_id, occurred_at),
      CONSTRAINT fk_company_credit_transactions_user
        FOREIGN KEY (company_user_id) REFERENCES company_users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(
    'company_credit_transactions',
    'transaction_type',
    "VARCHAR(16) NOT NULL DEFAULT 'charge' AFTER amount_label",
  );
  await addColumnIfMissing(
    'company_credit_transactions',
    'amount_usd',
    'INT NOT NULL DEFAULT 0 AFTER transaction_type',
  );
  await addColumnIfMissing(
    'company_credit_transactions',
    'payment_token_key',
    'VARCHAR(16) NULL AFTER amount_usd',
  );
  await addColumnIfMissing(
    'company_credit_transactions',
    'payment_token_symbol',
    'VARCHAR(16) NULL AFTER payment_token_key',
  );
  await addColumnIfMissing(
    'company_credit_transactions',
    'payment_token_amount_atomic',
    'VARCHAR(64) NULL AFTER payment_token_symbol',
  );
  await addColumnIfMissing(
    'company_credit_transactions',
    'payment_token_amount_display',
    'VARCHAR(64) NULL AFTER payment_token_amount_atomic',
  );
  await addColumnIfMissing(
    'company_credit_transactions',
    'reference',
    'VARCHAR(64) NULL AFTER payment_token_amount_display',
  );
  await addColumnIfMissing(
    'company_credit_transactions',
    'external_transaction_id',
    'VARCHAR(128) NULL AFTER reference',
  );
  await addColumnIfMissing(
    'company_credit_transactions',
    'external_transaction_hash',
    'VARCHAR(128) NULL AFTER external_transaction_id',
  );
  await addIndexIfMissing(
    'company_credit_transactions',
    'uq_company_credit_transactions_reference',
    'UNIQUE KEY uq_company_credit_transactions_reference (reference)',
  );
  await addIndexIfMissing(
    'company_credit_transactions',
    'uq_company_credit_transactions_external_transaction_id',
    'UNIQUE KEY uq_company_credit_transactions_external_transaction_id (external_transaction_id)',
  );

  await pool.execute(`
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing(
    'company_credit_charge_requests',
    'payment_channel',
    "VARCHAR(16) NOT NULL DEFAULT 'mini_app' AFTER reference",
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'payment_token_contract_address',
    'VARCHAR(255) NULL AFTER payment_token_symbol',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'payment_token_decimals',
    'INT NOT NULL DEFAULT 18 AFTER payment_token_contract_address',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'web_derived_index',
    'INT NULL AFTER receiver_address',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'last_checked_block',
    'BIGINT UNSIGNED NULL AFTER raw_transaction_payload',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'detected_token_amount_atomic',
    'VARCHAR(64) NULL AFTER last_checked_block',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'detected_token_amount_display',
    'VARCHAR(64) NULL AFTER detected_token_amount_atomic',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'detected_transaction_hash',
    'VARCHAR(128) NULL AFTER detected_token_amount_display',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'detected_block_number',
    'BIGINT UNSIGNED NULL AFTER detected_transaction_hash',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'detected_at',
    'DATETIME NULL AFTER detected_block_number',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'quoted_token_price_usd',
    'DECIMAL(20,8) NULL AFTER detected_at',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'quoted_amount_usd',
    'DECIMAL(20,8) NULL AFTER quoted_token_price_usd',
  );
  await addColumnIfMissing(
    'company_credit_charge_requests',
    'credited_amount_usd',
    'INT NULL AFTER quoted_amount_usd',
  );
  await addIndexIfMissing(
    'company_credit_charge_requests',
    'uq_company_credit_charge_requests_web_derived_index',
    'UNIQUE KEY uq_company_credit_charge_requests_web_derived_index (web_derived_index)',
  );
  await seedAdminUser();
}
