import { createHash, randomUUID } from 'node:crypto';
import { buildDefaultCompanyAgentCatalogItems } from './company-agent-catalog.js';
import {
  CompanyAgentEvaluationError,
  evaluateSubmissionWithCompanyAgent,
  getSupportedCompanyEvaluationAgentIds,
} from './company-agent-evaluator.js';
import { getCompanyCreditBootstrapConfig, getCompanyCreditProfileDefaults } from './company-credit.js';
import { pool } from './db.js';
import { sendCandidateMatchingEmail } from './mail.js';
import { normalizeSubmissionSourceSnapshot } from './submission-source-reader.js';

const { walletAddress: COMPANY_CREDIT_WALLET_ADDRESS, exchangeRate: COMPANY_CREDIT_EXCHANGE_RATE } =
  getCompanyCreditProfileDefaults();

const defaultVerificationForm = {
  country: 'KR',
  verificationType: 'company',
  companyBusinessCertificateFileName: '',
  companyCorporateSealCertificateFileName: '',
  companyOfficialLetterFileName: '',
  organizerBusinessCertificateFileName: '',
  organizerUsageSealCertificateFileName: '',
  organizerOfficialLetterFileName: '',
};

const defaultProcesses = [
  {
    id: 1,
    name: '서류 제출',
    content: '이력서, 포트폴리오, 자기소개서를 제출합니다.',
    submissionMethod: '링크 제출',
  },
  {
    id: 2,
    name: '과제 전형',
    content: '실무와 유사한 문제 해결 과제를 제한 시간 안에 수행합니다.',
    submissionMethod: '텍스트 직접 입력',
  },
];

const defaultEvaluationCriteria = {
  focus: '',
  strengths: '',
  risks: '',
};

const supportedEvaluationAgentIdSet = new Set(getSupportedCompanyEvaluationAgentIds());
const scoredMetricAgentIds = ['technical', 'reasoning', 'communication', 'creativity'];
const reportAgentDisplayLabels = {
  technical: 'Technical',
  reasoning: 'Reasoning',
  communication: 'Communication',
  creativity: 'Creativity',
  integrity: 'Integrity',
};
const blindMetricPrefixes = {
  technical: 'Tech',
  reasoning: 'Reason',
  communication: 'Comm',
  creativity: 'Creat',
};
const blindMetricLabelMatchers = [
  ['technical', /^tech/i],
  ['reasoning', /^reason/i],
  ['communication', /^comm/i],
  ['creativity', /^creat/i],
];

const defaultUsageSeries = [
  72, 49, 55, 56, 50, 40, 31, 50, 24, 27,
  32, 40, 52, 55, 83, 38, 32, 27, 24, 25,
  28, 67, 38, 42, 42, 38, 32, 28, 38,
];

const defaultCreditTransactions = [
  { occurredAt: '2026-04-26T00:00:00', amountLabel: '+$100' },
  { occurredAt: '2026-04-22T13:40:00', amountLabel: '+$14.7' },
  { occurredAt: '2026-04-18T09:15:00', amountLabel: '+$14.7' },
  { occurredAt: '2026-04-11T15:20:00', amountLabel: '+$14.7' },
  { occurredAt: '2026-04-08T18:45:00', amountLabel: '+$14.7' },
  { occurredAt: '2026-04-03T10:30:00', amountLabel: '+$14.7' },
  { occurredAt: '2026-03-29T14:12:00', amountLabel: '+$14.7' },
  { occurredAt: '2026-03-25T08:05:00', amountLabel: '+$14.7' },
];

const baseBlindCandidates = [
  {
    id: 'rank-1',
    anonymousId: 'wid_0x82f4…',
    overallScore: 89.4,
    humanVerified: true,
    metrics: [
      { label: 'Tech 35%', score: 92 },
      { label: 'Reason 25%', score: 88 },
      { label: 'Comm 25%', score: 85 },
      { label: 'Creat 10%', score: 82 },
    ],
    integrityScore: 96,
    selected: true,
  },
  {
    id: 'rank-2',
    anonymousId: 'wid_0x9e21…',
    overallScore: 87.2,
    humanVerified: true,
    metrics: [
      { label: 'Tech 35%', score: 90 },
      { label: 'Reason 25%', score: 85 },
      { label: 'Comm 25%', score: 86 },
      { label: 'Creat 10%', score: 78 },
    ],
    integrityScore: 94,
    selected: true,
  },
  {
    id: 'rank-3',
    anonymousId: 'wid_0x74a8…',
    overallScore: 85.8,
    humanVerified: true,
    metrics: [
      { label: 'Tech 35%', score: 88 },
      { label: 'Reason 25%', score: 84 },
      { label: 'Comm 25%', score: 82 },
      { label: 'Creat 10%', score: 84 },
    ],
    integrityScore: 98,
    selected: true,
  },
  {
    id: 'rank-4',
    anonymousId: 'wid_0x55c3…',
    overallScore: 84.1,
    humanVerified: true,
    metrics: [
      { label: 'Tech 35%', score: 86 },
      { label: 'Reason 25%', score: 82 },
      { label: 'Comm 25%', score: 80 },
      { label: 'Creat 10%', score: 80 },
    ],
    integrityScore: 92,
    selected: false,
  },
  {
    id: 'rank-5',
    anonymousId: 'wid_0x91bc…',
    overallScore: 82.7,
    humanVerified: true,
    metrics: [
      { label: 'Tech 35%', score: 88 },
      { label: 'Reason 25%', score: 78 },
      { label: 'Comm 25%', score: 82 },
      { label: 'Creat 10%', score: 76 },
    ],
    integrityScore: 94,
    selected: false,
  },
  {
    id: 'rank-6',
    anonymousId: 'wid_0x63de…',
    overallScore: 81.3,
    humanVerified: true,
    metrics: [
      { label: 'Tech 35%', score: 82 },
      { label: 'Reason 25%', score: 80 },
      { label: 'Comm 25%', score: 82 },
      { label: 'Creat 10%', score: 72 },
    ],
    integrityScore: 90,
    selected: false,
  },
  {
    id: 'rank-7',
    anonymousId: 'wid_0x47ff…',
    overallScore: 79.8,
    humanVerified: true,
    metrics: [
      { label: 'Tech 35%', score: 80 },
      { label: 'Reason 25%', score: 78 },
      { label: 'Comm 25%', score: 80 },
      { label: 'Creat 10%', score: 74 },
    ],
    integrityScore: 88,
    selected: false,
  },
  {
    id: 'rank-8',
    anonymousId: 'wid_0x18af…',
    overallScore: 78.5,
    humanVerified: true,
    metrics: [
      { label: 'Tech 35%', score: 82 },
      { label: 'Reason 25%', score: 76 },
      { label: 'Comm 25%', score: 78 },
      { label: 'Creat 10%', score: 72 },
    ],
    integrityScore: 86,
    selected: false,
  },
  {
    id: 'rank-9',
    anonymousId: 'wid_0x22cd…',
    overallScore: 77,
    humanVerified: false,
    metrics: [
      { label: 'Tech 35%', score: 78 },
      { label: 'Reason 25%', score: 74 },
      { label: 'Comm 25%', score: 80 },
      { label: 'Creat 10%', score: 70 },
    ],
    integrityScore: 84,
    selected: false,
  },
  {
    id: 'rank-10',
    anonymousId: 'wid_0x8ab1…',
    overallScore: 76.2,
    humanVerified: true,
    metrics: [
      { label: 'Tech 35%', score: 76 },
      { label: 'Reason 25%', score: 74 },
      { label: 'Comm 25%', score: 78 },
      { label: 'Creat 10%', score: 68 },
    ],
    integrityScore: 92,
    selected: false,
  },
  {
    id: 'rank-11',
    anonymousId: 'wid_0x39e0…',
    overallScore: 75.1,
    humanVerified: false,
    metrics: [
      { label: 'Tech 35%', score: 74 },
      { label: 'Reason 25%', score: 72 },
      { label: 'Comm 25%', score: 78 },
      { label: 'Creat 10%', score: 68 },
    ],
    integrityScore: 86,
    selected: false,
  },
  {
    id: 'rank-12',
    anonymousId: 'wid_0x4fa2…',
    overallScore: 74.3,
    humanVerified: true,
    metrics: [
      { label: 'Tech 35%', score: 72 },
      { label: 'Reason 25%', score: 72 },
      { label: 'Comm 25%', score: 76 },
      { label: 'Creat 10%', score: 68 },
    ],
    integrityScore: 84,
    selected: false,
  },
];

const defaultReportImprovements = [
  { label: '#테스트 전략 미흡', count: 26, tone: 'danger' },
  { label: '#장애 복구 경험', count: 22, tone: 'danger' },
  { label: '#Creativity 전반 저조', count: 18, tone: 'danger' },
  { label: '#Reasoning 구조화', count: 14, tone: 'dark' },
  { label: '#도메인 이해도 부족', count: 10, tone: 'dark' },
];

