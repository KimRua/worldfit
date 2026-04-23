export type CompanySessionUser = {
  id: number;
  companyName: string;
  companyEmail: string;
};

export type CandidateSessionUser = {
  id: number;
  name: string;
  email: string;
};

export type CandidateVerificationResponse = {
  message: string;
  retryAfterSeconds?: number;
  expiresInSeconds?: number;
  devInboxUrl?: string;
};

export type WorldIdEnvironment = 'production' | 'staging';

export type WorldIdConfig = {
  enabled: boolean;
  appId: string | null;
  action: string;
  environment: WorldIdEnvironment;
};

export type WorldIdRpSignature = {
  appId: `app_${string}`;
  action: string;
  environment: WorldIdEnvironment;
  rpContext: {
    rp_id: `rp_${string}`;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  };
};

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, code?: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type ApiRequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
};

async function request<T>(path: string, options: ApiRequestOptions = {}) {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload.message === 'string' ? payload.message : '요청 처리 중 오류가 발생했습니다.';
    const code = typeof payload.code === 'string' ? payload.code : undefined;
    const retryAfterSeconds =
      typeof payload.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : undefined;
    throw new ApiError(message, response.status, code, retryAfterSeconds);
  }

  return payload as T;
}

export function fetchCurrentSessionUser() {
  return request<{
    companyUser?: CompanySessionUser | null;
    candidateUser?: CandidateSessionUser | null;
  }>('/api/auth/me');
}

export function fetchWorldIdConfig() {
  return request<WorldIdConfig>('/api/world-id/config');
}

export function sendCandidateVerificationCode(input: {
  email: string;
}) {
  return request<CandidateVerificationResponse>(
    '/api/auth/candidate/verification/send',
    {
      method: 'POST',
      body: input,
    },
  );
}

export function verifyCandidateVerificationCode(input: {
  email: string;
  verificationCode: string;
}) {
  return request<{ message: string }>('/api/auth/candidate/verification/verify', {
    method: 'POST',
    body: input,
  });
}

export function sendCandidateLoginCode(input: {
  email: string;
}) {
  return request<CandidateVerificationResponse>('/api/auth/candidate/login/send', {
    method: 'POST',
    body: input,
  });
}

export function loginCandidate(input: {
  email: string;
  verificationCode: string;
}) {
  return request<{ candidateUser: CandidateSessionUser; message: string }>(
    '/api/auth/candidate/login/verify',
    {
      method: 'POST',
      body: input,
    },
  );
}

export function createCandidateWorldIdRpSignature(input: {
  email: string;
}) {
  return request<WorldIdRpSignature>('/api/world-id/rp-signature', {
    method: 'POST',
    body: input,
  });
}

export function createCandidateLoginWorldIdRpSignature() {
  return request<WorldIdRpSignature>('/api/world-id/login/rp-signature', {
    method: 'POST',
  });
}

export function loginCandidateWithWorldId(input: {
  idkitResponse: unknown;
}) {
  return request<{ candidateUser: CandidateSessionUser; message: string }>(
    '/api/world-id/login/verify',
    {
      method: 'POST',
      body: input,
    },
  );
}

export function verifyCandidateWorldId(input: {
  email: string;
  idkitResponse: unknown;
}) {
  return request<{ message: string }>('/api/world-id/verify', {
    method: 'POST',
    body: input,
  });
}

export function signupCandidate(input: {
  name: string;
  email: string;
  marketingConsent: boolean;
  termsAgreed: boolean;
}) {
  return request<{ candidateUser: CandidateSessionUser; message: string }>(
    '/api/auth/candidate/signup',
    {
      method: 'POST',
      body: input,
    },
  );
}

export function sendCompanyVerificationCode(input: {
  companyEmail: string;
}) {
  return request<{ message: string; retryAfterSeconds?: number; expiresInSeconds?: number; devInboxUrl?: string }>(
    '/api/auth/company/verification/send',
    {
      method: 'POST',
      body: input,
    },
  );
}

export function verifyCompanyVerificationCode(input: {
  companyEmail: string;
  verificationCode: string;
}) {
  return request<{ message: string }>('/api/auth/company/verification/verify', {
    method: 'POST',
    body: input,
  });
}

export function sendCompanyUnlockCode(input: {
  companyEmail: string;
}) {
  return request<{ message: string; retryAfterSeconds?: number; expiresInSeconds?: number }>(
    '/api/auth/company/unlock/send',
    {
      method: 'POST',
      body: input,
    },
  );
}

export function verifyCompanyUnlockCode(input: {
  companyEmail: string;
  verificationCode: string;
}) {
  return request<{ message: string }>('/api/auth/company/unlock/verify', {
    method: 'POST',
    body: input,
  });
}

export function signupCompany(input: {
  companyName: string;
  companyEmail: string;
  password: string;
  termsAgreed: boolean;
}) {
  return request<{ companyUser: CompanySessionUser; message: string }>('/api/auth/company/signup', {
    method: 'POST',
    body: input,
  });
}

export function loginCompany(input: {
  email: string;
  password: string;
}) {
  return request<{ companyUser: CompanySessionUser; message: string }>('/api/auth/company/login', {
    method: 'POST',
    body: input,
  });
}

export function logoutCompany() {
  return request<{ message: string }>('/api/auth/logout', {
    method: 'POST',
  });
}
