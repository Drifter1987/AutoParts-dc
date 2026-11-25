import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const catalogSources = [
  { dir: 'src/data/parts', kind: 'published' },
  { dir: 'tests/fixtures/parts', kind: 'fixture' },
];
const strictLicensing = process.argv.includes('--require-licensed');

const CONFIDENCE = new Set(['verified', 'reference', 'unconfirmed']);
const RECORD_TYPES = new Set(['development', 'production']);
const RIGHTS_STATUS = new Set(['licensed', 'unlicensed', 'synthetic']);
const REDISPLAY = new Set(['public-web', 'internal-only', 'none-declared']);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];
const warnings = [];
const summaries = [];
const vehicleKeys = new Map();

const requiredString = (value, path) => {
  const ok = typeof value === 'string' && value.trim().length > 0;
  if (!ok) errors.push(`${path} must be a non-empty string`);
  return ok;
};

const requiredArray = (value, path) => {
  const ok = Array.isArray(value);
  if (!ok) errors.push(`${path} must be an array`);
  return ok;
};

const stringArray = (value, path, { allowEmpty = true } = {}) => {
  if (!requiredArray(value, path)) return false;
  if (!allowEmpty && value.length === 0) errors.push(`${path} must not be empty`);
  value.forEach((entry, index) => {
    if (typeof entry !== 'string' || !entry.trim()) {
      errors.push(`${path}[${index}] must be a non-empty string`);
    }
  });
  return true;
};

const isoDate = (value, path) => {
  if (!requiredString(value, path)) return;
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push(`${path} must be an ISO date (YYYY-MM-DD)`);
  }
};

function validateRights(rights, vehicle, path) {
  if (!rights || typeof rights !== 'object' || Array.isArray(rights)) {
    errors.push(`${path}.rights must be an object`);
    return;
  }

  requiredString(rights.holder, `${path}.rights.holder`);
  requiredString(rights.license, `${path}.rights.license`);
  requiredString(rights.attribution, `${path}.rights.attribution`);
  stringArray(rights.restrictions, `${path}.rights.restrictions`);
  if (!RIGHTS_STATUS.has(rights.status)) {
    errors.push(`${path}.rights.status must be licensed, unlicensed, or synthetic`);
  }
  if (!REDISPLAY.has(rights.permittedRedisplay)) {
    errors.push(`${path}.rights.permittedRedisplay must be public-web, internal-only, or none-declared`);
  }

  if (rights.status === 'licensed' && /^no[ -]?license\b/i.test(rights.license)) {
    errors.push(`${path}.rights.license contradicts rights.status "licensed"`);
  }
  if (rights.status === 'unlicensed') {
    if (vehicle.recordType !== 'development') {
      errors.push(`${path}: unlicensed catalogs must be recordType "development"`);
    }
    if (rights.permittedRedisplay === 'public-web') {
      errors.push(`${path}: unlicensed catalogs cannot permit public-web redisplay`);
    }
  }
  if (rights.status === 'synthetic') {
    if (vehicle.recordType !== 'development') {
      errors.push(`${path}: synthetic catalogs must be recordType "development"`);
    }
    if (!/synthetic/i.test(vehicle.source)) {
      errors.push(`${path}: synthetic catalogs must label their source as synthetic`);
    }
    if (rights.permittedRedisplay !== 'internal-only') {
      errors.push(`${path}: synthetic catalogs must be internal-only`);
    }
  }
  if (strictLicensing && rights.status !== 'licensed') {
    errors.push(
      `${path}: --require-licensed requires rights.status "licensed", found "${rights.status}"`,
    );
  }
}