const demoJobs = [
  {
    id: 'job-backend-7291',
    title: '백엔드 개발자 채용 #7291',
    sessionType: 'recruiting',
    badge: '채용',
    startDate: '2026-05-01',
    endDate: '2026-05-15',
    applicantsCount: 42,
    status: 'open',
    progress: 82,
    fraudCount: null,
  },
  {
    id: 'job-ux-audition',
    title: 'UX 디자이너 오디션',
    sessionType: 'audition',
    badge: '오디션',
    startDate: '2026-04-28',
    endDate: '2026-05-12',
    applicantsCount: 28,
    status: 'open',
    progress: 56,
    fraudCount: 2,
  },
  {
    id: 'job-ai-6104',
    title: 'AI 엔지니어 #6104',
    sessionType: 'recruiting',
    badge: '채용',
    startDate: '2026-04-20',
    endDate: '2026-05-04',
    applicantsCount: 36,
    status: 'closing',
    progress: 100,
    fraudCount: 1,
  },
  {
    id: 'job-public-data',
    title: '공공데이터 공모전',
    sessionType: 'contest',
    badge: '공모전',
    startDate: '2026-05-01',
    endDate: '2026-05-30',
    applicantsCount: 88,
    status: 'open',
    progress: 22,
    fraudCount: null,
  },
  {
    id: 'job-content-planner',
    title: '콘텐츠 기획자',
    sessionType: 'recruiting',
    badge: '채용',
    startDate: '2026-04-10',
    endDate: '2026-04-24',
    applicantsCount: 18,
    status: 'closed',
    progress: 68,
    fraudCount: null,
  },
  {
    id: 'job-frontend-2y',
    title: '프론트 2년차',
    sessionType: 'recruiting',
    badge: '채용',
    startDate: '2026-04-01',
    endDate: '2026-04-22',
    applicantsCount: 22,
    status: 'open',
    progress: 90,
    fraudCount: 3,
  },
  {
    id: 'job-hackathon-vol3',
    title: '해커톤 오디션 Vol.3',
    sessionType: 'audition',
    badge: '오디션',
    startDate: '2026-05-10',
    endDate: '2026-05-20',
    applicantsCount: 0,
    status: 'draft',
    progress: 0,
    fraudCount: null,
  },
  {
    id: 'job-junior-planner',
    title: '신입 기획자 공채',
    sessionType: 'recruiting',
    badge: '채용',
    startDate: '2026-04-05',
    endDate: '2026-04-19',
    applicantsCount: 64,
    status: 'closed',
    progress: 100,
    fraudCount: 1,
  },
  {
    id: 'job-ux-researcher',
    title: 'UX 리서처 신입',
    sessionType: 'recruiting',
    badge: '채용',
    startDate: '2026-05-01',
    endDate: '2026-05-14',
    applicantsCount: 12,
    status: 'open',
    progress: 18,
    fraudCount: null,
  },
  {
    id: 'job-server-4102',
    title: '서버 개발자 #4102',
    sessionType: 'recruiting',
    badge: '채용',
    startDate: '2026-03-28',
    endDate: '2026-04-11',
    applicantsCount: 24,
    status: 'closed',
    progress: 100,
    fraudCount: 2,
  },
  {
    id: 'job-platform-engineer',
    title: '플랫폼 엔지니어',
    sessionType: 'recruiting',
    badge: '채용',
    startDate: '2026-04-15',
    endDate: '2026-05-01',
    applicantsCount: 9,
    status: 'open',
    progress: 44,
    fraudCount: null,
  },
  {
    id: 'job-design-contest',
    title: '디자인 공모전',
    sessionType: 'contest',
    badge: '공모전',
    startDate: '2026-05-01',
    endDate: '2026-06-01',
    applicantsCount: 0,
    status: 'draft',
    progress: 0,
    fraudCount: null,
  },
];

const demoFraudCases = [
  {
    id: 'fraud-ux-55bc',
    jobId: 'job-ux-audition',
    title: 'UX 오디션 · wid_0x55bc…',
    detailId: 'wid_0x55bc…',
    issue: 'AI 대필 의심',
    severity: 'high',
    confidence: 92,
    timestamp: '2026-04-20T13:58:00',
    status: 'pending',
    evidenceTitle: '증거 — 스크린샷',
    evidences: ['브라우저 포커스 이탈 감지 (3:41)', '동일 답변 벡터 유사도 98%'],
    behaviorLogs: ['13:52 질문 수신', '13:53 새 탭 열림', '13:56 답변 붙여넣기', '13:58 Q&A 응답 전송'],
  },
  {
    id: 'fraud-frontend-4fa2',
    jobId: 'job-frontend-2y',
    title: '프론트 2년차 · wid_0x4fa2…',
    detailId: 'wid_0x4fa2…',
    issue: '포커스 이탈 반복',
    severity: 'medium',
    confidence: 68,
    timestamp: '2026-04-20T13:48:00',
    status: 'pending',
    evidenceTitle: '증거 — 행동 캡처',
    evidences: ['포커스 이탈 이벤트 5회', '탭 전환 간격이 비정상적으로 짧음'],
    behaviorLogs: ['13:41 답변 작성 시작', '13:43 새 창 전환', '13:45 포커스 복귀', '13:48 제출 전 장시간 이탈'],
  },
  {
    id: 'fraud-backend-18af',
    jobId: 'job-backend-7291',
    title: '백엔드 #7291 · wid_0x18af…',
    detailId: 'wid_0x18af…',
    issue: '타자 패턴 이상',
    severity: 'medium',
    confidence: 62,
    timestamp: '2026-04-20T13:42:00',
    status: 'pending',
    evidenceTitle: '증거 — 입력 로그',
    evidences: ['평균 타자 간격 편차 급증', '붙여넣기 직후 응답 속도 급변'],
    behaviorLogs: ['13:34 질문 열람', '13:37 입력 패턴 불안정 감지', '13:40 대량 텍스트 붙여넣기'],
  },
  {
    id: 'fraud-ai-91bc',
    jobId: 'job-ai-6104',
    title: 'AI 엔지니어 · wid_0x91bc…',
    detailId: 'wid_0x91bc…',
    issue: '표절 감지',
    severity: 'high',
    confidence: 88,
    timestamp: '2026-04-20T13:28:00',
    status: 'pending',
    evidenceTitle: '증거 — 유사도 리포트',
    evidences: ['외부 공개 글과 문장 유사도 94%', '핵심 단락 순서가 원문과 동일'],
    behaviorLogs: ['13:21 과제 진입', '13:24 외부 문서 열람 추정', '13:28 제출'],
  },
  {
    id: 'fraud-frontend-88fa',
    jobId: 'job-frontend-2y',
    title: '프론트 2년차 · wid_0x88fa…',
    detailId: 'wid_0x88fa…',
    issue: '제출물 중복',
    severity: 'low',
    confidence: 41,
    timestamp: '2026-04-20T13:12:00',
    status: 'pending',
    evidenceTitle: '증거 — 중복 제출 비교',
    evidences: ['기존 제출물과 구조 유사', '핵심 문장만 일부 교체됨'],
    behaviorLogs: ['13:02 작성 시작', '13:08 유사 응답 탐지', '13:12 제출'],
  },
  {
    id: 'fraud-server-22cd',
    jobId: 'job-server-4102',
    title: '서버 개발자 · wid_0x22cd…',
    detailId: 'wid_0x22cd…',
    issue: '응답 일관성 저하',
    severity: 'low',
    confidence: 38,
    timestamp: '2026-04-20T12:58:00',
    status: 'pending',
    evidenceTitle: '증거 — 세션 비교',
    evidences: ['이전 답변 대비 문체 급변', '질문 난이도 대비 설명 수준 편차 큼'],
    behaviorLogs: ['12:46 세션 시작', '12:53 답변 톤 급변', '12:58 응답 전송'],
  },
  {
    id: 'fraud-ml-71ab',
    jobId: 'job-public-data',
    title: 'ML 과제 · wid_0x71ab…',
    detailId: 'wid_0x71ab…',
    issue: '브라우저 매크로 감지',
    severity: 'medium',
    confidence: 71,
    timestamp: '2026-04-20T11:44:00',
    status: 'investigating',
    evidenceTitle: '증거 — 세션 자동화 흔적',
    evidences: ['입력 간격이 기계적으로 반복됨', '마우스 이동 없이 인터랙션 진행'],
    behaviorLogs: ['11:32 세션 시작', '11:38 반복 입력 패턴 감지', '11:44 조사 큐 이동'],
  },
  {
    id: 'fraud-pm-28fe',
    jobId: 'job-public-data',
    title: 'PM 챌린지 · wid_0x28fe…',
    detailId: 'wid_0x28fe…',
    issue: '비정상 네트워크 이동',
    severity: 'high',
    confidence: 83,
    timestamp: '2026-04-20T11:18:00',
    status: 'investigating',
    evidenceTitle: '증거 — 네트워크 로그',
    evidences: ['짧은 시간 내 국가 코드가 2회 변경', 'VPN 전환 직후 제출'],
    behaviorLogs: ['11:07 과제 진입', '11:12 IP 변경 감지', '11:18 조사중으로 전환'],
  },
  {
    id: 'fraud-qa-62ce',
    jobId: 'job-content-planner',
    title: 'QA 포지션 · wid_0x62ce…',
    detailId: 'wid_0x62ce…',
    issue: '응답 일관성 저하',
    severity: 'low',
    confidence: 29,
    timestamp: '2026-04-19T17:11:00',
    status: 'resolved',
    evidenceTitle: '증거 — 조사 완료 메모',
    evidences: ['면접관 수동 검토 완료', '부정 가능성 낮음으로 분류'],
    behaviorLogs: ['17:05 검토 시작', '17:09 운영자 확인', '17:11 처리 완료'],
  },
  {
    id: 'fraud-brand-7df1',
    jobId: 'job-design-contest',
    title: '브랜딩 공모전 · wid_0x7df1…',
    detailId: 'wid_0x7df1…',
    issue: '중복 제출',
    severity: 'low',
    confidence: 33,
    timestamp: '2026-04-19T16:08:00',
    status: 'dismissed',
    evidenceTitle: '증거 — 기각 메모',
    evidences: ['동일 제출로 보였으나 팀 공동 작업물로 확인', '오탐으로 최종 판정'],
    behaviorLogs: ['15:56 알림 생성', '16:03 확인 요청', '16:08 기각 처리'],
  },
];

const sessionTypeLabels = {
  recruiting: '채용',
  contest: '공모전',
  audition: '오디션',
  education: '교육',
};

const jobStatusLabels = {
  draft: '대기',
  open: '진행',
  closing: '마감 임박',
  closed: '종료',
};

const jobStatusTones = {
  draft: 'soft',
  open: 'dark',
  closing: 'danger',
  closed: 'muted',
};

const blindStatusByJobStatus = {
  draft: 'closing',
  open: 'open',
  closing: 'closing',
  closed: 'closing',
};

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJsonField(value, fallback) {
  if (value == null) {
    return cloneValue(fallback);
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return cloneValue(fallback);
    }
  }

  return value;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value, min, max, fallback = min) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function clampInteger(value, min, max, fallback = min) {
  return Math.round(clampNumber(value, min, max, fallback));
}

