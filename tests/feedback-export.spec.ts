import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const DEMAND_KEY = 'autoparts.demand.v1';
const FITMENT_KEY = 'autoparts.fitment-feedback.v1';

test.describe('coverage and fitment feedback export', () => {
  test('downloads one escaped CSV and explains where the file goes', async ({ page }) => {
    await page.goto('/tools');
    await page.evaluate(
      ({ demandKey, fitmentKey }) => {
        localStorage.setItem(
          demandKey,
          JSON.stringify([
            {
              id: 'DEMAND-TEST',
              createdAt: '2026-11-25T10:00:00.000Z',
              vin: '',
              year: '2024',
              make: 'Toyota',
              model: 'Camry',
              partNeeded: 'front brake pads, "ceramic"',
              context: 'test-coverage',
              status: 'local-demand-list',
            },
          ]),
        );
        localStorage.setItem(
          fitmentKey,
          JSON.stringify([
            {
              id: 'FITREPORT-TEST',
              createdAt: '2026-11-25T11:00:00.000Z',
              partSlug: 'front-brake-pads',
              partName: 'Front Brake Pad Set',
              oemNumber: '45022-TBA-A00',
              brand: 'Honda',
              brandSlug: 'honda',
              model: 'Civic',
              modelSlug: 'civic',
              year: 2020,
              assemblySlug: 'brakes',
              assemblyName: 'Brakes',
              engine: '2.0L',
              trim: 'LX',
              issue: 'does-not-fit',
              note: 'Caliper bracket differs',
              status: 'local-fitment-feedback',
            },
          ]),
        );
      },
      { demandKey: DEMAND_KEY, fitmentKey: FITMENT_KEY },
    );
    await page.reload();

    await expect(
      page.getByRole('heading', { name: 'Coverage and fitment feedback CSV' }),
    ).toBeVisible();
    await expect(page.getByText(/usually your Downloads folder/i)).toBeVisible();
    await expect(page.getByText(/never uploads the file/i)).toBeVisible();
    await expect(page.getByText(/no email field/i)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download feedback CSV' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /^autoparts-coverage-fitment-feedback-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const path = await download.path();
    const csv = await readFile(path!, 'utf8');

    expect(csv).toContain('"Type","Reference","CreatedAt"');
    expect(csv).toContain('"Coverage","DEMAND-TEST"');
    expect(csv).toContain('"front brake pads, ""ceramic"""');
    expect(csv).toContain('"Fitment","FITREPORT-TEST"');
    expect(csv).toContain('"Does not fit my vehicle"');
    expect(csv).toContain('"Brakes"');
    expect(csv.toLowerCase()).not.toContain('email');
  });

  test('saves a fitment report locally with no email field', async ({ page }) => {
    await page.goto('/catalog/honda/civic/2020/engine/engine-air-filter?engine=2.0L&trim=LX');

    await page.getByRole('button', { name: 'Report a fitment problem' }).click();
    await expect(page.getByLabel(/Email/i)).toHaveCount(0);

    await page.getByLabel('What seems wrong?').selectOption('does-not-fit');
    await page.getByLabel(/What should we check/).fill('Air box differs from the catalog note');
    await page.getByRole('button', { name: 'Save fitment report' }).click();

    await expect(page.getByText(/Fitment report saved as FITREPORT-/)).toBeVisible();
    await expect(page.getByText(/Nothing was sent to a server/i)).toBeVisible();

    const rows = await page.evaluate(
      key => JSON.parse(localStorage.getItem(key) || '[]') as Record<string, unknown>[],
      FITMENT_KEY,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      partSlug: 'engine-air-filter',
      issue: 'does-not-fit',
      note: 'Air box differs from the catalog note',
      engine: '2.0L',
      trim: 'LX',
    });
    expect(rows[0]).not.toHaveProperty('email');
  });
});