function validateCatalog(catalog, path, kind) {
  const vehicle = catalog?.catalog;
  if (!vehicle || typeof vehicle !== 'object') {
    errors.push(`${path}: catalog must be an object`);
    return;
  }

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
    'recordType',
  ]) {
    requiredString(vehicle[key], `${path}.catalog.${key}`);
  }
  isoDate(vehicle.lastUpdated, `${path}.catalog.lastUpdated`);

  for (const key of ['brandSlug', 'modelSlug']) {
    if (typeof vehicle[key] === 'string' && vehicle[key] && !SLUG.test(vehicle[key])) {
      errors.push(`${path}.catalog.${key} must be a lowercase slug`);
    }
  }
  if (!Number.isInteger(vehicle.year) || vehicle.year < 1900 || vehicle.year > 2100) {
    errors.push(`${path}.catalog.year must be an integer between 1900 and 2100`);
  }
  if (!RECORD_TYPES.has(vehicle.recordType)) {
    errors.push(`${path}.catalog.recordType must be development or production`);
  }
  if (kind === 'fixture' && vehicle.recordType !== 'development') {
    errors.push(`${path}: test fixtures must be recordType "development"`);
  }
  if (!CONFIDENCE.has(vehicle.confidence)) {
    errors.push(`${path}.catalog.confidence must be verified, reference, or unconfirmed`);
  }

  for (const key of ['engineOptions', 'trimOptions']) {
    if (stringArray(vehicle[key], `${path}.catalog.${key}`, { allowEmpty: false })) {
      const duplicates = vehicle[key].filter((item, index) => vehicle[key].indexOf(item) !== index);
      if (duplicates.length) {
        errors.push(`${path}.catalog.${key} has duplicate entries: ${[...new Set(duplicates)].join(', ')}`);
      }
    }
  }

  validateRights(vehicle.rights, vehicle, `${path}.catalog`);

  if (vehicle.recordType === 'production') {
    if (vehicle.rights?.status !== 'licensed') {
      errors.push(`${path}: production catalogs require licensed rights`);
    }
    if (vehicle.confidence !== 'verified') {
      errors.push(`${path}: production catalogs require confidence "verified"`);
    }
  }
  if (vehicle.confidence === 'verified' && vehicle.rights?.status !== 'licensed') {
    errors.push(`${path}.catalog.confidence "verified" requires licensed rights`);
  }

  const key = `${vehicle.brandSlug}/${vehicle.modelSlug}/${vehicle.year}`;
  if (vehicleKeys.has(key)) {
    errors.push(`${path}: duplicate catalog vehicle ${key} (also in ${vehicleKeys.get(key)})`);
  } else {
    vehicleKeys.set(key, path);
  }

  const summary = {
    path,
    kind,
    vehicle: `${vehicle.year} ${vehicle.brand} ${vehicle.model}`,
    recordType: vehicle.recordType,
    rights: vehicle.rights?.status ?? 'missing',
    assemblies: 0,
    parts: 0,
  };

  if (!Array.isArray(catalog.assemblies) || catalog.assemblies.length === 0) {
    errors.push(`${path}: assemblies must be a non-empty array`);
    summaries.push(summary);
    return;
  }
  if (catalog.assemblies.length > 12) {
    errors.push(`${path}: expected at most 12 assemblies, found ${catalog.assemblies.length}`);
  }
  summary.assemblies = catalog.assemblies.length;

  const assemblySlugs = new Set();
  const partSlugs = new Set();
  const oemNumbers = new Map();

  for (const [assemblyIndex, assembly] of catalog.assemblies.entries()) {
    const assemblyPath = `${path}.assemblies[${assemblyIndex}]`;
    for (const field of ['slug', 'name', 'summary', 'diagramLabel']) {
      requiredString(assembly?.[field], `${assemblyPath}.${field}`);
    }
    if (assembly?.slug && !SLUG.test(assembly.slug)) {
      errors.push(`${assemblyPath}.slug must be a lowercase slug`);
    }
    if (assemblySlugs.has(assembly?.slug)) {
      errors.push(`${path}: duplicate assembly slug "${assembly.slug}"`);
    }
    assemblySlugs.add(assembly?.slug);

    if (!Array.isArray(assembly?.parts) || assembly.parts.length === 0) {
      errors.push(`${assemblyPath}.parts must contain at least one part`);
      continue;
    }

    for (const [partIndex, part] of assembly.parts.entries()) {
      const partPath = `${assemblyPath}.parts[${partIndex}]`;
      for (const field of [
        'slug',
        'name',
        'oemNumber',
        'fitmentNotes',
        'source',
        'lastUpdated',
        'confidence',
      ]) {
        requiredString(part?.[field], `${partPath}.${field}`);
      }
      isoDate(part.lastUpdated, `${partPath}.lastUpdated`);

      if (part.slug && !SLUG.test(part.slug)) {
        errors.push(`${partPath}.slug must be a lowercase slug`);
      }
      if (partSlugs.has(part.slug)) {
        errors.push(`${path}: duplicate part slug "${part.slug}"`);
      }
      partSlugs.add(part.slug);

      for (const field of ['alternateNumbers', 'supersedes', 'interchange', 'aliases']) {
        stringArray(part[field], `${partPath}.${field}`);
      }

      if (!CONFIDENCE.has(part.confidence)) {
        errors.push(`${partPath}.confidence must be verified, reference, or unconfirmed`);
      }
      if (part.confidence === 'verified' && vehicle.rights?.status !== 'licensed') {
        errors.push(`${partPath}.confidence "verified" requires licensed rights`);
      }

      const normalized = (part.oemNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (normalized.length < 4 || normalized.length > 24) {
        errors.push(`${partPath}.oemNumber "${part.oemNumber}" is not a usable part number`);
      } else if (oemNumbers.has(normalized)) {
        if (typeof part.sharedNumberReason === 'string' && part.sharedNumberReason.trim()) {
          warnings.push(
            `${partPath}: shares OEM number ${part.oemNumber} with ${oemNumbers.get(normalized)} (declared intentional)`,
          );
        } else {
          errors.push(
            `${partPath}: duplicate normalized OEM number ${part.oemNumber} (also ${oemNumbers.get(normalized)}); add sharedNumberReason only if intentional`,
          );
        }
      } else {
        oemNumbers.set(normalized, partPath);
      }

      const fitment = part.fitment;
      if (!fitment || typeof fitment !== 'object') {
        errors.push(`${partPath}.fitment must be an object`);
      } else {
        if (!Array.isArray(fitment.years) || fitment.years.length === 0) {
          errors.push(`${partPath}.fitment.years must be a non-empty array`);
        } else {
          fitment.years.forEach((year, index) => {
            if (!Number.isInteger(year) || year < 1900 || year > 2100) {
              errors.push(`${partPath}.fitment.years[${index}] must be a model year`);
            }
          });
          if (!fitment.years.includes(vehicle.year)) {
            warnings.push(`${partPath} does not include catalog year ${vehicle.year}`);
          }
        }
        stringArray(fitment.engines, `${partPath}.fitment.engines`, { allowEmpty: false });
        stringArray(fitment.trims, `${partPath}.fitment.trims`, { allowEmpty: false });

        for (const engine of fitment.engines ?? []) {
          if (!vehicle.engineOptions?.includes(engine)) {
            errors.push(`${partPath} has unknown engine "${engine}"`);
          }
        }
        for (const trim of fitment.trims ?? []) {
          if (!vehicle.trimOptions?.includes(trim)) {
            errors.push(`${partPath} has unknown trim "${trim}"`);
          }
        }
        if (fitment.market !== vehicle.market) {
          errors.push(`${partPath}.fitment.market must match catalog.market`);
        }
      }

      summary.parts += 1;
    }
  }

  summaries.push(summary);
}

