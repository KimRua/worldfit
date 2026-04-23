import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import { hashSignal } from '@worldcoin/idkit/hashing';
import { signRequest } from '@worldcoin/idkit/signing';
import { ensureDatabase, pool } from './db.js';
import {
  sendCandidateLoginEmail,
  sendCandidateVerificationEmail,
  sendCompanyUnlockEmail,
  sendCompanyVerificationEmail,
} from './mail.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const isProduction = process.env.NODE_ENV === 'production';
const verificationExpiryMinutes = Number(process.env.COMPANY_VERIFICATION_EXPIRES_MINUTES ?? 10);
const maxFailedLoginAttempts = 10;
const unlockResendCooldownSeconds = 60;
const maxUnlockVerificationAttempts = 5;
const worldIdAppId = process.env.WORLD_ID_APP_ID?.trim() ?? '';
const worldIdRpId = process.env.WORLD_ID_RP_ID?.trim() ?? '';
const worldIdAction = process.env.WORLD_ID_ACTION?.trim() || 'candidate-signup';
const worldIdSigningKey = process.env.WORLD_ID_SIGNING_KEY?.trim() ?? '';
const worldIdEnvironment = process.env.WORLD_ID_ENVIRONMENT === 'production' ? 'production' : 'staging';

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(
  session({
    name: 'verifit.sid',
    secret: process.env.SESSION_SECRET ?? 'change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

function toCompanySessionUser(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    companyEmail: row.company_email,
  };
}

function toCandidateSessionUser(row) {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email,
  };
}

function getCompanySessionUser(req) {
  return req.session.companyUser ?? null;
}

function getCandidateSessionUser(req) {
  return req.session.candidateUser ?? null;
}

function setCompanySessionUser(req, user) {
  req.session.companyUser = user;
}

function setCandidateSessionUser(req, user) {
  req.session.candidateUser = user;
}

function clearCompanySessionUser(req) {
  delete req.session.companyUser;
}

function clearCandidateSessionUser(req) {
  delete req.session.candidateUser;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isCompanyAccountLocked(company) {
  return company.account_locked_at != null;
}

function getSecondsUntil(dateValue) {
  if (!dateValue) {
    return 0;
  }

  const millisecondsLeft = new Date(dateValue).getTime() - Date.now();

  if (millisecondsLeft <= 0) {
    return 0;
  }

  return Math.ceil(millisecondsLeft / 1000);
}

function isWorldIdConfigured() {
  const hasPlaceholderValue = [worldIdAppId, worldIdRpId, worldIdSigningKey].some(
    (value) => !value || value.includes('replace_me'),
  );

  return !hasPlaceholderValue;
}

async function getVerifiedCandidateEmail(email) {
  const [rows] = await pool.execute(
    `
      SELECT verified_at, expires_at
      FROM candidate_email_verifications
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );

  return rows[0] ?? null;
}

async function getCandidateUserByEmail(email) {
  const [rows] = await pool.execute(
    `
      SELECT id, full_name, email
      FROM candidate_users
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );

  const candidate = rows[0];

  return candidate ? toCandidateSessionUser(candidate) : null;
}

async function getCandidateUserByNullifierHash(nullifierHash) {
  const [rows] = await pool.execute(
    `
      SELECT cu.id, cu.full_name, cu.email
      FROM candidate_world_id_verifications cwv
      INNER JOIN candidate_users cu ON cu.email = cwv.email
      WHERE cwv.nullifier_hash = ?
        AND cwv.action = ?
      LIMIT 1
    `,
    [nullifierHash, worldIdAction],
  );

  const candidate = rows[0];

  return candidate ? toCandidateSessionUser(candidate) : null;
}

async function verifyWorldIdResult(idkitResponse) {
  if (idkitResponse.action !== worldIdAction) {
    return { ok: false, status: 400, message: 'World ID action 값이 올바르지 않습니다.' };
  }

  if (idkitResponse.environment !== worldIdEnvironment) {
    return { ok: false, status: 400, message: 'World ID 환경 정보가 올바르지 않습니다.' };
  }

  const worldResponse = await fetch(`https://developer.world.org/api/v4/verify/${worldIdRpId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'verifit-local-dev/1.0',
    },
    body: JSON.stringify(idkitResponse),
  });

  const worldPayload = await worldResponse.json().catch(() => ({}));

  if (!worldResponse.ok) {
    return {
      ok: false,
      status: 400,
      message:
        typeof worldPayload.message === 'string'
          ? worldPayload.message
          : 'World ID proof 검증에 실패했습니다.',
    };
  }

  return { ok: true };
}

function extractWorldIdVerificationItem(idkitResponse) {
  if (!idkitResponse || typeof idkitResponse !== 'object') {
    return null;
  }

  const responses = Array.isArray(idkitResponse.responses) ? idkitResponse.responses : [];

  if (responses.length === 0) {
    return null;
  }

  const [firstResponse] = responses;

  if (!firstResponse || typeof firstResponse !== 'object') {
    return null;
  }

  if (typeof firstResponse.nullifier !== 'string') {
    return null;
  }

  return firstResponse;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/world-id/config', (_req, res) => {
  res.json({
    enabled: isWorldIdConfigured(),
    appId: worldIdAppId || null,
    action: worldIdAction,
    environment: worldIdEnvironment,
  });
});

app.get('/api/auth/me', (req, res) => {
  const companyUser = getCompanySessionUser(req);
  const candidateUser = getCandidateSessionUser(req);

  if (!companyUser && !candidateUser) {
    res.status(401).json({ message: '로그인이 필요합니다.' });
    return;
  }

  res.json({ companyUser, candidateUser });
});

app.post('/api/auth/candidate/verification/send', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase() ?? '';

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ message: '올바른 이메일을 입력해주세요.' });
    return;
  }

  try {
    const [existingUsers] = await pool.execute(
      'SELECT id FROM candidate_users WHERE email = ? LIMIT 1',
      [email],
    );

    if (existingUsers.length > 0) {
      res.status(409).json({ message: '이미 가입된 이메일입니다.' });
      return;
    }

    const [verificationRows] = await pool.execute(
      `
        SELECT resend_available_at
        FROM candidate_email_verifications
        WHERE email = ?
        LIMIT 1
      `,
      [email],
    );

    const existingVerification = verificationRows[0];
    const retryAfterSeconds = getSecondsUntil(existingVerification?.resend_available_at);

    if (retryAfterSeconds > 0) {
      res.status(429).json({
        message: '잠시 후 다시 인증코드를 발송해주세요.',
        code: 'CANDIDATE_SIGNUP_RESEND_COOLDOWN',
        retryAfterSeconds,
      });
      return;
    }

    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + verificationExpiryMinutes * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + unlockResendCooldownSeconds * 1000);

    await pool.execute(
      `
        INSERT INTO candidate_email_verifications (
          email,
          verification_code,
          expires_at,
          verified_at,
          failed_attempts,
          resend_available_at
        )
        VALUES (?, ?, ?, NULL, 0, ?)
        ON DUPLICATE KEY UPDATE
          verification_code = VALUES(verification_code),
          expires_at = VALUES(expires_at),
          verified_at = NULL,
          failed_attempts = 0,
          resend_available_at = VALUES(resend_available_at)
      `,
      [email, verificationCode, expiresAt, resendAvailableAt],
    );

    const emailResult = await sendCandidateVerificationEmail({
      candidateEmail: email,
      verificationCode,
      expiresInMinutes: verificationExpiryMinutes,
    });

    console.log(`[candidate verification] ${email} -> sent (${emailResult.messageId})`);

    res.json({
      message: '인증코드를 발송했습니다.',
      retryAfterSeconds: unlockResendCooldownSeconds,
      expiresInSeconds: verificationExpiryMinutes * 60,
      ...(emailResult.inboxUrl ? { devInboxUrl: emailResult.inboxUrl } : {}),
    });
  } catch (error) {
    console.error('Candidate verification send failed:', error);
    res.status(500).json({ message: '인증코드 발송 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/candidate/verification/verify', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase() ?? '';
  const verificationCode = req.body.verificationCode?.trim() ?? '';

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ message: '올바른 이메일을 입력해주세요.' });
    return;
  }

  if (!/^\d{6}$/.test(verificationCode)) {
    res.status(400).json({ message: '인증번호 6자리를 입력해주세요.' });
    return;
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT email, verification_code, expires_at, failed_attempts, resend_available_at
        FROM candidate_email_verifications
        WHERE email = ?
        LIMIT 1
      `,
      [email],
    );

    const verification = rows[0];

    if (!verification) {
      res.status(404).json({ message: '먼저 인증코드를 발송해주세요.' });
      return;
    }

    const retryAfterSeconds = getSecondsUntil(verification.resend_available_at);

    if (!verification.verification_code && retryAfterSeconds > 0) {
      res.status(429).json({
        message: '인증코드가 초기화되었습니다. 1분 후 다시 발송해주세요.',
        code: 'CANDIDATE_SIGNUP_CODE_RESET',
        retryAfterSeconds,
      });
      return;
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      res.status(400).json({ message: '인증코드가 만료되었습니다. 다시 발송해주세요.' });
      return;
    }

    if (verification.verification_code !== verificationCode) {
      const nextFailedAttempts = Number(verification.failed_attempts ?? 0) + 1;

      if (nextFailedAttempts >= maxUnlockVerificationAttempts) {
        const nextResendAvailableAt = new Date(Date.now() + unlockResendCooldownSeconds * 1000);

        await pool.execute(
          `
            UPDATE candidate_email_verifications
            SET verification_code = '',
                expires_at = NOW(),
                verified_at = NULL,
                failed_attempts = 0,
                resend_available_at = ?
            WHERE email = ?
          `,
          [nextResendAvailableAt, email],
        );

        res.status(429).json({
          message: '인증코드를 5회 잘못 입력해 코드가 초기화되었습니다. 1분 후 다시 발송해주세요.',
          code: 'CANDIDATE_SIGNUP_CODE_RESET',
          retryAfterSeconds: unlockResendCooldownSeconds,
        });
        return;
      }

      await pool.execute(
        `
          UPDATE candidate_email_verifications
          SET failed_attempts = ?
          WHERE email = ?
        `,
        [nextFailedAttempts, email],
      );

      res.status(400).json({ message: '인증코드가 올바르지 않습니다.' });
      return;
    }

    await pool.execute(
      `
        UPDATE candidate_email_verifications
        SET verified_at = NOW(),
            failed_attempts = 0
        WHERE email = ?
      `,
      [email],
    );

    res.json({ message: '이메일 인증이 완료되었습니다.' });
  } catch (error) {
    console.error('Candidate verification check failed:', error);
    res.status(500).json({ message: '인증 확인 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/candidate/login/send', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase() ?? '';

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ message: '올바른 이메일을 입력해주세요.' });
    return;
  }

  try {
    const candidateUser = await getCandidateUserByEmail(email);

    if (!candidateUser) {
      res.status(404).json({ message: '가입된 지원자 이메일이 아닙니다.' });
      return;
    }

    const [verificationRows] = await pool.execute(
      `
        SELECT resend_available_at
        FROM candidate_email_verifications
        WHERE email = ?
        LIMIT 1
      `,
      [email],
    );

    const existingVerification = verificationRows[0];
    const retryAfterSeconds = getSecondsUntil(existingVerification?.resend_available_at);

    if (retryAfterSeconds > 0) {
      res.status(429).json({
        message: '잠시 후 다시 인증코드를 발송해주세요.',
        code: 'CANDIDATE_LOGIN_RESEND_COOLDOWN',
        retryAfterSeconds,
      });
      return;
    }

    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + verificationExpiryMinutes * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + unlockResendCooldownSeconds * 1000);

    await pool.execute(
      `
        INSERT INTO candidate_email_verifications (
          email,
          verification_code,
          expires_at,
          verified_at,
          failed_attempts,
          resend_available_at
        )
        VALUES (?, ?, ?, NULL, 0, ?)
        ON DUPLICATE KEY UPDATE
          verification_code = VALUES(verification_code),
          expires_at = VALUES(expires_at),
          verified_at = NULL,
          failed_attempts = 0,
          resend_available_at = VALUES(resend_available_at)
      `,
      [email, verificationCode, expiresAt, resendAvailableAt],
    );

    const emailResult = await sendCandidateLoginEmail({
      candidateEmail: email,
      verificationCode,
      expiresInMinutes: verificationExpiryMinutes,
    });

    console.log(`[candidate login] ${email} -> sent (${emailResult.messageId})`);

    res.json({
      message: '로그인 인증코드를 발송했습니다.',
      retryAfterSeconds: unlockResendCooldownSeconds,
      expiresInSeconds: verificationExpiryMinutes * 60,
      ...(emailResult.inboxUrl ? { devInboxUrl: emailResult.inboxUrl } : {}),
    });
  } catch (error) {
    console.error('Candidate login send failed:', error);
    res.status(500).json({ message: '로그인 인증코드 발송 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/candidate/login/verify', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase() ?? '';
  const verificationCode = req.body.verificationCode?.trim() ?? '';

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ message: '올바른 이메일을 입력해주세요.' });
    return;
  }

  if (!/^\d{6}$/.test(verificationCode)) {
    res.status(400).json({ message: '인증번호 6자리를 입력해주세요.' });
    return;
  }

  try {
    const candidateUser = await getCandidateUserByEmail(email);

    if (!candidateUser) {
      res.status(404).json({ message: '가입된 지원자 이메일이 아닙니다.' });
      return;
    }

    const [rows] = await pool.execute(
      `
        SELECT email, verification_code, expires_at, failed_attempts, resend_available_at
        FROM candidate_email_verifications
        WHERE email = ?
        LIMIT 1
      `,
      [email],
    );

    const verification = rows[0];

    if (!verification) {
      res.status(404).json({ message: '먼저 로그인 인증코드를 발송해주세요.' });
      return;
    }

    const retryAfterSeconds = getSecondsUntil(verification.resend_available_at);

    if (!verification.verification_code && retryAfterSeconds > 0) {
      res.status(429).json({
        message: '인증코드가 초기화되었습니다. 1분 후 다시 발송해주세요.',
        code: 'CANDIDATE_LOGIN_CODE_RESET',
        retryAfterSeconds,
      });
      return;
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      res.status(400).json({ message: '인증코드가 만료되었습니다. 다시 발송해주세요.' });
      return;
    }

    if (verification.verification_code !== verificationCode) {
      const nextFailedAttempts = Number(verification.failed_attempts ?? 0) + 1;

      if (nextFailedAttempts >= maxUnlockVerificationAttempts) {
        const nextResendAvailableAt = new Date(Date.now() + unlockResendCooldownSeconds * 1000);

        await pool.execute(
          `
            UPDATE candidate_email_verifications
            SET verification_code = '',
                expires_at = NOW(),
                verified_at = NULL,
                failed_attempts = 0,
                resend_available_at = ?
            WHERE email = ?
          `,
          [nextResendAvailableAt, email],
        );

        res.status(429).json({
          message: '인증코드를 5회 잘못 입력해 코드가 초기화되었습니다. 1분 후 다시 발송해주세요.',
          code: 'CANDIDATE_LOGIN_CODE_RESET',
          retryAfterSeconds: unlockResendCooldownSeconds,
        });
        return;
      }

      await pool.execute(
        `
          UPDATE candidate_email_verifications
          SET failed_attempts = ?
          WHERE email = ?
        `,
        [nextFailedAttempts, email],
      );

      res.status(400).json({ message: '인증코드가 올바르지 않습니다.' });
      return;
    }

    await pool.execute('DELETE FROM candidate_email_verifications WHERE email = ?', [email]);

    clearCompanySessionUser(req);
    setCandidateSessionUser(req, candidateUser);

    res.json({
      message: '로그인되었습니다.',
      candidateUser,
    });
  } catch (error) {
    console.error('Candidate login verify failed:', error);
    res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/world-id/rp-signature', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase() ?? '';

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ message: '올바른 이메일을 입력해주세요.' });
    return;
  }

  if (!isWorldIdConfigured()) {
    res.status(503).json({
      message: 'World ID 환경변수가 아직 설정되지 않았습니다.',
      code: 'WORLD_ID_NOT_CONFIGURED',
    });
    return;
  }

  try {
    const verification = await getVerifiedCandidateEmail(email);

    if (!verification || !verification.verified_at) {
      res.status(400).json({ message: '먼저 이메일 인증을 완료해주세요.' });
      return;
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      res.status(400).json({ message: '이메일 인증이 만료되었습니다. 다시 인증해주세요.' });
      return;
    }

    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: worldIdSigningKey,
      action: worldIdAction,
    });

    res.json({
      appId: worldIdAppId,
      action: worldIdAction,
      environment: worldIdEnvironment,
      rpContext: {
        rp_id: worldIdRpId,
        nonce,
        created_at: createdAt,
        expires_at: expiresAt,
        signature: sig,
      },
    });
  } catch (error) {
    console.error('World ID RP signature generation failed:', error);
    res.status(500).json({ message: 'World ID 인증 준비 중 오류가 발생했습니다.' });
  }
});

