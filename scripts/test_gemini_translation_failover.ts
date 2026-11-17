import assert from 'node:assert/strict';
import { generateContentWithModelFallback } from '../src/server/geminiTranslationFallback';

const noWait = async () => {};
const makeError = (status: number, message: string) => Object.assign(new Error(message), { status });

async function testCapacityFailover() {
  const calls: string[] = [];
  const result = await generateContentWithModelFallback(
    async (request: { model: string; prompt: string }) => {
      calls.push(request.model);
      if (request.model === 'gemini-3.8-flash') throw makeError(503, 'UNAVAILABLE: high demand');
      if (request.model === 'gemini-3.5-flash-lite') return { text: 'translated' };
      throw new Error('Unexpected model');
    },
    { model: 'gemini-3.8-flash', prompt: 'public source text' },
    { fallbackModels: ['gemini-3.5-flash-lite', 'gemini-3.7-flash'], sleep: noWait, onRetry: () => {} },
  );
  assert.deepEqual(result, { text: 'translated' });
  assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);
}

async function testQuotaDoesNotFailover() {
  const calls: string[] = [];
  await assert.rejects(() => generateContentWithModelFallback(
    async (request: { model: string }) => {
      calls.push(request.model);
      throw Object.assign(new Error('HTTP 429 RESOURCE_EXHAUSTED'), { code: 'RESOURCE_EXHAUSTED' });
    },
    { model: 'gemini-3.8-flash' },
    { fallbackModels: ['gemini-3.5-flash-lite'], sleep: noWait, onRetry: () => {} },
  ));
  assert.equal(calls.length, 4);
  assert.ok(calls.every((model) => model === 'gemini-3.8-flash'));
}

async function testNonRetryableFailureDoesNotFailover() {
  const calls: string[] = [];
  await assert.rejects(() => generateContentWithModelFallback(
    async (request: { model: string }) => {
      calls.push(request.model);
      throw makeError(400, 'Invalid request');
    },
    { model: 'gemini-3.8-flash' },
    { fallbackModels: ['gemini-3.5-flash-lite'], sleep: noWait, onRetry: () => {} },
  ));
  assert.deepEqual(calls, ['gemini-3.8-flash']);
}

async function testAllModelsUnavailable() {
  const calls: string[] = [];
  await assert.rejects(() => generateContentWithModelFallback(
    async (request: { model: string }) => {
      calls.push(request.model);
      throw makeError(503, 'UNAVAILABLE');
    },
    { model: 'gemini-3.8-flash' },
    { fallbackModels: ['gemini-3.5-flash-lite', 'gemini-3.7-flash'], sleep: noWait, onRetry: () => {} },
  ));
  assert.deepEqual(calls, [
    'gemini-3.8-flash', 'gemini-3.8-flash',
    'gemini-3.5-flash-lite', 'gemini-3.5-flash-lite',
    'gemini-3.7-flash', 'gemini-3.7-flash',
  ]);
}

await testCapacityFailover();
await testQuotaDoesNotFailover();
await testNonRetryableFailureDoesNotFailover();
await testAllModelsUnavailable();
console.log('Gemini translation model failover tests passed.');
