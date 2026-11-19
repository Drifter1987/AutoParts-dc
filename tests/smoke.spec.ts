import { test as base, expect } from '@playwright/test';
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
    await expect(page.locator('main').getByRole('textbox')).toHaveValue(CHECK_DIGIT_VIN);
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
      req.url().includes('/GetModelsForMakeId/485?'),
    );
    await makeSelect.selectOption('VOLVO');
    await modelsByMakeId;
    await modelSelect.selectOption('XC90');

    await expect(page.getByRole('button', { name: 'Parts catalog for VOLVO coming soon' })).toBeDisabled();
    await expect(page.getByText(/VOLVO isn't in the brand\/model preview yet/i)).toBeVisible();
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
      page.getByRole('link', { name: /View NHTSA campaign 21V215000/i }),
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
    await expect(page.getByRole('heading', { name: '2020 HONDA Civic EX' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Browse matching parts/ })).toBeVisible();
  });
});

test.describe('mobile recall panel', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await stubNhtsa(page);
  });

  test('keeps campaign details and NHTSA links usable at phone width', async ({ page }) => {
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

    const campaignLink = page.getByRole('link', { name: /View NHTSA campaign 21V215000/i });
    const campaignLinkBox = await campaignLink.boundingBox();
    expect(campaignLinkBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(campaignLink).toHaveAttribute(
      'href',
      'https://www.nhtsa.gov/recalls?nhtsaId=21V215000',
    );
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
    await expect(page.locator('[class*="brandCard"]')).toHaveCount(6);
    await expect(page.getByRole('link', { name: /Toyota/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ford/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.locator('[class*="brandCard"]')).toHaveCount(20);
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
          'Browse a preview of 20 automotive brands and 98 models, then decode a VIN. The live parts slice currently covers the 2020 Honda Civic.',
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
