import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { stubGoogleFonts } from './google-fonts-stubs';
import { stubNhtsa } from './nhtsa-stubs';

const RENAULT_VIN = 'VF1RFB00X12345678';
const CIVIC_VIN = '2HGFC2F59LH500001';
const AUDI_INFERRED_VIN = 'WAUZZZGY5VA000149';
const MODEL_DATA_UNAVAILABLE = 'Model data not available for this market';

interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
}

/** Replace Web Share with a recorder so the test can inspect the share text. */
async function captureSharePayload(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: SharePayload) => {
        (window as unknown as { __sharePayload?: SharePayload }).__sharePayload = data;
      },
    });
  });
}

async function readSharePayload(page: Page): Promise<SharePayload> {
  const payload = await page.evaluate(
    () => (window as unknown as { __sharePayload?: SharePayload }).__sharePayload,
  );
  expect(payload, 'the share sheet should have been opened').toBeTruthy();
  return payload as SharePayload;
}

test.describe('Incomplete year/make/model handling', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleFonts(page);
    await stubNhtsa(page);
  });

  test('a saved vehicle with no year, make, or model says so instead of showing a blank line', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key, vin }: { key: string; vin: string }) => {
        localStorage.setItem(
          key,
          JSON.stringify([
            {
              vin,
              year: '',
              make: '',
              model: '',
              trim: null,
              engine: null,
              name: null,
              notes: 'Imported from a non-US market.',
              stockNumber: null,
              plate: null,
              savedAt: '2026-11-22T12:00:00.000Z',
            },
          ]),
        );
      },
      { key: 'autoparts.garage.v1', vin: RENAULT_VIN },
    );

    await page.goto('/garage');

    await expect(page.getByRole('heading', { name: 'Saved vehicle' })).toBeVisible();
    await expect(page.getByText(MODEL_DATA_UNAVAILABLE, { exact: true })).toBeVisible();
    await expect(page.getByText(/NHTSA returned only/)).toHaveCount(0);
    await expect(
      page.getByText(/Model-year recall and parts lookups need a year, make, and model/i),
    ).toBeVisible();
    await expect(page.getByLabel('Notes for Saved vehicle')).toHaveValue(
      'Imported from a non-US market.',
    );
  });

  test('a saved vehicle with only a model year keeps it but states the missing identity', async ({
    page,
  }) => {
    await page.addInitScript(
      ({ key }: { key: string }) => {
        localStorage.setItem(
          key,
          JSON.stringify([
            {
              vin: 'WAUZZZGY5VA000149',
              year: '2027',
              make: '',
              model: '',
              trim: null,
              engine: null,
              name: null,
              notes: '',
              stockNumber: null,
              plate: null,
              savedAt: '2026-11-22T12:00:00.000Z',
            },
          ]),
        );
      },
      { key: 'autoparts.garage.v1' },
    );

    await page.goto('/garage');

    // The year is real data, but it is not a complete vehicle identity.
    await expect(page.getByRole('heading', { name: '2027' })).toBeVisible();
    await expect(page.getByText(MODEL_DATA_UNAVAILABLE, { exact: true })).toBeVisible();
    await expect(
      page.getByText(/NHTSA returned only “2027” for this VIN/),
    ).toBeVisible();
  });

  test('the fleet table and CSV report a skipped lookup as not run, never as zero campaigns', async ({
    page,
  }) => {
    await page.goto('/fleet');
    await page
      .getByLabel(/VIN list, CSV, or auction export/i)
      .fill(`${RENAULT_VIN}\n${CIVIC_VIN}`);
    await page.getByRole('button', { name: 'Check VINs' }).click();

    await expect(page.getByText(MODEL_DATA_UNAVAILABLE, { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        'Model-year recall lookup skipped — model data not available for this market.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByText('Lookups skipped')).toBeVisible();
    // The Renault row must not borrow the "decoded, no campaigns" state.
    await expect(page.getByText('None returned')).toHaveCount(0);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    const csv = readFileSync((await download.path())!, 'utf8');
    const header = csv.split('\n')[0];
    const renaultRow = csv.split('\n').find(line => line.includes(RENAULT_VIN));

    expect(header).toContain('RecallLookup');
    expect(renaultRow).toBeTruthy();
    expect(renaultRow).toContain(
      '"2001","","","","","not-run: incomplete vehicle identity"',
    );
    expect(renaultRow).not.toMatch(/,"0",/);
  });

  test('the safety report does not imply a model-year recall lookup it never ran', async ({
    page,
  }) => {
    await page.goto(`/vin?vin=${RENAULT_VIN}&report=1`);

    await expect(page.locator('#report-title')).toHaveText(
      '2001 — Model data not available for this market',
    );
    await expect(page.getByText(/Model data not available for this market/).first()).toBeVisible();
    await expect(
      page.getByText(/did not run a model-year recall, complaint, or investigation lookup/i),
    ).toBeVisible();
    await expect(page.getByText(/campaign numbers above/i)).toHaveCount(0);
    await expect(
      page.getByText('No recall campaigns returned for this model year.'),
    ).toHaveCount(0);
    await expect(page).toHaveTitle(/model data not available/i);
  });

  test('the safety report labels an inferred model and skips US-market campaign claims', async ({
    page,
  }) => {
    await page.goto(`/vin?vin=${AUDI_INFERRED_VIN}&report=1`);

    await expect(page.locator('#report-title')).toContainText('2027 AUDI A3/S3/RS 3');
    await expect(
      page.getByText(/Model inferred from VIN positions 7–8 \(GY\)\./).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/model was inferred from its VIN pattern/i).first(),
    ).toBeVisible();
    await expect(
      page.getByText('No recall campaigns returned for this model year.'),
    ).toHaveCount(0);
  });

  test('share text carries the incomplete identity and the skipped lookup', async ({ page }) => {
    await captureSharePayload(page);

    await page.goto(`/vin?vin=${RENAULT_VIN}`);
    await page.getByRole('button', { name: 'Share VIN' }).click();
    const vinShare = await readSharePayload(page);
    expect(vinShare.title).toContain(MODEL_DATA_UNAVAILABLE);
    expect(vinShare.text).toContain('no model-year recall lookup ran');
    expect(vinShare.url).toContain(RENAULT_VIN);

    await page.goto(`/vin?vin=${RENAULT_VIN}&report=1`);
    await page.getByRole('button', { name: 'Share report' }).click();
    const reportShare = await readSharePayload(page);
    expect(reportShare.title).toContain(MODEL_DATA_UNAVAILABLE);
    expect(reportShare.text).toContain('no model-year recall lookup ran');
  });

  test('Recall Watch labels and skips checks for incomplete or inferred identities', async ({
    page,
  }) => {
    await page.addInitScript(
      ({
        key,
        renault,
        audi,
      }: {
        key: string;
        renault: Record<string, unknown>;
        audi: Record<string, unknown>;
      }) => {
        const base = {
          trim: null,
          engine: null,
          addedAt: '2026-11-22T12:00:00.000Z',
          notificationsOptIn: false,
          lastCheckedAt: null,
          campaignHistory: [],
          newCampaigns: [],
          newCampaignsDetectedAt: null,
          completedRepairs: [],
        };
        localStorage.setItem(
          key,
          JSON.stringify([
            { ...base, ...renault, vin: 'VF1RFB00X12345678' },
            { ...base, ...audi, vin: 'WAUZZZGY5VA000149' },
          ]),
        );
      },
      {
        key: 'autoparts.recall-watch.v1',
        renault: { year: '2001', make: '', model: '', model_source: null },
        audi: {
          year: '2027',
          make: 'AUDI',
          model: 'A3/S3/RS 3',
          model_source: 'vin-pattern',
        },
      },
    );

    await page.goto('/recall-center');

    await expect(page.getByRole('heading', { name: MODEL_DATA_UNAVAILABLE })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2027 AUDI A3/S3/RS 3' })).toBeVisible();
    await expect(page.getByText('Lookup skipped')).toHaveCount(2);
    await expect(
      page.getByText(/Model-year recall checks need a year, make, and model/i),
    ).toBeVisible();
    await expect(page.getByText(/This model was inferred from the VIN/i)).toBeVisible();
    await expect(
      page.getByText('No campaigns returned for this model year.'),
    ).toHaveCount(0);
    await expect(
      page.getByText(/campaigns? returned for the model year; not VIN-specific/i),
    ).toHaveCount(0);
  });
});
