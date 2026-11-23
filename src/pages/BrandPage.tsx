import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Layers, ChevronRight } from 'lucide-react';
import { catalogApi } from '../services/api';
import { usePageMetadata, breadcrumbJsonLd } from '../hooks/usePageMetadata';
import { CATALOG_VEHICLES, getPartCount, getVehiclePath } from '../services/parts';
import DemandCapture from '../components/ui/DemandCapture';
import RollingNumber from '../components/ui/RollingNumber';
import brandsSeed from '../data/brands.json';
import type { Brand, BrandsResponse, VehicleCatalog } from '../types';
import styles from './BrandPage.module.css';

const CATALOG_META = (brandsSeed as BrandsResponse).meta;

function findLiveVehicle(brandSlug: string, modelSlug: string): VehicleCatalog | undefined {
  return CATALOG_VEHICLES.find(
    vehicle =>
      vehicle.catalog.brandSlug === brandSlug && vehicle.catalog.modelSlug === modelSlug,
  );
}

export default function BrandPage() {
  const { brandSlug } = useParams<{ brandSlug: string }>();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!brandSlug) return;
    catalogApi.getBrands()
      .then(d => {
        const found = d.brands.find(b => b.slug === brandSlug);
        if (!found) setError(`Brand "${brandSlug}" not found.`);
        else setBrand(found);
      })
      .catch(() => setError('Failed to load brand data.'))
      .finally(() => setLoading(false));
  }, [brandSlug]);

  usePageMetadata(
    brand ? `${brand.name} Models & Parts — AutoParts` : 'Vehicle Brand — AutoParts',
    brand
      ? `Browse the ${brand.name} brand and model preview. Decode a ${brand.name} VIN to identify the exact trim, engine, and options; live parts data is called out on supported models.`
      : 'Browse a brand and model preview, then decode a VIN to identify your exact vehicle.',
    {
      canonicalPath: brand ? `/catalog/${brand.slug}` : undefined,
      jsonLd: brand
        ? [
            breadcrumbJsonLd([
              { name: 'Catalog', path: '/catalog' },
              { name: brand.name, path: `/catalog/${brand.slug}` },
            ]),
            {
              '@type': 'CollectionPage',
              name: `${brand.name} Models & Parts`,
              description: `Brand/model preview for ${brand.name}.`,
              about: { '@type': 'Brand', name: brand.name },
            },
          ]
        : undefined,
    },
  );

  if (loading) return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.loadingGrid}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`card ${styles.skeleton}`} />
          ))}
        </div>
      </div>
    </div>
  );

  if (error || !brand) return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.errorBox}>
          <p>{error || 'Brand not found.'}</p>
          <Link to="/catalog" className="btn btn-ghost">
            <ArrowLeft size={14} /> Back to Catalog
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <Link to="/catalog" className={styles.breadcrumbLink}>
            <ArrowLeft size={14} /> Catalog
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{brand.name}</span>
        </div>

        {/* Brand header */}
        <div className={styles.brandHeader}>
          <div className={styles.brandInitial}>{brand.name[0]}</div>
          <div>
            <p className="eyebrow">{brand.origin} Manufacturer</p>
            <h1 className={styles.brandName}>{brand.name}</h1>
            <p className={styles.brandMeta}>
              <RollingNumber value={brand.models.length} /> models in catalog metadata
            </p>
          </div>
        </div>

        {/* Phase notice */}
        <div className={styles.phaseNotice}>
          <Layers size={15} />
          <span>
            {brand.slug === 'honda' ? (
              <>
                This is a brand and model preview. The live parts vertical slice is the 2020 Civic
                — <Link to="/catalog/honda/civic/2020">browse the 36-part Civic catalog</Link>.
                Other Honda models and years still need parts data.
              </>
            ) : (
              <>
                This is a brand and model preview. Parts for {brand.name} are not published yet —
                the current parts slice covers the 2020 Civic. VIN decoding is live now —{' '}
                <Link to="/vin">try it here</Link>.
              </>
            )}
          </span>
        </div>

        <p className={styles.catalogNote}>
          Engine options are aggregated from EPA fuel-economy records across each model's
          production years. They show the configurations recorded for that model, not a claim that
          every engine was sold in every year. {CATALOG_META?.caveat}
        </p>

        {/* Models grid */}
        <div className={styles.sectionTitle}>
          <p className="eyebrow">Models in metadata</p>
          <h2 className={styles.h2}>{brand.name} Lineup</h2>
        </div>

        <div className={styles.modelGrid}>
          {brand.models.map(model => {
            const live = findLiveVehicle(brand.slug, model.slug);
            const previewYear = Math.max(...model.years);
            const previewPath = `/catalog/${brand.slug}/${model.slug}/${previewYear}`;
            const card = (
              <>
                <div className={styles.modelTop}>
                  <h3 className={styles.modelName}>{model.name}</h3>
                  {live ? (
                    <span className={styles.partsLive}>Parts live</span>
                  ) : (
                    <span className={styles.comingSoon}>No parts data</span>
                  )}
                </div>

                <div className={styles.yearRow}>
                  <Calendar size={13} />
                  <span>
                    {Math.min(...model.years)} – {Math.max(...model.years)}
                  </span>
                </div>

                <div className={styles.yearPills}>
                  {model.years.slice(-4).reverse().map(y => (
                    <span key={y} className={styles.yearPill}>{y}</span>
                  ))}
                  {model.years.length > 4 && (
                    <span className={`${styles.yearPill} ${styles.yearMore}`}>
                      +{model.years.length - 4}
                    </span>
                  )}
                </div>

                <div className={styles.engineBlock}>
                  <span className={styles.engineLabel}>
                    Engines · {model.engines.length}
                  </span>
                  <div className={styles.engineList}>
                    {model.engines.map(engine => (
                      <span key={engine} className={styles.enginePill}>{engine}</span>
                    ))}
                  </div>
                </div>

                <div className={styles.modelFooter}>
                  <span className={styles.modelFooterText}>
                    {live
                      ? `${getPartCount(live)} parts · ${live.catalog.year}`
                      : 'Parts not published · request coverage'}
                  </span>
                  <ChevronRight size={13} className={styles.arrow} />
                </div>
              </>
            );

            return live ? (
              <Link
                key={model.slug}
                to={getVehiclePath(live)}
                className={`card ${styles.modelCard}`}
                aria-label={`Browse ${live.catalog.year} ${live.catalog.brand} ${live.catalog.model} parts`}
              >
                {card}
              </Link>
            ) : (
              <Link
                key={model.slug}
                to={previewPath}
                className={`card ${styles.modelCard}`}
                aria-label={`View parts status for ${previewYear} ${brand.name} ${model.name}`}
              >
                {card}
              </Link>
            );
          })}
        </div>

        {/* VIN shortcut */}
        <div className={styles.vinCTA}>
          <div>
            <h3 className={styles.vinCTATitle}>Have a {brand.name}?</h3>
            <p className={styles.vinCTAText}>
              Decode your VIN to identify your exact configuration — engine, trim, and options.
            </p>
          </div>
          <Link to="/vin" className="btn btn-primary">
            Decode My VIN
          </Link>
        </div>

        <div style={{ marginTop: 'var(--space-6)' }}>
          <DemandCapture
            context={`brand-preview-${brand.slug}`}
            defaultYear={String(Math.max(...brand.models.flatMap(model => model.years)))}
            defaultMake={brand.name}
            compact
          />
        </div>
      </div>
    </div>
  );
}
