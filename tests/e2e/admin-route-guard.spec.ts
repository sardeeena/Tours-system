import { test, expect } from '@playwright/test';

test('unauthenticated visitors are redirected from protected admin routes to admin sign-in', async ({ page }) => {
  await page.goto('/admin/bookings');

  await expect(page).toHaveURL(/\\/admin\\/login\\?redirect=/);
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to Public Website' })).toBeVisible();
  await expect(page.getByText('Executive Dashboard')).toHaveCount(0);
});

test('admin sign-in return link takes visitors back to the public homepage', async ({ page }) => {
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();

  await page.getByRole('button', { name: 'Return to Public Website' }).click();
  await expect(page).toHaveURL(/\\/$/);
  await expect(page).toHaveTitle(/Awesome Adventure Tours|Adventure Tours/i);
});
