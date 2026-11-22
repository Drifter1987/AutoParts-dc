import type { GarageVehicle } from '../types';
import {
  GARAGE_MAX_VEHICLES,
  GARAGE_NOTES_MAX_LENGTH,
  getGarageVehicles,
  replaceGarageVehicles,
} from './garage';
import { decodeVin } from './nhtsa';

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
export const FLEET_IMPORT_MAX_ROWS = 100;

type Delimiter = '\t' | ',' | ';' | '|';

const HEADER_ALIASES: Record<string, string[]> = {
  vin: ['vin', 'vinnumber', 'vehicleidentificationnumber', 'vehicleid', 'chassis', 'chassisnumber'],
  name: ['name', 'vehicle', 'vehicles', 'vehiclename', 'model', 'makemodel', 'description'],
  stockNumber: [
    'au',
    'aunumber',
    'auno',
    'austock',
    'austocknumber',
    'austockno',
    'stock',
    'stocknumber',
    'stockno',
    'stocknum',
  ],
  plate: ['plate', 'licenseplate', 'licenceplate', 'registration', 'reg', 'tag'],
  notes: ['notes', 'note', 'comments', 'comment'],
};

export interface FleetSheetRow {
  line: number;
  vin: string;
  name: string;
  stockNumber: string;
  plate: string;
  notes: string;
}

export type FleetSheetIssueReason =
  | 'invalid-vin'
  | 'duplicate-vin'
  | 'stock-conflict'
  | 'too-many-rows';

export interface FleetSheetIssue {
  line: number;
  vin: string;
  reason: FleetSheetIssueReason;
  message: string;
}

export interface FleetSheetPreview {
  rows: FleetSheetRow[];
  issues: FleetSheetIssue[];
  totalRows: number;
}

