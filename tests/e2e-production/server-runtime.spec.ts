import { test, expect } from '@playwright/test';

test('production Express server serves the built public homepage and discovery headers', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.locator('#root')).not.toBeEmpty();
  expect(response?.headers()['link']).toContain('rel="alternate"');
  expect(response?.headers()['link']).toContain('/llms.txt');
});

test('production private SPA routes carry HTTP noindex directives', async ({ page }) => {
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-robots-tag']).toContain('noindex');
  expect(response?.headers()['x-robots-tag']).toContain('nofollow');
  await expect(page.locator('#root')).toBeAttached();
});

test('unknown API endpoints return JSON 404 rather than the SPA shell', async ({ request }) => {
  const response = await request.get('/api/__production-smoke-missing__');
  expect(response.status()).toBe(404);
  expect(response.headers()['content-type']).toContain('application/json');
  await expect(response.json()).resolves.toMatchObject({ success: false, error: 'API route not found' });
});

test('production PWA manifest and service worker assets are served', async ({ request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest).toHaveProperty('name');
  expect(manifest).toHaveProperty('start_url');

  const workerResponse = await request.get('/sw.js');
  expect(workerResponse.status()).toBe(200);
  expect(workerResponse.headers()['content-type']).toContain('javascript');
});
