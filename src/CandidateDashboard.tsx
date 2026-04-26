import {
  any,
  CredentialRequest,
  IDKitErrorCodes,
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from '@worldcoin/idkit';
import { useEffect, useRef, useState } from 'react';
import {
  createCandidateLoginWorldIdRpSignature,
  createCandidateEligibilityWorldIdRpSignature,
  fetchCandidateJobEligibility,
  fetchCandidatePortalBootstrap,
  fetchWorldIdConfig,
  loginCandidateWithWorldId,
  respondToCandidateMatchRequest,
  saveCandidateFavorites,
  saveCandidateJobApplication,
  saveCandidatePortalSettings,
  verifyCandidateEligibilityWithWorldId,
  type CandidateEligibilityStatus,
  type CandidatePortalBootstrap,
  type CandidateSessionUser,
  type WorldIdConfig,
  type WorldIdRpSignature,
} from './api';

type CandidateDashboardProps = {
  user: CandidateSessionUser;
  onLogout: () => void | Promise<void>;
};

type CandidateView =
  | 'home'
  | 'explore'
  | 'pendingList'
  | 'pendingConfirm'
  | 'pendingUpload'
  | 'reports'
  | 'reportDetail'
  | 'matchingHistory'
  | 'settings';
type CandidateExploreFilterKey =
  | 'all'
  | 'favorites'
  | 'recruiting'
  | 'contest'
  | 'audition'
  | 'education'
  | 'active'
  | 'urgent';
type CandidatePipelineStatus = 'draft' | 'submitted';
type CandidateMatchingFilterKey = 'all' | 'pending' | 'accepted' | 'rejected';
type CandidateMatchingStatus = 'pending' | 'accepted' | 'rejected';

type CandidateDashboardNavItem = {
  label: string;
  view?: CandidateView;
};

type CandidateDashboardSession = {
  title: string;
  type: string;
  deadline: string;
  status: string;
  tone: 'solid' | 'outline';
};

type CandidateDashboardGrowthPoint = {
  month: string;
  value: number;
  barHeight: number;
};

type CandidateExploreFilter = {
  key: CandidateExploreFilterKey;
  label: string;
};

type CandidateExploreSession = {
  id: string;
  title: string;
  organization: string;
  location: string;
  mode: string;
  description: string;
  inviteCode: string;
  typeLabel: string;
  filterKey: Extract<CandidateExploreFilterKey, 'recruiting' | 'contest' | 'audition' | 'education'>;
  status: 'draft' | 'open' | 'closing';
  deadline: string;
  deadlineDays: number;
  processes: CandidateSessionProcess[];
  requirements: string[];
  detailLines: string[];
  eligibilityLines: string[];
  weights: string[];
};

type CandidateSessionProcess = {
  id: number;
  name: string;
  content: string;
  submissionMethod: string;
};

type CandidatePortfolioFile = {
  name: string;
  sizeLabel: string;
  uploadProgress: number;
};

type CandidateProcessResponse = {
  processId: number;
  value: string;
  file: CandidatePortfolioFile | null;
};

type CandidateTaskDraft = {
  humanVerified: boolean;
  eligibilityVerified: boolean;
  processResponses: CandidateProcessResponse[];
};

type CandidateTaskDraftUpdater =
  | CandidateTaskDraft
  | ((current: CandidateTaskDraft) => CandidateTaskDraft);

type CandidateSavedApplication = CandidateTaskDraft & {
  sessionId: string;
  status: CandidatePipelineStatus;
  githubUrl: string;
  portfolioFile: CandidatePortfolioFile | null;
  updatedAtLabel: string;
};

type CandidatePipelineStage = 'confirm' | 'upload' | 'done';

type CandidateReportAgentScore = {
  label: string;
  weightLabel: string;
  score: number;
};

type CandidateReport = {
  id: string;
  sessionId: string;
  title: string;
  organization: string;
  location: string;
  mode: string;
  typeLabel: string;
  weights: string[];
  submittedAt: string;
  status: 'processing' | 'completed';
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

type CandidateMatchField = {
  key: string;
  label: string;
  value: string;
  shared: boolean;
  required?: boolean;
};

type CandidateMatchRecord = {
  id: string;
  company: string;
  sessionTitle: string;
  requestTypeLabel: string;
  requestedAt: string;
  status: CandidateMatchingStatus;
  infoFields: CandidateMatchField[];
};

type CandidateSettingsShareKey = 'name' | 'email' | 'phone' | 'education' | 'career' | 'resume';

type CandidateSettingsAttachment = {
  id: string;
  label: string;
  fileName: string;
  sizeLabel?: string;
  emptyLabel?: string;
};

type CandidateSettingsForm = {
  name: string;
  birthDate: string;
  email: string;
  phone: string;
  language: string;
  education: string;
  affiliation: string;
  careerYears: string;
  employmentType: string;
  attachments: CandidateSettingsAttachment[];
  shareDefaults: Record<CandidateSettingsShareKey, boolean>;
};

const CANDIDATE_DASHBOARD_NAV_ITEMS: CandidateDashboardNavItem[] = [
  { label: '홈 대시보드', view: 'home' },
  { label: '공고 탐색', view: 'explore' },
  { label: '진행 중 공고', view: 'pendingList' },
  { label: '내 리포트', view: 'reports' },
  { label: '매칭 이력', view: 'matchingHistory' },
  { label: '설정', view: 'settings' },
];

const CANDIDATE_DASHBOARD_SESSIONS: CandidateDashboardSession[] = [
  {
    title: '백엔드 개발자 채용 #7291',
    type: '채용',
    deadline: 'D-2',
    status: '진행 중',
    tone: 'solid',
  },
  {
    title: 'AI 해커톤 오디션',
    type: '오디션',
    deadline: 'D-14',
    status: '진행 중',
    tone: 'solid',
  },
  {
    title: '프론트엔드 포트폴리오',
    type: '채용',
    deadline: '제출완료',
    status: '평가 중',
    tone: 'outline',
  },
  {
    title: '디자인 공모전 2026',
    type: '공모전',
    deadline: 'D-30',
    status: '진행 중',
    tone: 'solid',
  },
  {
    title: 'UX 리서처 신입',
    type: '채용',
    deadline: 'D-7',
    status: '진행 중',
    tone: 'solid',
  },
];

const CANDIDATE_DASHBOARD_REPORTS = ['report-backend-7291', 'report-ux-audition', 'report-public-data'];

const CANDIDATE_DASHBOARD_MATCH_REQUESTS = ['match-oo-startup', 'match-dd-electronics'];

const CANDIDATE_DASHBOARD_GROWTH: CandidateDashboardGrowthPoint[] = [
  { month: '11월', value: 8, barHeight: 14 },
  { month: '12월', value: 26, barHeight: 33 },
  { month: '1월', value: 42, barHeight: 74 },
  { month: '2월', value: 68, barHeight: 107 },
  { month: '3월', value: 55, barHeight: 89 },
  { month: '4월', value: 82, barHeight: 161 },
];

const CANDIDATE_EXPLORE_FILTERS: CandidateExploreFilter[] = [
  { key: 'all', label: '전체' },
  { key: 'favorites', label: '즐겨찾기' },
  { key: 'recruiting', label: '채용' },
  { key: 'contest', label: '공모전' },
  { key: 'audition', label: '오디션' },
  { key: 'education', label: '교육' },
  { key: 'active', label: '진행 중' },
  { key: 'urgent', label: '마감임박' },
];

const CANDIDATE_REPORT_FILTERS: CandidateExploreFilter[] = [
  { key: 'all', label: '전체' },
  { key: 'recruiting', label: '채용' },
  { key: 'contest', label: '공모전' },
  { key: 'audition', label: '오디션' },
  { key: 'education', label: '교육' },
  { key: 'active', label: '진행 중' },
  { key: 'urgent', label: '마감임박' },
];

const DEFAULT_CANDIDATE_SESSION_PROCESSES: CandidateSessionProcess[] = [
  { id: 1, name: 'GitHub 링크 제출', content: '구현 저장소 링크를 제출하세요.', submissionMethod: '링크 제출' },
  { id: 2, name: '포트폴리오 PDF 제출', content: '핵심 산출물을 PDF로 제출하세요.', submissionMethod: 'PDF 업로드' },
];

const CANDIDATE_EXPLORE_SESSIONS: CandidateExploreSession[] = [
  {
    id: 'backend-7291',
    title: '백엔드 개발자 채용 #7291',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    description: '커머스 도메인의 주문/결제 시스템을 설계하고 핵심 모듈을 구현한 코드를 제출하세요.',
    inviteCode: 'xF3K-92AL-7QP',
    typeLabel: '채용',
    filterKey: 'recruiting',
    status: 'open',
    deadline: 'D-2',
    deadlineDays: 2,
    processes: DEFAULT_CANDIDATE_SESSION_PROCESSES,
    requirements: ['GitHub 링크 제출', '개발자 포트폴리오 제출'],
    detailLines: [
      '커머스 도메인의 주문/결제 시스템을 설계하고 핵심 모듈을 구현한 코드를 제출하세요.',
      'README에 아키텍처 의사결정 과정을 포함해야 합니다.',
    ],
    eligibilityLines: [
      '기간: 2026.04.25 ~ 2026.04.30 23:59',
      '모집 인원: 00명',
      '지원 자격: 만 18세 이상 / 대한민국',
    ],
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
  },
  {
    id: 'ux-audition',
    title: 'UX 디자이너 오디션',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    description: '사용자 경험 개선 방향을 구조적으로 설명하고 결과물을 포트폴리오 형식으로 제출하세요.',
    inviteCode: 'C8WQ-44NV-2KP',
    typeLabel: '공모전',
    filterKey: 'contest',
    status: 'open',
    deadline: 'D-5',
    deadlineDays: 5,
    processes: DEFAULT_CANDIDATE_SESSION_PROCESSES,
    requirements: ['GitHub 링크 제출', '개발자 포트폴리오 제출'],
    detailLines: [
      '사용자 경험 개선 방향을 구조적으로 설명하고 결과물을 포트폴리오 형식으로 제출하세요.',
      '문제 정의와 가설 검증 과정을 함께 기록하면 더 좋습니다.',
    ],
    eligibilityLines: [
      '기간: 2026.04.25 ~ 2026.04.30 23:59',
      '모집 인원: 00명',
      '지원 자격: 만 18세 이상 / 대한민국',
    ],
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
  },
  {
    id: 'public-data-contest',
    title: '공공데이터 활용 공모전',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    description: '데이터 활용 방식과 구현 의도를 설명한 문서, 그리고 실행 가능한 산출물을 함께 제출하세요.',
    inviteCode: 'ZT6M-18EL-4RX',
    typeLabel: '오디션',
    filterKey: 'audition',
    status: 'open',
    deadline: 'D-8',
    deadlineDays: 8,
    processes: DEFAULT_CANDIDATE_SESSION_PROCESSES,
    requirements: ['GitHub 링크 제출', '개발자 포트폴리오 제출'],
    detailLines: [
      '데이터 활용 방식과 구현 의도를 설명한 문서, 그리고 실행 가능한 산출물을 함께 제출하세요.',
      'README에 데이터 해석 기준과 설계 의사결정을 포함해야 합니다.',
    ],
    eligibilityLines: [
      '기간: 2026.04.25 ~ 2026.04.30 23:59',
      '모집 인원: 00명',
      '지원 자격: 만 18세 이상 / 대한민국',
    ],
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
  },
  {
    id: 'ai-engineer',
    title: 'AI 엔지니어 채용',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    description: 'AI 서비스 운영 환경을 고려한 모델 서빙 구조와 추론 최적화 전략을 정리해 제출하세요.',
    inviteCode: 'QP9A-71BE-6TL',
    typeLabel: '채용',
    filterKey: 'recruiting',
    status: 'open',
    deadline: 'D-4',
    deadlineDays: 4,
    processes: DEFAULT_CANDIDATE_SESSION_PROCESSES,
    requirements: ['GitHub 링크 제출', '개발자 포트폴리오 제출'],
    detailLines: [
      'AI 서비스 운영 환경을 고려한 모델 서빙 구조와 추론 최적화 전략을 정리해 제출하세요.',
      'README에 비용/성능 간 의사결정 기준을 포함해야 합니다.',
    ],
    eligibilityLines: [
      '기간: 2026.04.25 ~ 2026.04.30 23:59',
      '모집 인원: 00명',
      '지원 자격: 만 18세 이상 / 대한민국',
    ],
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
  },
  {
    id: 'frontend-mid',
    title: '프론트엔드 2년차',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    description: '복잡한 사용자 흐름을 가진 인터페이스를 설계하고 구현한 경험을 중심으로 제출하세요.',
    inviteCode: 'NB3D-57TR-9YM',
    typeLabel: '공모전',
    filterKey: 'contest',
    status: 'open',
    deadline: 'D-6',
    deadlineDays: 6,
    processes: DEFAULT_CANDIDATE_SESSION_PROCESSES,
    requirements: ['GitHub 링크 제출', '개발자 포트폴리오 제출'],
    detailLines: [
      '복잡한 사용자 흐름을 가진 인터페이스를 설계하고 구현한 경험을 중심으로 제출하세요.',
      '문제 정의와 가설 검증 과정을 함께 기록하면 더 좋습니다.',
    ],
    eligibilityLines: [
      '기간: 2026.04.25 ~ 2026.04.30 23:59',
      '모집 인원: 00명',
      '지원 자격: 만 18세 이상 / 대한민국',
    ],
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
  },
  {
    id: 'content-planner',
    title: '콘텐츠 기획자 모집',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    description: '콘텐츠 전략과 실험 설계를 기반으로 한 문제 해결 사례를 제출하세요.',
    inviteCode: 'LK4J-33QP-1VN',
    typeLabel: '오디션',
    filterKey: 'audition',
    status: 'open',
    deadline: 'D-8',
    deadlineDays: 8,
    processes: DEFAULT_CANDIDATE_SESSION_PROCESSES,
    requirements: ['GitHub 링크 제출', '개발자 포트폴리오 제출'],
    detailLines: [
      '콘텐츠 전략과 실험 설계를 기반으로 한 문제 해결 사례를 제출하세요.',
      '성과 측정 기준과 개선 루프를 명확히 설명하면 더 좋습니다.',
    ],
    eligibilityLines: [
      '기간: 2026.04.25 ~ 2026.04.30 23:59',
      '모집 인원: 00명',
      '지원 자격: 만 18세 이상 / 대한민국',
    ],
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
  },
];

const CANDIDATE_REPORTS: CandidateReport[] = [
  {
    id: 'report-backend-7291',
    sessionId: 'backend-7291',
    title: '백엔드 개발자 채용 #7291',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    typeLabel: '채용',
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
    submittedAt: '제출 2026-04-18 14:22',
    status: 'completed',
    statusLabel: '평가 완료',
    overallScore: 82.3,
    percentileLabel: '상위 12% · 5/42',
    agentScores: [
      { label: 'Technical Evaluator', weightLabel: '가중치 35%', score: 88 },
      { label: 'Reasoning Evaluator', weightLabel: '가중치 25%', score: 82 },
      { label: 'Communication Evaluator', weightLabel: '가중치 25%', score: 78 },
      { label: 'Creativity Evaluator', weightLabel: '가중치 10%', score: 74 },
      { label: 'Integrity Evaluator', weightLabel: '가중치 5%', score: 96 },
    ],
    strengths: [
      '도메인 모델링과 경계 컨텍스트 분리가 명확함',
      '동시성 이슈 대응 전략이 구체적',
      'Trade-off 설명 전달력이 우수',
    ],
    improvements: [
      { title: '장애 복구 자동화 경험 부족', description: 'SRE/Chaos Engineering 관련 학습 추천' },
      { title: '테스트 커버리지 전략 미흡', description: '계약 테스트/부하 테스트 자료 제공' },
      { title: '커뮤니케이션 시 구조적 전달', description: 'STAR 프레임워크 연습 제안' },
    ],
  },
  {
    id: 'report-ux-audition',
    sessionId: 'ux-audition',
    title: 'UX 디자이너 오디션',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    typeLabel: '공모전',
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
    submittedAt: '제출 2026-04-16 11:08',
    status: 'completed',
    statusLabel: '평가 완료',
    overallScore: 79.4,
    percentileLabel: '상위 18% · 8/44',
    agentScores: [
      { label: 'Technical Evaluator', weightLabel: '가중치 35%', score: 76 },
      { label: 'Reasoning Evaluator', weightLabel: '가중치 25%', score: 81 },
      { label: 'Communication Evaluator', weightLabel: '가중치 25%', score: 84 },
      { label: 'Creativity Evaluator', weightLabel: '가중치 10%', score: 88 },
      { label: 'Integrity Evaluator', weightLabel: '가중치 5%', score: 90 },
    ],
    strengths: [
      '문제 정의와 사용자 관찰 포인트가 구체적',
      '스토리텔링 기반 포트폴리오 구성이 좋음',
      '가설-실험-학습 루프가 잘 드러남',
    ],
    improvements: [
      { title: '정량 지표 설계 보완 필요', description: '성과 측정 메트릭을 더 명확히 정리해 보세요.' },
      { title: '우선순위 기준 설명 부족', description: '선택하지 않은 대안도 함께 비교하면 좋습니다.' },
      { title: '기술 구현 근거 강화', description: '프로토타입 연결 방식과 제약 사항을 함께 적어보세요.' },
    ],
  },
  {
    id: 'report-public-data',
    sessionId: 'public-data-contest',
    title: '공공데이터 활용 공모전',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    typeLabel: '오디션',
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
    submittedAt: '제출 2026-04-14 09:40',
    status: 'completed',
    statusLabel: '평가 완료',
    overallScore: 80.1,
    percentileLabel: '상위 15% · 6/40',
    agentScores: [
      { label: 'Technical Evaluator', weightLabel: '가중치 35%', score: 82 },
      { label: 'Reasoning Evaluator', weightLabel: '가중치 25%', score: 80 },
      { label: 'Communication Evaluator', weightLabel: '가중치 25%', score: 79 },
      { label: 'Creativity Evaluator', weightLabel: '가중치 10%', score: 83 },
      { label: 'Integrity Evaluator', weightLabel: '가중치 5%', score: 91 },
    ],
    strengths: [
      '데이터 해석 프레임이 안정적',
      '문제 설정이 사회적 맥락과 연결됨',
      '결과 설명이 일관되고 설득력 있음',
    ],
    improvements: [
      { title: '시각화 선택 근거 강화', description: '차트 선택 이유와 대체안 비교를 보완해 보세요.' },
      { title: '데이터 품질 리스크 정리 필요', description: '결측치와 이상치 처리 기준을 명확히 적어보세요.' },
      { title: '배포 관점 서술 부족', description: '서비스화 시 운영 시나리오를 추가해 보세요.' },
    ],
  },
  {
    id: 'report-ai-engineer',
    sessionId: 'ai-engineer',
    title: 'AI 엔지니어 채용',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    typeLabel: '채용',
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
    submittedAt: '제출 2026-04-13 17:21',
    status: 'completed',
    statusLabel: '평가 완료',
    overallScore: 84.6,
    percentileLabel: '상위 10% · 4/38',
    agentScores: [
      { label: 'Technical Evaluator', weightLabel: '가중치 35%', score: 90 },
      { label: 'Reasoning Evaluator', weightLabel: '가중치 25%', score: 84 },
      { label: 'Communication Evaluator', weightLabel: '가중치 25%', score: 80 },
      { label: 'Creativity Evaluator', weightLabel: '가중치 10%', score: 77 },
      { label: 'Integrity Evaluator', weightLabel: '가중치 5%', score: 95 },
    ],
    strengths: [
      '서빙 구조와 비용 최적화 판단이 선명함',
      '성능 병목 지점에 대한 분석이 정확함',
      '운영 상황을 고려한 설계 근거가 탄탄함',
    ],
    improvements: [
      { title: '모델 평가 지표 설명 강화', description: '오프라인/온라인 지표 차이를 더 구체적으로 적어보세요.' },
      { title: '롤백 전략 구체화 필요', description: '배포 실패 시 의사결정 단계를 추가해 보세요.' },
      { title: '협업 프로세스 설명 부족', description: 'PM/데이터팀과의 협업 구조를 덧붙이면 좋습니다.' },
    ],
  },
  {
    id: 'report-frontend-mid',
    sessionId: 'frontend-mid',
    title: '프론트엔드 2년차',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    typeLabel: '공모전',
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
    submittedAt: '제출 2026-04-10 19:08',
    status: 'completed',
    statusLabel: '평가 완료',
    overallScore: 77.8,
    percentileLabel: '상위 22% · 9/41',
    agentScores: [
      { label: 'Technical Evaluator', weightLabel: '가중치 35%', score: 79 },
      { label: 'Reasoning Evaluator', weightLabel: '가중치 25%', score: 76 },
      { label: 'Communication Evaluator', weightLabel: '가중치 25%', score: 81 },
      { label: 'Creativity Evaluator', weightLabel: '가중치 10%', score: 80 },
      { label: 'Integrity Evaluator', weightLabel: '가중치 5%', score: 90 },
    ],
    strengths: [
      'UI 상태 흐름 설명이 명확함',
      '사용자 경험 상의 우선순위가 선명함',
      '협업 중심의 회고 문서가 좋음',
    ],
    improvements: [
      { title: '성능 최적화 측정 근거 필요', description: 'Before/After 수치를 함께 제시해 보세요.' },
      { title: '접근성 검토 범위 보완', description: '키보드/스크린리더 관점도 더 적어보세요.' },
      { title: '테스트 전략 설명 추가', description: '회귀 테스트와 UI 테스트 범위를 함께 정리해 보세요.' },
    ],
  },
  {
    id: 'report-content-planner',
    sessionId: 'content-planner',
    title: '콘텐츠 기획자 모집',
    organization: '○○컴퍼니',
    location: '한국',
    mode: 'Remote',
    typeLabel: '오디션',
    weights: ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
    submittedAt: '제출 2026-04-08 13:02',
    status: 'completed',
    statusLabel: '평가 완료',
    overallScore: 78.9,
    percentileLabel: '상위 20% · 7/35',
    agentScores: [
      { label: 'Technical Evaluator', weightLabel: '가중치 35%', score: 74 },
      { label: 'Reasoning Evaluator', weightLabel: '가중치 25%', score: 82 },
      { label: 'Communication Evaluator', weightLabel: '가중치 25%', score: 85 },
      { label: 'Creativity Evaluator', weightLabel: '가중치 10%', score: 83 },
      { label: 'Integrity Evaluator', weightLabel: '가중치 5%', score: 91 },
    ],
    strengths: [
      '콘텐츠 전략과 실험 흐름이 설득력 있음',
      '타깃 페르소나 이해도가 높음',
      '문서의 전달 구조가 안정적',
    ],
    improvements: [
      { title: '정량 KPI 세분화 필요', description: '퍼널별 목표 수치를 더 분리해 보세요.' },
      { title: '실행 리소스 산정 보완', description: '운영 비용과 일정 추정을 함께 적으면 좋습니다.' },
      { title: '실패 가설 기록 강화', description: '실패한 실험과 배움을 더 자세히 담아보세요.' },
    ],
  },
];

const CANDIDATE_MATCHING_FILTERS: Array<{ key: CandidateMatchingFilterKey; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '대기중' },
  { key: 'accepted', label: '동의' },
  { key: 'rejected', label: '거절' },
];

const INITIAL_CANDIDATE_MATCH_HISTORY: CandidateMatchRecord[] = [
  {
    id: 'match-oo-startup',
    company: '○○스타트업',
    sessionTitle: '백엔드 채용 #7291',
    requestTypeLabel: '채용 · 백엔드 개발자 #7291',
    requestedAt: '2026-04-18 14:40',
    status: 'pending',
    infoFields: [
      { key: 'name', label: '이름', value: '홍길동', shared: true },
      { key: 'email', label: '이메일', value: 'you@example.com', shared: true },
      { key: 'phone', label: '연락처', value: '010-1234-5678', shared: true },
      { key: 'education', label: '학력', value: '○○대 컴퓨터공학', shared: true },
      { key: 'career', label: '경력', value: '3년 · 백엔드', shared: true },
      { key: 'resume', label: '이력서 PDF', value: 'resume-2026.pdf', shared: false },
    ],
  },
  {
    id: 'match-dd-electronics',
    company: '△△전자',
    sessionTitle: 'AI 엔지니어 #6104',
    requestTypeLabel: '채용 · AI 엔지니어 #6104',
    requestedAt: '2026-04-15 09:12',
    status: 'pending',
    infoFields: [
      { key: 'name', label: '이름', value: '홍길동', shared: true },
      { key: 'email', label: '이메일', value: 'you@example.com', shared: true },
      { key: 'phone', label: '연락처', value: '010-1234-5678', shared: false },
      { key: 'education', label: '학력', value: '○○대 컴퓨터공학', shared: false },
      { key: 'career', label: '경력', value: '3년 · AI 엔지니어', shared: false },
      { key: 'resume', label: '이력서 PDF', value: 'ai-engineer.pdf', shared: false },
    ],
  },
  {
    id: 'match-cc-company',
    company: '□□컴퍼니',
    sessionTitle: '프론트 2년차 #5021',
    requestTypeLabel: '공모전 · 프론트 2년차 #5021',
    requestedAt: '2026-04-10 17:55',
    status: 'rejected',
    infoFields: [
      { key: 'name', label: '이름', value: '홍길동', shared: false },
      { key: 'email', label: '이메일', value: 'you@example.com', shared: false },
      { key: 'phone', label: '연락처', value: '010-1234-5678', shared: false },
    ],
  },
  {
    id: 'match-lab',
    company: '◇◇랩',
    sessionTitle: '해커톤 오디션',
    requestTypeLabel: '오디션 · 해커톤 오디션',
    requestedAt: '2026-04-05 12:01',
    status: 'accepted',
    infoFields: [
      { key: 'name', label: '이름', value: '홍길동', shared: true },
      { key: 'email', label: '이메일', value: 'you@example.com', shared: true },
      { key: 'phone', label: '연락처', value: '010-1234-5678', shared: false },
    ],
  },
  {
    id: 'match-media',
    company: '▽▽미디어',
    sessionTitle: '콘텐츠 기획 채용',
    requestTypeLabel: '채용 · 콘텐츠 기획 채용',
    requestedAt: '2026-03-28 19:22',
    status: 'rejected',
    infoFields: [{ key: 'name', label: '이름', value: '홍길동', shared: false }],
  },
  {
    id: 'match-ventures',
    company: '○○벤처스',
    sessionTitle: 'UX 오디션',
    requestTypeLabel: '오디션 · UX 오디션',
    requestedAt: '2026-03-20 10:48',
    status: 'accepted',
    infoFields: [
      { key: 'name', label: '이름', value: '홍길동', shared: true },
      { key: 'email', label: '이메일', value: 'you@example.com', shared: true },
      { key: 'resume', label: '이력서 PDF', value: 'ux-portfolio.pdf', shared: true },
      { key: 'career', label: '경력', value: '3년 · UX', shared: true },
    ],
  },
  {
    id: 'match-games',
    company: '☆☆게임즈',
    sessionTitle: '서버 개발자 #4102',
    requestTypeLabel: '채용 · 서버 개발자 #4102',
    requestedAt: '2026-03-12 11:30',
    status: 'accepted',
    infoFields: [
      { key: 'name', label: '이름', value: '홍길동', shared: true },
      { key: 'email', label: '이메일', value: 'you@example.com', shared: true },
      { key: 'resume', label: '이력서 PDF', value: 'server-resume.pdf', shared: true },
    ],
  },
  {
    id: 'match-research',
    company: '◎◎리서치',
    sessionTitle: 'UX 리서처 신입',
    requestTypeLabel: '채용 · UX 리서처 신입',
    requestedAt: '2026-03-01 15:05',
    status: 'rejected',
    infoFields: [{ key: 'name', label: '이름', value: '홍길동', shared: false }],
  },
  {
    id: 'match-soft',
    company: '✕✕소프트',
    sessionTitle: '플랫폼 엔지니어',
    requestTypeLabel: '채용 · 플랫폼 엔지니어',
    requestedAt: '2026-02-22 16:18',
    status: 'accepted',
    infoFields: [
      { key: 'name', label: '이름', value: '홍길동', shared: true },
      { key: 'phone', label: '연락처', value: '010-1234-5678', shared: true },
    ],
  },
];

const INITIAL_CANDIDATE_SETTINGS_FORM: CandidateSettingsForm = {
  name: '홍길동',
  birthDate: 'YYYY-MM-DD',
  email: 'you@example.com',
  phone: '010-1234-5678',
  language: '',
  education: '○○대학교 컴퓨터공학 학사',
  affiliation: '○○컴퍼니 · 백엔드 엔지니어',
  careerYears: '3년',
  employmentType: 'Full-time / Part-time',
  attachments: [
    {
      id: 'resume',
      label: '이력서 (PDF)',
      fileName: 'resume-2026.pdf',
      sizeLabel: '1.2MB',
    },
    {
      id: 'cover-letter',
      label: '자기소개서',
      fileName: '',
      emptyLabel: '+ 파일 선택',
    },
  ],
  shareDefaults: {
    name: true,
    email: true,
    phone: true,
    education: true,
    career: true,
    resume: true,
  },
};

const candidateSettingsLanguageOptions = [
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

function truncateLabel(value: string, limit: number) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

function getDisplayName(value: string) {
  const trimmed = value.trim();

  return trimmed ? truncateLabel(trimmed, 12) : '지원자';
}

function getGreetingName(value: string) {
  const trimmed = value.trim();

  return trimmed ? truncateLabel(trimmed, 14) : '지원자';
}

function getProfileSubtitle(email: string) {
  const trimmed = email.trim();

  return trimmed ? `지원자 · ${truncateLabel(trimmed, 20)}` : '지원자 · World ID';
}

function getAvatarLabel(name: string) {
  const trimmed = name.trim();

  return trimmed ? trimmed.slice(0, 1).toUpperCase() : 'W';
}

function CandidateWorldMark({ alt = 'World' }: { alt?: string }) {
  return <img src="/world-id-mark.png" alt={alt} className="candidate-world-mark" />;
}

function normalizeProcessSubmissionMethodLabel(method: string) {
  const normalized = method.trim();
  const lowered = normalized.toLowerCase();

  if (!normalized || normalized === '제출 없음') {
    return '';
  }

  if (normalized.includes('링크')) {
    return '링크 제출';
  }

  if (lowered.includes('pdf') || lowered.startsWith('.')) {
    return 'PDF';
  }

  if (normalized.includes('텍스트')) {
    return '텍스트 직접 입력';
  }

  return normalized;
}

function matchesExploreFilter(
  session: CandidateExploreSession,
  filter: CandidateExploreFilterKey,
  favoriteSessionIds: Set<string>,
) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'favorites') {
    return favoriteSessionIds.has(session.id);
  }

  if (filter === 'active') {
    return session.deadlineDays > 0;
  }

  if (filter === 'urgent') {
    return session.deadlineDays <= 5;
  }

  return session.filterKey === filter;
}

