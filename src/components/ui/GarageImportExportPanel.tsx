import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Download, FileText } from 'lucide-react';
import {
  GARAGE_MAX_VEHICLES,
  garageChangedEvent,
  getGarageVehicles,
} from '../../services/garage';
import GarageBackupPanel from './GarageBackupPanel';
import GarageFleetImportPanel from './GarageFleetImportPanel';
import styles from '../../styles/features.module.css';

type ImportExportTab = 'fleet' | 'backup';

const TABS: Array<{ id: ImportExportTab; label: string; icon: ReactNode }> = [
  { id: 'fleet', label: 'Fleet sheet', icon: <FileText size={15} /> },
  { id: 'backup', label: 'Backup file', icon: <Download size={15} /> },
];

export default function GarageImportExportPanel() {
  const [tab, setTab] = useState<ImportExportTab>('fleet');
  const [count, setCount] = useState(() => getGarageVehicles().length);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const refresh = () => setCount(getGarageVehicles().length);
    window.addEventListener(garageChangedEvent(), refresh);
    return () => window.removeEventListener(garageChangedEvent(), refresh);
  }, []);

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % TABS.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = TABS[nextIndex];
    setTab(next.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="garage-import-export-title">
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Garage data</p>
          <h2 id="garage-import-export-title" className={styles.panelTitle}>
            Import / export
          </h2>
        </div>
        <span className="badge badge-ice">
          {count} of {GARAGE_MAX_VEHICLES} garage spaces used
        </span>
      </div>

      <p className={styles.muted}>
        Import a fleet sheet or keep a backup file. Both are read and written in this browser only.
      </p>

      <div className={styles.tabs} role="tablist" aria-label="Garage import and export">
        {TABS.map((item, index) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              ref={node => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`garage-${item.id}-tab`}
              aria-selected={selected}
              aria-controls={`garage-${item.id}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`${styles.tab} ${selected ? styles.tabActive : ''}`}
              onClick={() => setTab(item.id)}
              onKeyDown={event => onTabKeyDown(event, index)}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        id="garage-fleet-panel"
        role="tabpanel"
        aria-labelledby="garage-fleet-tab"
        hidden={tab !== 'fleet'}
        className={styles.tabPanel}
      >
        <GarageFleetImportPanel />
      </div>
      <div
        id="garage-backup-panel"
        role="tabpanel"
        aria-labelledby="garage-backup-tab"
        hidden={tab !== 'backup'}
        className={styles.tabPanel}
      >
        <GarageBackupPanel />
      </div>
    </section>
  );
}