function toCompactText(value, limit = 240) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '';
  }

  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function toTextList(values, itemLimit = 160, listLimit = 5) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => toCompactText(value, itemLimit))
    .filter(Boolean)
    .slice(0, listLimit);
}

function normalizeImprovementTag(value) {
  const trimmed = toCompactText(value, 48).replace(/^#+/, '').trim();
  return trimmed ? `#${trimmed}` : '';
}

function getBlindMetricLabel(agentId, weight) {
  const prefix = blindMetricPrefixes[agentId] ?? 'Metric';
  const normalizedWeight = clampInteger(weight, 0, 100, 0);

  return normalizedWeight > 0 ? `${prefix} ${normalizedWeight}%` : prefix;
}

function getReportAgentLabel(agentId) {
  return reportAgentDisplayLabels[agentId] ?? agentId;
}

function normalizeMetricAgentId(metric) {
  const directAgentId = String(metric?.agentId ?? '').trim();

  if (scoredMetricAgentIds.includes(directAgentId)) {
    return directAgentId;
  }

  const metricLabel = String(metric?.label ?? '').trim().toLowerCase();

  for (const [agentId, pattern] of blindMetricLabelMatchers) {
    if (pattern.test(metricLabel)) {
      return agentId;
    }
  }

  return '';
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatPeriod(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.getMonth() + 1}/${start.getDate()}-${end.getMonth() + 1}/${end.getDate()}`;
}

function formatApplicants(count) {
  return `${count.toLocaleString('en-US')}명`;
}

function formatTimestamp(dateValue) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getLocalDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function normalizeDateKey(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return getLocalDateKey(value);
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(value).slice(0, 10);
  }

  return getLocalDateKey(parsed);
}

function deriveJobStatus(startDate, endDate) {
  const todayKey = getLocalDateKey();
  const startKey = normalizeDateKey(startDate);
  const endKey = normalizeDateKey(endDate);

  if (startKey && startKey > todayKey) {
    return 'draft';
  }

  if (endKey && endKey < todayKey) {
    return 'closed';
  }

  if (!endKey) {
    return 'open';
  }

  const today = new Date(`${todayKey}T00:00:00`);
  const deadline = new Date(`${endKey}T00:00:00`);
  const daysUntilDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return daysUntilDeadline <= 2 ? 'closing' : 'open';
}

function applyDerivedJobStatus(job) {
  if (!job) {
    return job;
  }

  return {
    ...job,
    status: deriveJobStatus(job.start_date ?? job.startDate, job.end_date ?? job.endDate),
  };
}

function buildReportHistogram(candidates) {
  const bins = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
  const counts = bins.map((start) =>
    candidates.filter((candidate) => candidate.overallScore >= start && candidate.overallScore < start + 5).length,
  );
  const maxCount = Math.max(...counts, 1);

  return bins.map((start, index) => ({
    label: String(start),
    height: 22 + Math.round((counts[index] / maxCount) * 116),
  }));
}

function buildEmptyReportPayload() {
  return {
    participantCount: 0,
    averageScore: 0,
    medianScore: 0,
    bestScore: 0,
    histogram: [],
    topCandidates: [],
    agentScores: [],
    improvements: [],
  };
}

function buildReportTopCandidates(candidates) {
  return [...candidates]
    .sort((leftCandidate, rightCandidate) => rightCandidate.overallScore - leftCandidate.overallScore)
    .slice(0, 5)
    .map((candidate, index) => ({
      rank: index + 1,
      id: candidate.anonymousId,
      score: Number(candidate.overallScore.toFixed(1)),
    }));
}

function buildReportAgentScores(candidates) {
  const metricValues = new Map(scoredMetricAgentIds.map((agentId) => [agentId, []]));

  candidates.forEach((candidate) => {
    (Array.isArray(candidate.metrics) ? candidate.metrics : []).forEach((metric) => {
      const agentId = normalizeMetricAgentId(metric);

      if (!metricValues.has(agentId)) {
        return;
      }

      const score = clampInteger(metric?.score, 0, 100, 0);

      if (score > 0) {
        metricValues.get(agentId).push(score);
      }
    });
  });

  const scores = scoredMetricAgentIds
    .map((agentId) => {
      const values = metricValues.get(agentId) ?? [];

      if (values.length === 0) {
        return null;
      }

      const score = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
      const bandStart = Math.max(0, score - 14);
      const bandWidth = Math.min(36, Math.max(12, 100 - bandStart - Math.max(0, 100 - (score + 10))));

      return {
        label: getReportAgentLabel(agentId),
        score,
        bandStart,
        bandWidth,
      };
    })
    .filter(Boolean);

  const integrityScore = Math.round(
    candidates.reduce((sum, candidate) => sum + candidate.integrityScore, 0) / Math.max(candidates.length, 1),
  );

  scores.push({
    label: 'Integrity',
    score: integrityScore,
    bandStart: Math.max(0, integrityScore - 6),
    bandWidth: 12,
  });

  return scores;
}

function buildReportImprovements(candidates) {
  const counts = new Map();

  candidates.forEach((candidate) => {
    const tags = Array.isArray(candidate.improvementTags) ? candidate.improvementTags : [];

    tags.forEach((tag) => {
      const normalizedTag = normalizeImprovementTag(tag);

      if (!normalizedTag) {
        return;
      }

      counts.set(normalizedTag, (counts.get(normalizedTag) ?? 0) + 1);
    });
  });

  if (counts.size === 0) {
    return cloneValue(defaultReportImprovements);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], 'ko');
    })
    .slice(0, 5)
    .map(([label, count], index) => ({
      label,
      count,
      tone: index < 3 ? 'danger' : 'dark',
    }));
}

function buildReportPayload(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return buildEmptyReportPayload();
  }

  const overallScores = candidates.map((candidate) => candidate.overallScore);
  const sortedScores = [...overallScores].sort((left, right) => left - right);
  const averageScore =
    overallScores.reduce((sum, score) => sum + score, 0) / Math.max(overallScores.length, 1);
  const middleIndex = Math.floor(sortedScores.length / 2);
  const medianScore =
    sortedScores.length % 2 === 0
      ? (sortedScores[middleIndex - 1] + sortedScores[middleIndex]) / 2
      : sortedScores[middleIndex] ?? 0;

  return {
    participantCount: candidates.length,
    averageScore: Number(averageScore.toFixed(1)),
    medianScore: Number(medianScore.toFixed(1)),
    bestScore: Number(Math.max(...overallScores, 0).toFixed(1)),
    histogram: buildReportHistogram(candidates),
    topCandidates: buildReportTopCandidates(candidates),
    agentScores: buildReportAgentScores(candidates),
    improvements: buildReportImprovements(candidates),
  };
}

function buildSeedBlindCandidates() {
  return cloneValue(baseBlindCandidates);
}

function buildCompanyScopedSeedJobs(companyUserId) {
  return demoJobs.map((job) => ({
    ...job,
    id: `company-${companyUserId}-${job.id}`,
  }));
}

function buildCompanyScopedSeedFraudCases(companyUserId) {
  return demoFraudCases.map((item) => ({
    ...item,
    id: `company-${companyUserId}-${item.id}`,
    jobId: `company-${companyUserId}-${item.jobId}`,
  }));
}

function buildJobCreatePayload(job) {
  const blindCandidates = buildSeedBlindCandidates();
  return {
    ...job,
    description: `${job.badge} 세션 요약`,
    detailedDescription: `${job.title} 세션을 위한 기본 설명입니다.`,
    capacity: Math.max(12, Math.ceil(job.applicantsCount / 2) || 20),
    capacityDisplay: job.applicantsCount > 0 ? 'exact' : 'masked',
    visibilityScope: '공개',
    eligibleAge: 'all',
    eligibleCountries: [],
    expectedApplicants: Math.max(20, job.applicantsCount || 50),
    processes: cloneValue(defaultProcesses),
    agents: buildDefaultCompanyAgentCatalogItems(),
    evaluationCriteria: cloneValue(defaultEvaluationCriteria),
    blindCandidates,
    report: buildReportPayload(blindCandidates),
  };
}

function buildAgentCatalogItem(row) {
  return {
    id: row.id,
    icon: row.icon,
    name: row.name,
    billingLabel: row.billing_label,
    description: row.description,
    selected: toNumber(row.default_selected) === 1,
    weight: Math.max(0, Math.min(100, toNumber(row.default_weight, 0))),
    locked: toNumber(row.locked) === 1,
  };
}

function buildAgentCatalog(rows) {
  return rows.map(buildAgentCatalogItem);
}

function normalizeProcessSubmissionMethodLabel(method) {
  const normalized = String(method ?? '').trim();
  const lowered = normalized.toLowerCase();

  if (!normalized || normalized === '제출 없음') {
    return '';
  }

  if (normalized.includes('링크')) {
    return '링크 제출';
  }

  if (
    lowered.includes('pdf') ||
    lowered.startsWith('.')
  ) {
    return 'PDF';
  }

  if (normalized.includes('텍스트')) {
    return '텍스트 직접 입력';
  }

  return normalized;
}

function sanitizeProcesses(processes) {
  return (Array.isArray(processes) ? processes : [])
    .map((process, index) => ({
      id: toNumber(process.id, index + 1),
      name: String(process.name ?? '').trim(),
      content: String(process.content ?? '').trim(),
      submissionMethod: normalizeProcessSubmissionMethodLabel(process.submissionMethod),
    }))
    .filter(
      (process) => process.name && process.content && process.submissionMethod,
    );
}

function sanitizeEvaluationCriteria(evaluationCriteria) {
  if (!evaluationCriteria || typeof evaluationCriteria !== 'object') {
    return cloneValue(defaultEvaluationCriteria);
  }

  return {
    focus: String(evaluationCriteria.focus ?? '').trim(),
    strengths: String(evaluationCriteria.strengths ?? '').trim(),
    risks: String(evaluationCriteria.risks ?? '').trim(),
  };
}

function sanitizeAgents(agents, agentCatalog) {
  const submittedAgentMap = new Map(
    (Array.isArray(agents) ? agents : [])
      .map((agent) => [
        String(agent.id ?? '').trim(),
        {
          selected: agent.selected === true,
          weight: Math.max(0, Math.min(100, toNumber(agent.weight, 0))),
        },
      ])
      .filter(([id]) => id),
  );

  return agentCatalog
    .map((agent) => {
      const submittedAgent = submittedAgentMap.get(agent.id);

      return {
        id: agent.id,
        icon: agent.icon,
        name: agent.name,
        billingLabel: agent.billingLabel,
        description: agent.description,
        selected: submittedAgent ? submittedAgent.selected : agent.selected,
        weight: submittedAgent ? submittedAgent.weight : agent.weight,
        locked: agent.locked === true,
      };
    })
    .filter((agent) => agent.id && agent.name);
}

function buildJobRowPayload(input, agentCatalog) {
  const blindCandidates = [];

  return {
    title: input.form.title.trim(),
    sessionType: input.sessionType,
    badge: sessionTypeLabels[input.sessionType] ?? '채용',
    startDate: input.form.startDate,
    endDate: input.form.endDate,
    applicantsCount: 0,
    status: deriveJobStatus(input.form.startDate, input.form.endDate),
    progress: 0,
    fraudCount: null,
    description: input.form.description.trim(),
    detailedDescription: input.form.detailedDescription.trim(),
    capacity: toNumber(input.form.capacity, 0),
    capacityDisplay: input.form.capacityDisplay,
    visibilityScope: input.form.visibilityScope,
    eligibleAge: input.form.eligibleAge,
    eligibleCountries: Array.isArray(input.form.eligibleCountries)
      ? input.form.eligibleCountries.map((country) => String(country))
      : [],
    expectedApplicants: toNumber(input.expectedApplicants, 0),
    processes: sanitizeProcesses(input.processes),
    agents: sanitizeAgents(input.agents, agentCatalog),
    evaluationCriteria: sanitizeEvaluationCriteria(input.evaluationCriteria),
    blindCandidates,
    report: buildEmptyReportPayload(),
  };
}

function sanitizeSkillList(skills) {
  return (Array.isArray(skills) ? skills : [])
    .map((skill) => toCompactText(skill, 40))
    .filter(Boolean)
    .slice(0, 20);
}

function sanitizeSubmissionResponses(responses) {
  return (Array.isArray(responses) ? responses : [])
    .map((response) => ({
      question: String(response?.question ?? '').trim(),
      answer: String(response?.answer ?? '').trim(),
    }))
    .filter((response) => response.question && response.answer)
    .slice(0, 10);
}

function sanitizeSubmissionSources(sources) {
  return (Array.isArray(sources) ? sources : [])
    .map((source, index) => normalizeSubmissionSourceSnapshot(source, index))
    .filter(Boolean)
    .slice(0, 8);
}

function sanitizeEvaluationSubmission(input, index) {
  if (!input || typeof input !== 'object') {
    throw new Error(`${index + 1}번째 제출 데이터 형식이 올바르지 않습니다.`);
  }

  const candidate = input.candidate && typeof input.candidate === 'object' ? input.candidate : {};
  const profile = input.profile && typeof input.profile === 'object' ? input.profile : {};
  const challenge = input.challenge && typeof input.challenge === 'object' ? input.challenge : {};
  const integritySignals =
    input.integritySignals && typeof input.integritySignals === 'object' ? input.integritySignals : {};
  const responses = sanitizeSubmissionResponses(input.responses);
  const sources = sanitizeSubmissionSources(input.sources);

  const normalizedSubmission = {
    candidate: {
      anonymousId:
        toCompactText(candidate.anonymousId, 80) ||
        `wid_${randomUUID().replace(/-/g, '').slice(0, 8)}…`,
      label: toCompactText(candidate.label, 120),
      desiredRole: toCompactText(candidate.desiredRole, 80),
      yearsOfExperience:
        candidate.yearsOfExperience == null
          ? null
          : clampNumber(candidate.yearsOfExperience, 0, 50, 0),
      humanVerified: candidate.humanVerified === true,
    },
    profile: {
      resumeText: String(profile.resumeText ?? '').trim(),
      portfolioText: String(profile.portfolioText ?? '').trim(),
      workHistorySummary: String(profile.workHistorySummary ?? '').trim(),
      educationSummary: String(profile.educationSummary ?? '').trim(),
      skills: sanitizeSkillList(profile.skills),
    },
    challenge: {
      prompt: String(challenge.prompt ?? '').trim(),
      answerText: String(challenge.answerText ?? '').trim(),
      codeText: String(challenge.codeText ?? '').trim(),
      language: toCompactText(challenge.language, 40),
    },
    responses,
    sources,
    integritySignals: {
      focusLossCount: clampInteger(integritySignals.focusLossCount, 0, 10_000, 0),
      tabSwitchCount: clampInteger(integritySignals.tabSwitchCount, 0, 10_000, 0),
      pasteCount: clampInteger(integritySignals.pasteCount, 0, 10_000, 0),
      plagiarismSimilarityPercent: clampInteger(
        integritySignals.plagiarismSimilarityPercent,
        0,
        100,
        0,
      ),
      styleShiftPercent: clampInteger(integritySignals.styleShiftPercent, 0, 100, 0),
      timeTakenSeconds: clampInteger(integritySignals.timeTakenSeconds, 0, 604_800, 0),
      aiGeneratedProbabilityPercent: clampInteger(
        integritySignals.aiGeneratedProbabilityPercent,
        0,
        100,
        0,
      ),
      note: toCompactText(integritySignals.note, 240),
    },
  };

  const evidenceFields = [
    normalizedSubmission.profile.resumeText,
    normalizedSubmission.profile.portfolioText,
    normalizedSubmission.profile.workHistorySummary,
    normalizedSubmission.profile.educationSummary,
    normalizedSubmission.challenge.prompt,
    normalizedSubmission.challenge.answerText,
    normalizedSubmission.challenge.codeText,
    ...normalizedSubmission.responses.flatMap((response) => [response.question, response.answer]),
    ...normalizedSubmission.sources.map((source) => source.text),
  ].filter((value) => value.length > 0);

  if (evidenceFields.length === 0) {
    throw new Error(`${index + 1}번째 제출에는 평가할 텍스트 데이터가 없습니다.`);
  }

  return normalizedSubmission;
}

function buildEvaluationJobContext(job) {
  return {
    id: job.id,
    title: job.title,
    sessionType: job.session_type,
    description: job.description,
    detailedDescription: job.detailed_description,
    expectedApplicants: toNumber(job.expected_applicants, 0),
    processes: parseJsonField(job.processes_payload, []),
    evaluationCriteria: sanitizeEvaluationCriteria(
      parseJsonField(job.evaluation_criteria_payload, defaultEvaluationCriteria),
    ),
    agents: sanitizeAgents(parseJsonField(job.agents_payload, []), buildDefaultCompanyAgentCatalogItems()),
  };
}

function getSupportedSelectedAgents(jobContext) {
  const selectedAgents = jobContext.agents.filter((agent) => agent.selected === true);
  const supportedAgents = selectedAgents.filter((agent) => supportedEvaluationAgentIdSet.has(agent.id));

  if (supportedAgents.length === 0) {
    throw new Error('실제 평가가 가능한 기본 에이전트가 선택되어 있지 않습니다.');
  }

  return supportedAgents;
}

function computeHeuristicIntegrityScore(submission) {
  const { integritySignals } = submission;
  let score = submission.candidate.humanVerified ? 94 : 84;

  score -= Math.min(18, integritySignals.focusLossCount * 2);
  score -= Math.min(15, integritySignals.tabSwitchCount);
  score -= Math.min(12, integritySignals.pasteCount * 2);
  score -= Math.round(integritySignals.plagiarismSimilarityPercent * 0.35);
  score -= Math.round(integritySignals.styleShiftPercent * 0.18);
  score -= Math.round(integritySignals.aiGeneratedProbabilityPercent * 0.2);

  return clampInteger(score, 0, 100, submission.candidate.humanVerified ? 94 : 84);
}

function computeOverallScore(selectedAgents, agentResults, integrityScore) {
  const weightedAgents = selectedAgents.filter((agent) => agentResults[agent.id]);

  if (weightedAgents.length === 0) {
    return 0;
  }

  const weightedTotal = weightedAgents.reduce((sum, agent) => {
    const score = agent.id === 'integrity' ? integrityScore : clampInteger(agentResults[agent.id].score, 0, 100, 0);
    return sum + score * Math.max(agent.weight, 0);
  }, 0);
  const weightSum = weightedAgents.reduce((sum, agent) => sum + Math.max(agent.weight, 0), 0);
  let overallScore = weightSum > 0 ? weightedTotal / weightSum : 0;

  if (integrityScore < 75) {
    overallScore -= (75 - integrityScore) * 0.18;
  }

  if (integrityScore < 55) {
    overallScore -= 4;
  }

  return Number(clampNumber(overallScore, 0, 100, 0).toFixed(1));
}

function buildCandidateImprovementTags(agentResults) {
  return Object.values(agentResults)
    .flatMap((result) => result.improvementTags ?? [])
    .map(normalizeImprovementTag)
    .filter(Boolean)
    .filter((tag, index, array) => array.indexOf(tag) === index)
    .slice(0, 6);
}

function buildCandidateSummary(agentResults) {
  const summaries = Object.entries(agentResults)
    .map(([agentId, result]) => ({
      agentId,
      score: clampInteger(result.score, 0, 100, 0),
      summary: result.summary,
    }))
    .filter((item) => item.summary);

  if (summaries.length === 0) {
    return '';
  }

  const strongest = [...summaries].sort((left, right) => right.score - left.score)[0];
  const weakest = [...summaries].sort((left, right) => left.score - right.score)[0];

  if (!strongest || !weakest) {
    return summaries[0]?.summary ?? '';
  }

  if (strongest.agentId === weakest.agentId) {
    return strongest.summary;
  }

  return `${getReportAgentLabel(strongest.agentId)} 강점: ${strongest.summary} ${getReportAgentLabel(weakest.agentId)} 보완: ${weakest.summary}`;
}

function buildBlindCandidateFromEvaluationRow(row) {
  const evaluation = parseJsonField(row.evaluation_payload, {});

  return {
    id: row.id,
    anonymousId: row.anonymous_id,
    overallScore: Number(toNumber(row.overall_score, 0).toFixed(1)),
    humanVerified: toNumber(row.human_verified) === 1,
    metrics: Array.isArray(evaluation.metrics)
      ? evaluation.metrics.map((metric) => ({
          agentId: normalizeMetricAgentId(metric),
          label: String(metric.label ?? '').trim(),
          score: clampInteger(metric.score, 0, 100, 0),
        }))
      : [],
    integrityScore: clampInteger(row.integrity_score, 0, 100, 0),
    selected: toNumber(row.selected) === 1,
    summary: String(evaluation.summary ?? '').trim(),
    strengths: toTextList(evaluation.strengths, 160, 5),
    risks: toTextList(evaluation.risks, 160, 5),
    improvementTags: toTextList(evaluation.improvementTags, 48, 6).map(normalizeImprovementTag).filter(Boolean),
    agentBreakdown: evaluation.agentBreakdown && typeof evaluation.agentBreakdown === 'object'
      ? evaluation.agentBreakdown
      : {},
  };
}

function countEvaluationFraudCandidates(candidates) {
  return candidates.filter((candidate) => candidate.integrityScore < 65).length;
}

function buildProgressFromEvaluations(job, candidates) {
  const expectedApplicants = Math.max(0, toNumber(job.expected_applicants, 0));

  if (expectedApplicants <= 0) {
    return candidates.length > 0 ? 100 : 0;
  }

  return clampInteger((candidates.length / expectedApplicants) * 100, 0, 100, 0);
}

async function syncJobEvaluationSnapshot(companyUserId, job) {
  const evaluationRows = await getJobEvaluationRows(companyUserId, job.id);
  const candidates = evaluationRows.map(buildBlindCandidateFromEvaluationRow);
  const report = buildReportPayload(candidates);
  const fraudCount = countEvaluationFraudCandidates(candidates);
  const applicantsCount = candidates.length;
  const progress = buildProgressFromEvaluations(job, candidates);

  await pool.execute(
    `
      UPDATE company_jobs
      SET applicants_count = ?,
          progress = ?,
          fraud_count = ?,
          blind_candidates_payload = ?,
          report_payload = ?
      WHERE company_user_id = ?
        AND id = ?
    `,
    [
      applicantsCount,
      progress,
      fraudCount > 0 ? fraudCount : null,
      JSON.stringify(candidates),
      JSON.stringify(report),
      companyUserId,
      job.id,
    ],
  );

  return { candidates, report, fraudCount, applicantsCount, progress };
}

async function evaluateJobSubmission(jobContext, submission, selectedAgents) {
  const agentResults = Object.fromEntries(
    await Promise.all(
      selectedAgents.map(async (agent) => [
        agent.id,
        await evaluateSubmissionWithCompanyAgent({
          agentId: agent.id,
          jobContext,
          submission,
        }),
      ]),
    ),
  );

  const heuristicIntegrityScore = computeHeuristicIntegrityScore(submission);
  const modelIntegrityScore = agentResults.integrity
    ? clampInteger(agentResults.integrity.score, 0, 100, heuristicIntegrityScore)
    : heuristicIntegrityScore;
  const integrityScore = clampInteger(
    agentResults.integrity
      ? modelIntegrityScore * 0.7 + heuristicIntegrityScore * 0.3
      : heuristicIntegrityScore,
    0,
    100,
    heuristicIntegrityScore,
  );

  const metrics = selectedAgents
    .filter((agent) => scoredMetricAgentIds.includes(agent.id) && agentResults[agent.id])
    .map((agent) => ({
      agentId: agent.id,
      label: getBlindMetricLabel(agent.id, agent.weight),
      score: clampInteger(agentResults[agent.id].score, 0, 100, 0),
    }));

  const strengths = Object.values(agentResults)
    .flatMap((result) => result.strengths ?? [])
    .map((item) => toCompactText(item, 160))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 5);
  const risks = Object.values(agentResults)
    .flatMap((result) => result.risks ?? [])
    .map((item) => toCompactText(item, 160))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, 5);
  const overallScore = computeOverallScore(selectedAgents, agentResults, integrityScore);

  return {
    submission,
    evaluationPayload: {
      metrics,
      integrityScore,
      summary: buildCandidateSummary(agentResults),
      strengths,
      risks,
      improvementTags: buildCandidateImprovementTags(agentResults),
      agentBreakdown: agentResults,
      heuristicIntegrityScore,
    },
    overallScore,
    integrityScore,
  };
}

function buildJobListing(job) {
  return {
    id: job.id,
    title: job.title,
    type: job.badge,
    period: formatPeriod(job.start_date, job.end_date),
    applicants: formatApplicants(toNumber(job.applicants_count)),
    status: jobStatusLabels[job.status] ?? job.status,
    statusTone: jobStatusTones[job.status] ?? 'dark',
    fraudCount: job.fraud_count == null ? null : toNumber(job.fraud_count),
  };
}

function buildDashboardSession(job) {
  return {
    id: job.id,
    name: job.title,
    type: job.badge,
    applicants: formatApplicants(toNumber(job.applicants_count)),
    progress: Math.max(0, Math.min(100, toNumber(job.progress))),
    fraudCount: job.fraud_count == null ? null : toNumber(job.fraud_count),
  };
}

function buildBlindCard(job) {
  const agents = parseJsonField(job.agents_payload, []);
  const integrityAgent = Array.isArray(agents)
    ? agents.find((agent) => String(agent?.id ?? '').trim() === 'integrity')
    : null;
  const integrityWeightLabel =
    integrityAgent && integrityAgent.selected === true
      ? `Integrity ${Math.max(0, Math.min(100, toNumber(integrityAgent.weight, 0)))}%`
      : 'Integrity 0%';

  return {
    id: job.id,
    type: job.session_type,
    status: blindStatusByJobStatus[job.status] ?? 'open',
    badge: job.badge,
    title: job.title,
    integrityWeightLabel,
  };
}

function buildCandidateEvaluationAnonymousId(candidateUserId, jobId) {
  const digest = createHash('sha256')
    .update(`${jobId}:${candidateUserId}`)
    .digest('hex')
    .slice(0, 10);

  return `wid_${digest}…`;
}

function buildJobReportResponse(job, report) {
  return {
    job: buildJobListing(job),
    summary: {
      badge: `${job.badge} · 평가 완료`,
      title: job.title,
      description:
        report.participantCount > 0
          ? `${report.participantCount}명 참여 · 평균 종합 ${report.averageScore} · 중앙값 ${report.medianScore} · 최고 ${report.bestScore}`
          : '아직 평가 데이터가 없습니다.',
    },
    histogram: report.histogram,
    topCandidates: report.topCandidates,
    agentScores: report.agentScores,
    improvements: report.improvements,
  };
}

function buildFraudCase(caseRow) {
  return {
    id: caseRow.id,
    title: caseRow.title,
    detailId: caseRow.detail_id,
    issue: caseRow.issue,
    severity: caseRow.severity,
    confidence: toNumber(caseRow.confidence),
    timestamp: formatMonthDayTime(caseRow.occurred_at),
    status: caseRow.status,
    evidenceTitle: caseRow.evidence_title,
    evidences: parseJsonField(caseRow.evidences_payload, []),
    behaviorLogs: parseJsonField(caseRow.behavior_logs_payload, []),
  };
}

function formatMonthDayTime(dateValue) {
  const date = new Date(dateValue);
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildFraudFilters(cases) {
  const counts = {
    pending: 0,
    investigating: 0,
    resolved: 0,
    dismissed: 0,
  };

  cases.forEach((item) => {
    if (Object.prototype.hasOwnProperty.call(counts, item.status)) {
      counts[item.status] += 1;
    }
  });

  return [
    { key: 'pending', label: `대기 ${counts.pending}` },
    { key: 'investigating', label: `조사중 ${counts.investigating}` },
    { key: 'resolved', label: `처리됨 ${counts.resolved}` },
    { key: 'dismissed', label: `기각 ${counts.dismissed}` },
  ];
}

function buildJobStatusFilters(jobs) {
  const counts = {
    all: jobs.length,
    draft: jobs.filter((job) => job.status === 'draft').length,
    open: jobs.filter((job) => job.status === 'open' || job.status === 'closing').length,
    closed: jobs.filter((job) => job.status === 'closed').length,
  };

  return [
    { label: `전체 ${counts.all}`, active: true },
    { label: `대기 ${counts.draft}` },
    { label: `진행 ${counts.open}` },
    { label: `종료 ${counts.closed}` },
  ];
}

async function getProfileRow(companyUserId) {
  const [rows] = await pool.execute(
    `
      SELECT company_user_id, contact, language, verification_payload, credit_balance_usd,
             credit_monthly_usage_usd, wallet_address, credit_exchange_rate, usage_series
      FROM company_portal_profiles
      WHERE company_user_id = ?
      LIMIT 1
    `,
    [companyUserId],
  );

  return rows[0] ?? null;
}

async function getCompanyJobs(companyUserId) {
  const [rows] = await pool.execute(
    `
      SELECT id, company_user_id, title, session_type, badge, status, applicants_count, progress,
             fraud_count, start_date, end_date, description, detailed_description, capacity,
             capacity_display, visibility_scope, eligible_age, eligible_countries, expected_applicants,
             processes_payload, agents_payload, evaluation_criteria_payload, blind_candidates_payload, report_payload,
             created_at, updated_at
      FROM company_jobs
      WHERE company_user_id = ?
      ORDER BY start_date DESC, created_at DESC
    `,
    [companyUserId],
  );

  return rows.map(applyDerivedJobStatus);
}

async function getAgentCatalogRows() {
  const [rows] = await pool.execute(
    `
      SELECT id, icon, name, billing_label, description, default_selected, default_weight, locked, sort_order
      FROM company_agent_catalog
      ORDER BY sort_order ASC, id ASC
    `,
  );

  return rows;
}

async function getCompanyFraudRows(companyUserId) {
  const [rows] = await pool.execute(
    `
      SELECT id, company_user_id, job_id, title, detail_id, issue, severity, confidence, status,
             evidence_title, evidences_payload, behavior_logs_payload, occurred_at, created_at, updated_at
      FROM company_fraud_cases
      WHERE company_user_id = ?
      ORDER BY occurred_at DESC, created_at DESC
    `,
    [companyUserId],
  );

  return rows;
}

async function getCreditTransactions(companyUserId) {
  const [rows] = await pool.execute(
    `
      SELECT occurred_at, amount_label
      FROM company_credit_transactions
      WHERE company_user_id = ?
      ORDER BY occurred_at DESC, id DESC
    `,
    [companyUserId],
  );

  return rows;
}

async function getJobRow(companyUserId, jobId) {
  const [rows] = await pool.execute(
    `
      SELECT id, company_user_id, title, session_type, badge, status, applicants_count, progress,
             fraud_count, start_date, end_date, description, detailed_description, capacity,
             capacity_display, visibility_scope, eligible_age, eligible_countries, expected_applicants,
             processes_payload, agents_payload, evaluation_criteria_payload, blind_candidates_payload, report_payload,
             created_at, updated_at
      FROM company_jobs
      WHERE company_user_id = ?
        AND id = ?
      LIMIT 1
    `,
    [companyUserId, jobId],
  );

  return applyDerivedJobStatus(rows[0] ?? null);
}

async function getJobEvaluationRows(companyUserId, jobId) {
  const [rows] = await pool.execute(
    `
      SELECT id, company_user_id, job_id, anonymous_id, candidate_label, human_verified, selected,
             overall_score, integrity_score, submission_payload, evaluation_payload, created_at, updated_at
      FROM company_job_evaluations
      WHERE company_user_id = ?
        AND job_id = ?
      ORDER BY overall_score DESC, created_at ASC
    `,
    [companyUserId, jobId],
  );

  return rows;
}

async function getCandidateProfilesForJob(jobId) {
  const [rows] = await pool.execute(
    `
      SELECT cja.candidate_user_id, cu.full_name, cu.email,
             cpp.birth_date, cpp.phone, cpp.education_summary, cpp.current_affiliation, cpp.years_experience,
             cpp.employment_type, cpp.resume_file_name, cpp.cover_letter_file_name, cpp.share_defaults_payload
      FROM candidate_job_applications cja
      INNER JOIN candidate_users cu ON cu.id = cja.candidate_user_id
      LEFT JOIN candidate_portal_profiles cpp ON cpp.candidate_user_id = cja.candidate_user_id
      WHERE cja.job_id = ?
        AND cja.status = 'submitted'
    `,
    [jobId],
  );

  return rows;
}

function normalizeCompanyMatchRequestFields(input) {
  const allowedFields = [
    'name',
    'birthDate',
    'email',
    'phone',
    'education',
    'affiliation',
    'careerYears',
    'employmentType',
    'resume',
    'coverLetter',
  ];
  const requestFields = Array.isArray(input?.requestFields) ? input.requestFields : [];
  const seenKeys = new Set();
  const normalizedFields = requestFields
    .map((field) => ({
      key: String(field?.key ?? '').trim(),
      required: field?.required === true,
    }))
    .filter((field) => field.key && allowedFields.includes(field.key))
    .filter((field) => {
      if (seenKeys.has(field.key)) {
        return false;
      }

      seenKeys.add(field.key);
      return true;
    });

  if (normalizedFields.length === 0) {
    throw new Error('알림으로 요청할 정보를 한 개 이상 선택해주세요.');
  }

  return normalizedFields;
}

function buildCandidateMatchInfoFields(candidateProfile, requestFields) {
  const shareDefaults = parseJsonField(candidateProfile?.share_defaults_payload, {});
  const yearsExperience = Math.max(0, toNumber(candidateProfile?.years_experience, 0));
  const employmentType = String(candidateProfile?.employment_type ?? '').trim();
  const currentAffiliation = String(candidateProfile?.current_affiliation ?? '').trim();
  const fieldSourceMap = new Map(
    [
    {
      key: 'name',
      label: '이름',
      value: String(candidateProfile?.full_name ?? '').trim(),
      shared: shareDefaults.name === true,
    },
    {
      key: 'birthDate',
      label: '생년월일',
      value: String(candidateProfile?.birth_date ?? '').trim(),
      shared: false,
    },
    {
      key: 'email',
      label: '이메일',
      value: String(candidateProfile?.email ?? '').trim(),
      shared: shareDefaults.email === true,
    },
    {
      key: 'phone',
      label: '연락처',
      value: String(candidateProfile?.phone ?? '').trim(),
      shared: shareDefaults.phone === true,
    },
    {
      key: 'education',
      label: '최종 학력',
      value: String(candidateProfile?.education_summary ?? '').trim(),
      shared: shareDefaults.education === true,
    },
    {
      key: 'affiliation',
      label: '현재 소속',
      value: currentAffiliation,
      shared: shareDefaults.career === true,
    },
    {
      key: 'careerYears',
      label: '경력 연수',
      value: yearsExperience > 0 ? `${yearsExperience}년` : '',
      shared: shareDefaults.career === true,
    },
    {
      key: 'employmentType',
      label: '원하는 고용 형태',
      value: employmentType,
      shared: shareDefaults.career === true,
    },
    {
      key: 'resume',
      label: '이력서 PDF',
      value: String(candidateProfile?.resume_file_name ?? '').trim(),
      shared: shareDefaults.resume === true,
    },
    {
      key: 'coverLetter',
      label: '자기소개서',
      value: String(candidateProfile?.cover_letter_file_name ?? '').trim(),
      shared: shareDefaults.resume === true,
    },
    ].map((field) => [field.key, field]),
  );

  return requestFields
    .map((requestField) => {
      const sourceField = fieldSourceMap.get(requestField.key);

      if (!sourceField || !sourceField.value) {
        return null;
      }

      return {
        ...sourceField,
        required: requestField.required,
        shared: requestField.required ? true : sourceField.shared,
      };
    })
    .filter(Boolean);
}

function getSummaryCards(jobs, profile) {
  const activeJobs = jobs.filter((job) => job.status === 'open' || job.status === 'closing');
  const totalApplicants = jobs.reduce((sum, job) => sum + toNumber(job.applicants_count), 0);
  const monthlyUsageUsd = toNumber(profile?.credit_monthly_usage_usd, 0);
  const creditBalanceUsd = toNumber(profile?.credit_balance_usd, 0);
  const averagePerJob = jobs.length > 0 ? Math.round(monthlyUsageUsd / jobs.length) : 0;

  return [
    {
      label: '활성 공고',
      value: String(activeJobs.length),
      detail: `총 ${jobs.length}개 공고 중 진행 중`,
    },
    {
      label: '총 지원자',
      value: String(totalApplicants),
      detail: `${jobs.length}개 공고 기준`,
    },
    {
      label: '크레딧 소진',
      value: `$${monthlyUsageUsd.toLocaleString('en-US')}`,
      detail: `평균 공고당 $${averagePerJob.toLocaleString('en-US')}`,
    },
    {
      label: '크레딧',
      value: `$${creditBalanceUsd.toLocaleString('en-US')}`,
      detail: '',
    },
  ];
}

function getAlertMessages(cases) {
  return cases
    .filter((item) => item.status === 'pending')
    .slice(0, 3)
    .map((item) => `${item.title} — ${item.issue}`);
}

function getLegacySeedJobIdSet(companyUserId) {
  return new Set(buildCompanyScopedSeedJobs(companyUserId).map((job) => job.id));
}

function getLegacySeedFraudCaseIdSet(companyUserId) {
  return new Set(buildCompanyScopedSeedFraudCases(companyUserId).map((item) => item.id));
}

function getDefaultCreditTransactionKey(item) {
  return `${formatTimestamp(new Date(item.occurredAt))}|${item.amountLabel}`;
}

function filterLegacyCreditTransactions(rows) {
  const defaultKeys = new Set(defaultCreditTransactions.map(getDefaultCreditTransactionKey));
  return rows.filter(
    (row) => !defaultKeys.has(`${formatTimestamp(row.occurred_at)}|${row.amount_label}`),
  );
}

function isLegacySeedProfile(profile) {
  if (!profile) {
    return false;
  }

  const usageSeries = parseJsonField(profile.usage_series, []);

  return (
    profile.contact === '010-1234-5678' &&
    profile.language === '한국어' &&
    JSON.stringify(parseJsonField(profile.verification_payload, {})) === JSON.stringify(defaultVerificationForm) &&
    toNumber(profile.credit_balance_usd, 0) === 10000 &&
    toNumber(profile.credit_monthly_usage_usd, 0) === 1000 &&
    (profile.wallet_address ?? '') === COMPANY_CREDIT_WALLET_ADDRESS &&
    Number(profile.credit_exchange_rate ?? 0) === COMPANY_CREDIT_EXCHANGE_RATE &&
    JSON.stringify(usageSeries) === JSON.stringify(defaultUsageSeries)
  );
}

export async function ensureCompanyPortalSeed(companyUser) {
  const companyUserId = toNumber(companyUser.id);
  const creditDefaults = getCompanyCreditProfileDefaults();

  const profile = await getProfileRow(companyUserId);

  if (!profile) {
    await pool.execute(
      `
        INSERT INTO company_portal_profiles (
          company_user_id,
          contact,
          language,
          verification_payload,
          credit_balance_usd,
          credit_monthly_usage_usd,
          wallet_address,
          credit_exchange_rate,
          usage_series
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        companyUserId,
        '',
        '',
        JSON.stringify(defaultVerificationForm),
        0,
        0,
        creditDefaults.walletAddress,
        creditDefaults.exchangeRate,
        JSON.stringify([]),
      ],
    );
    return;
  }

  if (
    (creditDefaults.walletAddress && profile.wallet_address !== creditDefaults.walletAddress) ||
    Number(profile.credit_exchange_rate ?? 0) !== creditDefaults.exchangeRate
  ) {
    await pool.execute(
      `
        UPDATE company_portal_profiles
        SET wallet_address = ?,
            credit_exchange_rate = ?
        WHERE company_user_id = ?
      `,
      [creditDefaults.walletAddress, creditDefaults.exchangeRate, companyUserId],
    );
  }
}