app.post('/api/world-id/verify', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase() ?? '';
  const idkitResponse = req.body.idkitResponse;

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ message: '올바른 이메일을 입력해주세요.' });
    return;
  }

  if (!isWorldIdConfigured()) {
    res.status(503).json({
      message: 'World ID 환경변수가 아직 설정되지 않았습니다.',
      code: 'WORLD_ID_NOT_CONFIGURED',
    });
    return;
  }

  const verificationItem = extractWorldIdVerificationItem(idkitResponse);

  if (!verificationItem) {
    res.status(400).json({ message: 'World ID 응답 형식이 올바르지 않습니다.' });
    return;
  }

  try {
    const verification = await getVerifiedCandidateEmail(email);

    if (!verification || !verification.verified_at) {
      res.status(400).json({ message: '먼저 이메일 인증을 완료해주세요.' });
      return;
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      res.status(400).json({ message: '이메일 인증이 만료되었습니다. 다시 인증해주세요.' });
      return;
    }

    const expectedSignalHash = hashSignal(email).toLowerCase();
    const signalHash = verificationItem.signal_hash?.toLowerCase() ?? '';

    if (!signalHash || signalHash !== expectedSignalHash) {
      res.status(400).json({ message: 'World ID signal 검증에 실패했습니다.' });
      return;
    }

    const verificationResult = await verifyWorldIdResult(idkitResponse);

    if (!verificationResult.ok) {
      res.status(verificationResult.status).json({ message: verificationResult.message });
      return;
    }

    try {
      await pool.execute(
        `
          INSERT INTO candidate_world_id_verifications (
            email,
            action,
            nullifier_hash,
            signal_hash,
            credential_type,
            protocol_version,
            environment,
            verified_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
            action = VALUES(action),
            nullifier_hash = VALUES(nullifier_hash),
            signal_hash = VALUES(signal_hash),
            credential_type = VALUES(credential_type),
            protocol_version = VALUES(protocol_version),
            environment = VALUES(environment),
            verified_at = VALUES(verified_at)
        `,
        [
          email,
          worldIdAction,
          verificationItem.nullifier.toLowerCase(),
          signalHash,
          verificationItem.identifier,
          idkitResponse.protocol_version,
          idkitResponse.environment,
        ],
      );
    } catch (databaseError) {
      if (databaseError && databaseError.code === 'ER_DUP_ENTRY') {
        res.status(409).json({
          message: '이미 다른 가입 시도에 사용된 World ID입니다.',
        });
        return;
      }

      throw databaseError;
    }

    res.json({ message: 'World ID 인증이 완료되었습니다.' });
  } catch (error) {
    console.error('World ID verify failed:', error);
    res.status(500).json({ message: 'World ID 인증 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/world-id/login/rp-signature', async (_req, res) => {
  if (!isWorldIdConfigured()) {
    res.status(503).json({
      message: 'World ID 환경변수가 아직 설정되지 않았습니다.',
      code: 'WORLD_ID_NOT_CONFIGURED',
    });
    return;
  }

  try {
    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: worldIdSigningKey,
      action: worldIdAction,
    });

    res.json({
      appId: worldIdAppId,
      action: worldIdAction,
      environment: worldIdEnvironment,
      rpContext: {
        rp_id: worldIdRpId,
        nonce,
        created_at: createdAt,
        expires_at: expiresAt,
        signature: sig,
      },
    });
  } catch (error) {
    console.error('World ID login RP signature generation failed:', error);
    res.status(500).json({ message: 'World ID 로그인 준비 중 오류가 발생했습니다.' });
  }
});

