import civicData from '../data/civic-2020-parts.json';
import type {
  CatalogPart,
  CatalogPartWithContext,
  PartAssembly,
  PartFitment,
  VehicleCatalog,
  VINDecodeResult,
} from '../types';

export const CIVIC_2020 = civicData as VehicleCatalog;
export const CATALOG_VEHICLES: VehicleCatalog[] = [CIVIC_2020];

export const ALL_PARTS: CatalogPartWithContext[] = CATALOG_VEHICLES.flatMap(vehicle =>
  vehicle.assemblies.flatMap(assembly =>
    assembly.parts.map(part => ({
      ...part,
      assemblySlug: assembly.slug,
      assemblyName: assembly.name,
      assemblySummary: assembly.summary,
    })),
  ),
);

const normalizeText = (value: string | null | undefined) =>
  (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Normalize an OEM/reference number for matching: 15400-PLM-A02 -> 15400PLMA02. */
export function normalizePartNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function getCatalogVehicle(
  brandSlug: string | undefined,
  modelSlug: string | undefined,
  year: string | number | undefined,
): VehicleCatalog | null {
  if (!brandSlug || !modelSlug || !year) return null;
  return (
    CATALOG_VEHICLES.find(
      vehicle =>
        vehicle.catalog.brandSlug === brandSlug &&
        vehicle.catalog.modelSlug === modelSlug &&
        String(vehicle.catalog.year) === String(year),
    ) ?? null
  );
}

/** Match an NHTSA-decoded vehicle to a local catalog vehicle. */
export function findCatalogVehicleForDecode(result: VINDecodeResult | null): VehicleCatalog | null {
  if (!result?.make || !result.model || !result.year) return null;
  const make = normalizeText(result.make);
  const model = normalizeText(result.model.split(' ')[0]);
  return (
    CATALOG_VEHICLES.find(
      vehicle =>
        normalizeText(vehicle.catalog.brand) === make &&
        normalizeText(vehicle.catalog.model) === model &&
        String(vehicle.catalog.year) === result.year,
    ) ?? null
  );
}

export function findCatalogVehicleForSelection(
  brandSlug: string | undefined,
  modelName: string | undefined,
  year: string | number | undefined,
): VehicleCatalog | null {
  if (!brandSlug || !modelName) return null;
  return (
    CATALOG_VEHICLES.find(
      vehicle =>
        vehicle.catalog.brandSlug === brandSlug &&
        normalizeText(vehicle.catalog.model) === normalizeText(modelName) &&
        (!year || String(vehicle.catalog.year) === String(year)),
    ) ?? null
  );
}

export function getAssembly(
  brandSlug: string | undefined,
  modelSlug: string | undefined,
  year: string | number | undefined,
  assemblySlug: string | undefined,
): PartAssembly | null {
  const vehicle = getCatalogVehicle(brandSlug, modelSlug, year);
  return vehicle?.assemblies.find(assembly => assembly.slug === assemblySlug) ?? null;
}

export function getPart(
  brandSlug: string | undefined,
  modelSlug: string | undefined,
  year: string | number | undefined,
  assemblySlug: string | undefined,
  partSlug: string | undefined,
): CatalogPartWithContext | null {
  const assembly = getAssembly(brandSlug, modelSlug, year, assemblySlug);
  const part = assembly?.parts.find(item => item.slug === partSlug);
  return part
    ? {
        ...part,
        assemblySlug: assembly.slug,
        assemblyName: assembly.name,
        assemblySummary: assembly.summary,
      }
    : null;
}

export function getVehiclePath(vehicle: VehicleCatalog, vin?: string | null): string {
  const path = `/catalog/${vehicle.catalog.brandSlug}/${vehicle.catalog.modelSlug}/${vehicle.catalog.year}`;
  return vin ? `${path}?vin=${encodeURIComponent(vin)}` : path;
}

export function getAssemblyPath(
  vehicle: VehicleCatalog,
  assemblySlug: string,
  vin?: string | null,
): string {
  return `${getVehiclePath(vehicle)}/${assemblySlug}${vin ? `?vin=${encodeURIComponent(vin)}` : ''}`;
}

export function getPartPath(
  vehicle: VehicleCatalog,
  assemblySlug: string,
  partSlug: string,
  vin?: string | null,
): string {
  return `${getVehiclePath(vehicle)}/${assemblySlug}/${partSlug}${vin ? `?vin=${encodeURIComponent(vin)}` : ''}`;
}

export function getPartCount(vehicle: VehicleCatalog): number {
  return vehicle.assemblies.reduce((total, assembly) => total + assembly.parts.length, 0);
}

export function getPartSearchText(part: CatalogPart, assemblyName = ''): string {
  return normalizeText(
    [
      part.name,
      part.oemNumber,
      ...part.alternateNumbers,
      ...part.supersedes,
      ...part.interchange,
      ...part.aliases,
      assemblyName,
    ].join(' '),
  );
}

/** Search by part name, alias, OEM number, supersession, or interchange number. */
export function searchParts(query: string, limit = 40): CatalogPartWithContext[] {
  const raw = query.trim();
  if (!raw) return [];

  const tokens = raw
    .toLowerCase()
    .split(/\s+/)
    .map(token => normalizeText(token))
    .filter(Boolean);

  return ALL_PARTS.filter(part => {
    const haystack = getPartSearchText(part, part.assemblyName);
    if (normalizedPartNumberMatches(part, raw)) return true;
    return tokens.every(token => haystack.includes(token));
  }).slice(0, limit);
}

function normalizedPartNumberMatches(part: CatalogPart, query: string): boolean {
  const normalizedQuery = normalizePartNumber(query);
  if (normalizedQuery.length < 3) return false;
  return [part.oemNumber, ...part.alternateNumbers, ...part.supersedes, ...part.interchange]
    .map(normalizePartNumber)
    .some(number => number.includes(normalizedQuery));
}

export interface FitmentCheck {
  label: string;
  tone: 'success' | 'warning' | 'error';
  detail: string;
}

export function checkFitment(
  part: CatalogPart,
  engine: string,
  trim: string,
  hasVin = false,
  vehicleLabel = '',
): FitmentCheck {
  if (!engine && !trim) {
    return {
      label: 'Verify fitment',
      tone: 'warning',
      detail: 'Select an engine and trim to check this part against the catalog fitment rules.',
    };
  }

  const engineMatches = !engine || part.fitment.engines.includes(engine);
  const trimMatches = !trim || part.fitment.trims.includes(trim);

  if (engineMatches && trimMatches) {
    return {
      label: hasVin ? (vehicleLabel ? `Fits your ${vehicleLabel}` : 'Fits your VIN') : 'Fits selected vehicle',
      tone: 'success',
      detail: `Matches the catalog fitment for ${engine || 'all engines'}${trim ? ` and ${trim}` : ''}. ${part.fitmentNotes}`,
    };
  }

  return {
    label: 'Fitment needs confirmation',
    tone: 'error',
    detail: `This part is cataloged for ${part.fitment.engines.join(', ')}${part.fitment.trims.length ? ` (${part.fitment.trims.join(', ')})` : ''}. ${part.fitmentNotes}`,
  };
}

export interface FitmentConflict {
  reasons: string[];
  alternatives: CatalogPartWithContext[];
  complete: boolean;
}

/** Explain a fitment mismatch and surface parts in the same assembly that do fit. */
export function resolveFitmentConflict(
  part: CatalogPartWithContext,
  vehicle: VehicleCatalog,
  engine: string,
  trim: string,
): FitmentConflict {
  const reasons: string[] = [];
  const complete = Boolean(engine || trim);

  if (!part.fitment.years.includes(vehicle.catalog.year)) {
    reasons.push(
      `Year mismatch: this record covers ${part.fitment.years.join(', ')}, not ${vehicle.catalog.year}.`,
    );
  }
  if (!complete) {
    reasons.push('Vehicle configuration is incomplete: select an engine and trim for a stronger check.');
  } else {
    if (engine && !part.fitment.engines.includes(engine)) {
      reasons.push(
        `Engine mismatch: ${engine} is not in this part's fitment list (${part.fitment.engines.join(', ') || 'none listed'}).`,
      );
    }
    if (trim && !part.fitment.trims.includes(trim)) {
      reasons.push(
        `Trim mismatch: ${trim} is not in this part's fitment list (${part.fitment.trims.join(', ') || 'none listed'}).`,
      );
    }
  }

  const assembly = vehicle.assemblies.find(item => item.slug === part.assemblySlug);
  const alternatives = (assembly?.parts ?? [])
    .filter(candidate => candidate.slug !== part.slug)
    .filter(candidate => {
      if (!complete) return true;
      return checkFitment(candidate, engine, trim).tone === 'success';
    })
    .slice(0, 3)
    .map(candidate => ({
      ...candidate,
      assemblySlug: part.assemblySlug,
      assemblyName: part.assemblyName,
      assemblySummary: part.assemblySummary,
    }));

  return { reasons, alternatives, complete };
}

export function inferEngineFromVin(result: VINDecodeResult): string {
  const haystack = `${result.engine ?? ''} ${result.displacement_l ?? ''} ${result.trim ?? ''}`.toLowerCase();
  if (haystack.includes('1.5')) return '1.5L Turbo';
  if (haystack.includes('2.0') || haystack.includes('type r')) return '2.0L';
  return '';
}

export function getVehicleLabel(vehicle: VehicleCatalog): string {
  return `${vehicle.catalog.year} ${vehicle.catalog.brand} ${vehicle.catalog.model}`;
}

export function getAllCatalogPaths(): string[] {
  return CATALOG_VEHICLES.flatMap(vehicle => {
    const base = getVehiclePath(vehicle);
    return [
      base,
      ...vehicle.assemblies.map(assembly => `${base}/${assembly.slug}`),
      ...vehicle.assemblies.flatMap(assembly =>
        assembly.parts.map(part => `${base}/${assembly.slug}/${part.slug}`),
      ),
    ];
  });
}

export function fitmentSummary(fitment: PartFitment): string {
  return `${fitment.years.join(', ')} ${fitment.market} · ${fitment.engines.join(' / ')} · ${fitment.trims.join(', ')}`;
}
