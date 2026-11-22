import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, ExternalLink, Info, Printer } from 'lucide-react';
import VehicleCard from './VehicleCard';
import RecallsPanel from './RecallsPanel';
import SafetyIntelligencePanel from './SafetyIntelligencePanel';
import RecallWatchButton from './RecallWatchButton';
import ShareButton from './ShareButton';
import { trackEvent } from '../../services/telemetry';
import {
  MODEL_DATA_UNAVAILABLE,
  getRecallLookupScope,
  getVehicleIdentity,
  hasCompleteVehicleIdentity,
} from '../../services/vehicleIdentity';
import type { Brand, VINDecodeResult } from '../../types';
import featureStyles from '../../styles/features.module.css';
import styles from './VINSafetyReport.module.css';

interface VINSafetyReportProps {
  result: VINDecodeResult;
  catalogBrands: Brand[] | null;
  cachedAt: string | null;
}

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function VINSafetyReport({
  result,
  catalogBrands,
  cachedAt,
}: VINSafetyReportProps) {
  const [generatedAt] = useState(() => new Date());
  const identity = getVehicleIdentity(result);
  const identityComplete = hasCompleteVehicleIdentity(result);
  const lookupScope = getRecallLookupScope(result);
  const vehicleLabel = identityComplete
    ? identity
    : identity
      ? `${identity} — ${MODEL_DATA_UNAVAILABLE}`
      : MODEL_DATA_UNAVAILABLE;
  const shareTitle = identityComplete
    ? `${identity}${result.trim ? ` ${result.trim}` : ''} — VIN safety report`
    : `VIN safety report — ${MODEL_DATA_UNAVAILABLE}`;
  const shareText =
    lookupScope === 'model-year'
      ? `VIN safety report for ${vehicleLabel}: decoded specifications, NHTSA model-year campaigns, complaints, and next steps.`
      : lookupScope === 'inferred-model'
        ? `VIN safety report for ${vehicleLabel}: the model was inferred from the VIN, so no US-market model-year recall lookup ran.`
        : `VIN safety report for ${result.vin}: ${MODEL_DATA_UNAVAILABLE}, so no model-year recall lookup ran.`;

  useEffect(() => {
    document.body.classList.add('vin-report-print');
    return () => document.body.classList.remove('vin-report-print');
  }, []);

  return (
    <article className={styles.report} aria-labelledby="report-title">
      <header className={styles.reportHeader}>
        <div className={styles.headerCopy}>
          <p className="eyebrow">VIN safety report</p>
          <h1 id="report-title" className={styles.title}>
            {vehicleLabel}
            {identityComplete && result.trim && (
              <>
                {' '}
                <span className={styles.trim}>{result.trim}</span>
              </>
            )}
          </h1>
          <p className={styles.vinLine}>
            <span>VIN</span>
            <code>{result.vin}</code>
          </p>
          {!identityComplete && (
            <p className={styles.cachedNote} role="status">
              {MODEL_DATA_UNAVAILABLE}. NHTSA returned this VIN without enough model-year,
              make, and model detail, so this report carries VIN-specific specifications only
              and no model-year recall lookup ran.
            </p>
          )}
          {lookupScope === 'inferred-model' && (
            <p className={styles.cachedNote} role="status">
              Model inferred from VIN positions 7–8 ({result.model_code}). No US-market
              model-year recall lookup was run.
            </p>
          )}
          <p className={styles.timestamp}>
            <Clock size={14} />
            Report generated{' '}
            <time dateTime={generatedAt.toISOString()}>{formatDateTime(generatedAt)}</time>
            <span className={styles.timestampDivider}>·</span>
            VIN decoded from NHTSA vPIC
          </p>
          {cachedAt && (
            <p className={styles.cachedNote}>
              Using a cached VIN decode from {new Date(cachedAt).toLocaleString()}. Reconnect to
              refresh NHTSA data.
            </p>
          )}
        </div>

        <div className={`${styles.actions} ${styles.noPrint}`}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              trackEvent('vin_report_print', { vin: result.vin });
              window.print();
            }}
          >
            <Printer size={15} /> Print / save PDF
          </button>
          <ShareButton className="btn btn-ghost" label="Share report" title={shareTitle} text={shareText} />
          <Link
            to={`/vin?vin=${encodeURIComponent(result.vin)}`}
            className="btn btn-ghost"
          >
            <ArrowLeft size={15} /> Back to result
          </Link>
        </div>
      </header>

      <aside className={styles.scopeNote} aria-label="What is VIN-specific in this report">
        <Info size={18} className={styles.scopeIcon} />
        <div>
          <strong>What is VIN-specific in this report?</strong>
          <p>
            The decoded specifications and the{' '}
            <a href={`https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(result.vin)}`} target="_blank" rel="noreferrer">
              NHTSA VIN lookup
            </a>{' '}
            are specific to this vehicle&apos;s VIN.{' '}
            {lookupScope === 'model-year' ? (
              <>
                The recall campaign list below is matched by model year, make, and model —
                NHTSA&apos;s public API does not return whether a campaign is open or already
                repaired on this VIN. Confirm open status and remedy eligibility with NHTSA or a
                dealer. Consumer complaints and investigations are also matched by model year,
                make, and model — they are model-level context and are not confirmed recalls for
                this VIN.
              </>
            ) : lookupScope === 'inferred-model' ? (
              <>
                This vehicle&apos;s model was inferred from its VIN pattern, so AutoParts did not
                run a model-year recall, complaint, or investigation lookup; NHTSA&apos;s public
                data covers the US market. Confirm open status and remedy eligibility for this
                VIN with NHTSA or a dealer.
              </>
            ) : (
              <>
                This VIN decoded without a model year, make, and model for its market, so
                AutoParts did not run a model-year recall, complaint, or investigation lookup.
                There is no campaign list below to match to this vehicle. Confirm open status and
                remedy eligibility for this VIN with NHTSA or a dealer.
              </>
            )}
          </p>
        </div>
      </aside>

      <div className={styles.sectionStack}>
        <VehicleCard result={result} catalogBrands={catalogBrands} reportMode />
        <RecallsPanel result={result} reportMode />
        <SafetyIntelligencePanel result={result} reportMode />
        <section className={`card ${featureStyles.reportNext}`} aria-labelledby="report-next-title">
          <p className="eyebrow">What to do next</p>
          <h2 id="report-next-title" style={{ fontSize: '1.12rem', fontWeight: 800, marginTop: 6 }}>
            Turn this report into an action
          </h2>
          <ol>
            <li>
              Open the{' '}
              <a href={`https://www.nhtsa.gov/recalls?vin=${encodeURIComponent(result.vin)}`} target="_blank" rel="noreferrer">
                VIN-specific NHTSA lookup
              </a>{' '}
              to confirm whether any campaign is open for this exact vehicle.
            </li>
            <li>
              {lookupScope === 'model-year'
                ? 'Ask a dealer or mechanic to verify remedy eligibility before scheduling work; bring the campaign numbers above and the VIN.'
                : 'Ask a dealer or mechanic to check whether any campaign applies to this VIN; bring the VIN, and confirm any remedy eligibility before scheduling work.'}
            </li>
            <li>
              {lookupScope === 'model-year'
                ? 'Save this VIN to Recall Watch to recheck model-year campaigns on a later visit, and share this report with a seller or mechanic.'
                : lookupScope === 'inferred-model'
                  ? 'Save this VIN to Recall Watch to keep a VIN-specific NHTSA link; US-market rechecks stay off while the model is inferred from the VIN. Share this report with a seller or mechanic.'
                  : 'Save this VIN to Recall Watch to keep a VIN-specific NHTSA link; model-year rechecks stay off until a year, make, and model are available. Share this report with a seller or mechanic.'}
            </li>
          </ol>
          <div className={`${styles.noPrint} ${featureStyles.actions}`} data-report-action style={{ marginTop: 'var(--space-4)' }}>
            <RecallWatchButton result={result} reportMode />
            <Link to="/recall-center" className="btn btn-ghost">Open Recall Watch</Link>
            <Link to={`/vin?vin=${encodeURIComponent(result.vin)}`} className="btn btn-ghost">
              Back to VIN result
            </Link>
          </div>
        </section>
      </div>

      <footer className={styles.reportFooter}>
        <p>
          Prepared by AutoParts. VIN specifications come from the{' '}
          <a href="https://vpic.nhtsa.dot.gov/decoder/" target="_blank" rel="noreferrer">
            NHTSA vPIC decoder <ExternalLink size={11} />
          </a>
          ; recall data comes from{' '}
          <a href="https://www.nhtsa.gov/recalls" target="_blank" rel="noreferrer">
            NHTSA Recalls <ExternalLink size={11} />
          </a>
          . Consumer complaints and investigations are model-year data from NHTSA and are not a
          defect determination or confirmed recall for this VIN. Part references in the catalog
          are representative and require dealer verification.
        </p>
        <p>
          This report is informational and is not an official NHTSA or manufacturer recall notice.
        </p>
      </footer>
    </article>
  );
}
