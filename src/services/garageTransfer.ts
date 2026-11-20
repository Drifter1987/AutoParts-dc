import type { GarageVehicle } from '../types';
import { getGarageVehicles, mergeGarageVehicles } from './garage';

export interface AccountCapability {
  configured: boolean;
  provider: 'magic-link';
  message: string;
}

export function getAccountCapability(): AccountCapability {
  return {
    configured: false,
    provider: 'magic-link',
    message:
      'Optional magic-link account sync is not connected in this build. Use a local transfer code to move My Garage between browsers; no email or account is created.',
  };
}

export interface GarageTransferBundle {
  version: 1;
  exportedAt: string;
  vehicles: GarageVehicle[];
}

export function exportGarageCode(): string {
  const bundle: GarageTransferBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    vehicles: getGarageVehicles(),
  };
  const json = JSON.stringify(bundle);
  return btoa(unescape(encodeURIComponent(json)));
}

export interface GarageImportResult {
  imported: number;
  skipped: number;
  error?: string;
}

export function importGarageCode(code: string): GarageImportResult {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const parsed = JSON.parse(json) as Partial<GarageTransferBundle>;
    const candidates = Array.isArray(parsed.vehicles) ? parsed.vehicles : [];
    const valid = candidates.filter(
      (vehicle): vehicle is GarageVehicle =>
        Boolean(
          vehicle &&
            typeof vehicle.vin === 'string' &&
            /^[A-HJ-NPR-Z0-9]{17}$/.test(vehicle.vin.toUpperCase()) &&
            typeof vehicle.make === 'string' &&
            typeof vehicle.model === 'string',
        ),
    );
    const imported = mergeGarageVehicles(valid);
    return { imported, skipped: candidates.length - imported };
  } catch {
    return { imported: 0, skipped: 0, error: 'That garage code is not valid.' };
  }
}
