import { test, expect } from '@playwright/test';

test('excursion search clears an impossible query when filters are reset', async ({ page }) => {
  await page.goto('/excursions');
  await expect(page.getByRole('heading', { name: 'Explore Our Excursions' })).toBeVisible();

  const search = page.getByPlaceholder(/Orange Bay, quad biking, diving/i);
  await expect(search).toBeVisible();
  await search.fill('playwright-no-such-experience-xyz');
  await expect(page.getByRole('heading', { name: 'No excursions match your selected filters' })).toBeVisible();

  await page.getByRole('button', { name: 'Reset All Filters' }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Sort by:' })).toBeVisible();
});
