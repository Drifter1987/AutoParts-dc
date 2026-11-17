// ─── VIN Decoder Types ────────────────────────────────────────────────────────

export interface VehicleSpec {
  variable: string;
  value: string | null;
  variable_id?: number;
}

export interface VINDecodeResult {
  vin: string;
  make: string | null;
  model: string | null;
  year: string | null;
  trim: string | null;
  engine: string | null;
  fuel_type: string | null;
  transmission: string | null;
  drive_type: string | null;
  body_class: string | null;
  doors: string | null;
  plant_country: string | null;
  plant_city: string | null;
  vehicle_type: string | null;
  series: string | null;
  displacement_l: string | null;
  cylinders: string | null;
  all_specs: VehicleSpec[];
  error_code: string | null;
  error_text: string | null;
}

// ─── Catalog Types ───────────────────────────────────────────────────────────

export interface VehicleModel {
  name: string;
  slug: string;
  years: number[];
}

export interface Brand {
  name: string;
  slug: string;
  origin: 'European' | 'Japanese' | 'American' | 'Korean' | string;
  popular: boolean;
  models: VehicleModel[];
}

export interface BrandsResponse {
  brands: Brand[];
}

export interface PopularModel {
  id: string;
  brand: string;
  brand_slug: string;
  model: string;
  model_slug: string;
  year: number;
  image: string;
  description: string;
  engine_options: string[];
  assemblies_count: number;
  parts_count: number;
  sample_assemblies: string[];
  tags: string[];
}

export interface PopularModelsResponse {
  popular_models: PopularModel[];
}

// ─── Parts Catalog Types ─────────────────────────────────────────────────────

export type PartConfidence = 'verified' | 'reference' | 'unconfirmed';

export interface PartFitment {
  years: number[];
  engines: string[];
  trims: string[];
  market: string;
}

export interface CatalogPart {
  slug: string;
  name: string;
  oemNumber: string;
  alternateNumbers: string[];
  supersedes: string[];
  interchange: string[];
  aliases: string[];
  fitment: PartFitment;
  fitmentNotes: string;
  source: string;
  lastUpdated: string;
  confidence: PartConfidence;
}

export interface PartAssembly {
  slug: string;
  name: string;
  summary: string;
  diagramLabel: string;
  parts: CatalogPart[];
}

export interface VehicleCatalog {
  catalog: {
    brand: string;
    brandSlug: string;
    model: string;
    modelSlug: string;
    year: number;
    generation: string;
    market: string;
    engineOptions: string[];
    trimOptions: string[];
    source: string;
    lastUpdated: string;
    confidence: PartConfidence;
    disclaimer: string;
  };
  assemblies: PartAssembly[];
}

export interface CatalogPartWithContext extends CatalogPart {
  assemblySlug: string;
  assemblyName: string;
  assemblySummary: string;
}

export interface GarageVehicle {
  vin: string;
  year: string;
  make: string;
  model: string;
  trim: string | null;
  engine: string | null;
  savedAt: string;
}

// ─── API Response Wrappers ───────────────────────────────────────────────────

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiState<T> {
  data: T | null;
  status: ApiStatus;
  error: string | null;
}
