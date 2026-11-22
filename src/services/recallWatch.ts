import type {
  CompletedRepair,
  RecallCampaignSeen,
  RecallWatch,
  VehicleRecallLike,
  VINDecodeResult,
} from '../types';

const STORAGE_KEY = 'autoparts.recall-watch.v1';
const CHANGE_EVENT = 'autoparts:recall-watch-changed';

/** Mirror of the storage cap applied by write(). */
export const RECALL_WATCH_MAX_WATCHES = 24;

/** Shared failure copy for any Recall Watch write the browser refuses. */
export const RECALL_WATCH_WRITE_FAILED_MESSAGE =
  'Could not update Recall Watch. Browser storage is unavailable or full.';

/** Shown instead of silently dropping the oldest watch when the list is at its cap. */
export const RECALL_WATCH_LIMIT_MESSAGE =
  'Could not update Recall Watch. Remove a vehicle first; the watch list holds up to 24.';

export type StoredWriteOutcome = 'saved' | 'rejected' | 'full';

export type RecallWatchWriteOutcome = StoredWriteOutcome | 'missing';

/** Copy for a failed write, or null when the change was stored or the watch is gone. */
export function recallWatchWriteError(outcome: RecallWatchWriteOutcome): string | null {
  if (outcome === 'rejected') return RECALL_WATCH_WRITE_FAILED_MESSAGE;
  if (outcome === 'full') return RECALL_WATCH_LIMIT_MESSAGE;
  return null;
}

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
        // Keep the VIN-pattern marker so a European inferred model is never
        // queried as if it were a US-market model name.
        model_source: item.model_source === 'vin-pattern' ? 'vin-pattern' : null,
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

function write(watches: RecallWatch[]): StoredWriteOutcome {
  // Truncating here would silently drop a watch, so a save past the cap fails
  // the same way a blocked write does and the caller can report it.
  if (watches.length > RECALL_WATCH_MAX_WATCHES) return 'full';
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watches));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return 'saved';
  } catch {
    // localStorage may be unavailable in private/restricted contexts.
    return 'rejected';
  }
}

export function getRecallWatches(): RecallWatch[] {
  return read().sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

export function getRecallWatch(vin: string): RecallWatch | null {
  return read().find(watch => watch.vin === vin) ?? null;
}

/**
 * Apply a change to the freshest stored watch. localStorage has no transaction
 * API, so the read has to be part of the same synchronous read-modify-write as
 * the write: a mutation based on a snapshot taken earlier can overwrite another
 * tab's repair, alert opt-in, or review state — or resurrect a removed watch.
 * Returns 'missing' when the watch is no longer stored.
 */
function updateWatch(
  vin: string,
  change: (current: RecallWatch) => RecallWatch,
): RecallWatchWriteOutcome {
  const watches = read();
  const index = watches.findIndex(watch => watch.vin === vin);
  if (index === -1) return 'missing';
  watches[index] = change(watches[index]);
  return write(watches);
}

export interface RecallWatchAddition {
  watch: RecallWatch;
  outcome: StoredWriteOutcome;
}

export function watchRecallResult(result: VINDecodeResult): RecallWatchAddition {
  const watches = read();
  const existing = watches.find(watch => watch.vin === result.vin);
  const next: RecallWatch = {
    vin: result.vin,
    year: result.year || existing?.year || '',
    make: result.make || existing?.make || '',
    model: result.model || existing?.model || '',
    model_source: result.model_source ?? existing?.model_source ?? null,
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
  const outcome = write([next, ...watches.filter(watch => watch.vin !== next.vin)]);
  return { watch: next, outcome };
}

export function removeRecallWatch(vin: string): RecallWatchWriteOutcome {
  return write(read().filter(watch => watch.vin !== vin));
}

export function setRecallWatchOptIn(
  vin: string,
  notificationsOptIn: boolean,
): RecallWatchWriteOutcome {
  return updateWatch(vin, watch => ({ ...watch, notificationsOptIn }));
}

export interface RecallWatchCheck {
  watch: RecallWatch;
  newCampaigns: string[];
}

/**
 * Records a model-year check. The first check establishes a baseline so we do
 * not call every existing campaign "new"; later checks return only additions.
 * The result is rebased onto the stored watch because the request can take
 * seconds, and another tab may have changed or removed it meanwhile. Returns
 * null when the watch is no longer stored.
 */
export function recordRecallCheck(
  watch: RecallWatch,
  recalls: VehicleRecallLike[],
): RecallWatchCheck | null {
  const checkedAt = new Date().toISOString();
  let newCampaigns: string[] = [];
  const recorded: { watch: RecallWatch | null } = { watch: null };

  updateWatch(watch.vin, current => {
    const existing = new Map(current.campaignHistory.map(item => [item.campaignNumber, item]));
    const additions: string[] = [];

    for (const recall of recalls) {
      if (!existing.has(recall.campaignNumber)) {
        existing.set(recall.campaignNumber, {
          campaignNumber: recall.campaignNumber,
          firstSeenAt: checkedAt,
        });
        if (current.lastCheckedAt) additions.push(recall.campaignNumber);
      }
    }

    const pendingNewCampaigns = new Set(current.newCampaigns ?? []);
    for (const campaignNumber of additions) pendingNewCampaigns.add(campaignNumber);
    newCampaigns = additions;

    const next: RecallWatch = {
      ...current,
      lastCheckedAt: checkedAt,
      campaignHistory: [...existing.values()],
      newCampaigns: [...pendingNewCampaigns],
      newCampaignsDetectedAt:
        additions.length > 0 ? checkedAt : current.newCampaignsDetectedAt ?? null,
    };
    recorded.watch = next;
    return next;
  });

  return recorded.watch ? { watch: recorded.watch, newCampaigns } : null;
}

/** Clear the unreviewed new-campaign marker after the user has seen it. */
export function acknowledgeNewCampaigns(vin: string): RecallWatchWriteOutcome {
  return updateWatch(vin, watch => ({
    ...watch,
    newCampaigns: [],
    newCampaignsDetectedAt: null,
  }));
}

export function markRepairCompleted(
  vin: string,
  campaignNumber: string,
  note = '',
): RecallWatchWriteOutcome {
  const entry: CompletedRepair = {
    campaignNumber,
    completedAt: new Date().toISOString(),
    note: note.trim() || undefined,
  };
  return updateWatch(vin, watch => ({
    ...watch,
    completedRepairs: [
      ...watch.completedRepairs.filter(item => item.campaignNumber !== campaignNumber),
      entry,
    ],
  }));
}

export function unmarkRepairCompleted(
  vin: string,
  campaignNumber: string,
): RecallWatchWriteOutcome {
  return updateWatch(vin, watch => ({
    ...watch,
    completedRepairs: watch.completedRepairs.filter(
      item => item.campaignNumber !== campaignNumber,
    ),
  }));
}

export function recallWatchChangedEvent(): string {
  return CHANGE_EVENT;
}

/**
 * Browsers fire `storage` only in the tabs that did not write. Bridge it to the
 * in-page event so Recall Watch consumers refresh regardless of which tab made
 * the change.
 */
function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// HMR can re-run this module; register the bridge once per document.
if (typeof window !== 'undefined') {
  const tracked = window as Window & { __autopartsRecallWatchStorageSync?: boolean };
  if (!tracked.__autopartsRecallWatchStorageSync) {
    tracked.__autopartsRecallWatchStorageSync = true;
    window.addEventListener('storage', onStorage);
  }
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
