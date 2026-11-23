import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ShieldQuestion } from 'lucide-react';
import { getPartPath, resolveFitmentConflict } from '../../services/parts';
import type { CatalogPartWithContext, VehicleCatalog } from '../../types';
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

  return (
    <section className={`card ${styles.panel}`} style={{ marginTop: 'var(--space-5)' }} aria-labelledby="fitment-support-title">
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Fitment resolution</p>
          <h2 id="fitment-support-title" className={styles.panelTitle}>
            Not sure this part fits?
          </h2>
        </div>
        <span className="badge badge-amber">Catalog check</span>
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

      <p className={styles.panelMeta} style={{ marginTop: 'var(--space-4)' }}>
        This explains the catalog rules for {part.name}. It is not a guarantee of fitment; confirm
        the exact part number with a dealer using the VIN or engine/trim combination.
      </p>
    </section>
  );
}
