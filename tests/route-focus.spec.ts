import { test, expect, type Page } from '@playwright/test';
import { stubGoogleFonts } from './google-fonts-stubs';
import { stubNhtsa } from './nhtsa-stubs';

async function activeText(page: Page): Promise<string> {
  return page.evaluate(() =>
    (document.activeElement?.textContent || '').replace(/\s+/g, ' ').trim(),
  );
}

async function pressUntilFocused(page: Page, name: string, key: 'Tab' | 'Shift+Tab') {
  for (let press = 0; press < 80; press += 1) {
    await page.keyboard.press(key);
    if ((await activeText(page)) === name) return;
  }
  throw new Error(`Could not reach ${name} with ${key}`);
}

test.describe('SPA route focus', () => {
  test.beforeEach(async ({ page }) => {
    await stubNhtsa(page);
    await stubGoogleFonts(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('moves focus to the VIN heading after header navigation', async ({ page }) => {
    await pressUntilFocused(page, 'VIN Decoder', 'Tab');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/vin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'VIN Decoder' })).toBeFocused();
  });

  test('moves focus to the catalog heading after header navigation', async ({ page }) => {
    await pressUntilFocused(page, 'Catalog', 'Tab');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/catalog$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Browse by Brand' })).toBeFocused();
  });

  test('moves focus to the Recall Watch heading after footer navigation', async ({ page }) => {
    await page.keyboard.press('Tab');
    await pressUntilFocused(page, 'Recall Watch', 'Shift+Tab');
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/recall-center$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Recall Watch' })).toBeFocused();
  });
});
