import { test, expect, type Page } from '@playwright/test';
import { stubGoogleFonts } from './google-fonts-stubs';
import { stubNhtsa } from './nhtsa-stubs';

const GARAGE_KEY = 'autoparts.garage.v1';

interface SeedVehicle {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string | null;
  engine: string | null;
  name: string | null;
  notes: string;
  savedAt: string;
}

async function seedGarage(page: Page, vehicles: SeedVehicle[]): Promise<void> {
  await page.addInitScript(
    ({ key, rows }: { key: string; rows: SeedVehicle[] }) => {
      localStorage.setItem(key, JSON.stringify(rows));
    },
    { key: GARAGE_KEY, rows: vehicles },
  );
}

test.describe('My Garage fleet-sheet import', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleFonts(page);
    await stubNhtsa(page);
  });

  test('imports a CSV, keeps saved names and notes, and skips duplicate or invalid VINs', async ({
    page,
  }) => {
    await seedGarage(page, [
      {
        vin: 'WAUZZZHC2VA001164',
        year: '2027',
        make: 'Audi',
        model: 'A2 e-tron',
        trim: '140 kW',
        engine: null,
        name: 'Audi A2 e-tron 140 kW',
        notes:
          'Fleet sheet row 1 · AU310671002 · plate IN-S3856E. NHTSA vPIC: AUDI, 2027, Germany.',
        savedAt: '2026-11-22T15:41:05.574Z',
      },
      {
        vin: 'WAUZZZGY5VA000149',
        year: '2027',
        make: 'Audi',
        model: 'S3',
        trim: 'Sportback quattro 2.0 R4245 DSG',
        engine: null,
        name: 'Audi S3 Sportback quattro 2.0 R4245 DSG',
        notes: 'Fleet sheet row 8 · AU380170257 · plate IN-S3680. Duplicate VIN row ignored.',
        savedAt: '2026-11-22T15:35:05.574Z',
      },
    ]);

    await page.goto('/garage');

    const sheet = `VIN,Name,AU/Stock,Plate
WAUZZZHC2VA001164,Sheet A2 name,AU310671002,IN-S3856E
WAUZZZGY5VA000149,Sheet S3 name,AU380170257,IN-S3680
WAUZZZFJ2S1000156,Q3 1.5 R4110 A7,AU336050265,IN-R3478
WAUZZZFJ2S1000156,Duplicate Q3,AU336050265,IN-R3478
WAUZZZGYXA000129,A3 Limousine,AU381070234,IN-S3553`;

    await page.getByLabel('Fleet sheet (CSV, TSV, or markdown table)').fill(sheet);
    await page.getByRole('button', { name: 'Review fleet sheet' }).click();

    await expect(page.getByText(/1 new vehicle ready to import/i)).toBeVisible();
    await expect(page.getByText(/2 already saved — names and notes kept/i)).toBeVisible();
    await expect(
      page.getByText(/2 rows will be skipped for a duplicate, invalid, or conflicting VIN/i),
    ).toBeVisible();
    await expect(page.getByText(/Duplicate VIN WAUZZZFJ2S1000156/i)).toBeVisible();
    await expect(
      page.getByText(/Line 6: .*must be exactly 17 characters/i),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Import fleet sheet' }).click();

    await expect(page.getByText(/Imported 1 new vehicle/i)).toBeVisible();
    await expect(page.getByText(/Matched 2 already-saved vehicles/i)).toBeVisible();
    await expect(
      page.getByText(/Skipped 2 rows for a duplicate, invalid, or conflicting VIN/i),
    ).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Audi A2 e-tron 140 kW' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Audi S3 Sportback quattro 2.0 R4245 DSG' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Q3 1.5 R4110 A7' })).toBeVisible();

    await expect(page.getByLabel('Notes for Audi A2 e-tron 140 kW')).toHaveValue(
      'Fleet sheet row 1 · AU310671002 · plate IN-S3856E. NHTSA vPIC: AUDI, 2027, Germany.',
    );
    await expect(
      page.getByLabel('Notes for Audi S3 Sportback quattro 2.0 R4245 DSG'),
    ).toHaveValue('Fleet sheet row 8 · AU380170257 · plate IN-S3680. Duplicate VIN row ignored.');

    await expect(
      page.getByText('AU/stock AU310671002 · Plate IN-S3856E', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('AU/stock AU380170257 · Plate IN-S3680', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('AU/stock AU336050265 · Plate IN-R3478', { exact: true }),
    ).toBeVisible();

    // The duplicate VIN is one card; the invalid 16-character VIN was not added.
    await expect(page.getByText('WAUZZZFJ2S1000156', { exact: true })).toHaveCount(1);
    await expect(page.getByText('WAUZZZGYXA000129', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sheet A2 name' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sheet S3 name' })).toHaveCount(0);
  });

  test('keeps the saved S3 fleet identifiers when the sheet repeats its VIN on a Q3 row', async ({
    page,
  }) => {
    await seedGarage(page, [
      {
        vin: 'WAUZZZGY5VA000149',
        year: '2027',
        make: 'Audi',
        model: 'S3',
        trim: 'Sportback quattro 2.0 R4245 DSG',
        engine: null,
        name: 'Audi S3 Sportback quattro 2.0 R4245 DSG',
        notes:
          'Fleet sheet row 8 · AU380170257 · plate IN-S3680. Duplicate VIN row ignored: row 3 listed the same VIN as Q3.',
        savedAt: '2026-11-22T15:35:05.574Z',
      },
    ]);

    await page.goto('/garage');

    const sheet = `| Vehicles | AU-Number | VIN | License Plate |
|---|---|---|---|
| Q3 | AU380170252 | WAUZZZGY5VA000149 | |
| S3 Spb qu2.0 R4245 DSG | AU380170257 | WAUZZZGY5VA000149 | IN-S3680 |`;

    await page.getByLabel('Fleet sheet (CSV, TSV, or markdown table)').fill(sheet);
    await page.getByRole('button', { name: 'Review fleet sheet' }).click();

    await expect(page.getByText(/1 already saved — names and notes kept/i)).toBeVisible();
    await expect(
      page.getByText(/1 row will be skipped for a duplicate, invalid, or conflicting VIN/i),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Import fleet sheet' }).click();

    await expect(page.getByText(/Matched 1 already-saved vehicle/i)).toBeVisible();
    await expect(
      page.getByText(/Skipped 1 row for a duplicate, invalid, or conflicting VIN/i),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Audi S3 Sportback quattro 2.0 R4245 DSG' }),
    ).toHaveCount(1);
    await expect(
      page.getByLabel('Notes for Audi S3 Sportback quattro 2.0 R4245 DSG'),
    ).toHaveValue(
      'Fleet sheet row 8 · AU380170257 · plate IN-S3680. Duplicate VIN row ignored: row 3 listed the same VIN as Q3.',
    );
    await expect(
      page.getByText('AU/stock AU380170257 · Plate IN-S3680', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/AU380170252/)).toHaveCount(0);
  });

  test('repairs a saved 16-character VIN from the AU/stock match and keeps its name and notes', async ({
    page,
  }) => {
    await seedGarage(page, [
      {
        vin: 'WAUZZZGYXA000129',
        year: '',
        make: 'Audi',
        model: 'A3',
        trim: 'Limousine TDI 2.0 R4110 DSG',
        engine: null,
        name: 'Audi A3 Limousine TDI 2.0 R4110 DSG',
        notes:
          'Fleet sheet row 9 · AU381070234 · plate IN-S3553. Source VIN has only 16 characters, so it is stored as given and needs verification.',
        savedAt: '2026-11-22T15:34:05.574Z',
      },
    ]);

    await page.goto('/garage');

    const sheet = `| Vehicles | AU-Number | VIN | License Plate |
|---|---|---|---|
| A3 Limousine | AU381070234 | WAUZZZGYXVA000129 | IN-S3553 |`;

    await page.getByLabel('Fleet sheet (CSV, TSV, or markdown table)').fill(sheet);
    await page.getByRole('button', { name: 'Review fleet sheet' }).click();

    await expect(page.getByText(/1 already saved — names and notes kept/i)).toBeVisible();
    await expect(page.getByText(/matched by AU\/stock number/i)).toBeVisible();

    await page.getByRole('button', { name: 'Import fleet sheet' }).click();

    await expect(page.getByText(/Matched 1 already-saved vehicle/i)).toBeVisible();
    await expect(page.getByText(/Corrected 1 saved VIN from the AU\/stock match/i)).toBeVisible();

    await expect(
      page.getByRole('heading', { name: 'Audi A3 Limousine TDI 2.0 R4110 DSG' }),
    ).toBeVisible();
    await expect(page.getByLabel('Notes for Audi A3 Limousine TDI 2.0 R4110 DSG')).toHaveValue(
      'Fleet sheet row 9 · AU381070234 · plate IN-S3553. Source VIN has only 16 characters, so it is stored as given and needs verification.',
    );
    await expect(page.getByText('WAUZZZGYXVA000129', { exact: true })).toBeVisible();
    await expect(page.getByText('WAUZZZGYXA000129', { exact: true })).toHaveCount(0);
    await expect(page.getByText('AU/stock AU381070234 · Plate IN-S3553')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Audi A3 Limousine TDI 2.0 R4110 DSG' }),
    ).toHaveCount(1);
  });
});
