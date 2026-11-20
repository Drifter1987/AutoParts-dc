import type {
  FitmentCorrectionReport,
  FitmentVerificationRequest,
} from '../types';

const REQUEST_KEY = 'autoparts.fitment-verifications.v1';
const CORRECTION_KEY = 'autoparts.fitment-corrections.v1';

function read<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, rows: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(rows.slice(0, 100)));
  } catch {
    // Local queue is best-effort until a partner endpoint exists.
  }
}

export function makeRequestId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${random}`;
}

export function saveFitmentVerification(
  request: Omit<FitmentVerificationRequest, 'id' | 'createdAt' | 'status'>,
): FitmentVerificationRequest {
  const row: FitmentVerificationRequest = {
    ...request,
    id: makeRequestId('FIT'),
    createdAt: new Date().toISOString(),
    status: 'local-queue',
  };
  write(REQUEST_KEY, [row, ...read<FitmentVerificationRequest>(REQUEST_KEY)]);
  return row;
}

export function getFitmentVerifications(): FitmentVerificationRequest[] {
  return read<FitmentVerificationRequest>(REQUEST_KEY);
}

export function saveFitmentCorrection(
  report: Omit<FitmentCorrectionReport, 'id' | 'createdAt' | 'status'>,
): FitmentCorrectionReport {
  const row: FitmentCorrectionReport = {
    ...report,
    id: makeRequestId('FIX'),
    createdAt: new Date().toISOString(),
    status: 'local-audit',
  };
  write(CORRECTION_KEY, [row, ...read<FitmentCorrectionReport>(CORRECTION_KEY)]);
  return row;
}

export function getFitmentCorrections(): FitmentCorrectionReport[] {
  return read<FitmentCorrectionReport>(CORRECTION_KEY);
}
