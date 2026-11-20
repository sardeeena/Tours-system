import { test, expect } from '@playwright/test';

test('booking preview does not expose pickup progression without verified catalogue data', async ({ page }) => {
  const response = await page.goto('/booking?tour=orange-bay-island-snorkeling');
  expect(response?.status()).toBeLessThan(400);

  // The Vite preview intentionally has no Supabase credentials or seeded
  // catalogue/departure data. It cannot prove live booking availability.
  // In this environment, do not mistake a missing booking step for a usable
  // booking flow or expose the next-step action.
  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.getByRole('button', { name: /Choose Pickup/i })).toHaveCount(0);
});
