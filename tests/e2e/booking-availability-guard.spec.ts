import { test, expect } from '@playwright/test';

test('booking cannot advance without a verified live departure', async ({ page }) => {
  const response = await page.goto('/booking?tour=orange-bay-island-snorkeling');
  expect(response?.status()).toBeLessThan(400);

  const continueButton = page.getByRole('button', { name: /Choose Pickup/i });
  await expect(continueButton).toBeVisible();

  // The CI preview intentionally has no live Supabase credentials or seeded
  // departure schedule. It must never let a customer progress on guessed data.
  await expect(continueButton).toBeDisabled();
  await expect(page.getByText(/currently closed|temporarily unavailable/i).first()).toBeVisible();
});
