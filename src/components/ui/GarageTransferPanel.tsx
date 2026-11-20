import { useState } from 'react';
import { ClipboardCopy, CloudOff, Download, Upload } from 'lucide-react';
import { exportGarageCode, getAccountCapability, importGarageCode } from '../../services/garageTransfer';
import { trackEvent } from '../../services/telemetry';
import styles from '../../styles/features.module.css';

export default function GarageTransferPanel() {
  const account = getAccountCapability();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createCode = () => {
    try {
      setCode(exportGarageCode());
      setMessage('Transfer code created. Copy it somewhere safe; it contains your saved VINs.');
      setError(null);
    } catch {
      setError('Could not create a transfer code from this browser.');
    }
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setMessage('Transfer code copied.');
    } catch {
      setError('Clipboard access was blocked; select and copy the code manually.');
    }
  };

  const importCode = () => {
    if (!code.trim()) {
      setError('Paste a transfer code first.');
      return;
    }
    const result = importGarageCode(code);
    if (result.error) {
      setError(result.error);
      setMessage(null);
      return;
    }
    setError(null);
    setMessage(
      result.imported > 0
        ? `Imported ${result.imported} saved vehicle${result.imported === 1 ? '' : 's'}.`
        : 'No new vehicles were imported; this browser already has those saves.',
    );
    trackEvent('garage_transfer_imported', { imported: result.imported });
  };

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="garage-transfer-title">
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Optional account sync</p>
          <h2 id="garage-transfer-title" className={styles.panelTitle}>
            Move My Garage between devices
          </h2>
        </div>
        <span className="badge badge-ice"><CloudOff size={12} /> Account service not connected</span>
      </div>
      <p className={styles.muted}>{account.message}</p>

      <div className={styles.fieldGrid} style={{ marginTop: 'var(--space-4)' }}>
        <div className={styles.subcard}>
          <p className={styles.subcardTitle}><Download size={15} /> Export this browser</p>
          <p className={styles.muted}>Create a transfer code from the vehicles in this browser.</p>
          <button type="button" className="btn btn-ghost" onClick={createCode} style={{ marginTop: 'var(--space-3)' }}>
            Create transfer code
          </button>
        </div>
        <div className={styles.subcard}>
          <p className={styles.subcardTitle}><Upload size={15} /> Import another browser</p>
          <p className={styles.muted}>Paste a code, then merge its vehicles into this browser.</p>
          <button type="button" className="btn btn-ghost" onClick={importCode} style={{ marginTop: 'var(--space-3)' }}>
            Import code
          </button>
        </div>
      </div>

      <label className={styles.field} style={{ marginTop: 'var(--space-4)' }}>
        <span className={styles.label}>Garage transfer code</span>
        <textarea
          className={`${styles.textarea} ${styles.transferBox}`}
          value={code}
          onChange={event => setCode(event.target.value)}
          placeholder="Create a code above or paste one from another browser."
          spellCheck={false}
        />
      </label>
      <div className={styles.formActions}>
        <button type="button" className="btn btn-ghost" onClick={copyCode} disabled={!code}>
          <ClipboardCopy size={14} /> Copy code
        </button>
        <button type="button" className="btn btn-primary" onClick={importCode}>
          Import and merge
        </button>
      </div>
      {message && (
        <div className={`${styles.status} ${styles.statusSuccess}`} role="status" style={{ marginTop: 'var(--space-3)' }}>
          {message}
        </div>
      )}
      {error && (
        <div className={`${styles.status} ${styles.statusError}`} role="alert" style={{ marginTop: 'var(--space-3)' }}>
          {error}
        </div>
      )}
      <p className={styles.panelMeta} style={{ marginTop: 'var(--space-3)' }}>
        A magic-link account adapter is defined as optional infrastructure, but no auth or database
        backend is configured. Treat a transfer code like a document containing your VINs.
      </p>
    </section>
  );
}
