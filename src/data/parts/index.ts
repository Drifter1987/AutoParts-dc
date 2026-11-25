import type { VehicleCatalog } from '../../types';
import { assertUniqueCatalogIdentities } from '../../services/partsIndex';

// Every catalog file dropped into src/data/parts is picked up automatically.
// A new vehicle needs its JSON plus validator run, not page component edits.
const catalogModules = import.meta.glob<{ default: unknown }>('./*.json', { eager: true });

export const CATALOG_VEHICLES = Object.entries(catalogModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([, module]) => module.default as VehicleCatalog);

assertUniqueCatalogIdentities(CATALOG_VEHICLES);
