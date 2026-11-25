import type { DemandRequest, FitmentFeedback, FitmentIssue } from '../types';

const ISSUE_LABELS: Record<FitmentIssue, string> = {
  'does-not-fit': 'Does not fit my vehicle',
  'part-number-mismatch': 'Part number looks wrong',
  'missing-part': 'Part is missing from the assembly',
  other: 'Something else',
};

const HEADER = [
  'Type',
  'Reference',
  'CreatedAt',
  'VIN',
  'Year',
  'Make',
  'Model',
  'Part',
  'OEMNumber',
  'BrandSlug',
  'ModelSlug',
  'Assembly',
  'Engine',
  'Trim',
  'Issue',
  'Note',
  'Context',
];

const escapeCell = (value: string | number | null | undefined): string =>
  `"${String(value ?? '').replace(/"/g, '""')}"`;

/** One CSV for both feedback types; every cell is quoted and escaped. */
export function feedbackCsv(
  demand: DemandRequest[],
  fitment: FitmentFeedback[],
): string {
  const coverageRows = demand.map(row => [
    'Coverage',
    row.id,
    row.createdAt,
    row.vin,
    row.year,
    row.make,
    row.model,
    row.partNeeded,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    row.context,
  ]);

  const fitmentRows = fitment.map(row => [
    'Fitment',
    row.id,
    row.createdAt,
    '',
    row.year,
    row.brand,
    row.model,
    row.partName,
    row.oemNumber,
    row.brandSlug,
    row.modelSlug,
    row.assemblyName,
    row.engine,
    row.trim,
    ISSUE_LABELS[row.issue] ?? row.issue,
    row.note,
    'part-page',
  ]);

  return [HEADER.map(escapeCell).join(','), ...[...coverageRows, ...fitmentRows].map(row =>
    row.map(escapeCell).join(','),
  )].join('\n');
}

export function feedbackCsvFilename(date = new Date()): string {
  return `autoparts-coverage-fitment-feedback-${date.toISOString().slice(0, 10)}.csv`;
}
