import type {
  CatalogPart,
  CatalogPartWithContext,
  VehicleCatalog,
} from '../types';

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Normalize an OEM/reference number for matching: 15400-PLM-A02 -> 15400PLMA02. */
export function normalizePartNumber(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Stable identity for a catalog vehicle: brand/model/year. */
export function getVehicleKey(vehicle: VehicleCatalog): string {
  return `${vehicle.catalog.brandSlug}/${vehicle.catalog.modelSlug}/${vehicle.catalog.year}`;
}

/** Fail fast when two catalog files describe the same brand/model/year. */
export function assertUniqueCatalogIdentities(catalogs: VehicleCatalog[]): void {
  const seen = new Map<string, string>();
  for (const vehicle of catalogs) {
    const key = getVehicleKey(vehicle);
    if (seen.has(key)) {
      throw new Error(`Duplicate catalog vehicle ${key}: ${seen.get(key)} and ${vehicle.catalog.source}.`);
    }
    seen.set(key, `${vehicle.catalog.year} ${vehicle.catalog.brand} ${vehicle.catalog.model}`);
  }
}

/** Flatten every catalog into searchable part records carrying vehicle context. */
export function buildAllParts(catalogs: VehicleCatalog[]): CatalogPartWithContext[] {
  return catalogs.flatMap(vehicle => {
    const vehicleLabel = `${vehicle.catalog.year} ${vehicle.catalog.brand} ${vehicle.catalog.model}`;
    return vehicle.assemblies.flatMap(assembly =>
      assembly.parts.map(part => ({
        ...part,
        assemblySlug: assembly.slug,
        assemblyName: assembly.name,
        assemblySummary: assembly.summary,
        brandSlug: vehicle.catalog.brandSlug,
        modelSlug: vehicle.catalog.modelSlug,
        year: vehicle.catalog.year,
        vehicleLabel,
      })),
    );
  });
}

function searchWords(part: CatalogPart, assemblyName = ''): string[] {
  return [part.name, ...part.aliases, assemblyName]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Bounded Levenshtein check so a typo can still match a catalog word. */
function withinEditDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return false;
    previous = current;
  }

  return previous[b.length] <= max;
}

function fuzzyTokenMatches(words: string[], token: string): boolean {
  if (token.length < 4 || /\d/.test(token)) return false;
  const max = token.length >= 7 ? 2 : 1;
  return words.some(
    word => Math.abs(word.length - token.length) <= max && withinEditDistance(word, token, max),
  );
}

function scorePart(part: CatalogPartWithContext, query: string): number {
  const normalizedQuery = normalizePartNumber(query);
  if (normalizedQuery.length >= 3) {
    const numbers = [
      part.oemNumber,
      ...part.alternateNumbers,
      ...part.supersedes,
      ...part.interchange,
    ].map(normalizePartNumber);
    if (numbers.includes(normalizedQuery)) return 1000;
    if (numbers.some(number => number.startsWith(normalizedQuery))) return 900;
    if (numbers.some(number => number.includes(normalizedQuery))) return 800;
  }

  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map(token => normalizeText(token))
    .filter(Boolean);
  if (!tokens.length) return 0;

  const haystack = getPartSearchText(part, part.assemblyName);
  const words = searchWords(part, part.assemblyName);
  const matches = tokens.every(
    token => haystack.includes(token) || fuzzyTokenMatches(words, token),
  );
  if (!matches) return 0;

  const normalizedRaw = normalizeText(query);
  if (normalizeText(part.name) === normalizedRaw) return 700;
  if (part.aliases.some(alias => normalizeText(alias) === normalizedRaw)) return 650;
  return 400;
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
export function searchPartsIn(
  parts: CatalogPartWithContext[],
  query: string,
  limit = 40,
): CatalogPartWithContext[] {
  const raw = query.trim();
  if (!raw) return [];

  return parts
    .map(part => ({ part, score: scorePart(part, raw) }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.part.name.localeCompare(right.part.name))
    .slice(0, limit)
    .map(item => item.part);
}
