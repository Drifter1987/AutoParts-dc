import type { CatalogRights } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Turn an ISO date into a short freshness label without hiding the date elsewhere. */
export function formatFreshness(lastUpdated: string, now = new Date()): string {
  const updated = new Date(`${lastUpdated}T00:00:00Z`);
  if (Number.isNaN(updated.valueOf())) return `Last updated ${lastUpdated}`;

  const days = Math.floor((now.getTime() - updated.getTime()) / DAY_MS);
  if (days <= 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days < 45) return `Updated ${days} days ago`;
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30));
    return `Updated about ${months} month${months === 1 ? '' : 's'} ago`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return `Updated about ${years} year${years === 1 ? '' : 's'} ago`;
}

export function describeRights(rights: CatalogRights): string {
  if (rights.status === 'licensed') return 'Licensed catalog data';
  if (rights.status === 'synthetic') return 'Synthetic test data — internal only';
  return 'Unlicensed development data';
}

export function getRightsLabel(rights: CatalogRights | undefined): string {
  return rights ? describeRights(rights) : 'Rights not declared';
}
