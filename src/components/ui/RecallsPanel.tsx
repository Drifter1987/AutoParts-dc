import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import {
  getRecalls,
  nhtsaCampaignUrl,
  nhtsaRecallUrl,
  type VehicleRecall,
} from '../../services/recalls';
import { trackEvent } from '../../services/telemetry';
import type { VINDecodeResult } from '../../types';
import styles from '../../styles/parts.module.css';

interface RecallsPanelProps {
  result: VINDecodeResult;
}

function formatRecallDate(value: string): string {
  const dayMonthYear = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (dayMonthYear) {
    const date = new Date(
      Date.UTC(Number(dayMonthYear[3]), Number(dayMonthYear[2]) - 1, Number(dayMonthYear[1])),
    );
    if (!Number.isNaN(date.valueOf())) {
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function RecallsPanel({ result }: RecallsPanelProps) {
  const [state, setState] = useState<{
    key: string;
    recalls: VehicleRecall[] | null;
    error: boolean;
  }>({ key: '', recalls: null, error: false });

  const key = `${result.vin}:${result.year}:${result.make}:${result.model}`;
  const vehicleLabel =
    [result.year, result.make, result.model].filter(Boolean).join(' ') || 'this vehicle';
  const recalls = state.key === key ? state.recalls : null;
  const error = state.key === key ? state.error : false;

  useEffect(() => {
    let cancelled = false;

    getRecalls(result)
      .then(data => {
        if (cancelled) return;
        setState({ key, recalls: data, error: false });
        trackEvent('recalls_loaded', { vin: result.vin, count: data.length });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ key, recalls: null, error: true });
          trackEvent('recalls_failed', { vin: result.vin });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [result, key]);

  return (
    <section className={`card ${styles.detailCard}`} style={{ marginTop: 'var(--space-5)' }} aria-labelledby="recalls-title">
      <div className={styles.sectionHeader}>
        <div>
          <p className="eyebrow">Safety check</p>
          <h2 id="recalls-title" className={styles.h2}>NHTSA safety recalls</h2>
        </div>
        <a
          href={nhtsaRecallUrl(result.vin)}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary"
        >
          Check this VIN for open recalls <ExternalLink size={13} />
        </a>
      </div>

      <p className={styles.provenance} style={{ marginBottom: 'var(--space-4)' }}>
        These campaigns are reported to NHTSA for the {vehicleLabel}. The public API does not
        return this VIN&apos;s repair status, so use the VIN check above to confirm which recalls
        are still open for this specific vehicle.
      </p>

      {recalls === null && !error && (
        <p className={styles.detailValue} aria-live="polite">
          Checking NHTSA for recall campaigns for this model year…
        </p>
      )}

      {error && (
        <div className={`${styles.fitmentCard} ${styles.fitmentWarning}`} role="status">
          <AlertTriangle size={16} />
          <div>
            <strong>Recall lookup unavailable right now.</strong>
            <p className={styles.fitmentText}>
              You can still check this VIN for open recalls on NHTSA using the link above.
            </p>
          </div>
        </div>
      )}

      {recalls && recalls.length === 0 && (
        <div className={`${styles.fitmentCard} ${styles.fitmentSuccess}`} role="status">
          <ShieldCheck size={16} />
          <div>
            <strong>No recall campaigns returned for this model year.</strong>
            <p className={styles.fitmentText}>
              This does not guarantee this VIN has no open recalls. Confirm the VIN on NHTSA for
              open campaigns and remedies.
            </p>
          </div>
        </div>
      )}

      {recalls && recalls.length > 0 && (
        <>
          <p className={styles.sectionMeta} style={{ marginBottom: 'var(--space-3)' }}>
            {recalls.length} NHTSA campaign{recalls.length === 1 ? '' : 's'} reported for this
            model year
          </p>
          <div className={styles.recallList}>
            {recalls.map(recall => (
              <article
                key={`${recall.campaignNumber}-${recall.component}`}
                className={`${styles.recallCard} ${
                  recall.parkIt || recall.parkOutside ? styles.recallUrgent : ''
                }`}
              >
                <div className={styles.recallHeader}>
                  <div>
                    <p className={styles.recallCampaign}>{recall.campaignNumber}</p>
                    <p className={styles.recallComponent}>{recall.component}</p>
                    {recall.manufacturer && (
                      <p className={styles.recallManufacturer}>{recall.manufacturer}</p>
                    )}
                  </div>
                  {(recall.parkIt || recall.parkOutside) && (
                    <span className="badge badge-amber">
                      {recall.parkIt && recall.parkOutside
                        ? 'Do not drive · park outside'
                        : recall.parkIt
                          ? 'Do not drive'
                          : 'Park outside'}
                    </span>
                  )}
                </div>
                {recall.summary && <p className={styles.recallText}>{recall.summary}</p>}
                {recall.consequence && (
                  <p className={styles.recallText}><strong>Risk:</strong> {recall.consequence}</p>
                )}
                <details className={styles.recallDetails}>
                  <summary>Remedy and campaign notes</summary>
                  {recall.remedy && <p><strong>Remedy:</strong> {recall.remedy}</p>}
                  {recall.overTheAirUpdate && (
                    <p>This campaign may be addressed by an over-the-air update.</p>
                  )}
                </details>
                <div className={styles.recallFooter}>
                  <div className={styles.recallMeta}>
                    {recall.reportDate && (
                      <span>Reported {formatRecallDate(recall.reportDate)}</span>
                    )}
                    <span>NHTSA campaign data</span>
                  </div>
                  {recall.campaignNumber !== 'Unknown campaign' && (
                    <a
                      href={nhtsaCampaignUrl(recall.campaignNumber)}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.recallLink}
                      aria-label={`View NHTSA campaign ${recall.campaignNumber}`}
                    >
                      View campaign on NHTSA <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
