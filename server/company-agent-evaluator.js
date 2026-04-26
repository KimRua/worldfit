const openAiApiKey = process.env.OPENAI_API_KEY?.trim() ?? '';
const openAiApiBaseUrl = process.env.OPENAI_API_BASE_URL?.trim() || 'https://api.openai.com/v1';
const openAiEvalModel = process.env.OPENAI_EVAL_MODEL?.trim() || 'gpt-5-mini';
const openAiEvalFallbackModel =
  process.env.OPENAI_EVAL_FALLBACK_MODEL?.trim() || 'gpt-4o-mini';

const supportedAgentProfiles = {
  technical: {
    name: 'Technical Evaluator',
    focus:
      '기술 정확성, 설계 품질, 코드 품질, 디버깅/테스트 관점, 트레이드오프 판단을 평가합니다.',
    rubric: [
      '문제와 요구사항을 기술적으로 정확하게 해석했는지',
      '설계/구조/테스트 관점의 판단이 현실적인지',
      '코드가 있다면 유지보수성, 안정성, 오류 가능성을 짚는지',
      '근거 없는 과장 없이 실제 증거 위주로 판단하는지',
    ],
  },
  reasoning: {
    name: 'Reasoning Evaluator',
    focus:
      '문제 정의, 가정 설정, 우선순위화, 원인-결과 연결, 대안 비교 등 사고 구조를 평가합니다.',
    rubric: [
      '문제를 단계적으로 분해하는지',
      '가정과 제약을 명확히 인식하는지',
      '결론으로 가는 논리 연결이 자연스러운지',
      '불확실한 부분을 과신하지 않고 다루는지',
    ],
  },
  communication: {
    name: 'Communication Evaluator',
    focus:
      '설명의 명확성, 구조화, 독자 배려, 간결함과 설득력을 평가합니다.',
    rubric: [
      '핵심 메시지가 빠르게 전달되는지',
      '문장이 이해하기 쉽고 구조가 정리되어 있는지',
      '기술/비기술 이해관계자 모두를 고려하는지',
      '장황함보다 전달력을 우선하는지',
    ],
  },
  creativity: {
    name: 'Creativity Evaluator',
    focus:
      '접근의 독창성, 차별화, 대안 탐색 폭, 제안의 신선함을 평가합니다. 단, 실현 가능성 없는 참신함은 고평가하지 않습니다.',
    rubric: [
      '익숙한 답을 반복하지 않고 대안을 탐색하는지',
      '새로운 관점이나 차별화 포인트가 있는지',
      '아이디어가 실제 문제 해결과 연결되는지',
      '독창성과 실행 가능성의 균형을 갖췄는지',
    ],
  },
  integrity: {
    name: 'Integrity Monitor',
    focus:
      '제출물의 신뢰성, 일관성, 표절/대필 의심 신호, 행동 로그 기반 이상 징후를 보수적으로 평가합니다. 높은 점수는 무결성이 안정적이라는 뜻입니다.',
    rubric: [
      '제공된 행동 신호와 텍스트가 자연스럽게 이어지는지',
      '표절/대필/비정상 자동화 의심 신호가 있는지',
      '의심 근거가 약하면 과도하게 단정하지 않는지',
      '추가 검토 필요성과 실제 위험도를 구분하는지',
    ],
  },
};

const evaluationResponseSchema = {
  type: 'object',
  properties: {
    score: {
      type: 'number',
      minimum: 0,
      maximum: 100,
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 100,
    },
    summary: {
      type: 'string',
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    risks: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
    evidence: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 5,
    },
    improvementTags: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 4,
    },
  },
  required: ['score', 'confidence', 'summary', 'strengths', 'risks', 'evidence', 'improvementTags'],
  additionalProperties: false,
};

export class CompanyAgentEvaluationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CompanyAgentEvaluationError';
    this.status = status;
  }
}

export function getSupportedCompanyEvaluationAgentIds() {
  return Object.keys(supportedAgentProfiles);
}

export function isCompanyAgentEvaluationConfigured() {
  return Boolean(openAiApiKey);
}

function clampScore(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function trimText(value, limit = 240) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '';
  }

  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function normalizeList(values, limit = 4, itemLimit = 120) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => trimText(value, itemLimit))
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeImprovementTags(values) {
  return normalizeList(values, 4, 48).map((value) => {
    const plainValue = value.replace(/^#+/, '').trim();
    return plainValue ? `#${plainValue}` : '';
  }).filter(Boolean);
}

function truncateText(value, limit) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return '';
  }

  return normalized.length > limit ? `${normalized.slice(0, limit)}\n...[truncated]` : normalized;
}

function formatArray(values, emptyLabel = '없음') {
  if (!Array.isArray(values) || values.length === 0) {
    return emptyLabel;
  }

  return values.map((value) => `- ${value}`).join('\n');
}

