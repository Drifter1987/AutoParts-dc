import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { stubGoogleFonts } from './google-fonts-stubs';
import { stubNhtsa } from './nhtsa-stubs';

// Fail any test that lets a page reach an external host without a route stub.
const test = base.extend<{ offlineGuard: void }>({
  offlineGuard: [
    async ({ page }, use) => {
      const unexpected: string[] = [];
      await page.route(/^https?:\/\//, route => {
        const url = new URL(route.request().url());
        if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]') {
          return route.continue();
        }
        // Live mode intentionally reaches NHTSA; all other external hosts stay guarded.
        if (process.env.LIVE_NHTSA === '1' && url.hostname === 'vpic.nhtsa.dot.gov') {
          return route.continue();
        }
        unexpected.push(url.href);
        return route.abort();
      });
      await stubGoogleFonts(page);
      await use();
      expect(
        unexpected,
        `Unexpected external requests without stubs: ${unexpected.join(', ')}`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

// Set LIVE_NHTSA=1 to run the VIN tests against the real vPIC API.
const LIVE_NHTSA = process.env.LIVE_NHTSA === '1';

// NHTSA vPIC decodes this cleanly (ErrorCode "0").
const KNOWN_GOOD_VIN = '1HGCM82633A004352';
const CIVIC_2020_VIN = '2HGFC2F59LH500001';
// NHTSA flags this VIN's check digit (ErrorCode "1") but still returns the vehicle.
const CHECK_DIGIT_VIN = '4T1BF3EK8AU561547';
// NHTSA returns no vehicle data for this VIN.
const BOGUS_VIN = '00000000000000000';

test.describe('VIN decoder', () => {
  test.beforeEach(async ({ page }) => {
    if (!LIVE_NHTSA) await stubNhtsa(page);
  });

  test('decodes a known-good VIN through the form', async ({ page }) => {
    await page.goto('/vin');
    await page.locator('main').getByRole('textbox').fill(KNOWN_GOOD_VIN);
    await page.getByRole('button', { name: 'Decode VIN' }).click();

    await expect(page.getByRole('heading', { name: /2003 HONDA Accord/i })).toBeVisible();
    await expect(page.getByText(/check digit did not validate/i)).toHaveCount(0);
  });

  test('typing a VIN makes exactly one NHTSA decode request', async ({ page }) => {
    const decodeValuesRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/DecodeVinValues/')) decodeValuesRequests.push(request.url());
    });

    await page.goto('/vin');
    await page.locator('main').getByRole('textbox').fill(KNOWN_GOOD_VIN);
    await page.getByRole('button', { name: 'Decode VIN' }).click();

    await expect(page.getByRole('heading', { name: /2003 HONDA Accord/i })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/vin\\?vin=${KNOWN_GOOD_VIN}$`));
    await page.waitForTimeout(500);
    expect(decodeValuesRequests).toHaveLength(1);
  });

  test('header VIN search fills the scanner input', async ({ page }) => {
    await page.goto('/catalog');
    const headerSearch = page.getByPlaceholder('VIN, part #, or model...');
    await headerSearch.fill(CHECK_DIGIT_VIN);
    await headerSearch.press('Enter');

    await expect(page).toHaveURL(new RegExp(`/vin\\?vin=${CHECK_DIGIT_VIN}$`));
    await expect(page.getByRole('textbox', { name: 'Vehicle Identification Number (VIN)' })).toHaveValue(CHECK_DIGIT_VIN);
    await expect(page.getByRole('heading', { name: /2010 TOYOTA Camry/i })).toBeVisible();
  });

  test('decodes a check-digit-flagged VIN with an advisory instead of failing', async ({ page }) => {
    await page.goto(`/vin?vin=${CHECK_DIGIT_VIN}`);

    await expect(page.getByRole('heading', { name: /2010 TOYOTA Camry/i })).toBeVisible();
    await expect(page.getByText(/check digit did not validate/i)).toBeVisible();
    await expect(page.getByText(/could not decode this VIN/i)).toHaveCount(0);
  });

  test('shows a clear error for a bogus 17-character VIN loaded from a URL', async ({ page }) => {
    await page.goto(`/vin?vin=${BOGUS_VIN}`);

    await expect(page.getByText(/NHTSA could not decode this VIN/i)).toBeVisible();
    await expect(page.getByText('VIN Decoded', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Browse .* Parts/i })).toHaveCount(0);
  });

  test('shows a clear error for a bogus 17-character VIN submitted through the form', async ({ page }) => {
    await page.goto('/vin');
    await page.locator('main').getByRole('textbox').fill(BOGUS_VIN);
    await page.getByRole('button', { name: 'Decode VIN' }).click();

    await expect(page.getByText(/NHTSA could not decode this VIN/i)).toBeVisible();
    await expect(page.getByText('VIN Decoded', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Browse .* Parts/i })).toHaveCount(0);
  });

  test('manual selector loads models by NHTSA make ID and year', async ({ page }) => {
    await page.goto('/vin');
    await page.getByRole('button', { name: /Manual Selection/ }).click();

    const makeSelect = page.getByRole('combobox').nth(0);
    const yearSelect = page.getByRole('combobox').nth(1);
    const modelSelect = page.getByRole('combobox').nth(2);

    const modelsByMakeId = page.waitForRequest(req =>
      req.url().includes('/GetModelsForMakeId/474?'),
    );
    await makeSelect.selectOption('HONDA');
    await modelsByMakeId;
    await expect(modelSelect.getByRole('option', { name: 'Civic', exact: true })).toBeAttached();

    const modelsByMakeIdAndYear = page.waitForRequest(req =>
      req.url().includes('/GetModelsForMakeIdYear/makeId/474/modelyear/2020'),
    );
    await yearSelect.selectOption('2020');
    await modelsByMakeIdAndYear;
    await expect(modelSelect.getByRole('option', { name: 'Civic', exact: true })).toBeAttached();

    await modelSelect.selectOption('Civic');
    const browseParts = page.getByRole('button', { name: 'Browse Parts for 2020 Honda Civic' });
    await expect(browseParts).toBeEnabled();
    await expect(page.getByText(/isn't in the parts catalog yet/i)).toHaveCount(0);
    await browseParts.click();

    await expect(page).toHaveURL(/\/catalog\/honda\/civic\/2020$/);
    await expect(page.getByRole('heading', { name: '2020 Honda Civic Parts' })).toBeVisible();
  });

  test('manual selector disables Browse Parts for an uncatalogued make', async ({ page }) => {
    await page.goto('/vin');
    await page.getByRole('button', { name: /Manual Selection/ }).click();

    const makeSelect = page.getByRole('combobox').nth(0);
    const modelSelect = page.getByRole('combobox').nth(2);

    const modelsByMakeId = page.waitForRequest(req =>
      req.url().includes('/GetModelsForMakeId/486?'),
    );
    await makeSelect.selectOption('SAAB');
    await modelsByMakeId;
    await modelSelect.selectOption('900');

    await expect(page.getByRole('button', { name: 'Parts not published for SAAB' })).toBeDisabled();
    await expect(page.getByText(/SAAB isn't in the brand\/model preview yet/i)).toBeVisible();
  });
});

test.describe('Civic parts vertical slice', () => {
  test.beforeEach(async ({ page }) => {
    await stubNhtsa(page);
  });

  test('navigates model year → assembly → part and shows OEM/fitment data', async ({ page }) => {
    await page.goto('/catalog/honda/civic/2020');

    await expect(page.getByRole('heading', { name: '2020 Honda Civic Parts' })).toBeVisible();
    await expect(page.getByText(/representative catalog/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Brakes/ }).first()).toBeVisible();

    await page.getByRole('link', { name: /Brakes/ }).first().click();
    await expect(page).toHaveURL(/\/catalog\/honda\/civic\/2020\/brakes$/);
    await expect(page.getByRole('heading', { name: 'Brakes', exact: true })).toBeVisible();
    await expect(page.getByText('Front Brake Pad Set').first()).toBeVisible();

    await page.getByRole('link', { name: /Front Brake Pad Set/ }).first().click();
    await expect(page).toHaveURL(/\/catalog\/honda\/civic\/2020\/brakes\/front-brake-pads$/);
    await expect(page.getByRole('heading', { name: 'Front Brake Pad Set' })).toBeVisible();
    await expect(page.getByText('45022-TBA-A00').first()).toBeVisible();
    await expect(page.getByText('Verify fitment', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('45022-TBA-A01').first()).toBeVisible();
  });

  test('filters fitment by engine and trim', async ({ page }) => {
    await page.goto('/catalog/honda/civic/2020?engine=1.5L%20Turbo&trim=EX');

    await expect(page.getByLabel('Filter fitment by engine')).toHaveValue('1.5L Turbo');
    await expect(page.getByLabel('Filter fitment by trim')).toHaveValue('EX');
    await expect(page.getByText('Fits selected vehicle').first()).toBeVisible();
  });

  test('VIN result hands off to the exact Civic catalog and shows recalls', async ({ page }) => {
    await page.goto(`/vin?vin=${CIVIC_2020_VIN}`);

    await expect(page.getByRole('heading', { name: /2020 HONDA Civic EX/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'NHTSA safety recalls' })).toBeVisible();
    await expect(page.getByText('21V215000')).toBeVisible();
    await expect(page.getByRole('link', { name: /Check this VIN for open recalls/i })).toHaveAttribute(
      'href',
      `https://www.nhtsa.gov/recalls?vin=${CIVIC_2020_VIN}`,
    );
    await expect(
      page.getByRole('link', { name: /View campaign on NHTSA for 21V215000/i }),
    ).toHaveAttribute('href', 'https://www.nhtsa.gov/recalls?nhtsaId=21V215000');
    await expect(page.getByText('Honda (American Honda Motor Co.)')).toBeVisible();

    const browseParts = page.getByRole('link', { name: /Browse 2020 Honda Civic Parts/i });
    await expect(browseParts).toHaveAttribute(
      'href',
      /\/catalog\/honda\/civic\/2020\?vin=2HGFC2F59LH500001&engine=1\.5L\+Turbo&trim=EX/,
    );
    await browseParts.click();

    await expect(page).toHaveURL(/\/catalog\/honda\/civic\/2020\?/);
    await expect(page.getByRole('heading', { name: '2020 Honda Civic Parts' })).toBeVisible();
    await expect(page.getByLabel('Filter fitment by engine')).toHaveValue('1.5L Turbo');
    await expect(page.getByText('Fits your 2020 Honda Civic').first()).toBeVisible();
  });

  test('opens a shareable VIN safety report from the decoded result', async ({ page }) => {
    await page.goto(`/vin?vin=${CIVIC_2020_VIN}`);

    const reportLink = page.getByRole('link', { name: 'Safety report', exact: true });
    await expect(reportLink).toHaveAttribute(
      'href',
      `/vin?vin=${CIVIC_2020_VIN}&report=1`,
    );
    await reportLink.click();

    await expect(page).toHaveURL(new RegExp(`/vin\\?vin=${CIVIC_2020_VIN}&report=1$`));
    await expect(page.locator('#report-title')).toContainText('2020 HONDA Civic EX');
    await expect(page.getByText('VIN safety report', { exact: true })).toBeVisible();
    await expect(page.getByText(/Report generated/i)).toBeVisible();
    await expect(page.getByText(/NHTSA's public API does not return whether a campaign is open/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print / save PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share report' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Check this VIN for open recalls/i })).toHaveAttribute(
      'href',
      `https://www.nhtsa.gov/recalls?vin=${CIVIC_2020_VIN}`,
    );
    await expect(page.getByRole('link', { name: /View campaign on NHTSA for 21V215000/i })).toBeVisible();
    await expect(page.getByText(/Remedy: Honda will replace the fuel pump/i)).toBeVisible();
  });

  test('hides report actions and site chrome when printing', async ({ page }) => {
    await page.goto(`/vin?vin=${CIVIC_2020_VIN}&report=1`);
    await expect(page.locator('#report-title')).toBeVisible();

    await page.emulateMedia({ media: 'print' });

    await expect(page.getByRole('button', { name: 'Print / save PDF' })).toBeHidden();
    await expect(page.locator('header[data-site-chrome]')).toBeHidden();
    await expect(page.locator('footer[data-site-chrome]')).toBeHidden();
    await expect(page.locator('#report-title')).toBeVisible();
  });

  test('searches by OEM number and opens the part with VIN context', async ({ page }) => {
    await page.goto('/search?q=45022-TBA-A00&vin=2HGFC2F59LH500001');

    await expect(page.getByRole('heading', { name: 'Matching part records' })).toBeVisible();
    await page.getByRole('link', { name: /Front Brake Pad Set/ }).first().click();

    await expect(page).toHaveURL(/\/catalog\/honda\/civic\/2020\/brakes\/front-brake-pads\?vin=/);
    await expect(page.getByRole('heading', { name: 'Front Brake Pad Set' })).toBeVisible();
    await expect(page.getByText('45022-TBA-A00').first()).toBeVisible();
  });

  test('saves a VIN result to My Garage and reopens it', async ({ page }) => {
    await page.goto(`/vin?vin=${CIVIC_2020_VIN}`);
    await expect(page.getByRole('heading', { name: /2020 HONDA Civic EX/i })).toBeVisible();

    await page.getByRole('button', { name: 'Save to My Garage' }).click();
    await expect(page.getByRole('button', { name: 'Saved to My Garage' })).toBeVisible();

    await page.getByRole('link', { name: 'Garage', exact: true }).click();
    await expect(page).toHaveURL(/\/garage$/);
    await expect(page.getByRole('heading', { name: 'Civic EX 1.5L Turbo' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse matching parts/ })).toBeVisible();
  });

  test('renames a saved vehicle and keeps free notes', async ({ page }) => {
    await page.goto(`/vin?vin=${CIVIC_2020_VIN}`);
    await expect(page.getByRole('heading', { name: /2020 HONDA Civic EX/i })).toBeVisible();
    await page.getByRole('button', { name: 'Save to My Garage' }).click();
    await page.getByRole('link', { name: 'Garage', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Civic EX 1.5L Turbo' })).toBeVisible();

    await page.getByRole('button', { name: 'Rename vehicle' }).click();
    const nameInput = page.getByLabel('Vehicle name');
    await expect(nameInput).toHaveValue('Civic EX 1.5L Turbo');
    await expect(nameInput).toBeFocused();
    await nameInput.fill('Weekend runabout');
    await page.getByRole('button', { name: 'Save name' }).click();

    await expect(page.getByRole('heading', { name: 'Weekend runabout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rename vehicle' })).toBeFocused();

    const notes = page.getByLabel('Notes for Weekend runabout');
    await notes.fill('Oil change due at 60k miles.');
    await notes.blur();
    await expect(page.getByRole('status').filter({ hasText: 'Notes saved.' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Weekend runabout' })).toBeVisible();
    await expect(page.getByLabel('Notes for Weekend runabout')).toHaveValue(
      'Oil change due at 60k miles.',
    );
  });
});

test.describe('mobile recall panel', () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });

  test.beforeEach(async ({ page }) => {
    await stubNhtsa(page);
  });

  for (const width of [320, 360, 390]) {
    test(`keeps campaign details and NHTSA links usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/vin?vin=${CIVIC_2020_VIN}`);

    await expect(page.getByRole('heading', { name: 'NHTSA safety recalls' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '21V215000' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Check this VIN for open recalls/i })).toBeVisible();

    const noHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(noHorizontalOverflow).toBe(true);

    const vinLink = page.getByRole('link', { name: /Check this VIN for open recalls/i });
    const vinLinkBox = await vinLink.boundingBox();
    expect(vinLinkBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    const details = page.getByText('Remedy and campaign notes').first();
    const detailsBox = await details.boundingBox();
    expect(detailsBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await details.click();
    await expect(page.getByText(/Remedy:/).first()).toBeVisible();

    const campaignLink = page.getByRole('link', {
      name: /View campaign on NHTSA for 21V215000/i,
    });
    const campaignLinkBox = await campaignLink.boundingBox();
    expect(campaignLinkBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(campaignLink).toHaveAttribute(
      'href',
      'https://www.nhtsa.gov/recalls?nhtsaId=21V215000',
    );

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

  test('opens recall details with Enter and Space and shows keyboard focus', async ({ page }) => {
    await page.goto(`/vin?vin=${CIVIC_2020_VIN}`);
    await expect(page.getByRole('heading', { name: 'NHTSA safety recalls' })).toBeVisible();

    const summary = page
      .locator('summary')
      .filter({ hasText: 'Remedy and campaign notes' })
      .first();
    const details = page.locator('details').filter({ has: summary });
    await expect(summary).toBeVisible();
    expect(await details.evaluate(element => (element as HTMLDetailsElement).open)).toBe(false);

    for (let step = 0; step < 30; step += 1) {
      await page.keyboard.press('Tab');
      if (await summary.evaluate(element => element === document.activeElement)) break;
    }
    await expect(summary).toBeFocused();

    const focusStyle = await summary.evaluate(element => {
      const style = getComputedStyle(element);
      return {
        focusVisible: element.matches(':focus-visible'),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineColor: style.outlineColor,
      };
    });
    expect(focusStyle.focusVisible).toBe(true);
    expect(focusStyle.outlineStyle).toBe('solid');
    expect(focusStyle.outlineWidth).toBe('2px');
    expect(focusStyle.outlineColor).toBe('rgb(232, 184, 75)');

    await page.keyboard.press('Enter');
    await expect(details).toHaveJSProperty('open', true);
    await expect(page.getByText(/Remedy:/).first()).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(details).toHaveJSProperty('open', false);
    await page.keyboard.press('Space');
    await expect(details).toHaveJSProperty('open', true);
    await expect(page.getByText(/Remedy:/).first()).toBeVisible();
  });
});

test.describe('catalog search and filtering', () => {
  test('filters from the catalog page and writes ?q= to the URL', async ({ page }) => {
    await page.goto('/catalog');
    await page.getByPlaceholder(/Search brands or models/i).fill('civic');

    await expect(page).toHaveURL(/\/catalog\?q=civic$/);
    await expect(page.getByText(/1 brand matching "civic"/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Honda/ })).toBeVisible();
  });

  test('header quick search opens the combined parts and catalog search', async ({ page }) => {
    await page.goto('/catalog');
    const headerSearch = page.getByPlaceholder('VIN, part #, or model...');
    await headerSearch.fill('mustang');
    await headerSearch.press('Enter');

    await expect(page).toHaveURL(/\/search\?q=mustang$/);
    await expect(page.getByRole('heading', { name: 'Find a part by number or name' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ford/ })).toBeVisible();
  });

  test('region filter narrows the brand list and resets to all', async ({ page }) => {
    await page.goto('/catalog');

    await page.getByRole('button', { name: 'Japanese' }).click();
    await expect(page.locator('[class*="brandCard"]')).toHaveCount(12);
    await expect(page.getByRole('link', { name: /Toyota/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ford/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.locator('[class*="brandCard"]')).toHaveCount(63);
    await expect(page.getByRole('link', { name: /Ford/ })).toBeVisible();
  });
});

test.describe('home popular models', () => {
  test('focused popular model card activates with Enter and Space', async ({ page }) => {
    const toyotaCard = page.getByRole('button', { name: /Toyota/i });
    const expectToyotaBrandPage = async () => {
      await expect(page).toHaveURL(/\/catalog\/toyota$/);
      await expect(page.getByRole('heading', { name: 'Toyota', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Toyota Lineup' })).toBeVisible();
    };

    await page.goto('/');
    await expect(toyotaCard).toBeVisible();
    await toyotaCard.focus();
    await expect(toyotaCard).toBeFocused();
    await page.keyboard.press('Enter');
    await expectToyotaBrandPage();

    await page.goto('/');
    await expect(toyotaCard).toBeVisible();
    await toyotaCard.focus();
    await expect(toyotaCard).toBeFocused();
    await page.keyboard.press('Space');
    await expectToyotaBrandPage();
  });

  test('clicking a popular model card opens its brand page', async ({ page }) => {
    await page.goto('/');

    const toyotaCard = page.getByRole('button', { name: /Toyota/i });
    await expect(toyotaCard).toBeVisible();
    await toyotaCard.click();

    await expect(page).toHaveURL(/\/catalog\/toyota$/);
    await expect(page.getByRole('heading', { name: 'Toyota', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Toyota Lineup' })).toBeVisible();
  });
});

test.describe('favicon', () => {
  test('icon link points to a served SVG asset', async ({ page, request }) => {
    await page.goto('/');

    const href = await page.locator('link[rel="icon"]').getAttribute('href');
    if (!href) throw new Error('No favicon link found in index.html');

    const response = await request.get(new URL(href, page.url()).toString());
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
    expect(await response.text()).toContain('<svg');
  });
});

test.describe('mobile menu', () => {
  test.use({ viewport: { width: 600, height: 900 } });

  test('closes the menu and filters the catalog after a quick search is submitted', async ({ page }) => {
    await page.goto('/catalog');
    await page.getByRole('button', { name: 'Toggle menu' }).click();

    const mobileSearch = page.locator('[class*="mobileSearch"] input');
    await expect(mobileSearch).toBeVisible();
    await mobileSearch.fill('civic');
    await mobileSearch.press('Enter');

    await expect(page).toHaveURL(/\/search\?q=civic$/);
    await expect(page.getByRole('heading', { name: 'Find a part by number or name' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Honda/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Toyota/ })).toHaveCount(0);
    await expect(page.locator('main input[aria-label="Search parts by OEM number, part name, or alias"]')).toHaveValue('civic');
    await expect(page.locator('[class*="mobileMenu"]')).toHaveCount(0);
  });
});

test.describe('accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await stubNhtsa(page);
  });

  test('header and VIN inputs have accessible labels', async ({ page }) => {
    await page.goto('/vin');

    await expect(page.getByRole('search', { name: 'Vehicle search' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search by VIN, part number, or model' })).toBeVisible();
    await expect(
      page.getByRole('textbox', { name: 'Vehicle Identification Number (VIN)' }),
    ).toBeVisible();
  });

  test('manual selects are associated with their visible labels', async ({ page }) => {
    await page.goto('/vin');
    await page.getByRole('button', { name: /Manual Selection/ }).click();

    await expect(page.getByLabel('Make', { exact: true })).toHaveAttribute('id', 'manual-make');
    await expect(page.getByLabel('Year', { exact: true })).toHaveAttribute('id', 'manual-year');
    await expect(page.getByLabel('Model', { exact: true })).toHaveAttribute('id', 'manual-model');
  });

  test('announces VIN errors and links them to the input', async ({ page }) => {
    await page.goto('/vin');
    const vinInput = page.getByRole('textbox', {
      name: 'Vehicle Identification Number (VIN)',
    });

    await vinInput.fill(BOGUS_VIN);
    await page.getByRole('button', { name: 'Decode VIN' }).click();

    const error = page.getByRole('alert');
    await expect(error).toContainText(/NHTSA could not decode this VIN/i);
    await expect(vinInput).toHaveAttribute('aria-invalid', 'true');
    await expect(vinInput).toHaveAttribute('aria-describedby', 'vin-error');
    await expect(page.locator('#vin-error')).toHaveText(/NHTSA could not decode this VIN/i);
  });

  test('mobile menu exposes its expanded state', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const toggle = page.getByRole('button', { name: 'Toggle menu' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-controls', 'mobile-menu');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mobile-menu')).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('page metadata', () => {
  test.beforeEach(async ({ page }) => {
    await stubNhtsa(page);
  });

  test('sets a unique title and description for each route', async ({ page }) => {
    const routes = [
      {
        path: '/',
        title: 'AutoParts — VIN Decoder & Vehicle Catalog',
        description:
          'Decode a VIN free and explore vehicle specifications and parts catalogs for automotive brands.',
      },
      {
        path: '/vin',
        title: 'VIN Decoder — AutoParts',
        description:
          'Decode a 17-character VIN with the free NHTSA vPIC database to see make, model, year, engine, trim, and plant details.',
      },
      {
        path: '/catalog',
        title: 'Vehicle Catalog — AutoParts',
        description:
          'Browse 63 active automotive brands and 1249 models with production years and EPA-sourced engine options, then decode a VIN. The live parts slice currently covers the 2020 Honda Civic.',
      },
      {
        path: '/catalog/honda',
        title: 'Honda Models & Parts — AutoParts',
        description:
          'Browse the Honda brand and model preview. Decode a Honda VIN to identify the exact trim, engine, and options; live parts data is called out on supported models.',
      },
      {
        path: '/catalog/honda/civic/2020',
        title: '2020 Honda Civic Parts — AutoParts',
        description:
          'Browse representative 2020 Honda Civic assemblies and 36 OEM-reference parts. Check fitment, copy part numbers, and verify with a dealer.',
      },
      {
        path: '/catalog/honda/civic/2020/brakes',
        title: '2020 Honda Civic Brakes Parts — AutoParts',
        description:
          '9 representative 2020 Honda Civic brakes parts with OEM/reference numbers, fitment notes, and supersession references.',
      },
      {
        path: '/catalog/honda/civic/2020/brakes/front-brake-pads',
        title: 'Front Brake Pad Set — 2020 Honda Civic — AutoParts',
        description:
          'Front Brake Pad Set (OEM 45022-TBA-A00) for 2020 Honda Civic. Fitment notes, supersessions, interchange references, and provenance. Verify fitment with a dealer.',
      },
      {
        path: '/not-a-real-page',
        title: 'Page Not Found — AutoParts',
        description:
          'The page you requested could not be found. Return to AutoParts to decode a VIN or browse the vehicle catalog.',
      },
    ];

    const titles = new Set<string>();
    const descriptions = new Set<string>();

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page).toHaveTitle(route.title);

      const meta = page.locator('meta[name="description"]');
      await expect(meta).toHaveCount(1);
      await expect(meta).toHaveAttribute('content', route.description);

      titles.add(route.title);
      descriptions.add((await meta.getAttribute('content')) ?? '');
    }

    expect(titles.size).toBe(routes.length);
    expect(descriptions.size).toBe(routes.length);
  });

  test('exposes canonical, Open Graph, Twitter, and JSON-LD metadata', async ({ page }) => {
    await page.goto('/catalog/honda/civic/2020');

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /\/catalog\/honda\/civic\/2020$/,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      '2020 Honda Civic Parts — AutoParts',
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      /\/catalog\/honda\/civic\/2020$/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');

    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toHaveCount(1);
    const content = await jsonLd.textContent();
    expect(content).toContain('BreadcrumbList');
    expect(content).toContain('CollectionPage');
  });
});

test.describe('product safety and handoff layer', () => {
  test.beforeEach(async ({ page }) => {
    await stubNhtsa(page);
  });

  test('adds model-level complaints and investigations to the VIN result and report', async ({ page }) => {
    await page.goto(`/vin?vin=${CIVIC_2020_VIN}`);

    await expect(page.getByRole('heading', { name: 'Safety intelligence beyond recalls' })).toBeVisible();
    await expect(page.getByText('ODI 11345678')).toBeVisible();
    await expect(page.getByText(/Vehicle stalled while driving/i)).toBeVisible();
    await expect(page.getByText('NHTSA investigations', { exact: true })).toBeVisible();
    await expect(page.getByText(/No NHTSA investigations returned/i)).toBeVisible();

    await page.goto(`/vin?vin=${CIVIC_2020_VIN}&report=1`);
    await expect(page.getByText('What to do next')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Safety intelligence beyond recalls' })).toBeVisible();
    await expect(page.getByText('ODI 11345678')).toBeVisible();
    await expect(page.getByText(/not confirmed recalls for this VIN/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /VIN-specific NHTSA lookup/i })).toBeVisible();
  });

  test('shows real model-year NHTSA investigations separately from recalls', async ({ page }) => {
    await page.goto(`/vin?vin=${KNOWN_GOOD_VIN}`);

    await expect(page.getByRole('heading', { name: 'NHTSA safety recalls' })).toBeVisible();
    await expect(page.getByText('NHTSA EA15001')).toBeVisible();
    await expect(page.getByText(/Air Bag Inflator Rupture/i).first()).toBeVisible();
    await expect(page.getByText(/not a confirmed defect or a recall for this VIN/i)).toBeVisible();

    await page.goto(`/vin?vin=${KNOWN_GOOD_VIN}&report=1`);
    await expect(page.getByText('NHTSA EA09001')).toBeVisible();
    await expect(page.getByText('Ignition Shift Interlock')).toBeVisible();
    await expect(page.getByText(/model-level context and are not confirmed recalls/i)).toBeVisible();
  });

  test('watches a VIN and rechecks it in the recall action center', async ({ page }) => {
    await page.goto(`/vin?vin=${CIVIC_2020_VIN}`);
    await page.getByRole('button', { name: 'Watch recalls' }).click();
    await expect(page.getByRole('link', { name: /Recall watch is active/i })).toBeVisible();

    await page.getByRole('link', { name: 'Open Recall Watch' }).click();
    await expect(page.getByRole('heading', { name: 'Recall Watch' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /2020 HONDA Civic/i })).toBeVisible();
    await expect(page.getByText('21V215000').first()).toBeVisible();

    await page.getByRole('button', { name: 'Mark repaired' }).click();
    await expect(page.getByText(/Repair marked/i)).toBeVisible();
    await expect(page.getByText(/Self-reported repair status/i)).toBeVisible();
  });

  test('auto-rechecks saved vehicles and keeps new-campaign status until reviewed', async ({ page }) => {
    const recallPattern = /^https:\/\/api\.nhtsa\.gov\/recalls\//;
    await page.unroute(recallPattern);

    const baseCampaign = {
      NHTSACampaignNumber: '21V215000',
      Component: 'FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP',
      Summary: 'The low-pressure fuel pump inside the fuel tank may fail.',
      Manufacturer: 'Honda (American Honda Motor Co.)',
    };
    const newCampaign = {
      NHTSACampaignNumber: '24V999000',
      Component: 'ELECTRICAL SYSTEM',
      Summary: 'A new model-year campaign appeared during the watchdog check.',
      Manufacturer: 'Honda (American Honda Motor Co.)',
    };
    let recallResults = [baseCampaign];
    await page.route(recallPattern, route =>
      route.fulfill({ json: { Count: recallResults.length, results: recallResults } }),
    );

    await page.goto(`/vin?vin=${CIVIC_2020_VIN}`);
    await page.getByRole('button', { name: 'Watch recalls' }).click();
    await page.goto('/recall-center');
    await expect(page.getByText(/1 campaign returned for the model year/i)).toBeVisible();
    await expect(page.getByText('No new campaigns')).toBeVisible();

    recallResults = [baseCampaign, newCampaign];
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    await expect(page.getByText(/new campaign reported/i).first()).toBeVisible();
    await expect(page.getByText('24V999000').first()).toBeVisible();
    await expect(page.getByText(/not a VIN-specific open-recall determination/i).first()).toBeVisible();

    await page.reload();
    await expect(page.getByText(/new campaign reported/i).first()).toBeVisible();

    await page.getByRole('button', { name: 'Mark reviewed' }).click();
    await expect(page.getByText(/new campaign reported/i)).toHaveCount(0);
    await expect(page.getByText('No new campaigns')).toBeVisible();
  });

  test('explains a fitment conflict and queues a dealer verification request', async ({ page }) => {
    await page.goto('/catalog/honda/civic/2020/engine/engine-air-filter?engine=2.0L&trim=LX');

    await expect(page.getByRole('heading', { name: 'Not sure this part fits?' })).toBeVisible();
    await expect(page.getByText(/Engine mismatch/i)).toBeVisible();
    await expect(page.getByText(/Plausible alternatives/i)).toBeVisible();

    await page.getByRole('button', { name: 'Request fitment verification' }).click();
    await page.getByLabel('VIN', { exact: true }).fill(CIVIC_2020_VIN);
    await page.getByLabel('Contact name').fill('Test Driver');
    await page.getByLabel('Email').fill('driver@example.com');
    await page.getByRole('button', { name: 'Queue request' }).click();

    await expect(page.getByText(/Request saved with reference FIT-/)).toBeVisible();
    await expect(page.getByText(/Partner dealer\/shop routing is not connected/i)).toBeVisible();
  });

  test('keeps the commercial layer honest when no feed is connected', async ({ page }) => {
    await page.goto('/catalog/honda/civic/2020/brakes/front-brake-pads');

    await expect(page.getByRole('heading', { name: 'Fitment, price & availability' })).toBeVisible();
    await expect(page.getByText(/No ACES\/PIES or distributor feed is connected/i)).toBeVisible();
    await expect(page.getByText(/No exact commercial record/i)).toBeVisible();
    await expect(page.getByText('Feed not connected')).toBeVisible();
  });

  test('captures demand instead of dead-ending an uncovered brand', async ({ page }) => {
    await page.goto('/catalog/toyota');

    await expect(page.getByRole('heading', { name: 'Notify me when parts are covered' })).toBeVisible();
    await page.getByRole('button', { name: 'Notify me when parts are covered' }).click();
    await page.getByLabel('Model', { exact: true }).fill('Camry');
    await page.getByLabel('Part needed').fill('front brake pads');
    await page.getByRole('button', { name: 'Save coverage request' }).click();

    await expect(page.getByText(/Demand request saved as DEMAND-/)).toBeVisible();
    await expect(page.getByText(/local demand record/i)).toBeVisible();
  });

  test('opens an uncovered vehicle page and captures VIN or year/make/model demand', async ({ page }) => {
    await page.goto('/catalog/toyota');
    const coverageLink = page.getByRole('link', { name: /View parts coverage for .* Toyota Camry/i });
    await expect(coverageLink).toBeVisible();
    await coverageLink.click();

    await expect(page).toHaveURL(/\/catalog\/toyota\/camry\/\d{4}$/);
    await expect(page.getByRole('heading', { name: /Toyota Camry Parts$/ })).toBeVisible();
    await expect(page.getByText(/No parts are listed for this vehicle/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Notify me when parts are covered' })).toBeVisible();

    await page.getByRole('button', { name: 'Notify me when parts are covered' }).click();
    await expect(page.getByLabel('Year', { exact: true })).toHaveValue(/\d{4}/);
    await expect(page.getByLabel('Make', { exact: true })).toHaveValue('Toyota');
    await expect(page.getByLabel('Model', { exact: true })).toHaveValue('Camry');
    await page.getByLabel('Part needed').fill('cabin air filter');
    await page.getByRole('button', { name: 'Save coverage request' }).click();

    await expect(page.getByText(/Demand request saved as DEMAND-/)).toBeVisible();
    await expect(page.getByText(/not a promise of coverage/i)).toBeVisible();
  });

  test('links an uncovered decoded vehicle to its exact year coverage page', async ({ page }) => {
    await page.goto(`/vin?vin=${KNOWN_GOOD_VIN}`);

    const coverageLink = page.getByRole('link', { name: 'Notify me when parts are covered' });
    await expect(coverageLink).toHaveAttribute(
      'href',
      `/catalog/honda/accord/2003?vin=${KNOWN_GOOD_VIN}`,
    );
    await coverageLink.click();
    await expect(page.getByRole('heading', { name: '2003 Honda Accord Parts' })).toBeVisible();
    await expect(page.getByText(/No parts are listed for this vehicle/i)).toBeVisible();
  });

  test('bulk-checks VINs and exports a fleet CSV', async ({ page }) => {
    await page.goto('/fleet');
    await page.getByLabel(/VIN list, CSV, or auction export/i).fill(`${CIVIC_2020_VIN}\n${KNOWN_GOOD_VIN}`);
    await page.getByRole('button', { name: 'Check VINs' }).click();

    await expect(page.getByText('2020 HONDA Civic').first()).toBeVisible();
    await expect(page.getByText('2003 HONDA Accord').first()).toBeVisible();
    await expect(page.getByText(/2\s*VINs checked/i)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('autoparts-fleet-recall-check');
  });

  test('opens the tools hub and hands off to the fleet checker', async ({ page }) => {
    await page.goto('/tools');

    await expect(page.getByRole('heading', { name: 'Safety & fleet tools' })).toBeVisible();
    await expect(page.getByText('What is real, what is empty')).toBeVisible();
    await page.getByRole('link', { name: /Fleet VIN checker/i }).click();
    await expect(page).toHaveURL(/\/fleet$/);
    await expect(page.getByRole('heading', { name: 'Fleet VIN recall checker' })).toBeVisible();
  });

  test('moves My Garage between browsers with a transfer code', async ({ page }) => {
    await page.goto('/garage');
    await page.evaluate(() => {
      localStorage.setItem(
        'autoparts.garage.v1',
        JSON.stringify([
          {
            vin: '2HGFC2F59LH500001',
            year: '2020',
            make: 'HONDA',
            model: 'Civic',
            trim: 'EX',
            engine: '1.5L Turbo',
            name: 'Weekend toy',
            notes: 'Oil change due at 120k, use 5W-30.',
            savedAt: new Date().toISOString(),
          },
        ]),
      );
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Weekend toy' })).toBeVisible();

    await page.getByRole('button', { name: 'Create transfer code' }).click();
    const code = await page.getByLabel('Garage transfer code').inputValue();
    expect(code.length).toBeGreaterThan(20);

    await page.evaluate(() => localStorage.removeItem('autoparts.garage.v1'));
    await page.reload();
    await page.getByLabel('Garage transfer code').fill(code);
    await page.getByRole('button', { name: 'Import and merge' }).click();

    await expect(page.getByText(/Imported 1 saved vehicle/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Weekend toy' })).toBeVisible();
    await expect(page.getByLabel('Notes for Weekend toy')).toHaveValue(
      'Oil change due at 120k, use 5W-30.',
    );
  });
});
