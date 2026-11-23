import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { stubGoogleFonts } from './google-fonts-stubs';

const GARAGE_KEY = 'autoparts.garage.v1';

test.describe('My Garage backup/restore', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleFonts(page);
  });

  test('switches tabs with arrow, Home, and End keys and hides the inactive panel', async ({
    page,
  }) => {
    await page.goto('/garage');

    const fleetTab = page.getByRole('tab', { name: 'Fleet sheet' });
    const backupTab = page.getByRole('tab', { name: 'Backup file' });
    const fleetPanel = page.locator('#garage-fleet-panel');
    const backupPanel = page.locator('#garage-backup-panel');

    await expect(fleetTab).toHaveAttribute('aria-selected', 'true');
    await expect(fleetPanel).toBeVisible();
    await expect(backupPanel).toBeHidden();

    await fleetTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(backupTab).toBeFocused();
    await expect(backupTab).toHaveAttribute('aria-selected', 'true');
    await expect(backupPanel).toBeVisible();
    await expect(fleetPanel).toBeHidden();

    await page.keyboard.press('Home');
    await expect(fleetTab).toBeFocused();
    await expect(fleetTab).toHaveAttribute('aria-selected', 'true');
    await expect(fleetPanel).toBeVisible();

    await page.keyboard.press('End');
    await expect(backupTab).toBeFocused();
    await expect(backupTab).toHaveAttribute('aria-selected', 'true');
    await expect(backupPanel).toBeVisible();

    await page.keyboard.press('ArrowRight');
    await expect(fleetTab).toBeFocused();
    await expect(fleetTab).toHaveAttribute('aria-selected', 'true');
  });

  test('round-trips names, notes, and fleet identifiers through a backup file', async ({ page }) => {
    const savedVehicle = {
      vin: '1HGCM82633A004352',
      year: '2003',
      make: 'HONDA',
      model: 'Accord',
      trim: 'EX',
      engine: '2.4L',
      name: 'Fleet test car',
      notes: 'Oil change due at 120k.',
      stockNumber: 'AU-TEST-001',
      plate: 'TEST-PLATE',
      savedAt: '2026-11-22T15:34:05.574Z',
    };

    await page.goto('/garage');
    await page.evaluate(
      ({ key, vehicle }) => localStorage.setItem(key, JSON.stringify([vehicle])),
      { key: GARAGE_KEY, vehicle: savedVehicle },
    );
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Import / export' })).toBeVisible();
    await expect(page.getByText('1 of 20 garage spaces used')).toBeVisible();

    await page.getByRole('tab', { name: 'Backup file' }).click();
    await expect(page.getByRole('tab', { name: 'Backup file' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download backup' }).click();
    const download = await downloadPromise;
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();

    const backup = readFileSync(downloadedPath!, 'utf8');
    const parsed = JSON.parse(backup) as {
      vehicles: Array<Record<string, unknown>>;
    };
    expect(parsed.vehicles[0]).toMatchObject({
      vin: '1HGCM82633A004352',
      name: 'Fleet test car',
      notes: 'Oil change due at 120k.',
      stockNumber: 'AU-TEST-001',
      plate: 'TEST-PLATE',
    });

    await page.evaluate(key => localStorage.removeItem(key), GARAGE_KEY);
    await page.reload();
    await expect(page.getByText('0 of 20 garage spaces used')).toBeVisible();

    await page.getByRole('tab', { name: 'Backup file' }).click();
    await page
      .locator('input[type="file"][accept*="json"]')
      .setInputFiles({
        name: 'garage-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(backup),
      });

    await expect(page.getByText(/containing 1 saved vehicle/i)).toBeVisible();
    await page.getByRole('button', { name: 'Restore garage' }).click();

    await expect(page.getByText(/Restored 1 saved vehicle/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fleet test car' })).toBeVisible();
    await expect(page.getByLabel('Notes for Fleet test car')).toHaveValue(
      'Oil change due at 120k.',
    );
    await expect(
      page.getByText('AU/stock AU-TEST-001 · Plate TEST-PLATE', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('1 of 20 garage spaces used')).toBeVisible();
  });
});
