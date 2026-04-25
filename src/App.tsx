import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  IDKitErrorCodes,
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from '@worldcoin/idkit';
import { MiniKit } from '@worldcoin/minikit-js';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import {
  ApiError,
  changeAdminPassword,
  confirmCompanyCreditCharge,
  createCompanyCreditCharge,
  createCompanyPortalJob,
  createCandidateLoginWorldIdRpSignature,
  createCandidateWorldIdRpSignature,
  fetchAdminDashboard,
  fetchCompanyCreditCharge,
  fetchCompanyCreditQuote,
  fetchCompanyBlindRanking,
  fetchCompanyJobReport,
  fetchCompanyPortalBootstrap,
  fetchCurrentSessionUser,
  fetchWorldIdConfig,
  loginAdmin,
  loginCandidate,
  loginCandidateWithWorldId,
  loginCompany,
  logoutCompany,
  saveCompanyPortalSettings,
  sendCandidateLoginCode,
  sendCandidateVerificationCode,
  sendCompanyBlindRankingNotifications,
  sendCompanyVerificationCode,
  sendCompanyUnlockCode,
  setCompanyBlindRankingSelection,
  signupCandidate,
  signupCompany,
  updateCompanyFraudCase,
  verifyCandidateWorldId,
  verifyCandidateVerificationCode,
  verifyCompanyUnlockCode,
  verifyCompanyVerificationCode,
  type AdminDashboard,
  type AdminSessionUser,
  type CandidateSessionUser,
  type CompanyCreditCharge,
  type CompanyCreditPaymentOption,
  type CompanyCreditQuote,
  type CompanyEvaluationCriteria,
  type CompanySessionUser,
  type CompanyJobReportResponse,
  type CompanyPortalBootstrap,
  type WorldIdConfig,
  type WorldIdRpSignature,
} from './api';

type Role = 'candidate' | 'organizer';
type ModalStep = 'role' | 'signup' | 'success';
type LoginModalStep = 'role' | 'form';
type Screen = 'landing' | 'candidateSignup' | 'companySignup' | 'companyTemp' | 'candidateTemp' | 'admin';
type CandidateLoginMethod = 'worldId' | 'email';
type CompanyDashboardView = 'home' | 'jobs' | 'blind' | 'blindRanking' | 'report' | 'create' | 'fraud' | 'credit' | 'settings';
type CompanyCreateStage = 1 | 2 | 3;
type CompanyCreateAgentDetailTab = 'criteria' | 'behavior' | 'domains';

type CompanyJobStatusTone = 'dark' | 'danger' | 'muted' | 'soft';
type CompanyFraudCaseStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed';
type CompanyFraudSeverity = 'high' | 'medium' | 'low';
type CompanySessionType = 'recruiting' | 'contest' | 'audition' | 'education';
type CompanyBlindSelectionStatus = 'open' | 'closing';

type CompanyDashboardNavItem = {
  label: string;
  view?: CompanyDashboardView;
};

type CompanyJobStatusFilter = {
  label: string;
  active?: boolean;
};

type CompanyCreateStep = {
  step: number;
  title: string;
  active?: boolean;
};

type CompanyJobListing = {
  id: string;
  title: string;
  type: string;
  period: string;
  applicants: string;
  status: string;
  statusTone: CompanyJobStatusTone;
  fraudCount: number | null;
};

