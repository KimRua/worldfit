import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  IDKitErrorCodes,
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from '@worldcoin/idkit';
import {
  ApiError,
  createCandidateLoginWorldIdRpSignature,
  createCandidateWorldIdRpSignature,
  fetchCurrentSessionUser,
  fetchWorldIdConfig,
  loginCandidate,
  loginCandidateWithWorldId,
  loginCompany,
  logoutCompany,
  sendCandidateLoginCode,
  sendCandidateVerificationCode,
  sendCompanyVerificationCode,
  sendCompanyUnlockCode,
  signupCandidate,
  signupCompany,
  verifyCandidateWorldId,
  verifyCandidateVerificationCode,
  verifyCompanyUnlockCode,
  verifyCompanyVerificationCode,
  type CandidateSessionUser,
  type CompanySessionUser,
  type WorldIdConfig,
  type WorldIdRpSignature,
} from './api';

type Role = 'candidate' | 'organizer';
type ModalStep = 'role' | 'signup' | 'success';
type LoginModalStep = 'role' | 'form';
type Screen = 'landing' | 'candidateSignup' | 'companySignup' | 'companyTemp' | 'candidateTemp';
type CandidateLoginMethod = 'worldId' | 'email';
type CompanyDashboardView = 'home' | 'jobs' | 'report' | 'create' | 'fraud';
type CompanyCreateStage = 1 | 2 | 3;
type CompanyCreatePricingUnit = 'WLD' | 'USDT';
type CompanyCreateAgentDetailTab = 'criteria' | 'behavior' | 'domains' | 'reviews';

type CompanyJobStatusTone = 'dark' | 'danger' | 'muted' | 'soft';
type CompanyFraudCaseStatus = 'pending' | 'investigating' | 'resolved' | 'dismissed';
type CompanyFraudSeverity = 'high' | 'medium' | 'low';
type CompanySessionType = 'recruiting' | 'contest' | 'audition' | 'education';

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
  title: string;
  type: string;
  period: string;
  applicants: string;
  status: string;
  statusTone: CompanyJobStatusTone;
  fraudCount: number | null;
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

type CompanyCreateForm = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  capacity: string;
  accessMode: 'public' | 'private';
  visibilityScope: string;
};

type CompanyCreateProcess = {
  id: number;
  name: string;
  content: string;
  submissionMethod: string;
};

type CompanyCreateAgent = {
  id: string;
  icon: string;
  name: string;
  billingLabel: string;
  description: string;
  selected: boolean;
  weight: number;
  locked?: boolean;
};

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
  startDate: '',
  endDate: '',
  capacity: '',
  accessMode: 'public',
  visibilityScope: '초대 링크 전용',
};

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
const COMPANY_CREATE_WLD_TO_USDT = 2.4;

const initialCompanyCreateAgents: CompanyCreateAgent[] = [
  {
    id: 'technical',
    icon: '⚙',
    name: 'Technical Evaluator',
    billingLabel: 'Technical',
    description: '코드 구조·설계 품질·기술 이해도',
    selected: true,
    weight: 35,
  },
  {
    id: 'reasoning',
    icon: '🧠',
    name: 'Reasoning Evaluator',
    billingLabel: 'Reasoning',
    description: '문제 접근·논리 구조 분석',
    selected: true,
    weight: 25,
  },
  {
    id: 'communication',
    icon: '💬',
    name: 'Communication Evaluator',
    billingLabel: 'Communication',
    description: '표현 명확성·전달력',
    selected: true,
    weight: 25,
  },
  {
    id: 'creativity',
    icon: '✨',
    name: 'Creativity Evaluator',
    billingLabel: 'Creativity',
    description: '접근의 독창성·차별성',
    selected: true,
    weight: 10,
  },
  {
    id: 'integrity',
    icon: '🛡',
    name: 'Integrity Monitor',
    billingLabel: 'Integrity',
    description: 'AI 대필·표절·행동 이상',
    selected: true,
    weight: 5,
  },
  {
    id: 'domain-fintech-1',
    icon: '🌐',
    name: 'Domain Expert · Fintech',
    billingLabel: 'Domain',
    description: '도메인 지식 평가',
    selected: false,
    weight: 0,
    locked: true,
  },
  {
    id: 'custom-rubric',
    icon: '🎯',
    name: 'Custom · My Team Rubric',
    billingLabel: 'Custom',
    description: '우리 팀 평가 기준',
    selected: false,
    weight: 0,
    locked: true,
  },
  {
    id: 'domain-fintech-2',
    icon: '🌐',
    name: 'Domain Expert · Fintech',
    billingLabel: 'Domain',
    description: '도메인 지식 평가',
    selected: false,
    weight: 0,
    locked: true,
  },
  {
    id: 'domain-fintech-3',
    icon: '🌐',
    name: 'Domain Expert · Fintech',
    billingLabel: 'Domain',
    description: '도메인 지식 평가',
    selected: false,
    weight: 0,
    locked: true,
  },
  {
    id: 'domain-fintech-4',
    icon: '🌐',
    name: 'Domain Expert · Fintech',
    billingLabel: 'Domain',
    description: '도메인 지식 평가',
    selected: false,
    weight: 0,
    locked: true,
  },
  {
    id: 'domain-fintech-5',
    icon: '🌐',
    name: 'Domain Expert · Fintech',
    billingLabel: 'Domain',
    description: '도메인 지식 평가',
    selected: false,
    weight: 0,
    locked: true,
  },
] as const;

