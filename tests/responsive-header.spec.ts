import { expect, test, type Page } from '@playwright/test';
import { stubGoogleFonts } from './google-fonts-stubs';

const WIDTHS = [320, 390, 768, 834, 1024, 1280];
// Below 900px the six links and the search collapse into the menu; at 900 the
// desktop nav and search return, and at 1200 the nav icons return. Sample both
// sides of each boundary so a regression cannot hide between the widths above.
const EDGE_WIDTHS = [899, 900, 1199, 1200];
const PRIMARY_LINKS = ['Home', 'VIN Decoder', 'Catalog', 'Garage', 'Tools', 'Roadmap'];
const MOBILE_LINKS = [
  'Home',
  'VIN Decoder',
  'Catalog',
  'My Garage',
  'Recall Checklist',
  'Fleet VIN Checker',
  'Safety Tools',
  'Roadmap',
];
const SEARCH_LABEL = 'Search by VIN, part number, or model';

function headerSearch(page: Page) {
  return page
    .getByRole('search', { name: 'Vehicle search' })
    .getByRole('textbox', { name: SEARCH_LABEL });
}

function menuSearch(page: Page) {
  return page
    .getByRole('search', { name: 'Mobile vehicle search' })
    .getByRole('textbox', { name: SEARCH_LABEL });
}

async function readHeader(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const root = document.querySelector('header')!;
    const isVisible = (el: Element) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const nav = root.querySelector('nav')!;
    const toggle = root.querySelector('button[aria-label="Toggle menu"]')!;
    const search = root.querySelector('form[aria-label="Vehicle search"]')!;
    const logo = root.querySelector('a[href="/"]')!;
    const links = [...nav.querySelectorAll('a')].filter(isVisible);
    const rects = links.map(link => link.getBoundingClientRect());
    const navRect = nav.getBoundingClientRect();
    const logoRect = logo.getBoundingClientRect();
    const searchRect = search.getBoundingClientRect();

    return {
      overflow: Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      clipped: [...root.querySelectorAll('a, button, input, form')]
        .filter(isVisible)
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.left < -1 || rect.right > window.innerWidth + 1;
        }).length,
      headerHeight: Math.round(root.getBoundingClientRect().height),
      navVisible: isVisible(nav),
      toggleVisible: isVisible(toggle),
      searchVisible: isVisible(search),
      labels: links.map(link => (link.textContent ?? '').trim()),
      rows: new Set(rects.map(rect => Math.round(rect.top))).size,
      tallestLink: Math.max(0, ...rects.map(rect => Math.round(rect.height))),
      // Room the nav needs, so a regression that squeezes it cannot pass by
      // simply hiding text or letting it wrap.
      navTextFits: links.every(link => link.scrollWidth <= link.clientWidth + 1),
      navLeft: Math.round(navRect.left),
      logoRight: Math.round(logoRect.right),
      searchRight: Math.round(searchRect.right),
    };
  });
}

/**
 * Search must never be unreachable: above 900px it is the header field, below
 * 900px it is the field inside the opened menu. Returns the input so callers
 * can also check that it is usable.
 */
async function expectSearchReachable(page: Page, width: number) {
  if (width < 900) {
    const toggle = page.getByRole('button', { name: 'Toggle menu' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const input = menuSearch(page);
    await expect(input).toBeVisible();
    await expect(input).toBeEnabled();
    return input;
  }

  const input = headerSearch(page);
  await expect(input).toBeVisible();
  await expect(input).toBeEnabled();
  return input;
}

/**
 * The header carries six nav items, a search field, and a wordmark. Above
 * 900px that combination must fit on one row; below 900px the links and the
 * search collapse into the menu so no width is left without search access.
 */
test.describe('responsive header', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleFonts(page);
  });

  for (const width of WIDTHS) {
    test(`fits the header and keeps search reachable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/roadmap');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const header = await readHeader(page);

      expect(header.overflow).toBeLessThanOrEqual(0);
      expect(header.clipped).toBe(0);
      expect(header.headerHeight).toBeLessThanOrEqual(64);

      if (width < 900) {
        expect(header.navVisible).toBe(false);
        expect(header.toggleVisible).toBe(true);
      } else {
        expect(header.navVisible).toBe(true);
        expect(header.toggleVisible).toBe(false);
        expect(header.searchVisible).toBe(true);
        expect(header.labels).toEqual(PRIMARY_LINKS);
        expect(header.rows).toBe(1);
        expect(header.tallestLink).toBeLessThan(44);
        expect(header.navTextFits).toBe(true);
      }

      await expectSearchReachable(page, width);
    });
  }

  for (const width of EDGE_WIDTHS) {
    test(`keeps the header usable across the ${width}px breakpoint`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/roadmap');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const header = await readHeader(page);

      expect(header.overflow).toBeLessThanOrEqual(0);
      expect(header.clipped).toBe(0);
      expect(header.headerHeight).toBeLessThanOrEqual(64);

      if (width < 900) {
        expect(header.navVisible).toBe(false);
        expect(header.toggleVisible).toBe(true);
      } else {
        expect(header.navVisible).toBe(true);
        expect(header.toggleVisible).toBe(false);
        expect(header.searchVisible).toBe(true);
        expect(header.labels).toEqual(PRIMARY_LINKS);
        expect(header.rows).toBe(1);
        expect(header.navTextFits).toBe(true);
        // The nav must never underlap the wordmark, and the search must leave
        // the nav alone.
        expect(header.navLeft).toBeGreaterThan(header.logoRight);
        expect(header.searchRight).toBeLessThan(header.navLeft);
      }

      await expectSearchReachable(page, width);
    });
  }

  test('submits the menu search at a tablet width', async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 900 });
    await page.goto('/roadmap');

    const input = await expectSearchReachable(page, 834);
    await input.fill('civic');
    await input.press('Enter');

    await expect(page).toHaveURL(/\/search\?q=civic$/);
  });

  test('opens every mobile link inside the viewport and navigates from the menu', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/roadmap');

    const toggle = page.getByRole('button', { name: 'Toggle menu' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    const menu = page.locator('#mobile-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link')).toHaveCount(MOBILE_LINKS.length);
    await expect(menu.getByRole('textbox', { name: SEARCH_LABEL })).toBeVisible();

    const menuLayout = await page.evaluate(() => {
      const doc = document.documentElement;
      const panel = document.querySelector('#mobile-menu')!;
      const clipped = [...panel.querySelectorAll('a, input')]
        .filter(el => el.getBoundingClientRect().width > 0)
        .filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.left < -1 || rect.right > window.innerWidth + 1;
        }).length;
      return {
        overflow: Math.max(doc.scrollWidth, document.body.scrollWidth) - window.innerWidth,
        clipped,
      };
    });

    expect(menuLayout.overflow).toBeLessThanOrEqual(0);
    expect(menuLayout.clipped).toBe(0);

    await menu.getByRole('link', { name: 'Safety Tools' }).click();
    await expect(page).toHaveURL(/\/tools$/);
    await expect(page.locator('#mobile-menu')).toHaveCount(0);
  });
});
