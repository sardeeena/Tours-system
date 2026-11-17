import assert from 'node:assert/strict';
import {
  generateContentWithModelFallback,
  getGeminiProviderErrorDetails,
} from '../src/server/geminiTranslationFallback';

const noWait = async () => {};
const zeroJitter = () => 0.5;
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
    { sleep: noWait, random: zeroJitter },
  );
  assert.deepEqual(result, { text: 'translated' });
  assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);
}

async function testFallbackOrderUsesStableDocumentedModels() {
  const calls: string[] = [];
  await assert.rejects(() => generateContentWithModelFallback(
    async (request: { model: string }) => {
      calls.push(request.model);
      throw makeError(503, 'UNAVAILABLE');
    },
    { model: 'gemini-3.8-flash' },
    { sleep: noWait, random: zeroJitter },
  ));
  assert.deepEqual(calls, [
    'gemini-3.8-flash', 'gemini-3.8-flash',
    'gemini-3.5-flash-lite', 'gemini-3.5-flash-lite',
    'gemini-3.6-flash', 'gemini-3.6-flash',
  ]);
}

async function testQuotaDoesNotFailover() {
  const calls: string[] = [];
  await assert.rejects(() => generateContentWithModelFallback(
    async (request: { model: string }) => {
      calls.push(request.model);
      throw Object.assign(new Error('Quota exceeded'), { code: 'RESOURCE_EXHAUSTED' });
    },
    { model: 'gemini-3.8-flash' },
    { sleep: noWait, random: zeroJitter },
  ));
  assert.equal(calls.length, 4);
  assert.ok(calls.every((model) => model === 'gemini-3.8-flash'));
}

async function testRequestTimeoutRetries() {
  const calls: string[] = [];
  const result = await generateContentWithModelFallback(
    async (request: { model: string }) => {
      calls.push(request.model);
      if (calls.length === 1) throw makeError(408, 'Request timeout');
      return { ok: true };
    },
    { model: 'gemini-3.8-flash' },
    { sleep: noWait, random: zeroJitter },
  );
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, ['gemini-3.8-flash', 'gemini-3.8-flash']);
}

async function testSdkErrorCodeShapes() {
  assert.equal(getGeminiProviderErrorDetails({ code: 'UNAVAILABLE', message: 'overloaded' }).status, 503);
  assert.equal(getGeminiProviderErrorDetails({ code: 'RESOURCE_EXHAUSTED', message: 'quota' }).status, 429);
  assert.equal(getGeminiProviderErrorDetails({ status: 504, message: 'deadline' }).status, 504);
  assert.equal(getGeminiProviderErrorDetails({ error: { status: 'UNAVAILABLE', message: 'overloaded' } }).status, 503);
  assert.equal(getGeminiProviderErrorDetails({ message: 'HTTP 408 request timeout' }).status, 408);
}

async function testNonRetryableFailureDoesNotFailover() {
  const calls: string[] = [];
  await assert.rejects(() => generateContentWithModelFallback(
    async (request: { model: string }) => {
      calls.push(request.model);
      throw makeError(400, 'Invalid request');
    },
    { model: 'gemini-3.8-flash' },
    { sleep: noWait, random: zeroJitter },
  ));
  assert.deepEqual(calls, ['gemini-3.8-flash']);
}

await testCapacityFailover();
await testFallbackOrderUsesStableDocumentedModels();
await testQuotaDoesNotFailover();
await testRequestTimeoutRetries();
await testSdkErrorCodeShapes();
await testNonRetryableFailureDoesNotFailover();
console.log('Gemini translation model failover tests passed.');
