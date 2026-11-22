import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  ExternalLink,
  RefreshCw,
  Trash2,
  Undo2,
} from 'lucide-react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import {
  acknowledgeNewCampaigns,
  getRecallWatch,
  getRecallWatches,
  markRepairCompleted,
  recallWatchChangedEvent,
  recallWatchWriteError,
  recordRecallCheck,
  removeRecallWatch,
  setRecallWatchOptIn,
  unmarkRepairCompleted,
  type RecallWatchWriteOutcome,
} from '../services/recallWatch';
import { getRecallsForVehicle, nhtsaCampaignUrl, nhtsaRecallUrl, type VehicleRecall } from '../services/recalls';
import { getCatalogVehicle, getVehiclePath } from '../services/parts';
import { trackEvent } from '../services/telemetry';
import type { RecallWatch } from '../types';
import styles from '../styles/features.module.css';

interface WatchState {
  recalls: VehicleRecall[] | null;
  checking: boolean;
  error: boolean;
  newCampaigns: string[];
}

const AUTO_RECHECK_MS = 5 * 60 * 1000;

function formatDate(value: string | null): string {
  if (!value) return 'not yet';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function catalogPath(watch: RecallWatch): string | null {
  const vehicle = getCatalogVehicle(
    watch.make.toLowerCase(),
    watch.model.toLowerCase(),
    watch.year,
  );
  return vehicle ? getVehiclePath(vehicle, watch.vin) : null;
}

function dealerSearchUrl(watch: RecallWatch): string {
  const query = `${watch.year} ${watch.make} ${watch.model} dealer recall repair`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export default function RecallCenterPage() {
  const [watches, setWatches] = useState<RecallWatch[]>(() => getRecallWatches());
  const [state, setState] = useState<Record<string, WatchState>>({});
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [writeErrors, setWriteErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(new Set<string>());

  usePageMetadata(
    'Recall Watch — AutoParts',
    'Recheck saved VINs for new model-year recall campaigns, confirm open recalls at NHTSA, mark self-reported repairs, and keep a campaign history.',
    {
      canonicalPath: '/recall-center',
      noindex: true,
      jsonLd: {
        '@type': 'WebPage',
        name: 'Recall Watch',
        description: 'A local recall action center for saved vehicles.',
      },
    },
  );

  useEffect(() => {
    const refresh = () => setWatches(getRecallWatches());
    window.addEventListener(recallWatchChangedEvent(), refresh);
    return () => window.removeEventListener(recallWatchChangedEvent(), refresh);
  }, []);

  /** Report a refused write and return false so the success state is skipped. */
  const reportWrite = (vin: string, outcome: RecallWatchWriteOutcome): boolean => {
    const failure = recallWatchWriteError(outcome);
    setWriteErrors(previous => {
      if (!failure) {
        if (!(vin in previous)) return previous;
        const next = { ...previous };
        delete next[vin];
        return next;
      }
      return { ...previous, [vin]: failure };
    });
    return failure === null;
  };

  const checkWatch = useCallback(async (watch: RecallWatch, automatic = false) => {
    if (inFlight.current.has(watch.vin)) return;
    inFlight.current.add(watch.vin);
    setState(previous => ({
      ...previous,
      [watch.vin]: {
        recalls: previous[watch.vin]?.recalls ?? null,
        checking: true,
        error: false,
        newCampaigns: [],
      },
    }));
    try {
      const recalls = await getRecallsForVehicle(watch);
      const result = recordRecallCheck(watch, recalls);
      // Another tab removed this watch while the request was in flight.
      if (!result) return;
      setState(previous => ({
        ...previous,
        [watch.vin]: {
          recalls,
          checking: false,
          error: false,
          newCampaigns: result.newCampaigns,
        },
      }));
      trackEvent('recall_watch_checked', {
        vin: watch.vin,
        campaigns: recalls.length,
        newCampaigns: result.newCampaigns.length,
        automatic,
      });

      if (
        result.watch.notificationsOptIn &&
        result.newCampaigns.length > 0 &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        new Notification('New recall campaigns reported', {
          body: `${result.newCampaigns.length} new campaign(s) for your ${watch.year} ${watch.make} ${watch.model}. Confirm open status by VIN on NHTSA.`,
        });
      }
    } catch {
      setState(previous => ({
        ...previous,
        [watch.vin]: {
          recalls: null,
          checking: false,
          error: true,
          newCampaigns: [],
        },
      }));
    } finally {
      inFlight.current.delete(watch.vin);
    }
  }, []);

  const checkSavedWatches = useCallback((automatic = false) => {
    void Promise.all(getRecallWatches().map(watch => checkWatch(watch, automatic)));
  }, [checkWatch]);

  useEffect(() => {
    const initial = getRecallWatches();
    if (initial.length) void Promise.all(initial.map(watch => checkWatch(watch)));

    const recheckWhenVisible = () => {
      if (document.visibilityState === 'visible') checkSavedWatches(true);
    };
    const interval = window.setInterval(recheckWhenVisible, AUTO_RECHECK_MS);
    window.addEventListener('focus', recheckWhenVisible);
    document.addEventListener('visibilitychange', recheckWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', recheckWhenVisible);
      document.removeEventListener('visibilitychange', recheckWhenVisible);
    };
  }, [checkWatch, checkSavedWatches]);

  const checkAll = () => {
    checkSavedWatches(false);
  };

  const toggleNotifications = async (watch: RecallWatch) => {
    const next = !watch.notificationsOptIn;
    if (next && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotificationMessage(
          'Browser notifications were not granted. Rechecks still run when you open this page.',
        );
      }
    }
    reportWrite(watch.vin, setRecallWatchOptIn(watch.vin, next));
    setWatches(getRecallWatches());
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Safety retention loop</p>
            <h1 className={styles.title}>Recall Watch</h1>
            <p className={styles.subtitle}>
              Keep a VIN on your watchlist, recheck model-year campaigns, and keep a clear record of
              what you marked as repaired. Rechecks run automatically every 5 minutes while this
              page is open and when you return to it. This is browser-only; no email or SMS is sent.
            </p>
          </div>
          <div className={styles.actions}>
            <span className={styles.panelMeta}>Auto-recheck: every 5 min while open</span>
            <button type="button" className="btn btn-ghost" onClick={checkAll} disabled={!watches.length}>
              <RefreshCw size={14} /> Recheck all
            </button>
            <Link to="/vin" className="btn btn-primary">Add a VIN</Link>
          </div>
        </div>

        <div className={`${styles.status} ${styles.statusInfo}`} role="note">
          <Bell size={16} aria-hidden="true" />
          <span>
            A campaign is “new” only when it appears after the first baseline check for a watched
            VIN. New status stays visible until you mark it reviewed. Results remain model-year
            campaigns; they are not a VIN-specific open-recall determination. Always confirm with
            NHTSA or a dealer. No email or SMS is sent.
          </span>
        </div>

        {notificationMessage && (
          <div className={`${styles.status} ${styles.statusWarning}`} role="status" style={{ marginTop: 'var(--space-3)' }}>
            <BellOff size={16} aria-hidden="true" />
            <span>{notificationMessage}</span>
          </div>
        )}

        {watches.length === 0 ? (
          <div className={`card ${styles.panel}`} style={{ marginTop: 'var(--space-5)' }}>
            <div className={styles.panelHeader}>
              <div>
                <p className="eyebrow">No watched vehicles</p>
                <h2 className={styles.panelTitle}>Save a VIN to start a safety watch</h2>
              </div>
            </div>
            <p className={styles.muted}>
              Decode a VIN, choose <strong>Watch recalls</strong>, and this page will keep the
              model-year campaign history for that vehicle. Your garage is a good place to find
              saved VINs.
            </p>
            <div className={styles.actions} style={{ marginTop: 'var(--space-4)' }}>
              <Link to="/vin" className="btn btn-primary">Decode a VIN</Link>
              <Link to="/garage" className="btn btn-ghost">Open My Garage</Link>
            </div>
          </div>
        ) : (
          <div className={styles.stack} style={{ marginTop: 'var(--space-5)' }}>
            {watches.map(watch => {
              const row = state[watch.vin];
              const path = catalogPath(watch);
              return (
                <section key={watch.vin} className={`card ${styles.panel}`} aria-labelledby={`watch-${watch.vin}`}>
                  <div className={styles.panelHeader}>
                    <div>
                      <p className="eyebrow">Watched VIN</p>
                      <h2 id={`watch-${watch.vin}`} className={styles.panelTitle}>
                        {watch.year} {watch.make} {watch.model}
                      </h2>
                      <p className={styles.watchVin}>{watch.vin}</p>
                    </div>
                    <div className={styles.actions}>
                      <span className="badge badge-ice"><Bell size={12} /> Recall watch</span>
                      <span className={`badge ${watch.newCampaigns.length ? 'badge-amber' : 'badge-success'}`}>
                        {watch.newCampaigns.length
                          ? `${watch.newCampaigns.length} new`
                          : watch.lastCheckedAt
                            ? 'No new campaigns'
                            : 'Awaiting first check'}
                      </span>
                      <button
                        type="button"
                        className={`btn btn-ghost ${styles.small} ${styles.watchRemove}`}
                        onClick={() => {
                          reportWrite(watch.vin, removeRecallWatch(watch.vin));
                          setWatches(getRecallWatches());
                        }}
                        aria-label={`Stop watching ${watch.vin}`}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>

                  {writeErrors[watch.vin] && (
                    <div
                      className={`${styles.status} ${styles.statusError}`}
                      role="alert"
                      style={{ marginBottom: 'var(--space-3)' }}
                    >
                      <AlertTriangle size={16} aria-hidden="true" />
                      <span>{writeErrors[watch.vin]}</span>
                    </div>
                  )}

                  <div className={styles.inlineActions} style={{ marginBottom: 'var(--space-3)' }}>
                    <a
                      className="btn btn-primary"
                      href={nhtsaRecallUrl(watch.vin)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Check this VIN at NHTSA <ExternalLink size={13} />
                    </a>
                    {path && <Link to={path} className="btn btn-ghost">Browse matching parts</Link>}
                    <a
                      className="btn btn-ghost"
                      href={dealerSearchUrl(watch)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Find a dealer <ExternalLink size={13} />
                    </a>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        if (!row?.checking) void checkWatch(getRecallWatch(watch.vin) ?? watch);
                      }}
                      aria-disabled={row?.checking || undefined}
                      aria-busy={row?.checking || undefined}
                    >
                      <RefreshCw size={14} /> {row?.checking ? 'Checking…' : 'Recheck now'}
                    </button>
                  </div>

                  <div className={styles.badgeRow} style={{ marginBottom: 'var(--space-3)' }}>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={watch.notificationsOptIn}
                        onChange={() => void toggleNotifications(watch)}
                      />
                      Browser alert for new model-year campaigns (no email or SMS)
                    </label>
                    <span className={styles.panelMeta}>Last checked: {formatDate(watch.lastCheckedAt)}</span>
                  </div>

                  {row?.error && (
                    <div className={`${styles.status} ${styles.statusWarning}`} role="status">
                      <AlertTriangle size={16} aria-hidden="true" />
                      <span>NHTSA recheck failed. The VIN link above still works.</span>
                    </div>
                  )}

                  {watch.newCampaigns.length > 0 ? (
                    <div className={`${styles.status} ${styles.statusWarning}`} role="status" style={{ marginTop: 'var(--space-3)' }}>
                      <Bell size={16} aria-hidden="true" />
                      <div style={{ flex: 1 }}>
                        <strong>
                          {watch.newCampaigns.length} new campaign{watch.newCampaigns.length === 1 ? '' : 's'} reported
                        </strong>{' '}
                        for this model year: {watch.newCampaigns.join(', ')}. First detected{' '}
                        {formatDate(watch.newCampaignsDetectedAt)}. This is model-year campaign
                        data, not a VIN-specific open-recall determination; confirm with NHTSA.
                      </div>
                      <button
                        type="button"
                        className={`btn btn-ghost ${styles.small}`}
                        onClick={() => {
                          reportWrite(watch.vin, acknowledgeNewCampaigns(watch.vin));
                          setWatches(getRecallWatches());
                        }}
                      >
                        <Check size={12} /> Mark reviewed
                      </button>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <div className={styles.panelHeader} style={{ marginBottom: 'var(--space-2)' }}>
                      <div>
                        <p className={styles.label}>Campaign history · model-year</p>
                        <p className={styles.muted}>
                          {row?.checking
                            ? 'Checking NHTSA…'
                            : row?.recalls
                              ? `${row.recalls.length} campaign${row.recalls.length === 1 ? '' : 's'} returned for the model year; not VIN-specific.`
                              : 'Run a recheck to load current campaigns.'}
                        </p>
                      </div>
                    </div>

                    {row?.recalls?.map(recall => {
                      const completed = watch.completedRepairs.find(
                        repair => repair.campaignNumber === recall.campaignNumber,
                      );
                      const seen = watch.campaignHistory.find(
                        item => item.campaignNumber === recall.campaignNumber,
                      );
                      return (
                        <div key={recall.campaignNumber} className={styles.campaignRow}>
                          <div className={styles.campaignCopy}>
                            <p className={styles.campaignNumber}>
                              {recall.campaignNumber}
                              {watch.newCampaigns.includes(recall.campaignNumber) && (
                                <span className="badge badge-amber" style={{ marginLeft: 8 }}>New</span>
                              )}
                            </p>
                            <p className={styles.muted}>{recall.component}</p>
                            <p className={styles.listText}>{recall.summary}</p>
                            <p className={styles.panelMeta}>
                              First seen {formatDate(seen?.firstSeenAt ?? null)}
                              {completed ? ` · Repair marked ${formatDate(completed.completedAt)} (self-reported)` : ''}
                            </p>
                          </div>
                          <div className={styles.campaignActions}>
                            <a
                              className={styles.link}
                              href={nhtsaCampaignUrl(recall.campaignNumber)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              NHTSA <ExternalLink size={11} />
                            </a>
                            {completed ? (
                              <button
                                type="button"
                                className={`btn btn-ghost ${styles.small}`}
                                onClick={() => {
                                  reportWrite(
                                    watch.vin,
                                    unmarkRepairCompleted(watch.vin, recall.campaignNumber),
                                  );
                                  setWatches(getRecallWatches());
                                }}
                              >
                                <Undo2 size={12} /> Undo repaired
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={`btn btn-ghost ${styles.small}`}
                                onClick={() => {
                                  const saved = reportWrite(
                                    watch.vin,
                                    markRepairCompleted(watch.vin, recall.campaignNumber),
                                  );
                                  setWatches(getRecallWatches());
                                  if (saved) {
                                    trackEvent('recall_repair_marked', {
                                      vin: watch.vin,
                                      campaign: recall.campaignNumber,
                                    });
                                  }
                                }}
                              >
                                <Check size={12} /> Mark repaired
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {!row?.recalls && !row?.checking && !row?.error && (
                      <p className={styles.muted}>No campaigns loaded yet. Use “Recheck now” above.</p>
                    )}
                    {row?.recalls?.length === 0 && (
                      <p className={styles.muted}>
                        No campaigns returned for this model year. This does not prove this VIN has
                        no open recall; use the NHTSA VIN check.
                      </p>
                    )}

                    {Boolean(row?.recalls) && watch.campaignHistory.some(
                      item => !row?.recalls?.some(recall => recall.campaignNumber === item.campaignNumber),
                    ) && (
                      <div style={{ marginTop: 'var(--space-4)' }}>
                        <p className={styles.label}>Earlier campaign snapshots</p>
                        {watch.campaignHistory
                          .filter(
                            item => !row?.recalls?.some(recall => recall.campaignNumber === item.campaignNumber),
                          )
                          .map(item => (
                            <div key={item.campaignNumber} className={styles.campaignRow}>
                              <div className={styles.campaignCopy}>
                                <p className={styles.campaignNumber}>{item.campaignNumber}</p>
                                <p className={styles.panelMeta}>
                                  First seen {formatDate(item.firstSeenAt)} · not returned in the latest check
                                </p>
                              </div>
                              <a
                                className={styles.link}
                                href={nhtsaCampaignUrl(item.campaignNumber)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                NHTSA <ExternalLink size={11} />
                              </a>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className={styles.status} style={{ marginTop: 'var(--space-4)' }}>
                    <Bell size={15} aria-hidden="true" />
                    <span>
                      Self-reported repair status is stored only in this browser. It is not sent to
                      NHTSA or a dealer and does not close a campaign.
                    </span>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
