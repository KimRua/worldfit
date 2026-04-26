import type { Tokens } from '@worldcoin/minikit-js/commands';

export type CompanySessionUser = {
  id: number;
  companyName: string;
  companyEmail: string;
};

export type AdminSessionUser = {
  id: number;
  username: string;
};

export type CandidateSessionUser = {
  id: number;
  name: string;
  email: string;
};

export type CandidateExploreSession = {
  id: string;
  title: string;
  organization: string;
  location: string;
  mode: string;
  description: string;
  inviteCode: string;
  typeLabel: string;
  filterKey: 'recruiting' | 'contest' | 'audition' | 'education';
  status: 'draft' | 'open' | 'closing';
  deadline: string;
  deadlineDays: number;
  processes: CandidateSessionProcess[];
  requirements: string[];
  detailLines: string[];
  eligibilityLines: string[];
  weights: string[];
};

export type CandidateSessionProcess = {
  id: number;
  name: string;
  content: string;
  submissionMethod: string;
};

export type CandidatePortfolioFile = {
  name: string;
  sizeLabel: string;
  uploadProgress: number;
};

export type CandidateProcessResponse = {
  processId: number;
  value: string;
  file: CandidatePortfolioFile | null;
};

export type CandidateSavedApplication = {
  sessionId: string;
  status: 'draft' | 'submitted';
  humanVerified: boolean;
  eligibilityVerified: boolean;
  processResponses: CandidateProcessResponse[];
  githubUrl: string;
  portfolioFile: CandidatePortfolioFile | null;
  updatedAtLabel: string;
  session: CandidateExploreSession | null;
};

export type CandidateReportAgentScore = {
  label: string;
  weightLabel: string;
  score: number;
};

export type CandidateReport = {
  id: string;
  sessionId: string;
  title: string;
  organization: string;
  location: string;
  mode: string;
  typeLabel: string;
  weights: string[];
  submittedAt: string;
  statusLabel: string;
  overallScore: number;
  percentileLabel: string;
  agentScores: CandidateReportAgentScore[];
  strengths: string[];
  improvements: {
    title: string;
    description: string;
  }[];
};

export type CandidateMatchField = {
  key: string;
  label: string;
  value: string;
  shared: boolean;
  required?: boolean;
};

export type CandidateMatchRecord = {
  id: string;
  company: string;
  sessionTitle: string;
  requestTypeLabel: string;
  requestedAt: string;
  status: 'pending' | 'accepted' | 'rejected';
  infoFields: CandidateMatchField[];
};

export type CandidateSettingsShareKey = 'name' | 'email' | 'phone' | 'education' | 'career' | 'resume';

export type CandidateSettingsAttachment = {
  id: string;
  label: string;
  fileName: string;
  sizeLabel?: string;
  emptyLabel?: string;
};

export type CandidateSettingsForm = {
  name: string;
  birthDate: string;
  email: string;
  phone: string;
  education: string;
  affiliation: string;
  careerYears: string;
  employmentType: string;
  attachments: CandidateSettingsAttachment[];
  shareDefaults: Record<CandidateSettingsShareKey, boolean>;
};

export type CandidateEligibilityStatus = {
  requiresDocumentCredential: boolean;
  documentVerified: boolean;
  isEligible: boolean;
  ageEligible: boolean;
  countryEligible: boolean;
  reason: string;
  documentCountryCode?: string;
  ageBracket?: string | null;
  ageOver18?: boolean | null;
};

export type CandidateDocumentCredentialSummary = {
  credentialType: string;
  issuerSchemaId?: number | null;
  countryCode: string | null;
  ageBracket: string | null;
  ageOver18: boolean | null;
  verifiedAt: string;
};

export type CandidatePortalBootstrap = {
  explore: {
    sessions: CandidateExploreSession[];
    favoriteSessionIds: string[];
  };
  applications: CandidateSavedApplication[];
  settings: {
    unlocked: boolean;
    form: CandidateSettingsForm;
  };
  verification: {
    documentCredential: CandidateDocumentCredentialSummary | null;
  };
  dashboard: {
    reports: CandidateReport[];
    matching: CandidateMatchRecord[];
  };
};

