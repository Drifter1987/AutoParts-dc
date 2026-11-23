import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, ShieldCheck, Box, HardDrive } from 'lucide-react';
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
const ASSEMBLY_COUNT = CIVIC_2020.assemblies.length;

const FEATURES = [
  {
    icon: <Zap size={20} />,
    status: 'Live',
    title: 'VIN Decoder',
    desc: 'Year, make, model, engine, and trim from NHTSA vPIC. No account needed.',
    href: '/vin',
  },
  {
    icon: <ShieldCheck size={20} />,
    status: 'Live',
    title: 'VIN Safety Report',
    desc: 'Model-year recalls, complaints, investigations, and a VIN-specific NHTSA check link.',
    href: '/vin',
  },
  {
    icon: <Box size={20} />,
    status: 'Live',
    title: '2020 Civic Parts',
    desc: `One published vehicle: ${ASSEMBLY_COUNT} assemblies and ${LIVE_PARTS_COUNT} representative OEM-reference parts. Verify with a dealer.`,
    href: '/catalog/honda/civic/2020',
  },
  {
    icon: <HardDrive size={20} />,
    status: 'On this device',
    title: 'My Garage & Checklist',
    desc: 'Save vehicles, notes, and a recall checklist in localStorage. No account, cloud sync, or background monitoring.',
    href: '/garage',
  },
];

export default function HomePage() {
  const [models, setModels] = useState<PopularModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const navigate = useNavigate();

  usePageMetadata(
    'AutoParts — VIN Decoder & Safety Report',
    'Decode a VIN with NHTSA, check model-year recalls and complaints, and browse the published 2020 Honda Civic parts slice.',
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
            <p className="eyebrow">Live NHTSA data · On-device tools · No account</p>
            <h1 className={styles.heroTitle}>
              Know the vehicle<br />
              <span className={styles.heroAccent}>behind the VIN</span>
            </h1>
            <p className={styles.heroSub}>
              Decode a VIN with NHTSA, check model-year recalls and complaints, and browse the
              published 2020 Honda Civic parts slice. Catalog metadata lists {BRAND_COUNT} brands
              and {MODEL_COUNT.toLocaleString()} models; only the Civic has published parts (
              {LIVE_PARTS_COUNT}).
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
              { value: 1, label: 'Vehicle with parts' },
              { value: LIVE_PARTS_COUNT, label: 'Published parts' },
              { value: ASSEMBLY_COUNT, label: 'Assemblies' },
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
                <span className={`badge ${f.status === 'Live' ? 'badge-success' : 'badge-ice'} ${styles.featureStatus}`}>
                  {f.status}
                </span>
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
              <p className="eyebrow">Catalog metadata</p>
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

    </div>
  );
}