export async function getCompanyPortalBootstrap(companyUser) {
  await ensureCompanyPortalSeed(companyUser);
  const creditBootstrapConfig = getCompanyCreditBootstrapConfig();

  const companyUserId = toNumber(companyUser.id);
  const [profile, rawJobs, rawFraudRows, rawCreditRows, rawAgentCatalogRows] = await Promise.all([
    getProfileRow(companyUserId),
    getCompanyJobs(companyUserId),
    getCompanyFraudRows(companyUserId),
    getCreditTransactions(companyUserId),
    getAgentCatalogRows(),
  ]);

  const legacyJobIds = getLegacySeedJobIdSet(companyUserId);
  const legacyFraudCaseIds = getLegacySeedFraudCaseIdSet(companyUserId);
  const jobs = rawJobs.filter((job) => !legacyJobIds.has(job.id));
  const fraudRows = rawFraudRows.filter((item) => !legacyFraudCaseIds.has(item.id));
  const creditRows = filterLegacyCreditTransactions(rawCreditRows);
  const agentCatalog = buildAgentCatalog(rawAgentCatalogRows);
  const normalizedProfile =
    jobs.length === 0 &&
    fraudRows.length === 0 &&
    creditRows.length === 0 &&
    isLegacySeedProfile(profile)
      ? null
      : profile;
  const fraudCases = fraudRows.map(buildFraudCase);
  const pendingFraudCount = fraudCases.filter((item) => item.status === 'pending').length;

  return {
    dashboard: {
      summaryCards: getSummaryCards(jobs, normalizedProfile),
      sessions: jobs
        .filter((job) => job.status !== 'closed')
        .slice(0, 6)
        .map(buildDashboardSession),
      alerts: getAlertMessages(fraudCases),
      wldUsage: parseJsonField(normalizedProfile?.usage_series, []),
      pendingFraudCount,
    },
    jobs: {
      statusFilters: buildJobStatusFilters(jobs),
      items: jobs.map(buildJobListing),
    },
    blind: {
      cards: jobs
        .filter((job) => job.status !== 'closed')
        .map(buildBlindCard),
    },
    fraud: {
      filters: buildFraudFilters(fraudCases),
      cases: fraudCases,
    },
    credit: {
      balanceUsd: toNumber(normalizedProfile?.credit_balance_usd, 0),
      monthlyUsageUsd: toNumber(normalizedProfile?.credit_monthly_usage_usd, 0),
      walletAddress: normalizedProfile?.wallet_address ?? '',
      exchangeRate: Number(normalizedProfile?.credit_exchange_rate ?? 0),
      miniAppPaymentsEnabled: creditBootstrapConfig.miniAppPaymentsEnabled,
      webDepositEnabled: creditBootstrapConfig.webDepositEnabled,
      minRechargeUsd: creditBootstrapConfig.minRechargeUsd,
      maxRechargeUsd: creditBootstrapConfig.maxRechargeUsd,
      miniAppPaymentOptions: creditBootstrapConfig.miniAppPaymentOptions,
      webDepositOptions: creditBootstrapConfig.webDepositOptions,
      history: creditRows.map((row) => ({
        timestamp: formatTimestamp(row.occurred_at),
        amount: row.amount_label,
      })),
    },
    agentCatalog,
    settings: {
      companyName: companyUser.companyName,
      companyEmail: companyUser.companyEmail,
      contact: normalizedProfile?.contact ?? '',
      language: normalizedProfile?.language ?? '',
      verificationForm: parseJsonField(normalizedProfile?.verification_payload, defaultVerificationForm),
    },
  };
}

