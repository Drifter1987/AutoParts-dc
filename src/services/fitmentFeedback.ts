import type { FitmentFeedback } from '../types';

const STORAGE_KEY = 'autoparts.fitment-feedback.v1';
const CHANGE_EVENT = 'autoparts:fitment-feedback-changed';

export const FITMENT_FEEDBACK_MAX_REPORTS = 100;
export const FITMENT_FEEDBACK_NOTE_MAX_LENGTH = 1000;

function read(): FitmentFeedback[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(row => row && typeof row.id === 'string') : [];
  } catch {
    return [];
  }
}

function write(rows: FitmentFeedback[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(rows.slice(0, FITMENT_FEEDBACK_MAX_REPORTS)),
    );
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage may be unavailable.
  }
}

export function saveFitmentFeedback(
  request: Omit<FitmentFeedback, 'id' | 'createdAt' | 'status'>,
): FitmentFeedback {
  const row: FitmentFeedback = {
    ...request,
    note: request.note.slice(0, FITMENT_FEEDBACK_NOTE_MAX_LENGTH),
    id: `FITREPORT-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: 'local-fitment-feedback',
  };
  write([row, ...read()]);
  return row;
}

export function getFitmentFeedback(): FitmentFeedback[] {
  return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function fitmentFeedbackChangedEvent(): string {
  return CHANGE_EVENT;
}
