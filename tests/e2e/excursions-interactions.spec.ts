import { test, expect } from '@playwright/test';

test('excursion search handles an impossible query and recovers with reset', async ({ page }) => {
  await page.goto('/excursions');
  await expect(page.getByRole('heading', { name: 'Explore Our Excursions' })).toBeVisible();
  const search = page.getByPlaceholder(/Orange Bay, Quad, Diving, Yacht/i);
  await expect(search).toBeVisible();
  await search.fill('playwright-no-such-experience-xyz');
  await expect(page.getByRole('heading', { name: 'No excursions match your selected filters' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset All Filters' }).click();
  await expect(page.getByRole('heading', { name: 'No excursions match your selected filters' })).not.toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Sort by:' })).toBeVisible();
});
