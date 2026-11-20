import type { GarageVehicle, VINDecodeResult } from '../types';

const STORAGE_KEY = 'autoparts.garage.v1';
const CHANGE_EVENT = 'autoparts:garage-changed';

function read(): GarageVehicle[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.vin === 'string') : [];
  } catch {
    return [];
  }
}

function write(vehicles: GarageVehicle[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles.slice(0, 12)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}

export function getGarageVehicles(): GarageVehicle[] {
  return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function isVehicleSaved(vin: string): boolean {
  return read().some(vehicle => vehicle.vin === vin);
}

export function saveVehicle(result: VINDecodeResult): void {
  const vehicle: GarageVehicle = {
    vin: result.vin,
    year: result.year || '',
    make: result.make || '',
    model: result.model || '',
    trim: result.trim,
    engine: result.engine,
    savedAt: new Date().toISOString(),
  };
  write([vehicle, ...read().filter(item => item.vin !== result.vin)]);
}

export function removeVehicle(vin: string): void {
  write(read().filter(vehicle => vehicle.vin !== vin));
}

/** Merge a transfer bundle without duplicating VINs or losing the newest save. */
export function mergeGarageVehicles(vehicles: GarageVehicle[]): number {
  const existing = new Map(read().map(vehicle => [vehicle.vin, vehicle]));
  let imported = 0;
  for (const vehicle of vehicles) {
    const current = existing.get(vehicle.vin);
    if (!current) {
      existing.set(vehicle.vin, vehicle);
      imported += 1;
    } else if (vehicle.savedAt > current.savedAt) {
      existing.set(vehicle.vin, vehicle);
      imported += 1;
    }
  }
  write([...existing.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
  return imported;
}

export function garageChangedEvent(): string {
  return CHANGE_EVENT;
}