function isLinkProcess(process: CandidateSessionProcess) {
  return normalizeProcessSubmissionMethodLabel(process.submissionMethod).includes('링크');
}

function isTextProcess(process: CandidateSessionProcess) {
  return normalizeProcessSubmissionMethodLabel(process.submissionMethod) === '텍스트 직접 입력';
}

function isFileProcess(process: CandidateSessionProcess) {
  return normalizeProcessSubmissionMethodLabel(process.submissionMethod) === 'PDF';
}

function getProcessSubmissionBadgeLabel(process: CandidateSessionProcess) {
  return normalizeProcessSubmissionMethodLabel(process.submissionMethod) || process.submissionMethod;
}

function isValidSubmissionLink(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function createProcessResponses(
  processes: CandidateSessionProcess[],
  existingResponses: CandidateProcessResponse[] = [],
): CandidateProcessResponse[] {
  return processes.map((process) => {
    const matched = existingResponses.find((response) => response.processId === process.id);

    return {
      ...matched,
      processId: process.id,
      value: matched?.value ?? '',
      file: matched?.file ?? null,
    };
  });
}

function areAllProcessesCompleted(processes: CandidateSessionProcess[], responses: CandidateProcessResponse[]) {
  return processes.every((process) => {
    const response = responses.find((item) => item.processId === process.id);

    if (isFileProcess(process)) {
      return Boolean(response?.file?.name);
    }

    if (isLinkProcess(process)) {
      return isValidSubmissionLink(response?.value ?? '');
    }

    return Boolean(response?.value.trim());
  });
}

function hasCompletedCandidateTaskFields(session: CandidateExploreSession, draft: CandidateTaskDraft) {
  return areAllProcessesCompleted(session.processes, draft.processResponses);
}

function canSubmitCandidateTaskDraft(session: CandidateExploreSession, draft: CandidateTaskDraft) {
  return Boolean(
    hasCompletedCandidateTaskFields(session, draft) &&
      draft.eligibilityVerified &&
      draft.humanVerified,
  );
}

function createEmptyTaskDraft(processes: CandidateSessionProcess[] = [], humanVerified = false): CandidateTaskDraft {
  return {
    humanVerified,
    eligibilityVerified: false,
    processResponses: createProcessResponses(processes),
  };
}

function createTaskDraftFromApplication(
  application: CandidateSavedApplication,
  processes: CandidateSessionProcess[] = [],
): CandidateTaskDraft {
  return {
    humanVerified: false,
    eligibilityVerified: application.eligibilityVerified,
    processResponses: createProcessResponses(processes, application.processResponses),
  };
}

function formatSavedTime(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

function CandidateSessionFacts({ lines }: { lines: string[] }) {
  return (
    <div className="candidate-pipeline-session__facts">
      {lines.map((line) => {
        const dividerIndex = line.indexOf(':');
        const label = dividerIndex >= 0 ? line.slice(0, dividerIndex).trim() : line;
        const value = dividerIndex >= 0 ? line.slice(dividerIndex + 1).trim() : '';

        return (
          <div key={line} className="candidate-pipeline-session__fact-row">
            <span className="candidate-pipeline-session__fact-label">{label}</span>
            <strong className="candidate-pipeline-session__fact-value">{value || line}</strong>
          </div>
        );
      })}
    </div>
  );
}

function createInitialCandidateSettingsForm(user: CandidateSessionUser): CandidateSettingsForm {
  return {
    ...INITIAL_CANDIDATE_SETTINGS_FORM,
    name: user.name.trim() || INITIAL_CANDIDATE_SETTINGS_FORM.name,
    email: user.email.trim() || INITIAL_CANDIDATE_SETTINGS_FORM.email,
  };
}

function getMatchStatusLabel(status: CandidateMatchingStatus) {
  if (status === 'accepted') {
    return '동의';
  }

  if (status === 'rejected') {
    return '거절';
  }

  return '대기';
}

function getMatchSharedSummary(record: CandidateMatchRecord) {
  if (record.status !== 'accepted') {
    return '—';
  }

  const visibleLabels = record.infoFields.filter((field) => field.shared).map((field) => field.label);

  return visibleLabels.length > 0 ? visibleLabels.join('·') : '—';
}

function matchesHistoryFilter(record: CandidateMatchRecord, filter: CandidateMatchingFilterKey) {
  if (filter === 'all') {
    return true;
  }

  if (filter === 'accepted') {
    return record.status === 'accepted';
  }

  if (filter === 'rejected') {
    return record.status === 'rejected';
  }

  return record.status === 'pending';
}

type CandidateHomeViewProps = {
  greetingName: string;
  favoriteSessions: CandidateExploreSession[];
  reports: CandidateReport[];
  matchingRecords: CandidateMatchRecord[];
  onOpenReport: (reportId: string) => void;
  onOpenMatch: (matchId: string) => void;
  onOpenSession: (sessionId: string) => void;
};

function CandidateVerifiedName({ name, tone = 'default' }: { name: string; tone?: 'default' | 'greeting' }) {
  return (
    <span className={`candidate-verified-name${tone === 'greeting' ? ' candidate-verified-name--greeting' : ''}`}>
      <span>{name}</span>
      <img src="/verified.svg" alt="" aria-hidden="true" className="candidate-verified-name__badge" />
    </span>
  );
}

function CandidateHomeView({
  greetingName,
  favoriteSessions,
  reports,
  matchingRecords,
  onOpenReport,
  onOpenMatch,
  onOpenSession,
}: CandidateHomeViewProps) {
  const pendingMatchingRecords = matchingRecords.filter((item) => item.status === 'pending');
  const svgWidth = 720;
  const svgHeight = 220;
  const baseline = 170;
  const barWidth = 82;
  const columnGap = 34;
  const points = CANDIDATE_DASHBOARD_GROWTH.map((item, index) => {
    const x = 20 + index * (barWidth + columnGap);
    const centerX = x + barWidth / 2;
    const y = baseline - item.barHeight;

    return {
      ...item,
      x,
      centerX,
      y,
    };
  });

  return (
    <>
      <p className="candidate-dashboard-greeting">
        안녕하세요, <CandidateVerifiedName name={greetingName} tone="greeting" />
      </p>

      <section className="candidate-dashboard-layout">
        <div className="candidate-dashboard-primary">
          <article className="candidate-dashboard-panel candidate-dashboard-jobs">
            <div className="candidate-dashboard-jobs__header">
              <div>
                <h2>관심 공고</h2>
                <p>초대 링크로 들어온 공고와 즐겨찾기한 공개 공고</p>
              </div>
            </div>

            <div className="candidate-dashboard-jobs__table-wrap">
              {favoriteSessions.length === 0 ? (
                <div className="candidate-dashboard-jobs__empty">
                  <strong>즐겨찾기한 공고가 없습니다.</strong>
                  <p>공고 탐색에서 별 버튼을 눌러 관심 공고를 저장해보세요.</p>
                </div>
              ) : (
                <table className="candidate-dashboard-jobs__table">
                  <thead>
                    <tr>
                      <th scope="col">공고명</th>
                      <th scope="col">유형</th>
                      <th scope="col">마감</th>
                      <th scope="col">상태</th>
                      <th scope="col" />
                    </tr>
                  </thead>
                  <tbody>
                    {favoriteSessions.map((session) => (
                      <tr key={session.id}>
                        <td>
                          <strong>{session.title}</strong>
                        </td>
                        <td>{session.typeLabel}</td>
                        <td>{session.deadline}</td>
                        <td>
                          <span
                            className={`candidate-dashboard-jobs__status candidate-dashboard-jobs__status--${
                              session.status === 'draft' || session.status === 'closing' || session.deadlineDays <= 2
                                ? 'outline'
                                : 'solid'
                            }`}
                          >
                            {session.status === 'draft'
                              ? '공개 전'
                              : session.status === 'closing' || session.deadlineDays <= 2
                                ? '마감 임박'
                                : '진행 중'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="candidate-dashboard-jobs__action"
                            onClick={() => onOpenSession(session.id)}
                            disabled={session.status === 'draft'}
                          >
                            {session.status === 'draft' ? '준비 중' : '열기 →'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </article>

          <article className="candidate-dashboard-panel candidate-dashboard-growth">
            <div className="candidate-dashboard-growth__header">
              <h2>성장 추적 — 최근 6개월</h2>
              <p>기술 +12  ·  사고력 +8  ·  커뮤니케이션 +4</p>
            </div>

            <div className="candidate-dashboard-growth__chart" role="img" aria-label="최근 6개월 성장 추적 그래프">
              <svg className="candidate-dashboard-growth__svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`} aria-hidden="true">
                {points.map((point) => (
                  <g key={point.month}>
                    <rect
                      x={point.x}
                      y={baseline - point.barHeight}
                      width={barWidth}
                      height={point.barHeight}
                      rx="3"
                      fill="#f9f9fb"
                    />
                    <text
                      x={point.centerX}
                      y={point.y - 10}
                      textAnchor="middle"
                      fill="#0d0f1a"
                      fontFamily="Pretendard, sans-serif"
                      fontSize="10"
                      fontWeight="500"
                    >
                      {point.value}
                    </text>
                    <text
                      x={point.centerX}
                      y="204"
                      textAnchor="middle"
                      fill="#0d0f1a"
                      fontFamily="Pretendard, sans-serif"
                      fontSize="10"
                      fontWeight="300"
                    >
                      {point.month}
                    </text>
                  </g>
                ))}

                <polyline
                  fill="none"
                  stroke="#0d0f1a"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={points.map((point) => `${point.centerX},${point.y}`).join(' ')}
                />

                {points.map((point) => (
                  <circle key={`${point.month}-dot`} cx={point.centerX} cy={point.y} r="3" fill="#0d0f1a" />
                ))}
              </svg>
            </div>
          </article>
        </div>

        <div className="candidate-dashboard-sidecards">
          <article className="candidate-dashboard-panel candidate-dashboard-card">
            <div className="candidate-dashboard-card__header">
              <h2>최근 평가 리포트</h2>
            </div>

            <div className="candidate-dashboard-card__stack">
              {reports.length === 0 ? (
                <div className="candidate-dashboard-card__empty">
                  <strong>아직 평가 리포트가 없습니다.</strong>
                  <p>제출 후 평가가 시작되면 이곳에서 진행 상태와 결과를 확인할 수 있습니다.</p>
                </div>
              ) : (
                reports.slice(0, 3).map((report) => {
                  if (!report) {
                    return null;
                  }

                  return (
                    <button
                      key={report.id}
                      type="button"
                      className="candidate-dashboard-report-link"
                      onClick={() => onOpenReport(report.id)}
                    >
                      {report.title} · {report.statusLabel} →
                    </button>
                  );
                })
              )}
            </div>
          </article>

          <article className="candidate-dashboard-panel candidate-dashboard-card candidate-dashboard-card--requests">
            <div className="candidate-dashboard-card__header">
              <h2>매칭 동의 요청 ({pendingMatchingRecords.length})</h2>
            </div>

            <div className="candidate-dashboard-request-list">
              {pendingMatchingRecords.length === 0 ? (
                <div className="candidate-dashboard-card__empty">
                  <strong>대기 중인 공개 요청이 없습니다.</strong>
                  <p>기업이 정보 공개를 요청하면 이곳에 표시됩니다.</p>
                </div>
              ) : (
                pendingMatchingRecords.slice(0, 2).map((record) => {
                  if (!record) {
                    return null;
                  }

                  return (
                    <section key={record.id} className="candidate-dashboard-request-card">
                      <strong>{record.company}</strong>
                      <p>{record.sessionTitle} 공개 요청</p>
                      <button type="button" onClick={() => onOpenMatch(record.id)}>
                        자세히 보기
                      </button>
                    </section>
                  );
                })
              )}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}

type CandidateExploreViewProps = {
  sessions: CandidateExploreSession[];
  favoriteSessionIds: Set<string>;
  isSavingFavorites: boolean;
  searchQuery: string;
  selectedFilter: CandidateExploreFilterKey;
  inviteCode: string;
  onSearchQueryChange: (value: string) => void;
  onFilterChange: (value: CandidateExploreFilterKey) => void;
  onInviteCodeChange: (value: string) => void;
  onOpenSession: (sessionId: string) => void;
  onToggleFavorite: (sessionId: string) => void;
};

function CandidateExploreView({
  sessions,
  favoriteSessionIds,
  isSavingFavorites,
  searchQuery,
  selectedFilter,
  inviteCode,
  onSearchQueryChange,
  onFilterChange,
  onInviteCodeChange,
  onOpenSession,
  onToggleFavorite,
}: CandidateExploreViewProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleSessions = sessions.filter((session) => {
    const matchesQuery =
      !normalizedQuery ||
      [session.title, session.organization, session.inviteCode, session.typeLabel].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );

    return matchesQuery && matchesExploreFilter(session, selectedFilter, favoriteSessionIds);
  });

  return (
    <div className="candidate-discover">
      <section className="candidate-dashboard-panel candidate-discover-toolbar">
        <div className="candidate-discover-toolbar__row">
          <label className="candidate-discover-toolbar__search" aria-label="초대 코드 또는 공고명 검색">
            <input
              type="search"
              placeholder="초대 코드 또는 공고명 검색..."
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
          </label>

          <div className="candidate-discover-toolbar__filters" role="tablist" aria-label="공고 필터">
            {CANDIDATE_EXPLORE_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`candidate-discover-toolbar__filter${selectedFilter === filter.key ? ' candidate-discover-toolbar__filter--active' : ''}`}
                onClick={() => onFilterChange(filter.key)}
                aria-pressed={selectedFilter === filter.key}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="candidate-dashboard-panel candidate-discover-invite">
        <div className="candidate-discover-invite__copy">
          <h2>초대 링크나 코드로 바로 입장</h2>
          <p>기업이 발급한 코드를 입력하면 즉시 참여 가능합니다.</p>
        </div>

        <div className="candidate-discover-invite__action">
          <input value={inviteCode} onChange={(event) => onInviteCodeChange(event.target.value)} aria-label="초대 코드" />
          <button type="button">입장하기</button>
        </div>
      </section>

      {visibleSessions.length === 0 ? (
        <section className="candidate-dashboard-panel candidate-discover__empty">
          <strong>지금 바로 탐색할 공고가 없습니다.</strong>
          <p>실제 등록된 공고가 열리면 이곳에 표시됩니다. 아직 연결 전이라면 빈 상태로 유지됩니다.</p>
        </section>
      ) : (
        <section className="candidate-discover-grid" aria-label="탐색 가능한 세션 목록">
          {visibleSessions.map((session) => (
            <article key={session.id} className="candidate-dashboard-panel candidate-discover-card">
              <div className="candidate-discover-card__top">
                <div className="candidate-discover-card__badges">
                  <span className="candidate-discover-card__type">{session.typeLabel}</span>
                  <span className="candidate-discover-card__deadline">
                    {session.status === 'draft' ? '공개 전' : session.deadline}
                  </span>
                </div>
                <button
                  type="button"
                  className={`candidate-discover-card__favorite${
                    favoriteSessionIds.has(session.id) ? ' candidate-discover-card__favorite--active' : ''
                  }`}
                  aria-pressed={favoriteSessionIds.has(session.id)}
                  aria-label={favoriteSessionIds.has(session.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  onClick={() => onToggleFavorite(session.id)}
                  disabled={isSavingFavorites}
                >
                  ★
                </button>
              </div>

              <div className="candidate-discover-card__body">
                <h2>{session.title}</h2>
                <p className="candidate-discover-card__meta">
                  {session.organization} · {session.location} · {session.mode}
                </p>
                <p className="candidate-discover-card__summary">{session.description}</p>
              </div>

              <div className="candidate-discover-card__footer">
                <div className="candidate-discover-card__divider" />
                <span className="candidate-discover-card__label">평가 가중치</span>
                <div className="candidate-discover-card__weights">
                  {session.weights.map((weight) => (
                    <span key={`${session.id}-${weight}`} className="candidate-discover-card__weight">
                      {weight}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  className="candidate-discover-card__cta"
                  onClick={() => onOpenSession(session.id)}
                  disabled={session.status === 'draft'}
                >
                  {session.status === 'draft' ? '공개 전 공고' : '공고 자세히 보기'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}ㄴ
    </div>
  );
}

type CandidatePendingListViewProps = {
  sessions: CandidateExploreSession[];
  applications: CandidateSavedApplication[];
  onOpenApplication: (sessionId: string, preferredView: CandidateView) => void;
  onGoExplore: () => void;
};

function CandidatePendingListView({
  sessions,
  applications,
  onOpenApplication,
  onGoExplore,
}: CandidatePendingListViewProps) {
  return (
    <div className="candidate-pending-list">
      <section className="candidate-dashboard-panel candidate-pending-list__hero">
        <div>
          <h2>임시 저장 및 진행 중 공고</h2>
          <p>공고 탐색에서 확인한 세션은 이곳에서 이어서 작성하거나 제출 상태를 확인할 수 있습니다.</p>
        </div>
        <button type="button" className="candidate-pending-list__hero-action" onClick={onGoExplore}>
          공고 탐색으로 이동
        </button>
      </section>

      {applications.length === 0 ? (
        <section className="candidate-dashboard-panel candidate-pending-list__empty">
          <strong>아직 진행 중인 공고가 없습니다.</strong>
          <p>공고 탐색에서 세션을 확인한 뒤 포트폴리오를 임시 저장하거나 제출하면 이 목록에 나타납니다.</p>
          <button type="button" onClick={onGoExplore}>
            공고 탐색 보기
          </button>
        </section>
      ) : (
        <section className="candidate-pending-list__grid" aria-label="진행 중 공고 목록">
          {applications.map((application) => {
            const session = sessions.find((item) => item.id === application.sessionId);

            if (!session) {
              return null;
            }

            const isSubmitted = application.status === 'submitted';

            return (
              <article key={application.sessionId} className="candidate-dashboard-panel candidate-pending-list__card">
                <div className="candidate-pending-list__card-top">
                  <div>
                    <span className="candidate-pending-list__type">{session.typeLabel}</span>
                    <h3>{session.title}</h3>
                    <p>
                      {session.organization} · {session.location} · {session.mode}
                    </p>
                  </div>
                  <span
                    className={`candidate-pending-list__status${isSubmitted ? ' candidate-pending-list__status--submitted' : ''}`}
                  >
                    {isSubmitted ? '제출 완료' : '임시 저장'}
                  </span>
                </div>

                <div className="candidate-pending-list__meta">
                  <span>최근 저장 {application.updatedAtLabel}</span>
                  <span>{isSubmitted ? '최종 제출까지 완료됨' : '과정 진행 단계 작성 중'}</span>
                </div>

                <div className="candidate-pending-list__actions">
                  <button type="button" onClick={() => onOpenApplication(application.sessionId, 'pendingConfirm')}>
                    공고 확인
                  </button>
                  <button
                    type="button"
                    className="candidate-pending-list__primary"
                    onClick={() => onOpenApplication(application.sessionId, 'pendingUpload')}
                  >
                    {isSubmitted ? '내용 보기' : '이어서 작성'}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

type CandidatePipelineStepsProps = {
  stage: CandidatePipelineStage;
};

function CandidatePipelineSteps({ stage }: CandidatePipelineStepsProps) {
  return (
    <section className="candidate-dashboard-panel candidate-pipeline-steps" aria-label="지원 단계">
      <div className="candidate-pipeline-steps__inner">
        <div className="candidate-pipeline-steps__item">
          <span className="candidate-pipeline-steps__dot candidate-pipeline-steps__dot--complete">✓</span>
          <strong>공고 확인</strong>
        </div>
        <div className={`candidate-pipeline-steps__line${stage !== 'confirm' ? ' candidate-pipeline-steps__line--active' : ''}`} />
        <div className="candidate-pipeline-steps__item">
          <span className={`candidate-pipeline-steps__dot${stage !== 'confirm' ? ' candidate-pipeline-steps__dot--complete' : ''}`}>
            {stage !== 'confirm' ? '✓' : ''}
          </span>
          <strong className={stage === 'confirm' ? 'candidate-pipeline-steps__label--muted' : ''}>과정 진행</strong>
        </div>
        <div className={`candidate-pipeline-steps__line${stage === 'done' ? ' candidate-pipeline-steps__line--active' : ''}`} />
        <div className="candidate-pipeline-steps__item">
          <span className={`candidate-pipeline-steps__dot${stage === 'done' ? ' candidate-pipeline-steps__dot--complete' : ''}`}>
            {stage === 'done' ? '✓' : ''}
          </span>
          <strong className={stage !== 'done' ? 'candidate-pipeline-steps__label--muted' : ''}>제출 완료</strong>
        </div>
      </div>
    </section>
  );
}

type CandidatePendingConfirmViewProps = {
  session: CandidateExploreSession;
  draft: CandidateTaskDraft;
  status: CandidatePipelineStatus | null;
  eligibilityStatus: CandidateEligibilityStatus | null;
  eligibilityMessage: string | null;
  humanVerificationMessage: string | null;
  isPreparingHumanVerification: boolean;
  isVerifyingHumanVerification: boolean;
  isCheckingEligibility: boolean;
  isPreparingEligibilityVerification: boolean;
  onVerify: (field: 'humanVerified' | 'eligibilityVerified') => void;
  onContinue: () => void;
};

function CandidatePendingConfirmView({
  session,
  draft,
  status,
  eligibilityStatus,
  eligibilityMessage,
  humanVerificationMessage,
  isPreparingHumanVerification,
  isVerifyingHumanVerification,
  isCheckingEligibility,
  isPreparingEligibilityVerification,
  onVerify,
  onContinue,
}: CandidatePendingConfirmViewProps) {
  const isSubmitted = status === 'submitted';
  const canContinueToProcess = isSubmitted || draft.humanVerified;
  const isEligibilityFeaturePending = eligibilityStatus?.requiresDocumentCredential === true;
  const eligibilityDescription = eligibilityStatus?.requiresDocumentCredential
    ? '연령·국적 ZK 자격 인증을 준비하고 있습니다.'
    : eligibilityStatus?.reason ?? '이 공고는 별도 연령·국적 인증이 필요하지 않습니다.';
  const eligibilityTitle = isSubmitted
    ? '제출 완료'
    : draft.eligibilityVerified
    ? '지원 자격 인증 완료'
    : isEligibilityFeaturePending
      ? '준비 중'
      : 'World ID 인증 필요';
  const eligibilityButtonLabel = isSubmitted
    ? '변경 불가'
    : draft.eligibilityVerified
    ? '인증 완료'
    : isEligibilityFeaturePending
      ? '준비 중'
      : isCheckingEligibility || isPreparingEligibilityVerification
        ? '확인 중...'
        : '인증 시작 →';
  const nextEligibilityMessage = isSubmitted
    ? '제출이 완료된 공고는 인증 상태를 다시 변경할 수 없습니다.'
    : isEligibilityFeaturePending
    ? '연령·국적 ZK 자격 인증은 준비 중입니다.'
    : eligibilityMessage;

  return (
    <div className="candidate-pipeline">
      <CandidatePipelineSteps stage="confirm" />

      <div className="candidate-pipeline__grid candidate-pipeline__grid--confirm">
        <div className="candidate-pipeline__main">
          <section className="candidate-dashboard-panel candidate-pipeline-session">
            <div className="candidate-pipeline-session__header">
              <h2>{session.title}</h2>
              <span>{session.typeLabel}</span>
            </div>

            <div className="candidate-pipeline-session__layout">
              <div className="candidate-pipeline-session__copy">
                {session.detailLines.slice(1).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>

              <CandidateSessionFacts lines={session.eligibilityLines} />
            </div>
          </section>

          <section className="candidate-pipeline-checklist">
            <article className="candidate-dashboard-panel candidate-pipeline-checklist__section candidate-pipeline-checklist__section--tinted">
              <h3>인간 인증</h3>
              <div className="candidate-pipeline-checklist__card">
                <div className="candidate-pipeline-checklist__icon" aria-hidden="true">
                  <CandidateWorldMark alt="" />
                </div>
                <div className="candidate-pipeline-checklist__copy">
                  <strong>{isSubmitted ? '제출 완료' : draft.humanVerified ? 'World ID 인증 완료' : 'World ID 인증 필요'}</strong>
                  <p>
                    {isSubmitted
                      ? '제출이 완료된 공고는 본인 확인 상태를 다시 변경할 수 없습니다.'
                      : '지원 전에 지금 이 공고를 진행하는 사람이 본인인지 한 번 더 확인합니다.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onVerify('humanVerified')}
                  disabled={isSubmitted || isPreparingHumanVerification || isVerifyingHumanVerification}
                >
                  {isSubmitted
                    ? '변경 불가'
                    : draft.humanVerified
                    ? '인증 완료'
                    : isPreparingHumanVerification || isVerifyingHumanVerification
                      ? '확인 중...'
                      : '인증 시작 →'}
                </button>
              </div>
              {humanVerificationMessage ? (
                <p className="candidate-pipeline-checklist__message">{humanVerificationMessage}</p>
              ) : isSubmitted ? (
                <p className="candidate-pipeline-checklist__message">
                  제출이 완료된 공고는 인간 인증을 다시 진행하지 않습니다.
                </p>
              ) : null}
            </article>

            <article className="candidate-dashboard-panel candidate-pipeline-checklist__section">
              <h3>지원 자격 인증</h3>
              <div className="candidate-pipeline-checklist__card">
                <div className="candidate-pipeline-checklist__icon" aria-hidden="true">
                  <CandidateWorldMark alt="" />
                </div>
                <div className="candidate-pipeline-checklist__copy">
                  <strong>{eligibilityTitle}</strong>
                  <p>{eligibilityDescription}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onVerify('eligibilityVerified')}
                  disabled={
                    isSubmitted || isEligibilityFeaturePending || isCheckingEligibility || isPreparingEligibilityVerification
                  }
                >
                  {eligibilityButtonLabel}
                </button>
              </div>
              {nextEligibilityMessage ? (
                <p className="candidate-pipeline-checklist__message">{nextEligibilityMessage}</p>
              ) : null}
            </article>
          </section>
        </div>

        <aside className="candidate-pipeline__aside candidate-pipeline__aside--confirm">
          <section className="candidate-dashboard-panel candidate-pipeline-next">
            <strong>다음 단계: 과정 진행</strong>
            <p>
              기업이 지정한 과정들을 진행해 주세요. 제출한 응답은 AI 에이전트가 기술 역량,
              문제 해결 과정, 표현력 등을 평가하는 데 사용됩니다.
            </p>
            {!canContinueToProcess ? (
              <p className="candidate-pipeline-checklist__message">
                다음 단계로 이동하려면 먼저 World ID 인간 인증을 완료해주세요.
              </p>
            ) : null}
            <button type="button" onClick={onContinue} disabled={!canContinueToProcess}>
              {canContinueToProcess ? '자세히 보기 →' : 'World ID 인증 필요'}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}

type CandidatePendingUploadViewProps = {
  session: CandidateExploreSession;
  draft: CandidateTaskDraft;
  status: CandidatePipelineStatus | null;
  isSaving: boolean;
  onProcessValueChange: (processId: number, value: string) => void;
  onSelectFile: (processId: number) => void;
  onDropFile: (processId: number, file: File) => void;
  onRemoveFile: (processId: number) => void;
  onBackToConfirm: () => void;
  onSave: () => void;
  onSubmit: () => void;
};

function CandidatePendingUploadView({
  session,
  draft,
  status,
  isSaving,
  onProcessValueChange,
  onSelectFile,
  onDropFile,
  onRemoveFile,
  onBackToConfirm,
  onSave,
  onSubmit,
}: CandidatePendingUploadViewProps) {
  const stepStage = status === 'submitted' ? 'done' : 'upload';
  const isReadOnly = status === 'submitted';
  const [draggingProcessId, setDraggingProcessId] = useState<number | null>(null);
  const canSubmit = hasCompletedCandidateTaskFields(session, draft);
  const needsPreviousStepVerification = !draft.humanVerified || !draft.eligibilityVerified;

  return (
    <div className="candidate-pipeline">
      <CandidatePipelineSteps stage={stepStage} />

      <div className="candidate-pipeline__grid candidate-pipeline__grid--upload">
        <div className="candidate-pipeline__main">
          <section className="candidate-dashboard-panel candidate-pipeline-upload">
            <div className="candidate-pipeline-session__header">
              <h2>{session.title}</h2>
              <span>{session.typeLabel}</span>
            </div>

            {session.processes.map((process, index) => {
              const response = draft.processResponses.find((item) => item.processId === process.id) ?? {
                processId: process.id,
                value: '',
                file: null,
              };

              return (
                <section
                  key={process.id}
                  className={`candidate-pipeline-form${isReadOnly ? ' candidate-pipeline-form--readonly' : ''}`}
                >
                  <div className="candidate-pipeline-form__header">
                    <h3>
                      {index + 1}. {process.name}
                    </h3>
                    <span className="candidate-pipeline-form__badge">{getProcessSubmissionBadgeLabel(process)}</span>
                  </div>
                  <p>{process.content}</p>

                  {isLinkProcess(process) ? (
                    <label>
                      <span>제출 링크</span>
                      <input
                        type="url"
                        data-process-input="true"
                        data-process-id={process.id}
                        placeholder="https://..."
                        value={response.value}
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                        onChange={(event) => onProcessValueChange(process.id, event.target.value)}
                      />
                      {response.value.trim() && !isValidSubmissionLink(response.value) ? (
                        <small className="candidate-pipeline-form__hint candidate-pipeline-form__hint--error">
                          올바른 http:// 또는 https:// 링크를 입력해주세요.
                        </small>
                      ) : (
                        <small className="candidate-pipeline-form__hint">
                          GitHub, 노션, 배포 주소처럼 검토 가능한 링크를 남겨주세요.
                        </small>
                      )}
                    </label>
                  ) : null}

                  {isTextProcess(process) ? (
                    <label>
                      <span>응답 작성</span>
                      <textarea
                        data-process-input="true"
                        data-process-id={process.id}
                        placeholder="과정에 대한 답변을 작성해주세요."
                        value={response.value}
                        readOnly={isReadOnly}
                        disabled={isReadOnly}
                        onChange={(event) => onProcessValueChange(process.id, event.target.value)}
                      />
                      <small className="candidate-pipeline-form__hint">
                        에이전트가 바로 읽을 수 있도록 핵심 내용을 텍스트로 정리해주세요.
                      </small>
                    </label>
                  ) : null}

                  {isFileProcess(process) ? (
                    <>
                      {!isReadOnly ? (
                        <div
                          className={`candidate-pipeline-upload-dropzone${
                            draggingProcessId === process.id ? ' candidate-pipeline-upload-dropzone--active' : ''
                          }`}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            setDraggingProcessId(process.id);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (draggingProcessId !== process.id) {
                              setDraggingProcessId(process.id);
                            }
                          }}
                          onDragLeave={(event) => {
                            event.preventDefault();
                            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                              return;
                            }
                            setDraggingProcessId((current) => (current === process.id ? null : current));
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const droppedFile = event.dataTransfer.files?.[0];
                            setDraggingProcessId(null);

                            if (droppedFile) {
                              onDropFile(process.id, droppedFile);
                            }
                          }}
                        >
                          <span className="candidate-pipeline-upload-dropzone__icon">⬆</span>
                          <strong>텍스트 기반 PDF를 끌어다 놓거나 선택해 업로드하세요</strong>
                          <p>에이전트가 내용을 읽을 수 있도록 검색 가능한 PDF 형태의 문서를 올려주세요.</p>
                          <button type="button" onClick={() => onSelectFile(process.id)}>
                            파일 선택
                          </button>
                        </div>
                      ) : (
                        <small className="candidate-pipeline-form__hint">
                          제출이 완료되어 업로드한 PDF는 읽기 전용으로 표시됩니다.
                        </small>
                      )}

                      <div className="candidate-pipeline-upload-files">
                        <strong>업로드된 파일 ({response.file ? '1' : '0'})</strong>

                        {response.file ? (
                          <div className="candidate-pipeline-upload-file">
                            <span className="candidate-pipeline-upload-file__badge">FILE</span>
                            <span className="candidate-pipeline-upload-file__name">{response.file.name}</span>
                            <span className="candidate-pipeline-upload-file__size">{response.file.sizeLabel}</span>
                            <div className="candidate-pipeline-upload-file__progress">
                              <span style={{ width: `${response.file.uploadProgress}%` }} />
                            </div>
                            <span className="candidate-pipeline-upload-file__progress-label">
                              {response.file.uploadProgress}%
                            </span>
                            <button
                              type="button"
                              className="candidate-pipeline-upload-file__remove"
                              disabled={isReadOnly}
                              onClick={() => onRemoveFile(process.id)}
                            >
                              삭제
                            </button>
                          </div>
                        ) : (
                          <div className="candidate-pipeline-upload-files__empty">아직 업로드된 파일이 없습니다.</div>
                        )}
                      </div>
                    </>
                  ) : null}
                </section>
              );
            })}
          </section>
        </div>

        <aside className="candidate-pipeline__aside">
          <section className="candidate-dashboard-panel candidate-pipeline-actions">
            <span>
              {isReadOnly
                ? '제출이 완료된 공고는 내용 확인만 가능합니다.'
                : isSaving
                  ? '저장 중...'
                  : '지원 정보는 서버에 안전하게 저장됩니다.'}
            </span>
            {!isReadOnly && !canSubmit ? (
              <p className="candidate-pipeline-checklist__message">
                모든 필수 입력을 완료해야 제출 버튼이 활성화됩니다.
              </p>
            ) : null}
            {!isReadOnly && canSubmit && needsPreviousStepVerification ? (
              <p className="candidate-pipeline-checklist__message">
                제출 전 이전 단계에서 본인 인증과 지원 자격 인증 상태를 다시 확인해주세요.
              </p>
            ) : null}
            <div className="candidate-pipeline-actions__buttons">
              <button type="button" onClick={onBackToConfirm} disabled={isSaving}>
                이전 단계로
              </button>
              {!isReadOnly ? (
                <>
                  <button type="button" onClick={onSave} disabled={isSaving}>
                    {isSaving ? '저장 중...' : '임시 저장'}
                  </button>
                  <button
                    type="button"
                    className="candidate-pipeline-actions__submit"
                    onClick={onSubmit}
                    disabled={!canSubmit || isSaving}
                  >
                    {isSaving ? '제출 중...' : '제출하기 →'}
                  </button>
                </>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

type CandidateReportsViewProps = {
  reports: CandidateReport[];
  sessions: CandidateExploreSession[];
  searchQuery: string;
  selectedFilter: CandidateExploreFilterKey;
  onSearchQueryChange: (value: string) => void;
  onFilterChange: (value: CandidateExploreFilterKey) => void;
  onOpenReport: (reportId: string) => void;
};

function CandidateReportsView({
  reports,
  sessions,
  searchQuery,
  selectedFilter,
  onSearchQueryChange,
  onFilterChange,
  onOpenReport,
}: CandidateReportsViewProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleReports = reports.filter((report) => {
    const reportSession = sessions.find((session) => session.id === report.sessionId);
    const matchesQuery =
      !normalizedQuery ||
      [report.title, report.organization, report.typeLabel].some((value) => value.toLowerCase().includes(normalizedQuery));

    if (!reportSession) {
      return matchesQuery;
    }

    return matchesQuery && matchesExploreFilter(reportSession, selectedFilter, new Set());
  });

  return (
    <div className="candidate-reports">
      <section className="candidate-dashboard-panel candidate-discover-toolbar">
        <div className="candidate-discover-toolbar__row">
          <label className="candidate-discover-toolbar__search" aria-label="공고명 검색">
            <input
              type="search"
              placeholder="공고명 검색..."
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
            />
          </label>

          <div className="candidate-discover-toolbar__filters" role="tablist" aria-label="리포트 필터">
            {CANDIDATE_REPORT_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`candidate-discover-toolbar__filter${selectedFilter === filter.key ? ' candidate-discover-toolbar__filter--active' : ''}`}
                onClick={() => onFilterChange(filter.key)}
                aria-pressed={selectedFilter === filter.key}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {visibleReports.length === 0 ? (
        <section className="candidate-dashboard-panel candidate-reports__empty">
          <strong>조건에 맞는 리포트가 없습니다.</strong>
          <p>검색어나 필터를 조정하면 평가중이거나 완료된 리포트를 다시 확인할 수 있습니다.</p>
          <button
            type="button"
            onClick={() => {
              onSearchQueryChange('');
              onFilterChange('all');
            }}
          >
            전체 리포트 보기
          </button>
        </section>
      ) : (
        <section className="candidate-reports__grid" aria-label="내 리포트 목록">
          {visibleReports.map((report) => (
            <article key={report.id} className="candidate-dashboard-panel candidate-reports__card">
              <span className="candidate-reports__type">{report.typeLabel}</span>
              <h2>{report.title}</h2>
              <p>
                {report.organization} · {report.location} · {report.mode}
              </p>
              <p>
                {report.submittedAt} · {report.statusLabel}
              </p>
              <div className="candidate-reports__divider" />
              <span className="candidate-reports__weight-label">평가 가중치</span>
              <div className="candidate-reports__weights">
                {report.weights.map((weight) => (
                  <span key={`${report.id}-${weight}`}>{weight}</span>
                ))}
              </div>
              <button type="button" onClick={() => onOpenReport(report.id)}>
                내 리포트 보기
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

type CandidateReportDetailViewProps = {
  report: CandidateReport;
};

function CandidateReportDetailView({ report }: CandidateReportDetailViewProps) {
  const isProcessing = report.status === 'processing';
  const radarAxes = ['Tech', 'Comm', 'Creat', 'Int', 'Reason'];
  const radarScores = [
    report.agentScores[0]?.score ?? 0,
    report.agentScores[2]?.score ?? 0,
    report.agentScores[3]?.score ?? 0,
    report.agentScores[4]?.score ?? 0,
    report.agentScores[1]?.score ?? 0,
  ];
  const center = 130;
  const radii = [32, 65, 97, 130];
  const points = radarScores
    .map((score, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / radarScores.length;
      const radius = (score / 100) * 108;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;

      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="candidate-report-detail">
      <section className="candidate-dashboard-panel candidate-report-detail__hero">
        <div className="candidate-report-detail__hero-main">
          <span className="candidate-report-detail__type">{report.typeLabel}</span>
          <h2>{report.title}</h2>
          <p>
            {report.organization} · {report.submittedAt} · {report.statusLabel}
          </p>
          <div className="candidate-report-detail__actions">
            <button
              type="button"
              className="candidate-report-detail__action candidate-report-detail__action--primary"
              disabled={isProcessing}
            >
              PDF 저장
            </button>
            <button type="button" className="candidate-report-detail__action" disabled={isProcessing}>
              공유 링크
            </button>
          </div>
        </div>

        <div className="candidate-report-detail__score-card">
          <span>{isProcessing ? '평가 상태' : '종합 점수'}</span>
          <strong>{isProcessing ? '평가중' : report.overallScore.toFixed(1)}</strong>
          <p>{report.percentileLabel}</p>
        </div>
      </section>

      <section className="candidate-report-detail__top-grid">
        <article className="candidate-dashboard-panel candidate-report-detail__agents">
          <h3>에이전트별 점수</h3>
          <p>
            {isProcessing
              ? '제출 직후 자동 평가가 시작되었습니다. 점수와 분석은 완료되는 즉시 이 화면에 채워집니다.'
              : '각 에이전트는 서로의 결과를 모른 채 독립 평가했습니다.'}
          </p>

          <div className="candidate-report-detail__agent-list">
            {isProcessing ? (
              <div className="candidate-report-detail__insight candidate-report-detail__insight--positive">
                <strong>…</strong>
                <span>평가가 끝나면 에이전트별 점수와 코멘트가 여기에 표시됩니다.</span>
              </div>
            ) : (
              report.agentScores.map((item) => (
                <div key={item.label} className="candidate-report-detail__agent-row">
                  <div className="candidate-report-detail__agent-copy">
                    <strong>{item.label}</strong>
                    <span>{item.weightLabel}</span>
                  </div>
                  <div className="candidate-report-detail__agent-bar">
                    <span style={{ width: `${item.score}%` }} />
                  </div>
                  <strong className="candidate-report-detail__agent-score">{item.score}</strong>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="candidate-dashboard-panel candidate-report-detail__radar">
          <h3>역량 레이더</h3>
          <div className="candidate-report-detail__radar-visual">
            <svg viewBox="0 0 260 260" aria-hidden="true">
              {radii.map((radius) => (
                <circle key={radius} cx={center} cy={center} r={radius} fill="none" stroke="#edf0f4" />
              ))}
              {radarAxes.map((axis, index) => {
                const angle = -Math.PI / 2 + (Math.PI * 2 * index) / radarAxes.length;
                const endX = center + Math.cos(angle) * 130;
                const endY = center + Math.sin(angle) * 130;

                return <line key={axis} x1={center} y1={center} x2={endX} y2={endY} stroke="#edf0f4" />;
              })}
              <polygon points={points} fill="rgba(13, 15, 25, 0.08)" stroke="#0d0f19" strokeWidth="1.5" />
            </svg>
            {radarAxes.map((axis, index) => (
              <span key={axis} className={`candidate-report-detail__radar-label candidate-report-detail__radar-label--${index}`}>
                {axis}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="candidate-report-detail__bottom-grid">
        <article className="candidate-dashboard-panel candidate-report-detail__insights">
          <h3>강점 분석</h3>
          <div className="candidate-report-detail__insight-list">
            {isProcessing ? (
              <div className="candidate-report-detail__insight candidate-report-detail__insight--positive">
                <strong>…</strong>
                <span>강점 분석을 생성하는 중입니다.</span>
              </div>
            ) : (
              report.strengths.map((item) => (
                <div key={item} className="candidate-report-detail__insight candidate-report-detail__insight--positive">
                  <strong>✓</strong>
                  <span>{item}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="candidate-dashboard-panel candidate-report-detail__insights">
          <h3>개선 방향</h3>
          <div className="candidate-report-detail__insight-list">
            {isProcessing ? (
              <div className="candidate-report-detail__insight candidate-report-detail__insight--negative">
                <strong>…</strong>
                <div>
                  <span>개선 방향을 생성하는 중입니다.</span>
                  <p>평가 완료 후 구체적인 피드백이 여기에 표시됩니다.</p>
                </div>
              </div>
            ) : (
              report.improvements.map((item) => (
                <div key={item.title} className="candidate-report-detail__insight candidate-report-detail__insight--negative">
                  <strong>✎</strong>
                  <div>
                    <span>{item.title}</span>
                    <p>{item.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

type CandidateMatchingHistoryViewProps = {
  records: CandidateMatchRecord[];
  searchQuery: string;
  selectedFilter: CandidateMatchingFilterKey;
  onSearchQueryChange: (value: string) => void;
  onFilterChange: (value: CandidateMatchingFilterKey) => void;
  onOpenDetail: (recordId: string) => void;
};

function CandidateMatchingHistoryView({
  records,
  searchQuery,
  selectedFilter,
  onSearchQueryChange,
  onFilterChange,
  onOpenDetail,
}: CandidateMatchingHistoryViewProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleRecords = records.filter((record) => {
    const matchesQuery =
      !normalizedQuery ||
      [record.company, record.sessionTitle, record.requestedAt].some((value) => value.toLowerCase().includes(normalizedQuery));

    return matchesQuery && matchesHistoryFilter(record, selectedFilter);
  });
  const acceptedCount = records.filter((record) => record.status === 'accepted').length;
  const rejectedCount = records.filter((record) => record.status === 'rejected').length;
  const pendingCount = records.filter((record) => record.status === 'pending').length;

  return (
    <div className="candidate-matching-history">
      <section className="candidate-matching-history__stats">
        <article className="candidate-dashboard-panel candidate-matching-history__stat-card">
          <span>선발 요청</span>
          <strong>{records.length}</strong>
          <em className="candidate-matching-history__delta candidate-matching-history__delta--dark">전체 요청 수</em>
        </article>
        <article className="candidate-dashboard-panel candidate-matching-history__stat-card">
          <span>동의</span>
          <strong>{acceptedCount}</strong>
          <em className="candidate-matching-history__delta candidate-matching-history__delta--green">공개 진행 중</em>
        </article>
        <article className="candidate-dashboard-panel candidate-matching-history__stat-card">
          <span>거절</span>
          <strong>{rejectedCount}</strong>
          <em className="candidate-matching-history__delta candidate-matching-history__delta--gray">정보 비공개</em>
        </article>
        <article className="candidate-dashboard-panel candidate-matching-history__stat-card">
          <span>대기</span>
          <strong>{pendingCount}</strong>
          <em className="candidate-matching-history__delta candidate-matching-history__delta--yellow">응답 대기 중</em>
        </article>
      </section>

      <section className="candidate-dashboard-panel candidate-matching-history__toolbar">
        <div className="candidate-matching-history__filters" role="tablist" aria-label="매칭 상태 필터">
          {CANDIDATE_MATCHING_FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className={`candidate-matching-history__filter${selectedFilter === filter.key ? ' candidate-matching-history__filter--active' : ''}`}
              onClick={() => onFilterChange(filter.key)}
              aria-pressed={selectedFilter === filter.key}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <label className="candidate-matching-history__search" aria-label="기업명 또는 공고 검색">
          <input
            type="search"
            placeholder="기업명 / 공고 검색"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
          />
        </label>
      </section>

      <section className="candidate-dashboard-panel candidate-matching-history__table-wrap">
        {visibleRecords.length === 0 ? (
          <div className="candidate-matching-history__empty">
            <strong>조건에 맞는 매칭 이력이 없습니다.</strong>
            <p>검색어나 상태 필터를 조정하면 요청 내역을 다시 확인할 수 있습니다.</p>
          </div>
        ) : (
          <table className="candidate-matching-history__table">
            <thead>
              <tr>
                <th scope="col">기업</th>
                <th scope="col">세션</th>
                <th scope="col">수신 일시</th>
                <th scope="col">상태</th>
                <th scope="col">공개된 정보</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div className="candidate-matching-history__company">
                      <span aria-hidden="true" />
                      <strong>{record.company}</strong>
                    </div>
                  </td>
                  <td>{record.sessionTitle}</td>
                  <td>{record.requestedAt}</td>
                  <td>
                    <span
                      className={`candidate-matching-history__status candidate-matching-history__status--${record.status}`}
                    >
                      {getMatchStatusLabel(record.status)}
                    </span>
                  </td>
                  <td>{getMatchSharedSummary(record)}</td>
                  <td>
                    <button type="button" className="candidate-matching-history__detail" onClick={() => onOpenDetail(record.id)}>
                      상세 →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

type CandidateMatchingDetailModalProps = {
  record: CandidateMatchRecord;
  isSubmitting: boolean;
  onClose: () => void;
  onToggleField: (recordId: string, fieldKey: string) => void;
  onDecide: (recordId: string, status: CandidateMatchingStatus) => void | Promise<void>;
};

function CandidateMatchingDetailModal({
  record,
  isSubmitting,
  onClose,
  onToggleField,
  onDecide,
}: CandidateMatchingDetailModalProps) {
  const isDecisionLocked = isSubmitting || record.status !== 'pending';

  return (
    <div className="candidate-matching-modal" role="dialog" aria-modal="true" aria-labelledby="candidate-matching-title">
      <div className="candidate-matching-modal__backdrop" onClick={onClose} />
      <div className="candidate-matching-modal__panel">
        <button type="button" className="candidate-matching-modal__close" onClick={onClose} aria-label="닫기" disabled={isSubmitting}>
          ×
        </button>

        <h2 id="candidate-matching-title">{record.company}이 회원님을 선택했습니다</h2>
        <span className="candidate-matching-modal__pill">{record.requestTypeLabel}</span>

        <div className="candidate-matching-modal__divider" />

        <section className="candidate-matching-modal__section">
          <h3>기업이 요청한 정보</h3>
          <p>동의 시 아래 정보가 기업 또는 주최자에게 전달됩니다. 필수 요청 항목은 모두 동의해야 합니다.</p>

          <div className="candidate-matching-modal__fields">
            {record.infoFields.map((field) => (
              <label key={field.key} className="candidate-matching-modal__field">
                <input
                  type="checkbox"
                  checked={field.shared}
                  onChange={() => onToggleField(record.id, field.key)}
                  disabled={isDecisionLocked}
                />
                <span className="candidate-matching-modal__checkbox" aria-hidden="true">
                  {field.shared ? '✓' : ''}
                </span>
                <strong>
                  {field.label}
                  {field.required ? <em className="candidate-matching-modal__required">필수</em> : null}
                </strong>
                <span>{field.value}</span>
                <em>{field.shared ? '공개' : '비공개'}</em>
              </label>
            ))}
          </div>
        </section>

        <div className="candidate-matching-modal__notice">
          거절하면 기업에는 동의 거절 상태만 전달되며, 공고 내 평가 점수는 공개되지 않습니다.
        </div>

        <div className="candidate-matching-modal__actions">
          <button type="button" onClick={() => onDecide(record.id, 'rejected')} disabled={isDecisionLocked}>
            거절
          </button>
          <button
            type="button"
            className="candidate-matching-modal__primary"
            onClick={() => onDecide(record.id, 'accepted')}
            disabled={isDecisionLocked}
          >
            {isSubmitting ? '전달 중...' : '동의하고 공개'}
          </button>
        </div>
      </div>
    </div>
  );
}

type CandidateSettingsUnlockViewProps = {
  isUnlocking: boolean;
  onUnlock: () => void;
};

function CandidateSettingsUnlockView({ isUnlocking, onUnlock }: CandidateSettingsUnlockViewProps) {
  return (
    <div className="candidate-settings-unlock">
      <section className="candidate-dashboard-panel candidate-settings-unlock__hero">
        <div className="candidate-settings-unlock__hero-icon" aria-hidden="true">
          <CandidateWorldMark alt="" />
        </div>
        <div className="candidate-settings-unlock__hero-copy">
          <h2>설정 접근 전 World ID 인증이 필요합니다.</h2>
          <p>민감한 프로필 정보를 안전하게 보호하기 위해, 설정 진입 시 한 번 더 본인 확인을 진행합니다.</p>
          <div className="candidate-settings-unlock__chips">
            <span>안전한 정보 보호</span>
            <span>인증 후 열람</span>
            <span>동의 전 비공개</span>
          </div>
        </div>
      </section>

      <section className="candidate-settings-unlock__layout">
        <article className="candidate-dashboard-panel candidate-settings-unlock__card">
          <h3>World ID로 보호된 정보 열기</h3>
          <p>인증이 완료되면 기본 정보, 학력/경력, 공개 범위 기본값을 안전하게 조회하고 수정할 수 있습니다.</p>

          <ol className="candidate-settings-unlock__steps">
            <li>World ID로 본인 여부 확인</li>
            <li>이번 세션에서만 정보 열기</li>
            <li>설정 화면 즉시 열기</li>
          </ol>

          <button type="button" className="candidate-settings-unlock__primary" onClick={onUnlock} disabled={isUnlocking}>
            {isUnlocking ? 'World ID 확인 중...' : 'World ID로 계속하기'}
          </button>
        </article>

        <aside className="candidate-dashboard-panel candidate-settings-unlock__aside">
          <h3>왜 다시 인증하나요?</h3>
          <ul>
            <li>설정에는 연락처, 학력, 경력처럼 민감한 정보가 포함됩니다.</li>
            <li>매칭 동의 전까지 기업에는 어떤 정보도 공개되지 않습니다.</li>
            <li>세션이 끝나면 다시 인증 전 상태로 돌아갑니다.</li>
          </ul>
        </aside>
      </section>
    </div>
  );
}

type CandidateSettingsViewProps = {
  form: CandidateSettingsForm;
  lastUnlockedLabel: string;
  isSaving: boolean;
  onFieldChange: (field: keyof Omit<CandidateSettingsForm, 'attachments' | 'shareDefaults'>, value: string) => void;
  onToggleShareDefault: (key: CandidateSettingsShareKey) => void;
  onSave: () => void;
  onReset: () => void;
};

function CandidateSettingsView({
  form,
  lastUnlockedLabel,
  isSaving,
  onFieldChange,
  onToggleShareDefault,
  onSave,
  onReset,
}: CandidateSettingsViewProps) {
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const shareRows: Array<{ key: CandidateSettingsShareKey; label: string; hint: string }> = [
    { key: 'name', label: '이름', hint: '기본 공개' },
    { key: 'email', label: '이메일', hint: '기본 공개' },
    { key: 'phone', label: '연락처', hint: '기본 공개' },
    { key: 'education', label: '학력', hint: '기본 공개' },
    { key: 'career', label: '경력', hint: '기본 공개' },
    { key: 'resume', label: '이력서', hint: '선택 공개' },
  ];

  return (
    <div className="candidate-settings">
      <section className="candidate-dashboard-panel candidate-settings__hero">
        <div className="candidate-settings__hero-icon" aria-hidden="true">
          <CandidateWorldMark alt="" />
        </div>
        <div className="candidate-settings__hero-copy">
          <h2>매칭 동의 전까지 기업에 공개되지 않는 안전 저장소입니다.</h2>
          <p>입력한 정보는 안전하게 보호되며, 내가 명시적으로 동의한 기업에게만 공개됩니다.</p>
          <div className="candidate-settings__hero-badges">
            <span>암호화 저장</span>
            <span>동의 후 공개</span>
            <span>{lastUnlockedLabel}</span>
          </div>
        </div>
      </section>

      <section className="candidate-settings__layout">
        <div className="candidate-dashboard-panel candidate-settings__main">
          <div className="candidate-settings__section-header">
            <h3>기본 정보</h3>
            <p>매칭 동의 후 해당 기업에만 공유됩니다.</p>
          </div>

          <div className="candidate-settings__grid candidate-settings__grid--two">
            <label className="candidate-settings__field">
              <span>이름</span>
              <input value={form.name} onChange={(event) => onFieldChange('name', event.target.value)} />
            </label>
            <label className="candidate-settings__field">
              <span>생년월일</span>
              <input value={form.birthDate} onChange={(event) => onFieldChange('birthDate', event.target.value)} />
            </label>
            <label className="candidate-settings__field">
              <span>이메일</span>
              <input value={form.email} onChange={(event) => onFieldChange('email', event.target.value)} />
            </label>
            <label className="candidate-settings__field">
              <span>연락처</span>
              <input value={form.phone} onChange={(event) => onFieldChange('phone', event.target.value)} />
            </label>
          </div>

          <div className="candidate-settings__divider" />

          <div className="candidate-settings__section-header candidate-settings__section-header--compact">
            <h3>시스템 설정</h3>
          </div>

          <div className="candidate-settings__grid">
            <div className="candidate-settings__field candidate-settings__field--full company-settings-language">
              <span>언어 설정</span>
              <div
                className={`company-settings-language__control${isLanguageDropdownOpen ? ' company-settings-language__control--open' : ''}`}
              >
                <button
                  type="button"
                  className="company-settings-language__trigger"
                  aria-haspopup="listbox"
                  aria-expanded={isLanguageDropdownOpen}
                  onClick={() => setIsLanguageDropdownOpen((current) => !current)}
                >
                  <span className="company-settings-language__value">{form.language || '언어 미설정'}</span>
                  <span
                    className={`company-settings-language__chevron${isLanguageDropdownOpen ? ' company-settings-language__chevron--open' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                {isLanguageDropdownOpen ? (
                  <div
                    className="company-settings-language__dropdown"
                    role="listbox"
                    aria-label="언어 설정 목록"
                  >
                    {candidateSettingsLanguageOptions
                      .filter((option) => option !== form.language)
                      .map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="option"
                          aria-selected={false}
                          className="company-settings-language__option"
                          onClick={() => {
                            onFieldChange('language', option);
                            setIsLanguageDropdownOpen(false);
                          }}
                        >
                          {option}
                        </button>
                      ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="candidate-settings__divider" />

          <div className="candidate-settings__section-header candidate-settings__section-header--compact">
            <h3>학력 · 경력</h3>
          </div>

          <div className="candidate-settings__grid">
            <label className="candidate-settings__field candidate-settings__field--full">
              <span>최종 학력</span>
              <input value={form.education} onChange={(event) => onFieldChange('education', event.target.value)} />
            </label>
            <label className="candidate-settings__field candidate-settings__field--full">
              <span>현재 소속</span>
              <input value={form.affiliation} onChange={(event) => onFieldChange('affiliation', event.target.value)} />
            </label>
            <label className="candidate-settings__field">
              <span>경력 연수</span>
              <input value={form.careerYears} onChange={(event) => onFieldChange('careerYears', event.target.value)} />
            </label>
            <label className="candidate-settings__field">
              <span>원하는 고용 형태</span>
              <input
                value={form.employmentType}
                onChange={(event) => onFieldChange('employmentType', event.target.value)}
              />
            </label>
          </div>

          <div className="candidate-settings__divider" />

          <div className="candidate-settings__section-header candidate-settings__section-header--compact">
            <h3>첨부 파일 (선택)</h3>
          </div>

          <div className="candidate-settings__attachments">
            {form.attachments.map((attachment) => (
              <article key={attachment.id} className="candidate-settings__attachment">
                <strong>📎 {attachment.label}</strong>
                {attachment.fileName ? (
                  <span>
                    {attachment.fileName}
                    {attachment.sizeLabel ? ` · ${attachment.sizeLabel}` : ''}
                  </span>
                ) : (
                  <span>{attachment.emptyLabel ?? '+ 파일 선택'}</span>
                )}
              </article>
            ))}
          </div>
        </div>

        <div className="candidate-settings__side">
          <aside className="candidate-dashboard-panel candidate-settings__side-card">
            <div className="candidate-settings__section-header candidate-settings__section-header--compact">
              <h3>공개 범위 기본값</h3>
              <p>매칭 동의 시 어떤 항목을 공유할지 미리 지정</p>
            </div>

            <div className="candidate-settings__toggles">
              {shareRows.map((item) => (
                <label key={item.key} className="candidate-settings__toggle-row">
                  <button
                    type="button"
                    className={`candidate-settings__toggle${form.shareDefaults[item.key] ? ' candidate-settings__toggle--active' : ''}`}
                    onClick={() => onToggleShareDefault(item.key)}
                    aria-pressed={form.shareDefaults[item.key]}
                  >
                    <span />
                  </button>
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </label>
              ))}
            </div>
          </aside>

          <aside className="candidate-dashboard-panel candidate-settings__side-card">
            <div className="candidate-settings__section-header candidate-settings__section-header--compact">
              <h3>🔐 정보 보호 상태</h3>
            </div>

            <ul className="candidate-settings__security-list">
              <li>✓ 안전하게 보호되어 저장됨</li>
              <li>✓ 인증 후에만 열람 가능</li>
              <li>✓ 세션 종료 시 자동 잠금</li>
            </ul>
          </aside>

          <aside className="candidate-dashboard-panel candidate-settings__actions">
            <button type="button" className="candidate-settings__secondary" onClick={onReset}>
              저장 없이 나가기
            </button>
            <button type="button" className="candidate-settings__primary" onClick={onSave} disabled={isSaving}>
              {isSaving ? '저장 중...' : '안전하게 저장'}
            </button>
          </aside>
        </div>
      </section>
    </div>
  );
}

/**
 * Candidate portal shell shown after authentication.
 */
export default function CandidateDashboard({ user, onLogout }: CandidateDashboardProps) {
  const initialSettingsForm = createInitialCandidateSettingsForm(user);
  const [activeView, setActiveView] = useState<CandidateView>('home');
  const [exploreSearchQuery, setExploreSearchQuery] = useState('');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [matchingSearchQuery, setMatchingSearchQuery] = useState('');
  const [selectedExploreFilter, setSelectedExploreFilter] = useState<CandidateExploreFilterKey>('all');
  const [selectedReportFilter, setSelectedReportFilter] = useState<CandidateExploreFilterKey>('all');
  const [selectedMatchingFilter, setSelectedMatchingFilter] = useState<CandidateMatchingFilterKey>('all');
  const [inviteCode, setInviteCode] = useState('');
  const [portalUser, setPortalUser] = useState<CandidateSessionUser>(user);
  const [exploreSessions, setExploreSessions] = useState<CandidateExploreSession[]>([]);
  const [favoriteSessionIds, setFavoriteSessionIds] = useState<string[]>([]);
  const [reports, setReports] = useState<CandidateReport[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string>('');
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<CandidateTaskDraft>(createEmptyTaskDraft());
  const taskDraftRef = useRef<CandidateTaskDraft>(createEmptyTaskDraft());
  const [savedApplications, setSavedApplications] = useState<CandidateSavedApplication[]>([]);
  const [matchHistory, setMatchHistory] = useState<CandidateMatchRecord[]>([]);
  const [settingsForm, setSettingsForm] = useState<CandidateSettingsForm>(initialSettingsForm);
  const [savedSettingsForm, setSavedSettingsForm] = useState<CandidateSettingsForm>(initialSettingsForm);
  const [isSettingsWorldVerified, setIsSettingsWorldVerified] = useState(false);
  const [isSettingsWorldVerifying, setIsSettingsWorldVerifying] = useState(false);
  const [settingsUnlockLabel, setSettingsUnlockLabel] = useState('잠금 상태');
  const [worldIdConfig, setWorldIdConfig] = useState<WorldIdConfig | null>(null);
  const [eligibilityStatus, setEligibilityStatus] = useState<CandidateEligibilityStatus | null>(null);
  const [eligibilityMessage, setEligibilityMessage] = useState<string | null>(null);
  const [eligibilityWorldIdRequest, setEligibilityWorldIdRequest] = useState<WorldIdRpSignature | null>(null);
  const [eligibilityWorldIdOpen, setEligibilityWorldIdOpen] = useState(false);
  const [settingsWorldIdRequest, setSettingsWorldIdRequest] = useState<WorldIdRpSignature | null>(null);
  const [settingsWorldIdOpen, setSettingsWorldIdOpen] = useState(false);
  const [humanWorldIdRequest, setHumanWorldIdRequest] = useState<WorldIdRpSignature | null>(null);
  const [humanWorldIdOpen, setHumanWorldIdOpen] = useState(false);
  const [matchConsentWorldIdRequest, setMatchConsentWorldIdRequest] = useState<WorldIdRpSignature | null>(null);
  const [matchConsentWorldIdOpen, setMatchConsentWorldIdOpen] = useState(false);
  const [activeEligibilityJobId, setActiveEligibilityJobId] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalToastId, setPortalToastId] = useState(0);
  const [portalToastMessage, setPortalToastMessage] = useState<string | null>(null);
  const [humanVerificationMessage, setHumanVerificationMessage] = useState<string | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [isPreparingHumanVerification, setIsPreparingHumanVerification] = useState(false);
  const [isVerifyingHumanVerification, setIsVerifyingHumanVerification] = useState(false);
  const [isPreparingMatchConsentVerification, setIsPreparingMatchConsentVerification] = useState(false);
  const [isVerifyingMatchConsentVerification, setIsVerifyingMatchConsentVerification] = useState(false);
  const [isPreparingEligibilityVerification, setIsPreparingEligibilityVerification] = useState(false);
  const [isVerifyingEligibilityVerification, setIsVerifyingEligibilityVerification] = useState(false);
  const [isPreparingSettingsVerification, setIsPreparingSettingsVerification] = useState(false);
  const [isSavingApplication, setIsSavingApplication] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingFavorites, setIsSavingFavorites] = useState(false);
  const [isRespondingToMatchRequest, setIsRespondingToMatchRequest] = useState(false);
  const [pendingMatchDecision, setPendingMatchDecision] = useState<{
    recordId: string;
    status: CandidateMatchingStatus;
  } | null>(null);
  const [activeFileProcessId, setActiveFileProcessId] = useState<number | null>(null);
  const [processUploadFiles, setProcessUploadFiles] = useState<Record<number, File>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const favoriteSessionIdSet = new Set(favoriteSessionIds);

  const updateTaskDraft = (updater: CandidateTaskDraftUpdater) => {
    const nextDraft =
      typeof updater === 'function'
        ? (updater as (current: CandidateTaskDraft) => CandidateTaskDraft)(taskDraftRef.current)
        : updater;

    taskDraftRef.current = nextDraft;
    setTaskDraft(nextDraft);
    return nextDraft;
  };

  const currentSession = currentSessionId
    ? exploreSessions.find((session) => session.id === currentSessionId) ?? null
    : null;
  const currentApplication = currentSessionId
    ? savedApplications.find((application) => application.sessionId === currentSessionId) ?? null
    : null;
  const currentReport = reports.find((report) => report.id === currentReportId) ?? reports[0] ?? null;
  const currentMatch = currentMatchId ? matchHistory.find((record) => record.id === currentMatchId) ?? null : null;
  const favoriteSessions = exploreSessions.filter((session) => favoriteSessionIdSet.has(session.id));

  const applyPortalBootstrap = (
    bootstrap: CandidatePortalBootstrap,
    options: {
      preservePortalUser?: boolean;
      nextSessionId?: string | null;
      preferredView?: CandidateView | null;
    } = {},
  ) => {
    setExploreSessions(bootstrap.explore.sessions);
    setFavoriteSessionIds(bootstrap.explore.favoriteSessionIds);

    const nextApplications = bootstrap.applications.map((application) => ({
      sessionId: application.sessionId,
      status: application.status,
      humanVerified: application.humanVerified,
      eligibilityVerified: application.eligibilityVerified,
      processResponses: application.processResponses,
      githubUrl: application.githubUrl,
      portfolioFile: application.portfolioFile,
      updatedAtLabel: application.updatedAtLabel,
    }));

    setSavedApplications(nextApplications);
    setReports(bootstrap.dashboard.reports);
    setMatchHistory(bootstrap.dashboard.matching);
    setSettingsForm(bootstrap.settings.form);
    setSavedSettingsForm(bootstrap.settings.form);

    if (!options.preservePortalUser) {
      setPortalUser(user);
    }

    if (bootstrap.dashboard.reports[0]) {
      setCurrentReportId((current) =>
        bootstrap.dashboard.reports.some((report) => report.id === current)
          ? current
          : bootstrap.dashboard.reports[0].id,
      );
    }

    if (options.nextSessionId) {
      const nextSession = bootstrap.explore.sessions.find((session) => session.id === options.nextSessionId) ?? null;
      const nextApplication =
        nextApplications.find((application) => application.sessionId === options.nextSessionId) ?? null;

      currentSessionRef.current = options.nextSessionId;
      setCurrentSessionId(options.nextSessionId);
      updateTaskDraft(
        nextApplication
          ? createTaskDraftFromApplication(nextApplication, nextSession?.processes ?? [])
          : createEmptyTaskDraft(nextSession?.processes ?? []),
      );
      setProcessUploadFiles({});

      if (options.preferredView) {
        setActiveView(options.preferredView);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchWorldIdConfig()
      .then((config) => {
        if (!cancelled) {
          setWorldIdConfig(config);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorldIdConfig({
            enabled: false,
            appId: null,
            action: 'candidate-signup',
            environment: 'staging',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPortal = async () => {
      try {
        setIsBootstrapping(true);
        setPortalError(null);
        const bootstrap = await fetchCandidatePortalBootstrap();

        if (cancelled) {
          return;
        }

        applyPortalBootstrap(bootstrap);
      } catch (error) {
        if (!cancelled) {
          setPortalError(
            error instanceof Error ? error.message : '지원자 포털 데이터를 불러오는 중 오류가 발생했습니다.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void loadPortal();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (portalToastId === 0 || !portalToastMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPortalToastMessage(null);
    }, 2200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [portalToastId, portalToastMessage]);

  const pageTitle =
    activeView === 'home'
      ? '홈 대시보드'
      : activeView === 'explore'
        ? '공고 탐색'
        : activeView === 'reports' || activeView === 'reportDetail'
          ? '내 리포트'
          : activeView === 'matchingHistory'
            ? '매칭 이력'
            : activeView === 'settings'
              ? '설정'
              : '진행 중 공고';

  const openReportDetail = (reportId: string) => {
    setCurrentReportId(reportId);
    setActiveView('reportDetail');
  };

  const openMatchingDetail = (recordId: string) => {
    setCurrentMatchId(recordId);
    setActiveView('matchingHistory');
  };

  const pushPortalToast = (message: string) => {
    setPortalToastMessage(message);
    setPortalToastId((current) => current + 1);
  };

  const submitMatchDecision = async (recordId: string, status: CandidateMatchingStatus) => {
    const targetRecord = matchHistory.find((record) => record.id === recordId);

    if (!targetRecord || targetRecord.status !== 'pending') {
      return;
    }

    try {
      setIsRespondingToMatchRequest(true);
      setPortalError(null);
      const response = await respondToCandidateMatchRequest({
        matchId: recordId,
        status,
        infoFields: targetRecord.infoFields,
      });
      setMatchHistory((current) => current.map((record) => (record.id === recordId ? response.record : record)));
      setCurrentMatchId(null);
      setPendingMatchDecision(null);
      pushPortalToast(response.message);
    } catch (error) {
      if (error instanceof Error && error.message === '이미 응답이 완료된 매칭 요청입니다.') {
        try {
          const bootstrap = await fetchCandidatePortalBootstrap();
          setMatchHistory(bootstrap.dashboard.matching);
        } catch {
          // Keep the current local state if refresh fails.
        }

        setCurrentMatchId(null);
        setPendingMatchDecision(null);
        return;
      }

      setPortalError(
        error instanceof Error ? error.message : '매칭 요청 응답 처리 중 오류가 발생했습니다.',
      );
      throw error;
    } finally {
      setIsRespondingToMatchRequest(false);
    }
  };

  const syncEligibilityStatus = async (sessionId: string) => {
    try {
      setIsCheckingEligibility(true);
      const result = await fetchCandidateJobEligibility(sessionId);

      if (currentSessionRef.current !== sessionId) {
        return result;
      }

      setEligibilityStatus(result);
      setEligibilityMessage(result.reason);
      updateTaskDraft((current) => ({
        ...current,
        eligibilityVerified: result.isEligible,
      }));

      return result;
    } catch (error) {
      if (currentSessionRef.current === sessionId) {
        setEligibilityMessage(
          error instanceof Error ? error.message : '지원 자격 상태를 확인하는 중 오류가 발생했습니다.',
        );
      }
      return null;
    } finally {
      if (currentSessionRef.current === sessionId) {
        setIsCheckingEligibility(false);
      }
    }
  };

  const openSessionFromExplore = (sessionId: string) => {
    setEligibilityStatus(null);
    setEligibilityMessage(null);
    setHumanVerificationMessage(null);
    void (async () => {
      try {
        setPortalError(null);
        const bootstrap = await fetchCandidatePortalBootstrap();
        applyPortalBootstrap(bootstrap, {
          preservePortalUser: true,
          nextSessionId: sessionId,
          preferredView: 'pendingConfirm',
        });
      } catch (error) {
        setPortalError(
          error instanceof Error ? error.message : '지원자 포털 데이터를 새로고침하는 중 오류가 발생했습니다.',
        );
      } finally {
        void syncEligibilityStatus(sessionId);
      }
    })();
  };

  const openApplicationFromList = (sessionId: string, preferredView: CandidateView) => {
    setProcessUploadFiles({});
    setEligibilityStatus(null);
    setEligibilityMessage(null);
    setHumanVerificationMessage(null);
    void (async () => {
      try {
        setPortalError(null);
        const bootstrap = await fetchCandidatePortalBootstrap();
        const hasApplication = bootstrap.applications.some((application) => application.sessionId === sessionId);

        if (!hasApplication) {
          return;
        }

        applyPortalBootstrap(bootstrap, {
          preservePortalUser: true,
          nextSessionId: sessionId,
          preferredView,
        });
      } catch (error) {
        setPortalError(
          error instanceof Error ? error.message : '지원자 포털 데이터를 새로고침하는 중 오류가 발생했습니다.',
        );
      } finally {
        void syncEligibilityStatus(sessionId);
      }
    })();
  };

  const persistApplication = async (
    status: CandidatePipelineStatus,
    options: {
      draft?: CandidateTaskDraft;
      jobId?: string | null;
    } = {},
  ) => {
    const targetJobId = options.jobId ?? currentSessionId;

    if (!targetJobId) {
      return;
    }

    const activeDraft = options.draft ?? taskDraftRef.current;

    try {
      setIsSavingApplication(true);
      setPortalError(null);
      const response = await saveCandidateJobApplication({
        jobId: targetJobId,
        status,
        processResponses: activeDraft.processResponses,
        processFiles: processUploadFiles,
      });

      setSavedApplications(
        response.applications.map((application) => ({
          sessionId: application.sessionId,
          status: application.status,
          humanVerified: application.humanVerified,
          eligibilityVerified: application.eligibilityVerified,
          processResponses: application.processResponses,
          githubUrl: application.githubUrl,
          portfolioFile: application.portfolioFile,
          updatedAtLabel: application.updatedAtLabel,
        })),
      );
      setReports(response.reports);
      setProcessUploadFiles({});
      pushPortalToast(response.message);
      setActiveView('pendingList');
    } catch (error) {
      setPortalError(error instanceof Error ? error.message : '공고 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingApplication(false);
    }
  };

  const attachProcessFile = (processId: number, file: File) => {
    setProcessUploadFiles((current) => ({
      ...current,
      [processId]: file,
    }));
    updateTaskDraft((current) => ({
      ...current,
      processResponses: current.processResponses.map((response) =>
        response.processId === processId
          ? {
              ...response,
              file: {
                name: file.name,
                sizeLabel: formatFileSize(file.size),
                uploadProgress: 82,
              },
            }
          : response,
      ),
    }));
  };

  const toggleFavorite = async (sessionId: string) => {
    const nextFavoriteSessionIds = favoriteSessionIdSet.has(sessionId)
      ? favoriteSessionIds.filter((id) => id !== sessionId)
      : [sessionId, ...favoriteSessionIds];

    try {
      setIsSavingFavorites(true);
      setFavoriteSessionIds(nextFavoriteSessionIds);
      const response = await saveCandidateFavorites({
        favoriteSessionIds: nextFavoriteSessionIds,
      });
      setFavoriteSessionIds(response.favoriteSessionIds);
    } catch (error) {
      setFavoriteSessionIds(favoriteSessionIds);
      setPortalError(error instanceof Error ? error.message : '즐겨찾기 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingFavorites(false);
    }
  };

  const finalizeActiveInput = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const syncTaskDraftFromVisibleProcessInputs = () => {
    if (!currentSession) {
      return taskDraftRef.current;
    }

    const nextValueByProcessId = new Map<number, string>();
    const elements = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-process-input="true"]');

    elements.forEach((element) => {
      const processId = Number(element.dataset.processId ?? 0);

      if (!Number.isFinite(processId) || processId <= 0) {
        return;
      }

      nextValueByProcessId.set(processId, element.value);
    });

    if (nextValueByProcessId.size === 0) {
      return taskDraftRef.current;
    }

    return updateTaskDraft((current) => ({
      ...current,
      processResponses: current.processResponses.map((response) =>
        nextValueByProcessId.has(response.processId)
          ? {
              ...response,
              value: nextValueByProcessId.get(response.processId) ?? response.value,
            }
          : response,
      ),
    }));
  };

  const submitApplicationAfterInputCommit = (status: CandidatePipelineStatus) => {
    finalizeActiveInput();

    window.setTimeout(async () => {
      const targetSessionId = currentSessionId;

      if (!targetSessionId) {
        return;
      }

      const syncedDraft = syncTaskDraftFromVisibleProcessInputs();
      let nextSession = currentSession;

      if (status === 'submitted') {
        try {
          const bootstrap = await fetchCandidatePortalBootstrap();
          nextSession = bootstrap.explore.sessions.find((session) => session.id === targetSessionId) ?? nextSession;
        } catch (error) {
          setPortalError(
            error instanceof Error ? error.message : '최신 공고 정보를 확인하는 중 오류가 발생했습니다.',
          );
          return;
        }
      }

      if (
        status === 'submitted' &&
        nextSession &&
        !hasCompletedCandidateTaskFields(nextSession, syncedDraft)
      ) {
        return;
      }

      void persistApplication(status, {
        draft: syncedDraft,
        jobId: targetSessionId,
      });
    }, 0);
  };

  return (
    <div className="candidate-dashboard-page">
      <aside className="candidate-dashboard-sidebar">
        <button type="button" className="candidate-dashboard-sidebar__brand" onClick={() => setActiveView('home')}>
          WorldFit
        </button>

        <nav className="candidate-dashboard-sidebar__nav" aria-label="지원자 메뉴">
          {CANDIDATE_DASHBOARD_NAV_ITEMS.map((item) => {
            const isPendingNavigation = item.view === 'pendingList' && activeView.startsWith('pending');
            const isReportNavigation = item.view === 'reports' && (activeView === 'reports' || activeView === 'reportDetail');
            const isMatchingNavigation = item.view === 'matchingHistory' && activeView === 'matchingHistory';
            const isActive = item.view === activeView || isPendingNavigation || isReportNavigation || isMatchingNavigation;

            return (
              <button
                key={item.label}
                type="button"
                className={`candidate-dashboard-sidebar__nav-item${isActive ? ' candidate-dashboard-sidebar__nav-item--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  if (item.view) {
                    setActiveView(item.view);
                  }
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="candidate-dashboard-sidebar__profile">
          <div className="candidate-dashboard-sidebar__avatar" aria-hidden="true">
            {getAvatarLabel(portalUser.name)}
          </div>
          <div className="candidate-dashboard-sidebar__profile-copy">
            <strong>
              <CandidateVerifiedName name={getDisplayName(portalUser.name)} />
            </strong>
            <span>{getProfileSubtitle(portalUser.email)}</span>
          </div>
          <button type="button" className="candidate-dashboard-sidebar__logout" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </aside>

      <div className="candidate-dashboard-main">
        {portalToastMessage ? (
          <div key={portalToastId} className="company-dashboard-toast" role="status" aria-live="polite">
            {portalToastMessage}
          </div>
        ) : null}

        <header className="candidate-dashboard-topbar">
          <h1>{pageTitle}</h1>
        </header>

        <main className="candidate-dashboard-content">
          {portalError ? (
            <section className="candidate-dashboard-panel">
              <strong>연결 오류</strong>
              <p>{portalError}</p>
            </section>
          ) : null}

          {isBootstrapping ? (
            <section className="candidate-dashboard-panel">
              <strong>지원자 포털을 불러오는 중입니다.</strong>
              <p>공고, 리포트, 설정 정보를 서버에서 가져오고 있습니다.</p>
            </section>
          ) : null}

          {!isBootstrapping && activeView === 'home' ? (
            <CandidateHomeView
              greetingName={getGreetingName(portalUser.name)}
              favoriteSessions={favoriteSessions}
              reports={reports}
              matchingRecords={matchHistory}
              onOpenReport={openReportDetail}
              onOpenMatch={openMatchingDetail}
              onOpenSession={openSessionFromExplore}
            />
          ) : null}

          {!isBootstrapping && activeView === 'explore' ? (
            <CandidateExploreView
              sessions={exploreSessions}
              favoriteSessionIds={favoriteSessionIdSet}
              isSavingFavorites={isSavingFavorites}
              searchQuery={exploreSearchQuery}
              selectedFilter={selectedExploreFilter}
              inviteCode={inviteCode}
              onSearchQueryChange={setExploreSearchQuery}
              onFilterChange={setSelectedExploreFilter}
              onInviteCodeChange={setInviteCode}
              onOpenSession={openSessionFromExplore}
              onToggleFavorite={toggleFavorite}
            />
          ) : null}

          {!isBootstrapping && activeView === 'pendingList' ? (
            <CandidatePendingListView
              sessions={exploreSessions}
              applications={savedApplications}
              onOpenApplication={openApplicationFromList}
              onGoExplore={() => setActiveView('explore')}
            />
          ) : null}

          {!isBootstrapping && activeView === 'pendingConfirm' && currentSession ? (
            <CandidatePendingConfirmView
              session={currentSession}
              draft={taskDraft}
              status={currentApplication?.status ?? null}
              eligibilityStatus={eligibilityStatus}
              eligibilityMessage={eligibilityMessage}
              humanVerificationMessage={humanVerificationMessage}
              isPreparingHumanVerification={isPreparingHumanVerification}
              isVerifyingHumanVerification={isVerifyingHumanVerification}
              isCheckingEligibility={isCheckingEligibility}
              isPreparingEligibilityVerification={
                isPreparingEligibilityVerification || isVerifyingEligibilityVerification
              }
              onVerify={(field) => {
                if (field === 'humanVerified') {
                  if (!worldIdConfig?.enabled) {
                    setPortalError('World ID가 아직 설정되지 않았습니다. .env의 World ID 값을 먼저 채워주세요.');
                    return;
                  }

                  void (async () => {
                    try {
                      setIsPreparingHumanVerification(true);
                      setPortalError(null);
                      const response = await createCandidateLoginWorldIdRpSignature();
                      setHumanWorldIdRequest(response);
                      setHumanWorldIdOpen(true);
                    } catch (error) {
                      setPortalError(
                        error instanceof Error ? error.message : '인간 인증 준비 중 오류가 발생했습니다.',
                      );
                    } finally {
                      setIsPreparingHumanVerification(false);
                    }
                  })();
                  return;
                }

                if (!currentSessionId) {
                  return;
                }

                void (async () => {
                  const result = await syncEligibilityStatus(currentSessionId);

                  if (
                    !result ||
                    result.isEligible ||
                    !result.requiresDocumentCredential ||
                    result.documentVerified
                  ) {
                    return;
                  }

                  if (!worldIdConfig?.enabled) {
                    setPortalError('World ID가 아직 설정되지 않았습니다. .env의 World ID 값을 먼저 채워주세요.');
                    return;
                  }

                  try {
                    setIsPreparingEligibilityVerification(true);
                    setPortalError(null);
                    setActiveEligibilityJobId(currentSessionId);
                    const response = await createCandidateEligibilityWorldIdRpSignature(currentSessionId);
                    setEligibilityWorldIdRequest(response);
                    setEligibilityWorldIdOpen(true);
                  } catch (error) {
                    setPortalError(
                      error instanceof Error ? error.message : '지원 자격 인증 준비 중 오류가 발생했습니다.',
                    );
                  } finally {
                    setIsPreparingEligibilityVerification(false);
                  }
                })();
              }}
              onContinue={() => setActiveView('pendingUpload')}
            />
          ) : null}

          {!isBootstrapping && activeView === 'pendingUpload' && currentSession ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="candidate-visually-hidden"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0];

                  if (!selectedFile || activeFileProcessId == null) {
                    return;
                  }

                  attachProcessFile(activeFileProcessId, selectedFile);

                  setActiveFileProcessId(null);
                  event.target.value = '';
                }}
              />

              <CandidatePendingUploadView
                session={currentSession}
                draft={taskDraft}
                status={currentApplication?.status ?? null}
                isSaving={isSavingApplication}
                onProcessValueChange={(processId, value) => {
                  updateTaskDraft((current) => ({
                    ...current,
                    processResponses: current.processResponses.map((response) =>
                      response.processId === processId ? { ...response, value } : response,
                    ),
                  }));
                }}
                onSelectFile={(processId) => {
                  setActiveFileProcessId(processId);
                  fileInputRef.current?.click();
                }}
                onDropFile={(processId, file) => {
                  attachProcessFile(processId, file);
                }}
                onRemoveFile={(processId) => {
                  setProcessUploadFiles((current) => {
                    const next = { ...current };
                    delete next[processId];
                    return next;
                  });
                  updateTaskDraft((current) => ({
                    ...current,
                    processResponses: current.processResponses.map((response) =>
                      response.processId === processId ? { ...response, file: null } : response,
                    ),
                  }));
                }}
                onBackToConfirm={() => {
                  setActiveView('pendingConfirm');
                }}
                onSave={() => {
                  submitApplicationAfterInputCommit('draft');
                }}
                onSubmit={() => {
                  if (!hasCompletedCandidateTaskFields(currentSession, taskDraftRef.current)) {
                    return;
                  }

                  if (!taskDraftRef.current.humanVerified || !taskDraftRef.current.eligibilityVerified) {
                    setPortalError('제출 전 이전 단계에서 본인 인증과 지원 자격 인증을 완료해주세요.');
                    setActiveView('pendingConfirm');
                    return;
                  }

                  submitApplicationAfterInputCommit('submitted');
                }}
              />
            </>
          ) : null}

          {!isBootstrapping && activeView === 'reports' ? (
            <CandidateReportsView
              reports={reports}
              sessions={exploreSessions}
              searchQuery={reportSearchQuery}
              selectedFilter={selectedReportFilter}
              onSearchQueryChange={setReportSearchQuery}
              onFilterChange={setSelectedReportFilter}
              onOpenReport={openReportDetail}
            />
          ) : null}

          {!isBootstrapping && activeView === 'reportDetail' && currentReport ? <CandidateReportDetailView report={currentReport} /> : null}

          {!isBootstrapping && activeView === 'matchingHistory' ? (
            <CandidateMatchingHistoryView
              records={matchHistory}
              searchQuery={matchingSearchQuery}
              selectedFilter={selectedMatchingFilter}
              onSearchQueryChange={setMatchingSearchQuery}
              onFilterChange={setSelectedMatchingFilter}
              onOpenDetail={openMatchingDetail}
            />
          ) : null}

          {!isBootstrapping && activeView === 'settings' ? (
            isSettingsWorldVerified ? (
              <CandidateSettingsView
                form={settingsForm}
                lastUnlockedLabel={settingsUnlockLabel}
                isSaving={isSavingSettings}
                onFieldChange={(field, value) => {
                  setSettingsForm((current) => ({
                    ...current,
                    [field]: value,
                  }));
                }}
                onToggleShareDefault={(key) => {
                  setSettingsForm((current) => ({
                    ...current,
                    shareDefaults: {
                      ...current.shareDefaults,
                      [key]: !current.shareDefaults[key],
                    },
                  }));
                }}
                onSave={() => {
                  void (async () => {
                    try {
                      setIsSavingSettings(true);
                      setPortalError(null);
                      const response = await saveCandidatePortalSettings(settingsForm);
                      setPortalUser(response.candidateUser);
                      setSettingsForm(response.settings);
                      setSavedSettingsForm(response.settings);
                      setSettingsUnlockLabel(`이번 세션 해제 · ${formatSavedTime(new Date())}`);
                      pushPortalToast(response.message);
                    } catch (error) {
                      setPortalError(error instanceof Error ? error.message : '설정 저장 중 오류가 발생했습니다.');
                    } finally {
                      setIsSavingSettings(false);
                    }
                  })();
                }}
                onReset={() => {
                  setSettingsForm(savedSettingsForm);
                  setActiveView('home');
                }}
              />
            ) : (
              <CandidateSettingsUnlockView
                isUnlocking={isSettingsWorldVerifying || isPreparingSettingsVerification}
                onUnlock={() => {
                  if (!worldIdConfig?.enabled) {
                    setPortalError('World ID가 아직 설정되지 않았습니다. .env의 World ID 값을 먼저 채워주세요.');
                    return;
                  }

                  void (async () => {
                    try {
                      setIsPreparingSettingsVerification(true);
                      setPortalError(null);
                      const response = await createCandidateLoginWorldIdRpSignature();
                      setSettingsWorldIdRequest(response);
                      setSettingsWorldIdOpen(true);
                    } catch (error) {
                      setPortalError(
                        error instanceof Error ? error.message : '설정 잠금 해제 준비 중 오류가 발생했습니다.',
                      );
                    } finally {
                      setIsPreparingSettingsVerification(false);
                    }
                  })();
                }}
              />
            )
          ) : null}
        </main>
      </div>

      {activeView === 'matchingHistory' && currentMatch ? (
        <CandidateMatchingDetailModal
          record={currentMatch}
          isSubmitting={
            isRespondingToMatchRequest ||
            isPreparingMatchConsentVerification ||
            isVerifyingMatchConsentVerification
          }
          onClose={() => setCurrentMatchId(null)}
          onToggleField={(recordId, fieldKey) => {
            if (
              currentMatch.status !== 'pending' ||
              isRespondingToMatchRequest ||
              isPreparingMatchConsentVerification ||
              isVerifyingMatchConsentVerification
            ) {
              return;
            }

            setMatchHistory((current) =>
              current.map((record) =>
                record.id === recordId
                  ? {
                      ...record,
                      infoFields: record.infoFields.map((field) =>
                        field.key === fieldKey ? { ...field, shared: !field.shared } : field,
                      ),
                    }
                  : record,
              ),
            );
          }}
          onDecide={(recordId, status) => {
            const targetRecord = matchHistory.find((record) => record.id === recordId);

            if (!targetRecord || targetRecord.status !== 'pending') {
              return;
            }

            if (status === 'rejected') {
              void submitMatchDecision(recordId, status);
              return;
            }

            if (targetRecord.infoFields.some((field) => field.required && field.shared !== true)) {
              setPortalError('기업이 필수로 요청한 정보에 모두 동의해야 매칭 공개를 진행할 수 있습니다.');
              return;
            }

            if (!worldIdConfig?.enabled) {
              setPortalError('World ID가 아직 설정되지 않았습니다. .env의 World ID 값을 먼저 채워주세요.');
              return;
            }

            void (async () => {
              try {
                setIsPreparingMatchConsentVerification(true);
                setPortalError(null);
                setPendingMatchDecision({ recordId, status });
                const response = await createCandidateLoginWorldIdRpSignature();
                setMatchConsentWorldIdRequest(response);
                setMatchConsentWorldIdOpen(true);
              } catch (error) {
                setPortalError(
                  error instanceof Error ? error.message : '매칭 동의 인증 준비 중 오류가 발생했습니다.',
                );
              } finally {
                setIsPreparingMatchConsentVerification(false);
              }
            })();
          }}
        />
      ) : null}

      {eligibilityWorldIdRequest ? (
        <IDKitRequestWidget
          open={eligibilityWorldIdOpen}
          onOpenChange={setEligibilityWorldIdOpen}
          app_id={eligibilityWorldIdRequest.appId}
          action={eligibilityWorldIdRequest.action}
          rp_context={eligibilityWorldIdRequest.rpContext as RpContext}
          allow_legacy_proofs={false}
          environment={eligibilityWorldIdRequest.environment}
          constraints={any(
            CredentialRequest(
              'passport',
              eligibilityWorldIdRequest.signal ? { signal: eligibilityWorldIdRequest.signal } : undefined,
            ),
            CredentialRequest(
              'mnc',
              eligibilityWorldIdRequest.signal ? { signal: eligibilityWorldIdRequest.signal } : undefined,
            ),
          )}
          handleVerify={async (result: IDKitResult) => {
            if (!activeEligibilityJobId) {
              throw new Error('진행 중인 자격 인증 공고를 찾을 수 없습니다.');
            }

            try {
              setIsVerifyingEligibilityVerification(true);
              setPortalError(null);
              const response = await verifyCandidateEligibilityWithWorldId({
                jobId: activeEligibilityJobId,
                idkitResponse: result,
              });
              setEligibilityStatus(response.verification);
              setEligibilityMessage(response.verification.reason);
              updateTaskDraft((current) => ({
                ...current,
                eligibilityVerified: response.verification.isEligible,
              }));
              pushPortalToast(response.message);
            } catch (error) {
              setPortalError(
                error instanceof Error ? error.message : '지원 자격 인증 처리 중 오류가 발생했습니다.',
              );
              throw error;
            } finally {
              setIsVerifyingEligibilityVerification(false);
            }
          }}
          onSuccess={() => {
            setEligibilityWorldIdOpen(false);
          }}
          onError={(errorCode) => {
            if (errorCode === IDKitErrorCodes.FailedByHostApp) {
              setEligibilityWorldIdOpen(false);
              return;
            }

            const nextMessage =
              errorCode === IDKitErrorCodes.Cancelled ||
              errorCode === IDKitErrorCodes.UserRejected ||
              errorCode === IDKitErrorCodes.VerificationRejected
                ? '지원 자격 인증이 취소되었습니다. 다시 시도해주세요.'
                : errorCode === IDKitErrorCodes.ConnectionFailed
                  ? 'World ID 연결이 끊어졌습니다. 다시 시도해주세요.'
                  : '지원 자격 인증을 완료하지 못했습니다. 다시 시도해주세요.';

            setPortalError(nextMessage);
          }}
        />
      ) : null}

      {settingsWorldIdRequest ? (
        <IDKitRequestWidget
          open={settingsWorldIdOpen}
          onOpenChange={setSettingsWorldIdOpen}
          app_id={settingsWorldIdRequest.appId}
          action={settingsWorldIdRequest.action}
          rp_context={settingsWorldIdRequest.rpContext as RpContext}
          allow_legacy_proofs={true}
          environment={settingsWorldIdRequest.environment}
          preset={orbLegacy()}
          handleVerify={async (result: IDKitResult) => {
            try {
              setIsSettingsWorldVerifying(true);
              setPortalError(null);
              const response = await loginCandidateWithWorldId({
                idkitResponse: result,
              });

              if (response.candidateUser.id !== portalUser.id) {
                throw new Error('현재 로그인한 지원자 계정과 일치하는 World ID가 아닙니다.');
              }

              setPortalUser(response.candidateUser);
              setIsSettingsWorldVerified(true);
              setSettingsUnlockLabel(`이번 세션 해제 · ${formatSavedTime(new Date())}`);
              pushPortalToast(response.message);
            } catch (error) {
              setPortalError(
                error instanceof Error ? error.message : '설정 잠금 해제 인증 중 오류가 발생했습니다.',
              );
              throw error;
            } finally {
              setIsSettingsWorldVerifying(false);
            }
          }}
          onSuccess={() => {
            setSettingsWorldIdOpen(false);
          }}
          onError={(errorCode) => {
            if (errorCode === IDKitErrorCodes.FailedByHostApp) {
              setSettingsWorldIdOpen(false);
              return;
            }

            const nextMessage =
              errorCode === IDKitErrorCodes.Cancelled ||
              errorCode === IDKitErrorCodes.UserRejected ||
              errorCode === IDKitErrorCodes.VerificationRejected
                ? '설정 잠금 해제 인증이 취소되었습니다. 다시 시도해주세요.'
                : errorCode === IDKitErrorCodes.ConnectionFailed
                  ? 'World ID 연결이 끊어졌습니다. 다시 시도해주세요.'
                  : '설정 잠금 해제 인증을 완료하지 못했습니다. 다시 시도해주세요.';

            setPortalError(nextMessage);
          }}
        />
      ) : null}

      {humanWorldIdRequest ? (
        <IDKitRequestWidget
          open={humanWorldIdOpen}
          onOpenChange={setHumanWorldIdOpen}
          app_id={humanWorldIdRequest.appId}
          action={humanWorldIdRequest.action}
          rp_context={humanWorldIdRequest.rpContext as RpContext}
          allow_legacy_proofs={true}
          environment={humanWorldIdRequest.environment}
          preset={orbLegacy()}
          handleVerify={async (result: IDKitResult) => {
            try {
              setIsVerifyingHumanVerification(true);
              setPortalError(null);
              const response = await loginCandidateWithWorldId({
                idkitResponse: result,
                intent: 'job-human-verify',
                jobId: currentSessionRef.current ?? undefined,
              });

              if (response.candidateUser.id !== portalUser.id) {
                throw new Error('현재 로그인한 지원자 계정과 일치하는 World ID가 아닙니다.');
              }

              setPortalUser(response.candidateUser);
              updateTaskDraft((current) => ({
                ...current,
                humanVerified: true,
              }));
              setHumanVerificationMessage('지원 직전 본인 확인이 완료되었습니다.');
              pushPortalToast(response.message);
            } catch (error) {
              setPortalError(error instanceof Error ? error.message : '인간 인증 중 오류가 발생했습니다.');
              throw error;
            } finally {
              setIsVerifyingHumanVerification(false);
            }
          }}
          onSuccess={() => {
            setHumanWorldIdOpen(false);
          }}
          onError={(errorCode) => {
            if (errorCode === IDKitErrorCodes.FailedByHostApp) {
              setHumanWorldIdOpen(false);
              return;
            }

            const nextMessage =
              errorCode === IDKitErrorCodes.Cancelled ||
              errorCode === IDKitErrorCodes.UserRejected ||
              errorCode === IDKitErrorCodes.VerificationRejected
                ? '인간 인증이 취소되었습니다. 다시 시도해주세요.'
                : errorCode === IDKitErrorCodes.ConnectionFailed
                  ? 'World ID 연결이 끊어졌습니다. 다시 시도해주세요.'
                  : '인간 인증을 완료하지 못했습니다. 다시 시도해주세요.';

            setPortalError(nextMessage);
          }}
        />
      ) : null}

      {matchConsentWorldIdRequest ? (
        <IDKitRequestWidget
          open={matchConsentWorldIdOpen}
          onOpenChange={setMatchConsentWorldIdOpen}
          app_id={matchConsentWorldIdRequest.appId}
          action={matchConsentWorldIdRequest.action}
          rp_context={matchConsentWorldIdRequest.rpContext as RpContext}
          allow_legacy_proofs={true}
          environment={matchConsentWorldIdRequest.environment}
          preset={orbLegacy()}
          handleVerify={async (result: IDKitResult) => {
            if (!pendingMatchDecision) {
              throw new Error('진행 중인 매칭 동의 요청을 찾을 수 없습니다.');
            }

            try {
              setIsVerifyingMatchConsentVerification(true);
              setPortalError(null);
              const response = await loginCandidateWithWorldId({
                idkitResponse: result,
                intent: 'match-consent-verify',
                matchId: pendingMatchDecision.recordId,
              });

              if (response.candidateUser.id !== portalUser.id) {
                throw new Error('현재 로그인한 지원자 계정과 일치하는 World ID가 아닙니다.');
              }

              setPortalUser(response.candidateUser);
              await submitMatchDecision(pendingMatchDecision.recordId, pendingMatchDecision.status);
            } catch (error) {
              setPortalError(
                error instanceof Error ? error.message : '매칭 동의 인증 중 오류가 발생했습니다.',
              );
              throw error;
            } finally {
              setIsVerifyingMatchConsentVerification(false);
            }
          }}
          onSuccess={() => {
            setMatchConsentWorldIdOpen(false);
          }}
          onError={(errorCode) => {
            if (errorCode === IDKitErrorCodes.FailedByHostApp) {
              setMatchConsentWorldIdOpen(false);
              return;
            }

            const nextMessage =
              errorCode === IDKitErrorCodes.Cancelled ||
              errorCode === IDKitErrorCodes.UserRejected ||
              errorCode === IDKitErrorCodes.VerificationRejected
                ? '매칭 동의용 World ID 인증이 취소되었습니다. 다시 시도해주세요.'
                : errorCode === IDKitErrorCodes.ConnectionFailed
                  ? 'World ID 연결이 끊어졌습니다. 다시 시도해주세요.'
                  : '매칭 동의용 World ID 인증을 완료하지 못했습니다. 다시 시도해주세요.';

            setPortalError(nextMessage);
          }}
        />
      ) : null}
    </div>
  );
}
