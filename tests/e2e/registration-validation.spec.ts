import { test, expect } from '@playwright/test';

test('registration rejects mismatched passwords before contacting authentication services', async ({ page }) => {
  await page.goto('/register');

  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

  await page.getByLabel(/Full Name/).fill('Playwright Test Guest');
  await page.getByLabel(/Email Address/).fill('playwright-validation@example.test');
  await page.getByLabel(/Create Password/).fill('StrongPass123!');
  await page.getByLabel('Confirm Password *').fill('DifferentPass123!');

  const authRequests: string[] = [];
  page.on('request', (request) => {
    if (/supabase|\/auth\/v1|\/api\/auth/i.test(request.url())) {
      authRequests.push(request.url());
    }
  });

  await page.getByRole('button', { name: 'Create Account & Send Verification Email' }).click();

  await expect(page.getByText('Passwords do not match. Please re-enter.')).toBeVisible();
  expect(authRequests).toHaveLength(0);
});
