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
  await expect(page.getByRole('heading', { name: /Exclusive Private Trips|Exclusive Private Boat Trips/i })).toBeVisible();
  await expect(page.getByText(/fixed price for the entire trip|One fixed price for the entire trip/i).first()).toBeVisible();
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


test('tour detail HTML remains no-store with or without trailing slashes', async ({ page }) => {
  for (const path of [
    '/excursions/orange-bay-island-snorkeling',
    '/excursions/orange-bay-island-snorkeling/',
    '/excursions/orange-bay-island-snorkeling//',
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control']).toContain('private, no-store');
    expect(response?.headers()['cdn-cache-control']).toBe('no-store');
    expect(response?.headers()['surrogate-control']).toBe('no-store');
  }
});
