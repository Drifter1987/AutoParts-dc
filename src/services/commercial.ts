import commercialData from '../data/commercial-catalog.json';
import type {
  AvailabilityOffer,
  CommercialDataBundle,
  CommercialFitmentRecord,
} from '../types';
import { normalizePartNumber } from './parts';

const bundle = commercialData as CommercialDataBundle;

export interface CommercialVehicle {
  vin?: string | null;
  year?: string | number | null;
  make?: string | null;
  model?: string | null;
  engine?: string | null;
  trim?: string | null;
}

export interface CommercialCoverage {
  connected: boolean;
  source: string | null;
  updatedAt: string | null;
  fitmentRecords: number;
  offers: number;
  disclosure: string;
}

export function getCommercialCoverage(): CommercialCoverage {
  return {
    connected: Boolean(bundle.source),
    source: bundle.source,
    updatedAt: bundle.updatedAt,
    fitmentRecords: bundle.fitmentRecords.length,
    offers: bundle.offers.length,
    disclosure: bundle.disclosure,
  };
}

function vehicleMatches(record: CommercialFitmentRecord, result: CommercialVehicle): boolean {
  if (!result.make || !result.model || !result.year) return false;
  if (record.years.length && !record.years.includes(Number(result.year))) return false;
  const make = result.make.toLowerCase();
  const model = result.model.toLowerCase();
  if (record.make.toLowerCase() !== make) return false;
  if (record.model.toLowerCase() !== model) return false;
  if (record.engines.length && result.engine && !record.engines.includes(result.engine)) {
    return false;
  }
  if (record.trims.length && result.trim && !record.trims.includes(result.trim)) return false;
  return true;
}

export function getCommercialFitment(
  partNumber: string,
  vehicle: CommercialVehicle | null,
): CommercialFitmentRecord | null {
  if (!vehicle) return null;
  const normalized = normalizePartNumber(partNumber);
  return (
    bundle.fitmentRecords.find(
      record =>
        normalizePartNumber(record.partNumber) === normalized && vehicleMatches(record, vehicle),
    ) ?? null
  );
}

/**
 * Purchase links are deliberately gated. A record needs a confirmed fitment
 * check and an offer whose exact part number matches the catalog part.
 */
export function getOffersForPart(
  partNumber: string,
  fitmentConfirmed: boolean,
): AvailabilityOffer[] {
  if (!fitmentConfirmed) return [];
  const normalized = normalizePartNumber(partNumber);
  return bundle.offers.filter(
    offer =>
      normalizePartNumber(offer.partNumber) === normalized &&
      offer.fitmentConfidence === 'confirmed',
  );
}

export function getCommercialDisclosure(): string {
  return bundle.disclosure;
}
