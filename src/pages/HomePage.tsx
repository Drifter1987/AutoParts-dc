import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Database, Box, Globe } from 'lucide-react';
import { catalogApi } from '../services/api';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { CIVIC_2020, getPartCount } from '../services/parts';
import RollingNumber from '../components/ui/RollingNumber';
import brandsData from '../data/brands.json';
import type { Brand, PopularModel } from '../types';
import styles from './HomePage.module.css';

const BRANDS = (brandsData as { brands: Brand[] }).brands;
const BRAND_COUNT = BRANDS.length;
const MODEL_COUNT = BRANDS.reduce((total, brand) => total + brand.models.length, 0);
const LIVE_PARTS_COUNT = getPartCount(CIVIC_2020);

const FEATURES = [
  { icon: <Zap size={20} />, title: 'VIN Decoder', desc: 'Instant year, make, model, engine, and trim identification via NHTSA — no account needed', href: '/vin' },
  { icon: <Database size={20} />, title: 'Brand & Model Catalog', desc: `${BRAND_COUNT} active brands, ${MODEL_COUNT} models, and EPA-sourced engine options; the 2020 Civic parts slice is live`, href: '/catalog' },
  { icon: <Box size={20} />, title: '2D Exploded Diagram', desc: 'Numbered, keyboard-accessible hotspots linked to the Civic parts list', href: '/catalog/honda/civic/2020' },
  { icon: <Globe size={20} />, title: 'Global Coverage', desc: 'European, Japanese, American, Korean, Chinese, Indian, and Vietnamese brands in the catalog', href: '/catalog' },
];

export default function HomePage() {
  const [models, setModels] = useState<PopularModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const navigate = useNavigate();

  usePageMetadata(
    'AutoParts — VIN Decoder & Vehicle Catalog',
    'Decode a VIN free and explore vehicle specifications and parts catalogs for automotive brands.',
    {
      canonicalPath: '/',
      jsonLd: {
        '@type': 'WebSite',
        name: 'AutoParts',
        url: 'https://len-golani.github.io/AutoParts-fb/',
        description: 'Free VIN decoder and representative automotive parts catalog.',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://len-golani.github.io/AutoParts-fb/search?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    },
  );

  useEffect(() => {
    catalogApi.getPopularModels()
      .then(d => setModels(d.popular_models))
      .catch(() => {})
      .finally(() => setLoadingModels(false));
  }, []);

  const modelPath = (model: PopularModel) =>
    model.brand_slug === 'honda' && model.model === 'Civic'
      ? '/catalog/honda/civic/2020'
      : `/catalog/${model.brand_slug}`;

  const openModel = (model: PopularModel) => navigate(modelPath(model));

  const handleModelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, model: PopularModel) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModel(model);
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroContent}>
            <p className="eyebrow">Proprietary · Free VIN Decoder · No Account Required</p>
            <h1 className={styles.heroTitle}>
              Find the part that fits<br />
              <span className={styles.heroAccent}>your vehicle</span>
            </h1>
            <p className={styles.heroSub}>
              Decode a VIN with the free NHTSA database, then explore the live 2020 Honda Civic
              parts slice. The catalog covers {BRAND_COUNT} active brands, {MODEL_COUNT} models,
              and their EPA-sourced engine options.
            </p>
            <div className={styles.heroCTA}>
              <Link to="/vin" className="btn btn-primary">
                Decode a VIN <ArrowRight size={16} />
              </Link>
              <Link to="/catalog/honda/civic/2020" className="btn btn-ghost">
                Browse 2020 Civic parts
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className={styles.heroStats}>
            {[
              { value: BRAND_COUNT, label: 'Brands' },
              { value: MODEL_COUNT, label: 'Models' },
              { value: LIVE_PARTS_COUNT, label: 'Live parts' },
              { value: 'Free', label: 'No account' },
            ].map((s, i) => (
              <div key={i} className={styles.heroStat}>
                <span className={styles.heroStatValue}>
                  {typeof s.value === 'number' ? <RollingNumber value={s.value} /> : s.value}
                </span>
                <span className={styles.heroStatLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className={styles.features}>
        <div className="container">
          <div className={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <Link key={i} to={f.href} className={`card ${styles.featureCard}`}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
                <span className={styles.featureArrow}>→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Popular Models ── */}
      <section className={styles.models}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div>
              <p className="eyebrow">Featured Vehicles</p>
              <h2 className={styles.sectionTitle}>Popular Models</h2>
            </div>
            <Link to="/catalog" className="btn btn-ghost">
              View all brands <ArrowRight size={15} />
            </Link>
          </div>

          {loadingModels ? (
            <div className={styles.loadingGrid}>
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`card ${styles.modelSkeleton}`} />
              ))}
            </div>
          ) : (
            <div className={styles.modelGrid}>
              {models.map(m => (
                <div
                  key={m.id}
                  className={`card ${styles.modelCard}`}
                  onClick={() => openModel(m)}
                  onKeyDown={e => handleModelKeyDown(e, m)}
                  role="button"
                  tabIndex={0}
                >
                  {/* Brand badge */}
                  <div className={styles.modelHeader}>
                    <span className={styles.modelBrand}>{m.brand}</span>
                    <span className={styles.modelYear}>{m.year}</span>
                  </div>

                  <h3 className={styles.modelName}>{m.model}</h3>
                  <p className={styles.modelDesc}>{m.description}</p>

                  {/* Tags */}
                  <div className={styles.modelTags}>
                    {m.tags.map(t => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>

                  {/* Engine options */}
                  <div className={styles.modelEngines}>
                    {m.engine_options.slice(0, 2).map(e => (
                      <span key={e} className="badge badge-amber">{e}</span>
                    ))}
                    {m.engine_options.length > 2 && (
                      <span className="badge badge-ice">+{m.engine_options.length - 2}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Phase Roadmap ── */}
      <section className={styles.roadmap}>
        <div className="container">
          <p className="eyebrow" style={{ textAlign: 'center', marginBottom: '8px' }}>Development Roadmap</p>
          <h2 className={styles.sectionTitle} style={{ textAlign: 'center', marginBottom: '32px' }}>
            Building in public, phase by phase
          </h2>
          <div className={styles.phaseList}>
            {[
              { n: 1, name: 'VIN Decoder & Vehicle Lookup', done: true },
              { n: 2, name: 'Parts Catalog — 2020 Civic Vertical Slice', done: false, status: 'Slice live' },
              { n: 3, name: '2D Exploded Diagrams', done: false, status: 'Slice live' },
              { n: 4, name: '3D Exploded Views (Three.js + glTF)', done: false },
              { n: 5, name: 'Smart Search, Compatibility & AI', done: false },
              { n: 6, name: 'User Accounts & Marketplace', done: false },
              { n: 7, name: 'Scale catalog data & licensed diagrams', done: false },
            ].map(p => (
              <div key={p.n} className={`${styles.phase} ${p.done ? styles.phaseDone : ''}`}>
                <span className={styles.phaseNum}>
                  {p.done ? '✓' : `0${p.n}`}
                </span>
                <span className={styles.phaseName}>{p.name}</span>
                {p.done && <span className="badge badge-success">Live</span>}
                {!p.done && 'status' in p && p.status && <span className="badge badge-amber">{p.status}</span>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
