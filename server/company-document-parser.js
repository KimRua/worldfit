import path from 'node:path';
import { PDFParse } from 'pdf-parse';

const companyPdfUploadMaxMegabytes = Number(process.env.COMPANY_PDF_UPLOAD_MAX_MB ?? 10);
const companyPdfExtractedTextMaxChars = Number(process.env.COMPANY_PDF_EXTRACT_MAX_CHARS ?? 30000);
const companyPdfExtractedTextMinChars = Number(process.env.COMPANY_PDF_TEXT_MIN_CHARS ?? 40);

export class CompanyPdfParseError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'CompanyPdfParseError';
    this.status = status;
  }
}

export function getCompanyPdfUploadLimitBytes() {
  return Math.max(1, companyPdfUploadMaxMegabytes) * 1024 * 1024;
}

function normalizeExtractedPdfText(value) {
  const normalized = String(value ?? '')
    .replace(/\u0000/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !/^-- \d+ of \d+ --$/.test(line))
    .join('\n');

  return normalized.trim();
}

export function normalizeCompanyPdfExtractedText(value) {
  return normalizeExtractedPdfText(value);
}

function isPdfFile(file) {
  if (!file) {
    return false;
  }

  const extension = path.extname(String(file.originalname ?? '')).toLowerCase();
  const mimeType = String(file.mimetype ?? '').toLowerCase();

  return extension === '.pdf' || mimeType === 'application/pdf';
}

export async function extractTextFromCompanyPdfFile(file, options = {}) {
  if (!file) {
    throw new CompanyPdfParseError('PDF 파일을 업로드해주세요.', 400);
  }

  if (!isPdfFile(file)) {
    throw new CompanyPdfParseError('PDF 파일만 업로드할 수 있습니다.', 400);
  }

  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new CompanyPdfParseError('업로드된 PDF 파일을 읽을 수 없습니다.', 400);
  }

  const result = await extractTextFromCompanyPdfBuffer(file.buffer, options);

  return {
    fileName: String(file.originalname ?? 'document.pdf'),
    ...result,
  };
}

export async function extractTextFromCompanyPdfBuffer(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new CompanyPdfParseError('업로드된 PDF 파일을 읽을 수 없습니다.', 400);
  }

  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    const normalizedText = normalizeExtractedPdfText(result?.text);

    if (normalizedText.length < companyPdfExtractedTextMinChars) {
      throw new CompanyPdfParseError(
        '추출 가능한 텍스트가 너무 적습니다. 텍스트 기반 PDF만 지원하며, 스캔본 PDF는 이번 범위에서 지원하지 않습니다.',
        422,
      );
    }

    const finalText = normalizedText.slice(0, companyPdfExtractedTextMaxChars);

    return {
      target: String(options.target ?? '').trim() || null,
      pageCount: Number(result?.total ?? 0),
      characterCount: normalizedText.length,
      truncated: normalizedText.length > companyPdfExtractedTextMaxChars,
      text: finalText,
    };
  } catch (error) {
    if (error instanceof CompanyPdfParseError) {
      throw error;
    }

    throw new CompanyPdfParseError(
      error instanceof Error
        ? `PDF 텍스트 추출에 실패했습니다. ${error.message}`
        : 'PDF 텍스트 추출에 실패했습니다.',
      422,
    );
  } finally {
    await parser.destroy().catch(() => {});
  }
}
