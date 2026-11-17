import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Car, Search, SlidersHorizontal } from 'lucide-react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { catalogApi } from '../services/api';
import {
  CATALOG_VEHICLES,
  CIVIC_2020,
  getPartPath,
  getVehicleLabel,
  getVehiclePath,
  searchParts,
} from '../services/parts';
import { trackEvent } from '../services/telemetry';
import PartList from '../components/ui/PartList';
import type { Brand } from '../types';
import styles from '../styles/parts.module.css';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const query = searchParams.get('q') || '';
  const vehicleFilter = searchParams.get('vehicle') || '';
  const vin = searchParams.get('vin');

  usePageMetadata(
    query ? `Parts Search: ${query} — AutoParts` : 'Parts Search — AutoParts',
    'Search AutoParts by OEM number, part name, alias, or brand/model. Check fitment, compare supersessions, and copy part numbers.',
    {
      canonicalPath: '/search',
      jsonLd: {
        '@type': 'WebPage',
        name: 'AutoParts Parts Search',
        description: 'Search by OEM number, part name, alias, or brand/model.',
      },
    },
  );

  useEffect(() => {
    catalogApi.getBrands().then(data => setBrands(data.brands)).catch(() => setBrands([]));
  }, []);

  useEffect(() => {
    if (!query) return;
    const timer = window.setTimeout(() => {
      trackEvent('parts_search', { query, vehicleFilter: vehicleFilter || 'all' });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [query, vehicleFilter]);

  const setQuery = (value: string) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  };

  const setVehicleFilter = (value: string) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value) next.set('vehicle', value);
        else next.delete('vehicle');
        return next;
      },
      { replace: true },
    );
  };

  const partResults = useMemo(() => {
    const all = searchParts(query);
    if (!vehicleFilter) return all;
    const vehicle = CATALOG_VEHICLES.find(item => item.catalog.modelSlug === vehicleFilter);
    if (!vehicle) return all;
    return all.filter(part =>
      vehicle.assemblies.some(
        assembly =>
          assembly.slug === part.assemblySlug &&
          assembly.parts.some(item => item.slug === part.slug),
      ),
    );
  }, [query, vehicleFilter]);

  const brandResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return brands
      .filter(brand =>
        brand.name.toLowerCase().includes(q) ||
        brand.models.some(model => model.name.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [brands, query]);

  const hrefForPart = (part: { slug: string; assemblySlug?: string }) =>
    getPartPath(CIVIC_2020, part.assemblySlug || 'engine', part.slug, vin);

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.heroMeta}>
            <p className="eyebrow">Parts search</p>
            <h1 className={styles.title}>Find a part by number or name</h1>
            <p className={styles.subtitle}>
              Mechanics and parts-counter staff can start with an OEM number, supersession,
              interchange reference, part name, or alias. Results keep the vehicle context in the
              URL so you can share the exact lookup.
            </p>
          </div>
          <div className={styles.pageActions}>
            <Link to={getVehiclePath(CIVIC_2020)} className="btn btn-ghost">
              Browse 2020 Civic
            </Link>
          </div>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.toolbarField} style={{ flex: 2 }}>
            <span className={styles.toolbarLabel}>Search parts</span>
            <span style={{ position: 'relative' }}>
              <Search
                size={15}
                aria-hidden="true"
                style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }}
              />
              <input
                type="search"
                className={styles.searchInput}
                style={{ paddingLeft: 34 }}
                placeholder="Try 45022-TBA-A00, brake pads, oil filter…"
                value={query}
                onChange={event => setQuery(event.target.value)}
                aria-label="Search parts by OEM number, part name, or alias"
              />
            </span>
          </label>
          <label className={styles.toolbarField}>
            <span className={styles.toolbarLabel}>Fitment filter</span>
            <select
              className={styles.select}
              value={vehicleFilter}
              onChange={event => setVehicleFilter(event.target.value)}
              aria-label="Filter results by vehicle fitment"
            >
              <option value="">All available vehicles</option>
              {CATALOG_VEHICLES.map(vehicle => (
                <option key={vehicle.catalog.modelSlug} value={vehicle.catalog.modelSlug}>
                  {getVehicleLabel(vehicle)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!query ? (
          <section className={styles.section} aria-labelledby="search-suggestions">
            <div className={styles.sectionHeader}>
              <div>
                <p className="eyebrow">Start with a number</p>
                <h2 id="search-suggestions" className={styles.h2}>Try a high-intent lookup</h2>
              </div>
            </div>
            <div className={styles.relatedGrid}>
              {[
                { label: 'Front brake pads', q: '45022-TBA-A00' },
                { label: 'Oil filter', q: 'oil filter' },
                { label: 'Cabin filter', q: '80292-TBA-A11' },
              ].map(item => (
                <button
                  key={item.q}
                  type="button"
                  className={`card ${styles.relatedCard}`}
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => setQuery(item.q)}
                >
                  <p className={styles.relatedName}>{item.label}</p>
                  <p className={styles.relatedNumber}>{item.q}</p>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <p className={styles.sectionMeta} style={{ marginBottom: 'var(--space-4)' }}>
              <SlidersHorizontal size={12} /> {partResults.length} part
              {partResults.length === 1 ? '' : 's'} · {brandResults.length} brand
              {brandResults.length === 1 ? '' : 's'} matching “{query}”
            </p>

            {partResults.length > 0 && (
              <section className={styles.section} aria-labelledby="part-results-title">
                <div className={styles.sectionHeader}>
                  <div>
                    <p className="eyebrow">Parts</p>
                    <h2 id="part-results-title" className={styles.h2}>Matching part records</h2>
                  </div>
                  <span className={styles.sectionMeta}>Click a part for fitment and provenance</span>
                </div>
                <PartList parts={partResults} hrefForPart={hrefForPart} hasVin={Boolean(vin)} />
              </section>
            )}

            {brandResults.length > 0 && (
              <section className={styles.section} aria-labelledby="brand-results-title">
                <div className={styles.sectionHeader}>
                  <div>
                    <p className="eyebrow">Brands & models</p>
                    <h2 id="brand-results-title" className={styles.h2}>Vehicle catalog matches</h2>
                  </div>
                </div>
                <div className={styles.relatedGrid}>
                  {brandResults.map(brand => (
                    <Link
                      key={brand.slug}
                      to={`/catalog/${brand.slug}`}
                      className={`card ${styles.relatedCard}`}
                    >
                      <p className={styles.relatedName}><Car size={14} /> {brand.name}</p>
                      <p className={styles.relatedNumber}>{brand.models.length} models</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {partResults.length === 0 && brandResults.length === 0 && (
              <div className={styles.empty}>
                <Search size={34} />
                <p>No part or vehicle catalog match for “{query}”.</p>
                <p className={styles.provenance}>
                  Try an OEM number such as <span className="mono">45022-TBA-A00</span>, a common
                  alias such as “front pads”, or a brand such as “Honda”.
                </p>
                <button type="button" className="btn btn-ghost" onClick={() => setQuery('')}>
                  Clear search
                </button>
              </div>
            )}
          </>
        )}

        <div className={styles.notice} style={{ marginTop: 'var(--space-6)', marginBottom: 0 }}>
          <span>
            The searchable parts slice currently covers the {getVehicleLabel(CIVIC_2020)}. Results
            are representative and must be verified with a dealer before ordering.
          </span>
        </div>
      </div>
    </div>
  );
}
