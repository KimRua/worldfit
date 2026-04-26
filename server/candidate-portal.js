import { createHash, randomUUID } from 'node:crypto';
import { evaluateCandidateSubmissionForCompanyJob } from './company-portal.js';
import { extractTextFromCompanyPdfFile } from './company-document-parser.js';
import { pool } from './db.js';
import { sendCompanyMatchConsentEmail } from './mail.js';
import {
  normalizeSubmissionSourceSnapshot,
  readSubmissionUrlSource,
} from './submission-source-reader.js';

const countryLabels = {
  KR: '대한민국',
  JP: '일본',
  US: '미국',
  SG: '싱가포르',
  DE: '독일',
  FR: '프랑스',
  GB: '영국',
};

const exploreTypeLabels = {
  recruiting: '채용',
  contest: '공모전',
  audition: '오디션',
  education: '교육',
};

const pendingCandidateEvaluationJobs = new Set();

const matchingSeedRecords = [
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
];

const reportSeedRows = [
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
];

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonField(value, fallback) {
  if (value == null || value === '') {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function trimValue(value, limit = 255) {
  const normalized = String(value ?? '').trim();
  return normalized.length > limit ? normalized.slice(0, limit) : normalized;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTimestamp(dateValue) {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function formatCountryList(codes) {
  if (!Array.isArray(codes) || codes.length === 0) {
    return '전 세계';
  }

  return codes.map((code) => countryLabels[String(code).toUpperCase()] ?? String(code).toUpperCase()).join(', ');
}

function formatJobRequirements(processes) {
  return (Array.isArray(processes) ? processes : [])
    .map((process) => normalizeSubmissionMethodLabel(process.submissionMethod))
    .filter(Boolean)
    .slice(0, 3)
    .map((method) => {
      if (method.includes('링크')) {
        return 'GitHub 링크 제출';
      }

      if (method.includes('PDF')) {
        return '텍스트 기반 PDF 제출';
      }

      if (method.includes('텍스트')) {
        return '텍스트 답변 제출';
      }

      return `${method} 제출`;
    });
}

function normalizeSubmissionMethodLabel(method) {
  const normalized = trimValue(method ?? '', 120);
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

function sanitizeCandidateSessionProcesses(processes) {
  return (Array.isArray(processes) ? processes : [])
    .map((process, index) => ({
      id: toNumber(process?.id, index + 1),
      name: trimValue(process?.name ?? '', 120),
      content: trimValue(process?.content ?? '', 400),
      submissionMethod: normalizeSubmissionMethodLabel(process?.submissionMethod),
    }))
    .filter((process) => process.id > 0 && process.name && process.content && process.submissionMethod);
}

function isLinkSubmissionMethod(method) {
  return normalizeSubmissionMethodLabel(method) === '링크 제출';
}

function isTextSubmissionMethod(method) {
  return normalizeSubmissionMethodLabel(method) === '텍스트 직접 입력';
}

function isFileSubmissionMethod(method) {
  return normalizeSubmissionMethodLabel(method) === 'PDF';
}

function isValidHttpUrl(value) {
  const trimmed = trimValue(value ?? '', 2048);

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

function normalizeCandidateProcessResponses(input, sessionProcesses) {
  const processMap = new Map(sessionProcesses.map((process) => [process.id, process]));

  return (Array.isArray(input) ? input : [])
    .map((response) => {
      const processId = toNumber(response?.processId, 0);
      const process = processMap.get(processId);

      if (!process) {
        return null;
      }

      const file = response?.file && typeof response.file === 'object'
        ? {
            name: trimValue(response.file.name ?? '', 255),
            sizeLabel: trimValue(response.file.sizeLabel ?? '', 32),
            uploadProgress: clampInteger(response.file.uploadProgress, 0, 100, 0),
          }
        : null;
      const sourceSnapshot = normalizeSubmissionSourceSnapshot(response?.sourceSnapshot, 0);

      return {
        processId,
        value: trimValue(response?.value ?? '', 4000),
        file: file?.name ? file : null,
        sourceSnapshot,
      };
    })
    .filter(Boolean);
}

async function buildProcessResponseSourceSnapshot(process, response, uploadedFile, requireLiveRead) {
  if (isFileSubmissionMethod(process.submissionMethod)) {
    if (uploadedFile) {
      const extracted = await extractTextFromCompanyPdfFile(uploadedFile, {
        target: `candidate-process-${process.id}`,
      });

      return normalizeSubmissionSourceSnapshot(
        {
          kind: 'pdf',
          label: process.name,
          fileName: extracted.fileName,
          pageCount: extracted.pageCount,
          characterCount: extracted.characterCount,
          truncated: extracted.truncated,
          text: extracted.text,
        },
        0,
      );
    }

    const preservedSnapshot = normalizeSubmissionSourceSnapshot(response?.sourceSnapshot, 0);

    if (response?.file?.name && preservedSnapshot?.kind === 'pdf') {
      return preservedSnapshot;
    }

    if (requireLiveRead && response?.file?.name) {
      throw new Error(`'${process.name}' PDF를 다시 첨부해주세요. 기존 저장본에는 읽을 수 있는 본문이 없습니다.`);
    }

    return null;
  }

  if (isLinkSubmissionMethod(process.submissionMethod)) {
    const url = trimValue(response?.value ?? '', 2048);

    if (!url) {
      return null;
    }

    try {
      return await readSubmissionUrlSource(url, {
        label: process.name,
        target: `candidate-process-${process.id}`,
      });
    } catch (error) {
      if (requireLiveRead) {
        throw new Error(
          error instanceof Error ? `'${process.name}' 링크를 읽을 수 없습니다. ${error.message}` : `'${process.name}' 링크를 읽을 수 없습니다.`,
        );
      }

      const preservedSnapshot = normalizeSubmissionSourceSnapshot(response?.sourceSnapshot, 0);
      return preservedSnapshot?.kind === 'url' ? preservedSnapshot : null;
    }
  }

  return null;
}

async function enrichCandidateProcessResponses(sessionProcesses, processResponses, uploadedProcessFiles, status) {
  const processMap = new Map(sessionProcesses.map((process) => [process.id, process]));
  const requireLiveRead = status === 'submitted';

  return Promise.all(
    processResponses.map(async (response) => {
      const process = processMap.get(response.processId);

      if (!process) {
        return response;
      }

      const sourceSnapshot = await buildProcessResponseSourceSnapshot(
        process,
        response,
        uploadedProcessFiles.get(process.id) ?? null,
        requireLiveRead,
      );

      return sourceSnapshot
        ? { ...response, sourceSnapshot }
        : { ...response, sourceSnapshot: null };
    }),
  );
}

function buildLegacyProcessResponses(githubUrl, portfolioFile, sessionProcesses) {
  const responses = [];
  const linkProcess = sessionProcesses.find((process) => isLinkSubmissionMethod(process.submissionMethod));
  const fileProcess = sessionProcesses.find((process) => isFileSubmissionMethod(process.submissionMethod));

  if (linkProcess && githubUrl) {
    responses.push({
      processId: linkProcess.id,
      value: githubUrl,
      file: null,
    });
  }

  if (fileProcess && portfolioFile?.name) {
    responses.push({
      processId: fileProcess.id,
      value: '',
      file: portfolioFile,
    });
  }

  return responses;
}

function formatJobWeights(agents) {
  const labelByAgent = {
    technical: 'Tech',
    reasoning: 'Reason',
    communication: 'Comm',
    creativity: 'Creat',
    integrity: 'Int',
  };

  return (Array.isArray(agents) ? agents : [])
    .filter((agent) => agent?.selected === true)
    .map((agent) => `${labelByAgent[agent.id] ?? trimValue(agent.name, 5) ?? 'Metric'} ${toNumber(agent.weight, 0)}`)
    .slice(0, 5);
}

function mapEligibleAgeToLabel(eligibleAge) {
  if (eligibleAge === 'adult') {
    return '만 18세 이상';
  }

  if (eligibleAge === 'minor') {
    return '만 18세 미만';
  }

  return '연령 제한 없음';
}

function mapJobRowToExploreSession(row, companyName) {
  const processes = sanitizeCandidateSessionProcesses(parseJsonField(row.processes_payload, []));
  const agents = parseJsonField(row.agents_payload, []);
  const eligibleCountries = parseJsonField(row.eligible_countries, []);
  const typeLabel = row.badge || exploreTypeLabels[row.session_type] || '채용';
  const status = String(row.status ?? 'draft').trim().toLowerCase();
  const requirements = formatJobRequirements(processes);
  const weights = formatJobWeights(agents);
  const deadlineDate = new Date(row.end_date);
  const now = new Date();
  const deadlineDays = Math.max(
    0,
    Math.ceil((deadlineDate.setHours(23, 59, 59, 999) - now.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    id: row.id,
    title: row.title,
    organization: companyName,
    location: '한국',
    mode: row.visibility_scope === '비공개' ? 'Invite Only' : 'Remote',
    description: trimValue(row.description, 160),
    inviteCode: `JOB-${String(row.id).replace(/^job-/, '').slice(0, 8).toUpperCase()}`,
    typeLabel,
    filterKey: row.session_type,
    status,
    deadline: deadlineDays > 0 ? `D-${deadlineDays}` : '오늘 마감',
    deadlineDays,
    processes,
    requirements: requirements.length > 0 ? requirements : ['GitHub 링크 제출', '개발자 포트폴리오 제출'],
    detailLines: [trimValue(row.description, 180), trimValue(row.detailed_description, 240)],
    eligibilityLines: [
      `기간: ${formatTimestamp(row.start_date).slice(0, 10)} ~ ${formatTimestamp(row.end_date).slice(0, 10)} 23:59`,
      `모집 인원: ${toNumber(row.capacity, 0)}명`,
      `지원 자격: ${mapEligibleAgeToLabel(row.eligible_age)} / ${formatCountryList(eligibleCountries)}`,
    ],
    weights: weights.length > 0 ? weights : ['Tech 35', 'Reason 25', 'Comm 25', 'Creat 10', 'Int 5'],
  };
}

async function getCandidateProfileRow(candidateUserId) {
  const [rows] = await pool.execute(
    `
      SELECT candidate_user_id, birth_date, phone, education_summary, current_affiliation,
             language,
             years_experience, employment_type, resume_file_name, resume_file_size_label,
             cover_letter_file_name, cover_letter_file_size_label, share_defaults_payload,
             favorite_job_ids_payload,
             updated_at
      FROM candidate_portal_profiles
      WHERE candidate_user_id = ?
      LIMIT 1
    `,
    [candidateUserId],
  );

  return rows[0] ?? null;
}

async function getCandidateApplicationRows(candidateUserId) {
  const [rows] = await pool.execute(
    `
      SELECT id, candidate_user_id, job_id, status, human_verified, eligibility_verified,
             process_responses_payload, github_url, portfolio_file_name, portfolio_file_size_label, portfolio_upload_progress,
             submitted_at, created_at, updated_at
      FROM candidate_job_applications
      WHERE candidate_user_id = ?
      ORDER BY updated_at DESC, created_at DESC
    `,
    [candidateUserId],
  );

  return rows;
}

async function getCandidateMatchRequestRows(candidateUserId) {
  const [rows] = await pool.execute(
    `
      SELECT id, candidate_user_id, company_user_id, job_id, company_job_evaluation_id, anonymous_id,
             company_name, session_title, request_type_label, status, info_fields_payload, notified_at,
             decision_at, created_at, updated_at
      FROM candidate_match_requests
      WHERE candidate_user_id = ?
      ORDER BY notified_at DESC, created_at DESC
    `,
    [candidateUserId],
  );

  return rows;
}

async function getCompanyEvaluationRowsByJobIds(jobIds) {
  const normalizedJobIds = [...new Set((Array.isArray(jobIds) ? jobIds : []).map((jobId) => trimValue(jobId, 64)).filter(Boolean))];

  if (normalizedJobIds.length === 0) {
    return [];
  }

  const [rows] = await pool.execute(
    `
      SELECT id, company_user_id, job_id, anonymous_id, candidate_label, human_verified, selected,
             overall_score, integrity_score, submission_payload, evaluation_payload, created_at, updated_at
      FROM company_job_evaluations
      WHERE job_id IN (${normalizedJobIds.map(() => '?').join(', ')})
      ORDER BY overall_score DESC, created_at ASC
    `,
    normalizedJobIds,
  );

  return rows;
}

async function getExploreJobRows() {
  const [rows] = await pool.execute(
    `
      SELECT cj.id, cj.title, cj.session_type, cj.badge, cj.status, cj.start_date, cj.end_date,
             cj.description, cj.detailed_description, cj.capacity, cj.visibility_scope, cj.eligible_age,
             cj.eligible_countries, cj.processes_payload, cj.agents_payload, cu.company_name
      FROM company_jobs cj
      INNER JOIN company_users cu ON cu.id = cj.company_user_id
      WHERE cj.status IN ('draft', 'open', 'closing')
      ORDER BY cj.created_at DESC, cj.end_date ASC
    `,
  );

  return rows.map(applyDerivedJobStatus);
}

async function getJobRowById(jobId) {
  const [rows] = await pool.execute(
    `
      SELECT cj.id, cj.company_user_id, cj.title, cj.session_type, cj.badge, cj.status, cj.start_date, cj.end_date,
             cj.description, cj.detailed_description, cj.capacity, cj.visibility_scope, cj.eligible_age,
             cj.eligible_countries, cj.processes_payload, cj.agents_payload, cu.company_name
      FROM company_jobs cj
      INNER JOIN company_users cu ON cu.id = cj.company_user_id
      WHERE cj.id = ?
      LIMIT 1
    `,
    [jobId],
  );

  return applyDerivedJobStatus(rows[0] ?? null);
}

async function getCandidateDocumentCredential(candidateUserId) {
  const [rows] = await pool.execute(
    `
      SELECT candidate_user_id, credential_kind, nullifier_hash, signal_hash, credential_type,
             issuer_schema_id, protocol_version, environment, age_bracket, age_over_18, country_code,
             raw_claims_payload, verified_at
      FROM candidate_world_document_credentials
      WHERE candidate_user_id = ?
        AND credential_kind = 'document'
      LIMIT 1
    `,
    [candidateUserId],
  );

  return rows[0] ?? null;
}

function buildDefaultSettingsForm(candidateUser, profileRow) {
  const shareDefaults = {
    name: true,
    email: true,
    phone: true,
    education: true,
    career: true,
    resume: true,
    ...parseJsonField(profileRow?.share_defaults_payload, {}),
  };

  return {
    name: trimValue(candidateUser.name, 120),
    birthDate: trimValue(profileRow?.birth_date ?? '', 16) || 'YYYY-MM-DD',
    email: trimValue(candidateUser.email, 255),
    phone: trimValue(profileRow?.phone ?? '', 32) || '010-1234-5678',
    language: trimValue(profileRow?.language ?? '', 64),
    education: trimValue(profileRow?.education_summary ?? '', 255) || '○○대학교 컴퓨터공학 학사',
    affiliation: trimValue(profileRow?.current_affiliation ?? '', 255) || '○○컴퍼니 · 백엔드 엔지니어',
    careerYears: `${toNumber(profileRow?.years_experience, 3) || 3}년`,
    employmentType: trimValue(profileRow?.employment_type ?? '', 120) || 'Full-time / Part-time',
    attachments: [
      {
        id: 'resume',
        label: '이력서 (PDF)',
        fileName: trimValue(profileRow?.resume_file_name ?? '', 255) || 'resume-2026.pdf',
        sizeLabel: trimValue(profileRow?.resume_file_size_label ?? '', 32) || '1.2MB',
      },
      {
        id: 'cover-letter',
        label: '자기소개서',
        fileName: trimValue(profileRow?.cover_letter_file_name ?? '', 255),
        sizeLabel: trimValue(profileRow?.cover_letter_file_size_label ?? '', 32),
        emptyLabel: '+ 파일 선택',
      },
    ],
    shareDefaults: {
      name: shareDefaults.name === true,
      email: shareDefaults.email === true,
      phone: shareDefaults.phone === true,
      education: shareDefaults.education === true,
      career: shareDefaults.career === true,
      resume: shareDefaults.resume === true,
    },
  };
}

function mapApplicationRow(row, exploreSessionMap) {
  const session = exploreSessionMap.get(row.job_id);
  const legacyPortfolioFile = row.portfolio_file_name
    ? {
        name: row.portfolio_file_name,
        sizeLabel: trimValue(row.portfolio_file_size_label ?? '', 32) || '0KB',
        uploadProgress: toNumber(row.portfolio_upload_progress, 0),
      }
    : null;
  const processResponses = normalizeCandidateProcessResponses(
    parseJsonField(row.process_responses_payload, []),
    session?.processes ?? [],
  );
  const fallbackProcessResponses =
    processResponses.length > 0
      ? processResponses
      : buildLegacyProcessResponses(trimValue(row.github_url ?? '', 255), legacyPortfolioFile, session?.processes ?? []);

  return {
    sessionId: row.job_id,
    status: row.status,
    humanVerified: toNumber(row.human_verified) === 1,
    eligibilityVerified: toNumber(row.eligibility_verified) === 1,
    processResponses: fallbackProcessResponses,
    githubUrl: trimValue(row.github_url ?? '', 255),
    portfolioFile: legacyPortfolioFile,
    updatedAtLabel: formatTimestamp(row.updated_at),
    session: session ?? null,
  };
}

function normalizeCandidateReportMetricAgentId(metric) {
  const directAgentId = trimValue(metric?.agentId ?? '', 40);

  if (directAgentId) {
    return directAgentId;
  }

  const metricLabel = String(metric?.label ?? '').trim().toLowerCase();

  if (metricLabel.startsWith('tech')) {
    return 'technical';
  }

  if (metricLabel.startsWith('reason')) {
    return 'reasoning';
  }

  if (metricLabel.startsWith('comm')) {
    return 'communication';
  }

  if (metricLabel.startsWith('creat')) {
    return 'creativity';
  }

  return '';
}

function getCandidateReportAgentLabel(agentId, fallbackLabel) {
  const agentLabelMap = {
    technical: 'Technical Evaluator',
    reasoning: 'Reasoning Evaluator',
    communication: 'Communication Evaluator',
    creativity: 'Creativity Evaluator',
    integrity: 'Integrity Evaluator',
  };

  return agentLabelMap[agentId] ?? fallbackLabel ?? 'Evaluation Agent';
}

function buildCandidateReportAgentScores(evaluationPayload, integrityScore) {
  const metrics = Array.isArray(evaluationPayload?.metrics) ? evaluationPayload.metrics : [];
  const metricScores = metrics.map((metric) => {
    const agentId = normalizeCandidateReportMetricAgentId(metric);
    const label = getCandidateReportAgentLabel(agentId, trimValue(metric?.label ?? '', 80));
    const weightMatch = String(metric?.label ?? '').match(/(\d+)%/);

    return {
      label,
      weightLabel: weightMatch ? `가중치 ${weightMatch[1]}%` : '가중치 반영',
      score: clampInteger(metric?.score, 0, 100, 0),
    };
  });

  metricScores.push({
    label: getCandidateReportAgentLabel('integrity'),
    weightLabel: '신뢰도 반영',
    score: clampInteger(integrityScore, 0, 100, 0),
  });

  return metricScores;
}

function buildCandidateReportImprovements(evaluationPayload) {
  const risks = Array.isArray(evaluationPayload?.risks) ? evaluationPayload.risks : [];
  const improvementTags = Array.isArray(evaluationPayload?.improvementTags) ? evaluationPayload.improvementTags : [];
  const summary = trimValue(evaluationPayload?.summary ?? '', 255) || '제출 응답을 바탕으로 보완 포인트를 정리했습니다.';
  const riskItems = risks
    .map((item) => trimValue(item, 140))
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => ({
      title: item,
      description: summary,
    }));

  if (riskItems.length > 0) {
    return riskItems;
  }

  return improvementTags
    .map((item) => trimValue(item, 80).replace(/^#+/, ''))
    .filter(Boolean)
    .slice(0, 3)
    .map((item) => ({
      title: item,
      description: summary,
    }));
}

function buildPendingCandidateReport(session, row) {
  return {
    id: `report-${row.job_id}`,
    sessionId: row.job_id,
    title: session.title,
    organization: session.organization,
    location: session.location,
    mode: session.mode,
    typeLabel: session.typeLabel,
    weights: session.weights,
    submittedAt: `제출 ${formatTimestamp(row.submitted_at ?? row.updated_at ?? row.created_at)}`,
    status: 'processing',
    statusLabel: '평가중',
    overallScore: 0,
    percentileLabel: '에이전트가 제출물을 분석하고 있습니다.',
    agentScores: [],
    strengths: [],
    improvements: [],
  };
}

function buildCandidateReports(candidateUserId, applicationRows, evaluationRows, exploreSessionMap) {
  const evaluationRowsByJobId = new Map();

  evaluationRows.forEach((row) => {
    const rows = evaluationRowsByJobId.get(row.job_id) ?? [];
    rows.push(row);
    evaluationRowsByJobId.set(row.job_id, rows);
  });

  return applicationRows
    .filter((row) => row.status === 'submitted')
    .map((row) => {
      const session = exploreSessionMap.get(row.job_id);

      if (!session) {
        return null;
      }

      const anonymousId = buildCandidateEvaluationAnonymousId(candidateUserId, row.job_id);
      const jobEvaluations = evaluationRowsByJobId.get(row.job_id) ?? [];
      const sortedEvaluations = [...jobEvaluations].sort((leftRow, rightRow) => {
        const scoreGap = toNumber(rightRow.overall_score, 0) - toNumber(leftRow.overall_score, 0);

        if (scoreGap !== 0) {
          return scoreGap;
        }

        return new Date(leftRow.created_at).getTime() - new Date(rightRow.created_at).getTime();
      });
      const evaluationRow = sortedEvaluations.find((item) => item.anonymous_id === anonymousId);

      if (!evaluationRow) {
        return buildPendingCandidateReport(session, row);
      }

      const rank = Math.max(1, sortedEvaluations.findIndex((item) => item.id === evaluationRow.id) + 1);
      const totalCount = Math.max(1, sortedEvaluations.length);
      const percentile = Math.max(1, Math.round((rank / totalCount) * 100));
      const evaluationPayload = parseJsonField(evaluationRow.evaluation_payload, {});

      return {
        id: `report-${row.job_id}`,
        sessionId: row.job_id,
        title: session.title,
        organization: session.organization,
        location: session.location,
        mode: session.mode,
        typeLabel: session.typeLabel,
        weights: session.weights,
        submittedAt: `제출 ${formatTimestamp(row.submitted_at ?? evaluationRow.created_at)}`,
        status: 'completed',
        statusLabel: '평가 완료',
        overallScore: Number(toNumber(evaluationRow.overall_score, 0).toFixed(1)),
        percentileLabel: `상위 ${percentile}% · ${rank}/${totalCount}`,
        agentScores: buildCandidateReportAgentScores(evaluationPayload, evaluationRow.integrity_score),
        strengths: Array.isArray(evaluationPayload?.strengths)
          ? evaluationPayload.strengths.map((item) => trimValue(item, 140)).filter(Boolean).slice(0, 4)
          : [],
        improvements: buildCandidateReportImprovements(evaluationPayload),
      };
    })
    .filter(Boolean);
}

function mapCandidateMatchStatus(status) {
  if (status === 'accepted') {
    return 'accepted';
  }

  if (status === 'rejected') {
    return 'rejected';
  }

  return 'pending';
}

function buildCandidateMatchingRecords(matchRows) {
  return (Array.isArray(matchRows) ? matchRows : []).map((row) => ({
    id: row.id,
    company: trimValue(row.company_name ?? '', 120),
    sessionTitle: trimValue(row.session_title ?? '', 255),
    requestTypeLabel: trimValue(row.request_type_label ?? '', 255),
    requestedAt: formatTimestamp(row.notified_at ?? row.created_at),
    status: mapCandidateMatchStatus(trimValue(row.status ?? '', 32)),
    infoFields: parseJsonField(row.info_fields_payload, []).map((field) => ({
      key: trimValue(field?.key ?? '', 40),
      label: trimValue(field?.label ?? '', 120),
      value: trimValue(field?.value ?? '', 255),
      shared: field?.shared === true,
      required: field?.required === true,
    })),
  }));
}

function normalizeCandidateMatchDecisionStatus(status) {
  if (status === 'accepted' || status === 'rejected') {
    return status;
  }

  throw new Error('지원하지 않는 매칭 응답 상태입니다.');
}

function normalizeCandidateMatchInfoFields(input) {
  const allowedFieldKeys = new Set([
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
  ]);
  const values = Array.isArray(input) ? input : [];
  const seenKeys = new Set();

  return values
    .map((field) => ({
      key: trimValue(field?.key ?? '', 40),
      label: trimValue(field?.label ?? '', 120),
      value: trimValue(field?.value ?? '', 255),
      shared: field?.shared === true,
      required: field?.required === true,
    }))
    .filter((field) => field.key && field.label && field.value && allowedFieldKeys.has(field.key))
    .filter((field) => {
      if (seenKeys.has(field.key)) {
        return false;
      }

      seenKeys.add(field.key);
      return true;
    });
}

function normalizeShareDefaults(input) {
  const defaults = input && typeof input === 'object' ? input : {};
  return {
    name: defaults.name === true,
    email: defaults.email === true,
    phone: defaults.phone === true,
    education: defaults.education === true,
    career: defaults.career === true,
    resume: defaults.resume === true,
  };
}

function normalizeFavoriteJobIds(input) {
  const values = Array.isArray(input) ? input : [];
  return [...new Set(values.map((value) => trimValue(value, 64)).filter(Boolean))].slice(0, 50);
}

function parseExperienceYears(label) {
  const match = String(label ?? '').match(/\d+/);
  return match ? clampInteger(Number(match[0]), 0, 50, 0) : 0;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeApplicationStatus(status) {
  return status === 'submitted' ? 'submitted' : 'draft';
}

function buildCandidateEvaluationAnonymousId(candidateUserId, jobId) {
  const digest = createHash('sha256')
    .update(`${jobId}:${candidateUserId}`)
    .digest('hex')
    .slice(0, 10);

  return `wid_${digest}…`;
}

function buildCandidateEvaluationResponseAnswer(process, response) {
  if (!process || !response) {
    return '';
  }

  if (isLinkSubmissionMethod(process.submissionMethod)) {
    return trimValue(response.value ?? '', 2000);
  }

  if (isTextSubmissionMethod(process.submissionMethod)) {
    return trimValue(response.value ?? '', 6000);
  }

  if (isFileSubmissionMethod(process.submissionMethod) && response.file?.name) {
    const fileName = trimValue(response.file.name, 255);
    const sizeLabel = trimValue(response.file.sizeLabel ?? '', 32);
    return sizeLabel ? `텍스트 기반 PDF: ${fileName} (${sizeLabel})` : `텍스트 기반 PDF: ${fileName}`;
  }

  return trimValue(response.value ?? '', 6000);
}

function buildCandidateEvaluationSubmission(candidateUser, profileRow, jobRow, sessionProcesses, processResponses, humanVerified) {
  const candidateUserId = toNumber(candidateUser.id);
  const processResponseRows = sessionProcesses
    .map((process) => {
      const response = processResponses.find((item) => item.processId === process.id);
      const answer = buildCandidateEvaluationResponseAnswer(process, response);

      if (!answer) {
        return null;
      }

      return {
        process,
        answer,
        sourceSnapshot: normalizeSubmissionSourceSnapshot(response?.sourceSnapshot, 0),
      };
    })
    .filter(Boolean);

  const textEntries = processResponseRows.filter((item) => isTextSubmissionMethod(item.process.submissionMethod));
  const linkEntries = processResponseRows.filter((item) => isLinkSubmissionMethod(item.process.submissionMethod));
  const fileEntries = processResponseRows.filter((item) => isFileSubmissionMethod(item.process.submissionMethod));
  const yearsExperience = clampInteger(profileRow?.years_experience, 0, 50, 0);
  const workHistorySummary = [
    trimValue(profileRow?.current_affiliation ?? '', 255),
    yearsExperience > 0 ? `${yearsExperience}년 경력` : '',
    trimValue(profileRow?.employment_type ?? '', 120),
  ]
    .filter(Boolean)
    .join(' · ');
  const profileNotes = [
    workHistorySummary,
    trimValue(profileRow?.resume_file_name ?? '', 255)
      ? `이력서 파일: ${trimValue(profileRow?.resume_file_name ?? '', 255)}`
      : '',
    trimValue(profileRow?.cover_letter_file_name ?? '', 255)
      ? `자기소개서 파일: ${trimValue(profileRow?.cover_letter_file_name ?? '', 255)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  const portfolioNotes = [
    linkEntries.length > 0
      ? `제출 링크\n${linkEntries.map((item) => `- ${item.process.name}: ${item.answer}`).join('\n')}`
      : '',
    linkEntries.some((item) => item.sourceSnapshot?.text)
      ? `링크 본문 요약\n${linkEntries
          .filter((item) => item.sourceSnapshot?.text)
          .map(
            (item) =>
              `- ${item.process.name}: ${trimValue(item.sourceSnapshot?.title ?? item.sourceSnapshot?.resolvedUrl ?? '', 160) || '본문 추출 완료'}`,
          )
          .join('\n')}`
      : '',
    fileEntries.length > 0
      ? `제출 PDF\n${fileEntries.map((item) => `- ${item.process.name}: ${item.answer}`).join('\n')}`
      : '',
    fileEntries.some((item) => item.sourceSnapshot?.text)
      ? `PDF 본문 추출\n${fileEntries
          .filter((item) => item.sourceSnapshot?.text)
          .map(
            (item) =>
              `- ${item.process.name}: ${trimValue(item.sourceSnapshot?.fileName ?? '', 160) || 'PDF'} / ${clampInteger(item.sourceSnapshot?.pageCount, 0, 10_000, 0)}페이지`,
          )
          .join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const challengePrompt = textEntries
    .map((item) => `[${item.process.name}]\n${trimValue(item.process.content ?? '', 2000)}`)
    .join('\n\n');
  const challengeAnswer = textEntries
    .map((item) => `[${item.process.name}]\n${item.answer}`)
    .join('\n\n');

  return {
    candidate: {
      anonymousId: buildCandidateEvaluationAnonymousId(candidateUserId, jobRow.id),
      label: '',
      desiredRole: trimValue(jobRow?.title ?? '', 80),
      yearsOfExperience: yearsExperience > 0 ? yearsExperience : null,
      humanVerified,
    },
    profile: {
      resumeText: profileNotes,
      portfolioText: portfolioNotes,
      workHistorySummary,
      educationSummary: trimValue(profileRow?.education_summary ?? '', 255),
      skills: [],
    },
    sources: processResponseRows
      .map((item) =>
        item.sourceSnapshot
          ? {
              ...item.sourceSnapshot,
              label: trimValue(item.process.name, 120) || item.sourceSnapshot.label,
            }
          : null,
      )
      .filter(Boolean),
    challenge: {
      prompt: challengePrompt,
      answerText: challengeAnswer,
      codeText:
        linkEntries.length > 0
          ? linkEntries.map((item) => `[${item.process.name}] ${item.answer}`).join('\n')
          : '',
      language: linkEntries.some((item) => item.answer.includes('github.com')) ? 'Repository Link' : '',
    },
    responses: processResponseRows.map((item) => ({
      question: `${trimValue(item.process.name, 120)} - ${trimValue(item.process.content, 400)}`,
      answer: item.answer,
    })),
    integritySignals: {
      focusLossCount: 0,
      tabSwitchCount: 0,
      pasteCount: 0,
      plagiarismSimilarityPercent: 0,
      styleShiftPercent: 0,
      timeTakenSeconds: 0,
      aiGeneratedProbabilityPercent: 0,
      note: '지원자 포털 제출 기반 자동 평가',
    },
  };
}

function queueCandidateSubmissionEvaluation(companyUserId, jobId, submission) {
  const candidateAnonymousId = trimValue(submission?.candidate?.anonymousId ?? '', 120);
  const queueKey = `${companyUserId}:${jobId}:${candidateAnonymousId}`;

  if (!candidateAnonymousId || pendingCandidateEvaluationJobs.has(queueKey)) {
    return;
  }

  pendingCandidateEvaluationJobs.add(queueKey);

  setTimeout(() => {
    void evaluateCandidateSubmissionForCompanyJob(companyUserId, jobId, submission)
      .catch((error) => {
        console.error('Candidate submission evaluation failed:', {
          companyUserId,
          jobId,
          candidateAnonymousId,
          error,
        });
      })
      .finally(() => {
        pendingCandidateEvaluationJobs.delete(queueKey);
      });
  }, 0);
}

function validateEligibilityAgainstJob(jobRow, credentialRow) {
  const eligibleCountries = parseJsonField(jobRow.eligible_countries, []).map((country) =>
    String(country).trim().toUpperCase(),
  );
  const documentCountryCode = String(credentialRow?.country_code ?? '').trim().toUpperCase();
  const ageOver18 = credentialRow?.age_over_18 == null ? null : toNumber(credentialRow.age_over_18) === 1;
  const ageBracket = String(credentialRow?.age_bracket ?? '').trim().toLowerCase();

  const ageEligible =
    jobRow.eligible_age === 'all'
      ? true
      : jobRow.eligible_age === 'adult'
        ? ageBracket === 'adult' || ageOver18 === true
        : ageBracket === 'minor' || ageOver18 === false;

  const countryEligible =
    eligibleCountries.length === 0
      ? true
      : Boolean(documentCountryCode) && eligibleCountries.includes(documentCountryCode);

  return {
    documentCountryCode,
    ageBracket: ageBracket || null,
    ageOver18,
    ageEligible,
    countryEligible,
    isEligible: ageEligible && countryEligible,
  };
}

function hasDocumentEligibilityClaims(credentialRow) {
  const hasCountryCode = Boolean(String(credentialRow?.country_code ?? '').trim());
  const hasAgeBracket = Boolean(String(credentialRow?.age_bracket ?? '').trim());
  const hasAgeOver18 = credentialRow?.age_over_18 != null;

  return hasCountryCode || hasAgeBracket || hasAgeOver18;
}

function jobRequiresDocumentCredential(jobRow) {
  const eligibleCountries = parseJsonField(jobRow?.eligible_countries, []).filter(Boolean);
  return String(jobRow?.eligible_age ?? 'all') !== 'all' || eligibleCountries.length > 0;
}

export async function ensureCandidatePortalSeed(candidateUser) {
  const candidateUserId = toNumber(candidateUser.id);
  const profile = await getCandidateProfileRow(candidateUserId);

  if (!profile) {
    await pool.execute(
      `
        INSERT INTO candidate_portal_profiles (
          candidate_user_id, birth_date, phone, education_summary, current_affiliation,
          language, years_experience, employment_type, resume_file_name, resume_file_size_label,
          cover_letter_file_name, cover_letter_file_size_label, share_defaults_payload, favorite_job_ids_payload
        )
        VALUES (?, '', '', '', '', '', 0, '', '', '', '', '', ?, ?)
      `,
      [
        candidateUserId,
        JSON.stringify(
          normalizeShareDefaults({
            name: true,
            email: true,
            phone: true,
            education: true,
            career: true,
            resume: true,
          }),
        ),
        JSON.stringify([]),
      ],
    );
  }
}

export async function getCandidatePortalBootstrap(candidateUser) {
  await ensureCandidatePortalSeed(candidateUser);

  const candidateUserId = toNumber(candidateUser.id);
  const [profileRow, applicationRows, exploreRows, documentCredential, matchRows] = await Promise.all([
    getCandidateProfileRow(candidateUserId),
    getCandidateApplicationRows(candidateUserId),
    getExploreJobRows(),
    getCandidateDocumentCredential(candidateUserId),
    getCandidateMatchRequestRows(candidateUserId),
  ]);

  const exploreSessions = exploreRows.map((row) => mapJobRowToExploreSession(row, row.company_name));
  const exploreSessionMap = new Map(exploreSessions.map((session) => [session.id, session]));
  const evaluationRows = await getCompanyEvaluationRowsByJobIds(applicationRows.map((row) => row.job_id));
  const favoriteSessionIds = normalizeFavoriteJobIds(parseJsonField(profileRow?.favorite_job_ids_payload, []));

  return {
    explore: {
      sessions: exploreSessions,
      favoriteSessionIds,
    },
    applications: applicationRows.map((row) => mapApplicationRow(row, exploreSessionMap)),
    settings: {
      unlocked: false,
      form: buildDefaultSettingsForm(candidateUser, profileRow),
    },
    verification: {
      documentCredential: documentCredential
        ? {
            credentialType: documentCredential.credential_type,
            issuerSchemaId:
              documentCredential.issuer_schema_id == null ? null : toNumber(documentCredential.issuer_schema_id),
            countryCode: documentCredential.country_code,
            ageBracket: documentCredential.age_bracket,
            ageOver18: documentCredential.age_over_18 == null ? null : toNumber(documentCredential.age_over_18) === 1,
            verifiedAt: formatTimestamp(documentCredential.verified_at),
          }
        : null,
    },
    dashboard: {
      reports: buildCandidateReports(candidateUserId, applicationRows, evaluationRows, exploreSessionMap),
      matching: buildCandidateMatchingRecords(matchRows),
    },
  };
}

export async function respondToCandidateMatchRequest(candidateUser, matchRequestId, input, options = {}) {
  const candidateUserId = toNumber(candidateUser.id);
  const normalizedMatchRequestId = trimValue(matchRequestId, 80);

  if (!normalizedMatchRequestId) {
    throw new Error('매칭 요청을 찾을 수 없습니다.');
  }

  const nextStatus = normalizeCandidateMatchDecisionStatus(trimValue(input?.status ?? '', 32));
  const nextInfoFields = normalizeCandidateMatchInfoFields(input?.infoFields);

  const [rows] = await pool.execute(
    `
      SELECT cmr.id, cmr.candidate_user_id, cmr.company_user_id, cmr.job_id, cmr.company_name,
             cmr.session_title, cmr.request_type_label, cmr.status, cmr.info_fields_payload,
             cmr.notified_at, cmr.created_at, cu.company_email
      FROM candidate_match_requests cmr
      INNER JOIN company_users cu ON cu.id = cmr.company_user_id
      WHERE cmr.id = ?
        AND cmr.candidate_user_id = ?
      LIMIT 1
    `,
    [normalizedMatchRequestId, candidateUserId],
  );

  const matchRow = rows[0] ?? null;

  if (!matchRow) {
    throw new Error('매칭 요청을 찾을 수 없습니다.');
  }

  if (trimValue(matchRow.status ?? '', 32) !== 'pending') {
    throw new Error('이미 응답이 완료된 매칭 요청입니다.');
  }

  if (nextStatus === 'accepted' && options.matchConsentVerified !== true) {
    throw new Error('매칭 동의 전 World ID 본인 확인이 필요합니다.');
  }

  const storedInfoFields = normalizeCandidateMatchInfoFields(parseJsonField(matchRow.info_fields_payload, []));
  const requestedSharedFieldMap = new Map(nextInfoFields.map((field) => [field.key, field.shared === true]));
  const mergedInfoFields = storedInfoFields.map((field) => ({
    ...field,
    shared: requestedSharedFieldMap.has(field.key) ? requestedSharedFieldMap.get(field.key) === true : field.shared,
  }));
  const requiredFields = mergedInfoFields.filter((field) => field.required === true);

  if (nextStatus === 'accepted' && mergedInfoFields.filter((field) => field.shared).length === 0) {
    throw new Error('공개할 정보를 한 개 이상 선택해주세요.');
  }

  if (nextStatus === 'accepted' && requiredFields.some((field) => field.shared !== true)) {
    throw new Error('기업이 필수로 요청한 정보에 모두 동의해야 매칭 공개를 진행할 수 있습니다.');
  }

  await pool.execute(
    `
      UPDATE candidate_match_requests
      SET status = ?,
          info_fields_payload = ?,
          decision_at = NOW()
      WHERE id = ?
        AND candidate_user_id = ?
    `,
    [nextStatus, JSON.stringify(mergedInfoFields), normalizedMatchRequestId, candidateUserId],
  );

  if (nextStatus === 'accepted') {
    const sharedFields = mergedInfoFields.filter((field) => field.shared);
    const companyEmail = trimValue(matchRow.company_email ?? '', 255);

    if (companyEmail) {
      await sendCompanyMatchConsentEmail({
        companyEmail,
        companyName: trimValue(matchRow.company_name ?? '', 120),
        sessionTitle: trimValue(matchRow.session_title ?? '', 255),
        sharedFields,
      });
    }
  }

  const [updatedRows] = await pool.execute(
    `
      SELECT id, company_name, session_title, request_type_label, status, info_fields_payload,
             notified_at, created_at
      FROM candidate_match_requests
      WHERE id = ?
        AND candidate_user_id = ?
      LIMIT 1
    `,
    [normalizedMatchRequestId, candidateUserId],
  );

  const record = buildCandidateMatchingRecords(updatedRows)[0] ?? null;

  if (!record) {
    throw new Error('매칭 요청 응답 결과를 불러오지 못했습니다.');
  }

  return {
    message:
      nextStatus === 'accepted'
        ? '동의한 정보가 기업에 전달되었습니다.'
        : '매칭 요청을 거절했습니다.',
    record,
  };
}

export async function saveCandidateSettings(candidateUser, input) {
  await ensureCandidatePortalSeed(candidateUser);

  const candidateUserId = toNumber(candidateUser.id);
  const form = input && typeof input === 'object' ? input : {};
  const attachments = Array.isArray(form.attachments) ? form.attachments : [];
  const resumeAttachment = attachments.find((item) => item?.id === 'resume') ?? {};
  const coverLetterAttachment = attachments.find((item) => item?.id === 'cover-letter') ?? {};
  const shareDefaults = normalizeShareDefaults(form.shareDefaults);

  await pool.execute(
    `
      UPDATE candidate_users
      SET full_name = ?
      WHERE id = ?
    `,
    [trimValue(form.name ?? candidateUser.name, 120) || candidateUser.name, candidateUserId],
  );

  await pool.execute(
    `
      UPDATE candidate_portal_profiles
      SET birth_date = ?,
          phone = ?,
          language = ?,
          education_summary = ?,
          current_affiliation = ?,
          years_experience = ?,
          employment_type = ?,
          resume_file_name = ?,
          resume_file_size_label = ?,
          cover_letter_file_name = ?,
          cover_letter_file_size_label = ?,
          share_defaults_payload = ?
      WHERE candidate_user_id = ?
    `,
    [
      trimValue(form.birthDate ?? '', 16),
      trimValue(form.phone ?? '', 32),
      trimValue(form.language ?? '', 64),
      trimValue(form.education ?? '', 255),
      trimValue(form.affiliation ?? '', 255),
      parseExperienceYears(form.careerYears),
      trimValue(form.employmentType ?? '', 120),
      trimValue(resumeAttachment.fileName ?? '', 255),
      trimValue(resumeAttachment.sizeLabel ?? '', 32),
      trimValue(coverLetterAttachment.fileName ?? '', 255),
      trimValue(coverLetterAttachment.sizeLabel ?? '', 32),
      JSON.stringify(shareDefaults),
      candidateUserId,
    ],
  );

  const profileRow = await getCandidateProfileRow(candidateUserId);

  return {
    message: '설정이 안전하게 저장되었습니다.',
    candidateUser: {
      ...candidateUser,
      name: trimValue(form.name ?? candidateUser.name, 120) || candidateUser.name,
    },
    settings: buildDefaultSettingsForm(
      { ...candidateUser, name: trimValue(form.name ?? candidateUser.name, 120) || candidateUser.name },
      profileRow,
    ),
  };
}

export async function saveCandidateFavorites(candidateUser, input) {
  await ensureCandidatePortalSeed(candidateUser);

  const candidateUserId = toNumber(candidateUser.id);
  const favoriteJobIds = normalizeFavoriteJobIds(input?.favoriteSessionIds);

  await pool.execute(
    `
      UPDATE candidate_portal_profiles
      SET favorite_job_ids_payload = ?
      WHERE candidate_user_id = ?
    `,
    [JSON.stringify(favoriteJobIds), candidateUserId],
  );

  return {
    message: favoriteJobIds.length > 0 ? '즐겨찾기가 저장되었습니다.' : '즐겨찾기가 비워졌습니다.',
    favoriteSessionIds: favoriteJobIds,
  };
}

export async function saveCandidateJobApplication(candidateUser, jobId, input, options = {}) {
  await ensureCandidatePortalSeed(candidateUser);

  const candidateUserId = toNumber(candidateUser.id);
  const job = await getJobRowById(jobId);

  if (!job) {
    throw new Error('공고를 찾을 수 없습니다.');
  }

  if (!['open', 'closing'].includes(String(job.status))) {
    throw new Error('진행 중인 공고만 저장할 수 있습니다.');
  }

  const status = normalizeApplicationStatus(input?.status);
  const sessionProcesses = sanitizeCandidateSessionProcesses(parseJsonField(job.processes_payload, []));
  const uploadedProcessFiles =
    options?.uploadedProcessFiles instanceof Map ? options.uploadedProcessFiles : new Map();
  const processResponses = await enrichCandidateProcessResponses(
    sessionProcesses,
    normalizeCandidateProcessResponses(input?.processResponses, sessionProcesses),
    uploadedProcessFiles,
    status,
  );
  const firstLinkResponse = processResponses.find((response) => {
    const process = sessionProcesses.find((item) => item.id === response.processId);
    return process && isLinkSubmissionMethod(process.submissionMethod);
  });
  const firstFileResponse = processResponses.find((response) => {
    const process = sessionProcesses.find((item) => item.id === response.processId);
    return process && isFileSubmissionMethod(process.submissionMethod);
  });
  const githubUrl = trimValue(firstLinkResponse?.value ?? '', 255);
  const portfolioFile = firstFileResponse?.file ?? null;
  const [credentialRow, profileRow] = await Promise.all([
    getCandidateDocumentCredential(candidateUserId),
    status === 'submitted' ? getCandidateProfileRow(candidateUserId) : Promise.resolve(null),
  ]);
  const humanVerified = options?.humanVerified === true;
  const eligibilityResult = jobRequiresDocumentCredential(job)
    ? credentialRow
      ? validateEligibilityAgainstJob(job, credentialRow)
      : null
    : {
        ageEligible: true,
        countryEligible: true,
        isEligible: true,
      };
  const eligibilityVerified = eligibilityResult?.isEligible === true;

  if (status === 'submitted') {
    if (!humanVerified) {
      throw new Error('제출하려면 공고 확인 단계의 World 본인 확인을 다시 완료해주세요.');
    }

    if (!eligibilityVerified) {
      throw new Error(
        credentialRow
          ? eligibilityResult?.countryEligible
            ? '연령 조건을 충족하지 않았습니다.'
            : eligibilityResult?.ageEligible
              ? '국적 조건을 충족하지 않았습니다.'
              : '연령 및 국적 조건을 충족하지 않았습니다.'
          : '제출하려면 연령 및 국적 지원 자격 인증이 필요합니다.',
      );
    }

    for (const process of sessionProcesses) {
      const response = processResponses.find((item) => item.processId === process.id);

      if (isLinkSubmissionMethod(process.submissionMethod) && !trimValue(response?.value ?? '', 255)) {
        throw new Error(`제출하려면 '${process.name}' 과정을 완료해주세요.`);
      }

      if (isLinkSubmissionMethod(process.submissionMethod) && !isValidHttpUrl(response?.value ?? '')) {
        throw new Error(`'${process.name}' 과정에는 올바른 링크를 입력해주세요.`);
      }

      if (isTextSubmissionMethod(process.submissionMethod) && !trimValue(response?.value ?? '', 4000)) {
        throw new Error(`제출하려면 '${process.name}' 과정을 완료해주세요.`);
      }

      if (isFileSubmissionMethod(process.submissionMethod) && !response?.file?.name) {
        throw new Error(`제출하려면 '${process.name}' 과정을 완료해주세요.`);
      }

      if (isFileSubmissionMethod(process.submissionMethod) && !response?.sourceSnapshot?.text) {
        throw new Error(`'${process.name}' PDF 본문을 읽지 못했습니다. 텍스트 기반 PDF를 다시 첨부해주세요.`);
      }

      if (isLinkSubmissionMethod(process.submissionMethod) && !response?.sourceSnapshot?.text) {
        throw new Error(`'${process.name}' 링크 본문을 읽지 못했습니다. 공개 접근 가능한 URL인지 확인해주세요.`);
      }
    }
  }

  await pool.execute(
    `
      INSERT INTO candidate_job_applications (
        id, candidate_user_id, job_id, status, human_verified, eligibility_verified, process_responses_payload, github_url,
        portfolio_file_name, portfolio_file_size_label, portfolio_upload_progress, submitted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        human_verified = VALUES(human_verified),
        eligibility_verified = VALUES(eligibility_verified),
        process_responses_payload = VALUES(process_responses_payload),
        github_url = VALUES(github_url),
        portfolio_file_name = VALUES(portfolio_file_name),
        portfolio_file_size_label = VALUES(portfolio_file_size_label),
        portfolio_upload_progress = VALUES(portfolio_upload_progress),
        submitted_at = VALUES(submitted_at)
    `,
    [
      `app-${randomUUID()}`,
      candidateUserId,
      jobId,
      status,
      humanVerified ? 1 : 0,
      eligibilityVerified ? 1 : 0,
      JSON.stringify(processResponses),
      githubUrl,
      trimValue(portfolioFile?.name ?? '', 255),
      trimValue(portfolioFile?.sizeLabel ?? '', 32),
      clampInteger(portfolioFile?.uploadProgress, 0, 100, 0),
      status === 'submitted' ? new Date() : null,
    ],
  );

  if (status === 'submitted') {
    const evaluationSubmission = buildCandidateEvaluationSubmission(
      candidateUser,
      profileRow,
      job,
      sessionProcesses,
      processResponses,
      humanVerified,
    );

    queueCandidateSubmissionEvaluation(toNumber(job.company_user_id), job.id, evaluationSubmission);
  }

  const applicationRows = await getCandidateApplicationRows(candidateUserId);
  const exploreRows = await getExploreJobRows();
  const exploreSessions = exploreRows.map((row) => mapJobRowToExploreSession(row, row.company_name));
  const exploreSessionMap = new Map(exploreSessions.map((session) => [session.id, session]));
  const evaluationRows = await getCompanyEvaluationRowsByJobIds(applicationRows.map((row) => row.job_id));

  return {
    message: status === 'submitted' ? '공고가 제출되었고 평가가 백그라운드에서 시작되었습니다.' : '공고가 임시 저장되었습니다.',
    applications: applicationRows.map((row) => mapApplicationRow(row, exploreSessionMap)),
    reports: buildCandidateReports(candidateUserId, applicationRows, evaluationRows, exploreSessionMap),
  };
}

export async function saveCandidateDocumentCredential(candidateUser, input) {
  const candidateUserId = toNumber(candidateUser.id);
  const claims = input?.claims && typeof input.claims === 'object' ? input.claims : {};

  await pool.execute(
    `
      INSERT INTO candidate_world_document_credentials (
        candidate_user_id, credential_kind, nullifier_hash, signal_hash, credential_type,
        issuer_schema_id, protocol_version, environment, age_bracket, age_over_18, country_code,
        raw_claims_payload, verified_at
      )
      VALUES (?, 'document', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        nullifier_hash = VALUES(nullifier_hash),
        signal_hash = VALUES(signal_hash),
        credential_type = VALUES(credential_type),
        issuer_schema_id = VALUES(issuer_schema_id),
        protocol_version = VALUES(protocol_version),
        environment = VALUES(environment),
        age_bracket = VALUES(age_bracket),
        age_over_18 = VALUES(age_over_18),
        country_code = VALUES(country_code),
        raw_claims_payload = VALUES(raw_claims_payload),
        verified_at = VALUES(verified_at)
    `,
    [
      candidateUserId,
      trimValue(input.nullifierHash ?? '', 255),
      trimValue(input.signalHash ?? '', 255),
      trimValue(input.credentialType ?? '', 64) || 'document',
      input.issuerSchemaId == null ? null : toNumber(input.issuerSchemaId),
      trimValue(input.protocolVersion ?? '', 16),
      trimValue(input.environment ?? '', 32),
      ['adult', 'minor'].includes(String(claims.ageBracket ?? '').toLowerCase())
        ? String(claims.ageBracket).toLowerCase()
        : null,
      typeof claims.ageOver18 === 'boolean' ? (claims.ageOver18 ? 1 : 0) : null,
      trimValue(claims.countryCode ?? '', 8).toUpperCase() || null,
      JSON.stringify(claims),
    ],
  );
}

export async function verifyCandidateEligibility(candidateUser, jobId) {
  const candidateUserId = toNumber(candidateUser.id);
  const [jobRow, credentialRow] = await Promise.all([
    getJobRowById(jobId),
    getCandidateDocumentCredential(candidateUserId),
  ]);

  if (!jobRow) {
    throw new Error('공고를 찾을 수 없습니다.');
  }

  if (!jobRequiresDocumentCredential(jobRow)) {
    return {
      requiresDocumentCredential: false,
      documentVerified: credentialRow != null,
      isEligible: true,
      ageEligible: true,
      countryEligible: true,
      reason: '이 공고는 별도 연령·국적 인증이 필요하지 않습니다.',
    };
  }

  if (!credentialRow) {
    return {
      requiresDocumentCredential: true,
      documentVerified: false,
      isEligible: false,
      ageEligible: false,
      countryEligible: false,
      reason: '지원 자격 인증을 위해 여권 또는 모바일 신분증 기반 World 문서 credential이 필요합니다.',
    };
  }

  if (!hasDocumentEligibilityClaims(credentialRow)) {
    return {
      requiresDocumentCredential: true,
      documentVerified: true,
      isEligible: false,
      ageEligible: false,
      countryEligible: false,
      reason: '문서 credential은 확인되었지만, 현재 공개된 증명만으로는 이 공고의 연령·국적 세부 조건을 확정할 수 없습니다.',
    };
  }

  const result = validateEligibilityAgainstJob(jobRow, credentialRow);

  return {
    requiresDocumentCredential: true,
    documentVerified: true,
    ...result,
    reason: result.isEligible
      ? '지원 자격 조건을 충족했습니다.'
      : result.countryEligible
        ? '연령 조건을 충족하지 않았습니다.'
        : result.ageEligible
          ? '국적 조건을 충족하지 않았습니다.'
          : '연령 및 국적 조건을 충족하지 않았습니다.',
  };
}
