import { expect, test } from '@playwright/test';
const pages = [
  ['/dashboard', 'Dashboard'], ['/leads', 'Leads'], ['/leads/test-lead', 'Lead details'], ['/pipeline', 'Pipeline'], ['/campaigns', 'Campaigns'], ['/meetings', 'Meetings'], ['/settings', 'Settings'],
  ['/outreach', 'Outreach review'], ['/replies', 'Reply review'], ['/follow-ups', 'Follow-ups'], ['/proposals', 'Proposals'], ['/deals', 'Deals'],
] as const;
for (const [path, heading] of pages) test(`${path} renders inside the application shell`, async ({ page }) => {
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
});
test('the root redirects to the dashboard', async ({ page }) => { await page.goto('/'); await expect(page).toHaveURL(/\/dashboard$/); });
test('assisted-mode screens never expose automated send controls', async ({ page }) => {
  for (const path of ['/outreach', '/follow-ups', '/proposals', '/deals']) {
    await page.goto(path);
    await expect(page.getByText(/send automatically|auto send|send proposal|mark won/i)).toHaveCount(0);
  }
});