export type CandidateVerificationResponse = {
  message: string;
  retryAfterSeconds?: number;
  expiresInSeconds?: number;
  devInboxUrl?: string;
};

export type CompanyDashboardSummaryCard = {
  label: string;
  value: string;
  detail: string;
};

export type CompanyDashboardSession = {
  id: string;
  name: string;
  type: string;
  applicants: string;
  progress: number;
  fraudCount: number | null;
};

export type CompanyVerificationType = 'company' | 'organizer';
export type CompanyVerificationCountry = 'KR' | 'US' | 'JP' | 'SG';

export type CompanyVerificationForm = {
  country: CompanyVerificationCountry;
  verificationType: CompanyVerificationType;
  companyBusinessCertificateFileName: string;
  companyCorporateSealCertificateFileName: string;
  companyOfficialLetterFileName: string;
  organizerBusinessCertificateFileName: string;
  organizerUsageSealCertificateFileName: string;
  organizerOfficialLetterFileName: string;
};

export type CompanyPortalJobListing = {
  id: string;
  title: string;
  type: string;
  period: string;
  applicants: string;
  status: string;
  statusTone: 'dark' | 'danger' | 'muted' | 'soft';
  fraudCount: number | null;
};

export type CompanyBlindSelectionCard = {
  id: string;
  type: 'recruiting' | 'contest' | 'audition' | 'education';
  status: 'open' | 'closing';
  badge: string;
  title: string;
  integrityWeightLabel?: string;
};

export type CompanyBlindRankingCandidate = {
  id: string;
  anonymousId: string;
  overallScore: number;
  humanVerified: boolean;
  metrics: {
    label: string;
    score: number;
  }[];
  integrityScore: number;
  selected: boolean;
  summary?: string;
  strengths?: string[];
  risks?: string[];
  improvementTags?: string[];
  agentBreakdown?: Record<
    string,
    {
      score: number;
      confidence: number;
      summary: string;
      strengths: string[];
      risks: string[];
      evidence: string[];
      improvementTags: string[];
    }
  >;
};

export type CompanyFraudCaseStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed';
export type CompanyFraudSeverity = 'high' | 'medium' | 'low';

export type CompanyFraudCase = {
  id: string;
  title: string;
  detailId: string;
  issue: string;
  severity: CompanyFraudSeverity;
  confidence: number;
  timestamp: string;
  status: CompanyFraudCaseStatus;
  evidenceTitle: string;
  evidences: string[];
  behaviorLogs: string[];
};

export type CompanyCreditHistoryItem = {
  timestamp: string;
  amount: string;
};

export type CompanyCreditPaymentOption = {
  key: 'WLD' | 'USDC' | 'USDT';
  label: string;
  worldTokenSymbol: Tokens | null;
  tokenPerUsd: number;
};

export type CompanyCreditChargeStatus = 'ready' | 'pending' | 'confirmed' | 'failed' | 'expired';
export type CompanyCreditPaymentChannel = 'mini_app' | 'web_deposit';

export type CompanyCreditQuote = {
  paymentChannel: CompanyCreditPaymentChannel;
  paymentTokenKey: CompanyCreditPaymentOption['key'];
  creditUsd: number;
  tokenAmountDisplay: string;
  tokenAmountAtomic: string;
  tokenPriceUsd: number;
  tokenPerUsd: number;
  fetchedAt: string;
};

export type CompanyCreditCharge = {
  id: string;
  paymentChannel: CompanyCreditPaymentChannel;
  reference: string;
  status: CompanyCreditChargeStatus;
  creditUsd: number;
  receiverAddress: string;
  paymentToken: {
    key: CompanyCreditPaymentOption['key'];
    label: string;
    worldTokenSymbol: Tokens | null;
    contractAddress: string | null;
    amountDisplay: string;
    amountAtomic: string;
    decimals: number;
  };
  transactionId: string | null;
  transactionHash: string | null;
  payerWalletAddress: string | null;
  failureReason: string | null;
  depositAddress: string | null;
  receivedTokenAmountDisplay: string | null;
  quotedTokenPriceUsd: number | null;
  quotedAmountUsd: number | null;
  creditedUsd: number | null;
  detectedAt: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
};

