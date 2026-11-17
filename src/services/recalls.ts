import type { VINDecodeResult } from '../types';

export interface VehicleRecall {
  campaignNumber: string;
  manufacturer: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  reportDate: string;
  parkIt: boolean;
  parkOutside: boolean;
  overTheAirUpdate: boolean;
}

interface RecallsResponse {
  Count?: number;
  Message?: string;
  results?: {
    Manufacturer?: string;
    NHTSACampaignNumber?: string;
    Component?: string;
    Summary?: string;
    Consequence?: string;
    Remedy?: string;
    ReportReceivedDate?: string;
    parkIt?: boolean;
    parkOutSide?: boolean;
    overTheAirUpdate?: boolean;
  }[];
}

const RECALLS_BASE = 'https://api.nhtsa.gov/recalls/recallsByVehicle';
const TIMEOUT_MS = 12000;

export async function getRecalls(result: VINDecodeResult): Promise<VehicleRecall[]> {
  if (!result.make || !result.model || !result.year) return [];

  const url = new URL(RECALLS_BASE);
  url.searchParams.set('make', result.make);
  url.searchParams.set('model', result.model);
  url.searchParams.set('modelYear', result.year);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error(`NHTSA recalls returned ${response.status}`);
    const data = (await response.json()) as RecallsResponse;
    return (data.results ?? []).map(item => ({
      campaignNumber: item.NHTSACampaignNumber || 'Unknown campaign',
      manufacturer: item.Manufacturer || result.make || '',
      component: item.Component || 'Safety recall',
      summary: item.Summary || '',
      consequence: item.Consequence || '',
      remedy: item.Remedy || '',
      reportDate: item.ReportReceivedDate || '',
      parkIt: Boolean(item.parkIt),
      parkOutside: Boolean(item.parkOutSide),
      overTheAirUpdate: Boolean(item.overTheAirUpdate),
    }));
  } finally {
    clearTimeout(timer);
  }
}

export function nhtsaRecallUrl(vin: string): string {
  return `https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(vin)}`;
}

export function nhtsaCampaignUrl(campaignNumber: string): string {
  return `https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(campaignNumber)}`;
}
