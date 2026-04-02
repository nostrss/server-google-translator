import { ErrorCode } from '../common/constants/error-codes';

export class TranslationApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TranslationApiError';
  }

  static fromProviderError(err: unknown): TranslationApiError {
    const status = extractHttpStatus(err);
    const errorType = extractErrorType(err);

    // API_KEY_REQUIRED (thrown internally, not from provider)
    if (err instanceof Error && err.message === 'API_KEY_REQUIRED') {
      return new TranslationApiError(ErrorCode.API_KEY_REQUIRED, 'API key is required for this model.');
    }

    // 401 - Invalid/expired key
    if (status === 401) {
      return new TranslationApiError(ErrorCode.API_KEY_INVALID, 'Invalid API key. Please check your key.');
    }

    // 402 - No billing / insufficient credits
    if (status === 402) {
      return new TranslationApiError(ErrorCode.API_KEY_NO_BILLING, 'Billing is not active or insufficient credits. Please check your billing settings.');
    }

    // 403 - No permission for this model
    if (status === 403) {
      return new TranslationApiError(ErrorCode.API_KEY_NO_PERMISSION, 'Your API key does not have access to this model.');
    }

    // 429 - Rate limit or quota exceeded
    if (status === 429) {
      if (errorType === 'insufficient_quota' || errorType === 'tokens') {
        return new TranslationApiError(ErrorCode.API_QUOTA_EXCEEDED, 'API quota exceeded. Please check your plan or add credits.');
      }
      return new TranslationApiError(ErrorCode.API_RATE_LIMITED, 'Rate limited. Please wait a moment and try again.');
    }

    // 5xx - Provider outage
    if (status && status >= 500) {
      return new TranslationApiError(ErrorCode.API_PROVIDER_ERROR, 'Translation provider is temporarily unavailable. Please try again later.');
    }

    // Unknown
    return new TranslationApiError(ErrorCode.TRANSLATION_ERROR, 'Translation failed. Please try again.');
  }
}

function extractHttpStatus(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;

  const record = err as Record<string, unknown>;

  // Vercel AI SDK: err.status
  if (typeof record.status === 'number') return record.status;

  // Some SDKs: err.statusCode
  if (typeof record.statusCode === 'number') return record.statusCode;

  // Nested: err.error?.status or err.response?.status
  if (typeof record.error === 'object' && record.error !== null) {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.status === 'number') return nested.status;
  }
  if (typeof record.response === 'object' && record.response !== null) {
    const nested = record.response as Record<string, unknown>;
    if (typeof nested.status === 'number') return nested.status;
  }

  // Google Cloud: err.code
  if (typeof record.code === 'number') return record.code;

  return null;
}

function extractErrorType(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;

  const record = err as Record<string, unknown>;

  // OpenAI: err.error?.type or err.type
  if (typeof record.type === 'string') return record.type;
  if (typeof record.error === 'object' && record.error !== null) {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.type === 'string') return nested.type;
    if (typeof nested.code === 'string') return nested.code;
  }

  // Anthropic: err.error?.type
  if (typeof record.code === 'string') return record.code;

  return null;
}