export type AdminDashboard = {
  summary: {
    totalBalanceUsd: number;
    totalChargedUsd: number;
    pendingWebDepositCount: number;
    companyCount: number;
  };
  balances: {
    companyId: number;
    companyName: string;
    companyEmail: string;
    balanceUsd: number;
    monthlyUsageUsd: number;
    updatedAt: string | null;
  }[];
  deposits: {
    id: string;
    companyName: string;
    companyEmail: string;
    paymentChannel: CompanyCreditPaymentChannel;
    status: CompanyCreditChargeStatus;
    paymentTokenKey: CompanyCreditPaymentOption['key'];
    requestedCreditUsd: number;
    expectedTokenAmountDisplay: string;
    receivedTokenAmountDisplay: string | null;
    quotedAmountUsd: number | null;
    creditedAmountUsd: number | null;
    transactionHash: string | null;
    reference: string;
    createdAt: string | null;
    confirmedAt: string | null;
  }[];
};

export type CompanyAgentCatalogItem = {
  id: string;
  icon: string;
  name: string;
  billingLabel: string;
  description: string;
  selected: boolean;
  weight: number;
  locked: boolean;
};

export type CompanyEvaluationCriteria = {
  focus: string;
  strengths: string;
  risks: string;
};

export type CompanyPortalBootstrap = {
  dashboard: {
    summaryCards: CompanyDashboardSummaryCard[];
    sessions: CompanyDashboardSession[];
    alerts: string[];
    wldUsage: number[];
    pendingFraudCount: number;
  };
  jobs: {
    statusFilters: {
      label: string;
      active?: boolean;
    }[];
    items: CompanyPortalJobListing[];
  };
  blind: {
    cards: CompanyBlindSelectionCard[];
  };
  fraud: {
    filters: {
      key: CompanyFraudCaseStatus;
      label: string;
    }[];
    cases: CompanyFraudCase[];
  };
  credit: {
    balanceUsd: number;
    monthlyUsageUsd: number;
    walletAddress: string;
    exchangeRate: number;
    miniAppPaymentsEnabled: boolean;
    webDepositEnabled: boolean;
    minRechargeUsd: number;
    maxRechargeUsd: number;
    miniAppPaymentOptions: CompanyCreditPaymentOption[];
    webDepositOptions: CompanyCreditPaymentOption[];
    history: CompanyCreditHistoryItem[];
  };
  agentCatalog: CompanyAgentCatalogItem[];
  settings: {
    companyName: string;
    companyEmail: string;
    contact: string;
    language: string;
    verificationForm: CompanyVerificationForm;
  };
};

export type CompanyJobReportResponse = {
  job: CompanyPortalJobListing;
  summary: {
    badge: string;
    title: string;
    description: string;
  };
  histogram: {
    label: string;
    height: number;
  }[];
  topCandidates: {
    rank: number;
    id: string;
    score: number;
  }[];
  agentScores: {
    label: string;
    score: number;
    bandStart: number;
    bandWidth: number;
  }[];
  improvements: {
    label: string;
    count: number;
    tone: 'danger' | 'dark';
  }[];
};

export type CompanyBlindRankingResponse = {
  blindCard: CompanyBlindSelectionCard;
  candidates: CompanyBlindRankingCandidate[];
  summary: {
    description: string;
  };
};

