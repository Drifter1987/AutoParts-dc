import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronRight,
  CircleHelp,
  Printer,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { usePageMetadata, breadcrumbJsonLd } from '../hooks/usePageMetadata';
import brandsData from '../data/brands.json';
import UncoveredVehiclePage from './UncoveredVehiclePage';
import {
  getAssemblyPath,
  getCatalogVehicle,
  getPartCount,
  getPartPath,
  getVehicleLabel,
  getVehiclePath,
  searchParts,
} from '../services/parts';
import { trackEvent } from '../services/telemetry';
import PartList from '../components/ui/PartList';
import ShareButton from '../components/ui/ShareButton';
import NotFoundPage from './NotFoundPage';
import type { BrandsResponse } from '../types';
import styles from '../styles/parts.module.css';

export default function ModelYearPage() {
  const { brandSlug, modelSlug, year } = useParams<{
    brandSlug: string;
    modelSlug: string;
    year: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const vehicle = getCatalogVehicle(brandSlug, modelSlug, year);
  const previewBrand = (brandsData as BrandsResponse).brands.find(brand => brand.slug === brandSlug);
  const previewModel = previewBrand?.models.find(model => model.slug === modelSlug);
  const requestedYear =
    year && /^\d{4}$/.test(year)
      ? year
      : previewModel?.years.length
        ? String(Math.max(...previewModel.years))
        : '';
  const uncoveredLabel =
    previewBrand && previewModel && requestedYear
      ? `${requestedYear} ${previewBrand.name} ${previewModel.name}`
      : '';

  const vin = searchParams.get('vin');
  const engine = searchParams.get('engine') || '';
  const trim = searchParams.get('trim') || '';
  const query = searchParams.get('q') || '';

  const vehicleLabel = vehicle ? getVehicleLabel(vehicle) : uncoveredLabel || 'Vehicle Catalog';
  const title = vehicle
    ? `${vehicleLabel} Parts — AutoParts`
    : uncoveredLabel
      ? `${uncoveredLabel} Parts Coverage — AutoParts`
      : 'Vehicle Parts — AutoParts';
  const description = vehicle
    ? `Browse representative ${vehicleLabel} assemblies and ${getPartCount(vehicle)} OEM-reference parts. Check fitment, copy part numbers, and verify with a dealer.`
    : uncoveredLabel
      ? `Parts coverage for the ${uncoveredLabel} is not published yet. Share a VIN or year, make, model, and the part you need to help prioritize coverage.`
      : 'Browse vehicle assemblies and parts.';

  const jsonLd = vehicle
    ? [
        breadcrumbJsonLd([
          { name: 'Catalog', path: '/catalog' },
          { name: vehicle.catalog.brand, path: `/catalog/${vehicle.catalog.brandSlug}` },
          { name: vehicleLabel, path: getVehiclePath(vehicle) },
        ]),
        {
          '@type': 'CollectionPage',
          name: title,
          description,
          about: {
            '@type': 'Vehicle',
            name: vehicleLabel,
            brand: { '@type': 'Brand', name: vehicle.catalog.brand },
            model: vehicle.catalog.model,
            vehicleModelDate: String(vehicle.catalog.year),
          },
          hasPart: vehicle.assemblies.flatMap(assembly =>
            assembly.parts.map(part => ({
              '@type': 'Product',
              name: part.name,
              sku: part.oemNumber,
              category: assembly.name,
            })),
          ),
        },
      ]
    : undefined;

  usePageMetadata(title, description, {
    canonicalPath: vehicle ? getVehiclePath(vehicle) : undefined,
    noindex: !vehicle,
    jsonLd,
  });

  useEffect(() => {
    if (vehicle) {
      trackEvent('catalog_model_view', {
        vehicle: vehicleLabel,
        vin: vin || undefined,
        assemblies: vehicle.assemblies.length,
      });
    }
  }, [vehicle, vehicleLabel, vin]);

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

  if (!vehicle) {
    if (!previewBrand || !previewModel) return <NotFoundPage />;
    return (
      <UncoveredVehiclePage
        brand={previewBrand}
        model={previewModel}
        year={requestedYear}
        vin={vin}
      />
    );
  }

  const parts = vehicle.assemblies.flatMap(assembly =>
    assembly.parts.map(part => ({
      ...part,
      assemblyName: assembly.name,
      assemblySlug: assembly.slug,
    })),
  );
  const searchResults = query
    ? searchParts(query).filter(result =>
        vehicle.assemblies.some(
          assembly =>
            assembly.slug === result.assemblySlug &&
            assembly.parts.some(part => part.slug === result.slug),
        ),
      )
    : [];

  const hrefForPart = (part: { slug: string; assemblySlug?: string }) =>
    getPartPath(vehicle, part.assemblySlug || 'engine', part.slug, vin);

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.breadcrumbs}>
          <Link to="/catalog" className={styles.breadcrumbLink}>
            <ArrowLeft size={13} /> Catalog
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link to={`/catalog/${vehicle.catalog.brandSlug}`} className={styles.breadcrumbLink}>
            {vehicle.catalog.brand}
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{vehicleLabel}</span>
        </div>

        <div className={styles.hero}>
          <div className={styles.heroMeta}>
            <p className="eyebrow">Representative parts catalog</p>
            <h1 className={styles.title}>{vehicleLabel} Parts</h1>
            <p className={styles.subtitle}>
              A vertical slice of the AutoParts catalog: {vehicle.assemblies.length} assemblies and{' '}
              {parts.length} OEM-reference parts with fitment notes and provenance. This is the
              product pattern we will scale across the catalog.
            </p>
            <div className={styles.badgeRow}>
              <span className="badge badge-amber">{vehicle.catalog.generation}</span>
              <span className="badge badge-ice">{vehicle.catalog.market} market</span>
              <span className="badge badge-success">VIN-ready fitment</span>
              {vin && <span className="badge badge-ice">VIN context preserved</span>}
            </div>
          </div>
          <div className={styles.pageActions}>
            <button
              type="button"
              className={`btn btn-ghost ${styles.noPrint}`}
              onClick={() => {
                trackEvent('parts_sheet_print', { vehicle: vehicleLabel });
                window.print();
              }}
            >
              <Printer size={15} /> Print parts sheet
            </button>
            <ShareButton className={`btn btn-ghost ${styles.noPrint}`} label="Share this catalog" />
            <Link to="/vin" className={`btn btn-primary ${styles.noPrint}`}>
              <Wrench size={15} /> Change vehicle
            </Link>
          </div>
        </div>

        <div className={styles.notice} role="note">
          <ShieldAlert size={17} aria-hidden="true" />
          <span>{vehicle.catalog.disclaimer}</span>
        </div>

        {vin && (
          <div className={`${styles.notice} ${styles.noticeInfo}`} role="status">
            <CircleHelp size={17} aria-hidden="true" />
            <span>
              You arrived with VIN <strong className="mono">{vin}</strong>. The VIN selects this
              year/make/model; confirm engine and trim below for a stronger fitment signal.
            </span>
          </div>
        )}

        <div className={styles.toolbar}>
          <label className={styles.toolbarField}>
            <span className={styles.toolbarLabel}>Search this vehicle</span>
            <span style={{ position: 'relative' }}>
              <Search
                size={15}
                aria-hidden="true"
                style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }}
              />
              <input
                className={styles.searchInput}
                style={{ paddingLeft: 34 }}
                placeholder="OEM number, part name, or alias…"
                value={query}
                onChange={event => setParam('q', event.target.value)}
                aria-label="Search this vehicle by OEM number or part name"
              />
            </span>
          </label>
          <label className={styles.toolbarField}>
            <span className={styles.toolbarLabel}>Engine</span>
            <select
              className={styles.select}
              value={engine}
              onChange={event => setParam('engine', event.target.value)}
              aria-label="Filter fitment by engine"
            >
              <option value="">All engines</option>
              {vehicle.catalog.engineOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className={styles.toolbarField}>
            <span className={styles.toolbarLabel}>Trim</span>
            <select
              className={styles.select}
              value={trim}
              onChange={event => setParam('trim', event.target.value)}
              aria-label="Filter fitment by trim"
            >
              <option value="">All trims</option>
              {vehicle.catalog.trimOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.fitmentBar} aria-live="polite">
          <span>
            Fitment signal: <strong>{engine || 'engine not selected'}</strong> ·{' '}
            <strong>{trim || 'trim not selected'}</strong>
          </span>
          <span>
            {engine || trim
              ? 'The badge on each part reflects this selection.'
              : 'Select an engine and trim to replace “Verify fitment” badges with a stronger signal.'}
          </span>
        </div>

        {query && (
          <section className={styles.section} aria-labelledby="model-search-results">
            <div className={styles.sectionHeader}>
              <div>
                <p className="eyebrow">Search results</p>
                <h2 id="model-search-results" className={styles.h2}>
                  {searchResults.length} part{searchResults.length === 1 ? '' : 's'} for “{query}”
                </h2>
              </div>
              <button
                type="button"
                className={`btn btn-ghost ${styles.smallButton} ${styles.noPrint}`}
                onClick={() => setParam('q', '')}
              >
                Clear search
              </button>
            </div>
            {searchResults.length > 0 ? (
              <PartList
                parts={searchResults}
                hrefForPart={hrefForPart}
                engine={engine}
                trim={trim}
                hasVin={Boolean(vin)}
                vehicleLabel={vehicleLabel}
              />
            ) : (
              <div className={styles.empty}>
                <Search size={28} />
                <p>No parts in this vehicle match “{query}”.</p>
                <p className={styles.provenance}>
                  Try an OEM number such as <span className="mono">45022-TBA-A00</span>, or search
                  by a common name such as “brake pads”.
                </p>
              </div>
            )}
          </section>
        )}

        <section className={styles.section} aria-labelledby="assemblies-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className="eyebrow">Assembly navigation</p>
              <h2 id="assemblies-title" className={styles.h2}>Shop by assembly</h2>
            </div>
            <span className={styles.sectionMeta}>
              {vehicle.assemblies.length} assemblies · {parts.length} parts
            </span>
          </div>
          <div className={styles.assemblyGrid}>
            {vehicle.assemblies.map((assembly, index) => (
              <Link
                key={assembly.slug}
                to={getAssemblyPath(vehicle, assembly.slug, vin)}
                className={`card ${styles.assemblyCard}`}
              >
                <span className={styles.assemblyNumber}>
                  {String(index + 1).padStart(2, '0')} / {assembly.parts.length} parts
                </span>
                <span className={styles.assemblyName}>{assembly.name}</span>
                <span className={styles.assemblySummary}>{assembly.summary}</span>
                <span className={styles.assemblyFooter}>
                  <span>Open assembly</span>
                  <ChevronRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="all-parts-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className="eyebrow">Full slice</p>
              <h2 id="all-parts-title" className={styles.h2}>All {parts.length} parts</h2>
            </div>
            <span className={styles.sectionMeta}>OEM/reference numbers shown</span>
          </div>
          <PartList
            parts={parts}
            hrefForPart={part =>
              getPartPath(
                vehicle,
                part.assemblySlug || 'engine',
                part.slug,
                vin,
              )
            }
            engine={engine}
            trim={trim}
            hasVin={Boolean(vin)}
            vehicleLabel={vehicleLabel}
          />
        </section>

        <div className={styles.section}>
          <div className={styles.notice} style={{ marginBottom: 0 }}>
            <CircleHelp size={17} aria-hidden="true" />
            <span>
              Fitment is not a guarantee. {vehicle.catalog.source} · Last updated{' '}
              <span className="mono">{vehicle.catalog.lastUpdated}</span> · Confidence:{' '}
              <strong>{vehicle.catalog.confidence}</strong>. Always verify with an authorized
              {vehicle.catalog.brand} dealer before ordering.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
