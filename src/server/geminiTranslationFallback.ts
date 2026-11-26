export type GeminiModelRequest = { model: string };

export type GeminiFailoverEvent = {
  model: string;
  attempt: number;
  maxAttempts: number;
  status: number | null;
  nextModel?: string;
  delayMs: number;
};

export type GeminiFailoverOptions = {
  fallbackModels?: string[];
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  onRetry?: (event: GeminiFailoverEvent) => void;
};

export type GeminiProviderErrorDetails = {
  status: number;
  code: string;
  message: string;
};

const STATUS_BY_PROVIDER_CODE: Record<string, number> = {
  RESOURCE_EXHAUSTED: 429,
  UNAVAILABLE: 503,
  INTERNAL: 500,
  DEADLINE_EXCEEDED: 504,
  INVALID_ARGUMENT: 400,
  PERMISSION_DENIED: 403,
  UNAUTHENTICATED: 401,
};

function numericStatus(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d{3}$/.test(value.trim())) return Number(value);
  return 0;
}

export function getGeminiProviderErrorDetails(error: unknown): GeminiProviderErrorDetails {
  const value = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    error?: { status?: unknown; code?: unknown; message?: unknown };
  } | null;
  const nested = value?.error;
  const code = String(value?.code || nested?.code || value?.status || nested?.status || '').toUpperCase();
  const message = String(value?.message || nested?.message || error || '');
  const messageStatus = Number(message.match(/\b(408|429|500|502|503|504)\b/)?.[1]) || 0;
  const status = numericStatus(value?.status)
    || numericStatus(value?.code)
    || numericStatus(nested?.status)
    || numericStatus(nested?.code)
    || STATUS_BY_PROVIDER_CODE[code]
    || messageStatus;
  return { status, code, message };
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
const jitteredDelay = (baseMs: number, random: () => number) =>
  Math.max(1, Math.round(baseMs * (0.75 + Math.min(1, Math.max(0, random())) * 0.5)));

/**
 * Retry transient Gemini failures with bounded exponential backoff and jitter.
 * A repeated 503/UNAVAILABLE is model-capacity trouble: retry once, then move
 * through stable documented models. 429 quota/rate-limit failures are retried
 * on the same model only; switching models must not disguise exhausted quota.
 */
export async function generateContentWithModelFallback<TRequest extends GeminiModelRequest, TResponse>(
  generateContent: (request: TRequest) => Promise<TResponse>,
  request: TRequest,
  options: GeminiFailoverOptions = {},
): Promise<TResponse> {
  const fallbackModels = options.fallbackModels ?? ['gemini-4-hydrogen', 'gemini-3.5-flash-lite'];
  const models = [...new Set([request.model, ...fallbackModels].filter(Boolean))];
  const sleep = options.sleep ?? wait;
  const random = options.random ?? Math.random;
  let lastError: unknown;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await generateContent({ ...request, model } as TRequest);
      } catch (error) {
        lastError = error;
        const details = getGeminiProviderErrorDetails(error);
        const unavailable = details.status === 503;
        const retryable = unavailable || [408, 429, 500, 502, 504].includes(details.status)
          || /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|socket hang up|temporarily unavailable/i.test(details.message);

        if (!retryable) throw error;

        if (unavailable) {
          if (attempt < 2) {
            const delayMs = jitteredDelay(1500, random);
            options.onRetry?.({ model, attempt, maxAttempts: 2, status: details.status || null, delayMs });
            if (!options.onRetry) console.warn('[Bulk translation generation] Gemini model unavailable; retrying once.', {
              model, attempt, delayMs,
            });
            await sleep(delayMs);
            continue;
          }
          const nextModel = models[modelIndex + 1];
          if (nextModel) {
            console.warn('[Bulk translation generation] Gemini model unavailable; switching model.', {
              model, nextModel, status: details.status || null,
            });
            break;
          }
          throw error;
        }

        if (attempt === maxAttempts) throw error;
        const baseMs = Math.min(1500 * (2 ** (attempt - 1)), 12000);
        const delayMs = jitteredDelay(baseMs, random);
        options.onRetry?.({ model, attempt, maxAttempts, status: details.status || null, delayMs });
        if (!options.onRetry) console.warn('[Bulk translation generation] Gemini transient failure; retrying same model.', {
          model, attempt, nextAttempt: attempt + 1, maxAttempts, status: details.status || null, delayMs,
        });
        await sleep(delayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini translation failed on all configured models.');
}
