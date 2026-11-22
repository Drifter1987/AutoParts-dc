import type { FleetRow } from '../types';
import { decodeVin } from './nhtsa';
import { getRecallsForVehicle, nhtsaRecallUrl } from './recalls';

const MAX_VINS = 25;
const VIN_PATTERN = /[A-HJ-NPR-Z0-9]{17}/g;

/** Pull VINs out of pasted text or a simple CSV without requiring a column name. */
export function extractFleetVins(input: string): string[] {
  const matches = input.toUpperCase().match(VIN_PATTERN) ?? [];
  return [...new Set(matches)].slice(0, MAX_VINS);
}

export async function checkFleetVins(
  vins: string[],
  onRow: (row: FleetRow) => void,
): Promise<FleetRow[]> {
  const rows: FleetRow[] = vins.slice(0, MAX_VINS).map(vin => ({ vin, status: 'pending' }));
  if (rows[0]) onRow({ ...rows[0] });

  let cursor = 0;
  const workers = Array.from({ length: Math.min(3, rows.length) }, async () => {
    while (cursor < rows.length) {
      const index = cursor;
      cursor += 1;
      const row = rows[index];
      row.status = 'checking';
      onRow({ ...row });
      try {
        const decoded = await decodeVin(row.vin, { includeSpecs: false });
        const recalls = await getRecallsForVehicle(decoded);
        Object.assign(row, {
          status: 'complete',
          year: decoded.year,
          make: decoded.make,
          model: decoded.model,
          recallNote:
            decoded.model_source === 'vin-pattern'
              ? 'US-market recall lookup skipped — model inferred from the VIN.'
              : null,
          recalls,
          checkedAt: new Date().toISOString(),
        });
      } catch (error) {
        Object.assign(row, {
          status: 'error',
          error: error instanceof Error ? error.message : 'VIN check failed.',
        });
      }
      onRow({ ...row });
    }
  });

  await Promise.all(workers);
  return rows;
}

export function fleetCsv(rows: FleetRow[]): string {
  const header = [
    'VIN',
    'Year',
    'Make',
    'Model',
    'Campaigns',
    'CampaignNumbers',
    'NHTSA_VIN_Check',
    'Status',
    'Error',
  ];
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = rows.map(row =>
    [
      row.vin,
      row.year ?? '',
      row.make ?? '',
      row.model ?? '',
      String(row.recalls?.length ?? 0),
      (row.recalls ?? []).map(recall => recall.campaignNumber).join('; '),
      nhtsaRecallUrl(row.vin),
      row.status,
      row.error ?? '',
    ]
      .map(value => escape(String(value)))
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export const FLEET_MAX_VINS = MAX_VINS;