function formatSubmissionSources(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return '없음';
  }

  return sources
    .map((source, index) => {
      const heading = source.kind === 'pdf' ? `PDF 자료 ${index + 1}` : `URL 자료 ${index + 1}`;
      const detailLines = [
        `라벨: ${trimText(source.label, 120) || '미제공'}`,
        source.kind === 'pdf'
          ? `파일: ${trimText(source.fileName, 160) || '미제공'} / ${Math.max(0, Number(source.pageCount ?? 0) || 0)}페이지`
          : `원본 URL: ${trimText(source.originalUrl, 240) || '미제공'}`,
        source.kind === 'url' && source.resolvedUrl
          ? `최종 URL: ${trimText(source.resolvedUrl, 240)}`
          : '',
        source.contentType ? `콘텐츠 유형: ${trimText(source.contentType, 80)}` : '',
        source.title ? `제목: ${trimText(source.title, 160)}` : '',
        `본문:\n${truncateText(source.text, 8000) || '미제공'}`,
      ].filter(Boolean);

      return `[${heading}]\n${detailLines.join('\n')}`;
    })
    .join('\n\n');
}

function buildSubmissionPrompt(submission) {
  const skills = Array.isArray(submission.profile.skills) ? submission.profile.skills : [];
  const responses = Array.isArray(submission.responses) ? submission.responses : [];
  const responseBlock =
    responses.length > 0
      ? responses
          .map(
            (item, index) =>
              `[문답 ${index + 1}]\n질문: ${truncateText(item.question, 500)}\n답변: ${truncateText(item.answer, 2400)}`,
          )
          .join('\n\n')
      : '없음';

  return [
    `익명 지원자 ID: ${submission.candidate.anonymousId}`,
    `사람 인증 여부: ${submission.candidate.humanVerified ? '인증됨' : '미인증/미제공'}`,
    `지원 역할: ${trimText(submission.candidate.desiredRole, 80) || '미제공'}`,
    `경력 연차: ${submission.candidate.yearsOfExperience == null ? '미제공' : `${submission.candidate.yearsOfExperience}년`}`,
    `보유 스킬:\n${formatArray(skills, '미제공')}`,
    `이력서/프로필:\n${truncateText(submission.profile.resumeText, 6000) || '미제공'}`,
    `경력 요약:\n${truncateText(submission.profile.workHistorySummary, 2500) || '미제공'}`,
    `학력 요약:\n${truncateText(submission.profile.educationSummary, 2000) || '미제공'}`,
    `포트폴리오 요약:\n${truncateText(submission.profile.portfolioText, 4000) || '미제공'}`,
    `실제 제출 자료 본문:\n${formatSubmissionSources(submission.sources)}`,
    `과제 문제:\n${truncateText(submission.challenge.prompt, 2500) || '미제공'}`,
    `과제 답변:\n${truncateText(submission.challenge.answerText, 6000) || '미제공'}`,
    `제출 코드 (${trimText(submission.challenge.language, 40) || '언어 미상'}):\n${truncateText(submission.challenge.codeText, 12000) || '미제공'}`,
    `추가 문답:\n${responseBlock}`,
    `무결성 신호:\n${JSON.stringify(submission.integritySignals, null, 2)}`,
  ].join('\n\n');
}

function buildJobPrompt(jobContext) {
  return [
    `공고명: ${jobContext.title}`,
    `공고 유형: ${jobContext.sessionType}`,
    `짧은 설명: ${jobContext.description || '미제공'}`,
    `상세 설명:\n${truncateText(jobContext.detailedDescription, 5000) || '미제공'}`,
    `평가 초점:\n${jobContext.evaluationCriteria.focus || '미제공'}`,
    `중점 강점:\n${jobContext.evaluationCriteria.strengths || '미제공'}`,
    `중점 리스크:\n${jobContext.evaluationCriteria.risks || '미제공'}`,
    `진행 프로세스:\n${formatArray(jobContext.processes.map((process) => `${process.name}: ${process.content} (${process.submissionMethod})`), '미제공')}`,
  ].join('\n\n');
}

function buildSystemPrompt(agentId) {
  const profile = supportedAgentProfiles[agentId];

  return [
    `You are ${profile.name}.`,
    'Return the evaluation in Korean.',
    'Judge only from the provided evidence. If evidence is insufficient, lower confidence instead of hallucinating.',
    'A score near 100 means excellent fit in the target dimension.',
    'For Integrity Monitor, a score near 100 means the submission looks trustworthy and low-risk.',
    'improvementTags must be short Korean hashtag labels such as #테스트_전략_보강 or #근거_명확화.',
    'Do not produce markdown. Keep strengths, risks, evidence, and tags concise and concrete.',
  ].join(' ');
}

