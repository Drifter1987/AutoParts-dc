/**
 * Shared handling for VIN decodes that lack a model year, make, or model.
 *
 * NHTSA vPIC returns partial identities for some non-US-market VINs. Any view
 * that shows the vehicle or talks about model-year recall data has to say that
 * a lookup was not run; otherwise an empty result reads as "zero campaigns".
 * These helpers keep that wording and decision identical across saved vehicles,
 * the fleet checker, the safety report, and Recall Watch.
 */

export const MODEL_DATA_UNAVAILABLE = 'Model data not available for this market';

export type RecallLookupScope = 'model-year' | 'inferred-model' | 'incomplete-identity';

export interface VehicleIdentityFields {
  year?: string | null;
  make?: string | null;
  model?: string | null;
  model_source?: 'nhtsa' | 'vin-pattern' | null;
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

/** "2027 AUDI Q3", or an empty string when no identity fields are present. */
export function getVehicleIdentity(vehicle: VehicleIdentityFields): string {
  return [vehicle.year, vehicle.make, vehicle.model].map(clean).filter(Boolean).join(' ');
}

export function hasCompleteVehicleIdentity(vehicle: VehicleIdentityFields): boolean {
  return Boolean(clean(vehicle.year) && clean(vehicle.make) && clean(vehicle.model));
}

/**
 * Classify what NHTSA can do with this identity. A model inferred from a
 * European VIN pattern is complete enough to display but is not a US-market
 * model name, so it must never drive a model-year query.
 */
export function getRecallLookupScope(vehicle: VehicleIdentityFields): RecallLookupScope {
  if (vehicle.model_source === 'vin-pattern') return 'inferred-model';
  return hasCompleteVehicleIdentity(vehicle) ? 'model-year' : 'incomplete-identity';
}

/** View-ready reason when no model-year lookup should run; null when one can. */
export function getRecallSkipNote(vehicle: VehicleIdentityFields): string | null {
  switch (getRecallLookupScope(vehicle)) {
    case 'inferred-model':
      return 'US-market recall lookup skipped — model inferred from the VIN.';
    case 'incomplete-identity':
      return 'Model-year recall lookup skipped — model data not available for this market.';
    default:
      return null;
  }
}
