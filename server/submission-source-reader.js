import {
  CompanyPdfParseError,
  extractTextFromCompanyPdfBuffer,
  normalizeCompanyPdfExtractedText,
} from './company-document-parser.js';

const sourceFetchTimeoutMs = Number(process.env.AGENT_SOURCE_FETCH_TIMEOUT_MS ?? 12_000);
const sourceFetchMaxChars = Number(process.env.AGENT_SOURCE_MAX_CHARS ?? 16_000);
const sourceFetchMaxBytes = Number(process.env.AGENT_SOURCE_MAX_BYTES ?? 5 * 1024 * 1024);
const sourceFetchMinChars = Number(process.env.AGENT_SOURCE_TEXT_MIN_CHARS ?? 40);

export class SubmissionSourceReadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'SubmissionSourceReadError';
    this.status = status;
  }
}

function trimText(value, limit = 255) {
  const normalized = String(value ?? '').trim();
  return normalized.length > limit ? normalized.slice(0, limit) : normalized;
}

function truncateText(value, limit = sourceFetchMaxChars) {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return { text: '', truncated: false };
  }

  return normalized.length > limit
    ? { text: normalized.slice(0, limit), truncated: true }
    : { text: normalized, truncated: false };
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeRemoteText(value) {
  return normalizeCompanyPdfExtractedText(
    decodeHtmlEntities(String(value ?? '').replace(/\u0000/g, ' ')),
  );
}

function extractHtmlTitle(html) {
  const matched = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return trimText(normalizeRemoteText(matched?.[1] ?? ''), 200);
}

function extractTextFromHtml(html) {
  const normalizedHtml = String(html ?? '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|table|tr|td|th|header|footer|main|aside|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return normalizeRemoteText(normalizedHtml);
}

function normalizeJsonText(value) {
  try {
    return normalizeRemoteText(JSON.stringify(value, null, 2));
  } catch {
    return normalizeRemoteText(String(value ?? ''));
  }
}

function buildFailureMessage(url, error) {
  const reason = error instanceof Error ? error.message : '알 수 없는 오류';
  return `URL 내용을 읽지 못했습니다: ${trimText(url, 240)} (${reason})`;
}

function assertSupportedTextLength(text, label) {
  if (text.length < sourceFetchMinChars) {
    throw new SubmissionSourceReadError(`${label}에서 읽을 수 있는 본문이 너무 적습니다.`, 422);
  }
}

export function normalizeSubmissionSourceSnapshot(source, index = 0) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const kind = source.kind === 'pdf' ? 'pdf' : source.kind === 'url' ? 'url' : '';

  if (!kind) {
    return null;
  }

  const normalizedText = normalizeRemoteText(source.text ?? '');
  const truncatedText = truncateText(normalizedText);

  return {
    kind,
    label: trimText(source.label ?? '', 120) || `자료 ${index + 1}`,
    originalUrl: kind === 'url' ? trimText(source.originalUrl ?? source.url ?? '', 2048) : '',
    resolvedUrl: kind === 'url' ? trimText(source.resolvedUrl ?? '', 2048) : '',
    title: trimText(source.title ?? '', 200),
    contentType: trimText(source.contentType ?? '', 120),
    fileName: kind === 'pdf' ? trimText(source.fileName ?? '', 255) : '',
    pageCount: kind === 'pdf' ? Number(source.pageCount ?? 0) || 0 : 0,
    characterCount: Number(source.characterCount ?? normalizedText.length) || normalizedText.length,
    truncated: source.truncated === true || truncatedText.truncated,
    text: truncatedText.text,
  };
}

export async function readSubmissionUrlSource(url, options = {}) {
  const normalizedUrl = trimText(url, 2048);

  if (!normalizedUrl) {
    throw new SubmissionSourceReadError('읽을 URL이 비어 있습니다.', 400);
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    throw new SubmissionSourceReadError(`올바른 URL 형식이 아닙니다: ${normalizedUrl}`, 400);
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new SubmissionSourceReadError(`지원하지 않는 URL 프로토콜입니다: ${normalizedUrl}`, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, sourceFetchTimeoutMs));

  try {
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/pdf,text/plain,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': 'VerifitSourceReader/1.0',
      },
    });

    if (!response.ok) {
      throw new SubmissionSourceReadError(`URL 응답이 정상이 아닙니다. HTTP ${response.status}`, 422);
    }

    const contentType = trimText(response.headers.get('content-type') ?? '', 120).toLowerCase();
    const contentLength = Number(response.headers.get('content-length') ?? 0);

    if (Number.isFinite(contentLength) && contentLength > sourceFetchMaxBytes) {
      throw new SubmissionSourceReadError('URL 문서 크기가 너무 커서 읽을 수 없습니다.', 422);
    }

    if (contentType.includes('application/pdf') || normalizedUrl.toLowerCase().endsWith('.pdf')) {
      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length > sourceFetchMaxBytes) {
        throw new SubmissionSourceReadError('PDF 문서 크기가 너무 커서 읽을 수 없습니다.', 422);
      }

      const pdf = await extractTextFromCompanyPdfBuffer(buffer, {
        target: options.target ?? 'url',
      });

      return normalizeSubmissionSourceSnapshot(
        {
          kind: 'pdf',
          label: options.label,
          originalUrl: normalizedUrl,
          resolvedUrl: response.url || normalizedUrl,
          contentType,
          fileName:
            trimText(parsedUrl.pathname.split('/').filter(Boolean).pop() ?? '', 255) || 'remote-document.pdf',
          pageCount: pdf.pageCount,
          characterCount: pdf.characterCount,
          truncated: pdf.truncated,
          text: pdf.text,
        },
        0,
      );
    }

    let text = '';
    let title = '';

    if (contentType.includes('application/json')) {
      text = normalizeJsonText(await response.json());
    } else {
      const rawText = await response.text();
      title = contentType.includes('text/html') ? extractHtmlTitle(rawText) : '';
      text = contentType.includes('text/html') ? extractTextFromHtml(rawText) : normalizeRemoteText(rawText);
    }

    assertSupportedTextLength(text, 'URL');
    const truncatedText = truncateText(text);

    return normalizeSubmissionSourceSnapshot(
      {
        kind: 'url',
        label: options.label,
        originalUrl: normalizedUrl,
        resolvedUrl: response.url || normalizedUrl,
        title,
        contentType,
        characterCount: text.length,
        truncated: truncatedText.truncated,
        text: truncatedText.text,
      },
      0,
    );
  } catch (error) {
    if (error instanceof SubmissionSourceReadError || error instanceof CompanyPdfParseError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new SubmissionSourceReadError('URL 문서를 읽는 시간이 초과되었습니다.', 504);
    }

    throw new SubmissionSourceReadError(buildFailureMessage(normalizedUrl, error), 422);
  } finally {
    clearTimeout(timeout);
  }
}
