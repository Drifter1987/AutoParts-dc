import type { GarageVehicle, VINDecodeResult } from '../types';

const STORAGE_KEY = 'autoparts.garage.v1';
const CHANGE_EVENT = 'autoparts:garage-changed';

/** Mirror of the storage cap applied by write(). */
export const GARAGE_MAX_VEHICLES = 20;

/** Kept in step with the backup format so a restore round-trips notes intact. */
export const GARAGE_NOTES_MAX_LENGTH = 4000;

/** Shared failure copy for any garage write the browser refuses. */
export const GARAGE_WRITE_FAILED_MESSAGE =
  'Could not update My Garage. Browser storage is unavailable or full.';

function read(): GarageVehicle[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.vin === 'string') : [];
  } catch {
    return [];
  }
}

function write(vehicles: GarageVehicle[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles.slice(0, GARAGE_MAX_VEHICLES)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
    return false;
  }
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * A saved vehicle's default name is the car itself, not a year/make label:
 * model, trim, then engine detail when the trim does not already name it.
 * For example, an A5 trim "quattro 2.0 TFSI" keeps that name without repeating
 * its 2.0 displacement from the engine field.
 */
export function getDefaultVehicleName(
  vehicle: Pick<GarageVehicle, 'year' | 'make' | 'model' | 'trim' | 'engine'>,
): string {
  const fallback = [vehicle.year, vehicle.make].filter(Boolean).join(' ').trim();
  const parts = [vehicle.model.trim() || fallback || 'Saved vehicle'];

  const trim = vehicle.trim?.trim();
  if (trim && !normalizeName(parts.join(' ')).includes(normalizeName(trim))) {
    parts.push(trim);
  }

  const engine = vehicle.engine?.trim();
  if (engine) {
    const named = normalizeName(parts.join(' '));
    const displacement = engine.match(/\d\.\d/)?.[0];
    const engineAlreadyNamed = named.includes(normalizeName(engine));
    const displacementAlreadyNamed = displacement
      ? named.includes(normalizeName(displacement))
      : false;
    if (!engineAlreadyNamed && !displacementAlreadyNamed) parts.push(engine);
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function getGarageVehicleName(vehicle: GarageVehicle): string {
  return vehicle.name?.trim() || getDefaultVehicleName(vehicle);
}

export function getGarageVehicles(): GarageVehicle[] {
  return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function isVehicleSaved(vin: string): boolean {
  return read().some(vehicle => vehicle.vin === vin);
}

/**
 * Apply a change to the freshest stored garage. localStorage has no
 * transaction API, so the read has to be part of the same synchronous
 * read-modify-write as the write: a mutation based on a snapshot taken earlier
 * can overwrite another tab's rename, notes, or newly saved vehicle.
 */
function mutateGarage(change: (vehicles: GarageVehicle[]) => GarageVehicle[]): boolean {
  return write(change(read()));
}

export function saveVehicle(result: VINDecodeResult): boolean {
  return mutateGarage(vehicles => {
    const existing = vehicles.find(vehicle => vehicle.vin === result.vin);
    const vehicle: GarageVehicle = {
      vin: result.vin,
      year: result.year || '',
      make: result.make || '',
      model: result.model || '',
      trim: result.trim,
      engine: result.engine,
      name: existing?.name ?? null,
      notes: existing?.notes ?? '',
      stockNumber: existing?.stockNumber ?? null,
      plate: existing?.plate ?? null,
      savedAt: new Date().toISOString(),
    };
    return [vehicle, ...vehicles.filter(item => item.vin !== result.vin)];
  });
}

/** Returns false when the browser refuses the write, so the caller can say so. */
export function renameGarageVehicle(vin: string, name: string): boolean {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 80);
  return mutateGarage(vehicles =>
    vehicles.map(vehicle => (vehicle.vin === vin ? { ...vehicle, name: clean || null } : vehicle)),
  );
}

/** Returns false when the browser refuses the write, so the caller can say so. */
export function updateGarageVehicleNotes(vin: string, notes: string): boolean {
  const clean = notes.slice(0, GARAGE_NOTES_MAX_LENGTH);
  return mutateGarage(vehicles =>
    vehicles.map(vehicle => (vehicle.vin === vin ? { ...vehicle, notes: clean } : vehicle)),
  );
}

export function removeVehicle(vin: string): boolean {
  return mutateGarage(vehicles => vehicles.filter(vehicle => vehicle.vin !== vin));
}

/** Merge a transfer bundle without duplicating VINs or losing the newest save. */
export function mergeGarageVehicles(vehicles: GarageVehicle[]): number {
  let imported = 0;
  mutateGarage(current => {
    const existing = new Map(current.map(vehicle => [vehicle.vin, vehicle]));
    for (const vehicle of vehicles) {
      const stored = existing.get(vehicle.vin);
      if (!stored) {
        existing.set(vehicle.vin, vehicle);
        imported += 1;
      } else if (vehicle.savedAt > stored.savedAt) {
        existing.set(vehicle.vin, vehicle);
        imported += 1;
      }
    }
    return [...existing.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  });
  return imported;
}

/**
 * Replace the garage wholesale so a restore reproduces the backup exactly.
 * Unlike mergeGarageVehicles, this does not keep newer local edits or re-add
 * vehicles the backup never contained.
 */
export function replaceGarageVehicles(vehicles: GarageVehicle[]): boolean {
  return write(vehicles);
}

export function garageChangedEvent(): string {
  return CHANGE_EVENT;
}

/**
 * Browsers fire `storage` only in the tabs that did not write. Bridge it to the
 * in-page event so every garage consumer refreshes regardless of which tab
 * made the change.
 */
function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// HMR can re-run this module; register the bridge once per document.
if (typeof window !== 'undefined') {
  const tracked = window as Window & { __autopartsGarageStorageSync?: boolean };
  if (!tracked.__autopartsGarageStorageSync) {
    tracked.__autopartsGarageStorageSync = true;
    window.addEventListener('storage', onStorage);
  }
}
