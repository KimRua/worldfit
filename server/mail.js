import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const mailHost = process.env.MAIL_HOST ?? '127.0.0.1';
const mailPort = Number(process.env.MAIL_PORT ?? 1025);
const mailSecure = process.env.MAIL_SECURE === 'true';
const mailUser = process.env.MAIL_USER ?? '';
const mailPassword = process.env.MAIL_PASSWORD ?? '';
const mailFrom = process.env.MAIL_FROM ?? 'WorldFit <no-reply@WorldFit.local>';
const mailInboxUrl = process.env.MAIL_INBOX_URL ?? '';

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: mailSecure,
      auth: mailUser && mailPassword ? { user: mailUser, pass: mailPassword } : undefined,
    });
  }

  return transporter;
}

export async function sendCompanyVerificationEmail({
  companyEmail,
  verificationCode,
  expiresInMinutes,
}) {
  const info = await getTransporter().sendMail({
    from: mailFrom,
    to: companyEmail,
    subject: '[WorldFit] 기업 이메일 인증코드',
    text: [
      'WorldFit 기업회원가입 이메일 인증코드입니다.',
      '',
      `인증코드: ${verificationCode}`,
      `유효시간: ${expiresInMinutes}분`,
      '',
      '본인이 요청하지 않았다면 이 메일을 무시해주세요.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">WorldFit 기업 이메일 인증</h2>
        <p style="margin: 0 0 16px;">아래 인증코드를 회원가입 화면에 입력해주세요.</p>
        <div style="display: inline-block; padding: 14px 20px; border-radius: 12px; background: #f3f4f6; font-size: 28px; font-weight: 700; letter-spacing: 0.18em;">
          ${verificationCode}
        </div>
        <p style="margin: 16px 0 0;">유효시간: ${expiresInMinutes}분</p>
        <p style="margin: 16px 0 0; color: #6b7280;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
      </div>
    `,
  });

  return {
    messageId: info.messageId,
    inboxUrl: mailInboxUrl || undefined,
  };
}

export async function sendCandidateVerificationEmail({
  candidateEmail,
  verificationCode,
  expiresInMinutes,
}) {
  const info = await getTransporter().sendMail({
    from: mailFrom,
    to: candidateEmail,
    subject: '[WorldFit] 개인 회원가입 이메일 인증코드',
    text: [
      'WorldFit 개인회원가입 이메일 인증코드입니다.',
      '',
      `인증코드: ${verificationCode}`,
      `유효시간: ${expiresInMinutes}분`,
      '',
      '본인이 요청하지 않았다면 이 메일을 무시해주세요.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">WorldFit 개인 이메일 인증</h2>
        <p style="margin: 0 0 16px;">아래 인증코드를 회원가입 화면에 입력해주세요.</p>
        <div style="display: inline-block; padding: 14px 20px; border-radius: 12px; background: #f3f4f6; font-size: 28px; font-weight: 700; letter-spacing: 0.18em;">
          ${verificationCode}
        </div>
        <p style="margin: 16px 0 0;">유효시간: ${expiresInMinutes}분</p>
        <p style="margin: 16px 0 0; color: #6b7280;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
      </div>
    `,
  });

  return {
    messageId: info.messageId,
    inboxUrl: mailInboxUrl || undefined,
  };
}

export async function sendCandidateLoginEmail({
  candidateEmail,
  verificationCode,
  expiresInMinutes,
}) {
  const info = await getTransporter().sendMail({
    from: mailFrom,
    to: candidateEmail,
    subject: '[WorldFit] 개인 로그인 인증코드',
    text: [
      'WorldFit 개인 로그인 인증코드입니다.',
      '',
      `인증코드: ${verificationCode}`,
      `유효시간: ${expiresInMinutes}분`,
      '',
      '본인이 요청하지 않았다면 이 메일을 무시해주세요.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">WorldFit 개인 로그인</h2>
        <p style="margin: 0 0 16px;">아래 인증코드를 로그인 화면에 입력해주세요.</p>
        <div style="display: inline-block; padding: 14px 20px; border-radius: 12px; background: #f3f4f6; font-size: 28px; font-weight: 700; letter-spacing: 0.18em;">
          ${verificationCode}
        </div>
        <p style="margin: 16px 0 0;">유효시간: ${expiresInMinutes}분</p>
        <p style="margin: 16px 0 0; color: #6b7280;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
      </div>
    `,
  });

  return {
    messageId: info.messageId,
    inboxUrl: mailInboxUrl || undefined,
  };
}

export async function sendCompanyUnlockEmail({
  companyEmail,
  verificationCode,
  expiresInMinutes,
}) {
  const info = await getTransporter().sendMail({
    from: mailFrom,
    to: companyEmail,
    subject: '[WorldFit] 계정 잠금 해제 인증코드',
    text: [
      'WorldFit 기업 계정 잠금 해제 인증코드입니다.',
      '',
      `인증코드: ${verificationCode}`,
      `유효시간: ${expiresInMinutes}분`,
      '',
      '본인이 요청하지 않았다면 이 메일을 무시해주세요.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">WorldFit 계정 잠금 해제</h2>
        <p style="margin: 0 0 16px;">아래 인증코드를 입력하면 로그인 잠금이 해제됩니다.</p>
        <div style="display: inline-block; padding: 14px 20px; border-radius: 12px; background: #f3f4f6; font-size: 28px; font-weight: 700; letter-spacing: 0.18em;">
          ${verificationCode}
        </div>
        <p style="margin: 16px 0 0;">유효시간: ${expiresInMinutes}분</p>
        <p style="margin: 16px 0 0; color: #6b7280;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
      </div>
    `,
  });

  return {
    messageId: info.messageId,
    inboxUrl: mailInboxUrl || undefined,
  };
}