for (const source of catalogSources) {
  let files;
  try {
    files = (await readdir(join(root, source.dir))).filter(file => file.endsWith('.json')).sort();
  } catch (error) {
    errors.push(`${source.dir}: cannot read catalog directory (${error.code || error.message})`);
    continue;
  }

  if (files.length === 0) {
    errors.push(`${source.dir}: no catalog JSON files found`);
    continue;
  }

  for (const file of files) {
    const relativePath = `${source.dir}/${file}`;
    let catalog;
    try {
      catalog = JSON.parse(await readFile(join(root, source.dir, file), 'utf8'));
    } catch (error) {
      errors.push(`${relativePath}: invalid JSON (${error.message})`);
      continue;
    }
    validateCatalog(catalog, relativePath, source.kind);
  }
}

const totals = {
  catalogs: summaries.length,
  assemblies: summaries.reduce((total, item) => total + item.assemblies, 0),
  parts: summaries.reduce((total, item) => total + item.parts, 0),
  licensedCatalogs: summaries.filter(item => item.rights === 'licensed').length,
};

console.log(
  JSON.stringify({ strictLicensing, totals, catalogs: summaries, warnings, errors }, null, 2),
);

if (errors.length) {
  console.error(`\nParts catalog validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log('\nParts catalog validation passed.');