export async function updateCompanySettings(companyUser, input) {
  await ensureCompanyPortalSeed(companyUser);

  const companyUserId = toNumber(companyUser.id);
  const companyName = String(input.companyName ?? '').trim();
  const contact = String(input.contact ?? '').trim();
  const language = String(input.language ?? '').trim();
  const verificationForm =
    input.verificationForm && typeof input.verificationForm === 'object'
      ? { ...defaultVerificationForm, ...input.verificationForm }
      : cloneValue(defaultVerificationForm);

  if (!companyName) {
    throw new Error('회사명을 입력해주세요.');
  }

  if (!contact) {
    throw new Error('연락처를 입력해주세요.');
  }

  if (!language) {
    throw new Error('언어를 선택해주세요.');
  }

  await pool.execute(
    `
      UPDATE company_users
      SET company_name = ?
      WHERE id = ?
    `,
    [companyName, companyUserId],
  );

  await pool.execute(
    `
      UPDATE company_portal_profiles
      SET contact = ?,
          language = ?,
          verification_payload = ?
      WHERE company_user_id = ?
    `,
    [contact, language, JSON.stringify(verificationForm), companyUserId],
  );

  return {
    companyUser: {
      ...companyUser,
      companyName,
    },
    settings: {
      companyName,
      companyEmail: companyUser.companyEmail,
      contact,
      language,
      verificationForm,
    },
  };
}

