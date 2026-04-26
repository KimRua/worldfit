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

export async function sendCandidateMatchingEmail({
  candidateEmail,
  candidateName,
  companyName,
  sessionTitle,
}) {
  const safeName = candidateName?.trim() || '지원자';
  const info = await getTransporter().sendMail({
    from: mailFrom,
    to: candidateEmail,
    subject: `[WorldFit] ${companyName} 매칭 제안이 도착했습니다`,
    text: [
      `${safeName}님, 새로운 매칭 제안이 도착했습니다.`,
      '',
      `기업: ${companyName}`,
      `공고: ${sessionTitle}`,
      '',
      'WorldFit에 로그인해 매칭 이력에서 내용을 확인하고 공개 여부를 결정해주세요.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">새로운 매칭 제안이 도착했습니다</h2>
        <p style="margin: 0 0 16px;">${safeName}님, 아래 기업이 프로필 공개 동의를 요청했습니다.</p>
        <div style="padding: 16px 18px; border-radius: 14px; background: #f3f4f6;">
          <p style="margin: 0 0 8px;"><strong>기업</strong> ${companyName}</p>
          <p style="margin: 0;"><strong>공고</strong> ${sessionTitle}</p>
        </div>
        <p style="margin: 18px 0 0;">WorldFit에 로그인해 매칭 이력에서 내용을 확인하고 공개 여부를 결정해주세요.</p>
      </div>
    `,
  });

  return {
    messageId: info.messageId,
    inboxUrl: mailInboxUrl || undefined,
  };
}

export async function sendCompanyMatchConsentEmail({
  companyEmail,
  companyName,
  sessionTitle,
  sharedFields,
}) {
  const safeCompanyName = companyName?.trim() || '기업 담당자';
  const safeSessionTitle = sessionTitle?.trim() || '진행 중 공고';
  const visibleFields = Array.isArray(sharedFields)
    ? sharedFields
        .map((field) => ({
          label: String(field?.label ?? '').trim(),
          value: String(field?.value ?? '').trim(),
        }))
        .filter((field) => field.label && field.value)
    : [];
  const candidateLabel =
    visibleFields.find((field) => field.label === '이름')?.value ||
    visibleFields.find((field) => field.label.toLowerCase().includes('이메일'))?.value ||
    '한 지원자';

  const textFieldLines =
    visibleFields.length > 0
      ? visibleFields.map((field) => `- ${field.label}: ${field.value}`).join('\n')
      : '- 공개된 정보가 없습니다.';
  const htmlFieldItems =
    visibleFields.length > 0
      ? visibleFields
          .map(
            (field) =>
              `<li style="margin: 0 0 8px;"><strong>${field.label}</strong><span style="margin-left: 8px;">${field.value}</span></li>`,
          )
          .join('')
      : '<li style="margin: 0;">공개된 정보가 없습니다.</li>';

  const info = await getTransporter().sendMail({
    from: mailFrom,
    to: companyEmail,
    subject: `[WorldFit] ${safeSessionTitle} 매칭 공개 동의가 도착했습니다`,
    text: [
      `${safeCompanyName}님, ${candidateLabel}이(가) 정보 공개에 동의했습니다.`,
      '',
      `공고: ${safeSessionTitle}`,
      '',
      '공개 동의한 정보',
      textFieldLines,
      '',
      '이제 WorldFit을 떠나 기업 / 주최자 쪽 후속 단계를 진행해주세요.',
      '지원자에게 연락하거나 다음 절차를 이어가실 수 있습니다.',
      '',
      'WorldFit을 이용해주셔서 감사합니다.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin-bottom: 12px;">매칭 공개 동의가 도착했습니다</h2>
        <p style="margin: 0 0 16px;">${safeCompanyName}님, <strong>${candidateLabel}</strong>이(가) 정보 공개에 동의했습니다.</p>
        <div style="padding: 16px 18px; border-radius: 14px; background: #f3f4f6; margin-bottom: 16px;">
          <p style="margin: 0;"><strong>공고</strong> ${safeSessionTitle}</p>
        </div>
        <div style="padding: 16px 18px; border-radius: 14px; border: 1px solid #e5e7eb; background: #ffffff;">
          <p style="margin: 0 0 12px; font-weight: 700;">공개 동의한 정보</p>
          <ul style="margin: 0; padding-left: 18px;">
            ${htmlFieldItems}
          </ul>
        </div>
        <p style="margin: 18px 0 0;">이제 WorldFit을 떠나 기업 / 주최자 쪽 후속 단계를 진행해주세요. 지원자에게 연락하거나 다음 절차를 이어가실 수 있습니다.</p>
        <p style="margin: 12px 0 0; color: #6b7280;">WorldFit을 이용해주셔서 감사합니다.</p>
      </div>
    `,
  });

  return {
    messageId: info.messageId,
    inboxUrl: mailInboxUrl || undefined,
  };
}
