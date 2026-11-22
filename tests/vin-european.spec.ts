import { test, expect } from '@playwright/test';
import { stubGoogleFonts } from './google-fonts-stubs';
import { stubNhtsa } from './nhtsa-stubs';
import { AUDI_FLEET_VINS } from './fleet-vins';

const RENAULT_VIN = 'VF1RFB00X12345678';

function vehicleHeading(year: string, model: string): RegExp {
  const escaped = model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${year} AUDI ${escaped}`, 'i');
}

test.describe('International VIN handling', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleFonts(page);
    await stubNhtsa(page);
  });

  test('decodes every 17-character fleet VIN with an inferred model', async ({ page }) => {
    const decodable = AUDI_FLEET_VINS.filter(vehicle => vehicle.vin.length === 17);
    expect(decodable).toHaveLength(14);

    for (const vehicle of decodable) {
      await test.step(`${vehicle.vin} → ${vehicle.expectedModel}`, async () => {
        await page.goto(`/vin?vin=${vehicle.vin}`);

        await expect(
          page.getByRole('heading', { name: vehicleHeading(vehicle.year, vehicle.expectedModel) }),
        ).toBeVisible();
        await expect(
          page.getByText(`Model inferred from VIN positions 7–8 (${vehicle.code})`),
        ).toBeVisible();
        await expect(page.getByText('US-market recall lookup skipped.')).toBeVisible();
        await expect(
          page.getByText('No recall campaigns returned for this model year.'),
        ).toHaveCount(0);
        await expect(page.getByText(/null null/)).toHaveCount(0);
      });
    }
  });

  test('rejects the 16-character fleet VIN instead of inventing a model', async ({ page }) => {
    const shortVin = AUDI_FLEET_VINS.find(vehicle => vehicle.vin.length === 16);
    expect(shortVin).toBeTruthy();

    await page.goto('/vin');
    const input = page.getByRole('textbox', { name: 'Vehicle Identification Number (VIN)' });
    await input.fill(shortVin!.vin);

    await expect(page.getByText('16/17')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Decode VIN' })).toBeDisabled();
    await expect(page.getByText('VIN Decoded', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Model inferred from VIN positions/)).toHaveCount(0);
  });

  test('shows explicit market-data states for the Renault VIN without a make or model', async ({
    page,
  }) => {
    await page.goto(`/vin?vin=${RENAULT_VIN}`);

    await expect(page.getByRole('heading', { name: '2001', exact: true })).toBeVisible();
    await expect(
      page.getByText('2001 · Model data not available for this market', { exact: true }),
    ).toBeVisible();

    const recalls = page.getByRole('region', { name: 'NHTSA safety recalls' });
    await expect(
      recalls.getByText('Model data not available for this market.', { exact: true }),
    ).toBeVisible();
    await expect(
      recalls.getByText(/did not return enough model data for this market/i),
    ).toBeVisible();
    await expect(
      recalls.getByText('No recall campaigns returned for this model year.'),
    ).toHaveCount(0);
    await expect(page.getByText(/null null/)).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: /Check this VIN for open recalls/ }),
    ).toBeVisible();
  });
});
