import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Printer, ShieldAlert } from 'lucide-react';
import { breadcrumbJsonLd, usePageMetadata } from '../hooks/usePageMetadata';
import {
  getAssembly,
  getCatalogVehicle,
  getPartPath,
  getVehicleLabel,
  getVehiclePath,
} from '../services/parts';
import { trackEvent } from '../services/telemetry';
import PartList from '../components/ui/PartList';
import PartsDiagram from '../components/ui/PartsDiagram';
import ShareButton from '../components/ui/ShareButton';
import NotFoundPage from './NotFoundPage';
import styles from '../styles/parts.module.css';

export default function AssemblyPage() {
  const { brandSlug, modelSlug, year, assemblySlug } = useParams<{
    brandSlug: string;
    modelSlug: string;
    year: string;
    assemblySlug: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const vehicle = getCatalogVehicle(brandSlug, modelSlug, year);
  const assembly = getAssembly(brandSlug, modelSlug, year, assemblySlug);
  const vin = searchParams.get('vin');
  const engine = searchParams.get('engine') || '';
  const trim = searchParams.get('trim') || '';

  const title = vehicle && assembly
    ? `${getVehicleLabel(vehicle)} ${assembly.name} Parts — AutoParts`
    : 'Assembly Parts — AutoParts';
  const description = vehicle && assembly
    ? `${assembly.parts.length} representative ${getVehicleLabel(vehicle)} ${assembly.name.toLowerCase()} parts with OEM/reference numbers, fitment notes, and supersession references.`
    : 'Browse an assembly and its parts.';

  const jsonLd = vehicle && assembly
    ? [
        breadcrumbJsonLd([
          { name: 'Catalog', path: '/catalog' },
          { name: vehicle.catalog.brand, path: `/catalog/${vehicle.catalog.brandSlug}` },
          { name: getVehicleLabel(vehicle), path: getVehiclePath(vehicle) },
          { name: assembly.name, path: `${getVehiclePath(vehicle)}/${assembly.slug}` },
        ]),
        {
          '@type': 'ItemList',
          name: title,
          numberOfItems: assembly.parts.length,
          itemListElement: assembly.parts.map((part, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: part.name,
          })),
        },
      ]
    : undefined;

  usePageMetadata(title, description, {
    canonicalPath: vehicle && assembly ? `${getVehiclePath(vehicle)}/${assembly.slug}` : undefined,
    jsonLd,
  });

  useEffect(() => {
    if (vehicle && assembly) {
      trackEvent('assembly_view', {
        vehicle: getVehicleLabel(vehicle),
        assembly: assembly.slug,
        parts: assembly.parts.length,
      });
    }
  }, [vehicle, assembly]);

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

  if (!vehicle || !assembly) return <NotFoundPage />;

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
            {getVehicleLabel(vehicle)}
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{assembly.name}</span>
        </div>

        <div className={styles.hero}>
          <div className={styles.heroMeta}>
            <p className="eyebrow">{getVehicleLabel(vehicle)} · Assembly</p>
            <h1 className={styles.title}>{assembly.name}</h1>
            <p className={styles.subtitle}>{assembly.summary}</p>
            <div className={styles.badgeRow}>
              <span className="badge badge-amber">{assembly.parts.length} parts</span>
              <span className="badge badge-ice">Exploded diagram</span>
              <span className="badge badge-success">OEM references</span>
            </div>
          </div>
          <div className={styles.pageActions}>
            <button
              type="button"
              className={`btn btn-ghost ${styles.noPrint}`}
              onClick={() => {
                trackEvent('assembly_print', { assembly: assembly.slug });
                window.print();
              }}
            >
              <Printer size={15} /> Print assembly
            </button>
            <ShareButton className={`btn btn-ghost ${styles.noPrint}`} label="Share assembly" />
          </div>
        </div>

        <div className={styles.notice} role="note">
          <ShieldAlert size={17} aria-hidden="true" />
          <span>{vehicle.catalog.disclaimer}</span>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.toolbarField}>
            <span className={styles.toolbarLabel}>Engine for fitment badges</span>
            <select className={styles.select} value={engine} onChange={event => setParam('engine', event.target.value)}>
              <option value="">All engines</option>
              {vehicle.catalog.engineOptions.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className={styles.toolbarField}>
            <span className={styles.toolbarLabel}>Trim for fitment badges</span>
            <select className={styles.select} value={trim} onChange={event => setParam('trim', event.target.value)}>
              <option value="">All trims</option>
              {vehicle.catalog.trimOptions.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
          <span className={styles.sectionMeta}>
            Change the vehicle context on the{' '}
            <Link to={getVehiclePath(vehicle, vin)} style={{ color: 'var(--amber)' }}>
              model-year page
            </Link>
            .
          </span>
        </div>

        <PartsDiagram
          parts={assembly.parts}
          hrefForPart={partSlug => getPartPath(vehicle, assembly.slug, partSlug, vin)}
          label={assembly.diagramLabel}
          vehicleLabel={getVehicleLabel(vehicle)}
        />

        <section className={styles.section} aria-labelledby="assembly-parts-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className="eyebrow">Assembly → part</p>
              <h2 id="assembly-parts-title" className={styles.h2}>{assembly.parts.length} parts in {assembly.name}</h2>
            </div>
            <span className={styles.sectionMeta}>
              <Link to={getVehiclePath(vehicle, vin)} style={{ color: 'var(--amber)' }}>
                All assemblies <ChevronRight size={12} />
              </Link>
            </span>
          </div>
          <PartList
            parts={assembly.parts}
            hrefForPart={part => getPartPath(vehicle, assembly.slug, part.slug, vin)}
            engine={engine}
            trim={trim}
            hasVin={Boolean(vin)}
            vehicleLabel={getVehicleLabel(vehicle)}
          />
        </section>

        <div className={styles.notice} style={{ marginTop: 'var(--space-6)', marginBottom: 0 }}>
          <ShieldAlert size={17} aria-hidden="true" />
          <span>
            The diagram is a representative schematic, not an OEM drawing. Verify part numbers and
            fitment with an authorized {vehicle.catalog.brand} dealer before ordering.
          </span>
        </div>
      </div>
    </div>
  );
}
