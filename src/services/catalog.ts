import type { Brand, VehicleModel } from '../types';

const normalizeMake = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Find the local catalog brand matching an NHTSA make name, if the catalog covers it. */
export function findCatalogBrand(brands: Brand[] | null, make: string | null): Brand | null {
  if (!brands || !make) return null;
  const key = normalizeMake(make);
  return brands.find(brand => normalizeMake(brand.name) === key) ?? null;
}

/** Find a preview model inside a catalog brand, ignoring trim suffixes. */
export function findCatalogModel(brand: Brand | null, model: string | null): VehicleModel | null {
  if (!brand || !model) return null;
  const key = normalizeMake(model.split(' ')[0] ?? '');
  return brand.models.find(candidate => normalizeMake(candidate.name) === key) ?? null;
}