const companyCreateAgentDetailTabs: readonly { key: CompanyCreateAgentDetailTab; label: string }[] = [
  { key: 'criteria', label: '평가 기준' },
  { key: 'behavior', label: '동작 방식' },
  { key: 'domains', label: '지원 도메인' },
  { key: 'reviews', label: '리뷰' },
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
      { id: 'custom-rubric', icon: '🎯', name: 'Custom · My Team Rubric', meta: '라이선스 필요' },
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
  'custom-rubric': {
    summary: '우리 팀만의 평가 기준을 직접 반영하는 커스텀 에이전트 템플릿',
    rating: 4.3,
    reviewCount: '218',
    criteriaTitle: '평가 기준 (5축)',
    criteria: [
      { title: '팀 기준 정렬', description: '사내 평가 문구와 지표를 그대로 반영하는지' },
      { title: '역할 적합성', description: '직무별로 필요한 역량이 분리되어 있는지' },
      { title: '설명 가능성', description: '심사 기준을 외부에도 설명할 수 있는지' },
      { title: '확장성', description: '다른 세션으로 재사용 가능한지' },
      { title: '운영 편의성', description: '운영자가 수정·관리하기 쉬운 구조인지' },
    ],
    behavior: [
      { title: '팀 기준 업로드', description: '사내 루브릭을 입력해 커스텀 평가 축을 생성합니다.' },
      { title: '세션별 템플릿화', description: '채용, 공모전, 교육용으로 템플릿을 분기합니다.' },
      { title: '가중치 상속', description: '다른 에이전트와 함께 섞일 때도 축별 비중을 유지합니다.' },
      { title: '버전 관리', description: '루브릭 변경 이력을 남겨 시즌별 비교가 가능해집니다.' },
    ],
    domains: ['Custom Hiring', 'Internal Training', 'Rubric Import', 'Team Review', 'Special Project'],
    sampleTitle: 'Custom Rubric Preview - team_hiring_v2...',
    sampleSummary: '우리 팀 기준 5축 · 협업 25 · 제품 감각 20 · 실행력 20 · 기술 깊이 20 · 문서화 15',
    sampleExcerpt: [
      '사내 기준을 그대로 점수화하므로 면접관 정성 평가와 수치 결과를 더 쉽게 연결할 수 있습니다.',
      '현재는 라이선스가 만료되어 있어 갱신 후 세션에 추가할 수 있습니다.',
    ],
    relatedAgents: [
      { id: 'communication', icon: '💬', name: 'Communication Evaluator', meta: '10.5 WLD | 19개 팀' },
      { id: 'integrity', icon: '🛡', name: 'Integrity Monitor', meta: '14 WLD | 17개 팀' },
    ],
    reviews: [
      {
        title: '사내 기준 반영이 편했습니다',
        body: '면접관들이 쓰던 문구를 그대로 넣을 수 있어 온보딩이 빨랐습니다.',
        meta: 'People Ops · 1개월 전',
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
  { label: '블라인드 랭킹' },
  { label: '부정 알림', view: 'fraud' },
  { label: '에이전트 마켓' },
  { label: '설정' },
] as const;

const companyDashboardSummaryCards = [
  {
    label: '활성 세션',
    value: '8',
    detail: '+2 this week',
  },
  {
    label: '총 지원자',
    value: '412',
    detail: '6개 세션 기준',
  },
  {
    label: 'WLD 소진',
    value: '1,860',
    detail: '평균 세션 당 232',
  },
  {
    label: '크레딧',
    value: '$10,000',
    detail: '',
  },
] as const;

const companyDashboardSessions = [
  {
    name: '백엔드 #7291',
    type: '채용',
    applicants: '42명',
    progress: 82,
    fraudCount: null,
  },
  {
    name: 'UX 오디션',
    type: '오디션',
    applicants: '28명',
    progress: 56,
    fraudCount: 2,
  },
  {
    name: 'AI 엔지니어',
    type: '채용',
    applicants: '36명',
    progress: 100,
    fraudCount: 1,
  },
  {
    name: '공공데이터 공모전',
    type: '공모전',
    applicants: '88명',
    progress: 22,
    fraudCount: null,
  },
  {
    name: '콘텐츠 기획자',
    type: '채용',
    applicants: '18명',
    progress: 68,
    fraudCount: null,
  },
  {
    name: '프론트 2년차',
    type: '채용',
    applicants: '22명',
    progress: 90,
    fraudCount: 3,
  },
] as const;

const companyDashboardAlerts = [
  'UX 오디션 #34 — AI 대필 의심',
  '프론트 2년차 #12 — 포커스 이탈',
  '백엔드 #7291 #18 — 타자 패턴',
] as const;

const companyFraudFilterOptions: readonly {
  key: CompanyFraudCaseStatus;
  label: string;
}[] = [
  { key: 'pending', label: '대기 6' },
  { key: 'investigating', label: '조사중 2' },
  { key: 'resolved', label: '처리됨 14' },
  { key: 'dismissed', label: '기각 3' },
] as const;

const companyFraudCases: readonly CompanyFraudCase[] = [
  {
    id: 'fraud-ux-55bc',
    title: 'UX 오디션 · wid_0x55bc…',
    detailId: 'wid_0x55bc…',
    issue: 'AI 대필 의심',
    severity: 'high',
    confidence: 92,
    timestamp: '4/20 13:58',
    status: 'pending',
    evidenceTitle: '증거 — 스크린샷',
    evidences: ['브라우저 포커스 이탈 감지 (3:41)', '동일 답변 벡터 유사도 98%'],
    behaviorLogs: ['13:52 질문 수신', '13:53 새 탭 열림', '13:56 답변 붙여넣기', '13:58 Q&A 응답 전송'],
  },
  {
    id: 'fraud-frontend-4fa2',
    title: '프론트 2년차 · wid_0x4fa2…',
    detailId: 'wid_0x4fa2…',
    issue: '포커스 이탈 반복',
    severity: 'medium',
    confidence: 68,
    timestamp: '4/20 13:48',
    status: 'pending',
    evidenceTitle: '증거 — 행동 캡처',
    evidences: ['포커스 이탈 이벤트 5회', '탭 전환 간격이 비정상적으로 짧음'],
    behaviorLogs: ['13:41 답변 작성 시작', '13:43 새 창 전환', '13:45 포커스 복귀', '13:48 제출 전 장시간 이탈'],
  },
  {
    id: 'fraud-backend-18af',
    title: '백엔드 #7291 · wid_0x18af…',
    detailId: 'wid_0x18af…',
    issue: '타자 패턴 이상',
    severity: 'medium',
    confidence: 62,
    timestamp: '4/20 13:42',
    status: 'pending',
    evidenceTitle: '증거 — 입력 로그',
    evidences: ['평균 타자 간격 편차 급증', '붙여넣기 직후 응답 속도 급변'],
    behaviorLogs: ['13:34 질문 열람', '13:37 입력 패턴 불안정 감지', '13:40 대량 텍스트 붙여넣기'],
  },
  {
    id: 'fraud-ai-91bc',
    title: 'AI 엔지니어 · wid_0x91bc…',
    detailId: 'wid_0x91bc…',
    issue: '표절 감지',
    severity: 'high',
    confidence: 88,
    timestamp: '4/20 13:28',
    status: 'pending',
    evidenceTitle: '증거 — 유사도 리포트',
    evidences: ['외부 공개 글과 문장 유사도 94%', '핵심 단락 순서가 원문과 동일'],
    behaviorLogs: ['13:21 과제 진입', '13:24 외부 문서 열람 추정', '13:28 제출'],
  },
  {
    id: 'fraud-frontend-88fa',
    title: '프론트 2년차 · wid_0x88fa…',
    detailId: 'wid_0x88fa…',
    issue: '제출물 중복',
    severity: 'low',
    confidence: 41,
    timestamp: '4/20 13:12',
    status: 'pending',
    evidenceTitle: '증거 — 중복 제출 비교',
    evidences: ['기존 제출물과 구조 유사', '핵심 문장만 일부 교체됨'],
    behaviorLogs: ['13:02 작성 시작', '13:08 유사 응답 탐지', '13:12 제출'],
  },
  {
    id: 'fraud-server-22cd',
    title: '서버 개발자 · wid_0x22cd…',
    detailId: 'wid_0x22cd…',
    issue: '응답 일관성 저하',
    severity: 'low',
    confidence: 38,
    timestamp: '4/20 12:58',
    status: 'pending',
    evidenceTitle: '증거 — 세션 비교',
    evidences: ['이전 답변 대비 문체 급변', '질문 난이도 대비 설명 수준 편차 큼'],
    behaviorLogs: ['12:46 세션 시작', '12:53 답변 톤 급변', '12:58 응답 전송'],
  },
  {
    id: 'fraud-ml-71ab',
    title: 'ML 과제 · wid_0x71ab…',
    detailId: 'wid_0x71ab…',
    issue: '브라우저 매크로 감지',
    severity: 'medium',
    confidence: 71,
    timestamp: '4/20 11:44',
    status: 'investigating',
    evidenceTitle: '증거 — 세션 자동화 흔적',
    evidences: ['입력 간격이 기계적으로 반복됨', '마우스 이동 없이 인터랙션 진행'],
    behaviorLogs: ['11:32 세션 시작', '11:38 반복 입력 패턴 감지', '11:44 조사 큐 이동'],
  },
  {
    id: 'fraud-pm-28fe',
    title: 'PM 챌린지 · wid_0x28fe…',
    detailId: 'wid_0x28fe…',
    issue: '비정상 네트워크 이동',
    severity: 'high',
    confidence: 83,
    timestamp: '4/20 11:18',
    status: 'investigating',
    evidenceTitle: '증거 — 네트워크 로그',
    evidences: ['짧은 시간 내 국가 코드가 2회 변경', 'VPN 전환 직후 제출'],
    behaviorLogs: ['11:07 과제 진입', '11:12 IP 변경 감지', '11:18 조사중으로 전환'],
  },
  {
    id: 'fraud-qa-62ce',
    title: 'QA 포지션 · wid_0x62ce…',
    detailId: 'wid_0x62ce…',
    issue: '응답 일관성 저하',
    severity: 'low',
    confidence: 29,
    timestamp: '4/19 17:11',
    status: 'resolved',
    evidenceTitle: '증거 — 조사 완료 메모',
    evidences: ['면접관 수동 검토 완료', '부정 가능성 낮음으로 분류'],
    behaviorLogs: ['17:05 검토 시작', '17:09 운영자 확인', '17:11 처리 완료'],
  },
  {
    id: 'fraud-brand-7df1',
    title: '브랜딩 공모전 · wid_0x7df1…',
    detailId: 'wid_0x7df1…',
    issue: '중복 제출',
    severity: 'low',
    confidence: 33,
    timestamp: '4/19 16:08',
    status: 'dismissed',
    evidenceTitle: '증거 — 기각 메모',
    evidences: ['동일 제출로 보였으나 팀 공동 작업물로 확인', '오탐으로 최종 판정'],
    behaviorLogs: ['15:56 알림 생성', '16:03 확인 요청', '16:08 기각 처리'],
  },
] as const;

const companyDashboardWldUsage = [
  72, 49, 55, 56, 50, 40, 31, 50, 24, 27,
  32, 40, 52, 55, 83, 38, 32, 27, 24, 25,
  28, 67, 38, 42, 42, 38, 32, 28, 38,
] as const;

const companyJobStatusFilters: readonly CompanyJobStatusFilter[] = [
  { label: '전체 24', active: true },
  { label: '대기 4' },
  { label: '진행 8' },
  { label: '종료 12' },
] as const;

const companyJobListings: readonly CompanyJobListing[] = [
  {
    title: '백엔드 개발자 채용 #7291',
    type: '채용',
    period: '5/1-5/15',
    applicants: '42명',
    status: '진행',
    statusTone: 'dark',
    fraudCount: null,
  },
  {
    title: 'UX 디자이너 오디션',
    type: '오디션',
    period: '4/28-5/12',
    applicants: '28명',
    status: '진행',
    statusTone: 'dark',
    fraudCount: 2,
  },
  {
    title: 'AI 엔지니어 #6104',
    type: '채용',
    period: '4/20-5/4',
    applicants: '36명',
    status: '마감 임박',
    statusTone: 'danger',
    fraudCount: 1,
  },
  {
    title: '공공데이터 공모전',
    type: '공모전',
    period: '5/1-5/30',
    applicants: '88명',
    status: '진행',
    statusTone: 'dark',
    fraudCount: null,
  },
  {
    title: '콘텐츠 기획자',
    type: '채용',
    period: '4/10-4/24',
    applicants: '18명',
    status: '종료',
    statusTone: 'muted',
    fraudCount: null,
  },
  {
    title: '프론트 2년차',
    type: '채용',
    period: '4/1-4/22',
    applicants: '22명',
    status: '진행',
    statusTone: 'dark',
    fraudCount: 3,
  },
  {
    title: '해커톤 오디션 Vol.3',
    type: '오디션',
    period: '5/10-5/20',
    applicants: '0명',
    status: '대기',
    statusTone: 'soft',
    fraudCount: null,
  },
  {
    title: '신입 기획자 공채',
    type: '채용',
    period: '4/5-4/19',
    applicants: '64명',
    status: '종료',
    statusTone: 'muted',
    fraudCount: 1,
  },
  {
    title: 'UX 리서처 신입',
    type: '채용',
    period: '5/1-5/14',
    applicants: '12명',
    status: '진행',
    statusTone: 'dark',
    fraudCount: null,
  },
  {
    title: '서버 개발자 #4102',
    type: '채용',
    period: '3/28-4/11',
    applicants: '24명',
    status: '종료',
    statusTone: 'muted',
    fraudCount: 2,
  },
  {
    title: '플랫폼 엔지니어',
    type: '채용',
    period: '4/15-5/1',
    applicants: '9명',
    status: '진행',
    statusTone: 'dark',
    fraudCount: null,
  },
  {
    title: '디자인 공모전',
    type: '공모전',
    period: '5/1-6/1',
    applicants: '0명',
    status: '대기',
    statusTone: 'soft',
    fraudCount: null,
  },
] as const;

const companyReportHistogram = [
  { label: '50', height: 22 },
  { label: '55', height: 44 },
  { label: '60', height: 60 },
  { label: '65', height: 92 },
  { label: '70', height: 138 },
  { label: '75', height: 108 },
  { label: '80', height: 76 },
  { label: '85', height: 60 },
  { label: '90', height: 30 },
  { label: '95', height: 22 },
] as const;

const companyReportTopCandidates = [
  { rank: 1, id: 'wid_0x82f4…', score: 89.4 },
  { rank: 2, id: 'wid_0x9e21…', score: 87.2 },
  { rank: 3, id: 'wid_0x74a8…', score: 85.8 },
  { rank: 4, id: 'wid_0x55c3…', score: 84.1 },
  { rank: 5, id: 'wid_0x91bc…', score: 82.7 },
] as const;

const companyReportAgentScores = [
  { label: 'Technical', score: 78, bandStart: 64, bandWidth: 24 },
  { label: 'Reasoning', score: 74, bandStart: 58, bandWidth: 28 },
  { label: 'Communication', score: 72, bandStart: 54, bandWidth: 32 },
  { label: 'Creativity', score: 68, bandStart: 48, bandWidth: 36 },
  { label: 'Integrity', score: 92, bandStart: 86, bandWidth: 12 },
] as const;

const companyReportImprovements = [
  { label: '#테스트 전략 미흡', count: 26, tone: 'danger' },
  { label: '#장애 복구 경험', count: 22, tone: 'danger' },
  { label: '#Creativity 전반 저조', count: 18, tone: 'danger' },
  { label: '#Reasoning 구조화', count: 14, tone: 'dark' },
  { label: '#도메인 이해도 부족', count: 10, tone: 'dark' },
] as const;

const companyCreateSteps: readonly CompanyCreateStep[] = [
  { step: 1, title: '기본 설정', active: true },
  { step: 2, title: '과정 구성' },
  { step: 3, title: '에이전트 선택' },
  { step: 4, title: '검토 및 발행' },
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

const companyCreatePublicScopeOptions = ['초대 링크 전용', '공개'] as const;

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

function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [companyDashboardView, setCompanyDashboardView] = useState<CompanyDashboardView>('home');
  const [companyCreateStep, setCompanyCreateStep] = useState<CompanyCreateStage>(1);
  const [selectedCompanyJob, setSelectedCompanyJob] = useState<CompanyJobListing>(companyJobListings[0]);
  const [companyFraudFilter, setCompanyFraudFilter] = useState<CompanyFraudCaseStatus>('pending');
  const [selectedCompanyFraudCaseId, setSelectedCompanyFraudCaseId] = useState(companyFraudCases[0].id);
  const [companyCreateSessionType, setCompanyCreateSessionType] = useState<CompanySessionType>('recruiting');
  const [companyCreateForm, setCompanyCreateForm] = useState<CompanyCreateForm>(initialCompanyCreateForm);
  const [companyCreateProcesses, setCompanyCreateProcesses] = useState<CompanyCreateProcess[]>(initialCompanyCreateProcesses);
  const [companyCreateAgents, setCompanyCreateAgents] = useState<CompanyCreateAgent[]>([...initialCompanyCreateAgents]);
  const [companyCreatePricingUnit, setCompanyCreatePricingUnit] = useState<CompanyCreatePricingUnit>('WLD');
  const [companyCreateExpectedApplicants, setCompanyCreateExpectedApplicants] = useState('50');
  const [selectedCompanyCreateAgentId, setSelectedCompanyCreateAgentId] = useState<string | null>(null);
  const [companyCreateAgentDetailTab, setCompanyCreateAgentDetailTab] =
    useState<CompanyCreateAgentDetailTab>('criteria');
  const [openCompanyCreateProcessId, setOpenCompanyCreateProcessId] = useState<number | null>(null);
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
  const [authCompanyUser, setAuthCompanyUser] = useState<CompanySessionUser | null>(null);
  const [authCandidateUser, setAuthCandidateUser] = useState<CandidateSessionUser | null>(null);
  const [authBootstrapComplete, setAuthBootstrapComplete] = useState(false);
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
      isModalOpen || companyLoginOpen || selectedCompanyCreateAgentId ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [companyLoginOpen, isModalOpen, selectedCompanyCreateAgentId]);

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
      .then(({ companyUser, candidateUser }) => {
        if (!isMounted) {
          return;
        }

        if (companyUser) {
          setAuthCompanyUser(companyUser);
          setAuthCandidateUser(null);
          setCompanyDashboardView('home');
          setScreen('companyTemp');
          return;
        }

        if (candidateUser) {
          setAuthCandidateUser(candidateUser);
          setAuthCompanyUser(null);
          setCandidateAuthMode('login');
          setScreen('candidateTemp');
          return;
        }

        setAuthCompanyUser(null);
        setAuthCandidateUser(null);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

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

  const handleCompanyLogout = async () => {
    try {
      await logoutCompany();
    } catch {
      // Even if the server session is already gone, the local UI should recover.
    } finally {
      setAuthCompanyUser(null);
      setAuthCandidateUser(null);
      setCompanyDashboardView('home');
      setScreen('landing');
    }
  };

  const handleCompanyCreateFormChange =
    (field: keyof CompanyCreateForm) => (event: ChangeEvent<HTMLInputElement>) => {
      const { value } = event.target;
      setCompanyCreateForm((current) => ({
        ...current,
        [field]: value,
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
    setOpenCompanyCreateProcessId((current) => (current === processId ? null : current));
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
    setOpenCompanyCreateProcessId(null);
  };

  const handleCompanyCreateAgentToggle = (agentId: string) => {
    setCompanyCreateAgents((current) =>
      current.map((agent) =>
        agent.id === agentId && !agent.locked
          ? {
              ...agent,
              selected: !agent.selected,
            }
          : agent,
      ),
    );
  };

  const handleCompanyCreateAgentWeightChange =
    (agentId: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const weight = Number(event.target.value);
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
    setCompanyFraudFilter(status);
    setSelectedCompanyFraudCaseId(
      fraudCaseId ?? companyFraudCases.find((item) => item.status === status)?.id ?? companyFraudCases[0].id,
    );
    setCompanyDashboardView('fraud');
  };

  const openCompanyCreate = () => {
    setCompanyCreateStep(1);
    setSelectedCompanyCreateAgentId(null);
    setCompanyDashboardView('create');
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

  if (screen === 'companyTemp' && authCompanyUser) {
    const wldUsageMax = Math.max(...companyDashboardWldUsage);
    const visibleCompanyFraudCases = companyFraudCases.filter((item) => item.status === companyFraudFilter);
    const selectedCompanyFraudCase =
      visibleCompanyFraudCases.find((item) => item.id === selectedCompanyFraudCaseId) ??
      visibleCompanyFraudCases[0] ??
      companyFraudCases.find((item) => item.id === selectedCompanyFraudCaseId) ??
      companyFraudCases[0];
    const selectedCompanyCreateAgents = companyCreateAgents.filter((agent) => agent.selected);
    const companyCreateWeightTotal = selectedCompanyCreateAgents.reduce((sum, agent) => sum + agent.weight, 0);
    const companyCreateMaxWeight = Math.max(...selectedCompanyCreateAgents.map((agent) => agent.weight), 1);
    const companyCreateCostPerApplicantWld =
      (companyCreateWeightTotal / 100) * COMPANY_CREATE_COST_PER_APPLICANT_WLD;
    const companyCreateExpectedApplicantsCount =
      Number.parseInt(companyCreateExpectedApplicants.replace(/[^0-9]/g, ''), 10) || 0;
    const companyCreateSessionCostWld =
      companyCreateCostPerApplicantWld * companyCreateExpectedApplicantsCount;
    const companyCreateRemainingWld = COMPANY_CREATE_WLD_BALANCE - companyCreateSessionCostWld;
    const isCompanyCreateWeightBalanced = companyCreateWeightTotal === 100;
    const selectedCompanyCreateAgentDetailSource = selectedCompanyCreateAgentId
      ? companyCreateAgents.find((agent) => agent.id === selectedCompanyCreateAgentId) ?? null
      : null;
    const selectedCompanyCreateAgentDetail = selectedCompanyCreateAgentDetailSource
      ? getCompanyCreateAgentDetail(selectedCompanyCreateAgentDetailSource)
      : null;
    const formatCompanyCreateCost = (value: number) => {
      const convertedValue =
        companyCreatePricingUnit === 'USDT'
          ? value * COMPANY_CREATE_WLD_TO_USDT
          : value;

      return Number.isInteger(convertedValue) ? `${convertedValue}` : convertedValue.toFixed(1);
    };
    const pageTitle =
      companyDashboardView === 'home'
        ? '홈 대시보드'
        : companyDashboardView === 'jobs'
          ? '공고 목록'
          : companyDashboardView === 'fraud'
            ? '부정 알림'
          : companyDashboardView === 'create'
            ? '공고 생성'
            : '리포트';
    const activeCompanyNavView = companyDashboardView === 'report' ? 'jobs' : companyDashboardView;

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
          <header className="company-dashboard-topbar">
            <h1>{pageTitle}</h1>

            <div className="company-dashboard-topbar__actions">
              {companyDashboardView === 'home' || companyDashboardView === 'create' || companyDashboardView === 'fraud' ? (
                <span>Credit $10,000</span>
              ) : (
                <span className="company-dashboard-topbar__status">🔔 · 💰 WLD 2,480</span>
              )}
              <button type="button">충전</button>
            </div>
          </header>

          {companyDashboardView === 'home' ? (
            <>
              <section className="company-dashboard-summary" aria-label="요약 지표">
                {companyDashboardSummaryCards.map((card) => (
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
                      <h2>진행 중 세션</h2>
                      <p>평가 진행 상황과 부정행위 알림을 확인하세요</p>
                    </div>

                    <button
                      type="button"
                      className="company-dashboard-sessions__cta"
                      onClick={openCompanyCreate}
                    >
                      + 새로운 세션
                    </button>
                  </div>

                  <div className="company-dashboard-sessions__table" role="table" aria-label="진행 중 세션 목록">
                    <div className="company-dashboard-sessions__row company-dashboard-sessions__row--head" role="row">
                      <span role="columnheader">세션</span>
                      <span role="columnheader">유형</span>
                      <span role="columnheader">지원자</span>
                      <span role="columnheader">진척</span>
                      <span role="columnheader">부정</span>
                    </div>

                    {companyDashboardSessions.map((session) => (
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
                  </div>
                </article>

                <article className="company-dashboard-card company-dashboard-alerts">
                  <div className="company-dashboard-alerts__header">
                    <h2>부정행위 알림 (실시간)</h2>

                    <div className="company-dashboard-alerts__meta">
                      <span>6건 대기</span>
                      <button type="button" onClick={() => openCompanyFraud()}>
                        전체 보기
                      </button>
                    </div>
                  </div>

                  <div className="company-dashboard-alerts__list">
                    {companyDashboardAlerts.map((alert) => (
                      <article className="company-dashboard-alerts__item" key={alert}>
                        <span className="company-dashboard-alerts__icon" aria-hidden="true">
                          !
                        </span>
                        <p>{alert}</p>
                      </article>
                    ))}
                  </div>
                </article>
              </section>

              <section className="company-dashboard-card company-dashboard-chart">
                <div className="company-dashboard-chart__header">
                  <h2>WLD 소진 추이 (30d)</h2>
                  <p>일 평균 62 WLD · 가장 큰 비중 Reasoning 에이전트</p>
                </div>

                <div className="company-dashboard-chart__bars" aria-label="WLD 소진 추이 막대 차트">
                  {companyDashboardWldUsage.map((value, index) => (
                    <div className="company-dashboard-chart__bar-group" key={`${value}-${index}`}>
                      <span>{value}</span>
                      <div
                        className="company-dashboard-chart__bar"
                        style={{ height: `${Math.max(24, (value / wldUsageMax) * 82)}px` }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : companyDashboardView === 'jobs' ? (
            <>
              <section className="company-job-board-toolbar company-dashboard-card">
                <div className="company-job-board-toolbar__left">
                  <button type="button" className="company-job-board-toolbar__select">
                    유형 전체 ▾
                  </button>

                  <div className="company-job-board-toolbar__filters" aria-label="공고 상태 필터">
                    {companyJobStatusFilters.map((filter) => (
                      <button
                        key={filter.label}
                        type="button"
                        className={`company-job-board-toolbar__filter${filter.active ? ' company-job-board-toolbar__filter--active' : ''}`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="company-job-board-toolbar__right">
                  <label className="company-job-board-toolbar__search">
                    <span className="sr-only">세션명 검색</span>
                    <input type="text" placeholder="세션명 검색" />
                  </label>

                  <button
                    type="button"
                    className="company-job-board-toolbar__cta"
                    onClick={openCompanyCreate}
                  >
                    + 새로운 세션
                  </button>
                </div>
              </section>

              <section className="company-job-board-table company-dashboard-card">
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

                  {companyJobListings.map((job, index) => (
                    <div
                      className={`company-job-board-table__row${index % 2 === 1 ? ' company-job-board-table__row--striped' : ''}`}
                      role="row"
                      key={job.title}
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
                        onClick={() => {
                          setSelectedCompanyJob(job);
                          setCompanyDashboardView('report');
                        }}
                      >
                        리포트 보기 →
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : companyDashboardView === 'fraud' ? (
            <>
              <section className="company-fraud-hero">
                <div className="company-fraud-hero__icon" aria-hidden="true">
                  🛡
                </div>
                <div className="company-fraud-hero__copy">
                  <h2>실시간 감지 · 6건 미처리</h2>
                  <p>Integrity Monitor가 AI 대필·표절·행동 이상 패턴을 실시간으로 탐지합니다.</p>
                </div>
              </section>

              <section className="company-fraud-layout">
                <article className="company-fraud-board company-dashboard-card">
                  <div className="company-fraud-board__header">
                    <h2>감지 케이스</h2>

                    <div className="company-fraud-board__filters" aria-label="부정 알림 상태 필터">
                      {companyFraudFilterOptions.map((filter) => (
                        <button
                          key={filter.key}
                          type="button"
                          className={`company-fraud-board__filter${companyFraudFilter === filter.key ? ' company-fraud-board__filter--active' : ''}`}
                          onClick={() => {
                            setCompanyFraudFilter(filter.key);
                            setSelectedCompanyFraudCaseId(
                              companyFraudCases.find((item) => item.status === filter.key)?.id ?? companyFraudCases[0].id,
                            );
                          }}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="company-fraud-board__list">
                    {visibleCompanyFraudCases.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`company-fraud-case${selectedCompanyFraudCase.id === item.id ? ' company-fraud-case--active' : ''}`}
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
                    ))}
                  </div>
                </article>

                <aside className="company-fraud-detail company-dashboard-card">
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
                    <button type="button" className="company-fraud-detail__action company-fraud-detail__action--primary">
                      🚫 제출 무효 처리
                    </button>
                    <button type="button" className="company-fraud-detail__action">
                      기각 (오탐으로 판단)
                    </button>
                  </div>
                </aside>
              </section>
            </>
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
                    <span className="company-create-form__label">공고 유형</span>
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
                    <span className="company-create-form__label">공고명</span>
                    <input
                      type="text"
                      value={companyCreateForm.title}
                      placeholder="예: 백엔드 개발자 채용 2026 Q2"
                      onChange={handleCompanyCreateFormChange('title')}
                    />
                  </label>

                  <label className="company-create-form__field company-create-form__field--description">
                    <span className="company-create-form__label">짧은 설명</span>
                    <input
                      type="text"
                      value={companyCreateForm.description}
                      placeholder="지원자에게 보일 한 줄 요약"
                      onChange={handleCompanyCreateFormChange('description')}
                    />
                  </label>

                  <div className="company-create-form__row company-create-form__row--dates">
                    <label className="company-create-form__field">
                      <span className="company-create-form__label">시작일</span>
                      <input
                        type="text"
                        value={companyCreateForm.startDate}
                        placeholder="2026-05-01"
                        onChange={handleCompanyCreateFormChange('startDate')}
                      />
                    </label>

                    <label className="company-create-form__field">
                      <span className="company-create-form__label">마감일</span>
                      <input
                        type="text"
                        value={companyCreateForm.endDate}
                        placeholder="2026-05-15"
                        onChange={handleCompanyCreateFormChange('endDate')}
                      />
                    </label>
                  </div>

                  <div className="company-create-form__row company-create-form__row--capacity">
                    <label className="company-create-form__field company-create-form__field--capacity">
                      <span className="company-create-form__label">모집 인원</span>
                      <input
                        type="text"
                        value={companyCreateForm.capacity}
                        placeholder="최대 50명"
                        onChange={handleCompanyCreateFormChange('capacity')}
                      />
                    </label>

                    <div className="company-create-form__toggle-group" aria-label="공개 여부">
                      <button
                        type="button"
                        className={`company-create-form__toggle${companyCreateForm.accessMode === 'public' ? ' company-create-form__toggle--active' : ''}`}
                        onClick={() =>
                          setCompanyCreateForm((current) => ({
                            ...current,
                            accessMode: 'public',
                            visibilityScope: companyCreatePublicScopeOptions.includes(current.visibilityScope as (typeof companyCreatePublicScopeOptions)[number])
                              ? current.visibilityScope
                              : '초대 링크 전용',
                          }))
                        }
                      >
                        공개
                      </button>
                      <button
                        type="button"
                        className={`company-create-form__toggle${companyCreateForm.accessMode === 'private' ? ' company-create-form__toggle--active' : ''}`}
                        onClick={() =>
                          setCompanyCreateForm((current) => ({
                            ...current,
                            accessMode: 'private',
                            visibilityScope: '비공개',
                          }))
                        }
                      >
                        비공개
                      </button>
                    </div>
                  </div>

                  <label className="company-create-form__field company-create-form__field--scope">
                    <span className="company-create-form__label">공개 범위</span>
                    {companyCreateForm.accessMode === 'public' ? (
                      <div className="company-create-form__scope-options" role="listbox" aria-label="공개 범위 선택">
                        {companyCreatePublicScopeOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`company-create-form__scope-option${companyCreateForm.visibilityScope === option ? ' company-create-form__scope-option--active' : ''}`}
                            onClick={() =>
                              setCompanyCreateForm((current) => ({
                                ...current,
                                visibilityScope: option,
                              }))
                            }
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={companyCreateForm.visibilityScope}
                        onChange={handleCompanyCreateFormChange('visibilityScope')}
                      />
                    )}
                  </label>

                  <div className="company-create-form__actions">
                    <button type="button" className="company-create-form__secondary">
                      임시 저장
                    </button>
                    <button
                      type="button"
                      className="company-create-form__primary"
                      onClick={() => setCompanyCreateStep(2)}
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

                        <label className="company-create-process-card__field">
                          <span className="company-create-process-card__label">과정명</span>
                          <input
                            type="text"
                            placeholder="과정명을 입력하세요."
                            value={process.name}
                            onChange={handleCompanyCreateProcessChange(process.id, 'name')}
                          />
                        </label>

                        <label className="company-create-process-card__field company-create-process-card__field--description">
                          <span className="company-create-process-card__label">과정 내용</span>
                          <textarea
                            placeholder="과정 내용을 입력하세요."
                            value={process.content}
                            onChange={handleCompanyCreateProcessChange(process.id, 'content')}
                          />
                        </label>

                        <div className="company-create-process-card__submission">
                          <label className="company-create-process-card__field company-create-process-card__field--method">
                            <span className="company-create-process-card__label">제출 방식 선택</span>
                            <button
                              type="button"
                              className="company-create-process-card__method-trigger"
                              onClick={() =>
                                setOpenCompanyCreateProcessId((current) => (current === process.id ? null : process.id))
                              }
                            >
                              {process.submissionMethod || '제출 방식을 선택하세요.'}
                            </button>
                          </label>

                          {openCompanyCreateProcessId === process.id ? (
                            <div className="company-create-process-card__submission-panel">
                              <div className="company-create-process-card__submission-options" role="listbox" aria-label="제출 방식 목록">
                                {companyCreateSubmissionOptions.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    className={`company-create-process-card__submission-option${process.submissionMethod === option ? ' company-create-process-card__submission-option--active' : ''}`}
                                    onClick={() => handleCompanyCreateSubmissionSelect(process.id, option)}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
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
                      onClick={() => setCompanyCreateStep(3)}
                    >
                      다음: 에이전트 선택 →
                    </button>
                  </div>
                </section>
              ) : (
                <section className="company-create-layout">
                  <article className="company-create-agents company-dashboard-card">
                    <div className="company-create-form__header">
                      <h2>에이전트 선택 및 가중치</h2>
                      <p>보유 라이선스 중 이 세션에 투입할 에이전트를 선택합니다.</p>
                    </div>

                    <div className="company-create-agents__rows">
                      {companyCreateAgents.map((agent) => {
                        const sliderWidth = `${(agent.weight / companyCreateMaxWeight) * 100}%`;

                        return (
                          <article
                            key={agent.id}
                            className={`company-create-agent-row${agent.locked ? ' company-create-agent-row--locked' : ''}${!agent.selected && !agent.locked ? ' company-create-agent-row--inactive' : ''}`}
                          >
                            <button
                              type="button"
                              className={`company-create-agent-row__check${agent.selected ? ' company-create-agent-row__check--active' : ''}`}
                              aria-pressed={agent.selected}
                              onClick={() => handleCompanyCreateAgentToggle(agent.id)}
                              disabled={agent.locked}
                            >
                              {agent.selected ? '✓' : ''}
                            </button>

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

                            {agent.locked ? (
                              <button type="button" className="company-create-agent-row__renew">
                                라이선스 갱신
                              </button>
                            ) : (
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
                                <strong className="company-create-agent-row__weight">{`${agent.weight}%`}</strong>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>

                    <div className="company-create-agents__summary">
                      <div className="company-create-agents__summary-total">
                        <span>가중치 합계</span>
                        <strong>{`${companyCreateWeightTotal}%`}</strong>
                      </div>
                      <p>{`투입 에이전트 ${selectedCompanyCreateAgents.length} · 예상 세션 비용 ${formatCompanyCreateCost(companyCreateCostPerApplicantWld)} ${companyCreatePricingUnit}/인`}</p>
                      <span
                        className={`company-create-agents__summary-status${isCompanyCreateWeightBalanced ? '' : ' company-create-agents__summary-status--warning'}`}
                      >
                        {isCompanyCreateWeightBalanced ? '✓ 정상' : '조정 필요'}
                      </span>
                    </div>
                  </article>

                  <aside className="company-create-sidepanel">
                    <section className="company-create-sidecard company-dashboard-card">
                      <div className="company-create-sidecard__header">
                        <h3>지원 예상 인원</h3>
                        <p>초과 시, 크레딧이 추가로 부과되며 미달 시에는 크레딧으로 반환됩니다.</p>
                      </div>

                      <label className="company-create-sidecard__input">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="지원 예상 인원을 입력하세요"
                          value={companyCreateExpectedApplicants}
                          onChange={(event) =>
                            setCompanyCreateExpectedApplicants(event.target.value.replace(/[^0-9]/g, ''))
                          }
                        />
                        <span>명</span>
                      </label>
                    </section>

                    <section className="company-create-sidecard company-dashboard-card">
                      <div className="company-create-sidecard__header">
                        <h3>비용 계산</h3>
                        <p>모집 인원 × 에이전트 단가 기반</p>
                      </div>

                      <div className="company-create-cost-toggle" role="tablist" aria-label="비용 표시 단위">
                        {(['WLD', 'USDT'] as const).map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            className={`company-create-cost-toggle__button${companyCreatePricingUnit === unit ? ' company-create-cost-toggle__button--active' : ''}`}
                            onClick={() => setCompanyCreatePricingUnit(unit)}
                          >
                            {unit}
                          </button>
                        ))}
                      </div>

                      <div className="company-create-cost-list">
                        {selectedCompanyCreateAgents.map((agent) => (
                          <div className="company-create-cost-list__row" key={agent.id}>
                            <span>{agent.billingLabel}</span>
                            <span>{`${agent.weight}%`}</span>
                            <strong>{`${formatCompanyCreateCost((agent.weight / 100) * COMPANY_CREATE_COST_PER_APPLICANT_WLD)} ${companyCreatePricingUnit}`}</strong>
                          </div>
                        ))}
                      </div>

                      <div className="company-create-cost-total">
                        <span>세션 당 (인당)</span>
                        <strong>{`${formatCompanyCreateCost(companyCreateCostPerApplicantWld)} ${companyCreatePricingUnit}`}</strong>
                      </div>

                      <div className="company-create-cost-alert">
                        <strong>{`△ 보유 WLD ${COMPANY_CREATE_WLD_BALANCE.toLocaleString()}`}</strong>
                        <p>
                          {companyCreateRemainingWld >= 0
                            ? `세션 발행 시 ${Math.round(companyCreateRemainingWld).toLocaleString()} WLD가 남습니다. 추가 세션 대비 충전을 권장합니다.`
                            : `현재 설정 기준 ${Math.abs(Math.round(companyCreateRemainingWld)).toLocaleString()} WLD가 부족합니다. 에이전트 가중치 조정 또는 충전이 필요합니다.`}
                        </p>
                      </div>
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
                        onClick={() => {
                          setCompanyCreateStep(1);
                          setCompanyDashboardView('jobs');
                        }}
                      >
                        검토 및 발행 →
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

              <section className="company-report-summary company-dashboard-card">
                <span className="company-report-summary__badge">{`${selectedCompanyJob.type} · 평가 완료`}</span>
                <h2>{selectedCompanyJob.title}</h2>
                <p>42명 참여 · 평균 종합 76.4 · 중앙값 74.8 · 최고 89.4</p>
              </section>

              <section className="company-report-grid">
                <article className="company-report-card company-dashboard-card">
                  <div className="company-report-card__header">
                    <h3>점수 분포</h3>
                    <p>종합 점수 히스토그램 (구간 5pt)</p>
                  </div>

                  <div className="company-report-histogram" aria-label="점수 분포 히스토그램">
                    {companyReportHistogram.map((item) => (
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
                    {companyReportTopCandidates.map((candidate) => (
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
                    {companyReportAgentScores.map((agent) => (
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
                    {companyReportImprovements.map((item) => (
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
            </>
          )}
        </main>

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
                        <h4>함께 많이 구매하는 에이전트</h4>
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

                {companyCreateAgentDetailTab === 'reviews' ? (
                  <section className="company-agent-detail-modal__section">
                    <h4>리뷰</h4>
                    <div className="company-agent-detail-modal__stack">
                      {selectedCompanyCreateAgentDetail.reviews.map((review) => (
                        <article className="company-agent-detail-modal__info-card" key={review.title}>
                          <strong>{review.title}</strong>
                          <span className="company-agent-detail-modal__review-meta">{review.meta}</span>
                          <p>{review.body}</p>
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
