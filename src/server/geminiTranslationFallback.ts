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
  onRetry?: (event: GeminiFailoverEvent) => void;
};

function errorDetails(error: unknown): { status: number; message: string } {
  const value = error as { status?: unknown; code?: unknown; message?: unknown } | null;
  const message = String(value?.message || error || '');
  const status = Number(value?.status || value?.code || message.match(/\b(429|500|502|503|504)\b/)?.[1] || 0);
  return { status, message };
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Retry transient Gemini failures. A repeated 503/UNAVAILABLE is treated as
 * model capacity trouble and moves to a documented translation-capable model.
 * Quota/rate-limit failures remain on the same model so model switching cannot
 * disguise a project-wide quota exhaustion.
 */
export async function generateContentWithModelFallback<TRequest extends GeminiModelRequest, TResponse>(
  generateContent: (request: TRequest) => Promise<TResponse>,
  request: TRequest,
  options: GeminiFailoverOptions = {},
): Promise<TResponse> {
  const fallbackModels = options.fallbackModels ?? ['gemini-3.5-flash-lite', 'gemini-3.7-flash'];
  const models = [...new Set([request.model, ...fallbackModels].filter(Boolean))];
  const sleep = options.sleep ?? wait;
  let lastError: unknown;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const model = models[modelIndex];
    const isFallback = modelIndex > 0;
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await generateContent({ ...request, model } as TRequest);
      } catch (error) {
        lastError = error;
        const details = errorDetails(error);
        const unavailable = details.status === 503 || /UNAVAILABLE|high demand/i.test(details.message);
        const retryable = unavailable || [429, 500, 502, 504].includes(details.status)
          || /ECONNRESET|ETIMEDOUT|EAI_AGAIN|temporarily unavailable/i.test(details.message);

        if (!retryable) throw error;

        // A 503 is model-capacity-specific: make one short retry, then fail over.
        // 429 is quota/rate limiting and must not be hidden by switching models.
        if (unavailable) {
          if (attempt < 2) {
            const delayMs = 1500;
            options.onRetry?.({ model, attempt, maxAttempts: 2, status: details.status || null, delayMs });
            if (!options.onRetry) console.warn('[Bulk translation generation] Gemini model unavailable; retrying once.', { model, attempt, delayMs, isFallback });
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
        const delayMs = Math.min(1500 * (2 ** (attempt - 1)), 12000);
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
