import { test, expect } from '@playwright/test';

test('public pages do not throw uncaught browser exceptions', async ({ page }) => {
  const exceptions: string[] = [];
  page.on('pageerror', error => exceptions.push(error.message));

  for (const route of ['/', '/excursions', '/about', '/contact']) {
    await page.goto(route);
    await expect(page.locator('body')).not.toBeEmpty();
  }

  expect(exceptions, exceptions.join('\n')).toEqual([]);
});

test('homepage renders at mobile and desktop viewport widths without horizontal overflow', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('body')).not.toBeEmpty();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.viewport + 2);
  }
});
