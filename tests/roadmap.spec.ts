import { expect, test } from '@playwright/test';
import { stubGoogleFonts } from './google-fonts-stubs';
import { stubNhtsa } from './nhtsa-stubs';

test.describe('product roadmap and paid placeholders', () => {
  test.beforeEach(async ({ page }) => {
    await stubNhtsa(page);
    await stubGoogleFonts(page);
  });

  test('shows all three phases and marks licensed or paid work as coming soon', async ({ page }) => {
    await page.goto('/roadmap');

    await expect(
      page.getByRole('heading', { level: 1, name: 'What is live, and what comes next' }),
    ).toBeVisible();

    for (const name of ['Credibility & focus', 'Core coverage', 'Retention & commercial']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }

    await expect(
      page.getByRole('article').getByText('Coming soon', { exact: true }),
    ).toHaveCount(9);

    const licensed = page
      .getByRole('article')
      .filter({ hasText: 'Licensed 25–50 vehicle coverage' });
    await expect(licensed.getByText('Coming soon', { exact: true })).toBeVisible();
    await expect(licensed.getByText(/licensed parts-data agreement/i)).toBeVisible();

    const pricing = page.getByRole('article').filter({ hasText: 'Live pricing & availability' });
    await expect(pricing.getByText('Coming soon', { exact: true })).toBeVisible();
    await expect(pricing.getByText(/distributor feed subscription/i)).toBeVisible();

    await expect(page.getByRole('link', { name: /Search parts/ }).first()).toBeVisible();
  });

  test('keeps licensed and paid surfaces visible but explicitly labeled', async ({ page }) => {
    await page.goto('/catalog/honda/civic/2020/brakes/front-brake-pads');
    await expect(page.getByRole('heading', { name: 'Price & availability' })).toBeVisible();
    await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();

    await page.goto('/garage');
    await expect(page.getByText('Accounts & cloud sync')).toBeVisible();
    await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();

    await page.goto('/recall-center');
    await expect(page.getByText('Background monitoring & email alerts')).toBeVisible();
    await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();

    await page.goto('/fleet');
    await expect(page.getByText('Fleet API & partner integrations')).toBeVisible();
    await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();

    await page.goto('/catalog');
    await expect(page.getByText('Licensed coverage expansion')).toBeVisible();
    await expect(page.getByText('Coming soon', { exact: true })).toBeVisible();
  });

  test('opens the roadmap from Tools', async ({ page }) => {
    await page.goto('/tools');
    await page.getByRole('link', { name: /Open the roadmap/i }).click();

    await expect(page).toHaveURL(/\/roadmap$/);
    await expect(page.getByRole('link', { name: 'Roadmap' }).first()).toBeVisible();
  });
});
