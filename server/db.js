import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const dbHost = process.env.DB_HOST ?? '127.0.0.1';
const dbPort = Number(process.env.DB_PORT ?? 3306);
const dbUser = process.env.DB_USER ?? 'root';
const dbPassword = process.env.DB_PASSWORD ?? '';
const dbName = process.env.DB_NAME ?? 'verifit';

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
}