export async function createCompanyJob(companyUser, input) {
  await ensureCompanyPortalSeed(companyUser);

  const companyUserId = toNumber(companyUser.id);

  if (!input || typeof input !== 'object') {
    throw new Error('공고 생성 요청 형식이 올바르지 않습니다.');
  }

  const sessionType = String(input.sessionType ?? '').trim();
  const form = input.form && typeof input.form === 'object' ? input.form : null;

  if (!sessionType || !sessionTypeLabels[sessionType]) {
    throw new Error('공고 유형을 선택해주세요.');
  }

  if (!form) {
    throw new Error('공고 기본 정보를 입력해주세요.');
  }

  const requiredFields = [
    ['title', '공고명을 입력해주세요.'],
    ['description', '짧은 설명을 입력해주세요.'],
    ['detailedDescription', '자세한 설명을 입력해주세요.'],
    ['startDate', '시작일을 입력해주세요.'],
    ['endDate', '마감일을 입력해주세요.'],
    ['capacity', '모집 인원을 입력해주세요.'],
  ];

  for (const [field, message] of requiredFields) {
    if (!String(form[field] ?? '').trim()) {
      throw new Error(message);
    }
  }

  const agentCatalog = buildAgentCatalog(await getAgentCatalogRows());
  const payload = buildJobRowPayload({
    sessionType,
    form,
    processes: input.processes,
    agents: input.agents,
    expectedApplicants: input.expectedApplicants,
  }, agentCatalog);

  if (payload.processes.length === 0) {
    throw new Error('최소 1개 이상의 과정을 입력해주세요.');
  }

  if (payload.agents.filter((agent) => agent.selected).length === 0) {
    throw new Error('최소 1개 이상의 에이전트를 선택해주세요.');
  }

  const jobId = `job-${randomUUID()}`;

  await pool.execute(
    `
      INSERT INTO company_jobs (
        id, company_user_id, title, session_type, badge, status, applicants_count, progress, fraud_count,
        start_date, end_date, description, detailed_description, capacity, capacity_display,
        visibility_scope, eligible_age, eligible_countries, expected_applicants,
        processes_payload, agents_payload, evaluation_criteria_payload, blind_candidates_payload, report_payload
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      jobId,
      companyUserId,
      payload.title,
      payload.sessionType,
      payload.badge,
      payload.status,
      payload.applicantsCount,
      payload.progress,
      payload.fraudCount,
      payload.startDate,
      payload.endDate,
      payload.description,
      payload.detailedDescription,
      payload.capacity,
      payload.capacityDisplay,
      payload.visibilityScope,
      payload.eligibleAge,
      JSON.stringify(payload.eligibleCountries),
      payload.expectedApplicants,
      JSON.stringify(payload.processes),
      JSON.stringify(payload.agents),
      JSON.stringify(payload.evaluationCriteria),
      JSON.stringify(payload.blindCandidates),
      JSON.stringify(payload.report),
    ],
  );

  return {
    job: buildJobListing({
      id: jobId,
      title: payload.title,
      badge: payload.badge,
      status: payload.status,
      applicants_count: 0,
      fraud_count: null,
      start_date: payload.startDate,
      end_date: payload.endDate,
    }),
    blindCard: buildBlindCard({
      id: jobId,
      title: payload.title,
      session_type: payload.sessionType,
      status: payload.status,
      badge: payload.badge,
    }),
  };
}

export async function evaluateCompanyJobSubmissions(companyUser, jobId, input) {
  await ensureCompanyPortalSeed(companyUser);

  const companyUserId = toNumber(companyUser.id);
  const job = await getJobRow(companyUserId, jobId);

  if (!job) {
    return null;
  }

  if (!input || typeof input !== 'object') {
    throw new Error('평가 요청 형식이 올바르지 않습니다.');
  }

  const submissions = Array.isArray(input.submissions) ? input.submissions : [];
  const replaceExisting = input.replaceExisting === true;

  if (submissions.length === 0) {
    throw new Error('최소 1개 이상의 제출 데이터를 보내주세요.');
  }

  if (submissions.length > 20) {
    throw new Error('한 번에 평가할 수 있는 제출 수는 최대 20개입니다.');
  }

  const sanitizedSubmissions = submissions.map(sanitizeEvaluationSubmission);
  const anonymousIdSet = new Set();

  sanitizedSubmissions.forEach((submission) => {
    if (anonymousIdSet.has(submission.candidate.anonymousId)) {
      throw new Error(`중복된 익명 지원자 ID가 있습니다: ${submission.candidate.anonymousId}`);
    }

    anonymousIdSet.add(submission.candidate.anonymousId);
  });

  if (!replaceExisting) {
    const existingEvaluationRows = await getJobEvaluationRows(companyUserId, job.id);
    const existingAnonymousIdSet = new Set(existingEvaluationRows.map((row) => row.anonymous_id));

    sanitizedSubmissions.forEach((submission) => {
      if (existingAnonymousIdSet.has(submission.candidate.anonymousId)) {
        throw new Error(
          `이미 평가된 익명 지원자 ID입니다: ${submission.candidate.anonymousId}. replaceExisting=true 로 전체 재평가하거나 ID를 바꿔주세요.`,
        );
      }
    });
  }

  const jobContext = buildEvaluationJobContext(job);
  const selectedAgents = getSupportedSelectedAgents(jobContext);

  let evaluationResults;

  try {
    evaluationResults = [];

    for (const submission of sanitizedSubmissions) {
      evaluationResults.push(await evaluateJobSubmission(jobContext, submission, selectedAgents));
    }
  } catch (error) {
    if (error instanceof CompanyAgentEvaluationError) {
      throw error;
    }

    throw error;
  }

  if (replaceExisting) {
    await pool.execute(
      `
        DELETE FROM company_job_evaluations
        WHERE company_user_id = ?
          AND job_id = ?
      `,
      [companyUserId, job.id],
    );
  }

  for (const result of evaluationResults) {
    const evaluationId = `eval-${randomUUID()}`;

    await pool.execute(
      `
        INSERT INTO company_job_evaluations (
          id, company_user_id, job_id, anonymous_id, candidate_label, human_verified, selected,
          overall_score, integrity_score, submission_payload, evaluation_payload
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        evaluationId,
        companyUserId,
        job.id,
        result.submission.candidate.anonymousId,
        result.submission.candidate.label || null,
        result.submission.candidate.humanVerified ? 1 : 0,
        0,
        result.overallScore,
        result.integrityScore,
        JSON.stringify(result.submission),
        JSON.stringify(result.evaluationPayload),
      ],
    );
  }

  const snapshot = await syncJobEvaluationSnapshot(companyUserId, job);
  const refreshedJob = (await getJobRow(companyUserId, job.id)) ?? job;

  return {
    evaluatedCount: evaluationResults.length,
    candidates: snapshot.candidates,
    report: buildJobReportResponse(refreshedJob, snapshot.report),
    summary: {
      applicantsCount: snapshot.applicantsCount,
      fraudCount: snapshot.fraudCount,
      progress: snapshot.progress,
    },
  };
}

