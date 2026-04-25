import bcrypt from 'bcryptjs';
import { pool } from './db.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toAdminSessionUser(row) {
  return {
    id: Number(row.id),
    username: row.username,
  };
}

export async function getAdminUserByUsername(username) {
  const [rows] = await pool.execute(
    `
      SELECT id, username, password_hash, password_changed_at, last_login_at
      FROM admin_users
      WHERE username = ?
      LIMIT 1
    `,
    [username],
  );

  return rows[0] ?? null;
}

export async function recordAdminLogin(adminUserId) {
  await pool.execute(
    `
      UPDATE admin_users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [adminUserId],
  );
}

export async function changeAdminPassword(adminUserId, currentPassword, nextPassword) {
  const [rows] = await pool.execute(
    `
      SELECT id, password_hash
      FROM admin_users
      WHERE id = ?
      LIMIT 1
    `,
    [adminUserId],
  );

  const adminUser = rows[0];

  if (!adminUser) {
    throw new Error('관리자 계정을 찾을 수 없습니다.');
  }

  const passwordMatched = await bcrypt.compare(currentPassword, adminUser.password_hash);

  if (!passwordMatched) {
    throw new Error('현재 비밀번호가 올바르지 않습니다.');
  }

  if (typeof nextPassword !== 'string' || nextPassword.length < 8) {
    throw new Error('새 비밀번호는 8자 이상이어야 합니다.');
  }

  const nextPasswordHash = await bcrypt.hash(nextPassword, 12);

  await pool.execute(
    `
      UPDATE admin_users
      SET password_hash = ?,
          password_changed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [nextPasswordHash, adminUserId],
  );
}

export async function getAdminDashboard() {
  const [[summaryRow]] = await pool.query(
    `
      SELECT
        COALESCE(SUM(cpp.credit_balance_usd), 0) AS total_balance_usd,
        (
          SELECT COALESCE(SUM(amount_usd), 0)
          FROM company_credit_transactions
          WHERE transaction_type = 'charge'
        ) AS total_charged_usd,
        (
          SELECT COUNT(*)
          FROM company_credit_charge_requests
          WHERE payment_channel = 'web_deposit'
            AND status IN ('ready', 'pending')
        ) AS pending_web_deposit_count,
        (
          SELECT COUNT(*)
          FROM company_users
        ) AS company_count
      FROM company_portal_profiles cpp
    `,
  );

  const [balanceRows] = await pool.query(
    `
      SELECT
        cu.id,
        cu.company_name,
        cu.company_email,
        COALESCE(cpp.credit_balance_usd, 0) AS credit_balance_usd,
        COALESCE(cpp.credit_monthly_usage_usd, 0) AS credit_monthly_usage_usd,
        cpp.updated_at
      FROM company_users cu
      LEFT JOIN company_portal_profiles cpp ON cpp.company_user_id = cu.id
      ORDER BY credit_balance_usd DESC, cu.company_name ASC
    `,
  );

  const [depositRows] = await pool.query(
    `
      SELECT
        cccr.id,
        cu.company_name,
        cu.company_email,
        cccr.payment_channel,
        cccr.status,
        cccr.payment_token_key,
        cccr.requested_credit_usd,
        cccr.payment_token_amount_display,
        cccr.detected_token_amount_display,
        cccr.quoted_amount_usd,
        cccr.credited_amount_usd,
        cccr.detected_transaction_hash,
        cccr.world_transaction_hash,
        cccr.reference,
        cccr.created_at,
        cccr.confirmed_at
      FROM company_credit_charge_requests cccr
      INNER JOIN company_users cu ON cu.id = cccr.company_user_id
      ORDER BY cccr.created_at DESC
      LIMIT 100
    `,
  );

  return {
    summary: {
      totalBalanceUsd: toNumber(summaryRow?.total_balance_usd, 0),
      totalChargedUsd: toNumber(summaryRow?.total_charged_usd, 0),
      pendingWebDepositCount: toNumber(summaryRow?.pending_web_deposit_count, 0),
      companyCount: toNumber(summaryRow?.company_count, 0),
    },
    balances: balanceRows.map((row) => ({
      companyId: Number(row.id),
      companyName: row.company_name,
      companyEmail: row.company_email,
      balanceUsd: toNumber(row.credit_balance_usd, 0),
      monthlyUsageUsd: toNumber(row.credit_monthly_usage_usd, 0),
      updatedAt: toIsoString(row.updated_at),
    })),
    deposits: depositRows.map((row) => ({
      id: row.id,
      companyName: row.company_name,
      companyEmail: row.company_email,
      paymentChannel: row.payment_channel,
      status: row.status,
      paymentTokenKey: row.payment_token_key,
      requestedCreditUsd: toNumber(row.requested_credit_usd, 0),
      expectedTokenAmountDisplay: row.payment_token_amount_display,
      receivedTokenAmountDisplay: row.detected_token_amount_display ?? null,
      quotedAmountUsd: row.quoted_amount_usd == null ? null : toNumber(row.quoted_amount_usd, 0),
      creditedAmountUsd: row.credited_amount_usd == null ? null : toNumber(row.credited_amount_usd, 0),
      transactionHash: row.detected_transaction_hash ?? row.world_transaction_hash ?? null,
      reference: row.reference,
      createdAt: toIsoString(row.created_at),
      confirmedAt: toIsoString(row.confirmed_at),
    })),
  };
}