app.post('/api/world-id/login/verify', async (req, res) => {
  const idkitResponse = req.body.idkitResponse;
  const verificationItem = extractWorldIdVerificationItem(idkitResponse);

  if (!isWorldIdConfigured()) {
    res.status(503).json({
      message: 'World ID 환경변수가 아직 설정되지 않았습니다.',
      code: 'WORLD_ID_NOT_CONFIGURED',
    });
    return;
  }

  if (!verificationItem) {
    res.status(400).json({ message: 'World ID 응답 형식이 올바르지 않습니다.' });
    return;
  }

  try {
    const verificationResult = await verifyWorldIdResult(idkitResponse);

    if (!verificationResult.ok) {
      res.status(verificationResult.status).json({ message: verificationResult.message });
      return;
    }

    const nullifierHash = verificationItem.nullifier?.toLowerCase() ?? '';

    if (!nullifierHash) {
      res.status(400).json({ message: 'World ID nullifier 값이 올바르지 않습니다.' });
      return;
    }

    const candidateUser = await getCandidateUserByNullifierHash(nullifierHash);

    if (!candidateUser) {
      res.status(404).json({ message: '이 World ID로 가입된 지원자 계정을 찾을 수 없습니다.' });
      return;
    }

    clearCompanySessionUser(req);
    setCandidateSessionUser(req, candidateUser);

    res.json({
      message: 'World ID로 로그인되었습니다.',
      candidateUser,
    });
  } catch (error) {
    console.error('World ID login verify failed:', error);
    res.status(500).json({ message: 'World ID 로그인 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/candidate/signup', async (req, res) => {
  const name = req.body.name?.trim() ?? '';
  const email = req.body.email?.trim().toLowerCase() ?? '';
  const marketingConsent = req.body.marketingConsent === true;
  const termsAgreed = req.body.termsAgreed === true;

  if (!name) {
    res.status(400).json({ message: '이름을 입력해주세요.' });
    return;
  }

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ message: '올바른 이메일을 입력해주세요.' });
    return;
  }

  if (!termsAgreed) {
    res.status(400).json({ message: '이용약관 및 개인정보처리방침 동의가 필요합니다.' });
    return;
  }

  try {
    const verification = await getVerifiedCandidateEmail(email);

    if (!verification || !verification.verified_at) {
      res.status(400).json({ message: '먼저 이메일 인증을 완료해주세요.' });
      return;
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      res.status(400).json({ message: '인증코드가 만료되었습니다. 다시 발송해주세요.' });
      return;
    }

    const [existingRows] = await pool.execute(
      'SELECT id FROM candidate_users WHERE email = ? LIMIT 1',
      [email],
    );

    if (existingRows.length > 0) {
      res.status(409).json({ message: '이미 가입된 이메일입니다.' });
      return;
    }

    const [worldIdRows] = await pool.execute(
      `
        SELECT email
        FROM candidate_world_id_verifications
        WHERE email = ?
          AND action = ?
        LIMIT 1
      `,
      [email, worldIdAction],
    );

    if (worldIdRows.length === 0) {
      res.status(400).json({
        message: 'World ID 인증을 완료해주세요. 이미 다른 이메일에 등록된 World ID는 중복 사용할 수 없습니다.',
      });
      return;
    }

    const [result] = await pool.execute(
      `
        INSERT INTO candidate_users (
          full_name,
          email,
          marketing_consent,
          world_id_verified
        )
        VALUES (?, ?, ?, ?)
      `,
      [name, email, marketingConsent ? 1 : 0, 1],
    );

    const candidateUser = {
      id: Number(result.insertId),
      name,
      email,
    };

    await pool.execute('DELETE FROM candidate_email_verifications WHERE email = ?', [email]);

    clearCompanySessionUser(req);
    setCandidateSessionUser(req, candidateUser);

    res.status(201).json({
      message: '개인 회원가입과 로그인 처리가 완료되었습니다.',
      candidateUser,
    });
  } catch (error) {
    console.error('Candidate signup failed:', error);
    res.status(500).json({ message: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/company/verification/send', async (req, res) => {
  const companyEmail = req.body.companyEmail?.trim().toLowerCase() ?? '';

  if (!companyEmail || !isValidEmail(companyEmail)) {
    res.status(400).json({ message: '올바른 기업 이메일을 입력해주세요.' });
    return;
  }

  try {
    const [existingUsers] = await pool.execute(
      'SELECT id FROM company_users WHERE company_email = ? LIMIT 1',
      [companyEmail],
    );

    if (existingUsers.length > 0) {
      res.status(409).json({ message: '이미 가입된 기업 이메일입니다.' });
      return;
    }

    const [verificationRows] = await pool.execute(
      `
        SELECT resend_available_at
        FROM company_email_verifications
        WHERE company_email = ?
        LIMIT 1
      `,
      [companyEmail],
    );

    const existingVerification = verificationRows[0];
    const retryAfterSeconds = getSecondsUntil(existingVerification?.resend_available_at);

    if (retryAfterSeconds > 0) {
      res.status(429).json({
        message: '잠시 후 다시 인증코드를 발송해주세요.',
        code: 'SIGNUP_RESEND_COOLDOWN',
        retryAfterSeconds,
      });
      return;
    }

    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + verificationExpiryMinutes * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + unlockResendCooldownSeconds * 1000);

    await pool.execute(
      `
        INSERT INTO company_email_verifications (
          company_email,
          verification_code,
          expires_at,
          verified_at,
          failed_attempts,
          resend_available_at
        )
        VALUES (?, ?, ?, NULL, 0, ?)
        ON DUPLICATE KEY UPDATE
          verification_code = VALUES(verification_code),
          expires_at = VALUES(expires_at),
          verified_at = NULL,
          failed_attempts = 0,
          resend_available_at = VALUES(resend_available_at)
      `,
      [companyEmail, verificationCode, expiresAt, resendAvailableAt],
    );

    const emailResult = await sendCompanyVerificationEmail({
      companyEmail,
      verificationCode,
      expiresInMinutes: verificationExpiryMinutes,
    });

    console.log(`[company verification] ${companyEmail} -> sent (${emailResult.messageId})`);

    res.json({
      message: '인증코드를 발송했습니다.',
      retryAfterSeconds: unlockResendCooldownSeconds,
      expiresInSeconds: verificationExpiryMinutes * 60,
      ...(emailResult.inboxUrl ? { devInboxUrl: emailResult.inboxUrl } : {}),
    });
  } catch (error) {
    console.error('Company verification send failed:', error);
    res.status(500).json({ message: '인증코드 발송 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/company/verification/verify', async (req, res) => {
  const companyEmail = req.body.companyEmail?.trim().toLowerCase() ?? '';
  const verificationCode = req.body.verificationCode?.trim() ?? '';

  if (!companyEmail || !isValidEmail(companyEmail)) {
    res.status(400).json({ message: '올바른 기업 이메일을 입력해주세요.' });
    return;
  }

  if (!/^\d{6}$/.test(verificationCode)) {
    res.status(400).json({ message: '인증번호 6자리를 입력해주세요.' });
    return;
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT company_email, verification_code, expires_at, failed_attempts, resend_available_at
        FROM company_email_verifications
        WHERE company_email = ?
        LIMIT 1
      `,
      [companyEmail],
    );

    const verification = rows[0];

    if (!verification) {
      res.status(404).json({ message: '먼저 인증코드를 발송해주세요.' });
      return;
    }

    const retryAfterSeconds = getSecondsUntil(verification.resend_available_at);

    if (!verification.verification_code && retryAfterSeconds > 0) {
      res.status(429).json({
        message: '인증코드가 초기화되었습니다. 1분 후 다시 발송해주세요.',
        code: 'SIGNUP_CODE_RESET',
        retryAfterSeconds,
      });
      return;
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      res.status(400).json({ message: '인증코드가 만료되었습니다. 다시 발송해주세요.' });
      return;
    }

    if (verification.verification_code !== verificationCode) {
      const nextFailedAttempts = Number(verification.failed_attempts ?? 0) + 1;

      if (nextFailedAttempts >= maxUnlockVerificationAttempts) {
        const nextResendAvailableAt = new Date(Date.now() + unlockResendCooldownSeconds * 1000);

        await pool.execute(
          `
            UPDATE company_email_verifications
            SET verification_code = '',
                expires_at = NOW(),
                verified_at = NULL,
                failed_attempts = 0,
                resend_available_at = ?
            WHERE company_email = ?
          `,
          [nextResendAvailableAt, companyEmail],
        );

        res.status(429).json({
          message: '인증코드를 5회 잘못 입력해 코드가 초기화되었습니다. 1분 후 다시 발송해주세요.',
          code: 'SIGNUP_CODE_RESET',
          retryAfterSeconds: unlockResendCooldownSeconds,
        });
        return;
      }

      await pool.execute(
        `
          UPDATE company_email_verifications
          SET failed_attempts = ?
          WHERE company_email = ?
        `,
        [nextFailedAttempts, companyEmail],
      );

      res.status(400).json({ message: '인증코드가 올바르지 않습니다.' });
      return;
    }

    await pool.execute(
      `
        UPDATE company_email_verifications
        SET verified_at = NOW(),
            failed_attempts = 0
        WHERE company_email = ?
      `,
      [companyEmail],
    );

    res.json({ message: '이메일 인증이 완료되었습니다.' });
  } catch (error) {
    console.error('Company verification check failed:', error);
    res.status(500).json({ message: '인증 확인 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/company/signup', async (req, res) => {
  const companyName = req.body.companyName?.trim() ?? '';
  const companyEmail = req.body.companyEmail?.trim().toLowerCase() ?? '';
  const password = req.body.password ?? '';
  const termsAgreed = req.body.termsAgreed === true;

  if (!companyName) {
    res.status(400).json({ message: '기업명을 입력해주세요.' });
    return;
  }

  if (!companyEmail || !isValidEmail(companyEmail)) {
    res.status(400).json({ message: '올바른 기업 이메일을 입력해주세요.' });
    return;
  }

  if (!termsAgreed) {
    res.status(400).json({ message: '이용약관 동의가 필요합니다.' });
    return;
  }

  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' });
    return;
  }

  try {
    const [verificationRows] = await pool.execute(
      `
        SELECT verified_at, expires_at
        FROM company_email_verifications
        WHERE company_email = ?
        LIMIT 1
      `,
      [companyEmail],
    );

    const verification = verificationRows[0];

    if (!verification) {
      res.status(400).json({ message: '먼저 이메일 인증을 완료해주세요.' });
      return;
    }

    if (!verification.verified_at) {
      res.status(400).json({ message: '먼저 이메일 인증을 완료해주세요.' });
      return;
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      res.status(400).json({ message: '인증코드가 만료되었습니다. 다시 발송해주세요.' });
      return;
    }

    const [existingRows] = await pool.execute(
      'SELECT id FROM company_users WHERE company_email = ? LIMIT 1',
      [companyEmail],
    );

    if (existingRows.length > 0) {
      res.status(409).json({ message: '이미 가입된 기업 이메일입니다.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `
        INSERT INTO company_users (company_name, company_email, password_hash)
        VALUES (?, ?, ?)
      `,
      [companyName, companyEmail, passwordHash],
    );

    const companyUser = {
      id: Number(result.insertId),
      companyName,
      companyEmail,
    };

    await pool.execute('DELETE FROM company_email_verifications WHERE company_email = ?', [
      companyEmail,
    ]);

    clearCandidateSessionUser(req);
    setCompanySessionUser(req, companyUser);

    res.status(201).json({
      message: '기업 회원가입과 로그인 처리가 완료되었습니다.',
      companyUser,
    });
  } catch (error) {
    console.error('Company signup failed:', error);
    res.status(500).json({ message: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/company/login', async (req, res) => {
  const email = req.body.email?.trim().toLowerCase() ?? '';
  const password = req.body.password ?? '';

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ message: '올바른 이메일을 입력해주세요.' });
    return;
  }

  if (!password) {
    res.status(400).json({ message: '비밀번호를 입력해주세요.' });
    return;
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT id, company_name, company_email, password_hash, failed_login_attempts, account_locked_at
        FROM company_users
        WHERE company_email = ?
        LIMIT 1
      `,
      [email],
    );

    const company = rows[0];

    if (!company) {
      res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    if (isCompanyAccountLocked(company)) {
      res.status(423).json({
        message: '로그인 10회 실패로 계정이 잠겼습니다. 이메일 인증코드로 잠금을 해제해주세요.',
        code: 'ACCOUNT_LOCKED',
      });
      return;
    }

    const passwordMatched = await bcrypt.compare(password, company.password_hash);

    if (!passwordMatched) {
      const nextFailedAttempts = Number(company.failed_login_attempts ?? 0) + 1;

      if (nextFailedAttempts >= maxFailedLoginAttempts) {
        await pool.execute(
          `
            UPDATE company_users
            SET failed_login_attempts = ?, account_locked_at = NOW()
            WHERE id = ?
          `,
          [maxFailedLoginAttempts, company.id],
        );

        res.status(423).json({
          message: '로그인 10회 실패로 계정이 잠겼습니다. 이메일 인증코드로 잠금을 해제해주세요.',
          code: 'ACCOUNT_LOCKED',
        });
        return;
      }

      await pool.execute(
        `
          UPDATE company_users
          SET failed_login_attempts = ?
          WHERE id = ?
        `,
        [nextFailedAttempts, company.id],
      );

      res.status(401).json({
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        code: 'INVALID_CREDENTIALS',
      });
      return;
    }

    await pool.execute(
      `
        UPDATE company_users
        SET failed_login_attempts = 0, account_locked_at = NULL
        WHERE id = ?
      `,
      [company.id],
    );

    const companyUser = toCompanySessionUser(company);
    clearCandidateSessionUser(req);
    setCompanySessionUser(req, companyUser);

    res.json({
      message: '로그인되었습니다.',
      companyUser,
    });
  } catch (error) {
    console.error('Company login failed:', error);
    res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/company/unlock/send', async (req, res) => {
  const companyEmail = req.body.companyEmail?.trim().toLowerCase() ?? '';

  if (!companyEmail || !isValidEmail(companyEmail)) {
    res.status(400).json({ message: '올바른 기업 이메일을 입력해주세요.' });
    return;
  }

  try {
    const [rows] = await pool.execute(
      `
        SELECT id, account_locked_at
        FROM company_users
        WHERE company_email = ?
        LIMIT 1
      `,
      [companyEmail],
    );

    const company = rows[0];

    if (!company) {
      res.status(404).json({ message: '가입된 기업 계정을 찾을 수 없습니다.' });
      return;
    }

    if (!isCompanyAccountLocked(company)) {
      res.status(400).json({ message: '현재 잠긴 계정이 아닙니다.' });
      return;
    }

    const [unlockRows] = await pool.execute(
      `
        SELECT resend_available_at
        FROM company_unlock_verifications
        WHERE company_email = ?
        LIMIT 1
      `,
      [companyEmail],
    );

    const existingUnlockVerification = unlockRows[0];
    const retryAfterSeconds = getSecondsUntil(existingUnlockVerification?.resend_available_at);

    if (retryAfterSeconds > 0) {
      res.status(429).json({
        message: '잠시 후 다시 인증코드를 발송해주세요.',
        code: 'UNLOCK_RESEND_COOLDOWN',
        retryAfterSeconds,
      });
      return;
    }

    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + verificationExpiryMinutes * 60 * 1000);
    const resendAvailableAt = new Date(Date.now() + unlockResendCooldownSeconds * 1000);

    await pool.execute(
      `
        INSERT INTO company_unlock_verifications (
          company_email,
          verification_code,
          expires_at,
          verified_at,
          failed_attempts,
          resend_available_at
        )
        VALUES (?, ?, ?, NULL, 0, ?)
        ON DUPLICATE KEY UPDATE
          verification_code = VALUES(verification_code),
          expires_at = VALUES(expires_at),
          verified_at = NULL,
          failed_attempts = 0,
          resend_available_at = VALUES(resend_available_at)
      `,
      [companyEmail, verificationCode, expiresAt, resendAvailableAt],
    );

    const emailResult = await sendCompanyUnlockEmail({
      companyEmail,
      verificationCode,
      expiresInMinutes: verificationExpiryMinutes,
    });

    console.log(`[company unlock] ${companyEmail} -> sent (${emailResult.messageId})`);

    res.json({
      message: '잠금 해제 인증코드를 발송했습니다.',
      retryAfterSeconds: unlockResendCooldownSeconds,
      expiresInSeconds: verificationExpiryMinutes * 60,
    });
  } catch (error) {
    console.error('Company unlock send failed:', error);
    res.status(500).json({ message: '잠금 해제 인증코드 발송 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/company/unlock/verify', async (req, res) => {
  const companyEmail = req.body.companyEmail?.trim().toLowerCase() ?? '';
  const verificationCode = req.body.verificationCode?.trim() ?? '';

  if (!companyEmail || !isValidEmail(companyEmail)) {
    res.status(400).json({ message: '올바른 기업 이메일을 입력해주세요.' });
    return;
  }

  if (!/^\d{6}$/.test(verificationCode)) {
    res.status(400).json({ message: '인증번호 6자리를 입력해주세요.' });
    return;
  }

  try {
    const [companyRows] = await pool.execute(
      `
        SELECT id, account_locked_at
        FROM company_users
        WHERE company_email = ?
        LIMIT 1
      `,
      [companyEmail],
    );

    const company = companyRows[0];

    if (!company) {
      res.status(404).json({ message: '가입된 기업 계정을 찾을 수 없습니다.' });
      return;
    }

    if (!isCompanyAccountLocked(company)) {
      res.status(400).json({ message: '현재 잠긴 계정이 아닙니다.' });
      return;
    }

    const [rows] = await pool.execute(
      `
        SELECT company_email, verification_code, expires_at, failed_attempts, resend_available_at
        FROM company_unlock_verifications
        WHERE company_email = ?
        LIMIT 1
      `,
      [companyEmail],
    );

    const verification = rows[0];

    if (!verification) {
      res.status(404).json({ message: '먼저 잠금 해제 인증코드를 발송해주세요.' });
      return;
    }

    const retryAfterSeconds = getSecondsUntil(verification.resend_available_at);

    if (!verification.verification_code && retryAfterSeconds > 0) {
      res.status(429).json({
        message: '인증코드가 초기화되었습니다. 1분 후 다시 발송해주세요.',
        code: 'UNLOCK_CODE_RESET',
        retryAfterSeconds,
      });
      return;
    }

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      res.status(400).json({ message: '인증코드가 만료되었습니다. 다시 발송해주세요.' });
      return;
    }

    if (verification.verification_code !== verificationCode) {
      const nextFailedAttempts = Number(verification.failed_attempts ?? 0) + 1;

      if (nextFailedAttempts >= maxUnlockVerificationAttempts) {
        const nextResendAvailableAt = new Date(Date.now() + unlockResendCooldownSeconds * 1000);

        await pool.execute(
          `
            UPDATE company_unlock_verifications
            SET verification_code = '',
                expires_at = NOW(),
                verified_at = NULL,
                failed_attempts = 0,
                resend_available_at = ?
            WHERE company_email = ?
          `,
          [nextResendAvailableAt, companyEmail],
        );

        res.status(429).json({
          message: '인증코드를 5회 잘못 입력해 코드가 초기화되었습니다. 1분 후 다시 발송해주세요.',
          code: 'UNLOCK_CODE_RESET',
          retryAfterSeconds: unlockResendCooldownSeconds,
        });
        return;
      }

      await pool.execute(
        `
          UPDATE company_unlock_verifications
          SET failed_attempts = ?
          WHERE company_email = ?
        `,
        [nextFailedAttempts, companyEmail],
      );

      res.status(400).json({ message: '인증코드가 올바르지 않습니다.' });
      return;
    }

    await pool.execute(
      `
        UPDATE company_unlock_verifications
        SET verified_at = NOW(),
            failed_attempts = 0
        WHERE company_email = ?
      `,
      [companyEmail],
    );

    await pool.execute(
      `
        UPDATE company_users
        SET failed_login_attempts = 0, account_locked_at = NULL
        WHERE id = ?
      `,
      [company.id],
    );

    await pool.execute('DELETE FROM company_unlock_verifications WHERE company_email = ?', [
      companyEmail,
    ]);

    res.json({ message: '계정 잠금이 해제되었습니다. 다시 로그인해주세요.' });
  } catch (error) {
    console.error('Company unlock verify failed:', error);
    res.status(500).json({ message: '잠금 해제 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearCompanySessionUser(req);
  clearCandidateSessionUser(req);
  req.session.destroy((error) => {
    if (error) {
      console.error('Logout failed:', error);
      res.status(500).json({ message: '로그아웃 처리 중 오류가 발생했습니다.' });
      return;
    }

    res.clearCookie('verifit.sid');
    res.json({ message: '로그아웃되었습니다.' });
  });
});

ensureDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Verifit auth server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
