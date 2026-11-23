import type {
  SafetyComplaint,
  SafetyInvestigation,
  VINDecodeResult,
} from '../types';

const COMPLAINTS_URL = 'https://api.nhtsa.gov/complaints/complaintsByVehicle';
const TIMEOUT_MS = 12000;

interface ComplaintResponse {
  Count?: number;
  results?: {
    odiNumber?: string | number;
    manufacturer?: string;
    crash?: boolean;
    fire?: boolean;
    numberOfInjuries?: number;
    numberOfDeaths?: number;
    dateOfIncident?: string;
    dateComplaintFiled?: string;
    components?: string;
    summary?: string;
  }[];
}

interface InvestigationIndexRecord {
  id: string;
  type?: string;
  status?: string;
  subject?: string;
  opened?: string | null;
  closed?: string | null;
  campaign?: string | null;
  manufacturer?: string;
  components?: string[];
}

interface InvestigationIndex {
  meta?: {
    source?: string;
    generatedAt?: string;
    coverage?: string;
  };
  investigations: Record<string, InvestigationIndexRecord>;
  vehicles: Record<string, string[]>;
}

export interface SafetyIntelligence {
  complaints: SafetyComplaint[];
  complaintsStatus: 'live' | 'unavailable' | 'not-configured' | 'not-applicable';
  complaintsCheckedAt: string | null;
  investigations: SafetyInvestigation[];
  investigationsStatus: 'live' | 'unavailable' | 'not-configured' | 'not-applicable';
  investigationsCheckedAt: string | null;
  investigationsSource: string | null;
  investigationsUpdatedAt: string | null;
  note: string;
}

const INVESTIGATIONS_URL = `${import.meta.env.BASE_URL}data/investigations.json`;
let investigationIndexPromise: Promise<InvestigationIndex> | null = null;

