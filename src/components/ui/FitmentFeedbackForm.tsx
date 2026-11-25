import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Flag } from 'lucide-react';
import {
  FITMENT_FEEDBACK_NOTE_MAX_LENGTH,
  saveFitmentFeedback,
} from '../../services/fitmentFeedback';
import type {
  CatalogPartWithContext,
  FitmentIssue,
  VehicleCatalog,
} from '../../types';
import styles from '../../styles/features.module.css';

interface FitmentFeedbackFormProps {
  part: CatalogPartWithContext;
  vehicle: VehicleCatalog;
  engine: string;
  trim: string;
}

const ISSUES: { value: FitmentIssue; label: string }[] = [
  { value: 'does-not-fit', label: 'The part does not fit my vehicle' },
  { value: 'part-number-mismatch', label: 'The part number looks wrong' },
  { value: 'missing-part', label: 'A part is missing from this assembly' },
  { value: 'other', label: 'Something else' },
];

export default function FitmentFeedbackForm({
  part,
  vehicle,
  engine,
  trim,
}: FitmentFeedbackFormProps) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const issue = String(form.get('issue') || '') as FitmentIssue;
    const note = String(form.get('note') || '').trim();

    if (!ISSUES.some(item => item.value === issue)) {
      setError('Choose what seems wrong so the report is useful.');
      return;
    }

    const row = saveFitmentFeedback({
      partSlug: part.slug,
      partName: part.name,
      oemNumber: part.oemNumber,
      brand: vehicle.catalog.brand,
      brandSlug: vehicle.catalog.brandSlug,
      model: vehicle.catalog.model,
      modelSlug: vehicle.catalog.modelSlug,
      year: vehicle.catalog.year,
      assemblySlug: part.assemblySlug,
      assemblyName: part.assemblyName,
      engine,
      trim,
      issue,
      note,
    });
    setReference(row.id);
    setOpen(false);
    setError(null);
  };

  return (
    <div
      style={{
        marginTop: 'var(--space-4)',
        borderTop: '1px solid var(--border)',
        paddingTop: 'var(--space-4)',
      }}
    >
      {reference ? (
        <div className={`${styles.status} ${styles.statusSuccess}`} role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          <div>
            <strong>Fitment report saved as {reference}.</strong>
            <p style={{ marginTop: 3 }}>
              This is a local record in this browser. Nothing was sent to a server, and no email or
              contact details were collected. Download it with the feedback CSV on{' '}
              <Link to="/tools#feedback-export">Tools</Link> when you want to share it.
            </p>
          </div>
        </div>
      ) : !open ? (
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
          <Flag size={14} /> Report a fitment problem
        </button>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className={styles.label}>Report a fitment problem</p>
          <p className={styles.muted} style={{ margin: '4px 0 var(--space-3)' }}>
            Describe what is wrong with this catalog record. The report stays in this browser and
            is not sent anywhere. There is no email field and no contact details are collected.
          </p>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span className={styles.label}>What seems wrong?</span>
              <select className={styles.select} name="issue" defaultValue="">
                <option value="" disabled>
                  Choose one
                </option>
                {ISSUES.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${styles.field} ${styles.fieldFull}`}>
              <span className={styles.label}>What should we check? (optional)</span>
              <textarea
                className={styles.textarea}
                name="note"
                maxLength={FITMENT_FEEDBACK_NOTE_MAX_LENGTH}
                placeholder="e.g. The pad shape differs from the caliper bracket."
              />
            </label>
          </div>

          {error && (
            <p
              className={`${styles.status} ${styles.statusError}`}
              role="alert"
              style={{ marginTop: 'var(--space-3)' }}
            >
              {error}
            </p>
          )}

          <div className={styles.formActions}>
            <button type="submit" className="btn btn-primary">
              <Flag size={14} /> Save fitment report
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
