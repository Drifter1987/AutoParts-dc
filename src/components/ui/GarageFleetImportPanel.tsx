import { useEffect, useRef, useState } from 'react';
import { FileText, ShieldAlert, Upload } from 'lucide-react';
import {
  decodeFleetRows,
  mergeFleetImport,
  parseFleetSheet,
  planFleetImport,
  type FleetImportPlan,
  type FleetSheetPreview,
} from '../../services/garageFleetImport';
import {
  GARAGE_MAX_VEHICLES,
  garageChangedEvent,
  getGarageVehicles,
} from '../../services/garage';
import { trackEvent } from '../../services/telemetry';
import styles from '../../styles/features.module.css';

export default function GarageFleetImportPanel() {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<FleetSheetPreview | null>(null);
  const [plan, setPlan] = useState<FleetImportPlan | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [count, setCount] = useState(() => getGarageVehicles().length);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => setCount(getGarageVehicles().length);
    window.addEventListener(garageChangedEvent(), refresh);
    return () => window.removeEventListener(garageChangedEvent(), refresh);
  }, []);

  const clearResult = () => {
    setPreview(null);
    setPlan(null);
    setMessage(null);
    setError(null);
  };

  const changeText = (value: string) => {
    setText(value);
    setFileName(null);
    clearResult();
  };

  const review = () => {
    clearResult();
    const parsed = parseFleetSheet(text);
    if (!parsed.preview) {
      setError(parsed.error ?? 'That fleet sheet could not be read.');
      return;
    }
    setPreview(parsed.preview);
    setPlan(planFleetImport(parsed.preview.rows));
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
      clearResult();
    } catch {
      setError('That fleet file could not be read.');
    }
  };

  const cancel = () => {
    setPreview(null);
    setPlan(null);
    setFileName(null);
    setMessage(null);
    setError(null);
  };

  const runImport = async () => {
    if (!plan || !preview) return;
    const actionable = plan.newRows.length + plan.updateRows.length + plan.repairRows.length;
    if (actionable === 0) {
      setError('There are no new or matching vehicles to import.');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const decoded = await decodeFleetRows(plan.newRows, (done, total) =>
        setProgress({ done, total }),
      );
      const result = mergeFleetImport(plan, decoded);
      if (result.error) {
        setError(result.error);
        return;
      }

      const sentences: string[] = [];
      if (result.imported > 0) {
        sentences.push(
          `Imported ${result.imported} new vehicle${result.imported === 1 ? '' : 's'}.`,
        );
      }
      const matched = result.updated + result.repaired;
      if (matched > 0) {
        sentences.push(
          `Matched ${matched} already-saved vehicle${matched === 1 ? '' : 's'}; their names and notes were kept.`,
        );
      }
      if (result.repaired > 0) {
        sentences.push(
          `Corrected ${result.repaired} saved VIN${result.repaired === 1 ? '' : 's'} from the AU/stock match.`,
        );
      }
      const skipped = preview.issues.length + plan.conflicts.length + result.skipped;
      if (skipped > 0) {
        sentences.push(
          `Skipped ${skipped} row${skipped === 1 ? '' : 's'} for a duplicate, invalid, or conflicting VIN.`,
        );
      }
      if (result.dropped > 0) {
        sentences.push(
          `${result.dropped} more could not be kept because My Garage holds up to ${GARAGE_MAX_VEHICLES}.`,
        );
      }
      setMessage(sentences.join(' ') || 'No vehicles were imported.');

      trackEvent('garage_fleet_imported', {
        parsed: preview.rows.length,
        imported: result.imported,
        matched,
        skipped,
        dropped: result.dropped,
      });

      setPreview(null);
      setPlan(null);
      setText('');
      setFileName(null);
    } catch {
      setError('The fleet sheet import stopped unexpectedly. Try again.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const issues = preview && plan ? [...preview.issues, ...plan.conflicts] : [];
  const actionable = plan
    ? plan.newRows.length + plan.updateRows.length + plan.repairRows.length
    : 0;
  const matched = plan ? plan.updateRows.length + plan.repairRows.length : 0;

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="garage-fleet-import-title">
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Bulk add</p>
          <h2 id="garage-fleet-import-title" className={styles.panelTitle}>
            Import a fleet sheet
          </h2>
        </div>
        <span className="badge badge-ice">CSV · TSV · Markdown</span>
      </div>

      <p className={styles.muted}>
        Paste a fleet sheet or choose a CSV/TSV file with VIN, Name, AU/Stock, and Plate columns.
        A VIN must be exactly 17 characters. Existing VINs are matched instead of added twice, and
        their saved names and notes are kept. New VINs are decoded through NHTSA and added, up to{' '}
        {GARAGE_MAX_VEHICLES} vehicles.
      </p>

      <label className={styles.field} style={{ marginTop: 'var(--space-4)' }}>
        <span className={styles.label}>Fleet sheet (CSV, TSV, or markdown table)</span>
        <textarea
          className={`${styles.textarea} ${styles.transferBox}`}
          value={text}
          onChange={event => changeText(event.target.value)}
          placeholder={`VIN,Name,AU/Stock,Plate
WAUZZZHC2VA001164,Audi A2 e-tron 140 kW,AU310671002,IN-S3856E
WAUZZZFJ2S1000156,Q3 1.5 R4110 A7,AU336050265,IN-R3478`}
          rows={6}
          spellCheck={false}
        />
      </label>

      <div className={styles.formActions}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={review}
          disabled={!text.trim() || busy}
        >
          <FileText size={14} /> Review fleet sheet
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          hidden
          onChange={event => {
            void loadFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          <Upload size={14} /> Choose CSV file
        </button>
        {fileName && <span className={styles.panelMeta}>Loaded {fileName}</span>}
      </div>

      {preview && plan && (
        <div
          className={`${styles.status} ${styles.statusWarning}`}
          role="status"
          style={{ marginTop: 'var(--space-4)', display: 'block' }}
        >
          <p>
            <ShieldAlert size={14} aria-hidden="true" />{' '}
            <strong>{fileName ?? 'Fleet sheet'}</strong> — {preview.rows.length} valid VIN
            {preview.rows.length === 1 ? '' : 's'}.
            {' '}{plan.newRows.length} new vehicle{plan.newRows.length === 1 ? '' : 's'} ready to
            import.
          </p>
          <p style={{ marginTop: 'var(--space-2)' }}>
            {matched > 0
              ? `${matched} already saved — names and notes kept.`
              : 'No VINs in this sheet are already saved.'}
            {plan.repairRows.length > 0
              ? ` ${plan.repairRows.length} matched by AU/stock number; the saved VIN will be corrected.`
              : ''}
          </p>
          {issues.length > 0 && (
            <p style={{ marginTop: 'var(--space-2)' }}>
              {issues.length} row{issues.length === 1 ? '' : 's'} will be skipped for a duplicate,
              invalid, or conflicting VIN.
            </p>
          )}
          {plan.overflowRows.length > 0 && (
            <p style={{ marginTop: 'var(--space-2)' }}>
              {plan.overflowRows.length} more would exceed the {GARAGE_MAX_VEHICLES}-vehicle cap and
              will not be imported.
            </p>
          )}
          {issues.length > 0 && (
            <ul aria-label="Rows that will be skipped" style={{ marginTop: 'var(--space-2)' }}>
              {issues.slice(0, 8).map(issue => (
                <li key={`${issue.line}-${issue.vin}-${issue.reason}`}>
                  Line {issue.line}: {issue.message}
                </li>
              ))}
              {issues.length > 8 && <li>…and {issues.length - 8} more.</li>}
            </ul>
          )}

          <div className={styles.formActions} style={{ marginTop: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void runImport()}
              disabled={busy || actionable === 0}
            >
              {busy ? 'Importing…' : 'Import fleet sheet'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}>
              Cancel
            </button>
            {busy && progress && progress.total > 0 && (
              <span className={styles.panelMeta} role="status">
                Decoding {progress.done} of {progress.total} new VINs…
              </span>
            )}
          </div>
        </div>
      )}

      {message && (
        <div
          className={`${styles.status} ${styles.statusSuccess}`}
          role="status"
          style={{ marginTop: 'var(--space-3)' }}
        >
          {message}
        </div>
      )}
      {error && (
        <div
          className={`${styles.status} ${styles.statusError}`}
          role="alert"
          style={{ marginTop: 'var(--space-3)' }}
        >
          {error}
        </div>
      )}

      <p className={styles.panelMeta} style={{ marginTop: 'var(--space-3)' }}>
        {count} of {GARAGE_MAX_VEHICLES} garage spaces used. The sheet is read in this browser;
        new VINs are sent to NHTSA for decoding, and no fleet file is uploaded. VINs, fleet numbers,
        and plates are stored only in this browser.
      </p>
    </section>
  );
}
