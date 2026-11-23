import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronRight, Globe } from 'lucide-react';
import { catalogApi } from '../services/api';
import { usePageMetadata, breadcrumbJsonLd } from '../hooks/usePageMetadata';
import brandsSeed from '../data/brands.json';
import RollingNumber from '../components/ui/RollingNumber';
import type { Brand, BrandsResponse } from '../types';
import styles from './CatalogPage.module.css';

const SEED = brandsSeed as BrandsResponse;
const SEED_BRAND_COUNT = SEED.brands.length;
const SEED_MODEL_COUNT = SEED.brands.reduce((total, brand) => total + brand.models.length, 0);

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState('All');
  const query = searchParams.get('q') || '';

  usePageMetadata(
    'Vehicle Catalog — AutoParts',
    `Browse ${SEED_BRAND_COUNT} active automotive brands and ${SEED_MODEL_COUNT} models with production years and EPA-sourced engine options, then decode a VIN. The live parts slice currently covers the 2020 Honda Civic.`,
    {
      canonicalPath: '/catalog',
      jsonLd: [
        breadcrumbJsonLd([{ name: 'Catalog', path: '/catalog' }]),
        {
          '@type': 'CollectionPage',
          name: 'AutoParts Vehicle Catalog',
          description: 'Brand and model metadata with the published 2020 Honda Civic parts slice.',
        },
      ],
    },
  );

  const setQuery = (value: string) => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (value) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    catalogApi.getBrands()
      .then(d => setBrands(d.brands))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const regions = useMemo(
    () => ['All', ...Array.from(new Set(brands.map(brand => brand.origin)))],
    [brands],
  );
  const brandCount = brands.length || SEED_BRAND_COUNT;
  const modelCount = brands.reduce((total, brand) => total + brand.models.length, 0) || SEED_MODEL_COUNT;

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return brands.filter(b => {
      const matchesRegion = region === 'All' || b.origin === region;
      const matchesQuery = !query ||
        b.name.toLowerCase().includes(needle) ||
        b.models.some(
          m => m.name.toLowerCase().includes(needle) ||
            m.engines.some(engine => engine.toLowerCase().includes(needle)),
        );
      return matchesRegion && matchesQuery;
    });
  }, [brands, query, region]);

  const grouped = useMemo(() => {
    const g: Record<string, Brand[]> = {};
    filtered.forEach(b => {
      const key = region === 'All' ? b.origin : b.name[0].toUpperCase();
      if (!g[key]) g[key] = [];
      g[key].push(b);
    });
    return g;
  }, [filtered, region]);

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Header */}
        <div className={styles.pageHeader}>
          <p className="eyebrow">Catalog metadata</p>
          <h1 className={styles.title}>Browse by Brand</h1>
          <p className={styles.subtitle}>
            <RollingNumber value={brandCount} /> brands · <RollingNumber value={modelCount} /> models indexed
          </p>
          <p className={styles.subtitle} style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            This is brand, model, and engine metadata, not a parts catalog. The only published parts
            data is the 2020 Honda Civic: 4 assemblies and 36 representative OEM-reference parts.
            Other models have no parts data.
          </p>
          <p className={styles.catalogNote}>
            {SEED.meta?.coverage} Source: {SEED.meta?.source}. {SEED.meta?.caveat}
          </p>
        </div>

        <div className={styles.liveSlice}>
          <div>
            <p className="eyebrow">Published parts coverage</p>
            <h2 className={styles.liveTitle}>2020 Honda Civic</h2>
            <p className={styles.liveText}>
              One vehicle · 4 assemblies · 36 representative OEM-reference parts · fitment notes ·
              diagram
            </p>
          </div>
          <div className={styles.liveActions}>
            <Link to="/catalog/honda/civic/2020" className="btn btn-primary">
              Browse Civic parts
            </Link>
            <Link to="/search" className="btn btn-ghost">
              Search by part number
            </Link>
          </div>
        </div>

        {/* Search + filter bar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              className={styles.searchInput}
              placeholder="Search brands or models…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <Link to="/search" className={styles.searchPartsLink}>Search parts by OEM number →</Link>
          <div className={styles.regionTabs}>
            {regions.map(r => (
              <button
                key={r}
                className={`${styles.regionTab} ${region === r ? styles.regionActive : ''}`}
                onClick={() => setRegion(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        {query && (
          <p className={styles.resultCount}>
            <RollingNumber value={filtered.length} /> brand{filtered.length !== 1 ? 's' : ''} matching "{query}"
          </p>
        )}

        {/* Brand groups */}
        {loading ? (
          <div className={styles.skeletonGrid}>
            {[...Array(12)].map((_, i) => (
              <div key={i} className={`card ${styles.skeleton}`} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <Globe size={40} />
            <p>No brand or model matches “{query}”.</p>
            <Link to={`/search?q=${encodeURIComponent(query)}`} className="btn btn-ghost">
              Search parts and catalog together
            </Link>
            <button className="btn btn-ghost" onClick={() => { setQuery(''); setRegion('All'); }}>
              Clear filters
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([group, groupBrands]) => (
            <div key={group} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupLabel}>{group}</span>
                <span className={styles.groupCount}>{groupBrands.length}</span>
              </div>
              <div className={styles.brandGrid}>
                {groupBrands.map(brand => (
                  <Link
                    key={brand.slug}
                    to={`/catalog/${brand.slug}`}
                    className={`card ${styles.brandCard}`}
                  >
                    <div className={styles.brandTop}>
                      <div className={styles.brandInitial}>
                        {brand.name[0]}
                      </div>
                      <div>
                        <h3 className={styles.brandName}>{brand.name}</h3>
                        <span className={styles.brandOrigin}>{brand.origin}</span>
                      </div>
                    </div>
                    <div className={styles.brandModels}>
                      {brand.models.slice(0, 4).map(m => (
                        <span key={m.slug} className={styles.modelPill}>{m.name}</span>
                      ))}
                      {brand.models.length > 4 && (
                        <span className={`${styles.modelPill} ${styles.modelMore}`}>
                          +{brand.models.length - 4}
                        </span>
                      )}
                    </div>
                    <div className={styles.brandFooter}>
                      <span className={styles.modelCount}>
                        {brand.models.length} models ·{' '}
                        {brand.models.reduce((total, model) => total + model.engines.length, 0)} engine options
                      </span>
                      <ChevronRight size={14} className={styles.arrow} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
