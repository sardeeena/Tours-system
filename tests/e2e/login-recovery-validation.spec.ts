import { test, expect } from '@playwright/test';

const isAuthenticationRequest = (url: string) =>
  /supabase|\/auth\/v1|\/api\/auth/i.test(url);

test('login rejects malformed email in the browser before contacting authentication services', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  const email = page.locator('#login-email');
  await email.fill('not-an-email');
  await page.locator('#login-password').fill('PlaywrightOnly123!');

  const authRequests: string[] = [];
  page.on('request', (request) => {
    if (isAuthenticationRequest(request.url())) authRequests.push(request.url());
  });

  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(email).toHaveJSProperty('validity.typeMismatch', true);
  expect(authRequests).toHaveLength(0);
});

test('expired recovery links offer a safe retry and reject malformed email before auth requests', async ({ page }) => {
  await page.goto('/reset-password?error=access_denied&error_description=Recovery+link+expired');

  await expect(page.getByRole('heading', { name: 'Invalid or Expired Link' })).toBeVisible();
  await page.getByRole('button', { name: 'Request New Password Reset Link' }).click();

  await expect(page.getByRole('heading', { name: 'Reset Your Password' })).toBeVisible();
  const email = page.locator('#reset-email');
  await email.fill('not-an-email');

  const authRequests: string[] = [];
  page.on('request', (request) => {
    if (isAuthenticationRequest(request.url())) authRequests.push(request.url());
  });

  await page.getByRole('button', { name: 'Send Reset Instructions' }).click();

  await expect(email).toHaveJSProperty('validity.typeMismatch', true);
  expect(authRequests).toHaveLength(0);
});
