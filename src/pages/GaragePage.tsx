import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Bookmark, Car, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { CATALOG_VEHICLES, getVehicleLabel, getVehiclePath } from '../services/parts';
import {
  GARAGE_NOTES_MAX_LENGTH,
  GARAGE_WRITE_FAILED_MESSAGE,
  garageChangedEvent,
  getDefaultVehicleName,
  getGarageVehicleName,
  getGarageVehicles,
  removeVehicle,
  renameGarageVehicle,
  updateGarageVehicleNotes,
} from '../services/garage';
import GarageBackupPanel from '../components/ui/GarageBackupPanel';
import GarageTransferPanel from '../components/ui/GarageTransferPanel';
import type { GarageVehicle } from '../types';
import styles from '../styles/parts.module.css';

function catalogPathForSaved(saved: GarageVehicle): string | null {
  const vehicle = CATALOG_VEHICLES.find(
    item =>
      item.catalog.brand.toLowerCase() === saved.make.toLowerCase() &&
      item.catalog.model.toLowerCase() === saved.model.toLowerCase() &&
      String(item.catalog.year) === saved.year,
  );
  return vehicle ? getVehiclePath(vehicle, saved.vin) : null;
}

function GarageVehicleCard({
  vehicle,
  catalogPath,
}: {
  vehicle: GarageVehicle;
  catalogPath: string | null;
}) {
  const displayName = getGarageVehicleName(vehicle);
  const defaultName = getDefaultVehicleName(vehicle);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  // Null means "show the stored notes". A draft exists only while the user is
  // editing, so a restore or import that changes storage is reflected here.
  const [draftNotes, setDraftNotes] = useState<string | null>(null);
  const [notesSaved, setNotesSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const renameButtonRef = useRef<HTMLButtonElement>(null);
  const nameFieldId = `garage-name-${vehicle.vin}`;
  const notesFieldId = `garage-notes-${vehicle.vin}`;

  const notes = draftNotes ?? vehicle.notes ?? '';

  const startRename = () => {
    setDraftName(displayName);
    setNameError(null);
    setRenaming(true);
  };

  const returnFocusToRenameButton = () => {
    window.requestAnimationFrame(() => renameButtonRef.current?.focus());
  };

  const cancelRename = () => {
    setNameError(null);
    setRenaming(false);
    returnFocusToRenameButton();
  };

  const saveRename = (event: FormEvent) => {
    event.preventDefault();
    if (!renameGarageVehicle(vehicle.vin, draftName)) {
      // Keep the form open so the draft is not lost.
      setNameError(GARAGE_WRITE_FAILED_MESSAGE);
      return;
    }
    setNameError(null);
    setRenaming(false);
    returnFocusToRenameButton();
  };

  const saveNotes = () => {
    if (draftNotes === null) return;
    if (draftNotes === (vehicle.notes ?? '')) {
      setDraftNotes(null);
      return;
    }
    if (updateGarageVehicleNotes(vehicle.vin, draftNotes)) {
      setDraftNotes(null);
      setNotesSaved(true);
      setNotesError(null);
      return;
    }
    setNotesSaved(false);
    setNotesError(GARAGE_WRITE_FAILED_MESSAGE);
  };

  return (
    <article className={`card ${styles.garageCard}`}>
      <div className={styles.garageCardHeader}>
        <div>
          <p className="eyebrow">Saved vehicle</p>
          <h2 className={styles.garageName}>{displayName}</h2>
        </div>
        <button
          ref={renameButtonRef}
          type="button"
          className={`btn btn-ghost ${styles.smallButton}`}
          onClick={startRename}
          aria-expanded={renaming}
        >
          <Pencil size={13} /> Rename vehicle
        </button>
      </div>
      <p className={styles.garageVin}>{vehicle.vin}</p>
      <p className={styles.partMeta}>
        {[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')}
        {vehicle.engine ? ` · ${vehicle.engine}` : ''}
      </p>

      {renaming && (
        <form className={styles.garageForm} onSubmit={saveRename}>
          <label className={styles.garageFieldLabel} htmlFor={nameFieldId}>
            Vehicle name
          </label>
          <input
            id={nameFieldId}
            className="input"
            value={draftName}
            onChange={event => setDraftName(event.target.value)}
            onFocus={event => event.currentTarget.select()}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelRename();
              }
            }}
            maxLength={80}
            placeholder={defaultName}
            autoComplete="off"
            autoFocus
          />
          <p className={styles.partMeta}>Leave blank to use “{defaultName}”.</p>
          {nameError && (
            <p className={styles.garageSaveError} role="alert">
              {nameError}
            </p>
          )}
          <div className={styles.pageActions}>
            <button type="submit" className={`btn btn-primary ${styles.smallButton}`}>
              Save name
            </button>
            <button
              type="button"
              className={`btn btn-ghost ${styles.smallButton}`}
              onClick={cancelRename}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className={styles.garageForm}>
        <label className={styles.garageFieldLabel} htmlFor={notesFieldId}>
          Notes
        </label>
        <textarea
          id={notesFieldId}
          className={`input ${styles.garageNotes}`}
          aria-label={`Notes for ${displayName}`}
          value={notes}
          onChange={event => {
            setDraftNotes(event.target.value);
            setNotesSaved(false);
          }}
          onBlur={saveNotes}
          rows={3}
          maxLength={GARAGE_NOTES_MAX_LENGTH}
          placeholder="Free notes — service history, parts to price, dealer quotes…"
        />
        <div className={styles.garageNotesFooter}>
          <span className={styles.partMeta}>Stored in this browser only.</span>
          <button
            type="button"
            className={`btn btn-ghost ${styles.smallButton}`}
            onClick={saveNotes}
          >
            Save notes
          </button>
        </div>
        <p className={styles.partMeta} role="status">
          {notesSaved ? 'Notes saved.' : ''}
        </p>
        {notesError && (
          <p className={styles.garageSaveError} role="alert">
            {notesError}
          </p>
        )}
      </div>

      <p className={styles.provenance}>
        Saved {new Date(vehicle.savedAt).toLocaleDateString()}
      </p>
      <div className={styles.pageActions}>
        {catalogPath ? (
          <Link to={catalogPath} className={`btn btn-primary ${styles.smallButton}`}>
            <ExternalLink size={13} /> Browse matching parts
          </Link>
        ) : (
          <Link
            to={`/vin?vin=${vehicle.vin}`}
            className={`btn btn-ghost ${styles.smallButton}`}
          >
            <ExternalLink size={13} /> Reopen VIN
          </Link>
        )}
        <Link
          to={`/vin?vin=${vehicle.vin}`}
          className={`btn btn-ghost ${styles.smallButton}`}
        >
          VIN details
        </Link>
        <Link
          to={`/vin?vin=${vehicle.vin}`}
          className={`btn btn-ghost ${styles.smallButton}`}
        >
          <BellRing size={13} /> Watch recalls
        </Link>
        <button
          type="button"
          className={`btn btn-ghost ${styles.smallButton}`}
          onClick={() => {
            if (!removeVehicle(vehicle.vin)) {
              setRemoveError(GARAGE_WRITE_FAILED_MESSAGE);
            }
          }}
          aria-label={`Remove ${displayName} from My Garage`}
        >
          <Trash2 size={13} /> Remove
        </button>
      </div>
      {removeError && (
        <p className={styles.garageSaveError} role="alert">
          {removeError}
        </p>
      )}
    </article>
  );
}

export default function GaragePage() {
  const [vehicles, setVehicles] = useState<GarageVehicle[]>(() => getGarageVehicles());

  usePageMetadata(
    'My Garage — AutoParts',
    'Save vehicles locally in your browser, reopen their VIN results, and jump back into the parts catalog. No account required.',
    {
      canonicalPath: '/garage',
      noindex: true,
      jsonLd: {
        '@type': 'WebPage',
        name: 'My Garage',
        description: 'Locally saved vehicles with no account required.',
      },
    },
  );

  useEffect(() => {
    const refresh = () => setVehicles(getGarageVehicles());
    window.addEventListener(garageChangedEvent(), refresh);
    return () => window.removeEventListener(garageChangedEvent(), refresh);
  }, []);

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.heroMeta}>
            <p className="eyebrow">Local workspace</p>
            <h1 className={styles.title}>My Garage</h1>
            <p className={styles.subtitle}>
              Vehicles saved here stay in this browser only — no account or server is connected.
              Reopen a VIN result, start a recall watch, back the list up to a file, or move it to
              another browser with a transfer code below.
            </p>
          </div>
          <div className={styles.pageActions}>
            <Link to="/recall-center" className="btn btn-ghost">
              <BellRing size={15} /> Recall Watch
            </Link>
            <Link to="/vin" className="btn btn-primary">
              <Car size={15} /> Decode another VIN
            </Link>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <div className={`card ${styles.empty}`}>
            <Bookmark size={34} />
            <h2 className={styles.h2}>No saved vehicles yet</h2>
            <p className={styles.provenance}>
              Decode a VIN and choose <strong>Save to My Garage</strong>. The next time you need the
              part, the VIN and vehicle context are already here.
            </p>
            <Link to="/vin" className="btn btn-ghost">Decode a VIN</Link>
          </div>
        ) : (
          <div className={styles.garageGrid}>
            {vehicles.map(vehicle => (
              <GarageVehicleCard
                key={vehicle.vin}
                vehicle={vehicle}
                catalogPath={catalogPathForSaved(vehicle)}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 'var(--space-6)' }}>
          <GarageBackupPanel />
        </div>

        <div style={{ marginTop: 'var(--space-6)' }}>
          <GarageTransferPanel />
        </div>

        <div className={styles.notice} style={{ marginTop: 'var(--space-6)', marginBottom: 0 }}>
          <span>
            My Garage is stored in <span className="mono">localStorage</span>. Clearing site data or
            using a private browser window removes it. The matching catalog path is available for{' '}
            {CATALOG_VEHICLES.map(getVehicleLabel).join(', ')}.
          </span>
        </div>
      </div>
    </div>
  );
}
