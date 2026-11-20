import { test, expect } from '@playwright/test';

test('browser-stored administrator claims cannot unlock protected admin routes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rse_active_user', JSON.stringify({
      id: 'spoofed-admin-user',
      email: 'spoofed@example.invalid',
      fullName: 'Spoofed Administrator',
      role: 'super_admin',
      roles: ['super_admin'],
      permissions: ['*'],
      isConfirmed: true,
    }));
    localStorage.setItem('rse_demo_admin', 'true');
  });

  await page.goto('/admin/bookings');

  await expect(page).toHaveURL(/\/admin\/login\?redirect=/);
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
  await expect(page.getByText('Executive Dashboard')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('rse_active_user'))).toBeNull();
});
