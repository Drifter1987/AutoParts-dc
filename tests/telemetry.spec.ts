import { test, expect, type Page } from '@playwright/test';
import { stubGoogleFonts } from './google-fonts-stubs';
import { stubNhtsa } from './nhtsa-stubs';
import { sanitizeTelemetryProperties } from '../src/services/telemetrySanitizer';

const KNOWN_VIN = '1HGCM82633A004352';
const BOGUS_VIN = '00000000000000000';
const SEARCH_EMAIL = 'owner@example.com';
const GARAGE_NAME = 'Private note owner@example.com';
const GARAGE_PLATE = 'PLATE-123';
const GARAGE_STOCK = 'AU-999';

const FUNNEL_EVENTS = [
  'vin_decode_success',
  'vin_decode_failure',
  'vin_report_print',
  'vin_report_share',
  'parts_search',
  'catalog_dead_end',
  'garage_import',
  'checklist_recheck',
];

interface CapturedPayload {
  kind?: string;
  event?: string;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
  errorType?: string;
  messageLength?: number;
}

async function captureTelemetry(page: Page): Promise<CapturedPayload[]> {
  const payloads: CapturedPayload[] = [];

  await page.route('**/__telemetry', async route => {
    const raw = route.request().postData();
    if (raw) {
      try {
        payloads.push(JSON.parse(raw) as CapturedPayload);
      } catch {
        // A malformed payload should fail the assertions below, not the route.
      }
    }
    await route.fulfill({ status: 204, body: '' });
  });

  return payloads;
}

function eventNames(payloads: CapturedPayload[]): string[] {
  return payloads
    .filter(payload => payload.kind === 'event' && payload.event)
    .map(payload => payload.event as string);
}

function assertNoSensitiveKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertNoSensitiveKeys);
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, nested] of Object.entries(value)) {
    // Length/count metrics are safe by construction; every other VIN, email,
    // plate, note, query, search, message, name, or stock field must be gone.
    const sensitive =
      key !== 'queryLength' &&
      /vin|email|e-mail|plate|notes?|query|search|message|name|stock/i.test(key);
    expect(sensitive, `sensitive key ${key}`).toBe(false);
    assertNoSensitiveKeys(nested);
  }
}

