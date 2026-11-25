import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { stubGoogleFonts } from './google-fonts-stubs';
import { stubNhtsa } from './nhtsa-stubs';

test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

const CORE_ROUTES = [
  '/',
  '/vin',
  '/catalog',
  '/catalog/honda/civic/2020',
  '/catalog/honda/civic/2020/brakes/front-brake-pads',
  '/search?q=civic',
  '/garage',
  '/recall-center',
  '/fleet',
  '/tools',
  '/roadmap',
];

test.describe('core-route accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await stubNhtsa(page);
    await stubGoogleFonts(page);
  });

  test('skip link moves keyboard focus to the main content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  for (const route of CORE_ROUTES) {
    test(`has no serious or critical Axe violations at ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator('h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle');

      const { violations } = await new AxeBuilder({ page }).analyze();
      const serious = violations.filter(
        violation => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(
        serious.map(violation => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          targets: violation.nodes.map(node => node.target.join(' ')),
        })),
      ).toEqual([]);
    });
  }
});