type CompanyCreateForm = {
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

type CompanyFraudCase = {
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

type CompanyCreditHistoryItem = {
  timestamp: string;
  amount: string;
};

type CompanyBlindSelectionCard = {
  id: string;
  type: CompanySessionType;
  status: CompanyBlindSelectionStatus;
  badge: string;
  title: string;
};

type CompanyBlindRankingCandidate = {
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
};

type CompanyBlindRankingHumanFilter = 'all' | 'verified' | 'unverified';
type CompanyBlindRankingSortOrder = 'desc' | 'asc';
type CompanyBlindRankingDetailTab = 'overview' | 'tech' | 'reason' | 'comm' | 'creat' | 'integrity';
type CompanyJobTypeFilter = 'all' | CompanySessionType;
type CompanyJobStatusFilterKey = 'all' | 'draft' | 'open' | 'closed';

type CompanyBlindRankingTabSection = {
  heading: string;
  summary: string;
  items: {
    index: number;
    title: string;
    score: string;
    description: string;
  }[];
};

type CompanyBlindRankingCandidateDetail = {
  confidenceSummary: string;
  rating: string;
  recommendation: string;
  overviewSummaryTitle: string;
  overviewSummary: string;
  tabSections: Partial<Record<CompanyBlindRankingDetailTab, CompanyBlindRankingTabSection>>;
};

type CompanySettingsForm = {
  companyName: string;
  companyEmail: string;
  contact: string;
  language: string;
};

type CompanyVerificationType = 'company' | 'organizer';
type CompanyVerificationCountry = 'KR' | 'US' | 'JP' | 'SG';
type CompanyCreditCurrency = CompanyCreditPaymentOption['key'];

type CompanyVerificationForm = {
  country: CompanyVerificationCountry;
  verificationType: CompanyVerificationType;
  companyBusinessCertificateFileName: string;
  companyCorporateSealCertificateFileName: string;
  companyOfficialLetterFileName: string;
  organizerBusinessCertificateFileName: string;
  organizerUsageSealCertificateFileName: string;
  organizerOfficialLetterFileName: string;
};

type CompanyCreateProcess = {
  id: number;
  name: string;
  content: string;
  submissionMethod: string;
};

type CompanyCreateRequiredField =
  | 'title'
  | 'description'
  | 'detailedDescription'
  | 'startDate'
  | 'endDate'
  | 'capacity';
type CompanyCreateFormErrors = Partial<Record<CompanyCreateRequiredField, string>>;
type CompanyCreateProcessRequiredField = 'name' | 'content' | 'submissionMethod';
type CompanyCreateProcessErrors = Partial<Record<CompanyCreateProcessRequiredField, string>>;

type CompanyCreateAgent = CompanyPortalBootstrap['agentCatalog'][number];

type CompanyCreateAgentDetailItem = {
  title: string;
  description: string;
};

type CompanyCreateAgentRelated = {
  id: string;
  icon: string;
  name: string;
  meta: string;
};

type CompanyCreateAgentReview = {
  title: string;
  body: string;
  meta: string;
};

type CompanyCreateAgentDetail = {
  summary: string;
  rating: number;
  reviewCount: string;
  criteriaTitle: string;
  criteria: CompanyCreateAgentDetailItem[];
  behavior: CompanyCreateAgentDetailItem[];
  domains: string[];
  sampleTitle: string;
  sampleSummary: string;
  sampleExcerpt: string[];
  relatedAgents: CompanyCreateAgentRelated[];
  reviews: CompanyCreateAgentReview[];
};

type CandidateSignupForm = {
  name: string;
  email: string;
  verificationCode: string;
  password: string;
  organization: string;
  inviteCode: string;
  marketingConsent: boolean;
  termsAgreed: boolean;
};

type AdminLoginForm = {
  username: string;
  password: string;
};

type AdminPasswordForm = {
  currentPassword: string;
  nextPassword: string;
  confirmNextPassword: string;
};

type CompanySignupForm = {
  companyName: string;
  companyEmail: string;
  verificationCode: string;
  password: string;
  confirmPassword: string;
  termsAgreed: boolean;
};

type CompanyLoginForm = {
  email: string;
  password: string;
};

type CandidateLoginForm = {
  email: string;
  verificationCode: string;
};

const initialCandidateForm: CandidateSignupForm = {
  name: '',
  email: '',
  verificationCode: '',
  password: '',
  organization: '',
  inviteCode: '',
  marketingConsent: false,
  termsAgreed: false,
};

const initialCompanyForm: CompanySignupForm = {
  companyName: '',
  companyEmail: '',
  verificationCode: '',
  password: '',
  confirmPassword: '',
  termsAgreed: false,
};

const initialCompanyLoginForm: CompanyLoginForm = {
  email: '',
  password: '',
};

const initialCandidateLoginForm: CandidateLoginForm = {
  email: '',
  verificationCode: '',
};

const initialCompanyCreateForm: CompanyCreateForm = {
  title: '',
  description: '',
  detailedDescription: '',
  startDate: '',
  endDate: '',
  capacity: '',
  capacityDisplay: 'exact',
  visibilityScope: '공개',
  eligibleAge: 'all',
  eligibleCountries: [],
};

const companyCreateEligibilityAgeOptions = [
  { key: 'minor', label: '미성년자만' },
  { key: 'adult', label: '성인만' },
  { key: 'all', label: '모두' },
] as const satisfies readonly { key: CompanyCreateForm['eligibleAge']; label: string }[];

const companyCreateCountryOptions = [
  '대한민국',
  '미국',
  '일본',
  '싱가포르',
  '독일',
  '프랑스',
  '영국',
  '캐나다',
  '호주',
  '인도',
  '브라질',
  '베트남',
  '인도네시아',
  '태국',
  '필리핀',
] as const;

const defaultCompanySettingsPreferences = {
  contact: '',
  language: '',
} as const;

const companySettingsLanguageLegacyMap: Record<string, string> = {
  영어: 'English',
  아랍어: 'العربية',
  크로아티아어: 'Hrvatski',
  덴마크어: 'Dansk',
  네덜란드어: 'Nederlands',
  필리핀어: 'Filipino',
  핀란드어: 'Suomi',
  프랑스어: 'Français',
  독일어: 'Deutsch',
  인도네시아어: 'Bahasa Indonesia',
  이탈리아어: 'Italiano',
  일본어: '日本語',
  한국어: '한국어',
  말레이어: 'Bahasa Melayu',
  노르웨이어: 'Norsk',
  폴란드어: 'Polski',
  포르투갈어: 'Português',
  '중국어(간체/번체)': '简体中文 / 繁體中文',
  스페인어: 'Español',
  태국어: 'ไทย',
};

const normalizeCompanySettingsLanguage = (language: string) =>
  companySettingsLanguageLegacyMap[language] ?? language;

const getInitialCompanySettingsForm = (
  companyUser: CompanySessionUser | null,
  preferences: Pick<CompanySettingsForm, 'contact' | 'language'> = defaultCompanySettingsPreferences,
): CompanySettingsForm => ({
  companyName: companyUser?.companyName ?? '',
  companyEmail: companyUser?.companyEmail ?? '',
  contact: preferences.contact,
  language: normalizeCompanySettingsLanguage(preferences.language),
});

const companySettingsLanguageOptions = [
  'English',
  'العربية',
  'Hrvatski',
  'Dansk',
  'Nederlands',
  'Filipino',
  'Suomi',
  'Français',
  'Deutsch',
  'Bahasa Indonesia',
  'Italiano',
  '日本語',
  '한국어',
  'Bahasa Melayu',
  'Norsk',
  'Polski',
  'Português',
  '简体中文 / 繁體中文',
  'Español',
  'ไทย',
] as const;

const initialCompanyVerificationForm: CompanyVerificationForm = {
  country: 'KR',
  verificationType: 'company',
  companyBusinessCertificateFileName: '',
  companyCorporateSealCertificateFileName: '',
  companyOfficialLetterFileName: '',
  organizerBusinessCertificateFileName: '',
  organizerUsageSealCertificateFileName: '',
  organizerOfficialLetterFileName: '',
};

const companyVerificationCountryOptions: readonly {
  key: CompanyVerificationCountry;
  label: string;
  available: boolean;
}[] = [
  { key: 'KR', label: '대한민국', available: true },
  { key: 'US', label: '미국', available: false },
  { key: 'JP', label: '일본', available: false },
  { key: 'SG', label: '싱가포르', available: false },
] as const;

const companyVerificationRequiredFields: Record<
  CompanyVerificationType,
  readonly (keyof CompanyVerificationForm)[]
> = {
  company: [
    'companyBusinessCertificateFileName',
    'companyCorporateSealCertificateFileName',
    'companyOfficialLetterFileName',
  ],
  organizer: [
    'organizerBusinessCertificateFileName',
    'organizerUsageSealCertificateFileName',
    'organizerOfficialLetterFileName',
  ],
} as const;

function getCompanyVerificationBadge(form: CompanyVerificationForm) {
  const requiredFields = companyVerificationRequiredFields[form.verificationType];
  const filledCount = requiredFields.filter((field) => form[field].trim().length > 0).length;

  if (filledCount === 0) {
    return {
      label: '미인증',
      tone: 'unverified' as const,
    };
  }

  if (filledCount < requiredFields.length) {
    return {
      label: '서류 미완료',
      tone: 'warning' as const,
    };
  }

  return {
    label: '심사중',
    tone: 'pending' as const,
  };
}

const companyCreateSubmissionOptions = [
  '링크 제출',
  '텍스트 직접 입력',
  '.pdf',
  '.hwp/hwpx',
  '.jpg/jpeg',
  '.doc/docx',
  '.xls/xlsx',
  '.png',
  '.svg',
  '.zip',
  '제출 없음',
] as const;

const createCompanyCreateProcess = (id: number): CompanyCreateProcess => ({
  id,
  name: '',
  content: '',
  submissionMethod: '',
});

const initialCompanyCreateProcesses: CompanyCreateProcess[] = [
  createCompanyCreateProcess(1),
];

const COMPANY_CREATE_COST_PER_APPLICANT_WLD = 42;
const COMPANY_CREATE_WLD_BALANCE = 2480;

const normalizeCompanyCreateAgentWeight = (weight: number) => {
  if (!Number.isFinite(weight)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(weight)));
};

const cloneCompanyCreateAgents = (agents: readonly CompanyCreateAgent[]) =>
  agents.map((agent) => ({ ...agent }));

const initialCompanyCreateEvaluationCriteria: CompanyEvaluationCriteria = {
  focus: '',
  strengths: '',
  risks: '',
};

const createCompanyCreateAgentWeightInputs = (agents: readonly CompanyCreateAgent[]) =>
  agents.reduce<Record<string, string>>((result, agent) => {
    result[agent.id] = String(agent.weight);
    return result;
  }, {});

const companyCreateAgentDetailTabs: readonly { key: CompanyCreateAgentDetailTab; label: string }[] = [
  { key: 'criteria', label: '평가 기준' },
  { key: 'behavior', label: '동작 방식' },
  { key: 'domains', label: '지원 도메인' },
] as const;

const companyCreateAgentDetailCatalog: Record<string, CompanyCreateAgentDetail> = {
  technical: {
    summary: '코드 구조·설계 품질·기술 이해도를 정량 평가하는 공식 에이전트',
    rating: 4.6,
    reviewCount: '1,248',
    criteriaTitle: '평가 기준 (5축)',
    criteria: [
      { title: '코드 품질', description: '가독성·설계 일관성·테스트 커버리지' },
      { title: '아키텍처', description: '모듈 분리·의존성 관리·확장성' },
      { title: '동시성·성능', description: '스레드·비동기 처리 전략 및 지연 시간' },
      { title: '의사결정', description: '트레이드오프와 설계 정당화' },
      { title: '문서화', description: 'README·주석·설계 문서의 완결성' },
    ],
    behavior: [
      { title: '문항별 세부 채점', description: '제출물의 각 단계별 산출물을 개별 지표로 분해합니다.' },
      { title: '리뷰 요약 생성', description: '점수 외에 개선 포인트와 위험 요소를 자연어로 요약합니다.' },
      { title: '일관성 검사', description: '점수와 코멘트가 충돌하면 내부 규칙으로 다시 보정합니다.' },
      { title: '리포트 출력', description: '최종 점수표와 근거를 공고 리포트 형식으로 반환합니다.' },
    ],
    domains: ['Web Backend', 'Web Frontend', 'Mobile iOS', 'Mobile Android', 'Data/ML', 'DevOps'],
    sampleTitle: 'Technical Evaluator Report - wid_0x82f4...',
    sampleSummary: 'Score 88/100 · 코드 품질 90 · 아키텍처 86 · 의사결정 92 · 문서화 88',
    sampleExcerpt: [
      '도메인 경계가 명확하게 분리되어 있고, 오류 복구 로직이 중앙에 잘 배치되어 있습니다.',
      '테스트 커버리지와 REST 응답 스키마 문서화만 보완하면 완성도가 더 높아집니다.',
    ],
    relatedAgents: [
      { id: 'reasoning', icon: '🧠', name: 'Reasoning Evaluator', meta: '10 WLD | 17개 팀' },
      { id: 'integrity', icon: '🛡', name: 'Integrity Monitor', meta: '14 WLD | 17개 팀' },
    ],
    reviews: [
      {
        title: '기술 평가 기준이 명확합니다',
        body: '세부 축이 분리되어 있어 지원자 피드백과 내부 논의에 모두 활용하기 좋았습니다.',
        meta: '플랫폼팀 · 2주 전',
      },
      {
        title: '리포트 문구 품질이 좋습니다',
        body: '점수만 나오는 게 아니라 아키텍처와 문서화 개선 포인트가 같이 정리됩니다.',
        meta: '인프라팀 · 1개월 전',
      },
    ],
  },
  reasoning: {
    summary: '문제 해결 방식과 논리 구조를 평가하는 사고력 중심 에이전트',
    rating: 4.7,
    reviewCount: '986',
    criteriaTitle: '평가 기준 (5축)',
    criteria: [
      { title: '문제 해석', description: '질문 의도와 조건을 정확히 파악하는지' },
      { title: '가설 수립', description: '가능한 해결 경로를 논리적으로 세우는지' },
      { title: '근거 연결', description: '주장과 근거를 일관되게 연결하는지' },
      { title: '반례 대응', description: '예외 상황과 대안 경로를 고려하는지' },
      { title: '결론 정리', description: '핵심 판단을 명확하게 요약하는지' },
    ],
    behavior: [
      { title: '과정 추적', description: '정답뿐 아니라 접근 순서를 단계별로 분석합니다.' },
      { title: '근거 가중치 조정', description: '설명 깊이에 따라 축별 가중치를 유연하게 보정합니다.' },
      { title: '함정 검출', description: '표면적 답변과 실제 추론 깊이를 분리해 봅니다.' },
      { title: '정리 피드백', description: '왜 높은 점수인지 또는 왜 감점됐는지 짧게 설명합니다.' },
    ],
    domains: ['Problem Solving', 'Case Interview', 'Product Thinking', 'System Design', 'Data Analysis'],
    sampleTitle: 'Reasoning Evaluator Report - session_reasoning...',
    sampleSummary: 'Score 84/100 · 문제 해석 88 · 근거 연결 90 · 반례 대응 74',
    sampleExcerpt: [
      '핵심 가설은 타당했지만, 예외 상황과 대안 비교가 충분히 확장되지는 않았습니다.',
      '결론 요약은 명확해 면접형 과제에 특히 잘 맞는 응답이었습니다.',
    ],
    relatedAgents: [
      { id: 'technical', icon: '⚙', name: 'Technical Evaluator', meta: '14.7 WLD | 24개 팀' },
      { id: 'communication', icon: '💬', name: 'Communication Evaluator', meta: '10.5 WLD | 19개 팀' },
    ],
    reviews: [
      {
        title: '케이스 과제에서 만족도가 높았습니다',
        body: '사고 과정과 결론을 분리해 보여줘서 채용팀 내부 공유가 쉬웠습니다.',
        meta: '채용운영팀 · 5일 전',
      },
      {
        title: '문제 접근 설명이 설득력 있습니다',
        body: '지원자 피드백용 코멘트가 과하게 길지 않으면서 핵심을 잘 짚어줍니다.',
        meta: 'HRBP · 3주 전',
      },
    ],
  },
  communication: {
    summary: '표현 명확성, 전달력, 문장 구조를 평가하는 커뮤니케이션 전용 에이전트',
    rating: 4.5,
    reviewCount: '812',
    criteriaTitle: '평가 기준 (5축)',
    criteria: [
      { title: '핵심 전달', description: '가장 중요한 메시지가 선명하게 보이는지' },
      { title: '구조화', description: '문단과 문장 흐름이 자연스럽게 이어지는지' },
      { title: '용어 선택', description: '대상에 맞는 표현과 난이도를 사용하는지' },
      { title: '간결성', description: '불필요한 반복 없이 요점을 유지하는지' },
      { title: '설득력', description: '읽는 사람이 납득할 수 있는 전개인지' },
    ],
    behavior: [
      { title: '문장 단위 분석', description: '문장 길이와 밀도를 바탕으로 전달 효율을 점검합니다.' },
      { title: '구조 피드백', description: '서론-본론-결론 흐름이 약한 부분을 짚어줍니다.' },
      { title: '대상 적합성 체크', description: '면접관, 고객, 동료 개발자 등 대상별 톤을 비교합니다.' },
      { title: '리라이팅 제안', description: '문장을 더 명확하게 바꿀 수 있는 방향을 제시합니다.' },
    ],
    domains: ['Interview Answer', 'Presentation Script', 'Business Writing', 'Documentation', 'Customer Reply'],
    sampleTitle: 'Communication Evaluator Summary - candidate_041...',
    sampleSummary: 'Score 86/100 · 핵심 전달 90 · 구조화 84 · 간결성 82',
    sampleExcerpt: [
      '주요 메시지는 분명하지만 일부 문단은 배경 설명이 길어 집중도가 떨어질 수 있습니다.',
      '결론부를 한 문장 더 짧게 정리하면 전달력이 한층 좋아집니다.',
    ],
    relatedAgents: [
      { id: 'reasoning', icon: '🧠', name: 'Reasoning Evaluator', meta: '10.5 WLD | 17개 팀' },
      { id: 'creativity', icon: '✨', name: 'Creativity Evaluator', meta: '4.2 WLD | 12개 팀' },
    ],
    reviews: [
      {
        title: '에세이형 과제와 잘 맞습니다',
        body: '문장 구조 피드백이 실제 첨삭처럼 보여 내부 만족도가 높았습니다.',
        meta: '브랜드팀 · 1주 전',
      },
      {
        title: '설득력 축이 유용했습니다',
        body: '지원자가 왜 그렇게 판단했는지 전달되는지 확인하기 좋았습니다.',
        meta: '사업개발팀 · 2주 전',
      },
    ],
  },
  creativity: {
    summary: '아이디어의 독창성, 차별성, 확장 가능성을 평가하는 창의성 에이전트',
    rating: 4.4,
    reviewCount: '624',
    criteriaTitle: '평가 기준 (5축)',
    criteria: [
      { title: '새로움', description: '기존 답안과 다른 관점을 제시하는지' },
      { title: '맥락 적합성', description: '독창성이 문제 맥락과 맞물리는지' },
      { title: '확장 가능성', description: '아이디어가 실제 실행으로 이어질 수 있는지' },
      { title: '조합 능력', description: '다른 아이디어를 새롭게 조합하는지' },
      { title: '차별성 설명', description: '왜 다른지 스스로 설명할 수 있는지' },
    ],
    behavior: [
      { title: '유사 답안 비교', description: '동일 세션 내 답안들과 차별성을 비교합니다.' },
      { title: '아이디어 조합 분석', description: '여러 개념을 묶는 방식의 새로움을 확인합니다.' },
      { title: '실행 가능성 보정', description: '공허한 아이디어는 실행성 점수로 보정합니다.' },
      { title: '후속 아이디어 제안', description: '지원자의 강점을 확장할 수 있는 힌트를 제공합니다.' },
    ],
    domains: ['Campaign Ideation', 'Product Concept', 'Creative Writing', 'Design Challenge', 'Hackathon'],
    sampleTitle: 'Creativity Evaluator Snapshot - creative_case...',
    sampleSummary: 'Score 79/100 · 새로움 88 · 실행 가능성 70 · 차별성 설명 76',
    sampleExcerpt: [
      '아이디어 자체는 참신하지만 운영 단계로 확장하는 설명이 조금 더 필요합니다.',
      '차별화 포인트를 사용자 경험 관점에서 풀어낸 점은 강점으로 보입니다.',
    ],
    relatedAgents: [
      { id: 'communication', icon: '💬', name: 'Communication Evaluator', meta: '10.5 WLD | 19개 팀' },
      { id: 'domain-fintech-1', icon: '🌐', name: 'Domain Expert · Fintech', meta: '도메인 라이선스 필요' },
    ],
    reviews: [
      {
        title: '공모전 과제에서 강합니다',
        body: '독창성과 실행 가능성을 동시에 봐줘서 심사 기준 설명에 도움이 됐습니다.',
        meta: '콘텐츠팀 · 9일 전',
      },
      {
        title: '아이디어 차별성을 잘 잡아줍니다',
        body: '유사 제출물 사이 비교 설명이 특히 유용했습니다.',
        meta: '기획팀 · 1개월 전',
      },
    ],
  },
  integrity: {
    summary: 'AI 대필, 표절, 비정상 행동 패턴을 점검하는 무결성 모니터링 에이전트',
    rating: 4.8,
    reviewCount: '1,032',
    criteriaTitle: '평가 기준 (5축)',
    criteria: [
      { title: '표절 유사도', description: '외부 자료 및 세션 내 제출물과의 유사성' },
      { title: '생성형 흔적', description: 'AI 대필 패턴과 문체 변화 탐지' },
      { title: '행동 이상', description: '비정상 속도, 반복 입력, 세션 패턴 분석' },
      { title: '출처 불일치', description: '근거와 결과물 사이 불일치 여부' },
      { title: '리스크 분류', description: '검토 우선순위에 맞게 위험 수준을 분류' },
    ],
    behavior: [
      { title: '로그 기반 분석', description: '세션 이벤트와 제출 시점을 함께 비교합니다.' },
      { title: '문체 변화 탐지', description: '문단별 표현 차이와 급격한 품질 상승을 추적합니다.' },
      { title: '리스크 라벨링', description: '주의, 경고, 차단 후보 단계로 분류합니다.' },
      { title: '재검토 큐 연결', description: '이상 사례를 별도 검토 목록에 자동으로 넘깁니다.' },
    ],
    domains: ['Fraud Detection', 'Remote Test', 'Essay Review', 'Coding Test', 'Portfolio Screening'],
    sampleTitle: 'Integrity Monitor Alert - session_2026...',
    sampleSummary: 'Risk High · 표절 유사도 91 · 생성형 흔적 78 · 행동 이상 84',
    sampleExcerpt: [
      '후반 문단에서 문체 복잡도가 급격히 상승하며, 외부 공개 문서와의 표현 유사도가 높습니다.',
      '검토 우선순위를 높게 두고 제출 경위 확인을 권장합니다.',
    ],
    relatedAgents: [
      { id: 'technical', icon: '⚙', name: 'Technical Evaluator', meta: '14.7 WLD | 24개 팀' },
      { id: 'reasoning', icon: '🧠', name: 'Reasoning Evaluator', meta: '10.5 WLD | 17개 팀' },
    ],
    reviews: [
      {
        title: '이상 사례 추적에 도움이 됩니다',
        body: '부정 의심 케이스를 우선순위로 정리해줘서 운영 시간이 크게 줄었습니다.',
        meta: '시험운영팀 · 3일 전',
      },
      {
        title: '경고 설명이 과하지 않습니다',
        body: '무조건 차단이 아니라 검토 포인트를 중심으로 제시해줘 신뢰감이 있습니다.',
        meta: '채용보안팀 · 2주 전',
      },
    ],
  },
  'domain-fintech': {
    summary: '핀테크 과제에서 필요한 맥락 지식과 규제 감수성을 보는 도메인 특화 에이전트',
    rating: 4.4,
    reviewCount: '341',
    criteriaTitle: '평가 기준 (5축)',
    criteria: [
      { title: '도메인 정확성', description: '금융 개념과 용어를 정확히 이해하는지' },
      { title: '규제 감수성', description: '보안·컴플라이언스 관점을 고려하는지' },
      { title: '사용자 맥락', description: '핀테크 사용자 흐름을 이해하고 설계하는지' },
      { title: '리스크 인지', description: '오류·사기·운영 리스크를 파악하는지' },
      { title: '실무 적합성', description: '현업 시나리오에 적용 가능한 판단인지' },
    ],
    behavior: [
      { title: '문맥 보강', description: '핀테크 과제에서 빠지기 쉬운 규제 요소를 보강합니다.' },
      { title: '케이스 비교', description: '결제, 송금, 인증 등 세부 카테고리별로 응답을 비교합니다.' },
      { title: '리스크 강조', description: '실수 비용이 큰 부분은 코멘트에서 더 크게 표시합니다.' },
      { title: '실무 메모 생성', description: '채용 담당자가 참고할 실무 관찰 포인트를 함께 남깁니다.' },
    ],
    domains: ['Payments', 'KYC', 'Lending', 'Fraud Ops', 'Compliance', 'Treasury'],
    sampleTitle: 'Domain Expert Report - fintech_screen...',
    sampleSummary: 'Score 81/100 · 도메인 정확성 84 · 리스크 인지 88 · 실무 적합성 79',
    sampleExcerpt: [
      '결제 승인 흐름은 정확하지만 이상 거래 탐지와 재시도 정책에 대한 언급은 다소 약합니다.',
      '실무 적용 가능성이 높아 운영·리스크 팀과의 협업 포인트를 함께 확인하면 좋습니다.',
    ],
    relatedAgents: [
      { id: 'technical', icon: '⚙', name: 'Technical Evaluator', meta: '14.7 WLD | 24개 팀' },
      { id: 'integrity', icon: '🛡', name: 'Integrity Monitor', meta: '14 WLD | 17개 팀' },
    ],
    reviews: [
      {
        title: '도메인 설명이 특히 좋았습니다',
        body: '일반 평가로는 놓치기 쉬운 규제 포인트를 미리 체크해줬습니다.',
        meta: '핀테크 PM · 2주 전',
      },
    ],
  },
};

function getCompanyCreateAgentDetail(agent: CompanyCreateAgent): CompanyCreateAgentDetail {
  if (agent.id.startsWith('domain-fintech')) {
    return companyCreateAgentDetailCatalog['domain-fintech'];
  }

  return (
    companyCreateAgentDetailCatalog[agent.id] ?? {
      summary: `${agent.description}에 초점을 맞춘 평가 에이전트입니다.`,
      rating: 4.5,
      reviewCount: '120',
      criteriaTitle: '평가 기준 (5축)',
      criteria: [
        { title: '핵심 정확도', description: '역할에 맞는 판단을 안정적으로 수행하는지' },
        { title: '일관성', description: '여러 제출물에서 기준이 흔들리지 않는지' },
        { title: '설명력', description: '점수 근거를 읽을 수 있는 언어로 제공하는지' },
        { title: '맥락 적합성', description: '공고 의도에 맞는 해석을 하는지' },
        { title: '운영 편의성', description: '리포트와 함께 활용하기 쉬운 결과인지' },
      ],
      behavior: [
        { title: '제출 분석', description: '세션 제출물을 구조화해 축별로 평가합니다.' },
        { title: '요약 생성', description: '운영자가 바로 사용할 수 있는 짧은 피드백을 생성합니다.' },
      ],
      domains: ['General'],
      sampleTitle: `${agent.name} Preview`,
      sampleSummary: '대표 리포트 샘플',
      sampleExcerpt: ['이 에이전트의 상세 리포트는 라이선스 상태에 따라 일부 내용이 제한될 수 있습니다.'],
      relatedAgents: [],
      reviews: [],
    }
  );
}

const landingFeatureCards = [
  {
    icon: '🧠',
    title: '멀티 에이전트',
    description: [
      '5종 이상의 AI가 서로의 결과를 모른 채 독립 평가.',
      '가중치는 기업이 직접 설정.',
    ],
  },
  {
    icon: '🪪',
    title: 'World ID',
    description: [
      '실제 사람만 참여.',
      '중복·봇 차단. 개인정보는 매칭 동의 전까지 비공개.',
    ],
  },
  {
    icon: '⛓️',
    title: '온체인 감사',
    description: [
      '모든 평가 로그가 블록체인에 기록되어',
      '언제든 재현성을 검증할 수 있음.',
    ],
  },
] as const;

const agentCards = [
  {
    title: 'Technical Evaluator',
    description: '코드 구조·설계 품질',
  },
  {
    title: 'Reasoning Evaluator',
    description: '문제 접근·논리',
  },
  {
    title: 'Integrity Monitor',
    description: 'AI 대필·표절 감지',
  },
] as const;

const companyDashboardNavItems: readonly CompanyDashboardNavItem[] = [
  { label: '홈 대시보드', view: 'home' },
  { label: '공고 목록', view: 'jobs' },
  { label: '공고 생성', view: 'create' },
  { label: '블라인드 선발', view: 'blind' },
  { label: '부정 알림', view: 'fraud' },
  { label: '크레딧', view: 'credit' },
  { label: '설정', view: 'settings' },
] as const;

const companyBlindSelectionTypeFilters = [
  { key: 'all', label: '전체' },
  { key: 'recruiting', label: '채용' },
  { key: 'contest', label: '공모전' },
  { key: 'audition', label: '오디션' },
  { key: 'education', label: '교육' },
] as const;

const companyBlindSelectionStatusFilters = [
  { key: 'all', label: '전체' },
  { key: 'open', label: '진행 중' },
  { key: 'closing', label: '마감임박' },
] as const;

const companyJobTypeFilters = [
  { key: 'all', label: '전체' },
  { key: 'recruiting', label: '채용' },
  { key: 'contest', label: '공모전' },
  { key: 'audition', label: '오디션' },
  { key: 'education', label: '교육' },
] as const satisfies readonly { key: CompanyJobTypeFilter; label: string }[];

const companyJobStatusFilters = [
  { key: 'all', label: '전체' },
  { key: 'draft', label: '대기' },
  { key: 'open', label: '진행' },
  { key: 'closed', label: '종료' },
] as const satisfies readonly { key: CompanyJobStatusFilterKey; label: string }[];

const companyBlindRankingDetailTabs = [
  { key: 'overview', label: '종합 정보' },
  { key: 'tech', label: 'Tech 35%' },
  { key: 'reason', label: 'Reason 25%' },
  { key: 'comm', label: 'Comm 25%' },
  { key: 'creat', label: 'Creat 10%' },
  { key: 'integrity', label: 'Integrity 15%' },
] as const satisfies readonly { key: CompanyBlindRankingDetailTab; label: string }[];

const companyBlindRankingFallbackTabMeta: Record<
  Exclude<CompanyBlindRankingDetailTab, 'overview'>,
  {
    metricLabel?: string;
    focusLabel: string;
    summary: string;
    items: { title: string; description: string }[];
  }
> = {
  tech: {
    metricLabel: 'Tech 35%',
    focusLabel: '기술 역량',
    summary: '핵심 구현 역량과 구조적 완성도를 기준으로 다시 검토할 가치가 있습니다.',
    items: [
      { title: '코드 품질', description: '가독성, 네이밍, 함수 분리, 컨벤션 준수 수준을 확인합니다.' },
      { title: '아키텍처', description: '모듈 경계, 책임 분리, 확장성을 중점적으로 봅니다.' },
      { title: '기능 완성도', description: '핵심 요구사항 반영 정도와 흐름의 안정성을 점검합니다.' },
      { title: '안정성', description: '예외 처리, 장애 상황, 동시성 리스크 대응을 검토합니다.' },
    ],
  },
  reason: {
    metricLabel: 'Reason 25%',
    focusLabel: '문제 해결력',
    summary: '주어진 문제를 구조화하고 우선순위를 정하는 방식이 비교적 일관됩니다.',
    items: [
      { title: '문제 구조화', description: '핵심 문제를 분해하고 제약을 명확히 정의하는지 확인합니다.' },
      { title: '근거 제시', description: '선택한 접근 방식에 대한 논리적 근거가 충분한지 봅니다.' },
      { title: '예외 대응', description: '실패 시나리오와 보완 계획을 함께 설명하는지 점검합니다.' },
      { title: '우선순위 판단', description: '제한된 시간 안에서 무엇을 먼저 해결하는지 평가합니다.' },
    ],
  },
  comm: {
    metricLabel: 'Comm 25%',
    focusLabel: '커뮤니케이션',
    summary: '설명 구조와 전달력이 비교적 안정적이며 협업 맥락을 이해하고 있습니다.',
    items: [
      { title: '설명 명확성', description: '핵심 포인트를 짧고 분명하게 전달하는 능력을 봅니다.' },
      { title: '협업 문맥', description: '팀 단위 협업과 리뷰 과정을 고려한 표현인지 확인합니다.' },
      { title: '피드백 수용', description: '보완 의견을 받아들이고 반영하는 태도를 평가합니다.' },
      { title: '문서 전달력', description: 'README와 커밋, 주석을 통해 의도를 공유하는 수준을 봅니다.' },
    ],
  },
  creat: {
    metricLabel: 'Creat 10%',
    focusLabel: '창의성',
    summary: '기본 요구사항 안에서 현실적인 개선 아이디어를 제안하는 편입니다.',
    items: [
      { title: '해결 아이디어', description: '기존 방식보다 나은 선택지를 스스로 제안하는지 확인합니다.' },
      { title: '확장 관점', description: '현재 구현이 이후 기능으로 이어질 여지를 고려하는지 봅니다.' },
      { title: '실행 가능성', description: '아이디어가 실제 제품과 운영 환경에 맞는지 점검합니다.' },
      { title: '차별화 요소', description: '제안의 독창성과 사용자 가치 연결성을 평가합니다.' },
    ],
  },
  integrity: {
    focusLabel: '무결성',
    summary: '신뢰성과 검증 가능성 측면에서 상대적으로 안정적인 신호를 보입니다.',
    items: [
      { title: '신원 검증', description: '인간 인증 상태와 제출 이력의 일관성을 확인합니다.' },
      { title: '행동 패턴', description: '비정상 제출 패턴이나 자동화 징후가 없는지 점검합니다.' },
      { title: '증빙 일치도', description: '제출물과 설명, 산출물 간의 정합성을 평가합니다.' },
      { title: '리스크 수준', description: '추가 검증이 필요한 포인트가 남아 있는지 검토합니다.' },
    ],
  },
};

function getCompanyBlindRankingMetricScore(
  candidate: CompanyBlindRankingCandidate,
  tab: Exclude<CompanyBlindRankingDetailTab, 'overview'>,
) {
  if (tab === 'integrity') {
    return candidate.integrityScore;
  }

  const label = companyBlindRankingFallbackTabMeta[tab].metricLabel;

  return candidate.metrics.find((metric) => metric.label === label)?.score ?? 0;
}

function getCompanyBlindRankingFallbackTabSection(
  candidate: CompanyBlindRankingCandidate,
  tab: Exclude<CompanyBlindRankingDetailTab, 'overview'>,
): CompanyBlindRankingTabSection {
  const meta = companyBlindRankingFallbackTabMeta[tab];
  const score = getCompanyBlindRankingMetricScore(candidate, tab);
  const tone = score >= 85 ? '상위권' : score >= 75 ? '안정적인' : '추가 검토가 필요한';

  return {
    heading: '최종 평가',
    summary: `${candidate.anonymousId} 지원자는 ${meta.focusLabel} 관점에서 ${tone} 평가를 받았습니다. ${meta.summary}`,
    items: meta.items.map((item, index) => ({
      index: index + 1,
      title: item.title,
      score: `${Math.max(3.8, Math.min(4.9, (score - index) / 20)).toFixed(1)} / 5.0`,
      description: item.description,
    })),
  };
}

function getCompanyBlindRankingCandidateDetail(candidate: CompanyBlindRankingCandidate): CompanyBlindRankingCandidateDetail {
  const strongestMetric = [...candidate.metrics].sort((leftMetric, rightMetric) => rightMetric.score - leftMetric.score)[0];
  const weakestMetric = [...candidate.metrics].sort((leftMetric, rightMetric) => leftMetric.score - rightMetric.score)[0];
  const strengthLabel = strongestMetric?.label ?? '핵심 평가';
  const weaknessLabel = weakestMetric?.label ?? '보완 항목';
  const integrityTone =
    candidate.integrityScore >= 90 ? '무결성 신호도 안정적입니다.' : '무결성 관련 추가 확인이 권장됩니다.';
  const scoreTone =
    candidate.overallScore >= 85 ? '상위권 성과를 보였습니다.' : candidate.overallScore >= 75 ? '전반적으로 안정적인 평가를 받았습니다.' : '추가 검토가 필요한 구간이 있습니다.';

  return {
    confidenceSummary: candidate.humanVerified
      ? '평가 신뢰도 높음 · 인간 인증 완료 지원자'
      : '평가 신뢰도 보통 · 추가 인증 확인 필요',
    rating: `★★★★☆ ${(candidate.overallScore / 20 + 0.1).toFixed(1)}`,
    recommendation: candidate.overallScore >= 85 ? '강력 추천' : candidate.overallScore >= 78 ? '추천' : '보류 검토',
    overviewSummaryTitle: '종합 평가 요약',
    overviewSummary: `${candidate.anonymousId} 지원자는 ${scoreTone} 가장 강한 영역은 ${strengthLabel}이며, ${weaknessLabel} 항목은 후속 확인이 필요합니다. ${integrityTone}`,
    tabSections: {},
  };
}

const companyCreateSteps: readonly CompanyCreateStep[] = [
  { step: 1, title: '기본 설정', active: true },
  { step: 2, title: '과정 구성' },
  { step: 3, title: '에이전트 선택' },
  { step: 4, title: '공고 생성' },
] as const;

const companyCreateSessionTypes = [
  {
    key: 'recruiting',
    emoji: '👔',
    title: '채용',
    description: '인재 채용 평가',
  },
  {
    key: 'contest',
    emoji: '🎨',
    title: '공모전',
    description: '창작물 심사',
  },
  {
    key: 'audition',
    emoji: '🎬',
    title: '오디션',
    description: '실기 평가',
  },
  {
    key: 'education',
    emoji: '📚',
    title: '교육',
    description: '과정 평가',
  },
] as const satisfies readonly {
  key: CompanySessionType;
  emoji: string;
  title: string;
  description: string;
}[];

const companyCreatePublicScopeOptions = ['공개', '초대 링크 전용'] as const;

const worldIdQrFilledCells = [
  0, 1, 2, 4, 6, 7, 8,
  11, 12, 13, 17, 22, 24, 28, 29,
  33, 34, 35, 39, 40, 44, 46, 47, 48,
  50, 52, 53, 54, 55, 57, 59, 61, 63,
  66, 67, 68, 72, 73, 77, 79, 80, 81,
  83, 85, 86, 87, 88, 90, 94, 95,
  99, 100, 101, 105, 107, 108,
  110, 112, 113, 114, 116, 118, 119, 120,
];

function WorldIdQrCode() {
  return (
    <div className="world-id-qr" aria-hidden="true">
      <div className="world-id-qr__finder world-id-qr__finder--top-left" />
      <div className="world-id-qr__finder world-id-qr__finder--top-right" />
      <div className="world-id-qr__finder world-id-qr__finder--bottom-left" />
      <div className="world-id-qr__grid">
        {Array.from({ length: 121 }, (_, index) => (
          <span
            key={index}
            className={`world-id-qr__cell${worldIdQrFilledCells.includes(index) ? ' world-id-qr__cell--filled' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

function WorldLogo({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className={`world-logo${inverted ? ' world-logo--inverted' : ''}`} aria-label="WorldFit">
      <span className="world-logo__text">WorldFit</span>
    </div>
  );
}

function WorldLogoMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span
      className={`world-logo-mark${inverted ? ' world-logo-mark--inverted' : ''}`}
      aria-hidden="true"
    >
      <img
        className="world-logo-mark__image"
        src="/world-id-mark.png"
        alt=""
      />
    </span>
  );
}

function getProfileBadge(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : 'W';
}

function getCompanyFraudSeverityLabel(severity: CompanyFraudSeverity) {
  if (severity === 'high') {
    return '높음';
  }

  if (severity === 'medium') {
    return '중간';
  }

  return '낮음';
}

function buildEmptyCompanyPortalBootstrap(
  companyUser: CompanySessionUser | null,
): CompanyPortalBootstrap {
  return {
    dashboard: {
      summaryCards: [
        { label: '활성 공고', value: '0', detail: '총 0개 공고 중 진행 중' },
        { label: '총 지원자', value: '0', detail: '0개 공고 기준' },
        { label: '크레딧 소진', value: '$0', detail: '평균 공고당 $0' },
        { label: '크레딧', value: '$0', detail: '' },
      ],
      sessions: [],
      alerts: [],
      wldUsage: [],
      pendingFraudCount: 0,
    },
    jobs: {
      statusFilters: [
        { label: '전체 0', active: true },
        { label: '대기 0' },
        { label: '진행 0' },
        { label: '종료 0' },
      ],
      items: [],
    },
    blind: {
      cards: [],
    },
    fraud: {
      filters: [
        { key: 'pending', label: '대기 0' },
        { key: 'investigating', label: '조사중 0' },
        { key: 'resolved', label: '처리됨 0' },
        { key: 'dismissed', label: '기각 0' },
      ],
      cases: [],
    },
    credit: {
      balanceUsd: 0,
      monthlyUsageUsd: 0,
      walletAddress: '',
      exchangeRate: 0,
      miniAppPaymentsEnabled: false,
      webDepositEnabled: false,
      minRechargeUsd: 0,
      maxRechargeUsd: 0,
      miniAppPaymentOptions: [],
      webDepositOptions: [],
      history: [],
    },
    agentCatalog: [],
    settings: {
      companyName: companyUser?.companyName ?? '',
      companyEmail: companyUser?.companyEmail ?? '',
      contact: '',
      language: '',
      verificationForm: initialCompanyVerificationForm,
    },
  };
}

function buildEmptyCompanyReport(job: CompanyJobListing | null): CompanyJobReportResponse | null {
  if (!job) {
    return null;
  }

  return {
    job,
    summary: {
      badge: `${job.type} · 평가 완료`,
      title: job.title,
      description: '아직 평가 데이터가 없습니다.',
    },
    histogram: [],
    topCandidates: [],
    agentScores: [],
    improvements: [],
  };
}

function isAdminPath() {
  return window.location.pathname === '/admin';
}

function getInitialScreen(): Screen {
  return isAdminPath() ? 'admin' : 'landing';
}

function App() {
  const { isInstalled: isMiniKitInstalled } = useMiniKit();
  const [screen, setScreen] = useState<Screen>(() => getInitialScreen());
  const [companyDashboardView, setCompanyDashboardView] = useState<CompanyDashboardView>('home');
  const [companyCreateStep, setCompanyCreateStep] = useState<CompanyCreateStage>(1);
  const [companyPortalData, setCompanyPortalData] = useState<CompanyPortalBootstrap | null>(null);
  const [selectedCompanyReport, setSelectedCompanyReport] = useState<CompanyJobReportResponse | null>(null);
  const [isCompanyPortalLoading, setIsCompanyPortalLoading] = useState(false);
  const [companyPortalError, setCompanyPortalError] = useState<string | null>(null);
  const [selectedCompanyJob, setSelectedCompanyJob] = useState<CompanyJobListing | null>(null);
  const [selectedCompanyBlindCard, setSelectedCompanyBlindCard] =
    useState<CompanyBlindSelectionCard | null>(null);
  const [companyBlindRankingRows, setCompanyBlindRankingRows] =
    useState<CompanyBlindRankingCandidate[]>([]);
  const [companyBlindRankingHumanFilter, setCompanyBlindRankingHumanFilter] =
    useState<CompanyBlindRankingHumanFilter>('all');
  const [companyBlindRankingSortOrder, setCompanyBlindRankingSortOrder] =
    useState<CompanyBlindRankingSortOrder>('desc');
  const [isCompanyBlindRankingMinimumScoreEnabled, setIsCompanyBlindRankingMinimumScoreEnabled] =
    useState(true);
  const [isCompanyBlindRankingNotifyModalOpen, setIsCompanyBlindRankingNotifyModalOpen] = useState(false);
  const [selectedCompanyBlindRankingCandidateId, setSelectedCompanyBlindRankingCandidateId] = useState<string | null>(null);
  const [companyBlindRankingDetailTab, setCompanyBlindRankingDetailTab] =
    useState<CompanyBlindRankingDetailTab>('overview');
  const [companyFraudFilter, setCompanyFraudFilter] = useState<CompanyFraudCaseStatus>('pending');
  const [selectedCompanyFraudCaseId, setSelectedCompanyFraudCaseId] = useState<string | null>(null);
  const [companyJobSearch, setCompanyJobSearch] = useState('');
  const [companyJobTypeFilter, setCompanyJobTypeFilter] = useState<CompanyJobTypeFilter>('all');
  const [companyJobStatusFilter, setCompanyJobStatusFilter] = useState<CompanyJobStatusFilterKey>('all');
  const [companyBlindSelectionSearch, setCompanyBlindSelectionSearch] = useState('');
  const [companyBlindSelectionTypeFilter, setCompanyBlindSelectionTypeFilter] =
    useState<(typeof companyBlindSelectionTypeFilters)[number]['key']>('all');
  const [companyBlindSelectionStatusFilter, setCompanyBlindSelectionStatusFilter] =
    useState<(typeof companyBlindSelectionStatusFilters)[number]['key']>('all');
  const [companySettingsPreferences, setCompanySettingsPreferences] =
    useState<Pick<CompanySettingsForm, 'contact' | 'language'>>(defaultCompanySettingsPreferences);
  const [savedCompanyVerificationForm, setSavedCompanyVerificationForm] =
    useState<CompanyVerificationForm>(initialCompanyVerificationForm);
  const [companySettingsForm, setCompanySettingsForm] =
    useState<CompanySettingsForm>(getInitialCompanySettingsForm(null, defaultCompanySettingsPreferences));
  const [companyVerificationForm, setCompanyVerificationForm] =
    useState<CompanyVerificationForm>(initialCompanyVerificationForm);
  const [companySettingsToastId, setCompanySettingsToastId] = useState(0);
  const [companySettingsToastMessage, setCompanySettingsToastMessage] = useState<string | null>(null);
  const [companyCreditCurrency, setCompanyCreditCurrency] = useState<CompanyCreditCurrency>('WLD');
  const [companyCreditRechargeAmount, setCompanyCreditRechargeAmount] = useState('100');
  const [companyCreditActiveCharge, setCompanyCreditActiveCharge] = useState<CompanyCreditCharge | null>(null);
  const [companyCreditQuote, setCompanyCreditQuote] = useState<CompanyCreditQuote | null>(null);
  const [companyCreditQuoteCache, setCompanyCreditQuoteCache] = useState<Record<string, CompanyCreditQuote>>({});
  const [isCompanyCreditSubmitting, setIsCompanyCreditSubmitting] = useState(false);
  const [isCompanyCreditStatusRefreshing, setIsCompanyCreditStatusRefreshing] = useState(false);
  const [isCompanyCreditQuoteLoading, setIsCompanyCreditQuoteLoading] = useState(false);
  const [isCompanyVerificationCountryDropdownOpen, setIsCompanyVerificationCountryDropdownOpen] = useState(false);
  const [isCompanyLanguageDropdownOpen, setIsCompanyLanguageDropdownOpen] = useState(false);
  const [companyCreateSessionType, setCompanyCreateSessionType] = useState<CompanySessionType>('recruiting');
  const [companyCreateForm, setCompanyCreateForm] = useState<CompanyCreateForm>(initialCompanyCreateForm);
  const [companyCreateFormErrors, setCompanyCreateFormErrors] = useState<CompanyCreateFormErrors>({});
  const [isCompanyCreateEligibleCountryDropdownOpen, setIsCompanyCreateEligibleCountryDropdownOpen] = useState(false);
  const [companyCreateEligibleCountrySearch, setCompanyCreateEligibleCountrySearch] = useState('');
  const [companyCreateProcesses, setCompanyCreateProcesses] = useState<CompanyCreateProcess[]>(initialCompanyCreateProcesses);
  const [companyCreateProcessErrors, setCompanyCreateProcessErrors] =
    useState<Record<number, CompanyCreateProcessErrors>>({});
  const [companyCreateAgents, setCompanyCreateAgents] = useState<CompanyCreateAgent[]>([]);
  const [companyCreateAgentWeightInputs, setCompanyCreateAgentWeightInputs] = useState<Record<string, string>>({});
  const [companyCreateEvaluationCriteria, setCompanyCreateEvaluationCriteria] =
    useState<CompanyEvaluationCriteria>(initialCompanyCreateEvaluationCriteria);
  const [companyCreateExpectedApplicants, setCompanyCreateExpectedApplicants] = useState('50');
  const [selectedCompanyCreateAgentId, setSelectedCompanyCreateAgentId] = useState<string | null>(null);
  const [companyCreateAgentDetailTab, setCompanyCreateAgentDetailTab] =
    useState<CompanyCreateAgentDetailTab>('criteria');
  const [openCompanyCreateSubmissionDropdownId, setOpenCompanyCreateSubmissionDropdownId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>('candidate');
  const [modalStep, setModalStep] = useState<ModalStep>('role');
  const [candidateForm, setCandidateForm] =
    useState<CandidateSignupForm>(initialCandidateForm);
  const [candidateErrors, setCandidateErrors] = useState<
    Partial<Record<keyof CandidateSignupForm, string>>
  >({});
  const [candidateSubmitted, setCandidateSubmitted] = useState(false);
  const [candidateVerificationSent, setCandidateVerificationSent] = useState(false);
  const [candidateVerificationConfirmed, setCandidateVerificationConfirmed] = useState(false);
  const [candidateVerificationSecondsLeft, setCandidateVerificationSecondsLeft] = useState(0);
  const [candidateVerificationCodeExpiresSecondsLeft, setCandidateVerificationCodeExpiresSecondsLeft] = useState(0);
  const [candidateWorldIdOpen, setCandidateWorldIdOpen] = useState(false);
  const [candidateWorldIdVerified, setCandidateWorldIdVerified] = useState(false);
  const [candidateWorldIdError, setCandidateWorldIdError] = useState<string | null>(null);
  const [candidateWorldIdConflictMessage, setCandidateWorldIdConflictMessage] = useState<string | null>(null);
  const [candidateWorldIdConfig, setCandidateWorldIdConfig] = useState<WorldIdConfig | null>(null);
  const [candidateWorldIdRequest, setCandidateWorldIdRequest] = useState<WorldIdRpSignature | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanySignupForm>(initialCompanyForm);
  const [companyErrors, setCompanyErrors] = useState<
    Partial<Record<keyof CompanySignupForm, string>>
  >({});
  const [companyLoginOpen, setCompanyLoginOpen] = useState(false);
  const [companyLoginStep, setCompanyLoginStep] = useState<LoginModalStep>('role');
  const [loginRole, setLoginRole] = useState<Role>('candidate');
  const [companyLoginForm, setCompanyLoginForm] =
    useState<CompanyLoginForm>(initialCompanyLoginForm);
  const [candidateLoginForm, setCandidateLoginForm] =
    useState<CandidateLoginForm>(initialCandidateLoginForm);
  const [candidateAuthMode, setCandidateAuthMode] = useState<'signup' | 'login'>('signup');
  const [candidateLoginMethod, setCandidateLoginMethod] = useState<CandidateLoginMethod>('worldId');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const [verificationSecondsLeft, setVerificationSecondsLeft] = useState(0);
  const [verificationCodeExpiresSecondsLeft, setVerificationCodeExpiresSecondsLeft] = useState(0);
  const [companySubmitError, setCompanySubmitError] = useState<string | null>(null);
  const [companyLoginError, setCompanyLoginError] = useState<string | null>(null);
  const [companyLoginNotice, setCompanyLoginNotice] = useState<string | null>(null);
  const [candidateLoginError, setCandidateLoginError] = useState<string | null>(null);
  const [candidateLoginNotice, setCandidateLoginNotice] = useState<string | null>(null);
  const [candidateLoginSent, setCandidateLoginSent] = useState(false);
  const [candidateLoginSecondsLeft, setCandidateLoginSecondsLeft] = useState(0);
  const [candidateLoginCodeExpiresSecondsLeft, setCandidateLoginCodeExpiresSecondsLeft] = useState(0);
  const [candidateLoginWorldIdOpen, setCandidateLoginWorldIdOpen] = useState(false);
  const [candidateLoginWorldIdRequest, setCandidateLoginWorldIdRequest] =
    useState<WorldIdRpSignature | null>(null);
  const [candidateLoginWorldIdError, setCandidateLoginWorldIdError] = useState<string | null>(null);
  const [isCompanyAccountLocked, setIsCompanyAccountLocked] = useState(false);
  const [companyUnlockCode, setCompanyUnlockCode] = useState('');
  const [companyUnlockSent, setCompanyUnlockSent] = useState(false);
  const [companyUnlockSecondsLeft, setCompanyUnlockSecondsLeft] = useState(0);
  const [companyUnlockCodeExpiresSecondsLeft, setCompanyUnlockCodeExpiresSecondsLeft] = useState(0);
  const [authAdminUser, setAuthAdminUser] = useState<AdminSessionUser | null>(null);
  const [authCompanyUser, setAuthCompanyUser] = useState<CompanySessionUser | null>(null);
  const [authCandidateUser, setAuthCandidateUser] = useState<CandidateSessionUser | null>(null);
  const [authBootstrapComplete, setAuthBootstrapComplete] = useState(false);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboard | null>(null);
  const [adminLoginForm, setAdminLoginForm] = useState<AdminLoginForm>({
    username: 'admin',
    password: 'admin',
  });
  const [adminPasswordForm, setAdminPasswordForm] = useState<AdminPasswordForm>({
    currentPassword: '',
    nextPassword: '',
    confirmNextPassword: '',
  });
  const [adminNotice, setAdminNotice] = useState<string | null>(null);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);
  const [isAdminDashboardLoading, setIsAdminDashboardLoading] = useState(false);
  const [isAdminPasswordSaving, setIsAdminPasswordSaving] = useState(false);
  const [candidateSubmitError, setCandidateSubmitError] = useState<string | null>(null);
  const [isCompanySubmitting, setIsCompanySubmitting] = useState(false);
  const [isCompanyLoggingIn, setIsCompanyLoggingIn] = useState(false);
  const [isSendingCandidateLogin, setIsSendingCandidateLogin] = useState(false);
  const [isCandidateLoggingIn, setIsCandidateLoggingIn] = useState(false);
  const [isPreparingCandidateLoginWorldId, setIsPreparingCandidateLoginWorldId] = useState(false);
  const [isVerifyingCandidateLoginWorldId, setIsVerifyingCandidateLoginWorldId] = useState(false);
  const [isCandidateSubmitting, setIsCandidateSubmitting] = useState(false);
  const [isSendingCandidateVerification, setIsSendingCandidateVerification] = useState(false);
  const [isCheckingCandidateVerification, setIsCheckingCandidateVerification] = useState(false);
  const [isPreparingCandidateWorldId, setIsPreparingCandidateWorldId] = useState(false);
  const [isVerifyingCandidateWorldId, setIsVerifyingCandidateWorldId] = useState(false);
  const [isSendingCompanyVerification, setIsSendingCompanyVerification] = useState(false);
  const [isCheckingCompanyVerification, setIsCheckingCompanyVerification] = useState(false);
  const [isSendingCompanyUnlock, setIsSendingCompanyUnlock] = useState(false);
  const [isVerifyingCompanyUnlock, setIsVerifyingCompanyUnlock] = useState(false);

  useEffect(() => {
    document.body.style.overflow =
      isModalOpen || companyLoginOpen || selectedCompanyCreateAgentId || isCompanyBlindRankingNotifyModalOpen
        ? 'hidden'
        : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [companyLoginOpen, isCompanyBlindRankingNotifyModalOpen, isModalOpen, selectedCompanyCreateAgentId]);

  useEffect(() => {
    const isCompanyDashboardScreen = screen === 'companyTemp' && Boolean(authCompanyUser);

    document.documentElement.classList.toggle('app-html--company-dashboard', isCompanyDashboardScreen);
    document.body.classList.toggle('app-body--company-dashboard', isCompanyDashboardScreen);

    return () => {
      document.documentElement.classList.remove('app-html--company-dashboard');
      document.body.classList.remove('app-body--company-dashboard');
    };
  }, [authCompanyUser, screen]);

  useEffect(() => {
    setCompanySettingsForm(getInitialCompanySettingsForm(authCompanyUser, companySettingsPreferences));
    setIsCompanyLanguageDropdownOpen(false);
  }, [authCompanyUser, companySettingsPreferences]);

  useEffect(() => {
    if (companySettingsToastId === 0 || !companySettingsToastMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCompanySettingsToastMessage(null);
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [companySettingsToastId, companySettingsToastMessage]);

  useEffect(() => {
    const paymentOptions = [
      ...(companyPortalData?.credit.webDepositOptions ?? []),
      ...(companyPortalData?.credit.miniAppPaymentOptions ?? []),
    ];

    if (paymentOptions.length === 0) {
      return;
    }

    if (!paymentOptions.some((option) => option.key === companyCreditCurrency)) {
      setCompanyCreditCurrency(paymentOptions[0].key);
    }
  }, [companyPortalData?.credit.webDepositOptions, companyPortalData?.credit.miniAppPaymentOptions, companyCreditCurrency]);

  useEffect(() => {
    if (!authCompanyUser || !companyCreditActiveCharge) {
      return;
    }

    const shouldPollCharge =
      (companyCreditActiveCharge.paymentChannel === 'mini_app' &&
        companyCreditActiveCharge.status === 'pending') ||
      (companyCreditActiveCharge.paymentChannel === 'web_deposit' &&
        (companyCreditActiveCharge.status === 'ready' || companyCreditActiveCharge.status === 'pending'));

    if (!shouldPollCharge) {
      return;
    }

    let isMounted = true;

    const timer = window.setTimeout(() => {
      setIsCompanyCreditStatusRefreshing(true);

      fetchCompanyCreditCharge(companyCreditActiveCharge.id)
        .then(async (response) => {
          if (!isMounted) {
            return;
          }

          setCompanyCreditActiveCharge(response.charge);

          if (response.charge.status === 'confirmed') {
            const nextPortal = await fetchCompanyPortalBootstrap();

            if (!isMounted) {
              return;
            }

            setCompanyPortalData(nextPortal);
            setCompanySettingsToastMessage(response.message);
            setCompanySettingsToastId((current) => current + 1);
          } else if (response.charge.status === 'failed' || response.charge.status === 'expired') {
            setCompanySettingsToastMessage(response.message);
            setCompanySettingsToastId((current) => current + 1);
          }
        })
        .catch((error) => {
          if (!isMounted) {
            return;
          }

          setCompanySettingsToastMessage(
            error instanceof Error ? error.message : '충전 상태를 확인하는 중 오류가 발생했습니다.',
          );
          setCompanySettingsToastId((current) => current + 1);
        })
        .finally(() => {
          if (isMounted) {
            setIsCompanyCreditStatusRefreshing(false);
          }
        });
    }, 4000);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [authCompanyUser, companyCreditActiveCharge]);

  useEffect(() => {
    if (!authCompanyUser || !companyPortalData?.credit) {
      setCompanyCreditQuote(null);
      return;
    }

    const requestedCreditUsd = Number(companyCreditRechargeAmount.replace(/,/g, '')) || 0;
    const shouldUseMiniAppPayment =
      Boolean(isMiniKitInstalled) && Boolean(companyPortalData.credit.miniAppPaymentsEnabled);
    const paymentChannel = shouldUseMiniAppPayment ? 'mini_app' : 'web_deposit';
    const paymentOptions = shouldUseMiniAppPayment
      ? companyPortalData.credit.miniAppPaymentOptions
      : companyPortalData.credit.webDepositOptions;
    const selectedPaymentOption =
      paymentOptions.find((option) => option.key === companyCreditCurrency) ?? paymentOptions[0] ?? null;

    if (!selectedPaymentOption || requestedCreditUsd <= 0) {
      setCompanyCreditQuote(null);
      setIsCompanyCreditQuoteLoading(false);
      return;
    }

    let isMounted = true;

    const timer = window.setTimeout(() => {
      setIsCompanyCreditQuoteLoading(true);

      fetchCompanyCreditQuote({
        creditUsd: requestedCreditUsd,
        paymentTokenKey: selectedPaymentOption.key,
        paymentChannel,
      })
        .then((response) => {
          if (isMounted) {
            setCompanyCreditQuote(response.quote);
            setCompanyCreditQuoteCache((current) => ({
              ...current,
              [`${response.quote.paymentChannel}:${response.quote.paymentTokenKey}`]: response.quote,
            }));
          }
        })
        .catch(() => {
          if (isMounted) {
            setCompanyCreditQuote(null);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsCompanyCreditQuoteLoading(false);
          }
        });
    }, 250);

    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [
    authCompanyUser,
    companyPortalData?.credit,
    companyCreditCurrency,
    companyCreditRechargeAmount,
    isMiniKitInstalled,
  ]);

  const pushCompanyToast = (message: string) => {
    setCompanySettingsToastMessage(message);
    setCompanySettingsToastId((current) => current + 1);
  };

  useEffect(() => {
    if (!selectedCompanyCreateAgentId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedCompanyCreateAgentId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCompanyCreateAgentId]);

  useEffect(() => {
    if (verificationSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setVerificationSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [verificationSent, verificationSecondsLeft]);

  useEffect(() => {
    if (verificationCodeExpiresSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setVerificationCodeExpiresSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [verificationCodeExpiresSecondsLeft]);

  useEffect(() => {
    if (candidateVerificationSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCandidateVerificationSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [candidateVerificationSecondsLeft]);

  useEffect(() => {
    if (candidateVerificationCodeExpiresSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCandidateVerificationCodeExpiresSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [candidateVerificationCodeExpiresSecondsLeft]);

  useEffect(() => {
    if (candidateLoginSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCandidateLoginSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [candidateLoginSecondsLeft]);

  useEffect(() => {
    if (candidateLoginCodeExpiresSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCandidateLoginCodeExpiresSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [candidateLoginCodeExpiresSecondsLeft]);

  useEffect(() => {
    if (companyUnlockSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCompanyUnlockSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [companyUnlockSecondsLeft]);

  useEffect(() => {
    if (companyUnlockCodeExpiresSecondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCompanyUnlockCodeExpiresSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [companyUnlockCodeExpiresSecondsLeft]);

  useEffect(() => {
    let isMounted = true;

    fetchCurrentSessionUser()
      .then(({ companyUser, candidateUser, adminUser }) => {
        if (!isMounted) {
          return;
        }

        if (isAdminPath()) {
          if (adminUser) {
            setAuthAdminUser(adminUser);
            setAuthCompanyUser(null);
            setAuthCandidateUser(null);
            setScreen('admin');
            return;
          }

          setAuthAdminUser(null);
          setAuthCompanyUser(null);
          setAuthCandidateUser(null);
          setScreen('admin');
          return;
        }

        if (companyUser) {
          setAuthCompanyUser(companyUser);
          setAuthCandidateUser(null);
          setAuthAdminUser(null);
          setCompanyDashboardView('home');
          setScreen('companyTemp');
          return;
        }

        if (candidateUser) {
          setAuthCandidateUser(candidateUser);
          setAuthCompanyUser(null);
          setAuthAdminUser(null);
          setCandidateAuthMode('login');
          setScreen('candidateTemp');
          return;
        }

        setAuthAdminUser(null);
        setAuthCompanyUser(null);
        setAuthCandidateUser(null);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        if (isAdminPath()) {
          setScreen('admin');
        }

        setAuthAdminUser(null);
        setAuthCompanyUser(null);
        setAuthCandidateUser(null);
      })
      .finally(() => {
        if (isMounted) {
          setAuthBootstrapComplete(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (screen !== 'admin' || !authAdminUser) {
      return;
    }

    let isMounted = true;
    setIsAdminDashboardLoading(true);

    fetchAdminDashboard()
      .then((dashboard) => {
        if (isMounted) {
          setAdminDashboard(dashboard);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setAdminNotice(error instanceof Error ? error.message : '관리자 데이터를 불러오는 중 오류가 발생했습니다.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAdminDashboardLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authAdminUser, screen]);

  useEffect(() => {
    setCompanyCreateAgentWeightInputs(createCompanyCreateAgentWeightInputs(companyCreateAgents));
  }, [companyCreateAgents]);

  useEffect(() => {
    let isMounted = true;

    fetchWorldIdConfig()
      .then((config) => {
        if (isMounted) {
          setCandidateWorldIdConfig(config);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCandidateWorldIdConfig({
            enabled: false,
            appId: null,
            action: 'candidate-signup',
            environment: 'staging',
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!authCompanyUser) {
      setCompanyPortalData(null);
      setSelectedCompanyReport(null);
      setCompanyPortalError(null);
      setIsCompanyPortalLoading(false);
      setCompanyCreateAgents([]);
      return () => {
        isMounted = false;
      };
    }

    setIsCompanyPortalLoading(true);
    setCompanyPortalError(null);

    fetchCompanyPortalBootstrap()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        const nextLanguage = data.settings.language || defaultCompanySettingsPreferences.language;
        setCompanyPortalData(data);
        setCompanyCreateAgents(cloneCompanyCreateAgents(data.agentCatalog));
        setSelectedCompanyJob((current) => data.jobs.items.find((item) => item.id === current?.id) ?? data.jobs.items[0] ?? null);
        setSelectedCompanyBlindCard((current) => data.blind.cards.find((item) => item.id === current?.id) ?? data.blind.cards[0] ?? null);
        setSelectedCompanyFraudCaseId((current) =>
          data.fraud.cases.find((item) => item.id === current)?.id ??
          data.fraud.cases.find((item) => item.status === companyFraudFilter)?.id ??
          data.fraud.cases[0]?.id ??
          null,
        );
        setCompanySettingsPreferences({
          contact: data.settings.contact,
          language: nextLanguage,
        });
        setSavedCompanyVerificationForm(data.settings.verificationForm);
        setCompanySettingsForm({
          companyName: data.settings.companyName,
          companyEmail: data.settings.companyEmail,
          contact: data.settings.contact,
          language: normalizeCompanySettingsLanguage(nextLanguage),
        });
        setCompanyVerificationForm(data.settings.verificationForm);
        setAuthCompanyUser((current) =>
          current
            ? current.companyName === data.settings.companyName &&
              current.companyEmail === data.settings.companyEmail
              ? current
              : {
                  ...current,
                  companyName: data.settings.companyName,
                  companyEmail: data.settings.companyEmail,
                }
            : current,
        );
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setCompanyPortalError(
          error instanceof Error ? error.message : '기업 포털 데이터를 불러오지 못했습니다.',
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsCompanyPortalLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authCompanyUser?.id]);

  const modalActionLabel =
    selectedRole === 'candidate' ? '개인으로 회원가입' : '기업 / 주최자로 회원가입';
  const loginActionLabel = '로그인';
  const loginEmailLabel = loginRole === 'candidate' ? '이메일' : '기업 이메일';
  const candidateSignupTitle = '지원자 회원가입';
  const candidateSignupDescription =
    'World ID 기반 본인 확인 후 평가 세션에 참여할 수 있는 계정을 생성합니다.';

  const resetModal = () => {
    setSelectedRole('candidate');
    setModalStep('role');
    setCandidateForm(initialCandidateForm);
    setCandidateErrors({});
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetModal();
  };

  const openSignupFlow = () => {
    setScreen('landing');
    setIsModalOpen(true);
    setModalStep('role');
    setCandidateErrors({});
  };

  const openCompanySignupScreen = () => {
    setScreen('companySignup');
    setIsModalOpen(false);
    resetModal();
    setCompanyForm(initialCompanyForm);
    setCompanyErrors({});
    setCompanyLoginOpen(false);
    setCompanyLoginStep('role');
    setLoginRole('candidate');
    setCompanyLoginForm(initialCompanyLoginForm);
    setVerificationSent(false);
    setVerificationConfirmed(false);
    setVerificationSecondsLeft(0);
    setVerificationCodeExpiresSecondsLeft(0);
    setCompanySubmitError(null);
    setCompanyLoginError(null);
    setCompanyLoginNotice(null);
    setIsCompanyAccountLocked(false);
    setCompanyUnlockCode('');
    setCompanyUnlockSent(false);
    setCompanyUnlockSecondsLeft(0);
    setCompanyUnlockCodeExpiresSecondsLeft(0);
  };

  const openCandidateSignupScreen = () => {
    setScreen('candidateSignup');
    setIsModalOpen(false);
    resetModal();
    setCandidateForm(initialCandidateForm);
    setCandidateErrors({});
    setCandidateSubmitted(false);
    setCandidateVerificationSent(false);
    setCandidateVerificationConfirmed(false);
    setCandidateVerificationSecondsLeft(0);
    setCandidateVerificationCodeExpiresSecondsLeft(0);
    setCandidateWorldIdOpen(false);
    setCandidateWorldIdVerified(false);
    setCandidateWorldIdError(null);
    setCandidateWorldIdConflictMessage(null);
    setCandidateWorldIdRequest(null);
    setCandidateSubmitError(null);
  };

  const handleCandidateChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const target = event.target;
    const { name } = target;
    const value =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value;

    setCandidateForm((current) => ({
      ...current,
      [name]: value,
    }));

    setCandidateErrors((current) => ({
      ...current,
      [name]: undefined,
    }));
    if (name === 'email') {
      setCandidateVerificationSent(false);
      setCandidateVerificationConfirmed(false);
      setCandidateVerificationSecondsLeft(0);
      setCandidateVerificationCodeExpiresSecondsLeft(0);
      setCandidateWorldIdVerified(false);
      setCandidateWorldIdOpen(false);
      setCandidateWorldIdRequest(null);
      setCandidateWorldIdError(null);
      setCandidateWorldIdConflictMessage(null);
    }
    if (name === 'name') {
      setCandidateWorldIdError(null);
    }
    setCandidateSubmitError(null);
  };

  const handleCompanyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const { name } = target;
    const value = target.type === 'checkbox' ? target.checked : target.value;

    setCompanyForm((current) => ({
      ...current,
      [name]: value,
    }));

    setCompanyErrors((current) => ({
      ...current,
      [name]: undefined,
    }));
    if (name === 'companyEmail') {
      setVerificationSent(false);
      setVerificationConfirmed(false);
      setVerificationSecondsLeft(0);
      setVerificationCodeExpiresSecondsLeft(0);
    }
    setCompanySubmitError(null);
  };

  const handleCompanyLoginChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setCompanyLoginForm((current) => ({
      ...current,
      [name]: value,
    }));
    setCompanyLoginError(null);
    setCompanyLoginNotice(null);
    if (name === 'email') {
      setIsCompanyAccountLocked(false);
      setCompanyUnlockCode('');
      setCompanyUnlockSent(false);
      setCompanyUnlockSecondsLeft(0);
      setCompanyUnlockCodeExpiresSecondsLeft(0);
    }
  };

  const handleCandidateLoginChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setCandidateLoginForm((current) => ({
      ...current,
      [name]: value,
    }));
    setCandidateLoginError(null);
    setCandidateLoginNotice(null);

    if (name === 'email') {
      setCandidateLoginSent(false);
      setCandidateLoginSecondsLeft(0);
      setCandidateLoginCodeExpiresSecondsLeft(0);
      setCandidateLoginWorldIdError(null);
      setCandidateLoginForm((current) => ({
        ...current,
        verificationCode: '',
      }));
    }
  };

  const handleCandidateLoginMethodChange = (method: CandidateLoginMethod) => {
    setCandidateLoginMethod(method);
    setCandidateLoginError(null);
    setCandidateLoginNotice(null);
    setCandidateLoginWorldIdError(null);
  };

  const validateCandidateForm = () => {
    const nextErrors: Partial<Record<keyof CandidateSignupForm, string>> = {};

    if (!candidateForm.name.trim()) {
      nextErrors.name = '이름을 입력해주세요.';
    }

    if (!candidateForm.email.trim()) {
      nextErrors.email = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateForm.email)) {
      nextErrors.email = '올바른 이메일 형식을 입력해주세요.';
    }

    if (!candidateForm.termsAgreed) {
      nextErrors.termsAgreed = '이용약관 및 개인정보처리방침 동의가 필요합니다.';
    }

    if (!candidateVerificationConfirmed) {
      nextErrors.verificationCode = '이메일 인증을 완료해주세요.';
    }

    setCandidateWorldIdError((current) => {
      if (!candidateVerificationConfirmed || candidateWorldIdVerified) {
        return null;
      }

      return candidateWorldIdConflictMessage ?? current ?? 'World ID 인증을 완료해주세요.';
    });

    setCandidateErrors(nextErrors);

    return Object.keys(nextErrors).length === 0 && candidateWorldIdVerified;
  };

  const handleCandidateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateCandidateForm()) {
      return;
    }

    try {
      setIsCandidateSubmitting(true);
      setCandidateSubmitError(null);

      const { candidateUser } = await signupCandidate({
        name: candidateForm.name.trim(),
        email: candidateForm.email.trim(),
        marketingConsent: candidateForm.marketingConsent,
        termsAgreed: candidateForm.termsAgreed,
      });

      setCandidateAuthMode('signup');
      setAuthCandidateUser(candidateUser);
      setAuthCompanyUser(null);
      setScreen('candidateTemp');
    } catch (error) {
      setCandidateSubmitError(
        error instanceof Error ? error.message : '회원가입 처리 중 오류가 발생했습니다.',
      );
    } finally {
      setIsCandidateSubmitting(false);
    }
  };

  const handleCandidateLoginSend = async () => {
    const email = candidateLoginForm.email.trim();

    if (!email) {
      setCandidateLoginError('이메일을 입력해주세요.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCandidateLoginError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    try {
      setIsSendingCandidateLogin(true);
      setCandidateLoginError(null);
      setCandidateLoginNotice(null);

      const response = await sendCandidateLoginCode({ email });

      setCandidateLoginSent(true);
      setCandidateLoginSecondsLeft(response.retryAfterSeconds ?? 60);
      setCandidateLoginCodeExpiresSecondsLeft(response.expiresInSeconds ?? 600);
      setCandidateLoginNotice('로그인 이메일 인증코드를 발송했습니다.');
    } catch (error) {
      if (error instanceof ApiError && typeof error.retryAfterSeconds === 'number') {
        setCandidateLoginSecondsLeft(error.retryAfterSeconds);
      }

      setCandidateLoginError(
        error instanceof Error ? error.message : '로그인 이메일 인증코드 발송 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSendingCandidateLogin(false);
    }
  };

  const handleCandidateLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = candidateLoginForm.email.trim();
    const verificationCode = candidateLoginForm.verificationCode.trim();

    if (!email) {
      setCandidateLoginError('이메일을 입력해주세요.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCandidateLoginError('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    if (!verificationCode) {
      setCandidateLoginError('로그인 이메일 인증코드를 입력해주세요.');
      return;
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      setCandidateLoginError('인증번호 6자리를 입력해주세요.');
      return;
    }

    try {
      setIsCandidateLoggingIn(true);
      setCandidateLoginError(null);
      setCandidateLoginNotice(null);

      const { candidateUser } = await loginCandidate({
        email,
        verificationCode,
      });

      setCandidateAuthMode('login');
      setAuthCandidateUser(candidateUser);
      setAuthCompanyUser(null);
      setCandidateLoginSent(false);
      setCandidateLoginSecondsLeft(0);
      setCandidateLoginCodeExpiresSecondsLeft(0);
      setCompanyLoginOpen(false);
      setCompanyLoginStep('role');
      setScreen('candidateTemp');
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'CANDIDATE_LOGIN_CODE_RESET' &&
        typeof error.retryAfterSeconds === 'number'
      ) {
        setCandidateLoginSent(false);
        setCandidateLoginSecondsLeft(error.retryAfterSeconds);
        setCandidateLoginCodeExpiresSecondsLeft(0);
        setCandidateLoginForm((current) => ({
          ...current,
          verificationCode: '',
        }));
      }

      setCandidateLoginError(error instanceof Error ? error.message : '로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCandidateLoggingIn(false);
    }
  };

  const handleCandidateLoginWorldIdStart = async () => {
    if (!candidateWorldIdConfig?.enabled) {
      setCandidateLoginWorldIdError(
        'World ID가 아직 설정되지 않았습니다. .env의 World ID 값을 먼저 채워주세요.',
      );
      return;
    }

    try {
      setIsPreparingCandidateLoginWorldId(true);
      setCandidateLoginWorldIdError(null);
      setCandidateLoginError(null);
      setCandidateLoginNotice(null);

      const response = await createCandidateLoginWorldIdRpSignature();

      setCandidateLoginWorldIdRequest(response);
      setCandidateLoginWorldIdOpen(true);
    } catch (error) {
      setCandidateLoginWorldIdError(
        error instanceof Error ? error.message : 'World ID 로그인 준비 중 오류가 발생했습니다.',
      );
    } finally {
      setIsPreparingCandidateLoginWorldId(false);
    }
  };

  const handleCandidateLoginWorldIdVerify = async (result: IDKitResult) => {
    try {
      setIsVerifyingCandidateLoginWorldId(true);
      setCandidateLoginWorldIdError(null);

      const { candidateUser } = await loginCandidateWithWorldId({
        idkitResponse: result,
      });

      setCandidateAuthMode('login');
      setAuthCandidateUser(candidateUser);
      setAuthCompanyUser(null);
    } catch (error) {
      setCandidateLoginWorldIdError(
        error instanceof Error ? error.message : 'World ID 로그인 처리 중 오류가 발생했습니다.',
      );
      throw error;
    } finally {
      setIsVerifyingCandidateLoginWorldId(false);
    }
  };

  const handleCandidateLoginWorldIdSuccess = () => {
    setCandidateLoginWorldIdOpen(false);
    setCompanyLoginOpen(false);
    setCompanyLoginStep('role');
    setCandidateAuthMode('login');
    setScreen('candidateTemp');
  };

  const handleCandidateLoginWorldIdError = (errorCode: IDKitErrorCodes) => {
    if (errorCode === IDKitErrorCodes.FailedByHostApp) {
      setCandidateLoginWorldIdOpen(false);
      return;
    }

    const nextMessage =
      errorCode === IDKitErrorCodes.Cancelled ||
      errorCode === IDKitErrorCodes.UserRejected ||
      errorCode === IDKitErrorCodes.VerificationRejected
        ? 'World ID 로그인이 취소되었습니다. 다시 시도해주세요.'
        : errorCode === IDKitErrorCodes.ConnectionFailed
          ? 'World ID 연결이 끊어졌습니다. 다시 시도해주세요.'
          : 'World ID 로그인을 완료하지 못했습니다. 다시 시도해주세요.';

    setCandidateLoginWorldIdError(nextMessage);
  };

  const handleCandidateVerificationSend = async () => {
    if (!candidateForm.email.trim()) {
      setCandidateErrors((current) => ({
        ...current,
        email: '이메일을 입력해주세요.',
      }));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateForm.email)) {
      setCandidateErrors((current) => ({
        ...current,
        email: '올바른 이메일 형식을 입력해주세요.',
      }));
      return;
    }

    try {
      setIsSendingCandidateVerification(true);
      setCandidateSubmitError(null);

      const response = await sendCandidateVerificationCode({
        email: candidateForm.email.trim(),
      });

      setCandidateErrors((current) => ({
        ...current,
        email: undefined,
        verificationCode: undefined,
      }));
      setCandidateVerificationSent(true);
      setCandidateVerificationConfirmed(false);
      setCandidateVerificationSecondsLeft(response.retryAfterSeconds ?? 60);
      setCandidateVerificationCodeExpiresSecondsLeft(response.expiresInSeconds ?? 600);
    } catch (error) {
      if (error instanceof ApiError && typeof error.retryAfterSeconds === 'number') {
        setCandidateVerificationSecondsLeft(error.retryAfterSeconds);
      }
      setCandidateSubmitError(
        error instanceof Error ? error.message : '인증코드 발송 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSendingCandidateVerification(false);
    }
  };

  const handleCandidateVerificationCheck = async () => {
    if (!candidateForm.verificationCode.trim()) {
      setCandidateErrors((current) => ({
        ...current,
        verificationCode: '인증번호를 입력해주세요.',
      }));
      return;
    }

    if (!/^\d{6}$/.test(candidateForm.verificationCode.trim())) {
      setCandidateErrors((current) => ({
        ...current,
        verificationCode: '인증번호 6자리를 입력해주세요.',
      }));
      return;
    }

    try {
      setIsCheckingCandidateVerification(true);
      setCandidateSubmitError(null);

      await verifyCandidateVerificationCode({
        email: candidateForm.email.trim(),
        verificationCode: candidateForm.verificationCode.trim(),
      });

      setCandidateErrors((current) => ({
        ...current,
        verificationCode: undefined,
      }));
      setCandidateVerificationConfirmed(true);
      setCandidateWorldIdError(null);
      setCandidateWorldIdConflictMessage(null);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'CANDIDATE_SIGNUP_CODE_RESET' &&
        typeof error.retryAfterSeconds === 'number'
      ) {
        setCandidateVerificationSent(false);
        setCandidateVerificationCodeExpiresSecondsLeft(0);
        setCandidateVerificationSecondsLeft(error.retryAfterSeconds);
        setCandidateForm((current) => ({
          ...current,
          verificationCode: '',
        }));
      }

      setCandidateErrors((current) => ({
        ...current,
        verificationCode:
          error instanceof Error ? error.message : '인증 확인 중 오류가 발생했습니다.',
      }));
      setCandidateVerificationConfirmed(false);
    } finally {
      setIsCheckingCandidateVerification(false);
    }
  };

  const handleCandidateWorldIdStart = async () => {
    if (!candidateVerificationConfirmed) {
      setCandidateWorldIdError('먼저 이메일 인증을 완료해주세요.');
      return;
    }

    if (!candidateWorldIdConfig?.enabled) {
      setCandidateWorldIdError(
        'World ID가 아직 설정되지 않았습니다. .env의 World ID 값을 먼저 채워주세요.',
      );
      return;
    }

    try {
      setIsPreparingCandidateWorldId(true);
      setCandidateWorldIdError(null);
      setCandidateWorldIdConflictMessage(null);

      const response = await createCandidateWorldIdRpSignature({
        email: candidateForm.email.trim(),
      });

      setCandidateWorldIdRequest(response);
      setCandidateWorldIdOpen(true);
    } catch (error) {
      setCandidateWorldIdError(
        error instanceof Error ? error.message : 'World ID 인증 준비 중 오류가 발생했습니다.',
      );
    } finally {
      setIsPreparingCandidateWorldId(false);
    }
  };

  const handleCandidateWorldIdVerify = async (result: IDKitResult) => {
    try {
      setIsVerifyingCandidateWorldId(true);
      setCandidateWorldIdError(null);
      setCandidateWorldIdConflictMessage(null);

      await verifyCandidateWorldId({
        email: candidateForm.email.trim(),
        idkitResponse: result,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setCandidateWorldIdConflictMessage(error.message);
      }

      setCandidateWorldIdError(
        error instanceof Error ? error.message : 'World ID 검증 중 오류가 발생했습니다.',
      );
      throw error;
    } finally {
      setIsVerifyingCandidateWorldId(false);
    }
  };

  const handleCandidateWorldIdSuccess = () => {
    setCandidateWorldIdVerified(true);
    setCandidateWorldIdError(null);
    setCandidateWorldIdConflictMessage(null);
    setCandidateWorldIdOpen(false);
  };

  const handleCandidateWorldIdError = (errorCode: IDKitErrorCodes) => {
    if (errorCode === IDKitErrorCodes.FailedByHostApp) {
      setCandidateWorldIdOpen(false);
      return;
    }

    const nextMessage =
      errorCode === IDKitErrorCodes.Cancelled ||
      errorCode === IDKitErrorCodes.UserRejected ||
      errorCode === IDKitErrorCodes.VerificationRejected
        ? 'World ID 인증이 취소되었습니다. 다시 시도해주세요.'
        : errorCode === IDKitErrorCodes.ConnectionFailed
          ? 'World ID 연결이 끊어졌습니다. 다시 시도해주세요.'
          : 'World ID 인증을 완료하지 못했습니다. 다시 시도해주세요.';

    setCandidateWorldIdError((current) => current ?? candidateWorldIdConflictMessage ?? nextMessage);
  };

  const validateCompanyEmail = () => {
    if (!companyForm.companyEmail.trim()) {
      setCompanyErrors((current) => ({
        ...current,
        companyEmail: '기업 이메일을 입력해주세요.',
      }));
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyForm.companyEmail)) {
      setCompanyErrors((current) => ({
        ...current,
        companyEmail: '올바른 이메일 형식을 입력해주세요.',
      }));
      return false;
    }

    setCompanyErrors((current) => ({
      ...current,
      companyEmail: undefined,
    }));
    return true;
  };

  const handleVerificationSend = async () => {
    if (!validateCompanyEmail()) {
      return;
    }

    try {
      setIsSendingCompanyVerification(true);
      setCompanySubmitError(null);

      const response = await sendCompanyVerificationCode({
        companyEmail: companyForm.companyEmail.trim(),
      });

      setVerificationSent(true);
      setVerificationConfirmed(false);
      setVerificationSecondsLeft(response.retryAfterSeconds ?? 60);
      setVerificationCodeExpiresSecondsLeft(response.expiresInSeconds ?? 600);
      setCompanyErrors((current) => ({
        ...current,
        verificationCode: undefined,
        password: undefined,
        confirmPassword: undefined,
      }));
    } catch (error) {
      if (error instanceof ApiError && typeof error.retryAfterSeconds === 'number') {
        setVerificationSecondsLeft(error.retryAfterSeconds);
      }
      setCompanySubmitError(
        error instanceof Error ? error.message : '인증코드 발송 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSendingCompanyVerification(false);
    }
  };

  const handleVerificationCheck = async () => {
    if (!companyForm.verificationCode.trim()) {
      setCompanyErrors((current) => ({
        ...current,
        verificationCode: '인증번호를 입력해주세요.',
      }));
      return;
    }

    if (!/^\d{6}$/.test(companyForm.verificationCode.trim())) {
      setCompanyErrors((current) => ({
        ...current,
        verificationCode: '인증번호 6자리를 입력해주세요.',
      }));
      return;
    }

    try {
      setIsCheckingCompanyVerification(true);
      setCompanySubmitError(null);

      await verifyCompanyVerificationCode({
        companyEmail: companyForm.companyEmail.trim(),
        verificationCode: companyForm.verificationCode.trim(),
      });

      setCompanyErrors((current) => ({
        ...current,
        verificationCode: undefined,
      }));
      setVerificationConfirmed(true);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'SIGNUP_CODE_RESET' &&
        typeof error.retryAfterSeconds === 'number'
      ) {
        setVerificationSent(false);
        setVerificationCodeExpiresSecondsLeft(0);
        setVerificationSecondsLeft(error.retryAfterSeconds);
        setCompanyForm((current) => ({
          ...current,
          verificationCode: '',
        }));
      }
      setCompanyErrors((current) => ({
        ...current,
        verificationCode:
          error instanceof Error ? error.message : '인증 확인 중 오류가 발생했습니다.',
      }));
      setVerificationConfirmed(false);
    } finally {
      setIsCheckingCompanyVerification(false);
    }
  };

  const validateCompanyForm = () => {
    const nextErrors: Partial<Record<keyof CompanySignupForm, string>> = {};

    if (!companyForm.companyName.trim()) {
      nextErrors.companyName = '기업명을 입력해주세요.';
    }

    if (!companyForm.companyEmail.trim()) {
      nextErrors.companyEmail = '기업 이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyForm.companyEmail)) {
      nextErrors.companyEmail = '올바른 이메일 형식을 입력해주세요.';
    }

    if (!companyForm.termsAgreed) {
      nextErrors.termsAgreed = '이용약관 동의가 필요합니다.';
    }

    if (!verificationConfirmed) {
      nextErrors.verificationCode = '이메일 인증을 완료해주세요.';
    }

    if (verificationConfirmed) {
      if (!companyForm.password.trim()) {
        nextErrors.password = '비밀번호를 입력해주세요.';
      } else if (companyForm.password.length < 8) {
        nextErrors.password = '비밀번호는 8자 이상이어야 합니다.';
      }

      if (!companyForm.confirmPassword.trim()) {
        nextErrors.confirmPassword = '비밀번호 재확인을 입력해주세요.';
      } else if (companyForm.confirmPassword !== companyForm.password) {
        nextErrors.confirmPassword = '비밀번호가 일치하지 않습니다.';
      }
    }

    setCompanyErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleCompanySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateCompanyForm()) {
      return;
    }

    try {
      setIsCompanySubmitting(true);
      setCompanySubmitError(null);

      const { companyUser } = await signupCompany({
        companyName: companyForm.companyName.trim(),
        companyEmail: companyForm.companyEmail.trim(),
        password: companyForm.password,
        termsAgreed: companyForm.termsAgreed,
      });

      setAuthCompanyUser(companyUser);
      setCompanyDashboardView('home');
      setScreen('companyTemp');
    } catch (error) {
      setCompanySubmitError(
        error instanceof Error ? error.message : '회원가입 처리 중 오류가 발생했습니다.',
      );
    } finally {
      setIsCompanySubmitting(false);
    }
  };

  const handleCompanyLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setIsCompanyLoggingIn(true);
      setCompanyLoginError(null);
      setCompanyLoginNotice(null);

      const { companyUser } = await loginCompany({
        email: companyLoginForm.email.trim(),
        password: companyLoginForm.password,
      });

      setAuthCompanyUser(companyUser);
      setCompanyDashboardView('home');
      setIsCompanyAccountLocked(false);
      setCompanyUnlockCode('');
      setCompanyUnlockSent(false);
      setCompanyUnlockSecondsLeft(0);
      setCompanyUnlockCodeExpiresSecondsLeft(0);
      setCompanyLoginOpen(false);
      setCompanyLoginStep('role');
      setScreen('companyTemp');
    } catch (error) {
      if (error instanceof ApiError && error.status === 423) {
        setIsCompanyAccountLocked(true);
      }

      setCompanyLoginError(error instanceof Error ? error.message : '로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsCompanyLoggingIn(false);
    }
  };

  const handleCompanyUnlockSend = async () => {
    const email = companyLoginForm.email.trim();

    if (!email) {
      setCompanyLoginError('기업 이메일을 입력해주세요.');
      return;
    }

    try {
      setIsSendingCompanyUnlock(true);
      setCompanyLoginError(null);
      setCompanyLoginNotice(null);

      const response = await sendCompanyUnlockCode({
        companyEmail: email,
      });

      setCompanyUnlockSent(true);
      setCompanyUnlockSecondsLeft(response.retryAfterSeconds ?? 60);
      setCompanyUnlockCodeExpiresSecondsLeft(response.expiresInSeconds ?? 600);
      setCompanyLoginNotice('잠금 해제 인증코드를 이메일로 발송했습니다.');
    } catch (error) {
      if (error instanceof ApiError && typeof error.retryAfterSeconds === 'number') {
        setCompanyUnlockSecondsLeft(error.retryAfterSeconds);
      }
      setCompanyLoginError(
        error instanceof Error ? error.message : '잠금 해제 인증코드 발송 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSendingCompanyUnlock(false);
    }
  };

  const handleCompanyUnlockVerify = async () => {
    if (!companyUnlockCode.trim()) {
      setCompanyLoginError('잠금 해제 인증코드를 입력해주세요.');
      return;
    }

    if (!/^\d{6}$/.test(companyUnlockCode.trim())) {
      setCompanyLoginError('인증코드 6자리를 입력해주세요.');
      return;
    }

    try {
      setIsVerifyingCompanyUnlock(true);
      setCompanyLoginError(null);
      setCompanyLoginNotice(null);

      const response = await verifyCompanyUnlockCode({
        companyEmail: companyLoginForm.email.trim(),
        verificationCode: companyUnlockCode.trim(),
      });

      setIsCompanyAccountLocked(false);
      setCompanyUnlockCode('');
      setCompanyUnlockSent(false);
      setCompanyUnlockSecondsLeft(0);
      setCompanyUnlockCodeExpiresSecondsLeft(0);
      setCompanyLoginNotice(response.message);
      setCompanyLoginForm((current) => ({
        ...current,
        password: '',
      }));
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === 'UNLOCK_CODE_RESET' &&
        typeof error.retryAfterSeconds === 'number'
      ) {
        setCompanyUnlockSent(false);
        setCompanyUnlockCode('');
        setCompanyUnlockSecondsLeft(error.retryAfterSeconds);
        setCompanyUnlockCodeExpiresSecondsLeft(0);
      }
      setCompanyLoginError(
        error instanceof Error ? error.message : '잠금 해제 처리 중 오류가 발생했습니다.',
      );
    } finally {
      setIsVerifyingCompanyUnlock(false);
    }
  };

  const openLoginFlow = () => {
    setCompanyLoginOpen(true);
    setCompanyLoginStep('role');
    setLoginRole('candidate');
    setCompanyLoginForm(initialCompanyLoginForm);
    setCandidateLoginForm(initialCandidateLoginForm);
    setCandidateLoginMethod('worldId');
    setCompanyLoginError(null);
    setCompanyLoginNotice(null);
    setCandidateLoginError(null);
    setCandidateLoginNotice(null);
    setCandidateLoginSent(false);
    setCandidateLoginSecondsLeft(0);
    setCandidateLoginCodeExpiresSecondsLeft(0);
    setCandidateLoginWorldIdOpen(false);
    setCandidateLoginWorldIdRequest(null);
    setCandidateLoginWorldIdError(null);
    setIsCompanyAccountLocked(false);
    setCompanyUnlockCode('');
    setCompanyUnlockSent(false);
    setCompanyUnlockSecondsLeft(0);
    setCompanyUnlockCodeExpiresSecondsLeft(0);
  };

  const closeCompanyLogin = () => {
    setCompanyLoginOpen(false);
    setCompanyLoginStep('role');
    setLoginRole('candidate');
    setCompanyLoginForm(initialCompanyLoginForm);
    setCandidateLoginForm(initialCandidateLoginForm);
    setCandidateLoginMethod('worldId');
    setCompanyLoginError(null);
    setCompanyLoginNotice(null);
    setCandidateLoginError(null);
    setCandidateLoginNotice(null);
    setCandidateLoginSent(false);
    setCandidateLoginSecondsLeft(0);
    setCandidateLoginCodeExpiresSecondsLeft(0);
    setCandidateLoginWorldIdOpen(false);
    setCandidateLoginWorldIdRequest(null);
    setCandidateLoginWorldIdError(null);
    setIsCompanyAccountLocked(false);
    setCompanyUnlockCode('');
    setCompanyUnlockSent(false);
    setCompanyUnlockSecondsLeft(0);
    setCompanyUnlockCodeExpiresSecondsLeft(0);
  };

  const openSelectedLoginForm = () => {
    setCompanyLoginStep('form');
  };

  const verificationTimerLabel = `${String(Math.floor(verificationSecondsLeft / 60)).padStart(2, '0')}:${String(
    verificationSecondsLeft % 60,
  ).padStart(2, '0')}`;
  const companyVerificationCodePlaceholder =
    verificationCodeExpiresSecondsLeft > 0
      ? `남은 시간 ${String(Math.floor(verificationCodeExpiresSecondsLeft / 60)).padStart(2, '0')}:${String(
          verificationCodeExpiresSecondsLeft % 60,
        ).padStart(2, '0')}`
      : '인증코드 입력';
  const candidateVerificationTimerLabel = `${String(
    Math.floor(candidateVerificationSecondsLeft / 60),
  ).padStart(2, '0')}:${String(candidateVerificationSecondsLeft % 60).padStart(2, '0')}`;
  const candidateVerificationCodePlaceholder =
    candidateVerificationCodeExpiresSecondsLeft > 0
      ? `남은 시간 ${String(Math.floor(candidateVerificationCodeExpiresSecondsLeft / 60)).padStart(2, '0')}:${String(
          candidateVerificationCodeExpiresSecondsLeft % 60,
        ).padStart(2, '0')}`
      : '인증코드 입력';
  const candidateWorldIdButtonLabel = isPreparingCandidateWorldId
    ? '준비 중...'
    : candidateWorldIdVerified
      ? '다시 인증 →'
      : '인증 시작 →';
  const candidateLoginCodePlaceholder =
    candidateLoginCodeExpiresSecondsLeft > 0
      ? `남은 시간 ${String(Math.floor(candidateLoginCodeExpiresSecondsLeft / 60)).padStart(2, '0')}:${String(
          candidateLoginCodeExpiresSecondsLeft % 60,
        ).padStart(2, '0')}`
      : '인증코드 입력';
  const companyUnlockTimerLabel = `${String(Math.floor(companyUnlockSecondsLeft / 60)).padStart(2, '0')}:${String(
    companyUnlockSecondsLeft % 60,
  ).padStart(2, '0')}`;
  const companyUnlockCodePlaceholder =
    companyUnlockCodeExpiresSecondsLeft > 0
      ? `남은 시간 ${String(Math.floor(companyUnlockCodeExpiresSecondsLeft / 60)).padStart(2, '0')}:${String(
          companyUnlockCodeExpiresSecondsLeft % 60,
        ).padStart(2, '0')}`
      : '인증코드 입력';

  const handleAdminLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAdminLoggingIn(true);
    setAdminLoginError(null);
    setAdminNotice(null);

    try {
      const response = await loginAdmin({
        username: adminLoginForm.username.trim(),
        password: adminLoginForm.password,
      });
      const dashboard = await fetchAdminDashboard();

      setAuthAdminUser(response.adminUser);
      setAuthCompanyUser(null);
      setAuthCandidateUser(null);
      setAdminDashboard(dashboard);
      setAdminPasswordForm({
        currentPassword: '',
        nextPassword: '',
        confirmNextPassword: '',
      });
      setAdminNotice(response.message);
    } catch (error) {
      setAdminLoginError(error instanceof Error ? error.message : '관리자 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsAdminLoggingIn(false);
    }
  };

  const handleAdminPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (adminPasswordForm.nextPassword !== adminPasswordForm.confirmNextPassword) {
      setAdminNotice('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsAdminPasswordSaving(true);
    setAdminNotice(null);

    try {
      const response = await changeAdminPassword({
        currentPassword: adminPasswordForm.currentPassword,
        nextPassword: adminPasswordForm.nextPassword,
      });

      setAdminPasswordForm({
        currentPassword: '',
        nextPassword: '',
        confirmNextPassword: '',
      });
      setAdminNotice(response.message);
    } catch (error) {
      setAdminNotice(error instanceof Error ? error.message : '관리자 비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setIsAdminPasswordSaving(false);
    }
  };

  const handleCompanyLogout = async () => {
    try {
      await logoutCompany();
    } catch {
      // Even if the server session is already gone, the local UI should recover.
    } finally {
      setAuthCompanyUser(null);
      setAuthCandidateUser(null);
      setAuthAdminUser(null);
      setAdminDashboard(null);
      setCompanyPortalData(null);
      setSelectedCompanyReport(null);
      setCompanyCreditActiveCharge(null);
      setIsCompanyCreditSubmitting(false);
      setIsCompanyCreditStatusRefreshing(false);
      setCompanyPortalError(null);
      setCompanyDashboardView('home');
      setScreen(isAdminPath() ? 'admin' : 'landing');
    }
  };

  const handleCompanyCreateFormChange =
    (field: keyof CompanyCreateForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      const nextValue = field === 'capacity' ? value.replace(/[^0-9]/g, '').slice(0, 3) : value;

      setCompanyCreateForm((current) => ({
        ...current,
        [field]: nextValue,
      }));

      if (
        field === 'title' ||
        field === 'description' ||
        field === 'detailedDescription' ||
        field === 'startDate' ||
        field === 'endDate' ||
        field === 'capacity'
      ) {
        setCompanyCreateFormErrors((current) => {
          if (!current[field]) {
            return current;
          }

          if (!nextValue.trim()) {
            return current;
          }

          const nextErrors = { ...current };
          delete nextErrors[field];
          return nextErrors;
        });
      }
    };

  const handleCompanyCreateVisibilityScopeSelect = (
    scope: (typeof companyCreatePublicScopeOptions)[number],
  ) => {
    setCompanyCreateForm((current) => ({
      ...current,
      visibilityScope: scope,
    }));
  };

  const handleCompanyCreateEligibleAgeSelect = (age: CompanyCreateForm['eligibleAge']) => {
    setCompanyCreateForm((current) => ({
      ...current,
      eligibleAge: age,
    }));
  };

  const handleCompanyCreateEligibleCountryAdd = (country: string) => {
    setCompanyCreateForm((current) => ({
      ...current,
      eligibleCountries: current.eligibleCountries.includes(country)
        ? current.eligibleCountries
        : [...current.eligibleCountries, country],
    }));
    setCompanyCreateEligibleCountrySearch('');
  };

  const handleCompanyCreateEligibleCountryRemove = (country: string) => {
    setCompanyCreateForm((current) => ({
      ...current,
      eligibleCountries: current.eligibleCountries.filter((item) => item !== country),
    }));
  };

  const handleCompanyCreateProcessChange =
    (processId: number, field: keyof Omit<CompanyCreateProcess, 'id'>) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target;
      setCompanyCreateProcesses((current) =>
        current.map((process) =>
          process.id === processId
            ? {
                ...process,
                [field]: value,
              }
            : process,
        ),
      );

      if (field === 'name' || field === 'content' || field === 'submissionMethod') {
        setCompanyCreateProcessErrors((current) => {
          const currentProcessErrors = current[processId];
          if (!currentProcessErrors?.[field] || !value.trim()) {
            return current;
          }

          const nextProcessErrors = { ...currentProcessErrors };
          delete nextProcessErrors[field];

          if (Object.keys(nextProcessErrors).length === 0) {
            const nextErrors = { ...current };
            delete nextErrors[processId];
            return nextErrors;
          }

          return {
            ...current,
            [processId]: nextProcessErrors,
          };
        });
      }
    };

  const handleCompanyCreateProcessAdd = () => {
    setCompanyCreateProcesses((current) => {
      const nextId = current.length > 0 ? Math.max(...current.map((process) => process.id)) + 1 : 1;
      return [...current, createCompanyCreateProcess(nextId)];
    });
  };

  const handleCompanyCreateProcessRemove = (processId: number) => {
    setCompanyCreateProcesses((current) => {
      if (current.length === 1) {
        return [createCompanyCreateProcess(current[0].id)];
      }

      return current.filter((process) => process.id !== processId);
    });
    setOpenCompanyCreateSubmissionDropdownId((current) => (current === processId ? null : current));
    setCompanyCreateProcessErrors((current) => {
      if (!current[processId]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[processId];
      return nextErrors;
    });
  };

  const handleCompanyCreateSubmissionSelect = (processId: number, submissionMethod: string) => {
    setCompanyCreateProcesses((current) =>
      current.map((process) =>
        process.id === processId
          ? {
              ...process,
              submissionMethod,
            }
          : process,
        ),
    );
    setOpenCompanyCreateSubmissionDropdownId(null);
    setCompanyCreateProcessErrors((current) => {
      const currentProcessErrors = current[processId];
      if (!currentProcessErrors?.submissionMethod) {
        return current;
      }

      const nextProcessErrors = { ...currentProcessErrors };
      delete nextProcessErrors.submissionMethod;

      if (Object.keys(nextProcessErrors).length === 0) {
        const nextErrors = { ...current };
        delete nextErrors[processId];
        return nextErrors;
      }

      return {
        ...current,
        [processId]: nextProcessErrors,
      };
    });
  };

  const validateCompanyCreateStepOne = () => {
    const nextErrors: CompanyCreateFormErrors = {};

    if (!companyCreateForm.title.trim()) {
      nextErrors.title = '공고명을 입력해주세요.';
    }

    if (!companyCreateForm.description.trim()) {
      nextErrors.description = '짧은 설명을 입력해주세요.';
    }

    if (!companyCreateForm.detailedDescription.trim()) {
      nextErrors.detailedDescription = '자세한 설명을 입력해주세요.';
    }

    if (!companyCreateForm.startDate.trim()) {
      nextErrors.startDate = '시작일을 입력해주세요.';
    }

    if (!companyCreateForm.endDate.trim()) {
      nextErrors.endDate = '마감일을 입력해주세요.';
    }

    if (!companyCreateForm.capacity.trim()) {
      nextErrors.capacity = '모집 인원을 입력해주세요.';
    }

    setCompanyCreateFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateCompanyCreateStepTwo = () => {
    const nextErrors: Record<number, CompanyCreateProcessErrors> = {};

    companyCreateProcesses.forEach((process) => {
      const processErrors: CompanyCreateProcessErrors = {};

      if (!process.name.trim()) {
        processErrors.name = '과정명을 입력해주세요.';
      }

      if (!process.content.trim()) {
        processErrors.content = '과정 내용을 입력해주세요.';
      }

      if (!process.submissionMethod.trim()) {
        processErrors.submissionMethod = '제출 방식을 선택해주세요.';
      }

      if (Object.keys(processErrors).length > 0) {
        nextErrors[process.id] = processErrors;
      }
    });

    setCompanyCreateProcessErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCompanyCreateStepOneNext = () => {
    if (!validateCompanyCreateStepOne()) {
      return;
    }

    setCompanyCreateStep(2);
  };

  const handleCompanyCreateStepTwoNext = () => {
    if (!validateCompanyCreateStepTwo()) {
      return;
    }

    setCompanyCreateStep(3);
  };

  const handleCompanyCreateAgentToggle = (agentId: string) => {
    setCompanyCreateAgents((current) =>
      current.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              selected: !agent.selected,
            }
          : agent,
      ),
    );
  };

  const updateCompanyCreateAgentWeight = (agentId: string, nextWeight: number) => {
    const weight = normalizeCompanyCreateAgentWeight(nextWeight);

    setCompanyCreateAgents((current) =>
      current.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              weight,
            }
          : agent,
      ),
    );
  };

  const handleCompanyCreateAgentWeightChange =
    (agentId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      updateCompanyCreateAgentWeight(agentId, Number(event.target.value));
    };

  const handleCompanyCreateAgentWeightInputChange =
    (agentId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const digits = event.target.value.replace(/[^0-9]/g, '');

      if (!digits) {
        setCompanyCreateAgentWeightInputs((current) => ({
          ...current,
          [agentId]: '',
        }));
        return;
      }

      const normalizedWeight = normalizeCompanyCreateAgentWeight(Number(digits));

      setCompanyCreateAgentWeightInputs((current) => ({
        ...current,
        [agentId]: String(normalizedWeight),
      }));
      updateCompanyCreateAgentWeight(agentId, normalizedWeight);
    };

  const handleCompanyCreateAgentWeightInputBlur = (agentId: string) => () => {
    const agent = companyCreateAgents.find((item) => item.id === agentId);

    if (!agent) {
      return;
    }

    setCompanyCreateAgentWeightInputs((current) => ({
      ...current,
      [agentId]: String(agent.weight),
    }));
  };

  const handleCompanyCreateEvaluationCriteriaChange =
    (field: keyof CompanyEvaluationCriteria) => (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setCompanyCreateEvaluationCriteria((current) => ({
        ...current,
        [field]: value,
      }));
    };

  const handleCompanySettingsChange =
    (field: keyof CompanySettingsForm) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setCompanySettingsForm((current) => ({
        ...current,
        [field]: value,
      }));
    };

  const handleCompanySettingsLanguageSelect = (language: CompanySettingsForm['language']) => {
    setCompanySettingsForm((current) => ({
      ...current,
      language,
    }));
    setIsCompanyLanguageDropdownOpen(false);
  };

  const handleCompanyVerificationTypeChange = (verificationType: CompanyVerificationType) => {
    setCompanyVerificationForm((current) => ({
      ...current,
      verificationType,
    }));
  };

  const handleCompanyVerificationCountrySelect = (country: CompanyVerificationCountry) => {
    setCompanyVerificationForm((current) => ({
      ...current,
      country,
    }));
    setIsCompanyVerificationCountryDropdownOpen(false);
  };

  const handleCompanyVerificationFileChange =
    (
      field:
        | 'companyBusinessCertificateFileName'
        | 'companyCorporateSealCertificateFileName'
        | 'companyOfficialLetterFileName'
        | 'organizerBusinessCertificateFileName'
        | 'organizerUsageSealCertificateFileName'
        | 'organizerOfficialLetterFileName',
    ) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const fileName = event.target.files?.[0]?.name ?? '';
      if (!fileName) {
        return;
      }

      setCompanyVerificationForm((current) => ({
        ...current,
        [field]: fileName,
      }));
    };

  const openCompanyCreateAgentDetail = (agentId: string) => {
    setSelectedCompanyCreateAgentId(agentId);
    setCompanyCreateAgentDetailTab('criteria');
  };

  const closeCompanyCreateAgentDetail = () => {
    setSelectedCompanyCreateAgentId(null);
  };

  const openCompanyFraud = (
    status: CompanyFraudCaseStatus = 'pending',
    fraudCaseId?: string,
  ) => {
    const fraudCasesSource = companyPortalData?.fraud.cases ?? [];
    setCompanyFraudFilter(status);
    setSelectedCompanyFraudCaseId(
      fraudCaseId ?? fraudCasesSource.find((item) => item.status === status)?.id ?? fraudCasesSource[0]?.id ?? null,
    );
    setCompanyDashboardView('fraud');
  };

  const openCompanySettings = () => {
    setCompanySettingsForm(getInitialCompanySettingsForm(authCompanyUser, companySettingsPreferences));
    setCompanyVerificationForm(savedCompanyVerificationForm);
    setIsCompanyVerificationCountryDropdownOpen(false);
    setIsCompanyLanguageDropdownOpen(false);
    setCompanyDashboardView('settings');
  };

  const openCompanyBlindRanking = async (blindCard: CompanyBlindSelectionCard) => {
    try {
      const response = await fetchCompanyBlindRanking(blindCard.id);
      setSelectedCompanyBlindCard(response.blindCard);
      setCompanyBlindRankingRows(response.candidates);
    } catch (error) {
      setCompanyPortalError(
        error instanceof Error ? error.message : '블라인드 랭킹을 불러오지 못했습니다.',
      );
      setSelectedCompanyBlindCard(blindCard);
      setCompanyBlindRankingRows([]);
    }

    setSelectedCompanyBlindRankingCandidateId(null);
    setCompanyBlindRankingDetailTab('overview');
    setCompanyDashboardView('blindRanking');
  };

  const openCompanyBlindRankingDetail = (candidateId: string) => {
    setSelectedCompanyBlindRankingCandidateId(candidateId);
    setCompanyBlindRankingDetailTab('overview');
  };

  const closeCompanyBlindRankingDetail = () => {
    setSelectedCompanyBlindRankingCandidateId(null);
    setCompanyBlindRankingDetailTab('overview');
  };

  const cycleCompanyBlindRankingHumanFilter = () => {
    setCompanyBlindRankingHumanFilter((currentFilter) => {
      if (currentFilter === 'all') {
        return 'verified';
      }

      if (currentFilter === 'verified') {
        return 'unverified';
      }

      return 'all';
    });
  };

  const toggleCompanyBlindRankingSortOrder = () => {
    setCompanyBlindRankingSortOrder((currentOrder) => (currentOrder === 'desc' ? 'asc' : 'desc'));
  };

  const toggleCompanyBlindRankingMinimumScore = () => {
    setIsCompanyBlindRankingMinimumScoreEnabled((currentValue) => !currentValue);
  };

  const openCompanyBlindRankingNotifyModal = () => {
    if (companyBlindRankingRows.some((candidate) => candidate.selected)) {
      setIsCompanyBlindRankingNotifyModalOpen(true);
    }
  };

  const closeCompanyBlindRankingNotifyModal = () => {
    setIsCompanyBlindRankingNotifyModalOpen(false);
  };

  const confirmCompanyBlindRankingNotify = async () => {
    const selectedCount = companyBlindRankingRows.filter((candidate) => candidate.selected).length;
    setIsCompanyBlindRankingNotifyModalOpen(false);

    if (!selectedCompanyBlindCard?.id) {
      return;
    }

    try {
      const response = await sendCompanyBlindRankingNotifications(selectedCompanyBlindCard.id);
      setCompanySettingsToastMessage(response.message);
    } catch {
      setCompanySettingsToastMessage(`${selectedCount}명에게 알림을 전송했습니다.`);
    }

    setCompanySettingsToastId((current) => current + 1);
  };

  const toggleCompanyBlindRankingSelection = async (candidateId: string) => {
    if (!selectedCompanyBlindCard?.id) {
      return;
    }

    const currentCandidate = companyBlindRankingRows.find((candidate) => candidate.id === candidateId);

    if (!currentCandidate) {
      return;
    }

    try {
      const response = await setCompanyBlindRankingSelection(
        selectedCompanyBlindCard.id,
        candidateId,
        !currentCandidate.selected,
      );
      setCompanyBlindRankingRows(response.candidates);
    } catch (error) {
      setCompanyPortalError(
        error instanceof Error ? error.message : '선택 상태를 저장하지 못했습니다.',
      );
    }
  };

  const handleCompanySettingsExit = () => {
    setCompanySettingsForm(getInitialCompanySettingsForm(authCompanyUser, companySettingsPreferences));
    setCompanyVerificationForm(savedCompanyVerificationForm);
    setIsCompanyVerificationCountryDropdownOpen(false);
    setIsCompanyLanguageDropdownOpen(false);
    setCompanyDashboardView('home');
  };

  const handleCompanySettingsSave = async () => {
    try {
      const response = await saveCompanyPortalSettings({
        companyName: companySettingsForm.companyName,
        contact: companySettingsForm.contact,
        language: companySettingsForm.language,
        verificationForm: companyVerificationForm,
      });

      setAuthCompanyUser(response.companyUser);
      setCompanySettingsPreferences({
        contact: response.settings.contact,
        language: response.settings.language,
      });
      setSavedCompanyVerificationForm(response.settings.verificationForm);
      setCompanyPortalData((current) =>
        current
          ? {
              ...current,
              settings: response.settings,
            }
          : current,
      );
      setCompanySettingsToastMessage(response.message);
    } catch (error) {
      setCompanySettingsToastMessage(
        error instanceof Error ? error.message : '설정 저장 중 오류가 발생했습니다.',
      );
    }

    setIsCompanyVerificationCountryDropdownOpen(false);
    setIsCompanyLanguageDropdownOpen(false);
    setCompanySettingsToastId((current) => current + 1);
  };

  const refreshCompanyCreditStatus = async (chargeId: string, options?: { silent?: boolean }) => {
    setIsCompanyCreditStatusRefreshing(true);

    try {
      const response = await fetchCompanyCreditCharge(chargeId);
      setCompanyCreditActiveCharge(response.charge);

      if (response.charge.status === 'confirmed') {
        const nextPortal = await fetchCompanyPortalBootstrap();
        setCompanyPortalData(nextPortal);
      }

      if (!options?.silent || response.charge.status !== 'pending') {
        pushCompanyToast(response.message);
      }
    } catch (error) {
      pushCompanyToast(
        error instanceof Error ? error.message : '충전 상태를 확인하는 중 오류가 발생했습니다.',
      );
    } finally {
      setIsCompanyCreditStatusRefreshing(false);
    }
  };

  const handleCompanyCreditRecharge = async () => {
    const requestedCreditUsd = Number(companyCreditRechargeAmount.replace(/,/g, '')) || 0;
    const creditConfig = companyPortalData?.credit;

    if (!creditConfig) {
      pushCompanyToast('크레딧 설정을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const shouldUseMiniAppPayment =
      Boolean(isMiniKitInstalled) && Boolean(creditConfig.miniAppPaymentsEnabled);
    const paymentChannel = shouldUseMiniAppPayment ? 'mini_app' : 'web_deposit';
    const paymentOptions = shouldUseMiniAppPayment
      ? creditConfig.miniAppPaymentOptions
      : creditConfig.webDepositOptions;
    const selectedPaymentOption =
      paymentOptions.find((option) => option.key === companyCreditCurrency) ?? paymentOptions[0] ?? null;

    if (shouldUseMiniAppPayment ? !creditConfig.miniAppPaymentsEnabled : !creditConfig.webDepositEnabled) {
      pushCompanyToast(
        shouldUseMiniAppPayment
          ? 'World 결제 설정이 아직 완료되지 않았습니다.'
          : '웹 입금 주소 설정이 아직 완료되지 않았습니다.',
      );
      return;
    }

    if (!selectedPaymentOption) {
      pushCompanyToast('사용 가능한 결제 토큰이 없습니다.');
      return;
    }

    if (!requestedCreditUsd) {
      pushCompanyToast('충전할 크레딧을 입력해주세요.');
      return;
    }

    if (requestedCreditUsd < creditConfig.minRechargeUsd) {
      pushCompanyToast(`최소 충전 금액은 $${creditConfig.minRechargeUsd.toLocaleString()} 입니다.`);
      return;
    }

    if (requestedCreditUsd > creditConfig.maxRechargeUsd) {
      pushCompanyToast(`최대 충전 금액은 $${creditConfig.maxRechargeUsd.toLocaleString()} 입니다.`);
      return;
    }

    if (paymentChannel === 'mini_app' && !isMiniKitInstalled) {
      pushCompanyToast('World App 안에서 열면 바로 결제할 수 있습니다.');
      return;
    }

    setIsCompanyCreditSubmitting(true);

    try {
      const createResponse = await createCompanyCreditCharge({
        creditUsd: requestedCreditUsd,
        paymentTokenKey: selectedPaymentOption.key,
        paymentChannel,
      });
      const createdCharge = createResponse.charge;

      setCompanyCreditActiveCharge(createdCharge);

      if (paymentChannel === 'web_deposit') {
        pushCompanyToast(createResponse.message);
        return;
      }

      const paymentResult = await MiniKit.pay({
        reference: createdCharge.reference,
        to: createdCharge.receiverAddress,
        tokens: [
          {
            symbol: createdCharge.paymentToken.worldTokenSymbol!,
            token_amount: createdCharge.paymentToken.amountDisplay,
          },
        ],
        description: `Verifit credit top-up $${requestedCreditUsd}`,
      });

      if (paymentResult.executedWith !== 'minikit') {
        pushCompanyToast('World App에서 결제를 다시 시도해주세요.');
        return;
      }

      const confirmResponse = await confirmCompanyCreditCharge({
        chargeId: createdCharge.id,
        transactionId: paymentResult.data.transactionId,
      });

      setCompanyCreditActiveCharge(confirmResponse.charge);

      if (confirmResponse.charge.status === 'confirmed') {
        const nextPortal = await fetchCompanyPortalBootstrap();
        setCompanyPortalData(nextPortal);
      }

      pushCompanyToast(confirmResponse.message);
    } catch (error) {
      pushCompanyToast(
        error instanceof Error ? error.message : '크레딧 결제를 시작하는 중 오류가 발생했습니다.',
      );
    } finally {
      setIsCompanyCreditSubmitting(false);
    }
  };

  const openCompanyCreate = () => {
    setCompanyCreateStep(1);
    setCompanyCreateFormErrors({});
    setCompanyCreateProcessErrors({});
    setCompanyCreateEvaluationCriteria(initialCompanyCreateEvaluationCriteria);
    setSelectedCompanyCreateAgentId(null);
    setCompanyDashboardView('create');
  };

  const handleCompanyCreateComplete = async () => {
    try {
      const response = await createCompanyPortalJob({
        sessionType: companyCreateSessionType,
        form: companyCreateForm,
        processes: companyCreateProcesses,
        agents: companyCreateAgents,
        evaluationCriteria: companyCreateEvaluationCriteria,
        expectedApplicants: companyCreateExpectedApplicants,
      });

      const nextPortal = await fetchCompanyPortalBootstrap();
      setCompanyPortalData(nextPortal);
      setSelectedCompanyJob(response.job);
      setSelectedCompanyReport(null);
      setCompanyDashboardView('jobs');
      setCompanyCreateStep(1);
      setCompanyCreateForm(initialCompanyCreateForm);
      setCompanyCreateProcesses(initialCompanyCreateProcesses);
      setCompanyCreateAgents(cloneCompanyCreateAgents(nextPortal.agentCatalog));
      setCompanyCreateEvaluationCriteria(initialCompanyCreateEvaluationCriteria);
      setCompanyCreateExpectedApplicants('50');
      setCompanyCreateFormErrors({});
      setCompanyCreateProcessErrors({});
      setCompanySettingsToastMessage(response.message);
      setCompanySettingsToastId((current) => current + 1);
    } catch (error) {
      setCompanySettingsToastMessage(
        error instanceof Error ? error.message : '공고 생성 중 오류가 발생했습니다.',
      );
      setCompanySettingsToastId((current) => current + 1);
    }
  };

  const openCompanyReport = async (job: CompanyJobListing) => {
    setSelectedCompanyJob(job);
    setSelectedCompanyReport(null);

    try {
      const report = await fetchCompanyJobReport(job.id);
      setSelectedCompanyReport(report);
    } catch (error) {
      setCompanyPortalError(
        error instanceof Error ? error.message : '공고 리포트를 불러오지 못했습니다.',
      );
    }

    setCompanyDashboardView('report');
  };

  const handleCompanyFraudCaseAction = async (
    caseId: string,
    status: Extract<CompanyFraudCaseStatus, 'resolved' | 'dismissed'>,
  ) => {
    try {
      await updateCompanyFraudCase({ caseId, status });
      const nextPortal = await fetchCompanyPortalBootstrap();
      setCompanyPortalData(nextPortal);
      setSelectedCompanyFraudCaseId(
        nextPortal.fraud.cases.find((item) => item.status === companyFraudFilter)?.id ??
          nextPortal.fraud.cases[0]?.id ??
          caseId,
      );
      setCompanySettingsToastMessage(
        status === 'resolved' ? '제출 무효 처리로 반영되었습니다.' : '오탐으로 기각 처리되었습니다.',
      );
      setCompanySettingsToastId((current) => current + 1);
    } catch (error) {
      setCompanySettingsToastMessage(
        error instanceof Error ? error.message : '부정 케이스 처리 중 오류가 발생했습니다.',
      );
      setCompanySettingsToastId((current) => current + 1);
    }
  };

  const renderLoginLayer = () => {
    if (!companyLoginOpen) {
      return null;
    }

    return (
      <>
        <div className="company-login-layer" role="presentation">
          <button
            type="button"
            className="company-login-layer__backdrop"
            aria-label="로그인 모달 닫기"
            onClick={closeCompanyLogin}
          />

          {companyLoginStep === 'role' ? (
            <section
              className="role-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="login-role-modal-title"
            >
              <div className="role-modal__header">
                <WorldLogo />
                <button
                  type="button"
                  className="role-modal__close"
                  aria-label="닫기"
                  onClick={closeCompanyLogin}
                >
                  ×
                </button>
              </div>
              <h3 id="login-role-modal-title">역할 선택</h3>

              <div className="role-modal__selector" aria-label="로그인 역할 선택">
                <button
                  type="button"
                  className={`role-pill${loginRole === 'candidate' ? ' role-pill--active' : ''}`}
                  onClick={() => setLoginRole('candidate')}
                >
                  지원자 (개인)
                </button>
                <button
                  type="button"
                  className={`role-pill${loginRole === 'organizer' ? ' role-pill--active' : ''}`}
                  onClick={() => setLoginRole('organizer')}
                >
                  기업 / 주최자
                </button>
              </div>

              <button
                type="button"
                className="role-modal__cta"
                onClick={openSelectedLoginForm}
              >
                {loginActionLabel}
              </button>
            </section>
          ) : loginRole === 'candidate' ? (
            <section
              className="company-login-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="candidate-login-title"
            >
              <div className="company-login-modal__header">
                <WorldLogo />
                <button
                  type="button"
                  className="company-login-modal__close"
                  aria-label="닫기"
                  onClick={closeCompanyLogin}
                >
                  ×
                </button>
              </div>

            <div className="company-login-modal__intro">
              <h3 id="candidate-login-title">지원자 로그인</h3>
              <p>World ID 또는 이메일 인증으로 로그인할 수 있습니다.</p>
            </div>

            <div className="role-modal__selector" aria-label="지원자 로그인 수단 선택">
              <button
                type="button"
                className={`role-pill${candidateLoginMethod === 'worldId' ? ' role-pill--active' : ''}`}
                onClick={() => handleCandidateLoginMethodChange('worldId')}
              >
                World ID
              </button>
              <button
                type="button"
                className={`role-pill${candidateLoginMethod === 'email' ? ' role-pill--active' : ''}`}
                onClick={() => handleCandidateLoginMethodChange('email')}
              >
                이메일 인증
              </button>
            </div>

            {candidateLoginMethod === 'email' ? (
              <form className="company-login-form" onSubmit={handleCandidateLoginSubmit}>
                <label className="company-field">
                  <span className="company-field__label">이메일</span>
                  <input
                    className="company-field__input"
                    type="email"
                    name="email"
                    value={candidateLoginForm.email}
                    onChange={handleCandidateLoginChange}
                  />
                </label>

                <button
                  type="button"
                  className="company-login-unlock__send"
                  onClick={handleCandidateLoginSend}
                  disabled={isSendingCandidateLogin || candidateLoginSecondsLeft > 0}
                >
                  {isSendingCandidateLogin ? '발송 중...' : '로그인 이메일 인증코드 보내기'}
                </button>

                {candidateLoginSecondsLeft > 0 ? (
                  <p className="company-login-unlock__cooldown" role="status">
                    {candidateLoginSecondsLeft}초 뒤에 다시 요청할 수 있습니다.
                  </p>
                ) : null}

                {candidateLoginSent ? (
                  <label className="company-field company-login-unlock__field">
                    <span className="company-field__label">로그인 이메일 인증코드</span>
                    <input
                      className="company-field__input"
                      type="text"
                      name="verificationCode"
                      placeholder={candidateLoginCodePlaceholder}
                      value={candidateLoginForm.verificationCode}
                      onChange={handleCandidateLoginChange}
                    />
                  </label>
                ) : null}

                {candidateLoginError ? (
                  <p className="company-form__server-error" role="alert">
                    {candidateLoginError}
                  </p>
                ) : null}

                {candidateLoginNotice ? (
                  <p className="company-form__server-notice" role="status">
                    {candidateLoginNotice}
                  </p>
                ) : null}

                <button
                  type="submit"
                  className="company-login-form__submit"
                  disabled={!candidateLoginSent}
                >
                  {isCandidateLoggingIn ? '로그인 중...' : '로그인'}
                </button>
              </form>
            ) : (
              <div className="company-login-form">
                <section className="candidate-form__world-id" aria-label="World ID 로그인 안내">
                  <div className="candidate-form__world-id-icon" aria-hidden="true">
                    <WorldLogoMark inverted={true} />
                  </div>
                  <div className="candidate-form__world-id-copy">
                    <strong>
                      {candidateWorldIdConfig?.enabled ? 'World ID 로그인' : 'World ID 설정 필요'}
                    </strong>
                    <span>
                      {candidateWorldIdConfig?.enabled
                        ? '가입에 사용한 동일한 World ID로 로그인할 수 있습니다.'
                        : 'Developer Portal에서 발급한 World ID 설정값이 필요합니다.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="candidate-form__world-id-button"
                    onClick={handleCandidateLoginWorldIdStart}
                    disabled={isPreparingCandidateLoginWorldId || isVerifyingCandidateLoginWorldId}
                  >
                    {isPreparingCandidateLoginWorldId ? '준비 중...' : 'World ID로 로그인'}
                  </button>
                </section>

                {candidateLoginWorldIdError ? (
                  <p className="company-form__server-error" role="alert">
                    {candidateLoginWorldIdError}
                  </p>
                ) : null}
              </div>
            )}
            </section>
          ) : (
            <section
              className="company-login-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="company-login-title"
            >
            <div className="company-login-modal__header">
              <WorldLogo />
              <button
                type="button"
                className="company-login-modal__close"
                aria-label="닫기"
                onClick={closeCompanyLogin}
              >
                ×
              </button>
            </div>

            <form className="company-login-form" onSubmit={handleCompanyLoginSubmit}>
              <label className="company-field">
                <span className="company-field__label">{loginEmailLabel}</span>
                <input
                  className="company-field__input"
                  type="email"
                  name="email"
                  value={companyLoginForm.email}
                  onChange={handleCompanyLoginChange}
                />
              </label>

              {!isCompanyAccountLocked ? (
                <label className="company-field company-login-form__password">
                  <span className="company-field__label">비밀번호</span>
                  <input
                    className="company-field__input"
                    type="password"
                    name="password"
                    value={companyLoginForm.password}
                    onChange={handleCompanyLoginChange}
                  />
                </label>
              ) : null}

              {isCompanyAccountLocked ? (
                <>
                  <p className="company-login-unlock__copy">
                    이메일 인증코드로 계정 잠금을 해제한 뒤 다시 로그인해주세요.
                  </p>

                  <button
                    type="button"
                    className="company-login-unlock__send"
                    onClick={handleCompanyUnlockSend}
                    disabled={isSendingCompanyUnlock || companyUnlockSecondsLeft > 0}
                  >
                    {isSendingCompanyUnlock ? '발송 중...' : '잠금 해제 인증코드 보내기'}
                  </button>

                  {companyUnlockSecondsLeft > 0 ? (
                    <p className="company-login-unlock__cooldown" role="status">
                      {companyUnlockSecondsLeft}초 뒤에 다시 요청할 수 있습니다.
                    </p>
                  ) : null}

                  {companyUnlockSent ? (
                    <>
                      <label className="company-field company-login-unlock__field">
                        <span className="company-field__label">잠금 해제 인증코드</span>
                        <input
                          className="company-field__input"
                          type="text"
                          name="companyUnlockCode"
                          placeholder={companyUnlockCodePlaceholder}
                          value={companyUnlockCode}
                          onChange={(event) => {
                            setCompanyUnlockCode(event.target.value);
                            setCompanyLoginError(null);
                            setCompanyLoginNotice(null);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        className="company-login-unlock__confirm"
                        onClick={handleCompanyUnlockVerify}
                        disabled={isVerifyingCompanyUnlock}
                      >
                        {isVerifyingCompanyUnlock ? '해제 중...' : '잠금 해제'}
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}

              {companyLoginError ? (
                <p className="company-form__server-error" role="alert">
                  {companyLoginError}
                </p>
              ) : null}

              {companyLoginNotice ? (
                <p className="company-form__server-notice" role="status">
                  {companyLoginNotice}
                </p>
              ) : null}

              {!isCompanyAccountLocked ? (
                <button type="submit" className="company-login-form__submit">
                  {isCompanyLoggingIn ? '로그인 중...' : '로그인'}
                </button>
              ) : null}
            </form>
            </section>
          )}
        </div>

        {candidateLoginWorldIdRequest ? (
          <IDKitRequestWidget
            open={candidateLoginWorldIdOpen}
            onOpenChange={setCandidateLoginWorldIdOpen}
            app_id={candidateLoginWorldIdRequest.appId}
            action={candidateLoginWorldIdRequest.action}
            rp_context={candidateLoginWorldIdRequest.rpContext as RpContext}
            allow_legacy_proofs={true}
            environment={candidateLoginWorldIdRequest.environment}
            preset={orbLegacy()}
            handleVerify={handleCandidateLoginWorldIdVerify}
            onSuccess={handleCandidateLoginWorldIdSuccess}
            onError={handleCandidateLoginWorldIdError}
          />
        ) : null}
      </>
    );
  };

  if (!authBootstrapComplete) {
    return (
      <div className="page-shell page-shell--loading">
        <main className="auth-loading">
          <strong>세션을 확인하고 있습니다.</strong>
          <p>잠시만 기다려주세요.</p>
        </main>
      </div>
    );
  }

  if (screen === 'admin') {
    const adminSummaryCards = adminDashboard
      ? [
          { label: '총 잔액', value: `$ ${adminDashboard.summary.totalBalanceUsd.toLocaleString()}` },
          { label: '총 충전액', value: `$ ${adminDashboard.summary.totalChargedUsd.toLocaleString()}` },
          { label: '입금 대기', value: `${adminDashboard.summary.pendingWebDepositCount}건` },
          { label: '기업 계정', value: `${adminDashboard.summary.companyCount}개` },
        ]
      : [];

    return (
      <div className="admin-page">
        <main className="admin-shell">
          <header className="admin-header">
            <div>
              <span className="admin-header__eyebrow">Worldfit Admin</span>
              <h1>관리자 페이지</h1>
              <p>입금 내역과 기업 크레딧 잔액을 확인할 수 있습니다.</p>
            </div>

            {authAdminUser ? (
              <button type="button" className="admin-logout" onClick={handleCompanyLogout}>
                로그아웃
              </button>
            ) : null}
          </header>

          {authAdminUser ? (
            <>
              {adminNotice ? (
                <div className="admin-banner" role="status">
                  {adminNotice}
                </div>
              ) : null}

              <section className="admin-summary" aria-label="관리자 요약">
                {adminSummaryCards.map((card) => (
                  <article className="admin-card admin-summary__card" key={card.label}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </article>
                ))}
              </section>

              <section className="admin-grid">
                <article className="admin-card">
                  <div className="admin-card__header">
                    <h2>관리자 비밀번호 변경</h2>
                  </div>

                  <form className="admin-form" onSubmit={handleAdminPasswordChange}>
                    <label className="admin-field">
                      <span>현재 비밀번호</span>
                      <input
                        type="password"
                        value={adminPasswordForm.currentPassword}
                        onChange={(event) =>
                          setAdminPasswordForm((current) => ({
                            ...current,
                            currentPassword: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="admin-field">
                      <span>새 비밀번호</span>
                      <input
                        type="password"
                        value={adminPasswordForm.nextPassword}
                        onChange={(event) =>
                          setAdminPasswordForm((current) => ({
                            ...current,
                            nextPassword: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className="admin-field">
                      <span>새 비밀번호 확인</span>
                      <input
                        type="password"
                        value={adminPasswordForm.confirmNextPassword}
                        onChange={(event) =>
                          setAdminPasswordForm((current) => ({
                            ...current,
                            confirmNextPassword: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <button type="submit" className="admin-button" disabled={isAdminPasswordSaving}>
                      {isAdminPasswordSaving ? '변경 중...' : '비밀번호 변경'}
                    </button>
                  </form>
                </article>

                <article className="admin-card admin-card--wide">
                  <div className="admin-card__header">
                    <h2>기업 잔액</h2>
                    {isAdminDashboardLoading ? <span>불러오는 중...</span> : null}
                  </div>

                  <div className="admin-table" role="table" aria-label="기업 잔액">
                    <div className="admin-table__row admin-table__row--head" role="row">
                      <span role="columnheader">기업</span>
                      <span role="columnheader">이메일</span>
                      <span role="columnheader">잔액</span>
                      <span role="columnheader">월 사용량</span>
                    </div>

                    {adminDashboard?.balances.map((item) => (
                      <div className="admin-table__row" role="row" key={item.companyId}>
                        <strong role="cell">{item.companyName}</strong>
                        <span role="cell">{item.companyEmail}</span>
                        <span role="cell">{`$ ${item.balanceUsd.toLocaleString()}`}</span>
                        <span role="cell">{`$ ${item.monthlyUsageUsd.toLocaleString()}`}</span>
                      </div>
                    )) ?? (
                      <div className="admin-table__empty">표시할 기업 잔액이 없습니다.</div>
                    )}
                  </div>
                </article>
              </section>

              <section className="admin-card">
                <div className="admin-card__header">
                  <h2>최근 입금 내역</h2>
                </div>

                <div className="admin-table admin-table--deposits" role="table" aria-label="입금 내역">
                  <div className="admin-table__row admin-table__row--head" role="row">
                    <span role="columnheader">기업</span>
                    <span role="columnheader">상태</span>
                    <span role="columnheader">요청</span>
                    <span role="columnheader">실입금</span>
                    <span role="columnheader">반영</span>
                    <span role="columnheader">생성 시각</span>
                  </div>

                  {adminDashboard?.deposits.map((item) => (
                    <div className="admin-table__row" role="row" key={item.id}>
                      <div role="cell" className="admin-table__stack">
                        <strong>{item.companyName}</strong>
                        <span>{item.companyEmail}</span>
                      </div>
                      <span role="cell">{item.status}</span>
                      <div role="cell" className="admin-table__stack">
                        <strong>{`$ ${item.requestedCreditUsd.toLocaleString()}`}</strong>
                        <span>{`${item.expectedTokenAmountDisplay} ${item.paymentTokenKey}`}</span>
                      </div>
                      <div role="cell" className="admin-table__stack">
                        <strong>
                          {item.receivedTokenAmountDisplay
                            ? `${item.receivedTokenAmountDisplay} ${item.paymentTokenKey}`
                            : '—'}
                        </strong>
                        <span>{item.transactionHash ?? item.reference}</span>
                      </div>
                      <div role="cell" className="admin-table__stack">
                        <strong>{item.creditedAmountUsd != null ? `$ ${item.creditedAmountUsd.toLocaleString()}` : '—'}</strong>
                        <span>{item.quotedAmountUsd != null ? `$ ${item.quotedAmountUsd.toFixed(2)}` : '—'}</span>
                      </div>
                      <span role="cell">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('ko-KR') : '—'}
                      </span>
                    </div>
                  )) ?? <div className="admin-table__empty">표시할 입금 내역이 없습니다.</div>}
                </div>
              </section>
            </>
          ) : (
            <section className="admin-login">
              <article className="admin-card admin-login__card">
                <div className="admin-card__header">
                  <h2>관리자 로그인</h2>
                </div>

                <form className="admin-form" onSubmit={handleAdminLogin}>
                  <label className="admin-field">
                    <span>아이디</span>
                    <input
                      type="text"
                      value={adminLoginForm.username}
                      onChange={(event) =>
                        setAdminLoginForm((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="admin-field">
                    <span>비밀번호</span>
                    <input
                      type="password"
                      value={adminLoginForm.password}
                      onChange={(event) =>
                        setAdminLoginForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                    />
                  </label>

                  {adminLoginError ? <p className="admin-form__error">{adminLoginError}</p> : null}

                  <button type="submit" className="admin-button" disabled={isAdminLoggingIn}>
                    {isAdminLoggingIn ? '로그인 중...' : '로그인'}
                  </button>
                </form>
              </article>
            </section>
          )}
        </main>
      </div>
    );
  }

  if (screen === 'companyTemp' && authCompanyUser) {
    const resolvedCompanyPortalData = companyPortalData ?? buildEmptyCompanyPortalBootstrap(authCompanyUser);
    const resolvedCompanyDashboardSummaryCards =
      resolvedCompanyPortalData.dashboard.summaryCards;
    const resolvedCompanyDashboardSessions =
      resolvedCompanyPortalData.dashboard.sessions;
    const resolvedCompanyDashboardAlerts =
      resolvedCompanyPortalData.dashboard.alerts;
    const resolvedCompanyDashboardWldUsage =
      resolvedCompanyPortalData.dashboard.wldUsage;
    const resolvedCompanyJobStatusFilters =
      resolvedCompanyPortalData.jobs.statusFilters;
    const resolvedCompanyJobListings = resolvedCompanyPortalData.jobs.items;
    const visibleCompanyJobListings = resolvedCompanyJobListings.filter((job) => {
      const matchesSearch =
        companyJobSearch.trim().length === 0 ||
        job.title.toLowerCase().includes(companyJobSearch.trim().toLowerCase());
      const matchesType =
        companyJobTypeFilter === 'all' ||
        job.type === companyJobTypeFilters.find((filter) => filter.key === companyJobTypeFilter)?.label;
      const matchesStatus =
        companyJobStatusFilter === 'all' ||
        (companyJobStatusFilter === 'draft'
          ? job.status === '대기'
          : companyJobStatusFilter === 'open'
            ? job.status === '진행' || job.status === '마감 임박'
            : job.status === '종료');

      return matchesSearch && matchesType && matchesStatus;
    });
    const resolvedCompanyBlindSelectionCards = resolvedCompanyPortalData.blind.cards;
    const resolvedCompanyFraudFilterOptions =
      resolvedCompanyPortalData.fraud.filters;
    const resolvedCompanyFraudCases = resolvedCompanyPortalData.fraud.cases;
    const resolvedCompanyCreditHistory = resolvedCompanyPortalData.credit.history;
    const resolvedCompanyCreditBalance =
      resolvedCompanyPortalData.credit.balanceUsd;
    const resolvedCompanyCreditMonthlyUsage =
      resolvedCompanyPortalData.credit.monthlyUsageUsd;
    const resolvedCompanyCreditMiniAppPaymentsEnabled =
      resolvedCompanyPortalData.credit.miniAppPaymentsEnabled;
    const resolvedCompanyCreditWebDepositEnabled =
      resolvedCompanyPortalData.credit.webDepositEnabled;
    const resolvedCompanyCreditMinRechargeUsd =
      resolvedCompanyPortalData.credit.minRechargeUsd;
    const resolvedCompanyCreditMaxRechargeUsd =
      resolvedCompanyPortalData.credit.maxRechargeUsd;
    const resolvedCompanyCreditMiniAppPaymentOptions =
      resolvedCompanyPortalData.credit.miniAppPaymentOptions;
    const resolvedCompanyCreditWebDepositOptions =
      resolvedCompanyPortalData.credit.webDepositOptions;
    const resolvedCompanyCreditWalletAddress =
      resolvedCompanyPortalData.credit.walletAddress;
    const shouldShowCompanyMiniAppCreditPayment =
      isMiniKitInstalled && resolvedCompanyCreditMiniAppPaymentsEnabled;
    const resolvedCompanyCreditPaymentOptions = shouldShowCompanyMiniAppCreditPayment
      ? resolvedCompanyCreditMiniAppPaymentOptions
      : resolvedCompanyCreditWebDepositOptions;
    const selectedCompanyCreditPaymentOption =
      resolvedCompanyCreditPaymentOptions.find((option) => option.key === companyCreditCurrency) ??
      resolvedCompanyCreditPaymentOptions[0] ??
      null;
    const visibleCompanyCreditActiveCharge =
      companyCreditActiveCharge?.paymentChannel ===
      (shouldShowCompanyMiniAppCreditPayment ? 'mini_app' : 'web_deposit')
        ? companyCreditActiveCharge
        : null;
    const resolvedPendingFraudCount =
      resolvedCompanyPortalData.dashboard.pendingFraudCount ??
      resolvedCompanyFraudCases.filter((item) => item.status === 'pending').length;
    const resolvedCompanyReport =
      selectedCompanyReport ?? buildEmptyCompanyReport(selectedCompanyJob);
    const wldUsageMax = Math.max(...resolvedCompanyDashboardWldUsage, 1);
    const resolvedCompanyDashboardUsageTotal = resolvedCompanyDashboardWldUsage.reduce(
      (sum, value) => sum + value,
      0,
    );
    const resolvedCompanyDashboardDailyAverage =
      resolvedCompanyDashboardWldUsage.length > 0
        ? resolvedCompanyDashboardUsageTotal / resolvedCompanyDashboardWldUsage.length
        : null;
    const companyCreditRechargeValue = Number(companyCreditRechargeAmount.replace(/,/g, '')) || 0;
    const fallbackCompanyCreditExpectedAmount = selectedCompanyCreditPaymentOption
      ? Number(
          (
            companyCreditRechargeValue * selectedCompanyCreditPaymentOption.tokenPerUsd
          ).toFixed(6),
        )
      : 0;
    const activeCompanyCreditQuote =
      companyCreditQuote &&
      companyCreditQuote.paymentChannel ===
        (shouldShowCompanyMiniAppCreditPayment ? 'mini_app' : 'web_deposit') &&
      companyCreditQuote.paymentTokenKey === selectedCompanyCreditPaymentOption?.key &&
      companyCreditQuote.creditUsd === companyCreditRechargeValue
        ? companyCreditQuote
        : null;
    const cachedCompanyCreditQuote =
      selectedCompanyCreditPaymentOption
        ? companyCreditQuoteCache[
            `${shouldShowCompanyMiniAppCreditPayment ? 'mini_app' : 'web_deposit'}:${selectedCompanyCreditPaymentOption.key}`
          ] ?? null
        : null;
    const companyCreditLiveTokenPerUsd =
      activeCompanyCreditQuote?.tokenPerUsd ??
      cachedCompanyCreditQuote?.tokenPerUsd ??
      selectedCompanyCreditPaymentOption?.tokenPerUsd ??
      0;
    const companyCreditExpectedAmount = selectedCompanyCreditPaymentOption
      ? Number((companyCreditRechargeValue * companyCreditLiveTokenPerUsd).toFixed(6))
      : fallbackCompanyCreditExpectedAmount;
    const companyCreditExpectedAmountLabel = selectedCompanyCreditPaymentOption
      ? companyCreditExpectedAmount.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 6,
        })
      : '0';
    const companyCreditExpectedAmountText =
      companyCreditRechargeValue > 0 && selectedCompanyCreditPaymentOption
        ? `${companyCreditExpectedAmountLabel} ${selectedCompanyCreditPaymentOption.label}`
        : '충전 크레딧을 입력하면 자동으로 입력됩니다.';
    const companyCreditSummaryText =
      companyCreditRechargeValue > 0 && selectedCompanyCreditPaymentOption
        ? `${companyCreditExpectedAmountLabel} ${selectedCompanyCreditPaymentOption.label} → $ ${companyCreditRechargeValue.toLocaleString()} 충전 예정`
        : `000 ${selectedCompanyCreditPaymentOption?.label ?? companyCreditCurrency} → $ 000 충전 예정`;
    const companyCreditQuoteNote =
      activeCompanyCreditQuote || cachedCompanyCreditQuote
        ? `실시간 시세 기준 · 1 ${selectedCompanyCreditPaymentOption?.label ?? companyCreditCurrency} = $${(activeCompanyCreditQuote?.tokenPriceUsd ?? cachedCompanyCreditQuote?.tokenPriceUsd ?? 0).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        })}`
        : null;
    const companyCreditStatusLabel =
      visibleCompanyCreditActiveCharge?.status === 'confirmed'
        ? '충전 완료'
        : visibleCompanyCreditActiveCharge?.status === 'pending'
          ? '블록 확인 중'
          : visibleCompanyCreditActiveCharge?.status === 'failed'
            ? '결제 실패'
            : visibleCompanyCreditActiveCharge?.status === 'expired'
              ? '요청 만료'
              : visibleCompanyCreditActiveCharge?.status === 'ready'
                ? shouldShowCompanyMiniAppCreditPayment
                  ? '결제 대기'
                  : '입금 대기'
                : null;
    const companyCreditPrimaryActionLabel = shouldShowCompanyMiniAppCreditPayment
      ? 'World App으로 결제'
      : visibleCompanyCreditActiveCharge &&
          (visibleCompanyCreditActiveCharge.status === 'ready' ||
            visibleCompanyCreditActiveCharge.status === 'pending')
        ? '새 1회용 입금 주소 생성'
        : '1회용 입금 주소 생성';
    const companyCreditDetectedAtLabel = visibleCompanyCreditActiveCharge?.detectedAt
      ? new Date(visibleCompanyCreditActiveCharge.detectedAt).toLocaleString('ko-KR')
      : null;
    const visibleCompanyBlindSelectionCards = resolvedCompanyBlindSelectionCards.filter((item) => {
      const matchesSearch =
        companyBlindSelectionSearch.trim().length === 0 ||
        item.title.toLowerCase().includes(companyBlindSelectionSearch.trim().toLowerCase());
      const matchesType =
        companyBlindSelectionTypeFilter === 'all' || item.type === companyBlindSelectionTypeFilter;
      const matchesStatus =
        companyBlindSelectionStatusFilter === 'all' || item.status === companyBlindSelectionStatusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
    const visibleCompanyFraudCases = resolvedCompanyFraudCases.filter((item) => item.status === companyFraudFilter);
    const selectedCompanyFraudCase =
      visibleCompanyFraudCases.find((item) => item.id === selectedCompanyFraudCaseId) ??
      visibleCompanyFraudCases[0] ??
      resolvedCompanyFraudCases.find((item) => item.id === selectedCompanyFraudCaseId) ??
      resolvedCompanyFraudCases[0] ??
      null;
    const selectedCompanyCreateAgents = companyCreateAgents.filter((agent) => agent.selected);
    const companyCreateWeightTotal = selectedCompanyCreateAgents.reduce((sum, agent) => sum + agent.weight, 0);
    const companyCreateCostPerApplicantWld =
      (companyCreateWeightTotal / 100) * COMPANY_CREATE_COST_PER_APPLICANT_WLD;
    const companyCreateExpectedApplicantsCount =
      Number.parseInt(companyCreateExpectedApplicants.replace(/[^0-9]/g, ''), 10) || 0;
    const companyCreateSessionCostWld =
      companyCreateCostPerApplicantWld * companyCreateExpectedApplicantsCount;
    const companyVerificationBadge = getCompanyVerificationBadge(companyVerificationForm);
    const companyCreateRemainingCredit = COMPANY_CREATE_WLD_BALANCE - companyCreateSessionCostWld;
    const companyCreateCapacityDigits = companyCreateForm.capacity.trim();
    const companyCreateExactCapacityLabel = companyCreateCapacityDigits
      ? `${companyCreateCapacityDigits}명`
      : 'n명';
    const companyCreateMaskedCapacityLabel = companyCreateCapacityDigits
      ? `${'0'.repeat(companyCreateCapacityDigits.length)}명`
      : '00명';
    const isCompanyCreateWeightBalanced = companyCreateWeightTotal === 100;
    const shouldShowCompanyCreateRechargeNotice = companyCreateRemainingCredit <= 10;
    const selectedCompanyCreateAgentDetailSource = selectedCompanyCreateAgentId
      ? companyCreateAgents.find((agent) => agent.id === selectedCompanyCreateAgentId) ?? null
      : null;
    const selectedCompanyCreateAgentDetail = selectedCompanyCreateAgentDetailSource
      ? getCompanyCreateAgentDetail(selectedCompanyCreateAgentDetailSource)
      : null;
    const formatCompanyCreateCredit = (value: number) =>
      value.toLocaleString('en-US', {
        minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
        maximumFractionDigits: 1,
      });
    const pageTitle =
      companyDashboardView === 'home'
        ? '홈 대시보드'
        : companyDashboardView === 'jobs'
          ? '공고 목록'
          : companyDashboardView === 'blind'
            ? '블라인드 선발'
          : companyDashboardView === 'blindRanking'
            ? '블라인드 선발'
          : companyDashboardView === 'fraud'
            ? '부정 알림'
          : companyDashboardView === 'credit'
            ? '크레딧'
          : companyDashboardView === 'settings'
            ? '설정'
          : companyDashboardView === 'create'
            ? '공고 생성'
            : '리포트';
    const activeCompanyNavView =
      companyDashboardView === 'report'
        ? 'jobs'
        : companyDashboardView === 'blindRanking'
          ? 'blind'
          : companyDashboardView;
    const selectedCompanyBlindRankingCount = companyBlindRankingRows.filter((candidate) => candidate.selected).length;
    const selectedCompanyBlindRankingCandidate = selectedCompanyBlindRankingCandidateId
      ? companyBlindRankingRows.find((candidate) => candidate.id === selectedCompanyBlindRankingCandidateId) ?? null
      : null;
    const selectedCompanyBlindRankingCandidateDetail = selectedCompanyBlindRankingCandidate
      ? getCompanyBlindRankingCandidateDetail(selectedCompanyBlindRankingCandidate)
      : null;
    const activeCompanyBlindRankingTabSection =
      selectedCompanyBlindRankingCandidate && companyBlindRankingDetailTab !== 'overview'
        ? selectedCompanyBlindRankingCandidateDetail?.tabSections[companyBlindRankingDetailTab] ??
          getCompanyBlindRankingFallbackTabSection(selectedCompanyBlindRankingCandidate, companyBlindRankingDetailTab)
        : null;
    const visibleCompanyBlindRankingRows = [...companyBlindRankingRows]
      .filter((candidate) => {
        if (companyBlindRankingHumanFilter === 'verified') {
          return candidate.humanVerified;
        }

        if (companyBlindRankingHumanFilter === 'unverified') {
          return !candidate.humanVerified;
        }

        return true;
      })
      .filter((candidate) =>
        isCompanyBlindRankingMinimumScoreEnabled ? candidate.overallScore >= 75 : true,
      )
      .sort((leftCandidate, rightCandidate) =>
        companyBlindRankingSortOrder === 'desc'
          ? rightCandidate.overallScore - leftCandidate.overallScore
          : leftCandidate.overallScore - rightCandidate.overallScore,
      );
    const companyBlindRankingMetricLabels = companyBlindRankingRows[0]?.metrics.map((metric) => metric.label) ?? [];
    const companyBlindRankingGridTemplate = `32px minmax(140px, 1.5fr) 84px 56px repeat(${companyBlindRankingMetricLabels.length}, minmax(110px, 1fr)) 72px 88px`;
    const filteredCompanyCreateCountryOptions = companyCreateCountryOptions
      .filter((country) => !companyCreateForm.eligibleCountries.includes(country))
      .filter((country) =>
        companyCreateEligibleCountrySearch
          ? country.toLowerCase().includes(companyCreateEligibleCountrySearch.toLowerCase())
          : true,
      );

    return (
      <div className="company-dashboard-page">
        <aside className="company-dashboard-sidebar" aria-label="기업 대시보드 메뉴">
          <button
            type="button"
            className="company-dashboard-sidebar__brand"
            onClick={() => setScreen('landing')}
            aria-label="랜딩 페이지로 이동"
          >
            <WorldLogo inverted />
          </button>

          <nav className="company-dashboard-sidebar__nav">
            {companyDashboardNavItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`company-dashboard-sidebar__nav-item${item.view === activeCompanyNavView ? ' company-dashboard-sidebar__nav-item--active' : ''}`}
                aria-current={item.view === activeCompanyNavView ? 'page' : undefined}
                onClick={() => {
                  if (item.view) {
                    if (item.view === 'create') {
                      openCompanyCreate();
                      return;
                    }

                    if (item.view === 'fraud') {
                      openCompanyFraud();
                      return;
                    }

                    if (item.view === 'settings') {
                      openCompanySettings();
                      return;
                    }

                    setCompanyDashboardView(item.view);
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="company-dashboard-sidebar__profile">
            <div className="company-dashboard-sidebar__avatar" aria-hidden="true">
              {getProfileBadge(authCompanyUser.companyName)}
            </div>

            <div className="company-dashboard-sidebar__profile-copy">
              <strong title={authCompanyUser.companyName}>{authCompanyUser.companyName}</strong>
              <span title={authCompanyUser.companyEmail}>{authCompanyUser.companyEmail}</span>
            </div>

            <button
              type="button"
              className="company-dashboard-sidebar__logout"
              onClick={handleCompanyLogout}
            >
              로그아웃
            </button>
          </div>
        </aside>

        <main className="company-dashboard-main">
          {companySettingsToastMessage ? (
            <div
              key={companySettingsToastId}
              className="company-dashboard-toast"
              role="status"
              aria-live="polite"
            >
              {companySettingsToastMessage}
            </div>
          ) : null}

          <header className="company-dashboard-topbar">
            <h1>{pageTitle}</h1>

            <div className="company-dashboard-topbar__actions">
              <span>{`크레딧 $${resolvedCompanyCreditBalance.toLocaleString()}`}</span>
              <button type="button" onClick={() => setCompanyDashboardView('credit')}>
                충전
              </button>
            </div>
          </header>

          {isCompanyPortalLoading ? (
            <div className="company-dashboard-toast company-dashboard-toast--loading" role="status" aria-live="polite">
              기업 포털 데이터를 동기화하고 있습니다.
            </div>
          ) : null}

          {companyPortalError ? (
            <div className="company-dashboard-toast" role="alert">
              {companyPortalError}
            </div>
          ) : null}

          {companyDashboardView === 'home' ? (
            <>
              <section className="company-dashboard-summary" aria-label="요약 지표">
                {resolvedCompanyDashboardSummaryCards.map((card) => (
                  <article className="company-dashboard-card company-dashboard-summary__card" key={card.label}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    {card.detail ? <p>{card.detail}</p> : null}
                  </article>
                ))}
              </section>

              <section className="company-dashboard-grid">
                <article className="company-dashboard-card company-dashboard-sessions">
                  <div className="company-dashboard-sessions__header">
                    <div>
                      <h2>진행 중 공고</h2>
                      <p>평가 진행 상황과 부정행위 알림을 확인하세요</p>
                    </div>

                    <button
                      type="button"
                      className="company-dashboard-sessions__cta"
                      onClick={openCompanyCreate}
                    >
                      + 새로운 공고
                    </button>
                  </div>

                  <div className="company-dashboard-sessions__table" role="table" aria-label="진행 중 공고 목록">
                    {resolvedCompanyDashboardSessions.length > 0 ? (
                      <>
                        <div className="company-dashboard-sessions__row company-dashboard-sessions__row--head" role="row">
                          <span role="columnheader">공고</span>
                          <span role="columnheader">유형</span>
                          <span role="columnheader">지원자</span>
                          <span role="columnheader">진척</span>
                          <span role="columnheader">부정</span>
                        </div>

                        {resolvedCompanyDashboardSessions.map((session) => (
                          <div className="company-dashboard-sessions__row" role="row" key={session.name}>
                            <strong role="cell">{session.name}</strong>
                            <span role="cell">{session.type}</span>
                            <span role="cell">{session.applicants}</span>
                            <div className="company-dashboard-sessions__progress" role="cell">
                              <div
                                className="company-dashboard-sessions__progress-bar"
                                aria-label={`${session.name} 진행률 ${session.progress}%`}
                              >
                                <span style={{ width: `${session.progress}%` }} />
                              </div>
                              <strong>{session.progress}%</strong>
                            </div>
                            <div role="cell">
                              <span
                                className={`company-dashboard-sessions__fraud${session.fraudCount ? ' company-dashboard-sessions__fraud--alert' : ''}`}
                              >
                                {session.fraudCount ? `▲ ${session.fraudCount}` : '—'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="company-dashboard-sessions__empty">
                        <p>아직 진행 중인 공고가 없습니다.</p>
                      </div>
                    )}
                  </div>
                </article>

                <article className="company-dashboard-card company-dashboard-alerts">
                  <div className="company-dashboard-alerts__header">
                    <h2>부정행위 알림 (실시간)</h2>

                    <div className="company-dashboard-alerts__meta">
                      <span>{`${resolvedPendingFraudCount}건 대기`}</span>
                      <button type="button" onClick={() => openCompanyFraud()}>
                        전체 보기
                      </button>
                    </div>
                  </div>

                  <div className="company-dashboard-alerts__list">
                    {resolvedCompanyDashboardAlerts.length > 0 ? (
                      resolvedCompanyDashboardAlerts.map((alert) => (
                        <article className="company-dashboard-alerts__item" key={alert}>
                          <span className="company-dashboard-alerts__icon" aria-hidden="true">
                            !
                          </span>
                          <p>{alert}</p>
                        </article>
                      ))
                    ) : (
                      <div className="company-dashboard-alerts__empty">
                        <p>현재 표시할 부정행위 알림이 없습니다.</p>
                      </div>
                    )}
                  </div>
                </article>
              </section>

              <section className="company-dashboard-card company-dashboard-chart">
                <div className="company-dashboard-chart__header">
                  <h2>크레딧 소진 추이 (30d)</h2>
                  {resolvedCompanyDashboardDailyAverage !== null ? (
                    <p>
                      {`최근 ${resolvedCompanyDashboardWldUsage.length}일 기준 일 평균 $${formatCompanyCreateCredit(resolvedCompanyDashboardDailyAverage)}`}
                    </p>
                  ) : null}
                </div>

                {resolvedCompanyDashboardWldUsage.length > 0 ? (
                  <div className="company-dashboard-chart__bars" aria-label="크레딧 소진 추이 막대 차트">
                    {resolvedCompanyDashboardWldUsage.map((value, index) => (
                      <div className="company-dashboard-chart__bar-group" key={`${value}-${index}`}>
                        <span>{value}</span>
                        <div
                          className="company-dashboard-chart__bar"
                          style={{ height: `${Math.max(24, (value / wldUsageMax) * 82)}px` }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="company-dashboard-chart__empty">
                    <p>아직 크레딧 소진 이력이 없습니다.</p>
                  </div>
                )}
              </section>
            </>
          ) : companyDashboardView === 'jobs' ? (
            <>
              <section className="company-job-board-toolbar company-dashboard-card">
                <div className="company-job-board-toolbar__left">
                  <label className="company-job-board-toolbar__select">
                    <span className="sr-only">공고 유형 선택</span>
                    <select
                      value={companyJobTypeFilter}
                      onChange={(event) => setCompanyJobTypeFilter(event.target.value as CompanyJobTypeFilter)}
                    >
                      {companyJobTypeFilters.map((filter) => (
                        <option key={filter.key} value={filter.key}>
                          {`유형 ${filter.label}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="company-job-board-toolbar__filters" aria-label="공고 상태 필터">
                    {companyJobStatusFilters.map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        className={`company-job-board-toolbar__filter${companyJobStatusFilter === filter.key ? ' company-job-board-toolbar__filter--active' : ''}`}
                        onClick={() => setCompanyJobStatusFilter(filter.key)}
                      >
                        {resolvedCompanyJobStatusFilters.find((item) => item.label.startsWith(filter.label))?.label ?? filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="company-job-board-toolbar__right">
                  <label className="company-job-board-toolbar__search">
                    <span className="sr-only">공고명 검색</span>
                    <input
                      type="text"
                      placeholder="공고명 검색"
                      value={companyJobSearch}
                      onChange={(event) => setCompanyJobSearch(event.target.value)}
                    />
                  </label>

                  <button
                    type="button"
                    className="company-job-board-toolbar__cta"
                    onClick={openCompanyCreate}
                  >
                    + 새로운 공고
                  </button>
                </div>
              </section>

              {resolvedCompanyJobListings.length > 0 ? (
                <section className="company-job-board-table company-dashboard-card">
                  {visibleCompanyJobListings.length > 0 ? (
                    <div className="company-job-board-table__scroller" role="table" aria-label="공고 목록">
                      <div className="company-job-board-table__row company-job-board-table__row--head" role="row">
                        <span role="columnheader">공고</span>
                        <span role="columnheader">유형</span>
                        <span role="columnheader">기간</span>
                        <span role="columnheader">지원자</span>
                        <span role="columnheader">상태</span>
                        <span role="columnheader">부정</span>
                        <span role="columnheader" aria-hidden="true" />
                      </div>

                      {visibleCompanyJobListings.map((job, index) => (
                        <div
                          className={`company-job-board-table__row${index % 2 === 1 ? ' company-job-board-table__row--striped' : ''}`}
                          role="row"
                          key={job.id}
                        >
                          <strong role="cell">{job.title}</strong>
                          <span role="cell">{job.type}</span>
                          <span role="cell">{job.period}</span>
                          <span role="cell">{job.applicants}</span>
                          <div role="cell">
                            <span className={`company-job-board-table__status company-job-board-table__status--${job.statusTone}`}>
                              {job.status}
                            </span>
                          </div>
                          <div role="cell">
                            <span className={`company-job-board-table__fraud${job.fraudCount ? ' company-job-board-table__fraud--alert' : ''}`}>
                              {job.fraudCount ? `▲ ${job.fraudCount}` : '—'}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="company-job-board-table__report"
                            role="cell"
                            onClick={() => openCompanyReport(job)}
                          >
                            리포트 보기 →
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="company-dashboard-empty-state company-dashboard-empty-state--jobs"
                      aria-label="공고 검색 결과 없음"
                    >
                      <p>선택한 조건에 맞는 공고가 없습니다.</p>
                    </div>
                  )}
                </section>
              ) : (
                <div
                  className="company-dashboard-empty-state company-dashboard-empty-state--jobs company-dashboard-empty-state--centered"
                  aria-label="공고 목록 빈 상태"
                  style={{ minHeight: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <p>아직 생성된 공고가 없습니다.</p>
                </div>
              )}
            </>
          ) : companyDashboardView === 'blind' ? (
            <>
              <section className="company-blind-toolbar company-dashboard-card">
                <label className="company-blind-toolbar__search">
                  <span className="sr-only">공고명 검색</span>
                  <input
                    type="text"
                    placeholder="공고명 검색…"
                    value={companyBlindSelectionSearch}
                    onChange={(event) => setCompanyBlindSelectionSearch(event.target.value)}
                  />
                </label>

                <div className="company-blind-toolbar__filters" aria-label="블라인드 선발 필터">
                  {companyBlindSelectionTypeFilters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      className={`company-blind-toolbar__filter${companyBlindSelectionTypeFilter === filter.key ? ' company-blind-toolbar__filter--active' : ''}`}
                      onClick={() => setCompanyBlindSelectionTypeFilter(filter.key)}
                    >
                      {filter.label}
                    </button>
                  ))}

                  {companyBlindSelectionStatusFilters
                    .filter((filter) => filter.key !== 'all')
                    .map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        className={`company-blind-toolbar__filter${companyBlindSelectionStatusFilter === filter.key ? ' company-blind-toolbar__filter--active' : ''}`}
                        onClick={() => setCompanyBlindSelectionStatusFilter(filter.key)}
                      >
                        {filter.label}
                      </button>
                    ))}
                </div>
              </section>

              {visibleCompanyBlindSelectionCards.length > 0 ? (
                <section className="company-blind-grid" aria-label="블라인드 선발 목록">
                  {visibleCompanyBlindSelectionCards.map((item) => (
                    <article key={item.id} className="company-blind-card company-dashboard-card">
                      <span className="company-blind-card__badge">{item.badge}</span>
                      <strong>{item.title}</strong>
                      <button
                        type="button"
                        className="company-blind-card__cta"
                        onClick={() => openCompanyBlindRanking(item)}
                      >
                        블라인드 랭킹 보기
                      </button>
                    </article>
                  ))}
                </section>
              ) : (
                <section className="company-dashboard-empty-state company-dashboard-empty-state--blind" aria-label="블라인드 선발 빈 상태">
                  <p>표시할 블라인드 선발 데이터가 없습니다.</p>
                </section>
              )}
            </>
          ) : companyDashboardView === 'blindRanking' ? (
            <>
              {visibleCompanyBlindRankingRows.length > 0 ? (
                <>
                  <section className="company-blind-ranking-summary company-dashboard-card">
                    <div className="company-blind-ranking-summary__copy">
                      <span className="company-blind-ranking-summary__badge">블라인드 모드 · 신원 정보 완전 비공개</span>
                      <strong>{selectedCompanyBlindCard?.title ?? '선택된 공고가 없습니다.'}</strong>
                      <p>
                        {selectedCompanyBlindCard
                          ? `${companyBlindRankingRows.length}명 평가 완료 · 상위 N명 선발 후 매칭 동의 알림 발송`
                          : '블라인드 랭킹을 볼 공고를 먼저 선택해주세요.'}
                      </p>
                    </div>

                    <div className="company-blind-ranking-summary__actions">
                      <button
                        type="button"
                        className={`company-blind-ranking-summary__filter${companyBlindRankingHumanFilter !== 'all' ? ' company-blind-toolbar__filter--active' : ''}`}
                        onClick={cycleCompanyBlindRankingHumanFilter}
                      >
                        {companyBlindRankingHumanFilter === 'all'
                          ? '인간 인증 여부'
                          : companyBlindRankingHumanFilter === 'verified'
                            ? '인간 인증: 인증됨'
                            : '인간 인증: 미인증'}
                      </button>
                      <button
                        type="button"
                        className="company-blind-ranking-summary__filter"
                        onClick={toggleCompanyBlindRankingSortOrder}
                      >
                        {`정렬: 종합 점수 ${companyBlindRankingSortOrder === 'desc' ? '↓' : '↑'}`}
                      </button>
                      <button
                        type="button"
                        className={`company-blind-ranking-summary__filter${isCompanyBlindRankingMinimumScoreEnabled ? ' company-blind-toolbar__filter--active' : ''}`}
                        onClick={toggleCompanyBlindRankingMinimumScore}
                      >
                        {isCompanyBlindRankingMinimumScoreEnabled ? '점수 최소 75 ↑' : '점수 전체 보기'}
                      </button>
                      <button
                        type="button"
                        className="company-blind-ranking-summary__notify"
                        onClick={openCompanyBlindRankingNotifyModal}
                        disabled={selectedCompanyBlindRankingCount === 0}
                      >
                        {`선택 ${selectedCompanyBlindRankingCount}명 · 알림 발송`}
                      </button>
                    </div>
                  </section>

                  <section className="company-blind-ranking-board company-dashboard-card" aria-label="블라인드 랭킹 목록">
                    <div className="company-blind-ranking-board__scroller">
                      <div
                        className="company-blind-ranking-board__row company-blind-ranking-board__row--head"
                        style={{ gridTemplateColumns: companyBlindRankingGridTemplate }}
                      >
                        <span>#</span>
                        <span>익명 ID</span>
                        <span>인간 인증</span>
                        <span>종합</span>
                        {companyBlindRankingMetricLabels.map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                        <span>Integrity 5%</span>
                        <span>선택</span>
                      </div>

                      {visibleCompanyBlindRankingRows.map((candidate, index) => (
                        <div
                          key={candidate.id}
                          className={`company-blind-ranking-board__row company-blind-ranking-board__row--interactive${selectedCompanyBlindRankingCandidateId === candidate.id ? ' company-blind-ranking-board__row--active' : ''}`}
                          style={{ gridTemplateColumns: companyBlindRankingGridTemplate }}
                          role="button"
                          tabIndex={0}
                          aria-label={`${candidate.anonymousId} 상세 보기`}
                          onClick={() => openCompanyBlindRankingDetail(candidate.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openCompanyBlindRankingDetail(candidate.id);
                            }
                          }}
                        >
                          <strong>{index + 1}</strong>
                          <div className="company-blind-ranking-board__identity">
                            <span className="company-blind-ranking-board__avatar" aria-hidden="true" />
                            <span>{candidate.anonymousId}</span>
                          </div>
                          <span
                            className={`company-blind-ranking-board__human${candidate.humanVerified ? ' company-blind-ranking-board__human--positive' : ' company-blind-ranking-board__human--negative'}`}
                          >
                            {candidate.humanVerified ? '인증됨' : '인증 안 됨'}
                          </span>
                          <strong>{candidate.overallScore.toFixed(1)}</strong>
                          {candidate.metrics.map((metric) => (
                            <div key={`${candidate.id}-${metric.label}`} className="company-blind-ranking-board__metric">
                              <div className="company-blind-ranking-board__track">
                                <span style={{ width: `${metric.score}%` }} />
                              </div>
                              <em>{metric.score}</em>
                            </div>
                          ))}
                          <span
                            className={`company-blind-ranking-board__integrity${candidate.integrityScore >= 90 ? ' company-blind-ranking-board__integrity--positive' : ' company-blind-ranking-board__integrity--negative'}`}
                          >
                            {candidate.integrityScore}
                          </span>
                          <button
                            type="button"
                            className="company-blind-ranking-board__selection-wrap"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleCompanyBlindRankingSelection(candidate.id);
                            }}
                            aria-pressed={candidate.selected}
                          >
                            <span
                              className={`company-blind-ranking-board__selection-box${candidate.selected ? ' company-blind-ranking-board__selection-box--active' : ''}`}
                              aria-hidden="true"
                            >
                              {candidate.selected ? '✓' : ''}
                            </span>
                            <span
                              className={`company-blind-ranking-board__selection${candidate.selected ? ' company-blind-ranking-board__selection--active' : ''}`}
                            >
                              {candidate.selected ? '선택됨' : '선택'}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <div
                  className="company-dashboard-empty-state company-dashboard-empty-state--blind-ranking company-dashboard-empty-state--centered"
                  aria-label="블라인드 랭킹 빈 상태"
                  style={{ minHeight: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <p>표시할 블라인드 랭킹 데이터가 없습니다.</p>
                </div>
              )}
            </>
          ) : companyDashboardView === 'fraud' ? (
            <>
              <section className="company-fraud-hero">
                <div className="company-fraud-hero__icon" aria-hidden="true">
                  🛡
                </div>
                <div className="company-fraud-hero__copy">
                  <h2>{`실시간 감지 · ${resolvedPendingFraudCount}건 미처리`}</h2>
                  <p>Integrity Monitor가 AI 대필·표절·행동 이상 패턴을 실시간으로 탐지합니다.</p>
                </div>
              </section>

              <section className="company-fraud-layout">
                <article className="company-fraud-board company-dashboard-card">
                  <div className="company-fraud-board__header">
                    <h2>감지 케이스</h2>

                    <div className="company-fraud-board__filters" aria-label="부정 알림 상태 필터">
                      {resolvedCompanyFraudFilterOptions.map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          className={`company-fraud-board__filter${companyFraudFilter === filter.key ? ' company-fraud-board__filter--active' : ''}`}
                          onClick={() => {
                            setCompanyFraudFilter(filter.key);
                            setSelectedCompanyFraudCaseId(
                              resolvedCompanyFraudCases.find((item) => item.status === filter.key)?.id ??
                                resolvedCompanyFraudCases[0].id,
                            );
                          }}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="company-fraud-board__list">
                    {visibleCompanyFraudCases.length > 0 ? (
                      visibleCompanyFraudCases.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`company-fraud-case${selectedCompanyFraudCase?.id === item.id ? ' company-fraud-case--active' : ''}`}
                          onClick={() => setSelectedCompanyFraudCaseId(item.id)}
                        >
                          <span className="company-fraud-case__flag" aria-hidden="true">
                            ⚠
                          </span>

                          <span className="company-fraud-case__body">
                            <strong>{item.title}</strong>
                            <span className="company-fraud-case__meta">
                              <span className="company-fraud-case__issue">{item.issue}</span>
                              <span
                                className={`company-fraud-case__severity company-fraud-case__severity--${item.severity}`}
                              >
                                {getCompanyFraudSeverityLabel(item.severity)}
                              </span>
                            </span>
                            <span className="company-fraud-case__time">{item.timestamp}</span>
                          </span>

                          <span className="company-fraud-case__confidence">
                            <span>신뢰도</span>
                            <span className="company-fraud-case__track" aria-hidden="true">
                              <span
                                className={`company-fraud-case__track-fill company-fraud-case__track-fill--${item.severity}`}
                                style={{ width: `${item.confidence}%` }}
                              />
                            </span>
                            <strong className={`company-fraud-case__percent company-fraud-case__percent--${item.severity}`}>
                              {`${item.confidence}%`}
                            </strong>
                          </span>
                        </button>
                      ))
                    ) : (
                      <section className="company-dashboard-empty-state company-dashboard-empty-state--fraud" aria-label="부정 사례 빈 상태">
                        <p>표시할 부정 사례가 없습니다.</p>
                      </section>
                    )}
                  </div>
                </article>

                <aside className="company-fraud-detail company-dashboard-card">
                  {selectedCompanyFraudCase ? (
                    <>
                      <h3>{`상세 — ${selectedCompanyFraudCase.detailId}`}</h3>
                      <span
                        className={`company-fraud-detail__badge company-fraud-detail__badge--${selectedCompanyFraudCase.severity}`}
                      >
                        {`${selectedCompanyFraudCase.issue} · ${getCompanyFraudSeverityLabel(selectedCompanyFraudCase.severity)} (${selectedCompanyFraudCase.confidence}%)`}
                      </span>

                      <div className="company-fraud-detail__section">
                        <h4>{`📸 ${selectedCompanyFraudCase.evidenceTitle}`}</h4>
                        <div className="company-fraud-detail__evidences">
                          {selectedCompanyFraudCase.evidences.map((evidence) => (
                            <div className="company-fraud-detail__evidence" key={evidence}>
                              <p>{evidence}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="company-fraud-detail__section company-fraud-detail__section--logs">
                        <h4>🧬 행동 로그 요약</h4>
                        <ul className="company-fraud-detail__logs">
                          {selectedCompanyFraudCase.behaviorLogs.map((log) => (
                            <li key={log}>{log}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="company-fraud-detail__section company-fraud-detail__section--actions">
                        <h4>조치 선택</h4>
                        <button
                          type="button"
                          className="company-fraud-detail__action company-fraud-detail__action--primary"
                          onClick={() => handleCompanyFraudCaseAction(selectedCompanyFraudCase.id, 'resolved')}
                        >
                          🚫 제출 무효 처리
                        </button>
                        <button
                          type="button"
                          className="company-fraud-detail__action"
                          onClick={() => handleCompanyFraudCaseAction(selectedCompanyFraudCase.id, 'dismissed')}
                        >
                          기각 (오탐으로 판단)
                        </button>
                      </div>
                    </>
                  ) : (
                    <section className="company-dashboard-empty-state company-dashboard-empty-state--fraud-detail" aria-label="부정 사례 상세 빈 상태">
                      <p>상세 정보를 표시할 부정 사례가 없습니다.</p>
                    </section>
                  )}
                </aside>
              </section>
            </>
          ) : companyDashboardView === 'credit' ? (
            <section className="company-credit-layout">
              <article className="company-credit-balance company-dashboard-card">
                <span className="company-credit-balance__label">현재 보유 크레딧</span>
                <strong className="company-credit-balance__value">{`$ ${resolvedCompanyCreditBalance.toLocaleString()}`}</strong>
              </article>

              <article className="company-credit-balance company-dashboard-card company-credit-balance--usage">
                <span className="company-credit-balance__label">이번 달 사용 크레딧</span>
                <strong className="company-credit-balance__value">{`$ ${resolvedCompanyCreditMonthlyUsage.toLocaleString()}`}</strong>
              </article>

              <article className="company-credit-history company-dashboard-card">
                <div className="company-credit-card__header">
                  <h2>충전 내역</h2>
                  <button type="button" className="company-credit-card__filter">
                    3개월 · 전체 · 최신순
                  </button>
                </div>

                <div className="company-credit-history__table" role="table" aria-label="충전 내역">
                  {resolvedCompanyCreditHistory.length > 0 ? (
                    <>
                      <div className="company-credit-history__row company-credit-history__row--head" role="row">
                        <span role="columnheader">일시</span>
                        <span role="columnheader">금액</span>
                      </div>

                      {resolvedCompanyCreditHistory.map((item) => (
                        <div className="company-credit-history__row" role="row" key={`${item.timestamp}-${item.amount}`}>
                          <span role="cell">{item.timestamp}</span>
                          <strong role="cell">{item.amount}</strong>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="company-credit-history__empty">
                      <p>아직 충전 내역이 없습니다.</p>
                    </div>
                  )}
                </div>
              </article>

              <article className="company-credit-recharge company-dashboard-card">
                <div className="company-credit-card__header company-credit-card__header--stacked">
                  <h2>충전하기</h2>
                  {shouldShowCompanyMiniAppCreditPayment ? (
                    <p>World App 결제를 통해 크레딧을 안전하게 충전합니다.</p>
                  ) : null}
                </div>

                {shouldShowCompanyMiniAppCreditPayment ? (
                  <>
                    <div className="company-credit-recharge__method-row">
                      <div className="company-credit-field company-credit-field--method">
                        <span>충전 방법</span>
                        <div className="company-credit-field__options" role="group" aria-label="충전 방법 선택">
                          {resolvedCompanyCreditPaymentOptions.length > 0 ? (
                            resolvedCompanyCreditPaymentOptions.map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                className={`company-credit-field__box company-credit-field__box--select${selectedCompanyCreditPaymentOption?.key === option.key ? ' company-credit-field__box--active' : ''}`}
                                aria-pressed={selectedCompanyCreditPaymentOption?.key === option.key}
                                onClick={() => setCompanyCreditCurrency(option.key)}
                              >
                                {option.label}
                              </button>
                            ))
                          ) : (
                            <div className="company-credit-field__box company-credit-field__box--muted">
                              사용 가능한 결제 토큰이 없습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="company-credit-recharge__amount-row">
                      <label className="company-credit-field">
                        <span>충전할 크레딧</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={companyCreditRechargeAmount}
                          onChange={(event) => {
                            const digitsOnly = event.target.value.replace(/[^0-9]/g, '');
                            setCompanyCreditRechargeAmount(digitsOnly);
                          }}
                          placeholder="숫자만 입력하세요"
                        />
                      </label>

                      <span className="company-credit-recharge__arrow" aria-hidden="true">
                        →
                      </span>

                      <label className="company-credit-field">
                        <span>{`예상 결제 수량 (${selectedCompanyCreditPaymentOption?.label ?? companyCreditCurrency})`}</span>
                        <div className="company-credit-field__box company-credit-field__box--muted">
                          {companyCreditExpectedAmountText}
                        </div>
                      </label>
                    </div>

                    <div className="company-credit-wallet">
                      {resolvedCompanyCreditWalletAddress ? (
                        <>
                          <p>결제 버튼을 누르면 World App에서 아래 수취 주소로 전송 요청이 열립니다.</p>
                          <div className="company-credit-wallet__address">
                            <span>{resolvedCompanyCreditWalletAddress}</span>
                            <button
                              type="button"
                              className="company-credit-wallet__copy"
                              aria-label="지갑 주소 복사"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(resolvedCompanyCreditWalletAddress);
                                  pushCompanyToast('지갑 주소가 복사되었습니다.');
                                } catch {
                                  pushCompanyToast('지갑 주소 복사에 실패했습니다.');
                                }
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <p>충전 주소가 아직 설정되지 않았습니다.</p>
                      )}
                    </div>

                    <div className="company-credit-summary">
                      <strong>충전 크레딧</strong>
                      <span>{companyCreditSummaryText}</span>
                    </div>
                    <p className="company-credit-summary__note">
                      실제 충전되는 크레딧은 입금 시점 토큰 가치에 따라 달라질 수 있습니다.
                    </p>
                    {companyCreditQuoteNote ? (
                      <p className="company-credit-summary__note">{companyCreditQuoteNote}</p>
                    ) : null}

                    <div className="company-credit-actions">
                      <button
                        type="button"
                        className="company-credit-actions__primary"
                        onClick={handleCompanyCreditRecharge}
                        disabled={
                          isCompanyCreditSubmitting ||
                          isCompanyCreditStatusRefreshing ||
                          !selectedCompanyCreditPaymentOption
                        }
                      >
                        {isCompanyCreditSubmitting
                          ? '결제 요청 생성 중...'
                          : isCompanyCreditStatusRefreshing
                            ? '상태 확인 중...'
                            : companyCreditPrimaryActionLabel}
                      </button>

                      {visibleCompanyCreditActiveCharge ? (
                        <button
                          type="button"
                          className="company-credit-actions__secondary"
                          onClick={() => refreshCompanyCreditStatus(visibleCompanyCreditActiveCharge.id)}
                          disabled={isCompanyCreditStatusRefreshing}
                        >
                          상태 다시 확인
                        </button>
                      ) : null}
                    </div>

                    {visibleCompanyCreditActiveCharge ? (
                      <div className="company-credit-status" role="status" aria-live="polite">
                        <div className="company-credit-status__header">
                          <strong>최근 결제 요청</strong>
                          {companyCreditStatusLabel ? (
                            <span className={`company-credit-status__badge company-credit-status__badge--${visibleCompanyCreditActiveCharge.status}`}>
                              {companyCreditStatusLabel}
                            </span>
                          ) : null}
                        </div>

                        <div className="company-credit-status__details">
                          <span>{`$ ${visibleCompanyCreditActiveCharge.creditUsd.toLocaleString()} 충전`}</span>
                          <span>{`${visibleCompanyCreditActiveCharge.paymentToken.amountDisplay} ${visibleCompanyCreditActiveCharge.paymentToken.label}`}</span>
                          <span>{`reference · ${visibleCompanyCreditActiveCharge.reference}`}</span>
                          {visibleCompanyCreditActiveCharge.transactionHash ? (
                            <span>{`tx hash · ${visibleCompanyCreditActiveCharge.transactionHash}`}</span>
                          ) : null}
                          {visibleCompanyCreditActiveCharge.failureReason ? (
                            <span>{visibleCompanyCreditActiveCharge.failureReason}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div className="company-credit-recharge__method-row">
                      <div className="company-credit-field company-credit-field--method">
                        <span>충전 방법</span>
                        <div className="company-credit-field__options" role="group" aria-label="충전 방법 선택">
                          {resolvedCompanyCreditPaymentOptions.length > 0 ? (
                            resolvedCompanyCreditPaymentOptions.map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                className={`company-credit-field__box company-credit-field__box--select${selectedCompanyCreditPaymentOption?.key === option.key ? ' company-credit-field__box--active' : ''}`}
                                aria-pressed={selectedCompanyCreditPaymentOption?.key === option.key}
                                onClick={() => setCompanyCreditCurrency(option.key)}
                              >
                                {option.label}
                              </button>
                            ))
                          ) : (
                            <div className="company-credit-field__box company-credit-field__box--muted">
                              사용 가능한 결제 토큰이 없습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="company-credit-recharge__amount-row">
                      <label className="company-credit-field">
                        <span>충전할 크레딧</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={companyCreditRechargeAmount}
                          onChange={(event) => {
                            const digitsOnly = event.target.value.replace(/[^0-9]/g, '');
                            setCompanyCreditRechargeAmount(digitsOnly);
                          }}
                          placeholder="숫자만 입력하세요"
                        />
                      </label>

                      <span className="company-credit-recharge__arrow" aria-hidden="true">
                        →
                      </span>

                      <label className="company-credit-field">
                        <span>{`예상 결제 수량 (${selectedCompanyCreditPaymentOption?.label ?? companyCreditCurrency})`}</span>
                        <div className="company-credit-field__box company-credit-field__box--muted">
                          {companyCreditExpectedAmountText}
                        </div>
                      </label>
                    </div>

                    <div className="company-credit-wallet">
                      {visibleCompanyCreditActiveCharge?.depositAddress ? (
                        <>
                          <p>아래 1회용 주소로 토큰을 전송해 주세요.</p>
                          <div className="company-credit-wallet__address">
                            <span>{visibleCompanyCreditActiveCharge.depositAddress}</span>
                            <button
                              type="button"
                              className="company-credit-wallet__copy"
                              aria-label="지갑 주소 복사"
                              onClick={async () => {
                                const depositAddress = visibleCompanyCreditActiveCharge.depositAddress;

                                if (!depositAddress) {
                                  pushCompanyToast('입금 주소를 다시 생성해 주세요.');
                                  return;
                                }

                                try {
                                  await navigator.clipboard.writeText(depositAddress);
                                  pushCompanyToast('지갑 주소가 복사되었습니다.');
                                } catch {
                                  pushCompanyToast('지갑 주소 복사에 실패했습니다.');
                                }
                              }}
                            />
                          </div>
                          <p>입금이 감지되면 블록 확인 후 크레딧이 자동으로 반영됩니다.</p>
                        </>
                      ) : (
                        <p>충전 금액과 토큰을 정한 뒤 1회용 입금 주소를 생성해 주세요.</p>
                      )}
                    </div>

                    <div className="company-credit-summary">
                      <strong>충전 크레딧</strong>
                      <span>{companyCreditSummaryText}</span>
                    </div>
                    <p className="company-credit-summary__note">
                      실제 충전되는 크레딧은 입금 시점 토큰 가치에 따라 달라질 수 있습니다.
                    </p>
                    {companyCreditQuoteNote ? (
                      <p className="company-credit-summary__note">{companyCreditQuoteNote}</p>
                    ) : null}

                    <div className="company-credit-actions">
                      <button
                        type="button"
                        className="company-credit-actions__primary"
                        onClick={handleCompanyCreditRecharge}
                        disabled={
                          isCompanyCreditSubmitting ||
                          isCompanyCreditStatusRefreshing ||
                          !selectedCompanyCreditPaymentOption
                        }
                      >
                        {isCompanyCreditSubmitting
                          ? '입금 주소 생성 중...'
                          : isCompanyCreditStatusRefreshing
                            ? '상태 확인 중...'
                            : companyCreditPrimaryActionLabel}
                      </button>

                      {visibleCompanyCreditActiveCharge ? (
                        <button
                          type="button"
                          className="company-credit-actions__secondary"
                          onClick={() => refreshCompanyCreditStatus(visibleCompanyCreditActiveCharge.id)}
                          disabled={isCompanyCreditStatusRefreshing}
                        >
                          상태 다시 확인
                        </button>
                      ) : null}
                    </div>

                    {visibleCompanyCreditActiveCharge ? (
                      <div className="company-credit-status" role="status" aria-live="polite">
                        <div className="company-credit-status__header">
                          <strong>최근 입금 요청</strong>
                          {companyCreditStatusLabel ? (
                            <span className={`company-credit-status__badge company-credit-status__badge--${visibleCompanyCreditActiveCharge.status}`}>
                              {companyCreditStatusLabel}
                            </span>
                          ) : null}
                        </div>

                        <div className="company-credit-status__details">
                          <span>{`요청 크레딧 · $ ${visibleCompanyCreditActiveCharge.creditUsd.toLocaleString()}`}</span>
                          <span>{`입금 토큰 · ${visibleCompanyCreditActiveCharge.paymentToken.amountDisplay} ${visibleCompanyCreditActiveCharge.paymentToken.label}`}</span>
                          <span>{`reference · ${visibleCompanyCreditActiveCharge.reference}`}</span>
                          {visibleCompanyCreditActiveCharge.depositAddress ? (
                            <span>{`입금 주소 · ${visibleCompanyCreditActiveCharge.depositAddress}`}</span>
                          ) : null}
                          {visibleCompanyCreditActiveCharge.receivedTokenAmountDisplay ? (
                            <span>{`감지된 입금 · ${visibleCompanyCreditActiveCharge.receivedTokenAmountDisplay} ${visibleCompanyCreditActiveCharge.paymentToken.label}`}</span>
                          ) : null}
                          {visibleCompanyCreditActiveCharge.quotedTokenPriceUsd != null ? (
                            <span>{`확인 시세 · $${visibleCompanyCreditActiveCharge.quotedTokenPriceUsd.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 6,
                            })} / ${visibleCompanyCreditActiveCharge.paymentToken.label}`}</span>
                          ) : null}
                          {visibleCompanyCreditActiveCharge.quotedAmountUsd != null ? (
                            <span>{`평가 금액 · $${visibleCompanyCreditActiveCharge.quotedAmountUsd.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}`}</span>
                          ) : null}
                          {visibleCompanyCreditActiveCharge.creditedUsd != null ? (
                            <span>{`반영 크레딧 · $${visibleCompanyCreditActiveCharge.creditedUsd.toLocaleString('en-US')}`}</span>
                          ) : null}
                          {companyCreditDetectedAtLabel ? (
                            <span>{`감지 시각 · ${companyCreditDetectedAtLabel}`}</span>
                          ) : null}
                          {visibleCompanyCreditActiveCharge.transactionHash ? (
                            <span>{`tx hash · ${visibleCompanyCreditActiveCharge.transactionHash}`}</span>
                          ) : null}
                          {visibleCompanyCreditActiveCharge.failureReason ? (
                            <span>{visibleCompanyCreditActiveCharge.failureReason}</span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            </section>
          ) : companyDashboardView === 'settings' ? (
            <section className="company-settings-layout">
              <div className="company-settings-stack">
                <article className="company-settings-card company-dashboard-card">
                  <div className="company-settings-card__header">
                    <div className="company-settings-card__title-row">
                      <h2>기본 정보</h2>
                      <span
                        className={`company-settings-card__badge company-settings-card__badge--${companyVerificationBadge.tone}`}
                      >
                        {companyVerificationBadge.label}
                      </span>
                    </div>
                    <p>기업/ 주최자의 기본 정보를 입력하세요.</p>
                  </div>

                  <div className="company-settings-form">
                    <label className="company-settings-field company-settings-field--single">
                      <span>기업명 / 주최자명</span>
                      <input
                        type="text"
                        value={companySettingsForm.companyName}
                        onChange={handleCompanySettingsChange('companyName')}
                      />
                      <small className="company-settings-field__hint">
                        정보를 변경할 경우 재인증이 필요할 수 있습니다.
                      </small>
                    </label>

                    <div className="company-settings-form__row">
                      <label className="company-settings-field">
                        <span>기업 이메일</span>
                        <input
                          type="email"
                          value={companySettingsForm.companyEmail}
                          disabled
                        />
                      </label>

                      <label className="company-settings-field">
                        <span>문의 연락처</span>
                        <input
                          type="text"
                          value={companySettingsForm.contact}
                          onChange={handleCompanySettingsChange('contact')}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="company-settings-card__divider" aria-hidden="true" />
                </article>

                <article className="company-settings-card company-dashboard-card company-settings-card--verification">
                  <div className="company-settings-card__header">
                    <h2>기업 / 주최자 인증</h2>
                    <p>인증에 필요한 문서를 등록하세요. 심사가 완료되면 등록된 이메일로 알려드리겠습니다.</p>
                    <p>인증이 완료되면 공고 노출 우선순위가 올라갑니다.</p>
                  </div>

                  <div className="company-settings-field company-settings-field--single company-settings-language company-settings-verification__country">
                    <span>소재 국가</span>
                    <div
                      className={`company-settings-language__control${isCompanyVerificationCountryDropdownOpen ? ' company-settings-language__control--open' : ''}`}
                    >
                      <button
                        type="button"
                        className="company-settings-language__trigger"
                        aria-haspopup="listbox"
                        aria-expanded={isCompanyVerificationCountryDropdownOpen}
                        onClick={() =>
                          setIsCompanyVerificationCountryDropdownOpen((current) => !current)
                        }
                      >
                        <span className="company-settings-language__value">
                          {companyVerificationCountryOptions.find((option) => option.key === companyVerificationForm.country)?.label}
                        </span>
                        <span
                          className={`company-settings-language__chevron${isCompanyVerificationCountryDropdownOpen ? ' company-settings-language__chevron--open' : ''}`}
                          aria-hidden="true"
                        />
                      </button>

                      {isCompanyVerificationCountryDropdownOpen ? (
                        <div
                          className="company-settings-language__dropdown"
                          role="listbox"
                          aria-label="소재 국가 목록"
                        >
                          {companyVerificationCountryOptions
                            .filter((option) => option.key !== companyVerificationForm.country)
                            .map((option) => (
                              <button
                                key={option.key}
                                type="button"
                                role="option"
                                aria-selected={false}
                                className={`company-settings-language__option company-settings-verification__country-option${option.available ? '' : ' company-settings-verification__country-option--disabled'}`}
                                onClick={
                                  option.available
                                    ? () => handleCompanyVerificationCountrySelect(option.key)
                                    : undefined
                                }
                                disabled={!option.available}
                              >
                                <span>{option.label}</span>
                                {option.available ? null : (
                                  <small className="company-settings-verification__country-badge">준비중</small>
                                )}
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="company-settings-verification__toggle-group" aria-label="인증 유형 선택">
                    <button
                      type="button"
                      className={`company-settings-verification__toggle${companyVerificationForm.verificationType === 'company' ? ' company-settings-verification__toggle--active' : ''}`}
                      onClick={() => handleCompanyVerificationTypeChange('company')}
                    >
                      기업 인증
                    </button>
                    <button
                      type="button"
                      className={`company-settings-verification__toggle${companyVerificationForm.verificationType === 'organizer' ? ' company-settings-verification__toggle--active' : ''}`}
                      onClick={() => handleCompanyVerificationTypeChange('organizer')}
                    >
                      주최자 인증
                    </button>
                  </div>

                  {companyVerificationForm.verificationType === 'company' ? (
                    <div className="company-settings-verification__stack">
                      <div className="company-settings-upload-list">
                        <div className="company-settings-upload">
                          <div className="company-settings-upload__copy">
                            <strong>사업자등록증</strong>
                            <span>사업자등록증 사본을 첨부할 수 있습니다.</span>
                          </div>
                          <label className="company-settings-upload__action">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={handleCompanyVerificationFileChange('companyBusinessCertificateFileName')}
                            />
                            파일 첨부
                          </label>
                          <span className="company-settings-upload__file">
                            {companyVerificationForm.companyBusinessCertificateFileName || '첨부된 파일 없음'}
                          </span>
                        </div>

                        <div className="company-settings-upload">
                          <div className="company-settings-upload__copy">
                            <strong>법인인감증명서</strong>
                            <span>최근 3개월 이내 발급된 법인 인감증명서 사본을 첨부할 수 있습니다.</span>
                          </div>
                          <label className="company-settings-upload__action">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={handleCompanyVerificationFileChange('companyCorporateSealCertificateFileName')}
                            />
                            파일 첨부
                          </label>
                          <span className="company-settings-upload__file">
                            {companyVerificationForm.companyCorporateSealCertificateFileName || '첨부된 파일 없음'}
                          </span>
                        </div>

                        <div className="company-settings-upload">
                          <div className="company-settings-upload__copy">
                            <strong>공문</strong>
                            <span>WorldFit 인증 의사를 확인할 수 있는 공식 문서를 첨부하며, 인감증명서로 증명된 인감의 날인이 필요합니다.</span>
                          </div>
                          <label className="company-settings-upload__action">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={handleCompanyVerificationFileChange('companyOfficialLetterFileName')}
                            />
                            파일 첨부
                          </label>
                          <span className="company-settings-upload__file">
                            {companyVerificationForm.companyOfficialLetterFileName || '첨부된 파일 없음'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="company-settings-verification__stack">
                      <div className="company-settings-upload-list">
                        <div className="company-settings-upload">
                          <div className="company-settings-upload__copy">
                            <strong>사업자등록증</strong>
                            <span>사업자등록증 사본을 첨부할 수 있습니다.</span>
                          </div>
                          <label className="company-settings-upload__action">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={handleCompanyVerificationFileChange('organizerBusinessCertificateFileName')}
                            />
                            파일 첨부
                          </label>
                          <span className="company-settings-upload__file">
                            {companyVerificationForm.organizerBusinessCertificateFileName || '첨부된 파일 없음'}
                          </span>
                        </div>

                        <div className="company-settings-upload">
                          <div className="company-settings-upload__copy">
                            <strong>사용인감증명서</strong>
                            <span>최근 3개월 이내 발급된 사용인감증명서 사본을 첨부할 수 있습니다.</span>
                          </div>
                          <label className="company-settings-upload__action">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={handleCompanyVerificationFileChange('organizerUsageSealCertificateFileName')}
                            />
                            파일 첨부
                          </label>
                          <span className="company-settings-upload__file">
                            {companyVerificationForm.organizerUsageSealCertificateFileName || '첨부된 파일 없음'}
                          </span>
                        </div>

                        <div className="company-settings-upload">
                          <div className="company-settings-upload__copy">
                            <strong>공문</strong>
                            <span>WorldFit 인증 의사를 확인할 수 있는 공식 문서를 첨부하며, 인감증명서로 증명된 인감의 날인이 필요합니다.</span>
                          </div>
                          <label className="company-settings-upload__action">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={handleCompanyVerificationFileChange('organizerOfficialLetterFileName')}
                            />
                            파일 첨부
                          </label>
                          <span className="company-settings-upload__file">
                            {companyVerificationForm.organizerOfficialLetterFileName || '첨부된 파일 없음'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="company-settings-card__divider" aria-hidden="true" />
                </article>

                <article className="company-settings-card company-dashboard-card company-settings-card--system">
                  <div className="company-settings-card__header">
                    <h2>시스템 설정</h2>
                  </div>

                  <div className="company-settings-field company-settings-field--single company-settings-language">
                    <span>언어 설정</span>
                    <div
                      className={`company-settings-language__control${isCompanyLanguageDropdownOpen ? ' company-settings-language__control--open' : ''}`}
                    >
                      <button
                        type="button"
                        className="company-settings-language__trigger"
                        aria-haspopup="listbox"
                        aria-expanded={isCompanyLanguageDropdownOpen}
                        onClick={() => setIsCompanyLanguageDropdownOpen((current) => !current)}
                      >
                        <span className="company-settings-language__value">
                          {companySettingsForm.language || '언어 미설정'}
                        </span>
                        <span
                          className={`company-settings-language__chevron${isCompanyLanguageDropdownOpen ? ' company-settings-language__chevron--open' : ''}`}
                          aria-hidden="true"
                        />
                      </button>

                      {isCompanyLanguageDropdownOpen ? (
                        <div
                          className="company-settings-language__dropdown"
                          role="listbox"
                          aria-label="언어 설정 목록"
                        >
                          {companySettingsLanguageOptions
                            .filter((option) => option !== companySettingsForm.language)
                            .map((option) => (
                              <button
                                key={option}
                                type="button"
                                role="option"
                                aria-selected={false}
                                className="company-settings-language__option"
                                onClick={() => handleCompanySettingsLanguageSelect(option)}
                              >
                                {option}
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="company-settings-card__divider" aria-hidden="true" />
                </article>
              </div>

              <aside className="company-settings-actions company-dashboard-card">
                <button
                  type="button"
                  className="company-settings-actions__secondary"
                  onClick={handleCompanySettingsExit}
                >
                  저장 없이 나가기
                </button>
                <button
                  type="button"
                  className="company-settings-actions__primary"
                  onClick={handleCompanySettingsSave}
                >
                  저장
                </button>
              </aside>
            </section>
          ) : companyDashboardView === 'create' ? (
            <>
              <section className="company-create-steps company-dashboard-card" aria-label="세션 생성 단계">
                {companyCreateSteps.map((item, index) => (
                  <div className="company-create-steps__item" key={item.step}>
                    <div
                      className={`company-create-steps__circle${item.step <= companyCreateStep ? ' company-create-steps__circle--active' : ''}`}
                    >
                      {item.step}
                    </div>
                    <div className={`company-create-steps__copy${item.step <= companyCreateStep ? ' company-create-steps__copy--active' : ''}`}>
                      <span>{`Step ${item.step}`}</span>
                      <strong>{item.title}</strong>
                    </div>
                    {index < companyCreateSteps.length - 1 ? (
                      <div
                        className={`company-create-steps__line${item.step < companyCreateStep ? ' company-create-steps__line--active' : ''}`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                ))}
              </section>

              {companyCreateStep === 1 ? (
                <section className="company-create-form company-dashboard-card">
                  <div className="company-create-form__header">
                    <h2>기본 설정</h2>
                    <p>세션의 유형, 이름, 기간, 참여 인원을 입력합니다.</p>
                  </div>

                  <div className="company-create-form__group">
                    <span className="company-create-form__label">
                      공고 유형
                      <span className="company-form__required-mark" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <div className="company-create-form__types">
                      {companyCreateSessionTypes.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className={`company-create-form__type-card${companyCreateSessionType === item.key ? ' company-create-form__type-card--active' : ''}`}
                          onClick={() => setCompanyCreateSessionType(item.key)}
                        >
                          <span className="company-create-form__type-emoji" aria-hidden="true">
                            {item.emoji}
                          </span>
                          <strong className="company-create-form__type-title">{item.title}</strong>
                          <span className="company-create-form__type-description">{item.description}</span>
                          {companyCreateSessionType === item.key ? (
                            <span className="company-create-form__type-check" aria-hidden="true">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="company-create-form__field company-create-form__field--title">
                    <span className="company-create-form__label">
                      공고명
                      <span className="company-form__required-mark" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <input
                      className={companyCreateFormErrors.title ? 'company-field__input--error' : undefined}
                      type="text"
                      value={companyCreateForm.title}
                      placeholder="예: 백엔드 개발자 채용 2026 Q2"
                      onChange={handleCompanyCreateFormChange('title')}
                    />
                    {companyCreateFormErrors.title ? (
                      <span className="company-field__error">{companyCreateFormErrors.title}</span>
                    ) : null}
                  </label>

                  <label className="company-create-form__field company-create-form__field--description">
                    <span className="company-create-form__label">
                      짧은 설명
                      <span className="company-form__required-mark" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <input
                      className={companyCreateFormErrors.description ? 'company-field__input--error' : undefined}
                      type="text"
                      value={companyCreateForm.description}
                      placeholder="지원자에게 보일 한 줄 요약"
                      onChange={handleCompanyCreateFormChange('description')}
                    />
                    {companyCreateFormErrors.description ? (
                      <span className="company-field__error">{companyCreateFormErrors.description}</span>
                    ) : null}
                  </label>

                  <label className="company-create-form__field company-create-form__field--description-long">
                    <span className="company-create-form__label">
                      자세한 설명
                      <span className="company-form__required-mark" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <textarea
                      className={companyCreateFormErrors.detailedDescription ? 'company-field__input--error' : undefined}
                      value={companyCreateForm.detailedDescription}
                      placeholder="지원자에게 보여줄 상세한 안내, 역할 설명, 과제 맥락 등을 입력하세요."
                      onChange={handleCompanyCreateFormChange('detailedDescription')}
                    />
                    {companyCreateFormErrors.detailedDescription ? (
                      <span className="company-field__error">{companyCreateFormErrors.detailedDescription}</span>
                    ) : null}
                  </label>

                  <div className="company-create-form__row company-create-form__row--dates">
                    <label className="company-create-form__field">
                      <span className="company-create-form__label">
                        시작일
                        <span className="company-form__required-mark" aria-hidden="true">
                          *
                        </span>
                      </span>
                      <input
                        className={`company-create-form__date-input${companyCreateFormErrors.startDate ? ' company-field__input--error' : ''}`}
                        type="date"
                        value={companyCreateForm.startDate}
                        onChange={handleCompanyCreateFormChange('startDate')}
                      />
                      {companyCreateFormErrors.startDate ? (
                        <span className="company-field__error">{companyCreateFormErrors.startDate}</span>
                      ) : null}
                    </label>

                    <label className="company-create-form__field">
                      <span className="company-create-form__label">
                        마감일
                        <span className="company-form__required-mark" aria-hidden="true">
                          *
                        </span>
                      </span>
                      <input
                        className={`company-create-form__date-input${companyCreateFormErrors.endDate ? ' company-field__input--error' : ''}`}
                        type="date"
                        value={companyCreateForm.endDate}
                        onChange={handleCompanyCreateFormChange('endDate')}
                      />
                      {companyCreateFormErrors.endDate ? (
                        <span className="company-field__error">{companyCreateFormErrors.endDate}</span>
                      ) : null}
                    </label>
                  </div>

                  <div className="company-create-form__row company-create-form__row--capacity">
                    <div className="company-create-form__capacity-side">
                      <label className="company-create-form__field company-create-form__field--capacity">
                        <span className="company-create-form__label">
                          모집 인원
                          <span className="company-form__required-mark" aria-hidden="true">
                            *
                          </span>
                        </span>
                        <input
                          className={companyCreateFormErrors.capacity ? 'company-field__input--error' : undefined}
                          type="text"
                          inputMode="numeric"
                          value={companyCreateForm.capacity}
                          placeholder="최대 999명"
                          onChange={handleCompanyCreateFormChange('capacity')}
                        />
                        {companyCreateFormErrors.capacity ? (
                          <span className="company-field__error">{companyCreateFormErrors.capacity}</span>
                        ) : null}
                      </label>

                      <div className="company-create-form__capacity-mode">
                        <span className="company-create-form__label company-create-form__label--subtle">
                          모집 인원 표현 방식
                          <span className="company-form__required-mark" aria-hidden="true">
                            *
                          </span>
                        </span>

                        <div className="company-create-form__toggle-group" aria-label="공개 여부">
                          <button
                            type="button"
                            className={`company-create-form__toggle${companyCreateForm.capacityDisplay === 'exact' ? ' company-create-form__toggle--active' : ''}`}
                            onClick={() =>
                              setCompanyCreateForm((current) => ({
                                ...current,
                                capacityDisplay: 'exact',
                              }))
                            }
                          >
                            {companyCreateExactCapacityLabel}
                          </button>
                          <button
                            type="button"
                            className={`company-create-form__toggle${companyCreateForm.capacityDisplay === 'masked' ? ' company-create-form__toggle--active' : ''}`}
                            onClick={() =>
                              setCompanyCreateForm((current) => ({
                                ...current,
                                capacityDisplay: 'masked',
                              }))
                            }
                          >
                            {companyCreateMaskedCapacityLabel}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="company-create-form__field company-create-form__field--scope">
                    <span className="company-create-form__label">
                      공개 범위
                      <span className="company-form__required-mark" aria-hidden="true">
                        *
                      </span>
                    </span>
                    <div className="company-create-form__toggle-group" aria-label="공개 범위 선택">
                      {companyCreatePublicScopeOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`company-create-form__toggle${companyCreateForm.visibilityScope === option ? ' company-create-form__toggle--active' : ''}`}
                          onClick={() => handleCompanyCreateVisibilityScopeSelect(option)}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="company-create-form__eligibility">
                    <div className="company-create-form__field company-create-form__field--age">
                      <span className="company-create-form__label">
                        지원 가능 연령
                        <span className="company-form__required-mark" aria-hidden="true">
                          *
                        </span>
                      </span>
                      <div className="company-create-form__toggle-group" aria-label="지원 가능 연령 선택">
                        {companyCreateEligibilityAgeOptions.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            className={`company-create-form__toggle${companyCreateForm.eligibleAge === option.key ? ' company-create-form__toggle--active' : ''}`}
                            onClick={() => handleCompanyCreateEligibleAgeSelect(option.key)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="company-create-form__field company-create-form__field--countries">
                      <span className="company-create-form__label">지원 가능 국적</span>
                      <div className="company-create-form__country-select">
                        <div className="company-create-form__country-search-row">
                          <input
                            type="text"
                            value={companyCreateEligibleCountrySearch}
                            placeholder="국가 검색"
                            onChange={(event) => {
                              setCompanyCreateEligibleCountrySearch(event.target.value);
                              if (!isCompanyCreateEligibleCountryDropdownOpen) {
                                setIsCompanyCreateEligibleCountryDropdownOpen(true);
                              }
                            }}
                            onFocus={() => setIsCompanyCreateEligibleCountryDropdownOpen(true)}
                          />
                          <button
                            type="button"
                            className="company-create-form__country-toggle"
                            aria-label="지원 가능 국적 목록 열기"
                            onClick={() => setIsCompanyCreateEligibleCountryDropdownOpen((current) => !current)}
                          >
                            <span
                              className={`company-settings-language__chevron${isCompanyCreateEligibleCountryDropdownOpen ? ' company-settings-language__chevron--open' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        </div>

                        {isCompanyCreateEligibleCountryDropdownOpen ? (
                          <div className="company-create-form__country-dropdown" role="listbox" aria-label="지원 가능 국적 목록">
                            {filteredCompanyCreateCountryOptions.map((country) => (
                              <button
                                key={country}
                                type="button"
                                role="option"
                                aria-selected={false}
                                className="company-create-form__country-option"
                                onClick={() => handleCompanyCreateEligibleCountryAdd(country)}
                              >
                                {country}
                              </button>
                            ))}
                            {filteredCompanyCreateCountryOptions.length === 0 ? (
                              <div className="company-create-form__country-empty">검색 결과가 없습니다.</div>
                            ) : null}
                          </div>
                        ) : null}

                        {companyCreateForm.eligibleCountries.length > 0 ? (
                          <div className="company-create-form__country-badges">
                            {companyCreateForm.eligibleCountries.map((country) => (
                              <span className="company-create-form__country-badge" key={country}>
                                {country}
                                <button
                                  type="button"
                                  aria-label={`${country} 제거`}
                                  onClick={() => handleCompanyCreateEligibleCountryRemove(country)}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="company-create-form__actions">
                    <button type="button" className="company-create-form__secondary">
                      임시 저장
                    </button>
                    <button
                      type="button"
                      className="company-create-form__primary"
                      onClick={handleCompanyCreateStepOneNext}
                    >
                      다음: 과제 구성 →
                    </button>
                  </div>
                </section>
              ) : companyCreateStep === 2 ? (
                <section className="company-create-form company-create-form--workflow company-dashboard-card">
                  <div className="company-create-form__header">
                    <h2>과정 구성</h2>
                    <p>지원자가 수행할 과정을 순서대로 추가하세요.</p>
                  </div>

                  <div className="company-create-workflow">
                    {companyCreateProcesses.map((process, index) => (
                      <article className="company-create-process-card" key={process.id}>
                        <div className="company-create-process-card__header">
                          <strong>{`과정 ${index + 1}`}</strong>
                          <div className="company-create-process-card__header-actions">
                            <button
                              type="button"
                              className="company-create-process-card__delete"
                              onClick={() => handleCompanyCreateProcessRemove(process.id)}
                            >
                              삭제
                            </button>
                            <button
                              type="button"
                              className="company-create-process-card__menu"
                              aria-label={`${index + 1}번 과정 옵션`}
                            >
                              <span />
                              <span />
                              <span />
                            </button>
                          </div>
                        </div>

                        <div className="company-field">
                          <span className="company-field__label">
                            과정명
                            <span className="company-form__required-mark" aria-hidden="true">
                              *
                            </span>
                          </span>
                          <input
                            className={`company-field__input${companyCreateProcessErrors[process.id]?.name ? ' company-field__input--error' : ''}`}
                            type="text"
                            placeholder="과정명을 입력하세요."
                            value={process.name}
                            onChange={handleCompanyCreateProcessChange(process.id, 'name')}
                          />
                          {companyCreateProcessErrors[process.id]?.name ? (
                            <span className="company-field__error">{companyCreateProcessErrors[process.id]?.name}</span>
                          ) : null}
                        </div>

                        <div className="company-field">
                          <span className="company-field__label">
                            과정 내용
                            <span className="company-form__required-mark" aria-hidden="true">
                              *
                            </span>
                          </span>
                          <textarea
                            className={`company-field__input${companyCreateProcessErrors[process.id]?.content ? ' company-field__input--error' : ''}`}
                            style={{ minHeight: 150, resize: 'vertical', width: '100%' }}
                            value={process.content}
                            onChange={handleCompanyCreateProcessChange(process.id, 'content')}
                          />
                          {companyCreateProcessErrors[process.id]?.content ? (
                            <span className="company-field__error">{companyCreateProcessErrors[process.id]?.content}</span>
                          ) : null}
                        </div>

                        <div className="company-create-form__country-select">
                          <div className="company-field company-create-form__submission-select">
                            <span className="company-field__label">
                              제출 방식 선택
                              <span className="company-form__required-mark" aria-hidden="true">
                                *
                              </span>
                            </span>
                            <button
                              type="button"
                              className={`company-field__input company-create-form__submission-toggle${companyCreateProcessErrors[process.id]?.submissionMethod ? ' company-field__input--error' : ''}`}
                              aria-label="제출 방식 목록 열기"
                              onClick={() => setOpenCompanyCreateSubmissionDropdownId((current) => (current === process.id ? null : process.id))}
                            >
                              <span>
                                {process.submissionMethod || '제출 방식을 선택하세요.'}
                              </span>
                              <span
                                className={`company-settings-language__chevron${openCompanyCreateSubmissionDropdownId === process.id ? ' company-settings-language__chevron--open' : ''}`}
                                aria-hidden="true"
                              />
                            </button>
                            {openCompanyCreateSubmissionDropdownId === process.id ? (
                              <div className="company-create-form__submission-dropdown" role="listbox" aria-label="제출 방식 목록">
                                {companyCreateSubmissionOptions.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    role="option"
                                    aria-selected={process.submissionMethod === option}
                                    className="company-create-form__submission-option"
                                    onClick={() => handleCompanyCreateSubmissionSelect(process.id, option)}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            {companyCreateProcessErrors[process.id]?.submissionMethod ? (
                              <span className="company-field__error">
                                {companyCreateProcessErrors[process.id]?.submissionMethod}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))}

                    <button
                      type="button"
                      className="company-create-workflow__add"
                      onClick={handleCompanyCreateProcessAdd}
                      aria-label="과정 추가"
                    >
                      +
                    </button>
                  </div>

                  <div className="company-create-form__actions company-create-form__actions--workflow">
                    <button
                      type="button"
                      className="company-create-form__secondary"
                      onClick={() => setCompanyCreateStep(1)}
                    >
                      ← 이전
                    </button>
                    <button
                      type="button"
                      className="company-create-form__primary"
                      onClick={handleCompanyCreateStepTwoNext}
                    >
                      다음: 에이전트 선택 →
                    </button>
                  </div>
                </section>
              ) : (
                <section className="company-create-layout">
                  <div className="company-create-mainpanel">
                    <article className="company-create-agents company-dashboard-card">
                      <div className="company-create-form__header">
                        <h2>에이전트 선택 및 가중치</h2>
                        <p>보유 라이선스 중 이 세션에 투입할 에이전트를 선택합니다.</p>
                      </div>

                      <div className="company-create-agents__rows">
                        {companyCreateAgents.map((agent) => {
                          const sliderWidth = agent.selected ? `${agent.weight}%` : '0%';

                          return (
                            <article
                              key={agent.id}
                              className={`company-create-agent-row${agent.selected ? ' company-create-agent-row--selected' : ''}`}
                            >
                              <button
                                type="button"
                                className={`company-create-agent-row__check${agent.selected ? ' company-create-agent-row__check--active' : ''}`}
                                aria-pressed={agent.selected}
                                aria-label={`${agent.name} 선택 토글`}
                                onClick={() => handleCompanyCreateAgentToggle(agent.id)}
                              />

                              <button
                                type="button"
                                className="company-create-agent-row__details-trigger"
                                onClick={() => openCompanyCreateAgentDetail(agent.id)}
                                aria-label={`${agent.name} 상세 보기`}
                              >
                                <span className="company-create-agent-row__icon" aria-hidden="true">
                                  {agent.icon}
                                </span>

                                <span className="company-create-agent-row__copy">
                                  <strong>{agent.name}</strong>
                                  <span>{agent.description}</span>
                                </span>
                              </button>

                              {agent.selected ? (
                                <div className="company-create-agent-row__weight-control">
                                  <div className="company-create-agent-row__slider">
                                    <div className="company-create-agent-row__slider-track" aria-hidden="true">
                                      <span
                                        className="company-create-agent-row__slider-fill"
                                        style={{ width: sliderWidth }}
                                      />
                                      <span
                                        className="company-create-agent-row__slider-thumb"
                                        style={{ left: sliderWidth }}
                                      />
                                    </div>
                                    <input
                                      type="range"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={agent.weight}
                                      onChange={handleCompanyCreateAgentWeightChange(agent.id)}
                                      disabled={!agent.selected}
                                      aria-label={`${agent.name} 가중치`}
                                    />
                                  </div>
                                  <label className="company-create-agent-row__number-control">
                                    <span className="sr-only">{`${agent.name} 가중치 숫자 입력`}</span>
                                    <input
                                      className="company-create-agent-row__number-input"
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      maxLength={3}
                                      value={companyCreateAgentWeightInputs[agent.id] ?? String(agent.weight)}
                                      onChange={handleCompanyCreateAgentWeightInputChange(agent.id)}
                                      onBlur={handleCompanyCreateAgentWeightInputBlur(agent.id)}
                                      aria-label={`${agent.name} 가중치 숫자 입력`}
                                    />
                                    <span className="company-create-agent-row__number-suffix" aria-hidden="true">
                                      %
                                    </span>
                                  </label>
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>

                      <div className="company-create-agents__summary">
                        <div className="company-create-agents__summary-total">
                          <span>가중치 합계</span>
                          <strong>{`${companyCreateWeightTotal}%`}</strong>
                        </div>
                        <p>{`투입 에이전트 ${selectedCompanyCreateAgents.length}`}</p>
                        <span
                          className={`company-create-agents__summary-status${isCompanyCreateWeightBalanced ? '' : ' company-create-agents__summary-status--warning'}`}
                        >
                          {isCompanyCreateWeightBalanced ? '✓ 정상' : '조정 필요'}
                        </span>
                      </div>
                    </article>

                    <article className="company-create-criteria company-dashboard-card">
                      <div className="company-create-form__header">
                        <h2>평가기준 설정</h2>
                        <p>아래 기준은 선택된 에이전트들이 점수 산정과 코멘트 생성 시 공통으로 참고합니다.</p>
                      </div>

                      <div className="company-create-criteria__note">
                        <strong>에이전트 공통 참고 기준</strong>
                        <p>중점 역량, 가산점 포인트, 주의 리스크를 적어두면 각 에이전트가 결과를 해석할 때 같은 기준선을 공유합니다.</p>
                      </div>

                      <div className="company-create-criteria__grid">
                        <label className="company-create-criteria__field">
                          <span>중점 역량</span>
                          <textarea
                            value={companyCreateEvaluationCriteria.focus}
                            onChange={handleCompanyCreateEvaluationCriteriaChange('focus')}
                            placeholder="예: 문제 정의 능력, 제품 감각, 협업 품질"
                          />
                        </label>

                        <label className="company-create-criteria__field">
                          <span>가산점 포인트</span>
                          <textarea
                            value={companyCreateEvaluationCriteria.strengths}
                            onChange={handleCompanyCreateEvaluationCriteriaChange('strengths')}
                            placeholder="예: 실제 운영 경험, 정량 근거, 규제 이해"
                          />
                        </label>

                        <label className="company-create-criteria__field">
                          <span>주의할 리스크</span>
                          <textarea
                            value={companyCreateEvaluationCriteria.risks}
                            onChange={handleCompanyCreateEvaluationCriteriaChange('risks')}
                            placeholder="예: 근거 없는 주장, 보안 고려 누락, AI 생성 흔적"
                          />
                        </label>
                      </div>
                    </article>
                  </div>

                  <aside className="company-create-sidepanel">
                    <section className="company-create-sidecard company-dashboard-card">
                      <div className="company-create-sidecard__header">
                        <h3>비용 계산</h3>
                        <p>모집 인원 × 에이전트 단가 기반</p>
                      </div>

                      <div className="company-create-cost-list">
                        {selectedCompanyCreateAgents.map((agent) => (
                          <div className="company-create-cost-list__row" key={agent.id}>
                            <span>{agent.billingLabel}</span>
                            <strong>{`$ ${formatCompanyCreateCredit((agent.weight / 100) * COMPANY_CREATE_COST_PER_APPLICANT_WLD)}`}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="company-create-cost-total">
                        <span>세션 당 (인당)</span>
                        <strong>{`$ ${formatCompanyCreateCredit(companyCreateCostPerApplicantWld)}`}</strong>
                      </div>

                      <div className="company-create-sidecard__demand">
                        <div className="company-create-sidecard__demand-head">
                          <strong>예상 지원 인원</strong>
                          <p>초과 시, 크레딧이 추가로 차감됩니다.</p>
                        </div>

                        <label className="company-create-sidecard__input">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={companyCreateExpectedApplicants}
                            onChange={(event) =>
                              setCompanyCreateExpectedApplicants(event.target.value.replace(/[^0-9]/g, ''))
                            }
                          />
                          <span>명</span>
                        </label>
                      </div>

                      <div className="company-create-cost-estimate">
                        <div className="company-create-cost-estimate__copy">
                          <span>{`예상 지원 인원 ${companyCreateExpectedApplicantsCount || 0}명 기준`}</span>
                          <p>에이전트 사용량 기반으로 크레딧이 소진됩니다. 이는 평가할 정보량에 따라 달라질 수 있습니다.</p>
                        </div>
                        <strong>{`약 $${formatCompanyCreateCredit(companyCreateSessionCostWld)} 예상`}</strong>
                      </div>

                      {shouldShowCompanyCreateRechargeNotice ? (
                        <div className="company-create-cost-alert">
                          <strong>{`△ 보유 크레딧 $${COMPANY_CREATE_WLD_BALANCE.toLocaleString()}`}</strong>
                          <p>
                            {companyCreateRemainingCredit >= 0
                              ? `예상 크레딧 사용 시 $${Math.round(companyCreateRemainingCredit).toLocaleString()}가 남습니다. 추가 인원 대비 충전을 권장합니다.`
                              : `현재 설정 기준 $${Math.abs(Math.round(companyCreateRemainingCredit)).toLocaleString()}가 부족합니다. 에이전트 조정 또는 충전이 필요합니다.`}
                          </p>
                        </div>
                      ) : null}
                    </section>

                    <section className="company-create-actions-card company-dashboard-card">
                      <button
                        type="button"
                        className="company-create-actions-card__secondary"
                        onClick={() => setCompanyCreateStep(2)}
                      >
                        ← 이전
                      </button>
                      <button
                        type="button"
                        className="company-create-actions-card__primary"
                        onClick={handleCompanyCreateComplete}
                      >
                        공고 생성 →
                      </button>
                    </section>
                  </aside>
                </section>
              )}
            </>
          ) : (
            <>
              <section className="company-report-back">
                <button
                  type="button"
                  className="company-report-back__button"
                  onClick={() => setCompanyDashboardView('jobs')}
                  aria-label="공고 목록으로 돌아가기"
                >
                  ←
                </button>
              </section>

              {resolvedCompanyReport ? (
                <>
                  <section className="company-report-summary company-dashboard-card">
                    <span className="company-report-summary__badge">{resolvedCompanyReport.summary.badge}</span>
                    <h2>{resolvedCompanyReport.summary.title}</h2>
                    <p>{resolvedCompanyReport.summary.description}</p>
                  </section>

                  {resolvedCompanyReport.histogram.length > 0 ||
                  resolvedCompanyReport.topCandidates.length > 0 ||
                  resolvedCompanyReport.agentScores.length > 0 ||
                  resolvedCompanyReport.improvements.length > 0 ? (
                    <section className="company-report-grid">
                      <article className="company-report-card company-dashboard-card">
                        <div className="company-report-card__header">
                          <h3>점수 분포</h3>
                          <p>종합 점수 히스토그램 (구간 5pt)</p>
                        </div>

                        <div className="company-report-histogram" aria-label="점수 분포 히스토그램">
                          {resolvedCompanyReport.histogram.map((item) => (
                            <div className="company-report-histogram__item" key={item.label}>
                              <div className="company-report-histogram__bar" style={{ height: `${item.height}px` }} />
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="company-report-card company-dashboard-card">
                        <div className="company-report-card__header">
                          <h3>상위 5명 (블라인드)</h3>
                        </div>

                        <div className="company-report-ranking">
                          {resolvedCompanyReport.topCandidates.map((candidate) => (
                            <div className="company-report-ranking__row" key={candidate.rank}>
                              <span className="company-report-ranking__rank">{candidate.rank}</span>
                              <span className="company-report-ranking__avatar" aria-hidden="true" />
                              <strong>{candidate.id}</strong>
                              <div className="company-report-ranking__track">
                                <span style={{ width: `${(candidate.score / 100) * 100}%` }} />
                              </div>
                              <span className="company-report-ranking__score">{candidate.score}</span>
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="company-report-card company-dashboard-card">
                        <div className="company-report-card__header">
                          <h3>에이전트별 평균</h3>
                          <p>가중 적용 전 원 점수 · 상·하위 10% 대역</p>
                        </div>

                        <div className="company-report-agents">
                          {resolvedCompanyReport.agentScores.map((agent) => (
                            <div className="company-report-agents__row" key={agent.label}>
                              <div className="company-report-agents__head">
                                <span>{agent.label}</span>
                                <strong>{agent.score}</strong>
                              </div>
                              <div className="company-report-agents__track">
                                <span
                                  className="company-report-agents__band"
                                  style={{
                                    left: `${agent.bandStart}%`,
                                    width: `${agent.bandWidth}%`,
                                  }}
                                />
                                <span
                                  className="company-report-agents__marker"
                                  style={{ left: `${agent.score}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>

                      <article className="company-report-card company-dashboard-card">
                        <div className="company-report-card__header">
                          <h3>공통 개선 방향 (전체 지원자 기준)</h3>
                        </div>

                        <div className="company-report-improvements">
                          {resolvedCompanyReport.improvements.map((item) => (
                            <div className="company-report-improvements__row" key={item.label}>
                              <span>{item.label}</span>
                              <div className="company-report-improvements__bar">
                                <span
                                  className={`company-report-improvements__fill company-report-improvements__fill--${item.tone}`}
                                  style={{ width: `${(item.count / 30) * 100}%` }}
                                />
                              </div>
                              <strong className={item.tone === 'danger' ? 'company-report-improvements__count--danger' : ''}>
                                {item.count}명
                              </strong>
                            </div>
                          ))}
                        </div>
                      </article>
                    </section>
                  ) : (
                    <div
                      className="company-dashboard-empty-state company-dashboard-empty-state--centered"
                      aria-label="공고 리포트 빈 상태"
                      style={{ minHeight: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <p>아직 공고 리포트 데이터가 없습니다.</p>
                        <p>지원자 평가가 쌓이면 이 화면에 분포와 상위 후보 정보가 표시됩니다.</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <section className="company-dashboard-card">
                  <strong>선택된 공고가 없습니다.</strong>
                  <p>공고 목록에서 리포트를 볼 공고를 선택해주세요.</p>
                </section>
              )}
            </>
          )}
        </main>

        {selectedCompanyBlindRankingCandidate && selectedCompanyBlindRankingCandidateDetail ? (
          <div className="company-blind-ranking-detail-layer" role="presentation">
            <button
              type="button"
              className="company-blind-ranking-detail-layer__backdrop"
              aria-label="지원자 상세 모달 닫기"
              onClick={closeCompanyBlindRankingDetail}
            />

            <section
              className="company-blind-ranking-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="company-blind-ranking-detail-title"
            >
              <div className="company-blind-ranking-detail-modal__header">
                <div className="company-blind-ranking-detail-modal__copy">
                  <h3 id="company-blind-ranking-detail-title">{selectedCompanyBlindRankingCandidate.anonymousId}</h3>
                  <p>{selectedCompanyBlindRankingCandidateDetail.confidenceSummary}</p>
                  <div className="company-blind-ranking-detail-modal__rating">
                    <strong>{selectedCompanyBlindRankingCandidateDetail.rating}</strong>
                    <span>{`· ${selectedCompanyBlindRankingCandidateDetail.recommendation}`}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="company-blind-ranking-detail-modal__close"
                  aria-label="지원자 상세 모달 닫기"
                  onClick={closeCompanyBlindRankingDetail}
                >
                  ×
                </button>
              </div>

              <div className="company-blind-ranking-detail-modal__tabs" role="tablist" aria-label="지원자 상세 탭">
                {companyBlindRankingDetailTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={companyBlindRankingDetailTab === tab.key}
                    className={`company-blind-ranking-detail-modal__tab${companyBlindRankingDetailTab === tab.key ? ' company-blind-ranking-detail-modal__tab--active' : ''}`}
                    onClick={() => setCompanyBlindRankingDetailTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="company-blind-ranking-detail-modal__body">
                <section className="company-blind-ranking-detail-modal__section">
                  <h4>
                    {companyBlindRankingDetailTab === 'overview'
                      ? selectedCompanyBlindRankingCandidateDetail.overviewSummaryTitle
                      : activeCompanyBlindRankingTabSection?.heading}
                  </h4>
                  <p>
                    {companyBlindRankingDetailTab === 'overview'
                      ? selectedCompanyBlindRankingCandidateDetail.overviewSummary
                      : activeCompanyBlindRankingTabSection?.summary}
                  </p>
                </section>

                {activeCompanyBlindRankingTabSection ? (
                  <section className="company-blind-ranking-detail-modal__section">
                    <h4>세부 평가 항목</h4>

                    <div className="company-blind-ranking-detail-modal__stack">
                      {activeCompanyBlindRankingTabSection.items.map((item) => (
                        <article className="company-blind-ranking-detail-modal__detail-card" key={item.index}>
                          <span className="company-blind-ranking-detail-modal__index">{item.index}</span>
                          <div className="company-blind-ranking-detail-modal__detail-copy">
                            <strong>{item.title}</strong>
                            <em>{item.score}</em>
                            <p>{item.description}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {isCompanyBlindRankingNotifyModalOpen ? (
          <div className="company-blind-ranking-notify-layer" role="presentation">
            <button
              type="button"
              className="company-blind-ranking-notify-layer__backdrop"
              aria-label="알림 전송 모달 닫기"
              onClick={closeCompanyBlindRankingNotifyModal}
            />

            <section
              className="company-blind-ranking-notify-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="company-blind-ranking-notify-title"
            >
              <div className="company-blind-ranking-notify-modal__header">
                <h3 id="company-blind-ranking-notify-title">
                  {`선택 ${selectedCompanyBlindRankingCount}명 · 알림 발송`}
                </h3>
                <button
                  type="button"
                  className="company-blind-ranking-notify-modal__close"
                  aria-label="알림 전송 모달 닫기"
                  onClick={closeCompanyBlindRankingNotifyModal}
                >
                  ×
                </button>
              </div>

              <p>{`선택한 ${selectedCompanyBlindRankingCount}명에게 알림 발송하시겠습니까?`}</p>

              <div className="company-blind-ranking-notify-modal__actions">
                <button
                  type="button"
                  className="company-blind-ranking-notify-modal__button company-blind-ranking-notify-modal__button--secondary"
                  onClick={closeCompanyBlindRankingNotifyModal}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="company-blind-ranking-notify-modal__button"
                  onClick={confirmCompanyBlindRankingNotify}
                >
                  발송하기
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {selectedCompanyCreateAgentDetailSource && selectedCompanyCreateAgentDetail ? (
          <div className="company-agent-detail-layer" role="presentation">
            <button
              type="button"
              className="company-agent-detail-layer__backdrop"
              aria-label="에이전트 상세 닫기"
              onClick={closeCompanyCreateAgentDetail}
            />

            <section
              className="company-agent-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="company-agent-detail-title"
            >
              <div className="company-agent-detail-modal__header">
                <div className="company-agent-detail-modal__intro">
                  <span className="company-agent-detail-modal__badge" aria-hidden="true">
                    {selectedCompanyCreateAgentDetailSource.icon}
                  </span>

                  <div className="company-agent-detail-modal__copy">
                    <h3 id="company-agent-detail-title">{selectedCompanyCreateAgentDetailSource.name}</h3>
                    <p>{selectedCompanyCreateAgentDetail.summary}</p>
                    <div className="company-agent-detail-modal__rating">
                      <span className="company-agent-detail-modal__stars" aria-hidden="true">
                        ★★★★★
                      </span>
                      <span>{`${selectedCompanyCreateAgentDetail.rating.toFixed(1)} · ${selectedCompanyCreateAgentDetail.reviewCount} reviewers 사용`}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="company-agent-detail-modal__close"
                  aria-label="에이전트 상세 닫기"
                  onClick={closeCompanyCreateAgentDetail}
                >
                  ×
                </button>
              </div>

              <div className="company-agent-detail-modal__tabs" role="tablist" aria-label="에이전트 상세 탭">
                {companyCreateAgentDetailTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`company-agent-detail-modal__tab${companyCreateAgentDetailTab === tab.key ? ' company-agent-detail-modal__tab--active' : ''}`}
                    role="tab"
                    aria-selected={companyCreateAgentDetailTab === tab.key}
                    onClick={() => setCompanyCreateAgentDetailTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="company-agent-detail-modal__body">
                {companyCreateAgentDetailTab === 'criteria' ? (
                  <>
                    <section className="company-agent-detail-modal__section">
                      <h4>{selectedCompanyCreateAgentDetail.criteriaTitle}</h4>
                      <div className="company-agent-detail-modal__stack">
                        {selectedCompanyCreateAgentDetail.criteria.map((item, index) => (
                          <article className="company-agent-detail-modal__criterion" key={item.title}>
                            <span className="company-agent-detail-modal__criterion-index">{index + 1}</span>
                            <div>
                              <strong>{item.title}</strong>
                              <p>{item.description}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section className="company-agent-detail-modal__section">
                      <h4>지원 도메인</h4>
                      <div className="company-agent-detail-modal__chips">
                        {selectedCompanyCreateAgentDetail.domains.map((domain) => (
                          <span className="company-agent-detail-modal__chip" key={domain}>
                            {domain}
                          </span>
                        ))}
                      </div>
                    </section>

                    <section className="company-agent-detail-modal__section">
                      <h4>샘플 출력</h4>
                      <article className="company-agent-detail-modal__sample">
                        <strong>{selectedCompanyCreateAgentDetail.sampleTitle}</strong>
                        <span>{selectedCompanyCreateAgentDetail.sampleSummary}</span>
                        {selectedCompanyCreateAgentDetail.sampleExcerpt.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </article>
                    </section>

                    {selectedCompanyCreateAgentDetail.relatedAgents.length > 0 ? (
                      <section className="company-agent-detail-modal__section">
                        <h4>함께 많이 선택하는 에이전트</h4>
                        <div className="company-agent-detail-modal__stack">
                          {selectedCompanyCreateAgentDetail.relatedAgents.map((item) => (
                            <article className="company-agent-detail-modal__related" key={item.id}>
                              <span className="company-agent-detail-modal__related-icon" aria-hidden="true">
                                {item.icon}
                              </span>
                              <div>
                                <strong>{item.name}</strong>
                                <span>{item.meta}</span>
                              </div>
                              <button
                                type="button"
                                className="company-agent-detail-modal__related-action"
                                onClick={() => openCompanyCreateAgentDetail(item.id)}
                              >
                                + 추가
                              </button>
                            </article>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </>
                ) : null}

                {companyCreateAgentDetailTab === 'behavior' ? (
                  <section className="company-agent-detail-modal__section">
                    <h4>동작 방식</h4>
                    <div className="company-agent-detail-modal__stack">
                      {selectedCompanyCreateAgentDetail.behavior.map((item) => (
                        <article className="company-agent-detail-modal__info-card" key={item.title}>
                          <strong>{item.title}</strong>
                          <p>{item.description}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

                {companyCreateAgentDetailTab === 'domains' ? (
                  <section className="company-agent-detail-modal__section">
                    <h4>지원 도메인</h4>
                    <div className="company-agent-detail-modal__chips">
                      {selectedCompanyCreateAgentDetail.domains.map((domain) => (
                        <span className="company-agent-detail-modal__chip" key={domain}>
                          {domain}
                        </span>
                      ))}
                    </div>
                    <div className="company-agent-detail-modal__stack">
                      {selectedCompanyCreateAgentDetail.behavior.slice(0, 3).map((item) => (
                        <article className="company-agent-detail-modal__info-card" key={item.title}>
                          <strong>{item.title}</strong>
                          <p>{item.description}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : null}

              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

  if (screen === 'candidateTemp' && authCandidateUser) {
    return (
      <div className="page-shell temp-page-shell">
        <main className="temp-page">
          <div className="temp-page__badge">임시 페이지</div>
          <h1>
            {authCandidateUser.name} 님, {candidateAuthMode === 'signup' ? '가입이 완료되었습니다.' : '로그인되었습니다.'}
          </h1>
          <p>
            {candidateAuthMode === 'signup'
              ? '개인 회원가입과 자동 로그인이 정상적으로 완료되었습니다.'
              : '개인 로그인이 정상적으로 완료되었습니다.'}
            다음 단계 구현 전까지는 이 페이지를 임시 랜딩으로 사용합니다.
          </p>

          <div className="temp-page__summary">
            <div>
              <span>이름</span>
              <strong>{authCandidateUser.name}</strong>
            </div>
            <div>
              <span>이메일</span>
              <strong>{authCandidateUser.email}</strong>
            </div>
          </div>

          <div className="temp-page__actions">
            <button
              type="button"
              className="ghost-button ghost-button--wide"
              onClick={() => setScreen('landing')}
            >
              랜딩 보기
            </button>
            <button
              type="button"
              className="solid-button solid-button--wide"
              onClick={handleCompanyLogout}
            >
              로그아웃
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (screen === 'candidateSignup') {
    return (
      <div className="company-signup-page candidate-signup-page">
        <aside className="company-signup-page__aside">
          <button
            type="button"
            className="company-signup-page__brand"
            onClick={() => setScreen('landing')}
            aria-label="랜딩 페이지로 이동"
          >
            <WorldLogo inverted />
          </button>

          <div className="company-signup-page__hero">
            <h1>
              <span>AI 에이전트로</span>
              <span>공정한 블라인드 평가.</span>
            </h1>
            <p>
              <span>World ID로 실제 사람만 참여합니다.</span>
              <span>지원자의 개인정보는 매칭 동의 전까지 비공개됩니다.</span>
            </p>
          </div>

          <div className="agent-card-list">
            {agentCards.map((agent) => (
              <article className="agent-card" key={agent.title}>
                <div className="agent-card__icon" aria-hidden="true" />
                <div className="agent-card__copy">
                  <strong>{agent.title}</strong>
                  <span>{agent.description}</span>
                </div>
                <div className="agent-card__status" aria-hidden="true" />
              </article>
            ))}
          </div>
        </aside>

        <section className="company-signup-page__panel">
          <div className="company-signup-page__panel-inner">
            {!candidateSubmitted ? (
              <form
                className={`candidate-form${candidateVerificationSent ? ' candidate-form--verification-sent' : ''}${candidateVerificationConfirmed ? ' candidate-form--verified' : ''}`}
                onSubmit={handleCandidateSubmit}
                noValidate
              >
                <h2>계정 만들기</h2>

                <label className="company-field">
                  <span className="company-field__label">이름</span>
                  <input
                    className={`company-field__input${candidateErrors.name ? ' company-field__input--error' : ''}`}
                    type="text"
                    name="name"
                    placeholder="홍길동"
                    value={candidateForm.name}
                    onChange={handleCandidateChange}
                  />
                  {candidateErrors.name ? (
                    <span className="company-field__error">{candidateErrors.name}</span>
                  ) : null}
                </label>

                <div className="company-form__email-row candidate-form__email-row">
                  <label className="company-field company-field--email">
                    <span className="company-field__label">이메일</span>
                    <input
                      className={`company-field__input${candidateErrors.email ? ' company-field__input--error' : ''}`}
                      type="email"
                      name="email"
                      placeholder="you@example.com"
                      value={candidateForm.email}
                      onChange={handleCandidateChange}
                      readOnly={candidateVerificationSent}
                    />
                    {candidateErrors.email ? (
                      <span className="company-field__error">{candidateErrors.email}</span>
                    ) : null}
                  </label>

                  <button
                    type="button"
                    className={`company-form__verify${candidateVerificationSent ? ' company-form__verify--timer' : ''}`}
                    onClick={handleCandidateVerificationSend}
                    disabled={isSendingCandidateVerification || candidateVerificationSecondsLeft > 0}
                  >
                    {isSendingCandidateVerification ? '전송 중...' : '인증번호 전송'}
                  </button>
                </div>

                {candidateVerificationSecondsLeft > 0 ? (
                  <p className="company-form__cooldown" role="status">
                    {candidateVerificationSecondsLeft}초 뒤에 다시 요청할 수 있습니다.
                  </p>
                ) : null}

                {candidateVerificationSent ? (
                  <div className="company-form__email-row company-form__email-row--auth candidate-form__email-row candidate-form__email-row--auth">
                    <label className="company-field company-field--email">
                      <span className="company-field__label">이메일 인증번호</span>
                      <input
                        className={`company-field__input${candidateErrors.verificationCode ? ' company-field__input--error' : ''}`}
                        type="text"
                        name="verificationCode"
                        placeholder={candidateVerificationCodePlaceholder}
                        value={candidateForm.verificationCode}
                        onChange={handleCandidateChange}
                      />
                      {candidateVerificationConfirmed ? (
                        <span className="company-field__success">* 인증되었습니다.</span>
                      ) : null}
                      {candidateErrors.verificationCode ? (
                        <span className="company-field__error">{candidateErrors.verificationCode}</span>
                      ) : null}
                    </label>

                    <button
                      type="button"
                      className="company-form__verify company-form__verify--confirm"
                      onClick={handleCandidateVerificationCheck}
                      disabled={isCheckingCandidateVerification}
                    >
                      {isCheckingCandidateVerification ? '확인 중...' : '인증하기'}
                    </button>
                  </div>
                ) : null}

                {candidateVerificationConfirmed ? (
                  <section className="candidate-form__world-id" aria-label="World ID 인증 안내">
                    <div className="candidate-form__world-id-icon" aria-hidden="true">
                      <WorldLogoMark inverted={true} />
                    </div>
                    <div className="candidate-form__world-id-copy">
                      <strong>
                        {!candidateWorldIdConfig?.enabled
                          ? 'World ID 설정 필요'
                          : candidateWorldIdVerified
                            ? 'World ID 인증 완료'
                            : 'World ID 인증 필요'}
                      </strong>
                      <span>
                        {!candidateWorldIdConfig?.enabled
                          ? 'Developer Portal에서 발급한 app_id, rp_id, signing_key가 필요합니다.'
                          : candidateWorldIdVerified
                            ? '실제 World ID proof 검증이 완료되었습니다.'
                            : 'Proof of Personhood 검증으로 중복·봇 계정을 방지합니다.'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`candidate-form__world-id-button${candidateWorldIdVerified ? ' candidate-form__world-id-button--verified' : ''}`}
                      onClick={handleCandidateWorldIdStart}
                      disabled={isPreparingCandidateWorldId || isVerifyingCandidateWorldId}
                    >
                      {candidateWorldIdButtonLabel}
                    </button>
                  </section>
                ) : null}

                {candidateVerificationConfirmed && candidateWorldIdError ? (
                  <span className="company-field__error company-field__error--inline">
                    {candidateWorldIdError}
                  </span>
                ) : null}

                <div className="candidate-form__spacer" />

                <label className="company-check">
                  <input
                    type="checkbox"
                    name="termsAgreed"
                    checked={candidateForm.termsAgreed}
                    onChange={handleCandidateChange}
                  />
                  <span>이용약관 및 개인정보 수집·이용에 동의합니다.</span>
                </label>
                {candidateErrors.termsAgreed ? (
                  <span className="company-field__error company-field__error--inline">
                    {candidateErrors.termsAgreed}
                  </span>
                ) : null}

                {candidateSubmitError ? (
                  <p className="company-form__server-error" role="alert">
                    {candidateSubmitError}
                  </p>
                ) : null}

                <button type="submit" className="company-form__submit candidate-form__submit">
                  {isCandidateSubmitting ? '회원가입 처리 중...' : '회원가입 하기'}
                </button>

                <p className="company-form__login candidate-form__login">
                  이미 계정이 있으신가요?{' '}
                  <button type="button" onClick={openLoginFlow}>
                    로그인
                  </button>
                </p>
              </form>
            ) : (
              <section className="company-success" aria-live="polite">
                <span className="success-state__badge">가입 요청 완료</span>
                <h2>개인 계정 생성을 위한 확인 메일을 보냈습니다.</h2>
                <p>
                  <strong>{candidateForm.email}</strong> 로 인증 메일을 전송했습니다.
                  메일 인증 후 World ID 확인과 지원자 대시보드 연결 단계로 이어집니다.
                </p>

                <div className="success-state__summary">
                  <div>
                    <span>이름</span>
                    <strong>{candidateForm.name}</strong>
                  </div>
                  <div>
                    <span>등록 이메일</span>
                    <strong>{candidateForm.email}</strong>
                  </div>
                </div>

                <div className="company-success__actions">
                  <button
                    type="button"
                    className="ghost-button ghost-button--wide"
                    onClick={() => setCandidateSubmitted(false)}
                  >
                    정보 수정
                  </button>
                  <button
                    type="button"
                    className="solid-button solid-button--wide"
                    onClick={() => setScreen('landing')}
                  >
                    랜딩으로 이동
                  </button>
                </div>
              </section>
            )}
          </div>
        </section>

        {candidateWorldIdRequest ? (
          <IDKitRequestWidget
            open={candidateWorldIdOpen}
            onOpenChange={setCandidateWorldIdOpen}
            app_id={candidateWorldIdRequest.appId}
            action={candidateWorldIdRequest.action}
            rp_context={candidateWorldIdRequest.rpContext as RpContext}
            allow_legacy_proofs={true}
            environment={candidateWorldIdRequest.environment}
            preset={orbLegacy({ signal: candidateForm.email.trim().toLowerCase() })}
            handleVerify={handleCandidateWorldIdVerify}
            onSuccess={handleCandidateWorldIdSuccess}
            onError={handleCandidateWorldIdError}
          />
        ) : null}

        {renderLoginLayer()}
      </div>
    );
  }

  if (screen === 'companySignup') {
    return (
      <div className="company-signup-page">
        <aside className="company-signup-page__aside">
          <button
            type="button"
            className="company-signup-page__brand"
            onClick={() => setScreen('landing')}
            aria-label="랜딩 페이지로 이동"
          >
            <WorldLogo inverted />
          </button>

          <div className="company-signup-page__hero">
            <h1>
              <span>전문 분야별 AI 에이전트로</span>
              <span>더 정밀하고 효율적으로.</span>
            </h1>
            <p>
              <span>World ID로 실제 사람만 참여합니다.</span>
              <span>전문 AI 에이전트를 통해 직무별·목적별 맞춤 평가를</span>
              <span>빠르고 공정하게 운영할 수 있습니다.</span>
            </p>
          </div>

          <div className="agent-card-list">
            {agentCards.map((agent) => (
              <article className="agent-card" key={agent.title}>
                <div className="agent-card__icon" aria-hidden="true" />
                <div className="agent-card__copy">
                  <strong>{agent.title}</strong>
                  <span>{agent.description}</span>
                </div>
                <div className="agent-card__status" aria-hidden="true" />
              </article>
            ))}
          </div>
        </aside>

        <section className="company-signup-page__panel">
          <div className="company-signup-page__panel-inner">
            <form
              className={`company-form${verificationSent ? ' company-form--verification-sent' : ''}${verificationConfirmed ? ' company-form--verified' : ''}`}
              onSubmit={handleCompanySubmit}
              noValidate
            >
                <h2>계정 만들기</h2>

                <label className="company-field">
                  <span className="company-field__label">기업명</span>
                  <input
                    className={`company-field__input${companyErrors.companyName ? ' company-field__input--error' : ''}`}
                    type="text"
                    name="companyName"
                    value={companyForm.companyName}
                    onChange={handleCompanyChange}
                  />
                  {companyErrors.companyName ? (
                    <span className="company-field__error">{companyErrors.companyName}</span>
                  ) : null}
                </label>

                <div className="company-form__email-row">
                  <label className="company-field company-field--email">
                    <span className="company-field__label">기업 이메일</span>
                    <input
                      className={`company-field__input${companyErrors.companyEmail ? ' company-field__input--error' : ''}`}
                      type="email"
                      name="companyEmail"
                      placeholder="you@example.com"
                      value={companyForm.companyEmail}
                      onChange={handleCompanyChange}
                      readOnly={verificationSent}
                    />
                    {companyErrors.companyEmail ? (
                      <span className="company-field__error">{companyErrors.companyEmail}</span>
                    ) : null}
                  </label>

                  <button
                    type="button"
                    className={`company-form__verify${verificationSent ? ' company-form__verify--timer' : ''}`}
                    onClick={handleVerificationSend}
                    disabled={isSendingCompanyVerification || verificationSecondsLeft > 0}
                  >
                    {isSendingCompanyVerification ? '전송 중...' : '인증번호 전송'}
                  </button>
                </div>

                {verificationSecondsLeft > 0 ? (
                  <p className="company-form__cooldown" role="status">
                    {verificationSecondsLeft}초 뒤에 다시 요청할 수 있습니다.
                  </p>
                ) : null}

                {verificationSent ? (
                  <div className="company-form__email-row company-form__email-row--auth">
                    <label className="company-field company-field--email">
                      <span className="company-field__label">기업 이메일 인증번호</span>
                      <input
                        className={`company-field__input${companyErrors.verificationCode ? ' company-field__input--error' : ''}`}
                        type="text"
                        name="verificationCode"
                        placeholder={companyVerificationCodePlaceholder}
                        value={companyForm.verificationCode}
                        onChange={handleCompanyChange}
                      />
                      {verificationConfirmed ? (
                        <span className="company-field__success">* 인증되었습니다.</span>
                      ) : null}
                      {companyErrors.verificationCode ? (
                        <span className="company-field__error">
                          {companyErrors.verificationCode}
                        </span>
                      ) : null}
                    </label>

                    <button
                      type="button"
                      className="company-form__verify company-form__verify--confirm"
                      onClick={handleVerificationCheck}
                      disabled={isCheckingCompanyVerification}
                    >
                      {isCheckingCompanyVerification ? '확인 중...' : '인증하기'}
                    </button>
                  </div>
                ) : null}

                {verificationConfirmed ? (
                  <div className="company-form__password-row">
                    <label className="company-field">
                      <span className="company-field__label">비밀번호</span>
                      <input
                        className={`company-field__input company-field__input--verified${companyErrors.password ? ' company-field__input--error' : ''}`}
                        type="password"
                        name="password"
                        value={companyForm.password}
                        onChange={handleCompanyChange}
                      />
                      {companyErrors.password ? (
                        <span className="company-field__error">{companyErrors.password}</span>
                      ) : null}
                    </label>

                    <label className="company-field">
                      <span className="company-field__label">비밀번호 재확인</span>
                      <input
                        className={`company-field__input${companyErrors.confirmPassword ? ' company-field__input--error' : ''}`}
                        type="password"
                        name="confirmPassword"
                        value={companyForm.confirmPassword}
                        onChange={handleCompanyChange}
                      />
                      {companyErrors.confirmPassword ? (
                        <span className="company-field__error">
                          {companyErrors.confirmPassword}
                        </span>
                      ) : null}
                    </label>
                  </div>
                ) : null}

                <div className="company-form__spacer" />

                <label className="company-check">
                  <input
                    type="checkbox"
                    name="termsAgreed"
                    checked={companyForm.termsAgreed}
                    onChange={handleCompanyChange}
                  />
                  <span>이용약관 및 개인정보 수집·이용에 동의합니다.</span>
                </label>
                {companyErrors.termsAgreed ? (
                  <span className="company-field__error company-field__error--inline">
                    {companyErrors.termsAgreed}
                  </span>
                ) : null}

                {companySubmitError ? (
                  <p className="company-form__server-error" role="alert">
                    {companySubmitError}
                  </p>
                ) : null}

                <button type="submit" className="company-form__submit">
                  {isCompanySubmitting ? '회원가입 처리 중...' : '회원가입 하기'}
                </button>

                <p className="company-form__login">
                  이미 계정이 있으신가요?{' '}
                  <button type="button" onClick={openLoginFlow}>
                    로그인
                  </button>
                </p>
              </form>
          </div>
        </section>

        {renderLoginLayer()}
      </div>
    );
  }

  return (
    <div className="page-shell">
      <main className="landing-page" aria-hidden={isModalOpen}>
        <header className="topbar">
          <WorldLogo />

          <div className="topbar__actions">
            <button
              type="button"
              className="ghost-button ghost-button--small"
              onClick={openLoginFlow}
            >
              로그인
            </button>
            <button
              type="button"
              className="solid-button solid-button--small"
              onClick={openSignupFlow}
            >
              회원가입
            </button>
          </div>
        </header>

        <div className="topbar-divider" />

        <section className="hero">
          <div className="hero__copy">
            <h1>
              <span>World ID 기반으로</span>
              <span>검증된 인간을, 더 공정하게</span>
            </h1>
            <p>
              <span>World ID 신원 인증과 멀티 에이전트 AI 평가를 결합해</span>
              <span>모든 선발 과정의 공정성과 신뢰를 높입니다.</span>
            </p>

            <div className="hero__actions">
              <button
                type="button"
                className="solid-button"
                onClick={() => {
                  if (authCompanyUser) {
                    setCompanyDashboardView('home');
                    setScreen('companyTemp');
                    return;
                  }

                  if (authCandidateUser) {
                    setScreen('candidateTemp');
                    return;
                  }

                  openLoginFlow();
                }}
              >
                {authCompanyUser || authCandidateUser ? '임시페이지로 이동' : '홈 대시보드'}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={openSignupFlow}
              >
                시작하기
              </button>
            </div>
          </div>
        </section>

        <section className="features">
          <h2>왜 WorldFit인가?</h2>

          <div className="feature-grid">
            {landingFeatureCards.map((card) => (
              <article className="feature-card" key={card.title}>
                <p className="feature-card__title">
                  <span className="feature-card__icon" aria-hidden="true">
                    {card.icon}
                  </span>
                  <span>{card.title}</span>
                </p>

                <div className="feature-card__description">
                  {card.description.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>

                <button
                  type="button"
                  className="feature-card__link"
                  onClick={openSignupFlow}
                >
                  자세히 보기 →
                </button>
              </article>
            ))}
          </div>
        </section>

        <footer className="footer">
          <p>© 2026 WorldFit · Built on World ID · WLD 결제</p>
          <nav aria-label="Footer links">
            <a href="/">이용약관</a>
            <a href="/">개인정보처리방침</a>
            <a href="/">고객지원</a>
          </nav>
        </footer>
      </main>

      {renderLoginLayer()}

      {isModalOpen ? (
        <div className="modal-layer" role="presentation">
          <div className="modal-backdrop" onClick={closeModal} />

          {modalStep === 'role' ? (
            <section
              className="role-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="role-modal-title"
            >
              <div className="role-modal__header">
                <WorldLogo />
                <button
                  type="button"
                  className="role-modal__close"
                  aria-label="닫기"
                  onClick={closeModal}
                >
                  ×
                </button>
              </div>

              <h3 id="role-modal-title">역할 선택</h3>

              <div className="role-modal__selector" aria-label="역할 선택">
                <button
                  type="button"
                  className={`role-pill${selectedRole === 'candidate' ? ' role-pill--active' : ''}`}
                  onClick={() => setSelectedRole('candidate')}
                >
                  지원자 (개인)
                </button>
                <button
                  type="button"
                  className={`role-pill${selectedRole === 'organizer' ? ' role-pill--active' : ''}`}
                  onClick={() => setSelectedRole('organizer')}
                >
                  기업 / 주최자
                </button>
              </div>

              <button
                type="button"
                className="role-modal__cta"
                onClick={() => {
                  if (selectedRole === 'organizer') {
                    openCompanySignupScreen();
                    return;
                  }

                  openCandidateSignupScreen();
                }}
              >
                {modalActionLabel}
              </button>
            </section>
          ) : null}

          {modalStep === 'signup' ? (
            <section
              className="signup-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="signup-modal-title"
            >
              <div className="role-modal__header">
                <WorldLogo />
                <button
                  type="button"
                  className="role-modal__close"
                  aria-label="닫기"
                  onClick={closeModal}
                >
                  ×
                </button>
              </div>

              <div className="signup-modal__intro">
                <button
                  type="button"
                  className="signup-modal__back"
                  onClick={() => setModalStep('role')}
                >
                  ← 역할 다시 선택
                </button>
                <h3 id="signup-modal-title">{candidateSignupTitle}</h3>
                <p>{candidateSignupDescription}</p>
              </div>

              <form className="signup-form" onSubmit={handleCandidateSubmit} noValidate>
                <div className="signup-form__grid">
                  <label className="field">
                    <span className="field__label">이름</span>
                    <input
                      className={`field__input${candidateErrors.name ? ' field__input--error' : ''}`}
                      name="name"
                      type="text"
                      placeholder="홍길동"
                      value={candidateForm.name}
                      onChange={handleCandidateChange}
                    />
                    {candidateErrors.name ? (
                      <span className="field__error">{candidateErrors.name}</span>
                    ) : null}
                  </label>

                  <label className="field">
                    <span className="field__label">이메일</span>
                    <input
                      className={`field__input${candidateErrors.email ? ' field__input--error' : ''}`}
                      name="email"
                      type="email"
                      placeholder="name@worldfit.ai"
                      value={candidateForm.email}
                      onChange={handleCandidateChange}
                    />
                    {candidateErrors.email ? (
                      <span className="field__error">{candidateErrors.email}</span>
                    ) : null}
                  </label>

                  <label className="field">
                    <span className="field__label">비밀번호</span>
                    <input
                      className={`field__input${candidateErrors.password ? ' field__input--error' : ''}`}
                      name="password"
                      type="password"
                      placeholder="8자 이상 입력"
                      value={candidateForm.password}
                      onChange={handleCandidateChange}
                    />
                    {candidateErrors.password ? (
                      <span className="field__error">{candidateErrors.password}</span>
                    ) : null}
                  </label>

                  <label className="field">
                    <span className="field__label">소속 / 학교 / 커뮤니티</span>
                    <input
                      className={`field__input${candidateErrors.organization ? ' field__input--error' : ''}`}
                      name="organization"
                      type="text"
                      placeholder="예: 서울대학교 / 개인 프로젝트"
                      value={candidateForm.organization}
                      onChange={handleCandidateChange}
                    />
                    {candidateErrors.organization ? (
                      <span className="field__error">{candidateErrors.organization}</span>
                    ) : null}
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">초대 코드</span>
                  <input
                    className="field__input"
                    name="inviteCode"
                    type="text"
                    placeholder="선택 입력"
                    value={candidateForm.inviteCode}
                    onChange={handleCandidateChange}
                  />
                </label>

                <div className="signup-form__meta">
                  <div className="signup-form__summary">
                    <span className="signup-form__badge">개인 계정</span>
                    <p>
                      가입 후 World ID 인증과 역할별 대시보드 연결 단계로
                      이어집니다.
                    </p>
                  </div>

                  <div className="signup-form__checks">
                    <label className="check">
                      <input
                        name="marketingConsent"
                        type="checkbox"
                        checked={candidateForm.marketingConsent}
                        onChange={handleCandidateChange}
                      />
                      <span>출시 소식과 업데이트 메일 수신에 동의합니다. (선택)</span>
                    </label>

                    <label className="check">
                      <input
                        name="termsAgreed"
                        type="checkbox"
                        checked={candidateForm.termsAgreed}
                        onChange={handleCandidateChange}
                      />
                      <span>이용약관 및 개인정보처리방침에 동의합니다. (필수)</span>
                    </label>
                    {candidateErrors.termsAgreed ? (
                      <span className="field__error">{candidateErrors.termsAgreed}</span>
                    ) : null}
                  </div>
                </div>

                <div className="signup-form__actions">
                  <button
                    type="button"
                    className="ghost-button ghost-button--wide"
                    onClick={() => setModalStep('role')}
                  >
                    이전
                  </button>
                  <button type="submit" className="solid-button solid-button--wide">
                    지원자 계정 생성
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {modalStep === 'success' ? (
            <section
              className="signup-modal signup-modal--success"
              role="dialog"
              aria-modal="true"
              aria-labelledby="signup-success-title"
            >
              <div className="role-modal__header">
                <WorldLogo />
                <button
                  type="button"
                  className="role-modal__close"
                  aria-label="닫기"
                  onClick={closeModal}
                >
                  ×
                </button>
              </div>

              <div className="success-state">
                <span className="success-state__badge">가입 완료</span>
                <h3 id="signup-success-title">
                  {candidateForm.name || '새 계정'}님의 가입 요청이 접수되었습니다.
                </h3>
                <p>
                  {candidateForm.email} 로 확인 메일을 보냈습니다. 다음 단계에서
                  World ID 인증을 완료하면 평가 세션 참여가 가능합니다.
                </p>

                <div className="success-state__summary">
                  <div>
                    <span>가입 유형</span>
                    <strong>지원자 (개인)</strong>
                  </div>
                  <div>
                    <span>소속 / 학교 / 커뮤니티</span>
                    <strong>{candidateForm.organization}</strong>
                  </div>
                </div>

                <div className="signup-form__actions">
                  <button
                    type="button"
                    className="ghost-button ghost-button--wide"
                    onClick={() => {
                      setModalStep('signup');
                    }}
                  >
                    정보 수정
                  </button>
                  <button
                    type="button"
                    className="solid-button solid-button--wide"
                    onClick={closeModal}
                  >
                    시작 화면으로
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default App;
