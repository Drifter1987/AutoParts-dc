import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, CircleHelp, ExternalLink, Printer, ShieldAlert } from 'lucide-react';
import { breadcrumbJsonLd, usePageMetadata } from '../hooks/usePageMetadata';
import {
  checkFitment,
  fitmentSummary,
  getAssemblyPath,
  getCatalogVehicle,
  getPart,
  getPartPath,
  getVehicleLabel,
  getVehiclePath,
} from '../services/parts';
import { trackEvent } from '../services/telemetry';
import CopyButton from '../components/ui/CopyButton';
import FitmentSupport from '../components/ui/FitmentSupport';
import ShareButton from '../components/ui/ShareButton';
import NotFoundPage from './NotFoundPage';
import styles from '../styles/parts.module.css';

export default function PartPage() {
  const { brandSlug, modelSlug, year, assemblySlug, partSlug } = useParams<{
    brandSlug: string;
    modelSlug: string;
    year: string;
    assemblySlug: string;
    partSlug: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const vehicle = getCatalogVehicle(brandSlug, modelSlug, year);
  const part = getPart(brandSlug, modelSlug, year, assemblySlug, partSlug);
  const vin = searchParams.get('vin');
  const engine = searchParams.get('engine') || '';
  const trim = searchParams.get('trim') || '';

  const vehicleLabel = vehicle ? getVehicleLabel(vehicle) : 'Vehicle';
  const title = part
    ? `${part.name} — ${vehicleLabel} — AutoParts`
    : 'Part Details — AutoParts';
  const description = part
    ? `${part.name} (OEM ${part.oemNumber}) for ${vehicleLabel}. Fitment notes, supersessions, interchange references, and provenance. Verify fitment with a dealer.`
    : 'View a part number, fitment, and reference data.';

  const jsonLd = part && vehicle
    ? [
        breadcrumbJsonLd([
          { name: 'Catalog', path: '/catalog' },
          { name: vehicle.catalog.brand, path: `/catalog/${vehicle.catalog.brandSlug}` },
          { name: vehicleLabel, path: getVehiclePath(vehicle) },
          { name: part.assemblyName, path: `${getVehiclePath(vehicle)}/${part.assemblySlug}` },
          { name: part.name, path: getPartPath(vehicle, part.assemblySlug, part.slug) },
        ]),
        {
          '@type': 'Product',
          name: part.name,
          sku: part.oemNumber,
          description: part.fitmentNotes,
          category: part.assemblyName,
          brand: { '@type': 'Brand', name: vehicle.catalog.brand },
          additionalProperty: [
            { '@type': 'PropertyValue', name: 'Fitment confidence', value: part.confidence },
            { '@type': 'PropertyValue', name: 'Catalog source', value: part.source },
            { '@type': 'PropertyValue', name: 'Last updated', value: part.lastUpdated },
          ],
        },
      ]
    : undefined;

  usePageMetadata(title, description, {
    canonicalPath:
      vehicle && part ? getPartPath(vehicle, part.assemblySlug, part.slug) : undefined,
    type: 'product',
    jsonLd,
  });

  useEffect(() => {
    if (part && vehicle) {
      trackEvent('part_view', {
        vehicle: vehicleLabel,
        part: part.slug,
        oemNumber: part.oemNumber,
        assembly: part.assemblySlug,
      });
    }
  }, [part, vehicle, vehicleLabel]);

  const setParam = (key: string, value: string) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  if (!vehicle || !part) return <NotFoundPage />;

  const fitment = checkFitment(part, engine, trim, Boolean(vin), vehicleLabel);
  const fitmentTone =
    fitment.tone === 'success'
      ? styles.fitmentSuccess
      : fitment.tone === 'error'
        ? styles.fitmentError
        : styles.fitmentWarning;
  const relatedParts = vehicle.assemblies
    .find(assembly => assembly.slug === part.assemblySlug)
    ?.parts.filter(item => item.slug !== part.slug)
    .slice(0, 3) ?? [];

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.breadcrumbs}>
          <Link to="/catalog" className={styles.breadcrumbLink}><ArrowLeft size={13} /> Catalog</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link to={`/catalog/${vehicle.catalog.brandSlug}`} className={styles.breadcrumbLink}>
            {vehicle.catalog.brand}
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link to={getVehiclePath(vehicle, vin)} className={styles.breadcrumbLink}>
            {vehicleLabel}
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link to={getAssemblyPath(vehicle, part.assemblySlug, vin)} className={styles.breadcrumbLink}>
            {part.assemblyName}
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{part.name}</span>
        </div>

        <div className={styles.hero}>
          <div className={styles.heroMeta}>
            <p className="eyebrow">{part.assemblyName} · {vehicleLabel}</p>
            <h1 className={styles.title}>{part.name}</h1>
            <div className={styles.partNumber} style={{ fontSize: '0.9rem' }}>
              OEM/reference <strong>{part.oemNumber}</strong>
              <CopyButton
                value={part.oemNumber}
                label="OEM number"
                className={`btn btn-ghost ${styles.smallButton} ${styles.noPrint}`}
              />
            </div>
            <div className={styles.badgeRow}>
              <span className="badge badge-amber">Representative catalog · {part.confidence} confidence</span>
              <span className="badge badge-ice">{part.fitment.engines.join(' / ')}</span>
              {vin && <span className="badge badge-success">VIN context: {vin}</span>}
            </div>
          </div>
          <div className={styles.pageActions}>
            <button
              type="button"
              className={`btn btn-ghost ${styles.noPrint}`}
              onClick={() => {
                trackEvent('part_print', { part: part.slug });
                window.print();
              }}
            >
              <Printer size={15} /> Print part
            </button>
            <ShareButton className={`btn btn-ghost ${styles.noPrint}`} label="Share part" />
          </div>
        </div>

        <div className={`${styles.fitmentCard} ${fitmentTone}`} aria-live="polite">
          <ShieldAlert size={17} aria-hidden="true" />
          <div>
            <strong>{fitment.label}</strong>
            <p className={styles.fitmentText}>{fitment.detail}</p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.toolbarField}>
            <span className={styles.toolbarLabel}>Check engine fitment</span>
            <select
              className={styles.select}
              value={engine}
              onChange={event => setParam('engine', event.target.value)}
              aria-label="Check fitment by engine"
            >
              <option value="">All engines</option>
              {vehicle.catalog.engineOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className={styles.toolbarField}>
            <span className={styles.toolbarLabel}>Check trim fitment</span>
            <select
              className={styles.select}
              value={trim}
              onChange={event => setParam('trim', event.target.value)}
              aria-label="Check fitment by trim"
            >
              <option value="">All trims</option>
              {vehicle.catalog.trimOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <span className={styles.sectionMeta}>
            {vin ? 'VIN context is preserved as you navigate.' : 'Select the vehicle configuration to check fitment.'}
          </span>
        </div>

        <FitmentSupport
          part={part}
          vehicle={vehicle}
          engine={engine}
          trim={trim}
          vin={vin}
        />

        <div className={styles.detailGrid}>
          <div className={`card ${styles.detailCard}`}>
            <p className="eyebrow">Fitment & notes</p>
            <h2 className={styles.h2} style={{ marginBottom: 'var(--space-4)' }}>Will it fit?</h2>
            <div className={styles.sourceGrid}>
              <div>
                <p className={styles.detailLabel}>Fitment rules</p>
                <p className={styles.detailValue}>{fitmentSummary(part.fitment)}</p>
              </div>
              <div>
                <p className={styles.detailLabel}>Assembly</p>
                <p className={styles.detailValue}>
                  <Link to={getAssemblyPath(vehicle, part.assemblySlug, vin)} style={{ color: 'var(--amber)' }}>
                    {part.assemblyName}
                  </Link>
                </p>
              </div>
            </div>
            <div style={{ marginTop: 'var(--space-5)' }}>
              <p className={styles.detailLabel}>Fitment notes</p>
              <p className={styles.detailValue}>{part.fitmentNotes}</p>
            </div>
            <div className={`${styles.notice} ${styles.noticeInfo}`} style={{ margin: 'var(--space-5) 0 0' }}>
              <CircleHelp size={16} aria-hidden="true" />
              <span>
                Fitment confidence is a catalog signal, not a guarantee. Verify the part with your
                dealer using the VIN or the exact engine/trim combination.
              </span>
            </div>
          </div>

          <div className={`card ${styles.detailCard}`}>
            <p className="eyebrow">Reference data</p>
            <h2 className={styles.h2} style={{ marginBottom: 'var(--space-4)' }}>Numbers</h2>

            <p className={styles.detailLabel}>OEM number</p>
            <div className={styles.numberList} style={{ marginBottom: 'var(--space-4)' }}>
              <span className={styles.numberChip}>{part.oemNumber}</span>
            </div>

            <p className={styles.detailLabel}>Alternate numbers</p>
            <div className={styles.numberList} style={{ marginBottom: 'var(--space-4)' }}>
              {part.alternateNumbers.length ? part.alternateNumbers.map(number => (
                <span key={number} className={styles.numberChip}>{number}</span>
              )) : <span className={styles.provenance}>None listed.</span>}
            </div>

            <p className={styles.detailLabel}>Supersedes / superseded by</p>
            <div className={styles.numberList} style={{ marginBottom: 'var(--space-4)' }}>
              {part.supersedes.length ? part.supersedes.map(number => (
                <span key={number} className={styles.numberChip}>{number}</span>
              )) : <span className={styles.provenance}>No supersession listed.</span>}
            </div>

            <p className={styles.detailLabel}>Interchange references</p>
            <div className={styles.numberList}>
              {part.interchange.length ? part.interchange.map(number => (
                <span key={number} className={styles.numberChip}>{number}</span>
              )) : <span className={styles.provenance}>No interchange references listed.</span>}
            </div>
          </div>
        </div>

        <section className={`card ${styles.detailCard}`} style={{ marginTop: 'var(--space-5)' }} aria-labelledby="provenance-title">
          <p className="eyebrow">Provenance</p>
          <h2 id="provenance-title" className={styles.h2} style={{ marginBottom: 'var(--space-4)' }}>
            Where this record came from
          </h2>
          <div className={styles.sourceGrid}>
            <div>
              <p className={styles.detailLabel}>Source</p>
              <p className={styles.detailValue}>{part.source}</p>
            </div>
            <div>
              <p className={styles.detailLabel}>Catalog last updated</p>
              <p className={styles.detailValue}>{part.lastUpdated}</p>
            </div>
            <div>
              <p className={styles.detailLabel}>Record confidence</p>
              <p className={styles.detailValue}>{part.confidence}</p>
            </div>
            <div>
              <p className={styles.detailLabel}>Vehicle fitment scope</p>
              <p className={styles.detailValue}>{vehicleLabel} · {part.fitment.market} market</p>
            </div>
          </div>
          <p className={styles.provenance} style={{ marginTop: 'var(--space-4)' }}>
            This representative record is intentionally transparent about source and confidence.
            Production catalog data should come from a licensed OEM or supplier feed with the same
            fields and validation gates.
          </p>
        </section>

        <section className={styles.section} aria-labelledby="related-parts-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className="eyebrow">Same assembly</p>
              <h2 id="related-parts-title" className={styles.h2}>Related parts</h2>
            </div>
            <Link to={getAssemblyPath(vehicle, part.assemblySlug, vin)} className="btn btn-ghost">
              Back to {part.assemblyName} <ChevronRight size={14} />
            </Link>
          </div>
          <div className={styles.relatedGrid}>
            {relatedParts.map(related => (
              <Link
                key={related.slug}
                to={getPartPath(vehicle, part.assemblySlug, related.slug, vin)}
                className={`card ${styles.relatedCard}`}
              >
                <p className={styles.relatedName}>{related.name}</p>
                <p className={styles.relatedNumber}>{related.oemNumber}</p>
                <p className={styles.partMeta}>Open part <ExternalLink size={11} /></p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
