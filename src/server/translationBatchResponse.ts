export type TranslationBatchIdentity = {
  entity_type: string;
  entity_key: string;
};

export type TranslationBatchRecord = TranslationBatchIdentity & Record<string, unknown>;

const identityKey = (record: TranslationBatchIdentity) => record.entity_type + ':' + record.entity_key;

/**
 * Require a one-to-one response from the translation model.
 * Missing, duplicate, malformed, or unexpected records invalidate the whole
 * batch before callers persist any drafts.
 */
export function validateTranslationBatchResponse(
  expected: TranslationBatchIdentity[],
  actual: unknown,
): Map<string, TranslationBatchRecord> {
  if (!Array.isArray(actual)) {
    throw new Error('Gemini response must contain a translations array.');
  }

  const expectedKeys = new Set<string>();
  for (const identity of expected) {
    if (!identity || typeof identity.entity_type !== 'string' || !identity.entity_type
      || typeof identity.entity_key !== 'string' || !identity.entity_key) {
      throw new Error('Translation batch contains an invalid expected source identity.');
    }
    const key = identityKey(identity);
    if (expectedKeys.has(key)) throw new Error('Translation batch contains a duplicate expected source identity: ' + key);
    expectedKeys.add(key);
  }

  const result = new Map<string, TranslationBatchRecord>();
  for (const value of actual) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Gemini returned a malformed translation record.');
    }
    const record = value as Record<string, unknown>;
    if (typeof record.entity_type !== 'string' || !record.entity_type
      || typeof record.entity_key !== 'string' || !record.entity_key) {
      throw new Error('Gemini returned a translation without a valid source identity.');
    }
    const key = identityKey(record as TranslationBatchIdentity);
    if (!expectedKeys.has(key)) throw new Error('Gemini returned an unexpected translation record: ' + key);
    if (result.has(key)) throw new Error('Gemini returned a duplicate translation record: ' + key);
    result.set(key, record as TranslationBatchRecord);
  }

  const missing = [...expectedKeys].filter((key) => !result.has(key));
  if (missing.length) throw new Error('Gemini omitted translation records: ' + missing.join(', '));
  if (result.size !== expectedKeys.size) throw new Error('Gemini translation response count does not match the requested batch.');

  return result;
}
