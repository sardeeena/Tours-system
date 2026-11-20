import { test, expect } from '@playwright/test';

// Use canonical routes understood by App.tsx's admin route parser. These
// paths map to real modules rather than falling back to the default dashboard.
const protectedAdminRoutes = [
  '/admin',
  '/admin/tours',
  '/admin/bookings',
  '/admin/operations/manifests',
  '/admin/finance/refunds',
  '/admin/crm/leads',
  '/admin/access-control',
  '/admin/technical',
];

for (const route of protectedAdminRoutes) {
  test(`unauthenticated access to ${route} is rejected by the shared admin guard`, async ({ page }) => {
    await page.goto(route);

    await expect(page).toHaveURL(/\/admin\/login\?redirect=/);
    await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
    await expect(page.getByText('Executive Dashboard')).toHaveCount(0);

    const redirectedPath = new URL(page.url()).searchParams.get('redirect');
    expect(redirectedPath).toBe(route);
  });
}
