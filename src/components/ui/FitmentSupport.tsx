import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, MessageSquareWarning, Send, ShieldQuestion } from 'lucide-react';
import { getPartPath, resolveFitmentConflict } from '../../services/parts';
import type { CatalogPartWithContext, VehicleCatalog } from '../../types';
import { saveFitmentCorrection, saveFitmentVerification } from '../../services/verification';
import { trackEvent } from '../../services/telemetry';
import styles from '../../styles/features.module.css';

interface FitmentSupportProps {
  part: CatalogPartWithContext;
  vehicle: VehicleCatalog;
  engine: string;
  trim: string;
  vin: string | null;
}

export default function FitmentSupport({ part, vehicle, engine, trim, vin }: FitmentSupportProps) {
  const conflict = resolveFitmentConflict(part, vehicle, engine, trim);
  const [mode, setMode] = useState<'none' | 'verify' | 'report'>('none');
  const [reference, setReference] = useState<string | null>(null);

  const submitVerification = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const request = saveFitmentVerification({
      vin: String(form.get('vin') || vin || '').toUpperCase(),
      partNumber: part.oemNumber,
      partName: part.name,
      vehicle: `${vehicle.catalog.year} ${vehicle.catalog.brand} ${vehicle.catalog.model}`,
      contactName: String(form.get('contactName') || ''),
      contactEmail: String(form.get('contactEmail') || ''),
      contactPhone: String(form.get('contactPhone') || ''),
      notes: String(form.get('notes') || ''),
    });
    setReference(request.id);
    trackEvent('fitment_verification_queued', {
      part: part.slug,
      vin: request.vin,
      requestId: request.id,
    });
  };

  const submitCorrection = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const report = saveFitmentCorrection({
      vin: String(form.get('vin') || vin || '').toUpperCase(),
      partNumber: part.oemNumber,
      partName: part.name,
      vehicle: `${vehicle.catalog.year} ${vehicle.catalog.brand} ${vehicle.catalog.model}`,
      reason: String(form.get('reason') || 'Other'),
      details: String(form.get('details') || ''),
    });
    setReference(report.id);
    trackEvent('fitment_correction_reported', { part: part.slug, reason: report.reason });
  };

  return (
    <section className={`card ${styles.panel}`} style={{ marginTop: 'var(--space-5)' }} aria-labelledby="fitment-support-title">
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Fitment resolution</p>
          <h2 id="fitment-support-title" className={styles.panelTitle}>
            Not sure this part fits?
          </h2>
        </div>
        <span className="badge badge-amber">Dealer handoff</span>
      </div>

      {conflict.reasons.length > 0 ? (
        <div className={`${styles.status} ${conflict.complete ? styles.statusError : styles.statusInfo}`}>
          <ShieldQuestion size={16} aria-hidden="true" />
          <div>
            <strong>{conflict.complete ? 'Why this may not fit' : 'A stronger check needs vehicle details'}</strong>
            <ul className={styles.list} style={{ marginTop: 'var(--space-2)' }}>
              {conflict.reasons.map(reason => (
                <li key={reason} className={styles.listText}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className={`${styles.status} ${styles.statusSuccess}`}>
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>This part matches the selected catalog fitment. Verify the exact part with a dealer before ordering.</span>
        </div>
      )}

      {conflict.alternatives.length > 0 && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <p className={styles.label}>Plausible alternatives in this assembly</p>
          <div className={styles.inlineActions}>
            {conflict.alternatives.map(alternative => (
              <Link
                key={alternative.slug}
                to={getPartPath(vehicle, alternative.assemblySlug, alternative.slug, vin)}
                className={`btn btn-ghost ${styles.small}`}
              >
                {alternative.name} <ChevronRight size={12} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className={styles.inlineActions} style={{ marginTop: 'var(--space-4)' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => { setMode('verify'); setReference(null); }}
        >
          <Send size={14} /> Request fitment verification
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => { setMode('report'); setReference(null); }}
        >
          <MessageSquareWarning size={14} /> Report incorrect fitment
        </button>
      </div>

      {reference && (
        <div className={`${styles.status} ${styles.statusSuccess}`} role="status" style={{ marginTop: 'var(--space-4)' }}>
          <CheckCircle2 size={16} aria-hidden="true" />
          <div>
            <strong>Request saved with reference {reference}.</strong>
            <p style={{ marginTop: 3 }}>
              Partner dealer/shop routing is not connected in this build, so the request remains in
              a local audit queue. Keep the reference for follow-up.
            </p>
          </div>
        </div>
      )}

      {mode === 'verify' && (
        <form className={styles.panel} style={{ marginTop: 'var(--space-4)' }} onSubmit={submitVerification}>
          <div className={styles.panelHeader} style={{ marginBottom: 'var(--space-3)' }}>
            <div>
              <h3 className={styles.panelTitle}>Ask a dealer to verify this fitment</h3>
              <p className={styles.panelMeta}>VIN, part number, and contact details are required.</p>
            </div>
          </div>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.label}>VIN</span>
              <input className={styles.input} name="vin" defaultValue={vin || ''} maxLength={17} required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Contact name</span>
              <input className={styles.input} name="contactName" required autoComplete="name" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input className={styles.input} name="contactEmail" type="email" required autoComplete="email" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Phone (optional)</span>
              <input className={styles.input} name="contactPhone" type="tel" autoComplete="tel" />
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.label}>Notes for the dealer</span>
              <textarea className={styles.textarea} name="notes" placeholder="Engine, trim, or the reason you are unsure." />
            </label>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className="btn btn-primary"><Send size={14} /> Queue request</button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode('none')}>Cancel</button>
          </div>
          <p className={styles.panelMeta} style={{ marginTop: 'var(--space-3)' }}>
            Using part {part.oemNumber} for {vehicle.catalog.year} {vehicle.catalog.brand}{' '}
            {vehicle.catalog.model}.
          </p>
        </form>
      )}

      {mode === 'report' && (
        <form className={styles.panel} style={{ marginTop: 'var(--space-4)' }} onSubmit={submitCorrection}>
          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.label}>VIN (optional)</span>
              <input className={styles.input} name="vin" defaultValue={vin || ''} maxLength={17} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>What is wrong?</span>
              <select className={styles.select} name="reason" defaultValue="Fitment is wrong">
                <option>Fitment is wrong</option>
                <option>Year does not match</option>
                <option>Engine does not match</option>
                <option>Trim does not match</option>
                <option>Part number is wrong</option>
                <option>Other</option>
              </select>
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.label}>Details</span>
              <textarea className={styles.textarea} name="details" required placeholder="What did you find? Include the source if possible." />
            </label>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className="btn btn-primary">Submit correction</button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode('none')}>Cancel</button>
          </div>
        </form>
      )}

      <p className={styles.panelMeta} style={{ marginTop: 'var(--space-3)' }}>
        Verification requests and corrections are saved in a local audit queue until a partner
        endpoint is configured. They are not sent to a dealer automatically.
      </p>
    </section>
  );
}
