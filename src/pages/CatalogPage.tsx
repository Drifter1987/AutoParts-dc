import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, ChevronRight, Globe } from 'lucide-react';
import { catalogApi } from '../services/api';
import { usePageMetadata, breadcrumbJsonLd } from '../hooks/usePageMetadata';
import type { Brand } from '../types';
import styles from './CatalogPage.module.css';

const REGIONS = ['All', 'European', 'Japanese', 'American', 'Korean'];

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState('All');
  const query = searchParams.get('q') || '';

  usePageMetadata(
    'Vehicle Catalog — AutoParts',
    'Browse a preview of 20 automotive brands and 98 models, then decode a VIN. The live parts slice currently covers the 2020 Honda Civic.',
    {
      canonicalPath: '/catalog',
      jsonLd: [
        breadcrumbJsonLd([{ name: 'Catalog', path: '/catalog' }]),
        {
          '@type': 'CollectionPage',
          name: 'AutoParts Vehicle Catalog',
          description: 'Brand and model preview with a live 2020 Honda Civic parts slice.',
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

  const filtered = useMemo(() => {
    return brands.filter(b => {
      const matchesRegion = region === 'All' || b.origin === region;
      const matchesQuery = !query ||
        b.name.toLowerCase().includes(query.toLowerCase()) ||
        b.models.some(m => m.name.toLowerCase().includes(query.toLowerCase()));
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
          <p className="eyebrow">Catalog Preview</p>
          <h1 className={styles.title}>Browse by Brand</h1>
          <p className={styles.subtitle}>
            {brands.length} brands · {brands.reduce((acc, b) => acc + b.models.length, 0)} models indexed
          </p>
          <p className={styles.subtitle} style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            This is a brand and model preview, not a complete parts catalog. Parts data is live for
            the 2020 Honda Civic; other models are being added in later slices.
          </p>
        </div>

        <div className={styles.liveSlice}>
          <div>
            <p className="eyebrow">Live vertical slice</p>
            <h2 className={styles.liveTitle}>2020 Honda Civic</h2>
            <p className={styles.liveText}>
              4 assemblies · 36 OEM-reference parts · fitment notes · exploded diagram
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
            {REGIONS.map(r => (
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
            {filtered.length} brand{filtered.length !== 1 ? 's' : ''} matching "{query}"
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
                      <span className={styles.modelCount}>{brand.models.length} models</span>
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