export interface FleetSheetParseResult {
  preview?: FleetSheetPreview;
  error?: string;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cleanCell(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/^\s*`+/, '')
    .replace(/`+\s*$/, '')
    .replace(/\*\*/g, '')
    .replace(/^'/, '')
    .trim();
}

function detectDelimiter(line: string): Delimiter | null {
  if (line.trim().startsWith('|')) return '|';
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  if (line.includes(',')) return ',';
  return null;
}

/** Parse one CSV/TSV line, including quoted cells. Newlines inside a cell are not supported. */
function parseDelimitedLine(line: string, delimiter: Delimiter): string[] {
  const source =
    delimiter === '|' ? line.trim().replace(/^\|/, '').replace(/\|$/, '') : line;
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(cleanCell(current));
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(cleanCell(current));
  return cells;
}

function findColumn(cells: string[], aliases: string[]): number {
  return cells.findIndex(cell => aliases.includes(normalizeKey(cell)));
}

function stripVin(value: string): string {
  return value
    .toUpperCase()
    .replace(/^VIN[:\s-]*/i, '')
    .replace(/[\s`]/g, '');
}

function cap(value: string, max: number): string {
  return value.trim().slice(0, max);
}

/**
 * Parse a pasted fleet sheet. The first row must be a header containing a VIN
 * column, or the VIN must be the first cell of every row. A markdown table works
 * as long as it has a header row; its separator row is ignored.
 */
export function parseFleetSheet(input: string): FleetSheetParseResult {
  const lines = input
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter(item => item.text && !item.text.startsWith('#'));

  if (lines.length === 0) return { error: 'Paste a fleet sheet first.' };

  const delimiter = detectDelimiter(lines[0].text);
  if (!delimiter) {
    return { error: 'Use a CSV, TSV, or markdown table with a VIN column.' };
  }

  const parsed = lines
    .map(item => ({ line: item.line, cells: parseDelimitedLine(item.text, delimiter) }))
    .filter(item => item.cells.some(Boolean))
    .filter(item => !item.cells.every(cell => /^:?-{3,}:?$/.test(cell)));

  if (parsed.length === 0) return { error: 'No fleet rows were found.' };

  const header = parsed[0].cells;
  const vinColumn = findColumn(header, HEADER_ALIASES.vin);
  const hasHeader = vinColumn >= 0;
  const columns = hasHeader
    ? {
        vin: vinColumn,
        name: findColumn(header, HEADER_ALIASES.name),
        stockNumber: findColumn(header, HEADER_ALIASES.stockNumber),
        plate: findColumn(header, HEADER_ALIASES.plate),
        notes: findColumn(header, HEADER_ALIASES.notes),
      }
    : { vin: 0, name: 1, stockNumber: 2, plate: 3, notes: 4 };

  const dataRows = hasHeader ? parsed.slice(1) : parsed;
  if (!hasHeader && !VIN_PATTERN.test(stripVin(parsed[0].cells[0] ?? ''))) {
    return {
      error:
        'Add a header row with VIN, Name, AU/Stock, and Plate, or put the VIN in the first column.',
    };
  }

  const rows: FleetSheetRow[] = [];
  const issues: FleetSheetIssue[] = [];
  const seen = new Map<string, number>();

  for (const item of dataRows) {
    if (rows.length >= FLEET_IMPORT_MAX_ROWS) {
      issues.push({
        line: item.line,
        vin: '',
        reason: 'too-many-rows',
        message: `Only the first ${FLEET_IMPORT_MAX_ROWS} valid rows are imported at a time.`,
      });
      break;
    }

    const cell = (index: number) => (index >= 0 ? item.cells[index] ?? '' : '');
    const vin = stripVin(cell(columns.vin));
    const name = cap(cell(columns.name), 80);
    const stockNumber = cap(cell(columns.stockNumber), 40);
    const plate = cap(cell(columns.plate), 20);
    const notes = cap(cell(columns.notes), GARAGE_NOTES_MAX_LENGTH);

    if (!vin && !name && !stockNumber && !plate && !notes) continue;

    if (!VIN_PATTERN.test(vin)) {
      issues.push({
        line: item.line,
        vin,
        reason: 'invalid-vin',
        message: `${vin ? `“${vin}”` : 'The VIN cell'} must be exactly 17 characters (no I, O, or Q).`,
      });
      continue;
    }

    const firstLine = seen.get(vin);
    if (firstLine) {
      issues.push({
        line: item.line,
        vin,
        reason: 'duplicate-vin',
        message: `Duplicate VIN ${vin}; line ${firstLine} already uses it, so this row was not added.`,
      });
      continue;
    }

    seen.set(vin, item.line);
    rows.push({ line: item.line, vin, name, stockNumber, plate, notes });
  }

  if (rows.length === 0) {
    return { error: 'No valid 17-character VINs were found. Check the VIN column and try again.' };
  }

  return { preview: { rows, issues, totalRows: dataRows.length } };
}

/** Read an AU/stock number from the field, or from the note format used by the 15 saved Audis. */
function getSavedStockNumber(vehicle: GarageVehicle): string {
  if (vehicle.stockNumber?.trim()) return vehicle.stockNumber.trim();
  const notes = vehicle.notes ?? '';
  const explicit = notes.match(/Fleet sheet row[^·]*·\s*(AU\d{6,})/i);
  if (explicit) return explicit[1].toUpperCase();
  return notes.match(/\bAU\d{6,}\b/i)?.[0]?.toUpperCase() ?? '';
}

function getSavedPlate(vehicle: GarageVehicle): string {
  if (vehicle.plate?.trim()) return vehicle.plate.trim();
  return (vehicle.notes ?? '').match(/\bplate[:\s]+([A-Z0-9-]+)/i)?.[1]?.toUpperCase() ?? '';
}

export interface FleetImportPlan {
  newRows: FleetSheetRow[];
  updateRows: FleetSheetRow[];
  /** Rows matched by AU/stock to a saved vehicle whose VIN is not 17 characters. */
  repairRows: FleetSheetRow[];
  conflicts: FleetSheetIssue[];
  overflowRows: FleetSheetRow[];
  availableSlots: number;
}

/**
 * Compare the sheet with the garage. A VIN match is an update; an AU/stock
 * match to an invalid saved VIN is a repair; anything else is new.
 */
export function planFleetImport(rows: FleetSheetRow[]): FleetImportPlan {
  const current = getGarageVehicles();
  const byVin = new Map<string, GarageVehicle>();
  const byStock = new Map<string, GarageVehicle>();

  for (const vehicle of current) {
    byVin.set(vehicle.vin.toUpperCase(), vehicle);
    const stock = normalizeKey(getSavedStockNumber(vehicle));
    if (stock && !byStock.has(stock)) byStock.set(stock, vehicle);
  }

  const newRows: FleetSheetRow[] = [];
  const updateRows: FleetSheetRow[] = [];
  const repairRows: FleetSheetRow[] = [];
  const conflicts: FleetSheetIssue[] = [];
  const claimedStock = new Set<string>();

  for (const row of rows) {
    if (byVin.has(row.vin)) {
      updateRows.push(row);
      continue;
    }

    const stockKey = normalizeKey(row.stockNumber);
    const stockMatch = stockKey ? byStock.get(stockKey) : undefined;
    if (stockMatch) {
      if (claimedStock.has(stockKey)) {
        conflicts.push({
          line: row.line,
          vin: row.vin,
          reason: 'stock-conflict',
          message: `AU/stock ${row.stockNumber} appears more than once; only the first matching row is used.`,
        });
        continue;
      }
      claimedStock.add(stockKey);

      if (VIN_PATTERN.test(stockMatch.vin.toUpperCase())) {
        conflicts.push({
          line: row.line,
          vin: row.vin,
          reason: 'stock-conflict',
          message: `AU/stock ${row.stockNumber} is already saved under VIN ${stockMatch.vin}; this row was not merged.`,
        });
      } else {
        repairRows.push(row);
      }
      continue;
    }

    newRows.push(row);
  }

  const availableSlots = Math.max(0, GARAGE_MAX_VEHICLES - current.length);
  const overflowRows = newRows.splice(availableSlots);

  return { newRows, updateRows, repairRows, conflicts, overflowRows, availableSlots };
}

export interface FleetImportIdentity {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string | null;
  engine: string | null;
}

export interface FleetDecodeResult {
  identities: Map<string, FleetImportIdentity>;
  failed: Set<string>;
}

/** Decode new VINs with the same lookup the VIN page uses. Failures leave a blank identity. */
export async function decodeFleetRows(
  rows: FleetSheetRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<FleetDecodeResult> {
  const identities = new Map<string, FleetImportIdentity>();
  const failed = new Set<string>();
  const total = rows.length;
  let done = 0;
  onProgress?.(0, total);

  const queue = [...rows];
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length > 0) {
      const row = queue.shift();
      if (!row) continue;
      try {
        const decoded = await decodeVin(row.vin, { includeSpecs: false });
        identities.set(row.vin, {
          vin: row.vin,
          year: decoded.year ?? '',
          make: decoded.make ?? '',
          model: decoded.model ?? '',
          trim: decoded.trim,
          engine: decoded.engine,
        });
      } catch {
        failed.add(row.vin);
        identities.set(row.vin, {
          vin: row.vin,
          year: '',
          make: '',
          model: '',
          trim: null,
          engine: null,
        });
      }
      done += 1;
      onProgress?.(done, total);
    }
  });

  await Promise.all(workers);
  return { identities, failed };
}

function fleetImportNote(row: FleetSheetRow, decodeFailed: boolean): string {
  const parts = ['Fleet sheet import'];
  if (row.stockNumber) parts.push(`AU/stock ${row.stockNumber}`);
  if (row.plate) parts.push(`plate ${row.plate}`);
  if (decodeFailed) parts.push('VIN decode unavailable at import; reopen the VIN to retry');
  return `${parts.join(' · ')}.`;
}

export interface FleetImportMergeResult {
  imported: number;
  updated: number;
  repaired: number;
  skipped: number;
  dropped: number;
  conflicts: number;
  error?: string;
}

/**
 * Merge a planned import in one write. Existing names and non-empty notes win;
 * the sheet fills them only when they are blank. AU/stock and plate always take
 * the sheet value when supplied.
 */
export function mergeFleetImport(
  plan: FleetImportPlan,
  decoded: FleetDecodeResult,
): FleetImportMergeResult {
  const current = getGarageVehicles();
  const next: GarageVehicle[] = current.map(vehicle => ({ ...vehicle }));
  const nextByVin = new Map<string, GarageVehicle>();
  for (const vehicle of next) nextByVin.set(vehicle.vin.toUpperCase(), vehicle);

  let imported = 0;
  let updated = 0;
  let repaired = 0;
  let skipped = 0;
  const now = Date.now();
  let sequence = 0;

  for (const row of plan.updateRows) {
    const existing = nextByVin.get(row.vin);
    if (!existing) {
      skipped += 1;
      continue;
    }
    existing.name = existing.name?.trim() ? existing.name : row.name || null;
    existing.notes = existing.notes?.trim() ? existing.notes : row.notes || null;
    existing.stockNumber = getSavedStockNumber(existing) || row.stockNumber || null;
    existing.plate = getSavedPlate(existing) || row.plate || null;
    updated += 1;
  }

  for (const row of plan.repairRows) {
    const stockKey = normalizeKey(row.stockNumber);
    if (!stockKey) {
      skipped += 1;
      continue;
    }
    const existing = next.find(
      vehicle => normalizeKey(getSavedStockNumber(vehicle)) === stockKey,
    );
    if (!existing) {
      skipped += 1;
      continue;
    }
    const alreadySaved = nextByVin.get(row.vin);
    if (alreadySaved && alreadySaved !== existing) {
      skipped += 1;
      continue;
    }

    const oldVin = existing.vin.toUpperCase();
    existing.vin = row.vin;
    existing.name = existing.name?.trim() ? existing.name : row.name || null;
    existing.notes = existing.notes?.trim() ? existing.notes : row.notes || null;
    existing.stockNumber = getSavedStockNumber(existing) || row.stockNumber || null;
    existing.plate = getSavedPlate(existing) || row.plate || null;
    nextByVin.delete(oldVin);
    nextByVin.set(row.vin, existing);
    repaired += 1;
  }

  for (const row of plan.newRows) {
    const existing = nextByVin.get(row.vin);
    if (existing) {
      // Another tab may have saved this VIN after the preview; keep its name/notes.
      existing.name = existing.name?.trim() ? existing.name : row.name || null;
      existing.notes = existing.notes?.trim() ? existing.notes : row.notes || null;
      existing.stockNumber = getSavedStockNumber(existing) || row.stockNumber || null;
      existing.plate = getSavedPlate(existing) || row.plate || null;
      updated += 1;
      continue;
    }
    if (next.length >= GARAGE_MAX_VEHICLES) {
      skipped += 1;
      continue;
    }

    const identity = decoded.identities.get(row.vin);
    const failed = decoded.failed.has(row.vin);
    const vehicle: GarageVehicle = {
      vin: row.vin,
      year: identity?.year ?? '',
      make: identity?.make ?? '',
      model: identity?.model ?? '',
      trim: identity?.trim ?? null,
      engine: identity?.engine ?? null,
      name: row.name || null,
      notes: (row.notes || fleetImportNote(row, failed)).slice(0, GARAGE_NOTES_MAX_LENGTH),
      stockNumber: row.stockNumber || null,
      plate: row.plate || null,
      savedAt: new Date(now - sequence * 1000).toISOString(),
    };
    sequence += 1;
    next.push(vehicle);
    nextByVin.set(row.vin, vehicle);
    imported += 1;
  }

  if (!replaceGarageVehicles(next)) {
    return {
      imported: 0,
      updated: 0,
      repaired: 0,
      skipped: 0,
      dropped: 0,
      conflicts: plan.conflicts.length,
      error: 'This browser blocked local storage, so the fleet sheet could not be imported.',
    };
  }

  return {
    imported,
    updated,
    repaired,
    skipped,
    dropped: plan.overflowRows.length,
    conflicts: plan.conflicts.length,
  };
}
