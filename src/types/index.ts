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
  /** Where `model` came from: NHTSA or the local VIN-pattern table. */
  model_source?: 'nhtsa' | 'vin-pattern' | null;
  /** Model-code characters at VIN positions 7-8 when the fallback was used. */
  model_code?: string | null;
  /** Caveat shown when the model is inferred from the VIN pattern. */
  model_note?: string | null;
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
  engines: string[];
}

export interface Brand {
  name: string;
  slug: string;
  origin: 'European' | 'Japanese' | 'American' | 'Korean' | string;
  popular: boolean;
  models: VehicleModel[];
}

export interface BrandCatalogMeta {
  source: string;
  coverage: string;
  updatedAt: string;
  caveat: string;
}

export interface BrandsResponse {
  brands: Brand[];
  meta?: BrandCatalogMeta;
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
  name?: string | null;
  notes?: string | null;
  /** Fleet sheet AU/stock number, when imported. */
  stockNumber?: string | null;
  /** Fleet sheet license plate, when imported. */
  plate?: string | null;
  savedAt: string;
}

// ─── Commercial Fitment & Availability ───────────────────────────────────────

export type CommercialConfidence = 'verified' | 'reference' | 'unconfirmed';

export interface CommercialFitmentRecord {
  id: string;
  partNumber: string;
  brand: string;
  years: number[];
  make: string;
  model: string;
  engines: string[];
  trims: string[];
  source: string;
  updatedAt: string;
  confidence: CommercialConfidence;
  aces?: Record<string, unknown>;
  pies?: Record<string, unknown>;
}

export interface AvailabilityOffer {
  id: string;
  partNumber: string;
  retailer: string;
  price: number | null;
  currency: string;
  inStock: boolean | null;
  url: string;
  fitmentConfidence: 'confirmed' | 'conditional';
  disclosure: string;
  updatedAt: string;
}

export interface CommercialDataBundle {
  version: string;
  source: string | null;
  updatedAt: string | null;
  disclosure: string;
  fitmentRecords: CommercialFitmentRecord[];
  offers: AvailabilityOffer[];
}

// ─── Recall Watch ────────────────────────────────────────────────────────────

export interface RecallCampaignSeen {
  campaignNumber: string;
  firstSeenAt: string;
}

export interface CompletedRepair {
  campaignNumber: string;
  completedAt: string;
  note?: string;
}

export interface RecallWatch {
  vin: string;
  year: string;
  make: string;
  model: string;
  /** Preserved so an inferred European model is not queried as US-market. */
  model_source?: VINDecodeResult['model_source'];
  trim: string | null;
  engine: string | null;
  addedAt: string;
  notificationsOptIn: boolean;
  lastCheckedAt: string | null;
  campaignHistory: RecallCampaignSeen[];
  newCampaigns: string[];
  newCampaignsDetectedAt: string | null;
  completedRepairs: CompletedRepair[];
}

// ─── Safety Intelligence ─────────────────────────────────────────────────────

export interface SafetyComplaint {
  odiNumber: string;
  dateFiled: string;
  components: string[];
  summary: string;
  crash: boolean;
  fire: boolean;
  injuries: number;
  deaths: number;
}

export interface SafetyInvestigation {
  id: string;
  investigationType: string;
  status: 'open' | 'closed' | string;
  subject: string;
  summary?: string;
  openedDate: string | null;
  closedDate: string | null;
  components: string[];
  recallCampaign: string | null;
  manufacturer?: string;
  url: string;
}

export interface ManufacturerCommunication {
  id: string;
  communicationType: string;
  date: string;
  summary: string;
}

// ─── Dealer / Fitment Handoff ────────────────────────────────────────────────

export interface FitmentVerificationRequest {
  id: string;
  createdAt: string;
  vin: string;
  partNumber: string;
  partName: string;
  vehicle: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  notes?: string;
  status: 'local-queue';
}

export interface FitmentCorrectionReport {
  id: string;
  createdAt: string;
  vin: string;
  partNumber: string;
  partName: string;
  vehicle: string;
  reason: string;
  details: string;
  status: 'local-audit';
}

// ─── Demand Capture ──────────────────────────────────────────────────────────

export interface DemandRequest {
  id: string;
  createdAt: string;
  email: string;
  vin: string;
  year: string;
  make: string;
  model: string;
  partNeeded: string;
  context: string;
  status: 'local-demand-list';
}

// ─── Fleet ───────────────────────────────────────────────────────────────────

export type FleetRowStatus = 'pending' | 'checking' | 'complete' | 'error';

export interface FleetRow {
  vin: string;
  status: FleetRowStatus;
  year?: string | null;
  make?: string | null;
  model?: string | null;
  /** Set when the model came from the VIN pattern and US recalls were skipped. */
  recallNote?: string | null;
  /** Why the model-year lookup ran, was skipped, or could not run. */
  recallScope?: 'model-year' | 'inferred-model' | 'incomplete-identity';
  recalls?: VehicleRecallLike[];
  error?: string;
  checkedAt?: string;
}

/** Loose shape shared by the recall client and the fleet checker. */
export interface VehicleRecallLike {
  campaignNumber: string;
  component: string;
  summary: string;
  remedy: string;
  reportDate: string;
}

// ─── API Response Wrappers ───────────────────────────────────────────────────

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiState<T> {
  data: T | null;
  status: ApiStatus;
  error: string | null;
}