export type CompanyPdfExtractResponse = {
  message: string;
  document: {
    fileName: string;
    target: string | null;
    pageCount: number;
    characterCount: number;
    truncated: boolean;
    text: string;
  };
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
  signal?: string;
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
  method?: 'GET' | 'POST' | 'PUT';
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

async function requestFormData<T>(path: string, formData: FormData) {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    body: formData,
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
    adminUser?: AdminSessionUser | null;
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
  intent?: 'settings-unlock' | 'job-human-verify' | 'match-consent-verify';
  jobId?: string;
  matchId?: string;
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

export function loginAdmin(input: {
  username: string;
  password: string;
}) {
  return request<{ adminUser: AdminSessionUser; message: string }>('/api/auth/admin/login', {
    method: 'POST',
    body: input,
  });
}

export function fetchAdminDashboard() {
  return request<AdminDashboard>('/api/admin/dashboard');
}

export function changeAdminPassword(input: {
  currentPassword: string;
  nextPassword: string;
}) {
  return request<{ message: string }>('/api/admin/password', {
    method: 'PUT',
    body: input,
  });
}

export function fetchCompanyPortalBootstrap() {
  return request<CompanyPortalBootstrap>('/api/company/portal/bootstrap');
}

export function fetchCandidatePortalBootstrap() {
  return request<CandidatePortalBootstrap>('/api/candidate/portal/bootstrap');
}

export function saveCandidatePortalSettings(input: CandidateSettingsForm) {
  return request<{
    message: string;
    candidateUser: CandidateSessionUser;
    settings: CandidateSettingsForm;
  }>('/api/candidate/settings', {
    method: 'PUT',
    body: input,
  });
}

export function saveCandidateFavorites(input: { favoriteSessionIds: string[] }) {
  return request<{ message: string; favoriteSessionIds: string[] }>('/api/candidate/favorites', {
    method: 'PUT',
    body: input,
  });
}

export function fetchCandidateJobEligibility(jobId: string) {
  return request<CandidateEligibilityStatus>(`/api/candidate/jobs/${jobId}/eligibility`);
}

export function createCandidateEligibilityWorldIdRpSignature(jobId: string) {
  return request<WorldIdRpSignature>(`/api/candidate/jobs/${jobId}/eligibility/world-id/rp-signature`, {
    method: 'POST',
  });
}

export function verifyCandidateEligibilityWithWorldId(input: {
  jobId: string;
  idkitResponse: unknown;
}) {
  return request<{ message: string; verification: CandidateEligibilityStatus }>(
    `/api/candidate/jobs/${input.jobId}/eligibility/world-id/verify`,
    {
      method: 'POST',
      body: {
        idkitResponse: input.idkitResponse,
      },
    },
  );
}

export function saveCandidateJobApplication(input: {
  jobId: string;
  status: CandidateSavedApplication['status'];
  processResponses: CandidateProcessResponse[];
  processFiles?: Record<number, File>;
}) {
  const formData = new FormData();
  formData.append('status', input.status);
  formData.append('processResponses', JSON.stringify(input.processResponses));

  for (const [processId, file] of Object.entries(input.processFiles ?? {})) {
    if (file instanceof File) {
      formData.append(`processFile_${processId}`, file);
    }
  }

  return requestFormData<{ message: string; applications: CandidateSavedApplication[]; reports: CandidateReport[] }>(
    `/api/candidate/jobs/${input.jobId}/application`,
    formData,
  );
}

export function respondToCandidateMatchRequest(input: {
  matchId: string;
  status: CandidateMatchRecord['status'];
  infoFields: CandidateMatchField[];
}) {
  return request<{ message: string; record: CandidateMatchRecord }>(
    `/api/candidate/matches/${input.matchId}/respond`,
    {
      method: 'POST',
      body: {
        status: input.status,
        infoFields: input.infoFields,
      },
    },
  );
}

export function saveCompanyPortalSettings(input: {
  companyName: string;
  contact: string;
  language: string;
  verificationForm: CompanyVerificationForm;
}) {
  return request<{
    message: string;
    companyUser: CompanySessionUser;
    settings: CompanyPortalBootstrap['settings'];
  }>('/api/company/settings', {
    method: 'PUT',
    body: input,
  });
}

export function createCompanyCreditCharge(input: {
  creditUsd: number;
  paymentTokenKey: CompanyCreditPaymentOption['key'];
  paymentChannel: CompanyCreditPaymentChannel;
}) {
  return request<{ message: string; charge: CompanyCreditCharge }>('/api/company/credits/charges', {
    method: 'POST',
    body: input,
  });
}

export function fetchCompanyCreditCharge(chargeId: string) {
  return request<{ message: string; charge: CompanyCreditCharge }>(`/api/company/credits/charges/${chargeId}`);
}

export function fetchCompanyCreditQuote(input: {
  creditUsd: number;
  paymentTokenKey: CompanyCreditPaymentOption['key'];
  paymentChannel: CompanyCreditPaymentChannel;
}) {
  const params = new URLSearchParams({
    creditUsd: String(input.creditUsd),
    paymentTokenKey: input.paymentTokenKey,
    paymentChannel: input.paymentChannel,
  });

  return request<{ quote: CompanyCreditQuote }>(`/api/company/credits/quote?${params.toString()}`);
}

export function confirmCompanyCreditCharge(input: {
  chargeId: string;
  transactionId: string;
}) {
  return request<{ message: string; charge: CompanyCreditCharge }>(
    `/api/company/credits/charges/${input.chargeId}/confirm`,
    {
      method: 'POST',
      body: { transactionId: input.transactionId },
    },
  );
}

export function createCompanyPortalJob(input: {
  sessionType: CompanyBlindSelectionCard['type'];
  form: {
    title: string;
    description: string;
    detailedDescription: string;
    startDate: string;
    endDate: string;
    capacity: string;
    capacityDisplay: 'exact' | 'masked';
    visibilityScope: string;
    eligibleAge: 'minor' | 'adult' | 'all';
    eligibleCountries: string[];
  };
  processes: {
    id: number;
    name: string;
    content: string;
    submissionMethod: string;
  }[];
  agents: CompanyAgentCatalogItem[];
  evaluationCriteria: CompanyEvaluationCriteria;
  expectedApplicants: string;
}) {
  return request<{
    message: string;
    job: CompanyPortalJobListing;
    blindCard: CompanyBlindSelectionCard;
  }>('/api/company/jobs', {
    method: 'POST',
    body: input,
  });
}

export function fetchCompanyJobReport(jobId: string) {
  return request<CompanyJobReportResponse>(`/api/company/jobs/${jobId}/report`);
}

export function fetchCompanyBlindRanking(jobId: string) {
  return request<CompanyBlindRankingResponse>(`/api/company/blind/${jobId}/ranking`);
}

export function extractCompanyPdfText(input: {
  file: File;
  target?: string;
}) {
  const formData = new FormData();
  formData.append('file', input.file);

  if (input.target) {
    formData.append('target', input.target);
  }

  return requestFormData<CompanyPdfExtractResponse>('/api/company/pdf/extract', formData);
}

export function setCompanyBlindRankingSelection(
  jobId: string,
  candidateId: string,
  selected: boolean,
) {
  return request<{
    message: string;
    selectedCount: number;
    candidates: CompanyBlindRankingCandidate[];
  }>(`/api/company/blind/${jobId}/candidates/${candidateId}/selection`, {
    method: 'PUT',
    body: { selected },
  });
}

export function sendCompanyBlindRankingNotifications(input: {
  jobId: string;
  requestFields: Array<{ key: string; required: boolean }>;
}) {
  return request<{ message: string; selectedCount: number }>(`/api/company/blind/${input.jobId}/notify`, {
    method: 'POST',
    body: {
      requestFields: input.requestFields,
    },
  });
}

export function updateCompanyFraudCase(input: {
  caseId: string;
  status: Extract<CompanyFraudCaseStatus, 'resolved' | 'dismissed'>;
}) {
  return request<{ message: string }>(`/api/company/fraud-cases/${input.caseId}/status`, {
    method: 'PUT',
    body: { status: input.status },
  });
}
