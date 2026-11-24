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

test('Exclusive private-trip catalogue renders with fixed-price-per-trip messaging', async ({ page }) => {
  const response = await page.goto('/exclusive');
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { name: /Private boat trips/i })).toBeVisible();
  await expect(page.getByText(/price is for the whole trip, not each person/i)).toBeVisible();
});

test('not-found route has a rendered page', async ({ page }) => {
  const response = await page.goto('/this-route-should-not-exist-playwright');
  expect(response?.status()).toBeLessThan(500);
  await expect(page.locator('body')).not.toBeEmpty();
});


test('header menu stays compact across phone, tablet and laptop widths', async ({ page }) => {
  for (const width of [360, 768, 1024, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const toggle = page.locator('#mobile-menu-toggle-btn');
    await expect(toggle).toBeVisible();
    await toggle.click();

    const panel = page.locator('#mobile-navigation-menu');
    await expect(panel).toBeVisible();
    const languageSelect = page.getByRole('combobox', { name: 'Choose website language' });
    await expect(languageSelect).toBeVisible();
    await expect(languageSelect.locator('option')).toHaveCount(11);
    await expect(page.locator('header a[aria-label="Visit the Awesome Adventure Tours blog"]')).toBeVisible();
    const bounds = await panel.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeLessThanOrEqual(Math.min(width, 420));
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.height).toBeLessThan(900);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  }

  await page.setViewportSize({ width: 1536, height: 900 });
  await page.goto('/');
  await expect(page.locator('#mobile-menu-toggle-btn')).toBeHidden();
  await expect(page.getByRole('combobox', { name: 'Choose website language' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Blog' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main Navigation' })).toBeVisible();
  await expect(page.locator('header').first()).toHaveJSProperty('scrollWidth', await page.locator('header').first().evaluate((element) => element.clientWidth));
});


test('static public pages do not request the live tour catalogue', async ({ page }) => {
  const catalogueRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/\/rest\/v1\/(?:tours|destinations|categories|tour_categories)(?:\?|$)/.test(url.pathname + url.search)) {
      catalogueRequests.push(url.pathname);
    }
  });

  const response = await page.goto('/about');
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator('body')).not.toBeEmpty();
  expect(catalogueRequests).toEqual([]);
});


test('tour detail routes remain no-store with or without trailing slashes, including unavailable slugs', async ({ page }) => {
  // Use a unique non-existent slug so the test is independent of mutable
  // Supabase fixtures. The route-level no-store policy must also protect 404
  // responses and remain consistent across trailing-slash variants.
  for (const path of [
    '/excursions/playwright-no-store-cache-regression-test',
    '/excursions/playwright-no-store-cache-regression-test/',
    '/excursions/playwright-no-store-cache-regression-test//',
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    expect(response?.headers()['cache-control']).toContain('private, no-store');
    expect(response?.headers()['cdn-cache-control']).toBe('no-store');
    expect(response?.headers()['surrogate-control']).toBe('no-store');
  }
});
