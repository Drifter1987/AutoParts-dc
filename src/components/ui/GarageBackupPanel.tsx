import { useEffect, useRef, useState } from 'react';
import { Download, ShieldAlert, Upload } from 'lucide-react';
import {
  garageBackupFilename,
  garageBackupJson,
  parseGarageBackup,
  restoreGarageBackup,
  type GarageBackupPreview,
} from '../../services/garageBackup';
import {
  GARAGE_MAX_VEHICLES,
  garageChangedEvent,
  getGarageVehicles,
} from '../../services/garage';
import { trackEvent } from '../../services/telemetry';
import styles from '../../styles/features.module.css';

function vehicleCountLabel(count: number): string {
  return `${count} saved vehicle${count === 1 ? '' : 's'}`;
}

export default function GarageBackupPanel() {
  const [count, setCount] = useState(() => getGarageVehicles().length);
  const [preview, setPreview] = useState<GarageBackupPreview | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => setCount(getGarageVehicles().length);
    window.addEventListener(garageChangedEvent(), refresh);
    return () => window.removeEventListener(garageChangedEvent(), refresh);
  }, []);

  const downloadBackup = () => {
    try {
      const blob = new Blob([garageBackupJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = garageBackupFilename();
      anchor.click();
      URL.revokeObjectURL(url);
      setPreview(null);
      setFileName(null);
      setError(null);
      setMessage(`Backup downloaded with ${vehicleCountLabel(count)}.`);
      trackEvent('garage_backup_downloaded', { vehicles: count });
    } catch {
      setError('Could not create a backup file in this browser.');
    }
  };

  const loadBackup = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    setPreview(null);
    setFileName(null);
    try {
      const result = parseGarageBackup(await file.text());
      if (result.error || !result.preview) {
        setError(result.error ?? 'That backup could not be read.');
        return;
      }
      setPreview(result.preview);
      setFileName(file.name);
      setError(null);
    } catch {
      setError('That backup file could not be read.');
    }
  };

  const cancelRestore = () => {
    setPreview(null);
    setFileName(null);
    setMessage(null);
    setError(null);
  };

  const confirmRestore = () => {
    if (!preview) return;
    const result = restoreGarageBackup(preview);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    setPreview(null);
    setFileName(null);
    setMessage(
      `Restored ${vehicleCountLabel(result.restored)}. The garage now matches this backup.` +
        (result.dropped > 0
          ? ` ${result.dropped} more could not be kept because My Garage holds up to ${GARAGE_MAX_VEHICLES}.`
          : ''),
    );
    trackEvent('garage_backup_restored', { vehicles: result.restored });
  };

  const previewDate = preview?.exportedAt
    ? new Date(preview.exportedAt).toLocaleString()
    : 'an unknown date';

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="garage-backup-title">
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Backup file</p>
          <h2 id="garage-backup-title" className={styles.panelTitle}>
            Back up and restore My Garage
          </h2>
        </div>
        <span className="badge badge-ice">This device only</span>
      </div>
      <p className={styles.muted}>
        A backup is a JSON file with every saved vehicle, its name, notes, AU/stock number, plate,
        and save date. Restoring replaces the garage in this browser with the file&apos;s contents,
        so the list comes back exactly as it was when you downloaded it.
      </p>

      <div className={styles.fieldGrid} style={{ marginTop: 'var(--space-4)' }}>
        <div className={styles.subcard}>
          <p className={styles.subcardTitle}>
            <Download size={15} /> Download a backup
          </p>
          <p className={styles.muted}>
            {count === 0
              ? 'No vehicles to back up yet — save one from a VIN result first.'
              : `Save ${vehicleCountLabel(count)} to a file you can keep.`}
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={downloadBackup}
            disabled={count === 0}
            style={{ marginTop: 'var(--space-3)' }}
          >
            Download backup
          </button>
        </div>
        <div className={styles.subcard}>
          <p className={styles.subcardTitle}>
            <Upload size={15} /> Restore from a backup
          </p>
          <p className={styles.muted}>
            Choose a backup file, check what it contains, then replace the garage.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={event => {
              void loadBackup(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fileInputRef.current?.click()}
            style={{ marginTop: 'var(--space-3)' }}
          >
            <Upload size={14} /> Choose backup file
          </button>
        </div>
      </div>

      {preview && (
        <div
          className={`${styles.status} ${styles.statusWarning}`}
          role="status"
          style={{ marginTop: 'var(--space-4)', display: 'block' }}
        >
          <p>
            <ShieldAlert size={14} aria-hidden="true" />{' '}
            <strong>{fileName ?? 'Backup file'}</strong> — from {previewDate}, containing{' '}
            {vehicleCountLabel(preview.vehicles.length)}.
          </p>
          <p style={{ marginTop: 'var(--space-2)' }}>
            Restoring replaces the {vehicleCountLabel(count)} currently in this browser. Download a
            backup first if you want to keep the current list.
            {preview.skipped > 0
              ? ` ${preview.skipped} entr${preview.skipped === 1 ? 'y was' : 'ies were'} skipped for an invalid or duplicate VIN.`
              : ''}
          </p>
          <div className={styles.formActions} style={{ marginTop: 'var(--space-3)' }}>
            <button type="button" className="btn btn-primary" onClick={confirmRestore}>
              Restore garage
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancelRestore}>
              Cancel
            </button>
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
        The file is created and read in this browser; nothing is uploaded. It contains VINs, fleet
        numbers, plates, and any notes you have written, so store it like a document about your
        vehicles.
      </p>
    </section>
  );
}
