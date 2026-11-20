import { test, expect } from '@playwright/test';

test('homepage loads and exposes meaningful content', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page).toHaveTitle(/Awesome Adventure Tours|Adventure Tours/i);
});

test('public routes render without server errors', async ({ page }) => {
  for (const route of ['/excursions', '/about', '/contact']) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBeLessThan(500);
    await expect(page.locator('body')).not.toBeEmpty();
  }
});

test('not-found route has a rendered page', async ({ page }) => {
  const response = await page.goto('/this-route-should-not-exist-playwright');
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator('body')).not.toBeEmpty();
});
