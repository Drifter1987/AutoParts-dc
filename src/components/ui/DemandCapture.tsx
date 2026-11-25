import { useState } from 'react';
import { BellPlus, CheckCircle2 } from 'lucide-react';
import { saveDemand } from '../../services/demand';
import { trackEvent } from '../../services/telemetry';
import styles from '../../styles/features.module.css';

interface DemandCaptureProps {
  context: string;
  defaultVin?: string;
  defaultYear?: string;
  defaultMake?: string;
  defaultModel?: string;
  defaultPart?: string;
  compact?: boolean;
  startOpen?: boolean;
}

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;

export default function DemandCapture({
  context,
  defaultVin = '',
  defaultYear = '',
  defaultMake = '',
  defaultModel = '',
  defaultPart = '',
  compact = false,
  startOpen = false,
}: DemandCaptureProps) {
  const [reference, setReference] = useState<string | null>(null);
  const [open, setOpen] = useState(startOpen || Boolean(defaultPart));
  const [error, setError] = useState<string | null>(null);
  const titleId = `demand-${context.replace(/\W+/g, '-')}`;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const vin = String(form.get('vin') || '').trim().toUpperCase();
    const year = String(form.get('year') || '').trim();
    const make = String(form.get('make') || '').trim();
    const model = String(form.get('model') || '').trim();
    const partNeeded = String(form.get('partNeeded') || '').trim();

    if (!partNeeded) {
      setError('Tell us which part you need so the request is useful.');
      return;
    }

    if (vin && !VIN_PATTERN.test(vin)) {
      setError('A VIN must be 17 letters and numbers. Leave it blank to use year/make/model instead.');
      return;
    }

    if (!vin && (!year || !make || !model)) {
      setError('Add a 17-character VIN or complete year, make, and model.');
      return;
    }

    const row = saveDemand({
      vin,
      year,
      make,
      model,
      partNeeded,
      context,
    });
    setReference(row.id);
    trackEvent('coverage_demand_captured', { context });
  };

  return (
    <section className={`card ${styles.panel}`} aria-labelledby={titleId}>
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Coverage request</p>
          <h2 id={titleId} className={styles.panelTitle}>
            Request parts coverage
          </h2>
        </div>
        <span className="badge badge-amber">No placeholder parts</span>
      </div>
      <p className={styles.muted} style={{ marginBottom: 'var(--space-3)' }}>
        Tell us the vehicle and the part you need. The request is stored only in this browser so
        coverage can be prioritized. It does not create a catalog entry or promise availability.
        No email or contact details are collected; download the feedback CSV from Tools if you want
        to share the request.
      </p>

      {reference ? (
        <div className={`${styles.status} ${styles.statusSuccess}`} role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <div>
            <strong>Coverage request saved as {reference}.</strong>
            <p style={{ marginTop: 3 }}>
              This is a local record you can export from the feedback CSV on Tools. It is not a
              promise of coverage or a notification delivery. Nothing was sent to a third party.
            </p>
          </div>
        </div>
      ) : !open ? (
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <BellPlus size={14} /> Request parts coverage
        </button>
      ) : (
        <form onSubmit={submit} noValidate>
          <div className={styles.fieldGrid} data-compact={compact ? 'true' : undefined}>
            <label className={styles.field}>
              <span className={styles.label}>VIN (optional if using year/make/model)</span>
              <input
                className={styles.input}
                name="vin"
                defaultValue={defaultVin}
                maxLength={17}
                placeholder="17-character VIN"
                aria-describedby={error ? `${titleId}-error` : undefined}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Part needed</span>
              <input
                className={styles.input}
                name="partNeeded"
                defaultValue={defaultPart}
                placeholder="e.g. front brake pads"
                required
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Year</span>
              <input className={styles.input} name="year" defaultValue={defaultYear} inputMode="numeric" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Make</span>
              <input className={styles.input} name="make" defaultValue={defaultMake} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Model</span>
              <input className={styles.input} name="model" defaultValue={defaultModel} />
            </label>
          </div>
          {error && (
            <p id={`${titleId}-error`} className={`${styles.status} ${styles.statusError}`} role="alert" style={{ marginTop: 'var(--space-3)' }}>
              {error}
            </p>
          )}
          <div className={styles.formActions}>
            <button type="submit" className="btn btn-primary">
              <BellPlus size={14} /> Save coverage request
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