function normalizeVehiclePart(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseComponents(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map(item => item.trim())
    .filter(Boolean);
}

async function loadInvestigationIndex(): Promise<InvestigationIndex> {
  if (!investigationIndexPromise) {
    investigationIndexPromise = fetch(INVESTIGATIONS_URL, {
      headers: { Accept: 'application/json' },
    })
      .then(response => {
        if (!response.ok) throw new Error(`Investigation index returned ${response.status}`);
        return response.json() as Promise<InvestigationIndex>;
      })
      .catch(error => {
        investigationIndexPromise = null;
        throw error;
      });
  }
  return investigationIndexPromise;
}

function investigationUrl(id: string): string {
  return `https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(id)}`;
}

function findInvestigationIds(index: InvestigationIndex, result: VINDecodeResult): string[] {
  const year = (result.year ?? '').trim();
  const make = normalizeVehiclePart(result.make);
  const model = normalizeVehiclePart(result.model);
  if (!year || !make || !model) return [];

  const exactKey = `${year}|${make}|${model}`;
  if (index.vehicles[exactKey]) return index.vehicles[exactKey];

  // NHTSA's flat file uses body-style variants such as CIVIC 4DR. Prefer an
  // exact association; only fall back to a model-prefix match when necessary.
  const prefix = `${year}|${make}|`;
  const matches = Object.keys(index.vehicles).filter(key => {
    if (!key.startsWith(prefix)) return false;
    const candidate = key.slice(prefix.length);
    return candidate.startsWith(model) || model.startsWith(candidate);
  });
  return [...new Set(matches.flatMap(key => index.vehicles[key]))];
}

async function fetchInvestigations(
  result: VINDecodeResult,
): Promise<{ investigations: SafetyInvestigation[]; source: string | null; updatedAt: string | null }> {
  const index = await loadInvestigationIndex();
  const ids = findInvestigationIds(index, result);
  const investigations = ids
    .map(id => index.investigations[id])
    .filter((record): record is InvestigationIndexRecord => Boolean(record))
    .map(record => ({
      id: record.id,
      investigationType: record.type || record.id.replace(/\d.*$/, ''),
      status: record.status === 'closed' ? 'closed' : 'open',
      subject: record.subject || 'Defect investigation',
      openedDate: record.opened || null,
      closedDate: record.closed || null,
      components: record.components ?? [],
      recallCampaign: record.campaign || null,
      manufacturer: record.manufacturer,
      url: investigationUrl(record.id),
    }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
      return (b.openedDate || '').localeCompare(a.openedDate || '');
    });

  return {
    investigations,
    source: index.meta?.source ?? null,
    updatedAt: index.meta?.generatedAt ?? null,
  };
}

async function fetchComplaints(result: VINDecodeResult): Promise<SafetyComplaint[]> {
  if (!result.make || !result.model || !result.year) return [];
  const url = new URL(COMPLAINTS_URL);
  url.searchParams.set('make', result.make);
  url.searchParams.set('model', result.model);
  url.searchParams.set('modelYear', result.year);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error(`NHTSA complaints returned ${response.status}`);
    const data = (await response.json()) as ComplaintResponse;
    return (data.results ?? []).map(item => ({
      odiNumber: String(item.odiNumber ?? 'Unknown'),
      dateFiled: item.dateComplaintFiled || item.dateOfIncident || '',
      components: parseComponents(item.components),
      summary: item.summary || '',
      crash: Boolean(item.crash),
      fire: Boolean(item.fire),
      injuries: Number(item.numberOfInjuries) || 0,
      deaths: Number(item.numberOfDeaths) || 0,
    }));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Complaints come from the live NHTSA API. Investigations are sourced from a
 * static index built from NHTSA's ODI FLAT_INV file because the live API has
 * no structured year/make/model filter. Both are model-level signals.
 */
export async function getSafetyIntelligence(
  result: VINDecodeResult,
): Promise<SafetyIntelligence> {
  if (result.model_source === 'vin-pattern') {
    return {
      complaints: [],
      complaintsStatus: 'not-applicable',
      complaintsCheckedAt: null,
      investigations: [],
      investigationsStatus: 'not-applicable',
      investigationsCheckedAt: null,
      investigationsSource: null,
      investigationsUpdatedAt: null,
      note: 'NHTSA complaints and investigations are US-market data. This European VIN was decoded from its VIN pattern, so model-level US data was not queried.',
    };
  }

  let complaints: SafetyComplaint[] = [];
  let complaintsStatus: SafetyIntelligence['complaintsStatus'] = 'live';
  let complaintsCheckedAt: string | null = null;
  let investigations: SafetyInvestigation[] = [];
  let investigationsStatus: SafetyIntelligence['investigationsStatus'] = 'live';
  let investigationsCheckedAt: string | null = null;
  let investigationsSource: string | null = null;
  let investigationsUpdatedAt: string | null = null;

  if (!result.make || !result.model || !result.year) {
    complaintsStatus = 'not-configured';
    investigationsStatus = 'not-configured';
  } else {
    const [complaintResult, investigationResult] = await Promise.allSettled([
      fetchComplaints(result),
      fetchInvestigations(result),
    ]);

    if (complaintResult.status === 'fulfilled') {
      complaints = complaintResult.value;
      complaintsCheckedAt = new Date().toISOString();
    } else {
      complaintsStatus = 'unavailable';
    }

    if (investigationResult.status === 'fulfilled') {
      investigations = investigationResult.value.investigations;
      investigationsSource = investigationResult.value.source;
      investigationsUpdatedAt = investigationResult.value.updatedAt;
      investigationsCheckedAt = new Date().toISOString();
    } else {
      investigationsStatus = 'unavailable';
    }
  }

  return {
    complaints,
    complaintsStatus,
    complaintsCheckedAt,
    investigations,
    investigationsStatus,
    investigationsCheckedAt,
    investigationsSource,
    investigationsUpdatedAt,
    note: 'Complaints and investigations are model-level signals, not VIN-specific defects or recall determinations. They are separate from the confirmed recall campaigns listed above.',
  };
}
