import { Link } from 'react-router-dom';
import { ArrowLeft, CircleHelp, Layers } from 'lucide-react';
import DemandCapture from '../components/ui/DemandCapture';
import type { Brand, VehicleModel } from '../types';
import styles from '../styles/parts.module.css';

interface UncoveredVehiclePageProps {
  brand: Brand;
  model: VehicleModel;
  year: string;
  vin: string | null;
}

export default function UncoveredVehiclePage({
  brand,
  model,
  year,
  vin,
}: UncoveredVehiclePageProps) {
  const vehicleLabel = `${year} ${brand.name} ${model.name}`;

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.breadcrumbs}>
          <Link to="/catalog" className={styles.breadcrumbLink}>
            <ArrowLeft size={13} /> Catalog
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link to={`/catalog/${brand.slug}`} className={styles.breadcrumbLink}>
            {brand.name}
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{vehicleLabel}</span>
        </div>

        <div className={styles.hero}>
          <div className={styles.heroMeta}>
            <p className="eyebrow">Coverage preview · Not yet published</p>
            <h1 className={styles.title}>{vehicleLabel} Parts</h1>
            <p className={styles.subtitle}>
              We do not have a published parts catalog for this vehicle yet. Rather than show
              placeholder parts or promise fitment, we can record what you need so this coverage
              can be prioritized.
            </p>
            <div className={styles.badgeRow}>
              <span className="badge badge-amber">Parts not published</span>
              <span className="badge badge-ice">VIN decoding still live</span>
              {vin && <span className="badge badge-ice">VIN context preserved</span>}
            </div>
            {model.engines.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <p className={styles.subtitle}>
                  Cataloged engine options across {model.years[0]}–{model.years[model.years.length - 1]}
                </p>
                <div className={styles.badgeRow} style={{ marginTop: 'var(--space-2)' }}>
                  {model.engines.map(engine => (
                    <span key={engine} className="badge badge-ice">{engine}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.notice} role="note">
          <CircleHelp size={17} aria-hidden="true" />
          <span>
            No parts are listed for this vehicle. The request below is a coverage signal only; it
            does not reserve stock, confirm fitment, or guarantee that parts will be added.
          </span>
        </div>

        <div style={{ marginTop: 'var(--space-6)' }}>
          <DemandCapture
            context={`uncovered-vehicle-${brand.slug}-${model.slug}-${year}`}
            defaultVin={vin || ''}
            defaultYear={year}
            defaultMake={brand.name}
            defaultModel={model.name}
          />
        </div>

        <div style={{ marginTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Link to={`/catalog/${brand.slug}`} className="btn btn-ghost">
            <Layers size={14} /> Back to {brand.name} lineup
          </Link>
          <Link to="/vin" className="btn btn-ghost">
            Decode a VIN
          </Link>
        </div>
      </div>
    </div>
  );
}
