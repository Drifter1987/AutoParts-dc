import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(
  await readFile(new URL('../src/data/civic-2020-parts.json', import.meta.url), 'utf8'),
);

const errors = [];
const warnings = [];
const normalizedOem = new Map();
const slugs = new Set();
const allParts = [];

const requiredString = (value, path) => {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${path} must be a non-empty string`);
};
const requiredArray = (value, path) => {
  if (!Array.isArray(value)) errors.push(`${path} must be an array`);
};

const { catalog: vehicle } = catalog;
for (const key of [
  'brand',
  'brandSlug',
  'model',
  'modelSlug',
  'generation',
  'market',
  'source',
  'lastUpdated',
  'confidence',
  'disclaimer',
]) {
  requiredString(vehicle?.[key], `catalog.${key}`);
}
if (!Number.isInteger(vehicle?.year)) errors.push('catalog.year must be an integer');
for (const key of ['engineOptions', 'trimOptions']) requiredArray(vehicle?.[key], `catalog.${key}`);

if (!Array.isArray(catalog.assemblies)) {
  errors.push('assemblies must be an array');
} else {
  if (catalog.assemblies.length < 3 || catalog.assemblies.length > 5) {
    errors.push(`expected 3-5 assemblies, found ${catalog.assemblies.length}`);
  }
  for (const [assemblyIndex, assembly] of catalog.assemblies.entries()) {
    const assemblyPath = `assemblies[${assemblyIndex}]`;
    for (const key of ['slug', 'name', 'summary', 'diagramLabel']) {
      requiredString(assembly?.[key], `${assemblyPath}.${key}`);
    }
    if (slugs.has(`assembly:${assembly.slug}`)) {
      errors.push(`duplicate assembly slug: ${assembly.slug}`);
    }
    slugs.add(`assembly:${assembly.slug}`);
    if (!Array.isArray(assembly.parts) || assembly.parts.length === 0) {
      errors.push(`${assemblyPath}.parts must contain at least one part`);
      continue;
    }

    for (const [partIndex, part] of assembly.parts.entries()) {
      const partPath = `${assemblyPath}.parts[${partIndex}]`;
      for (const key of ['slug', 'name', 'oemNumber', 'fitmentNotes', 'source', 'lastUpdated', 'confidence']) {
        requiredString(part?.[key], `${partPath}.${key}`);
      }
      for (const key of ['alternateNumbers', 'supersedes', 'interchange', 'aliases']) {
        requiredArray(part?.[key], `${partPath}.${key}`);
      }
      if (slugs.has(part.slug)) errors.push(`duplicate part slug: ${part.slug}`);
      slugs.add(part.slug);

      const normalized = (part.oemNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!normalized) errors.push(`${partPath}.oemNumber is not a usable part number`);
      if (normalizedOem.has(normalized)) {
        errors.push(`duplicate normalized OEM number ${part.oemNumber} (${partPath} and ${normalizedOem.get(normalized)})`);
      } else {
        normalizedOem.set(normalized, partPath);
      }

      const fitment = part.fitment;
      if (!fitment || !Array.isArray(fitment.years) || !Array.isArray(fitment.engines) || !Array.isArray(fitment.trims)) {
        errors.push(`${partPath}.fitment must include years, engines, and trims arrays`);
      } else {
        if (!fitment.years.includes(vehicle.year)) {
          warnings.push(`${partPath} does not include catalog year ${vehicle.year}`);
        }
        for (const engine of fitment.engines) {
          if (!vehicle.engineOptions.includes(engine)) {
            errors.push(`${partPath} has unknown engine "${engine}"`);
          }
        }
        for (const trim of fitment.trims) {
          if (!vehicle.trimOptions.includes(trim)) {
            errors.push(`${partPath} has unknown trim "${trim}"`);
          }
        }
        if (fitment.market !== vehicle.market) {
          errors.push(`${partPath}.fitment.market must match catalog.market`);
        }
      }

      if (!['verified', 'reference', 'unconfirmed'].includes(part.confidence)) {
        errors.push(`${partPath}.confidence must be verified, reference, or unconfirmed`);
      }
      allParts.push({ ...part, assembly: assembly.name });
    }
  }
}

if (allParts.length < 30 || allParts.length > 50) {
  errors.push(`expected 30-50 parts, found ${allParts.length}`);
}

const assembliesWithoutParts = catalog.assemblies?.filter(assembly => !assembly.parts?.length) ?? [];
if (assembliesWithoutParts.length) {
  errors.push(`assemblies without parts: ${assembliesWithoutParts.map(item => item.slug).join(', ')}`);
}

const summary = {
  vehicle: `${vehicle.year} ${vehicle.brand} ${vehicle.model}`,
  assemblies: catalog.assemblies?.length ?? 0,
  parts: allParts.length,
  normalizedOemNumbers: normalizedOem.size,
  supersessions: allParts.filter(part => part.supersedes.length > 0).length,
  interchangeEntries: allParts.reduce((total, part) => total + part.interchange.length, 0),
  byAssembly: Object.fromEntries(
    (catalog.assemblies ?? []).map(assembly => [assembly.slug, assembly.parts?.length ?? 0]),
  ),
  warnings,
  errors,
};

console.log(JSON.stringify(summary, null, 2));

if (errors.length) {
  console.error(`\nParts catalog validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log('\nParts catalog validation passed.');