export async function evaluateCandidateSubmissionForCompanyJob(companyUserId, jobId, submissionInput) {
  await ensureCompanyPortalSeed({ id: companyUserId });

  const normalizedCompanyUserId = toNumber(companyUserId);
  const job = await getJobRow(normalizedCompanyUserId, jobId);

  if (!job) {
    throw new Error('평가할 공고를 찾을 수 없습니다.');
  }

  const submission = sanitizeEvaluationSubmission(submissionInput, 0);
  const jobContext = buildEvaluationJobContext(job);
  const selectedAgents = getSupportedSelectedAgents(jobContext);
  const result = await evaluateJobSubmission(jobContext, submission, selectedAgents);

  await pool.execute(
    `
      DELETE FROM company_job_evaluations
      WHERE company_user_id = ?
        AND job_id = ?
        AND anonymous_id = ?
    `,
    [normalizedCompanyUserId, job.id, submission.candidate.anonymousId],
  );

  await pool.execute(
    `
      INSERT INTO company_job_evaluations (
        id, company_user_id, job_id, anonymous_id, candidate_label, human_verified, selected,
        overall_score, integrity_score, submission_payload, evaluation_payload
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      `eval-${randomUUID()}`,
      normalizedCompanyUserId,
      job.id,
      submission.candidate.anonymousId,
      submission.candidate.label || null,
      submission.candidate.humanVerified ? 1 : 0,
      0,
      result.overallScore,
      result.integrityScore,
      JSON.stringify(result.submission),
      JSON.stringify(result.evaluationPayload),
    ],
  );

  const snapshot = await syncJobEvaluationSnapshot(normalizedCompanyUserId, job);
  const refreshedJob = (await getJobRow(normalizedCompanyUserId, job.id)) ?? job;

  return {
    candidates: snapshot.candidates,
    report: buildJobReportResponse(refreshedJob, snapshot.report),
    summary: {
      applicantsCount: snapshot.applicantsCount,
      fraudCount: snapshot.fraudCount,
      progress: snapshot.progress,
    },
    overallScore: result.overallScore,
    integrityScore: result.integrityScore,
  };
}

export async function getCompanyJobReport(companyUser, jobId) {
  await ensureCompanyPortalSeed(companyUser);

  const job = await getJobRow(toNumber(companyUser.id), jobId);

  if (!job) {
    return null;
  }

  const report = parseJsonField(job.report_payload, buildEmptyReportPayload());
  return buildJobReportResponse(job, report);
}

export async function getCompanyBlindRanking(companyUser, jobId) {
  await ensureCompanyPortalSeed(companyUser);

  const job = await getJobRow(toNumber(companyUser.id), jobId);

  if (!job) {
    return null;
  }

  const candidates = parseJsonField(job.blind_candidates_payload, []);

  return {
    blindCard: buildBlindCard(job),
    candidates,
    summary: {
      description:
        candidates.length > 0
          ? `${candidates.length}명 평가 완료 · 상위 N명 선발 후 매칭 동의 알림 발송`
          : '아직 블라인드 랭킹 데이터가 없습니다.',
    },
  };
}

export async function updateCompanyBlindCandidateSelection(companyUser, jobId, candidateId, selected) {
  await ensureCompanyPortalSeed(companyUser);

  const companyUserId = toNumber(companyUser.id);
  const job = await getJobRow(companyUserId, jobId);

  if (!job) {
    return null;
  }

  const existingEvaluationRows = await getJobEvaluationRows(companyUserId, jobId);

  if (existingEvaluationRows.length > 0) {
    const [result] = await pool.execute(
      `
        UPDATE company_job_evaluations
        SET selected = ?
        WHERE company_user_id = ?
          AND job_id = ?
          AND id = ?
      `,
      [selected === true ? 1 : 0, companyUserId, jobId, candidateId],
    );

    if (toNumber(result?.affectedRows, 0) === 0) {
      return null;
    }

    const snapshot = await syncJobEvaluationSnapshot(companyUserId, job);

    return {
      candidates: snapshot.candidates,
      selectedCount: snapshot.candidates.filter((candidate) => candidate.selected).length,
    };
  }

  const candidates = parseJsonField(job.blind_candidates_payload, []).map((candidate) =>
    candidate.id === candidateId ? { ...candidate, selected: selected === true } : candidate,
  );

  await pool.execute(
    `
      UPDATE company_jobs
      SET blind_candidates_payload = ?,
          report_payload = ?
      WHERE company_user_id = ?
        AND id = ?
    `,
    [JSON.stringify(candidates), JSON.stringify(buildReportPayload(candidates)), companyUserId, jobId],
  );

  return {
    candidates,
    selectedCount: candidates.filter((candidate) => candidate.selected).length,
  };
}

export async function notifyCompanyBlindCandidates(companyUser, jobId, input) {
  await ensureCompanyPortalSeed(companyUser);

  const companyUserId = toNumber(companyUser.id);
  const job = await getJobRow(companyUserId, jobId);

  if (!job) {
    return null;
  }

  const evaluationRows = await getJobEvaluationRows(companyUserId, jobId);
  const selectedEvaluations = evaluationRows.filter((row) => toNumber(row.selected) === 1);

  if (selectedEvaluations.length === 0) {
    return {
      selectedCount: 0,
      message: '선택된 후보가 없어 알림을 발송하지 않았습니다.',
    };
  }

  const candidateProfiles = await getCandidateProfilesForJob(jobId);
  const candidateProfileByAnonymousId = new Map(
    candidateProfiles.map((row) => [buildCandidateEvaluationAnonymousId(toNumber(row.candidate_user_id), jobId), row]),
  );
  const requestFields = normalizeCompanyMatchRequestFields(input);

  let deliveredCount = 0;
  let skippedCount = 0;

  for (const evaluationRow of selectedEvaluations) {
    const candidateProfile = candidateProfileByAnonymousId.get(evaluationRow.anonymous_id);

    if (!candidateProfile) {
      skippedCount += 1;
      continue;
    }

    const infoFields = buildCandidateMatchInfoFields(candidateProfile, requestFields);

    if (infoFields.length === 0) {
      skippedCount += 1;
      continue;
    }

    await pool.execute(
      `
        INSERT INTO candidate_match_requests (
          id, candidate_user_id, company_user_id, job_id, company_job_evaluation_id, anonymous_id,
          company_name, session_title, request_type_label, status, info_fields_payload, notified_at, decision_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NULL)
        ON DUPLICATE KEY UPDATE
          company_job_evaluation_id = VALUES(company_job_evaluation_id),
          anonymous_id = VALUES(anonymous_id),
          company_name = VALUES(company_name),
          session_title = VALUES(session_title),
          request_type_label = VALUES(request_type_label),
          status = 'pending',
          info_fields_payload = VALUES(info_fields_payload),
          notified_at = VALUES(notified_at),
          decision_at = NULL
      `,
      [
        `match-${randomUUID()}`,
        toNumber(candidateProfile.candidate_user_id),
        companyUserId,
        jobId,
        evaluationRow.id,
        evaluationRow.anonymous_id,
        companyUser.companyName,
        job.title,
        `${job.badge} · ${job.title}`,
        JSON.stringify(infoFields),
      ],
    );

    await sendCandidateMatchingEmail({
      candidateEmail: String(candidateProfile.email ?? '').trim(),
      candidateName: String(candidateProfile.full_name ?? '').trim(),
      companyName: companyUser.companyName,
      sessionTitle: job.title,
    });

    deliveredCount += 1;
  }

  return {
    selectedCount: deliveredCount,
    message:
      skippedCount > 0
        ? `${deliveredCount}명에게 알림을 전송했습니다. ${skippedCount}건은 연결된 지원자 계정을 찾지 못해 제외되었습니다.`
        : `${deliveredCount}명에게 알림을 전송했습니다.`,
  };
}

export async function updateCompanyFraudCaseStatus(companyUser, caseId, status) {
  await ensureCompanyPortalSeed(companyUser);

  if (!['resolved', 'dismissed'].includes(status)) {
    throw new Error('지원하지 않는 부정 처리 상태입니다.');
  }

  const [result] = await pool.execute(
    `
      UPDATE company_fraud_cases
      SET status = ?
      WHERE company_user_id = ?
        AND id = ?
    `,
    [status, toNumber(companyUser.id), caseId],
  );

  return toNumber(result.affectedRows) > 0;
}