test.describe('telemetry privacy boundary', () => {
  test('the scrubber drops sensitive keys and VIN/email values', () => {
    expect(
      sanitizeTelemetryProperties({
        vin: KNOWN_VIN,
        email: SEARCH_EMAIL,
        plate: GARAGE_PLATE,
        notes: 'call the owner',
        query: 'brake pads',
        search: `?vin=${KNOWN_VIN}`,
        message: 'decode failed',
        name: GARAGE_NAME,
        emailAddress: SEARCH_EMAIL,
        vinNumber: KNOWN_VIN,
        count: 2,
        vehicle: '2020 Honda Civic',
      }),
    ).toEqual({ count: 2, vehicle: '2020 Honda Civic' });

    expect(sanitizeTelemetryProperties({ detail: KNOWN_VIN })).toEqual({});
    expect(sanitizeTelemetryProperties({ detail: SEARCH_EMAIL })).toEqual({});
  });

  test('real funnel and error payloads carry no VIN, email, plate, notes, raw query, or raw error text', async ({
    page,
  }) => {
    const payloads = await captureTelemetry(page);
    await stubGoogleFonts(page);
    await stubNhtsa(page);

    await page.addInitScript(
      ({ key, vin }: { key: string; vin: string }) => {
        localStorage.setItem(
          key,
          JSON.stringify([
            {
              vin,
              year: '2003',
              make: 'HONDA',
              model: 'Accord',
              trim: null,
              engine: null,
              model_source: 'nhtsa',
              addedAt: '2026-11-22T12:00:00.000Z',
              notificationsOptIn: false,
              lastCheckedAt: null,
              campaignHistory: [],
              newCampaigns: [],
              newCampaignsDetectedAt: null,
              completedRepairs: [],
            },
          ]),
        );
      },
      { key: 'autoparts.recall-watch.v1', vin: KNOWN_VIN },
    );

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async () => {},
      });
    });

    // A failed decode.
    await page.goto(`/vin?vin=${BOGUS_VIN}`);
    await expect(page.getByText(/NHTSA could not decode this VIN/i)).toBeVisible();
    await expect.poll(() => eventNames(payloads)).toContain('vin_decode_failure');

    // A successful decode.
    await page.goto('/vin');
    await page.locator('main').getByRole('textbox').fill(KNOWN_VIN);
    await page.getByRole('button', { name: 'Decode VIN' }).click();
    await expect(page.getByRole('heading', { name: /2003 HONDA Accord/i })).toBeVisible();
    await expect.poll(() => eventNames(payloads)).toContain('vin_decode_success');

    // Report print and share.
    await page.goto(`/vin?vin=${KNOWN_VIN}&report=1`);
    await expect(page.getByRole('heading', { name: 'What this report can tell you' })).toBeVisible();
    await page.getByRole('button', { name: 'Print / save PDF' }).click();
    await page.getByRole('button', { name: 'Share report' }).click();
    await expect.poll(() => eventNames(payloads)).toContain('vin_report_print');
    await expect.poll(() => eventNames(payloads)).toContain('vin_report_share');

    // Search with an email-shaped query: only length and count may be sent.
    await page.goto(`/search?q=${encodeURIComponent(SEARCH_EMAIL)}`);
    await expect(page.getByText(/No part or vehicle catalog match/i)).toBeVisible();
    await expect.poll(() => eventNames(payloads), { timeout: 10000 }).toContain('parts_search');

    // A valid catalog brand/model/year with no published vehicle.
    await page.goto('/catalog/toyota/camry/2020');
    await expect(page.getByRole('heading', { name: /2020 Toyota Camry/i }).first()).toBeVisible();
    await expect.poll(() => eventNames(payloads)).toContain('catalog_dead_end');

    // A fleet sheet import, including a private name and plate in the source.
    await page.goto('/garage');
    await page
      .getByLabel('Fleet sheet (CSV, TSV, or markdown table)')
      .fill(
        `VIN,Name,AU/Stock,Plate\n${KNOWN_VIN},${GARAGE_NAME},${GARAGE_STOCK},${GARAGE_PLATE}`,
      );
    await page.getByRole('button', { name: 'Review fleet sheet' }).click();
    await expect(page.getByText(/1 new vehicle ready to import/i)).toBeVisible();
    await page.getByRole('button', { name: 'Import fleet sheet' }).click();
    await expect(page.getByText(/Imported 1 new vehicle/i)).toBeVisible();
    await expect.poll(() => eventNames(payloads)).toContain('garage_import');

    // A checklist recheck for the seeded watch.
    await page.goto('/recall-center');
    await expect.poll(() => eventNames(payloads)).toContain('checklist_recheck');

    // An unhandled error whose message contains a VIN, email, and free text.
    await page.evaluate(
      ({ vin, email }: { vin: string; email: string }) => {
        const privateMessage = `private note ${email} for ${vin}`;
        window.dispatchEvent(
          new ErrorEvent('error', {
            error: new Error(privateMessage),
            message: privateMessage,
          }),
        );
      },
      { vin: KNOWN_VIN, email: SEARCH_EMAIL },
    );
    await expect
      .poll(() => payloads.filter(payload => payload.kind === 'error').length)
      .toBeGreaterThan(0);

    for (const event of FUNNEL_EVENTS) {
      expect(eventNames(payloads), `expected ${event}`).toContain(event);
    }

    const serialized = JSON.stringify(payloads);
    for (const secret of [
      KNOWN_VIN,
      BOGUS_VIN,
      SEARCH_EMAIL,
      GARAGE_NAME,
      GARAGE_PLATE,
      GARAGE_STOCK,
      'private note',
    ]) {
      expect(serialized, `payload leaked ${secret}`).not.toContain(secret);
    }

    for (const payload of payloads) {
      assertNoSensitiveKeys(payload.properties ?? {});
      assertNoSensitiveKeys(payload.context ?? {});
    }
  });
});
