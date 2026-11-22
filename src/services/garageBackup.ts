import type { GarageVehicle } from '../types';
import {
  GARAGE_MAX_VEHICLES,
  GARAGE_NOTES_MAX_LENGTH,
  getGarageVehicles,
  replaceGarageVehicles,
} from './garage';

/**
 * File backup for My Garage.
 *
 * The transfer code in garageTransfer.ts is a merge: it adds vehicles and keeps
 * the newest save per VIN. A backup is the opposite — restoring replaces the
 * garage with the file's contents, so the previous state comes back exactly,
 * including names, notes, and save dates.
 */

export const GARAGE_BACKUP_FORMAT = 'autoparts-garage-backup';
export const GARAGE_BACKUP_VERSION = 1;

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export interface GarageBackup {
  format: typeof GARAGE_BACKUP_FORMAT;
  version: typeof GARAGE_BACKUP_VERSION;
  exportedAt: string;
  vehicles: GarageVehicle[];
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function nullableText(value: unknown, max: number): string | null {
  const clean = text(value, max).trim();
  return clean || null;
}

/**
 * Build a clean vehicle from untrusted JSON. Fields are copied explicitly so a
 * crafted backup cannot smuggle extra properties into storage, and every value
 * is length-capped so one file cannot exhaust the localStorage quota.
 */
function normalizeVehicle(value: unknown): GarageVehicle | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;

  const vin = text(source.vin, 20).trim().toUpperCase();
  if (!VIN_PATTERN.test(vin)) return null;

  const savedAtRaw = text(source.savedAt, 40).trim();
  const savedAt = Number.isNaN(Date.parse(savedAtRaw)) ? new Date().toISOString() : savedAtRaw;

  return {
    vin,
    year: text(source.year, 12).trim(),
    make: text(source.make, 80).trim(),
    model: text(source.model, 120).trim(),
    trim: nullableText(source.trim, 120),
    engine: nullableText(source.engine, 160),
    name: nullableText(source.name, 80),
    notes: text(source.notes, GARAGE_NOTES_MAX_LENGTH),
    savedAt,
  };
}

export function createGarageBackup(): GarageBackup {
  return {
    format: GARAGE_BACKUP_FORMAT,
    version: GARAGE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    vehicles: getGarageVehicles().map(vehicle => ({ ...vehicle })),
  };
}

export function garageBackupJson(): string {
  return JSON.stringify(createGarageBackup(), null, 2);
}

export function garageBackupFilename(date = new Date()): string {
  return `autoparts-garage-backup-${date.toISOString().slice(0, 10)}.json`;
}

export interface GarageBackupPreview {
  /** Unique, validated vehicles in the file's order, possibly above the cap. */
  vehicles: GarageVehicle[];
  exportedAt: string | null;
  /** Entries rejected for an invalid VIN or repeated VIN. */
  skipped: number;
}

export interface GarageBackupParseResult {
  preview?: GarageBackupPreview;
  error?: string;
}

export function parseGarageBackup(input: string): GarageBackupParseResult {
  if (!input.trim()) return { error: 'That backup file is empty.' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return { error: 'That file is not a valid JSON garage backup.' };
  }

  const container: Record<string, unknown> | null = Array.isArray(parsed)
    ? { vehicles: parsed }
    : parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;

  if (!container) return { error: 'That file is not a garage backup.' };

  const rawVehicles = container.vehicles;
  if (!Array.isArray(rawVehicles)) {
    return { error: 'That file does not contain a vehicle list.' };
  }

  const unique = new Map<string, GarageVehicle>();
  for (const raw of rawVehicles) {
    const vehicle = normalizeVehicle(raw);
    if (vehicle && !unique.has(vehicle.vin)) unique.set(vehicle.vin, vehicle);
  }

  if (unique.size === 0) {
    return { error: 'No vehicles with a valid 17-character VIN were found in that backup.' };
  }

  const exportedAtRaw = typeof container.exportedAt === 'string' ? container.exportedAt : '';
  const exportedAt = Number.isNaN(Date.parse(exportedAtRaw)) ? null : exportedAtRaw;

  return {
    preview: {
      vehicles: [...unique.values()],
      exportedAt,
      skipped: rawVehicles.length - unique.size,
    },
  };
}

export interface GarageRestoreResult {
  restored: number;
  /** Valid vehicles left out because the garage only holds GARAGE_MAX_VEHICLES. */
  dropped: number;
  error?: string;
}

export function restoreGarageBackup(preview: GarageBackupPreview): GarageRestoreResult {
  const vehicles = preview.vehicles.slice(0, GARAGE_MAX_VEHICLES);
  if (!replaceGarageVehicles(vehicles)) {
    return {
      restored: 0,
      dropped: 0,
      error: 'This browser blocked local storage, so the garage could not be restored.',
    };
  }
  return { restored: vehicles.length, dropped: preview.vehicles.length - vehicles.length };
}
