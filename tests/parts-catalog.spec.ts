import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import {
  assertUniqueCatalogIdentities,
  buildAllParts,
  getVehicleKey,
  searchPartsIn,
} from '../src/services/partsIndex';
import { formatFreshness } from '../src/services/provenance';
import type { VehicleCatalog } from '../src/types';

const run = promisify(execFile);

async function loadCatalog(relativePath: string): Promise<VehicleCatalog> {
  const text = await readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
  return JSON.parse(text) as VehicleCatalog;
}

test.describe('parts catalog schema and loader', () => {
  test('indexes multiple vehicles with vehicle-qualified part context', async () => {
    const catalogs = await Promise.all([
      loadCatalog('src/data/parts/civic-2020.json'),
      loadCatalog('tests/fixtures/parts/fixture-motors-hatch-2021.json'),
      loadCatalog('tests/fixtures/parts/sample-works-pickup-2020.json'),
    ]);

    assertUniqueCatalogIdentities(catalogs);
    expect(catalogs.map(getVehicleKey)).toEqual([
      'honda/civic/2020',
      'fixture-motors/hatch/2021',
      'sample-works/pickup/2020',
    ]);

    const allParts = buildAllParts(catalogs);
    expect(allParts).toHaveLength(41);

    const fixturePart = searchPartsIn(allParts, 'FX-1101-A')[0];
    expect(fixturePart).toMatchObject({
      slug: 'fixture-oil-filter',
      assemblySlug: 'engine',
      brandSlug: 'fixture-motors',
      modelSlug: 'hatch',
      year: 2021,
      vehicleLabel: '2021 Fixture Motors Hatch',
    });

    const civicPart = searchPartsIn(allParts, '45022-TBA-A00');
    expect(civicPart).toHaveLength(1);
    expect(civicPart[0].vehicleLabel).toBe('2020 Honda Civic');
    expect(civicPart[0].assemblySlug).toBe('brakes');

    expect(searchPartsIn(allParts, 'front pads').map(part => part.slug)).toEqual(
      expect.arrayContaining(['front-brake-pads', 'fixture-front-pads']),
    );

    expect(() => assertUniqueCatalogIdentities([...catalogs, catalogs[1]])).toThrow(
      /duplicate catalog vehicle fixture-motors\/hatch\/2021/i,
    );
  });

  test('ranks exact numbers first and tolerates formatting and typos', async () => {
    const civic = await loadCatalog('src/data/parts/civic-2020.json');
    const parts = buildAllParts([civic]);

    for (const query of ['45022-TBA-A00', '45022tbaa00', '45022 tba a00']) {
      expect(searchPartsIn(parts, query)[0]?.slug).toBe('front-brake-pads');
    }

    expect(searchPartsIn(parts, 'brake padz')[0]?.slug).toBe('front-brake-pads');
    expect(searchPartsIn(parts, 'front pads')[0]?.slug).toBe('front-brake-pads');
    expect(searchPartsIn(parts, 'engine oil filter')[0]?.slug).toBe('engine-oil-filter');
    expect(searchPartsIn(parts, 'zzzzzz')).toHaveLength(0);
  });

  test('formats freshness without hiding an unreadable date', () => {
    expect(formatFreshness('2026-11-17', new Date('2026-11-25T12:00:00Z'))).toBe(
      'Updated 8 days ago',
    );
    expect(formatFreshness('2026-11-25', new Date('2026-11-25T12:00:00Z'))).toBe('Updated today');
    expect(formatFreshness('not-a-date')).toContain('not-a-date');
  });

  test('validator passes current catalogs and fails strict unlicensed ingestion', async () => {
    const passing = await run(process.execPath, ['scripts/validate-parts.mjs'], {
      cwd: process.cwd(),
    });
    expect(passing.stdout).toContain('Parts catalog validation passed.');
    expect(passing.stdout).toContain('"catalogs": 3');

    let failure: { code?: number; stdout?: string; stderr?: string } = {};
    try {
      await run(process.execPath, ['scripts/validate-parts.mjs', '--require-licensed'], {
        cwd: process.cwd(),
      });
    } catch (error) {
      failure = error as typeof failure;
    }

    expect(failure.code).toBe(1);
    expect(`${failure.stdout ?? ''}${failure.stderr ?? ''}`).toContain(
      '--require-licensed requires rights.status',
    );
    expect(`${failure.stdout ?? ''}${failure.stderr ?? ''}`).toContain('found');
  });
});
