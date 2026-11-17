import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Car, ExternalLink, Trash2 } from 'lucide-react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { CATALOG_VEHICLES, getVehicleLabel, getVehiclePath } from '../services/parts';
import { garageChangedEvent, getGarageVehicles, removeVehicle } from '../services/garage';
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
              Vehicles saved here stay in this browser only — no account, no server, and no
              cross-device sync. Reopen a VIN result or go straight to the matching catalog.
            </p>
          </div>
          <div className={styles.pageActions}>
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
            {vehicles.map(vehicle => {
              const catalogPath = catalogPathForSaved(vehicle);
              return (
                <article key={vehicle.vin} className={`card ${styles.garageCard}`}>
                  <p className="eyebrow">Saved vehicle</p>
                  <h2 className={styles.garageName}>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                    {vehicle.trim ? ` ${vehicle.trim}` : ''}
                  </h2>
                  <p className={styles.garageVin}>{vehicle.vin}</p>
                  {vehicle.engine && <p className={styles.partMeta}>{vehicle.engine}</p>}
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
                    <button
                      type="button"
                      className={`btn btn-ghost ${styles.smallButton}`}
                      onClick={() => removeVehicle(vehicle.vin)}
                      aria-label={`Remove ${vehicle.year} ${vehicle.make} ${vehicle.model} from My Garage`}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

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
