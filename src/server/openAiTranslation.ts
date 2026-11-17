export type OpenAITranslationFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function generateOpenAITranslationBatch(
  prompt: string,
  apiKey: string,
  model = 'gpt-4o-mini',
  fetchImpl: OpenAITranslationFetch = fetch,
): Promise<string> {
  if (!apiKey.trim()) throw new Error('OpenAI translation API key is not configured.');
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, temperature: 0.15, max_tokens: 16000, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a professional localization engine. Return valid JSON only. Preserve all source facts, structure, identifiers, and protected placeholders.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error('OpenAI translation request failed with HTTP ' + response.status + '. Check API billing, model access, and server configuration.');
  const payload = await response.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }> };
  const choice = payload.choices?.[0];
  if (choice?.finish_reason === 'length') throw new Error('OpenAI translation response was truncated; retry with a smaller batch.');
  if (choice?.message?.refusal) throw new Error('OpenAI declined this translation batch.');
  const content = choice?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('OpenAI returned an empty translation batch.');
  return content;
}