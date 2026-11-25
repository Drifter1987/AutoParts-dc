import { expect, test } from '@playwright/test';
import { stubGoogleFonts } from './google-fonts-stubs';

const CIVIC_FILTER = 'vehicle=honda%2Fcivic%2F2020';

test.describe('fitment-first parts search', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleFonts(page);
    await page.goto(`/search?q=spark%20plug&${CIVIC_FILTER}&engine=2.0L&trim=LX`);
  });

  test('shows the result with fitment context before the filter is enabled', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Spark Plug/ }).first()).toBeVisible();
    await expect(page.getByLabel('Filter parts by engine')).toHaveValue('2.0L');
    await expect(page.getByLabel('Filter parts by trim')).toHaveValue('LX');
    await expect(
      page.getByLabel('Only show parts that fit the selected engine and trim'),
    ).not.toBeChecked();
  });

  test('removes parts that do not fit the selected engine and trim', async ({ page }) => {
    const fitOnly = page.getByLabel(
      'Only show parts that fit the selected engine and trim',
    );
    await fitOnly.click();

    await expect(page).toHaveURL(/fit=1/);
    await expect(fitOnly).toBeChecked();
    await expect(page.getByRole('link', { name: /Spark Plug/ })).toHaveCount(0);
    await expect(page.getByText(/No parts match .* selected fitment/i)).toBeVisible();
  });
});