function buildUserPrompt(agentId, jobContext, submission) {
  const profile = supportedAgentProfiles[agentId];

  return [
    `[평가 역할]\n${profile.focus}`,
    `[세부 기준]\n${formatArray(profile.rubric)}`,
    `[공고 정보]\n${buildJobPrompt(jobContext)}`,
    `[지원자 제출물]\n${buildSubmissionPrompt(submission)}`,
    '[출력 지침]\nscore는 0-100 정수 범위로, confidence는 판단 확신도입니다. strengths/risks/evidence/improvementTags는 증거 기반으로만 작성하세요.',
  ].join('\n\n');
}

function extractOutputText(payload) {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  if (!Array.isArray(payload.output)) {
    return '';
  }

  const chunks = [];

  for (const item of payload.output) {
    if (!Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (typeof content?.text === 'string') {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join('\n').trim();
}

function extractFirstJsonObject(text) {
  const source = String(text ?? '');
  const start = source.indexOf('{');

  if (start < 0) {
    return '';
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === '\\') {
        escaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      depth += 1;
      continue;
    }

    if (character === '}') {
      depth -= 1;

      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return '';
}

function parseStructuredJsonText(outputText) {
  const codeBlockMatch = outputText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const firstJsonObject = extractFirstJsonObject(outputText);
  const parseCandidates = [
    outputText,
    codeBlockMatch?.[1]?.trim() ?? '',
    firstJsonObject,
  ].filter(Boolean);

  for (const candidate of parseCandidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  console.error('OpenAI structured output parse failure:', outputText.slice(0, 1200));
  throw new CompanyAgentEvaluationError('OpenAI 평가 결과를 JSON으로 해석하지 못했습니다.', 502);
}

async function requestStructuredEvaluation(agentId, jobContext, submission, modelName) {
  if (!isCompanyAgentEvaluationConfigured()) {
    throw new CompanyAgentEvaluationError('OPENAI_API_KEY가 설정되지 않아 실제 에이전트 평가를 실행할 수 없습니다.', 400);
  }

  if (!supportedAgentProfiles[agentId]) {
    throw new CompanyAgentEvaluationError(`지원하지 않는 평가 에이전트입니다: ${agentId}`, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(`${openAiApiBaseUrl.replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: buildSystemPrompt(agentId) }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: buildUserPrompt(agentId, jobContext, submission) }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: `company_${agentId}_evaluation`,
            schema: evaluationResponseSchema,
            strict: true,
          },
        },
        max_output_tokens: 2000,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const upstreamMessage =
        payload?.error?.message ||
        payload?.message ||
        `OpenAI API returned ${response.status}`;
      throw new CompanyAgentEvaluationError(
        `OpenAI 평가 호출에 실패했습니다. ${upstreamMessage} (model: ${modelName})`,
        502,
      );
    }

    if (payload?.refusal) {
      throw new CompanyAgentEvaluationError(
        `모델이 평가 요청을 거절했습니다. 입력 데이터 구성을 다시 확인해주세요. (model: ${modelName})`,
        422,
      );
    }

    const outputText = extractOutputText(payload);

    if (!outputText) {
      throw new CompanyAgentEvaluationError(
        `OpenAI 평가 결과를 비어 있는 응답으로 받았습니다. (model: ${modelName})`,
        502,
      );
    }

    const parsed = parseStructuredJsonText(outputText);

    return {
      score: clampScore(parsed.score),
      confidence: clampScore(
        Number(parsed.confidence) <= 1 ? Number(parsed.confidence) * 100 : parsed.confidence,
        60,
      ),
      summary: trimText(parsed.summary, 280),
      strengths: normalizeList(parsed.strengths, 4, 140),
      risks: normalizeList(parsed.risks, 4, 140),
      evidence: normalizeList(parsed.evidence, 5, 180),
      improvementTags: normalizeImprovementTags(parsed.improvementTags),
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new CompanyAgentEvaluationError('OpenAI 평가 요청 시간이 초과되었습니다.', 504);
    }

    if (error instanceof CompanyAgentEvaluationError) {
      throw error;
    }

    throw new CompanyAgentEvaluationError(
      error instanceof Error ? error.message : 'OpenAI 평가 요청 중 알 수 없는 오류가 발생했습니다.',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function evaluateSubmissionWithCompanyAgent({ agentId, jobContext, submission }) {
  const modelCandidates = [openAiEvalModel];

  if (openAiEvalFallbackModel && openAiEvalFallbackModel !== openAiEvalModel) {
    modelCandidates.push(openAiEvalFallbackModel);
  }

  let lastError = null;

  for (const modelName of modelCandidates) {
    try {
      return await requestStructuredEvaluation(agentId, jobContext, submission, modelName);
    } catch (error) {
      lastError = error;

      const shouldRetryWithNextModel =
        error instanceof CompanyAgentEvaluationError &&
        error.status >= 500 &&
        modelName !== modelCandidates[modelCandidates.length - 1];

      if (!shouldRetryWithNextModel) {
        throw error;
      }
    }
  }

  throw lastError ?? new CompanyAgentEvaluationError('OpenAI 평가 요청에 실패했습니다.', 502);
}
