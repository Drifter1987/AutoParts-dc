import { useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, MessageSquareWarning, SearchCheck } from 'lucide-react';
import { getSafetyIntelligence, type SafetyIntelligence } from '../../services/safety';
import RollingNumber from './RollingNumber';
import type { VINDecodeResult } from '../../types';
import styles from '../../styles/features.module.css';

interface SafetyIntelligencePanelProps {
  result: VINDecodeResult;
  reportMode?: boolean;
}

function formatDate(value: string): string {
  if (!value) return 'Date not supplied';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatNhtsaDate(value: string | null): string {
  if (!value) return 'Date not supplied';
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  return formatDate(compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : value);
}

const INVESTIGATION_TYPES: Record<string, string> = {
  PE: 'Preliminary evaluation',
  EA: 'Engineering analysis',
  RQ: 'Recall query',
  DP: 'Defect petition',
  AQ: 'Audit query',
};

export default function SafetyIntelligencePanel({
  result,
  reportMode = false,
}: SafetyIntelligencePanelProps) {
  const [data, setData] = useState<SafetyIntelligence | null>(null);
  const [error, setError] = useState(false);
  const vehicleLabel =
    [result.year, result.make, result.model].filter(Boolean).join(' ') || 'this vehicle';

  useEffect(() => {
    let cancelled = false;
    getSafetyIntelligence(result)
      .then(next => {
        if (!cancelled) setData(next);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [result]);

  return (
    <section
      className={`card ${styles.panel}`}
      style={{ marginTop: 'var(--space-5)' }}
      aria-labelledby="safety-intelligence-title"
    >
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Model-level signals</p>
          <h2 id="safety-intelligence-title" className={styles.panelTitle}>
            Safety intelligence beyond recalls
          </h2>
        </div>
        <span className={styles.panelMeta}>Not VIN-specific · {vehicleLabel}</span>
      </div>

      <div className={`${styles.status} ${styles.statusInfo}`} style={{ marginBottom: 'var(--space-4)' }}>
        <AlertCircle size={16} aria-hidden="true" />
        <span>
          {data?.note ??
            'Complaints and investigations are reported at the model level. They can show patterns worth asking about; they do not confirm a defect on this VIN. Keep them separate from confirmed recall campaigns.'}
        </span>
      </div>

      {error && (
        <div className={`${styles.status} ${styles.statusWarning}`} role="status">
          <AlertCircle size={16} aria-hidden="true" />
          <span>Safety signals could not be loaded right now. NHTSA links remain available.</span>
        </div>
      )}

      <div className={styles.grid2}>
        <article className={styles.subcard}>
          <p className={styles.subcardTitle}>
            <MessageSquareWarning size={15} /> Consumer complaints
          </p>
          <span className={styles.metric}>
            {data && data.complaintsStatus === 'live'
              ? <RollingNumber value={data.complaints.length} />
              : '—'}
          </span>
          <p className={styles.metricLabel}>
            {data?.complaintsStatus === 'unavailable'
              ? 'NHTSA unavailable'
              : data?.complaintsStatus === 'not-applicable'
                ? 'US-market data only'
                : data?.complaintsStatus === 'not-configured'
                  ? 'Model details incomplete'
                : data?.complaintsCheckedAt
                  ? `Checked ${new Date(data.complaintsCheckedAt).toLocaleString()}`
                  : 'Checking NHTSA'}
          </p>
          {data && data.complaints.length > 0 ? (
            <ul className={styles.list} style={{ marginTop: 'var(--space-3)' }}>
              {data.complaints.slice(0, reportMode ? 4 : 3).map(complaint => (
                <li key={complaint.odiNumber} className={styles.listItem}>
                  <div className={styles.listTitle}>
                    <span>ODI {complaint.odiNumber}</span>
                    <span className={styles.listMeta}>{formatDate(complaint.dateFiled)}</span>
                  </div>
                  {complaint.components.length > 0 && (
                    <p className={styles.listMeta}>{complaint.components.slice(0, 2).join(' · ')}</p>
                  )}
                  {complaint.summary && <p className={styles.listText}>{complaint.summary}</p>}
                  {(complaint.crash || complaint.fire || complaint.injuries > 0 || complaint.deaths > 0) && (
                    <p className={styles.listMeta} style={{ marginTop: 4 }}>
                      {complaint.crash ? 'Crash reported' : ''}
                      {complaint.fire ? `${complaint.crash ? ' · ' : ''}Fire reported` : ''}
                      {complaint.injuries > 0 ? ` · ${complaint.injuries} injured` : ''}
                      {complaint.deaths > 0 ? ` · ${complaint.deaths} death(s)` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            data && (
              <p className={styles.muted} style={{ marginTop: 'var(--space-3)' }}>
                {data.complaintsStatus === 'unavailable'
                  ? 'The complaints feed is unavailable right now.'
                  : data.complaintsStatus === 'not-applicable'
                    ? 'NHTSA complaints cover the US market; this European VIN was not matched by model.'
                    : data.complaintsStatus === 'not-configured'
                      ? 'Add a model year, make, and model to look up complaints.'
                      : 'No complaints returned for this model year.'}
              </p>
            )
          )}
        </article>

        <article className={styles.subcard}>
          <p className={styles.subcardTitle}>
            <SearchCheck size={15} /> NHTSA investigations
          </p>
          <span className={styles.metric}>
            {data && data.investigationsStatus === 'live'
              ? <RollingNumber value={data.investigations.length} />
              : '—'}
          </span>
          <p className={styles.metricLabel}>
            {data?.investigationsStatus === 'unavailable'
              ? 'Investigation snapshot unavailable'
              : data?.investigationsStatus === 'not-applicable'
                ? 'US-market data only'
                : data?.investigationsStatus === 'not-configured'
                  ? 'Model details incomplete'
                : data?.investigationsUpdatedAt
                  ? `Model-year snapshot · ${formatDate(data.investigationsUpdatedAt)}`
                  : 'Checking NHTSA snapshot'}
          </p>
          {data && data.investigations.length > 0 ? (
            <ul className={styles.list} style={{ marginTop: 'var(--space-3)' }}>
              {data.investigations.slice(0, reportMode ? 4 : 2).map(investigation => (
                <li key={investigation.id} className={styles.listItem}>
                  <div className={styles.listTitle}>
                    <a
                      className={styles.link}
                      href={investigation.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      NHTSA {investigation.id}
                    </a>
                    <span
                      className={styles.listMeta}
                      style={{ color: investigation.status === 'open' ? 'var(--amber)' : undefined }}
                    >
                      {investigation.status === 'open' ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <p className={styles.listMeta}>
                    {INVESTIGATION_TYPES[investigation.investigationType] ||
                      investigation.investigationType}{' '}
                    · Opened {formatNhtsaDate(investigation.openedDate)}
                  </p>
                  <p className={styles.listText}>{investigation.subject}</p>
                  {investigation.components.length > 0 && (
                    <p className={styles.listMeta}>
                      {investigation.components.slice(0, 2).join(' · ')}
                    </p>
                  )}
                  {investigation.recallCampaign && (
                    <p className={styles.listMeta} style={{ marginTop: 4 }}>
                      Related campaign {investigation.recallCampaign}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            data && (
              <p className={styles.muted} style={{ marginTop: 'var(--space-3)' }}>
                {data.investigationsStatus === 'unavailable'
                  ? 'The NHTSA investigation snapshot could not be loaded.'
                  : data.investigationsStatus === 'not-applicable'
                    ? 'NHTSA investigations cover the US market; this European VIN was not matched by model.'
                    : data.investigationsStatus === 'not-configured'
                      ? 'Add a model year, make, and model to look up investigations.'
                      : 'No NHTSA investigations returned for this model year in the snapshot.'}
              </p>
            )
          )}
          <p className={styles.muted} style={{ marginTop: 'var(--space-3)' }}>
            An investigation is NHTSA examining an alleged defect. It is not a confirmed defect or
            a recall for this VIN.
          </p>
          <a
            className={styles.link}
            href="https://www.nhtsa.gov/vehicle-safety/defects-investigations"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', gap: 4, marginTop: 'var(--space-2)', fontSize: '0.78rem' }}
          >
            How NHTSA investigations work <ArrowUpRight size={12} />
          </a>
        </article>
      </div>
    </section>
  );
}
