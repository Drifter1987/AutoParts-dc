import type {
  CompletedRepair,
  RecallCampaignSeen,
  RecallWatch,
  VehicleRecallLike,
  VINDecodeResult,
} from '../types';

const STORAGE_KEY = 'autoparts.recall-watch.v1';
const CHANGE_EVENT = 'autoparts:recall-watch-changed';

function read(): RecallWatch[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        item =>
          item &&
          typeof item.vin === 'string' &&
          typeof item.make === 'string' &&
          typeof item.model === 'string',
      )
      .map(item => ({
        ...item,
        year: item.year || '',
        make: item.make || '',
        model: item.model || '',
        trim: item.trim ?? null,
        engine: item.engine ?? null,
        addedAt: item.addedAt || new Date().toISOString(),
        notificationsOptIn: Boolean(item.notificationsOptIn),
        lastCheckedAt: item.lastCheckedAt || null,
        campaignHistory: Array.isArray(item.campaignHistory) ? item.campaignHistory : [],
        newCampaigns: Array.isArray(item.newCampaigns)
          ? item.newCampaigns.filter((campaign: unknown) => typeof campaign === 'string')
          : [],
        newCampaignsDetectedAt: item.newCampaignsDetectedAt || null,
        completedRepairs: Array.isArray(item.completedRepairs) ? item.completedRepairs : [],
      })) as RecallWatch[];
  } catch {
    return [];
  }
}

function write(watches: RecallWatch[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watches.slice(0, 24)));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // localStorage may be unavailable in private/restricted contexts.
  }
}

export function getRecallWatches(): RecallWatch[] {
  return read().sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export function getRecallWatch(vin: string): RecallWatch | null {
  return read().find(watch => watch.vin === vin) ?? null;
}

export function watchRecallResult(result: VINDecodeResult): RecallWatch {
  const existing = getRecallWatch(result.vin);
  const next: RecallWatch = {
    vin: result.vin,
    year: result.year || existing?.year || '',
    make: result.make || existing?.make || '',
    model: result.model || existing?.model || '',
    trim: result.trim ?? existing?.trim ?? null,
    engine: result.engine ?? existing?.engine ?? null,
    addedAt: existing?.addedAt ?? new Date().toISOString(),
    notificationsOptIn: existing?.notificationsOptIn ?? false,
    lastCheckedAt: existing?.lastCheckedAt ?? null,
    campaignHistory: existing?.campaignHistory ?? [],
    newCampaigns: existing?.newCampaigns ?? [],
    newCampaignsDetectedAt: existing?.newCampaignsDetectedAt ?? null,
    completedRepairs: existing?.completedRepairs ?? [],
  };
  write([next, ...read().filter(watch => watch.vin !== next.vin)]);
  return next;
}

export function removeRecallWatch(vin: string): void {
  write(read().filter(watch => watch.vin !== vin));
}

export function setRecallWatchOptIn(vin: string, notificationsOptIn: boolean): void {
  write(
    read().map(watch => (watch.vin === vin ? { ...watch, notificationsOptIn } : watch)),
  );
}

export interface RecallWatchCheck {
  watch: RecallWatch;
  newCampaigns: string[];
}

/**
 * Records a model-year check. The first check establishes a baseline so we do
 * not call every existing campaign "new"; later checks return only additions.
 */
export function recordRecallCheck(
  watch: RecallWatch,
  recalls: VehicleRecallLike[],
): RecallWatchCheck {
  const checkedAt = new Date().toISOString();
  const existing = new Map(watch.campaignHistory.map(item => [item.campaignNumber, item]));
  const newCampaigns: string[] = [];

  for (const recall of recalls) {
    if (!existing.has(recall.campaignNumber)) {
      existing.set(recall.campaignNumber, {
        campaignNumber: recall.campaignNumber,
        firstSeenAt: checkedAt,
      });
      if (watch.lastCheckedAt) newCampaigns.push(recall.campaignNumber);
    }
  }

  const pendingNewCampaigns = new Set(watch.newCampaigns ?? []);
  for (const campaignNumber of newCampaigns) pendingNewCampaigns.add(campaignNumber);

  const next: RecallWatch = {
    ...watch,
    lastCheckedAt: checkedAt,
    campaignHistory: [...existing.values()],
    newCampaigns: [...pendingNewCampaigns],
    newCampaignsDetectedAt:
      newCampaigns.length > 0
        ? checkedAt
        : watch.newCampaignsDetectedAt ?? null,
  };
  write(read().map(item => (item.vin === watch.vin ? next : item)));
  return { watch: next, newCampaigns };
}

/** Clear the unreviewed new-campaign marker after the user has seen it. */
export function acknowledgeNewCampaigns(vin: string): RecallWatch | null {
  const watch = getRecallWatch(vin);
  if (!watch) return null;
  const next: RecallWatch = {
    ...watch,
    newCampaigns: [],
    newCampaignsDetectedAt: null,
  };
  write(read().map(item => (item.vin === vin ? next : item)));
  return next;
}

export function markRepairCompleted(
  vin: string,
  campaignNumber: string,
  note = '',
): RecallWatch | null {
  const watch = getRecallWatch(vin);
  if (!watch) return null;
  const entry: CompletedRepair = {
    campaignNumber,
    completedAt: new Date().toISOString(),
    note: note.trim() || undefined,
  };
  const next = {
    ...watch,
    completedRepairs: [
      ...watch.completedRepairs.filter(item => item.campaignNumber !== campaignNumber),
      entry,
    ],
  };
  write(read().map(item => (item.vin === vin ? next : item)));
  return next;
}

export function unmarkRepairCompleted(vin: string, campaignNumber: string): RecallWatch | null {
  const watch = getRecallWatch(vin);
  if (!watch) return null;
  const next = {
    ...watch,
    completedRepairs: watch.completedRepairs.filter(
      item => item.campaignNumber !== campaignNumber,
    ),
  };
  write(read().map(item => (item.vin === vin ? next : item)));
  return next;
}

export function recallWatchChangedEvent(): string {
  return CHANGE_EVENT;
}

export function getSeenAt(watch: RecallWatch, campaignNumber: string): string | null {
  return (
    watch.campaignHistory.find(item => item.campaignNumber === campaignNumber)?.firstSeenAt ??
    null
  );
}

export function getCompletedRepair(
  watch: RecallWatch,
  campaignNumber: string,
): CompletedRepair | null {
  return watch.completedRepairs.find(item => item.campaignNumber === campaignNumber) ?? null;
}

export function hasRememberedCampaign(watch: RecallWatch, campaignNumber: string): boolean {
  return watch.campaignHistory.some(item => item.campaignNumber === campaignNumber);
}

export function campaignSeenEntries(watch: RecallWatch): RecallCampaignSeen[] {
  return watch.campaignHistory;
}
