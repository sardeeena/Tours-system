import { test, expect } from '@playwright/test';

const tourSlug = 'afternoon-desert-safari-with-echo-mountains-bedouin-village';
const tourPath = `/excursions/${tourSlug}`;
const tabIds = ['overview', 'itinerary', 'included', 'details', 'reviews'] as const;
const tabNames = ['Overview', 'Itinerary', 'Included', 'Details & FAQ', 'Reviews'];

test('excursion information tabs switch accessibly at mobile, tablet and desktop widths', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(tourPath);

    for (let index = 0; index < tabIds.length; index += 1) {
      const tab = page.getByRole('tab', { name: tabNames[index] });
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator(`#tour-tab-panel-${tabIds[index]}`)).toBeVisible();
    }

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content, `horizontal overflow at ${viewport.width}px`)
      .toBeLessThanOrEqual(dimensions.viewport + 2);
  }
});

test('excursion tabs support arrow-key navigation and expose one selected tab', async ({ page }) => {
  await page.goto(tourPath);
  const overview = page.getByRole('tab', { name: 'Overview' });
  await overview.focus();
  await page.keyboard.press('ArrowRight');

  await expect(page.getByRole('tab', { name: 'Itinerary' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tour-tab-panel-itinerary')).toBeVisible();
  await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);
});

test('booking progress presents four clear stages on mobile without submitting a reservation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/booking?tour=${tourSlug}`);

  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemin', '1');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '4');
  await expect(page.getByText('Your Excursion')).toBeVisible();
  await expect(page.getByText(/Stage 1 of 4/)).toBeVisible();
});
