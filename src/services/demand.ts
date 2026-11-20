import type { DemandRequest } from '../types';

const STORAGE_KEY = 'autoparts.demand.v1';

function read(): DemandRequest[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(rows: DemandRequest[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 100)));
    window.dispatchEvent(new Event('autoparts:demand-changed'));
  } catch {
    // localStorage may be unavailable.
  }
}

export function saveDemand(
  request: Omit<DemandRequest, 'id' | 'createdAt' | 'status'>,
): DemandRequest {
  const row: DemandRequest = {
    ...request,
    id: `DEMAND-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: 'local-demand-list',
  };
  write([row, ...read()]);
  return row;
}

export function getDemandRequests(): DemandRequest[] {
  return read();
}
