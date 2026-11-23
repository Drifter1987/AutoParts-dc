import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { List, ChevronDown } from 'lucide-react';
import VINScanner from '../components/ui/VINScanner';
import VehicleCard from '../components/ui/VehicleCard';
import RecallsPanel from '../components/ui/RecallsPanel';
import SafetyIntelligencePanel from '../components/ui/SafetyIntelligencePanel';
import RecallWatchButton from '../components/ui/RecallWatchButton';
import DemandCapture from '../components/ui/DemandCapture';
import VINSafetyReport from '../components/ui/VINSafetyReport';
import { vinApi, catalogApi } from '../services/api';
import { findCatalogBrand } from '../services/catalog';
import {
  findCatalogVehicleForDecode,
  findCatalogVehicleForSelection,
  getVehicleLabel,
  getVehiclePath,
} from '../services/parts';
import { getCachedVinResult, cacheVinResult } from '../services/vinCache';
import { trackEvent } from '../services/telemetry';
import {
  MODEL_DATA_UNAVAILABLE,
  getVehicleIdentity,
  hasCompleteVehicleIdentity,
} from '../services/vehicleIdentity';
import { usePageMetadata } from '../hooks/usePageMetadata';
import type { NhtsaMakeResult } from '../services/nhtsa';
import type { Brand, VINDecodeResult } from '../types';
import styles from './VINDecoderPage.module.css';

export default function VINDecoderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<VINDecodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [tab, setTab] = useState<'vin' | 'manual'>('vin');

  // Manual selector state
  const [makes, setMakes] = useState<NhtsaMakeResult[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(true);
  const [makesError, setMakesError] = useState(false);
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [models, setModels] = useState<{ model_id: number; model_name: string }[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [catalogBrands, setCatalogBrands] = useState<Brand[] | null>(null);
  const modelRequest = useRef(0);

  const urlVin = searchParams.get('vin');
  const isReport = searchParams.get('report') === '1';
  const lastUrlVin = useRef<string | null>(null);
  const reportVehicle = result ? getVehicleIdentity(result) : '';
  const reportIdentityComplete = Boolean(result && hasCompleteVehicleIdentity(result));
  const reportTitle = !isReport
    ? 'VIN Decoder — AutoParts'
    : reportIdentityComplete
      ? `${reportVehicle} VIN Safety Report — AutoParts`
      : result
        ? `VIN Safety Report — ${MODEL_DATA_UNAVAILABLE} — AutoParts`
        : 'VIN Safety Report — AutoParts';

  usePageMetadata(
    reportTitle,
    isReport
      ? 'A shareable VIN safety report with decoded specifications, NHTSA recall campaigns, campaign links, and a VIN-specific open-recall check.'
      : 'Decode a 17-character VIN with the free NHTSA vPIC database to see make, model, year, engine, trim, and plant details.',
    isReport
      ? {
          type: 'article',
          noindex: true,
          canonicalPath: '/vin',
          jsonLd: {
            '@type': 'WebPage',
            name: 'VIN Safety Report',
            description: 'Decoded VIN specifications and NHTSA recall information.',
          },
        }
      : {
          canonicalPath: '/vin',
          jsonLd: {
            '@type': 'WebApplication',
            name: 'AutoParts VIN Decoder',
            applicationCategory: 'AutomotiveApplication',
            operatingSystem: 'Web',
            description: 'Free VIN decoder using the NHTSA vPIC database.',
          },
        },
  );

  // Load years
  useEffect(() => {
    vinApi.getYears().then(setYears).catch(() => {});
  }, []);

  // Load car makes from NHTSA (each make carries NHTSA's own ID)
  useEffect(() => {
    let cancelled = false;
    vinApi
      .getMakes()
      .then(list => {
        if (!cancelled) setMakes(list);
      })
      .catch(() => {
        if (!cancelled) setMakesError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingMakes(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the local catalog so the manual CTA never links to an uncatalogued make
  useEffect(() => {
    let cancelled = false;
    catalogApi
      .getBrands()
      .then(data => {
        if (!cancelled) setCatalogBrands(data.brands);
      })
      .catch(() => {
        if (!cancelled) setCatalogBrands([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadModels = (makeName: string, year: string) => {
    const makeId = makes.find(m => m.make_name === makeName)?.make_id;
    const request = ++modelRequest.current;

    if (!makeId) {
      setModels([]);
      setLoadingModels(false);
      return;
    }

    setLoadingModels(true);
    vinApi
      .getModels(makeId, year ? parseInt(year, 10) : undefined)
      .then(data => {
        if (request === modelRequest.current) setModels(data.models || []);
      })
      .catch(() => {
        if (request === modelRequest.current) setModels([]);
      })
      .finally(() => {
        if (request === modelRequest.current) setLoadingModels(false);
      });
  };

  const handleMakeChange = (makeName: string) => {
    setSelectedMake(makeName);
    setSelectedModel('');
    loadModels(makeName, selectedYear);
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedModel('');
    if (selectedMake) loadModels(selectedMake, year);
  };

  const handleDecode = useCallback(async (vin: string) => {
    setLoading(true);
    setError(null);
    setCachedAt(null);
    setResult(null);
    try {
      const data = await vinApi.decode(vin);
      setResult(data);
      cacheVinResult(data);
      lastUrlVin.current = vin;
      setSearchParams(isReport ? { vin, report: '1' } : { vin });
      trackEvent('vin_decode_success', { year: data.year, make: data.make, model: data.model });
    } catch (err: unknown) {
      const cached = getCachedVinResult(vin);
      if (cached) {
        setResult(cached.result);
        setCachedAt(cached.savedAt);
        setError('NHTSA is unavailable right now — showing the last locally cached decode for this VIN.');
        trackEvent('vin_decode_cached_fallback');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to decode VIN');
        trackEvent('vin_decode_failure', { source: 'nhtsa_decode' });
      }
    } finally {
      setLoading(false);
    }
  }, [isReport, setSearchParams]);

  // Auto-decode a VIN from the URL, but never re-decode one we just handled
  useEffect(() => {
    if (urlVin && urlVin.length === 17 && urlVin !== lastUrlVin.current) {
      lastUrlVin.current = urlVin;
      handleDecode(urlVin);
    }
  }, [urlVin, handleDecode]);

  const catalogBrand = findCatalogBrand(catalogBrands, selectedMake);
  const selectedVehicle = findCatalogVehicleForSelection(
    catalogBrand?.slug,
    selectedModel,
    selectedYear,
  );
  const canBrowseParts = Boolean(selectedMake && selectedModel && catalogBrand);
  const isUncataloguedMake = Boolean(selectedMake && catalogBrands && !catalogBrand);
  const decodedCatalogVehicle = findCatalogVehicleForDecode(result);

  const handleManualSearch = () => {
    if (!catalogBrand || !selectedModel) return;
    if (selectedVehicle) {
      navigate(getVehiclePath(selectedVehicle));
      return;
    }
    navigate(`/catalog/${catalogBrand.slug}`);
  };

  if (isReport) {
    return (
      <div className={styles.page}>
        <div className="container">
          {result ? (
            <VINSafetyReport
              result={result}
              catalogBrands={catalogBrands}
              cachedAt={cachedAt}
            />
          ) : (
            <div className={`card ${styles.reportStatus}`} role="status">
              {loading ? (
                <p>Building the VIN safety report…</p>
              ) : error ? (
                <>
                  <strong>The VIN safety report could not be built.</strong>
                  <p>{error}</p>
                  <Link to={`/vin${urlVin ? `?vin=${encodeURIComponent(urlVin)}` : ''}`}>
                    Back to the VIN decoder
                  </Link>
                </>
              ) : (
                <>
                  <strong>No VIN was supplied for this report.</strong>
                  <p>
                    A VIN safety report needs a 17-character VIN.{' '}
                    <Link to="/vin">Start with the VIN decoder</Link>.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className="container">
        {/* Page header */}
        <div className={styles.pageHeader}>
          <p className="eyebrow">VIN Decoder · Live</p>
          <h1 className={styles.title}>VIN Decoder</h1>
          <p className={styles.subtitle}>
            Enter a 17-character Vehicle Identification Number to decode make, model, engine, and
            full specs. The decoder is powered by the free NHTSA vPIC database; a decoded 2020
            Honda Civic hands off to the live parts catalog.
          </p>
        </div>

        {/* Tab switcher */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'vin' ? styles.tabActive : ''}`}
            onClick={() => setTab('vin')}
          >
            By VIN Number
          </button>
          <button
            className={`${styles.tab} ${tab === 'manual' ? styles.tabActive : ''}`}
            onClick={() => setTab('manual')}
          >
            <List size={14} /> Manual Selection
          </button>
        </div>

        {/* ── VIN Input Panel ── */}
        {tab === 'vin' && (
          <div className={`card ${styles.scannerCard}`}>
            <div className={styles.scannerHeader}>
              <h2 className={styles.scannerTitle}>Vehicle Identification Number</h2>
              <p className={styles.scannerSub}>
                The VIN is a 17-character code printed on the dashboard (driver's side) and door jamb
              </p>
            </div>
            <VINScanner
              onDecode={handleDecode}
              loading={loading}
              error={error}
              initialVin={urlVin || ''}
            />
          </div>
        )}

        {/* ── Manual Selection Panel ── */}
        {tab === 'manual' && (
          <div className={`card ${styles.scannerCard}`}>
            <div className={styles.scannerHeader}>
              <h2 className={styles.scannerTitle}>Select Your Vehicle</h2>
              <p className={styles.scannerSub}>
                Don't have a VIN? Browse by make, model, and year
              </p>
            </div>
            <div className={styles.manualGrid}>
              <div>
                <label className={styles.label} htmlFor="manual-make">Make</label>
                <div className={styles.selectWrapper}>
                  <select
                    id="manual-make"
                    className="input"
                    value={selectedMake}
                    onChange={e => handleMakeChange(e.target.value)}
                    disabled={loadingMakes || makesError}
                  >
                    <option value="">
                      {loadingMakes ? 'Loading makes…' : makesError ? 'Makes unavailable' : 'Select Make…'}
                    </option>
                    {makes.map(m => (
                      <option key={m.make_id} value={m.make_name}>{m.make_name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className={styles.selectChevron} />
                </div>
              </div>
              <div>
                <label className={styles.label} htmlFor="manual-year">Year</label>
                <div className={styles.selectWrapper}>
                  <select
                    id="manual-year"
                    className="input"
                    value={selectedYear}
                    onChange={e => handleYearChange(e.target.value)}
                  >
                    <option value="">Any Year</option>
                    {years.slice(0, 30).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className={styles.selectChevron} />
                </div>
              </div>
              <div>
                <label className={styles.label} htmlFor="manual-model">Model</label>
                <div className={styles.selectWrapper}>
                  <select
                    id="manual-model"
                    className="input"
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    disabled={!selectedMake || loadingModels}
                  >
                    <option value="">
                      {loadingModels
                        ? 'Loading…'
                        : !selectedMake
                          ? 'Select Make first'
                          : models.length === 0
                            ? 'No models found'
                            : 'Select Model…'}
                    </option>
                    {models.map(m => (
                      <option key={m.model_id} value={m.model_name}>{m.model_name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className={styles.selectChevron} />
                </div>
              </div>
            </div>
            <div className={styles.manualCTA}>
              <button
                className="btn btn-primary"
                disabled={!canBrowseParts}
                onClick={handleManualSearch}
              >
                {selectedVehicle
                  ? `Browse Parts for ${getVehicleLabel(selectedVehicle)}`
                  : isUncataloguedMake
                    ? `Parts not published for ${selectedMake}`
                    : catalogBrand
                      ? `View ${catalogBrand.name} catalog preview`
                      : `Browse Parts for ${selectedYear} ${selectedMake} ${selectedModel}`}
              </button>
              <span className={styles.manualNote}>
                {selectedVehicle
                  ? 'Representative catalog · verify fitment with a Honda dealer'
                  : isUncataloguedMake
                    ? `${selectedMake} isn't in the brand/model preview yet`
                    : catalogBrand
                      ? `Brand/model preview only — live parts cover the 2020 Civic`
                      : 'Select a make and model to continue'}
              </span>
            </div>
            {selectedMake && selectedModel && !selectedVehicle && (
              <div style={{ marginTop: 'var(--space-5)' }}>
                <DemandCapture
                  context="manual-selector-uncovered"
                  defaultYear={selectedYear}
                  defaultMake={selectedMake}
                  defaultModel={selectedModel}
                  compact
                />
              </div>
            )}
          </div>
        )}

        {/* ── Result ── */}
        {result && (
          <div className={styles.result}>
            <p className={styles.srOnly} role="status">
              {hasCompleteVehicleIdentity(result)
                ? `Decoded ${getVehicleIdentity(result)} (${result.vin}). Results are below the VIN form.`
                : `Decoded VIN ${result.vin}. ${MODEL_DATA_UNAVAILABLE}, so no model-year lookups ran. Results are below the VIN form.`}
            </p>
            {cachedAt && (
              <p className={styles.manualNote} style={{ marginBottom: 'var(--space-2)' }}>
                Cached decode from {new Date(cachedAt).toLocaleString()} — reconnect to refresh
                NHTSA data.
              </p>
            )}
            <VehicleCard result={result} catalogBrands={catalogBrands} />
            <RecallsPanel result={result} />
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
              <RecallWatchButton result={result} />
              <Link to="/recall-center" className="btn btn-ghost">
                Open Recall Checklist
              </Link>
              <Link
                to={`/vin?vin=${encodeURIComponent(result.vin)}&report=1`}
                className="btn btn-ghost"
              >
                Open safety report
              </Link>
            </div>
            {!decodedCatalogVehicle && (
              <div style={{ marginTop: 'var(--space-5)' }}>
                <DemandCapture
                  context="vin-uncovered"
                  defaultVin={result.vin}
                  defaultYear={result.year || ''}
                  defaultMake={result.make || ''}
                  defaultModel={result.model || ''}
                />
              </div>
            )}
            <SafetyIntelligencePanel result={result} />
          </div>
        )}

        {/* ── How VINs Work ── */}
        <div className={styles.infoSection}>
          <h3 className={styles.infoTitle}>How VINs work</h3>
          <div className={styles.infoGrid}>
            {[
              { pos: '1–3', name: 'WMI', desc: 'World Manufacturer Identifier — country and maker', color: 'amber' },
              { pos: '4–9', name: 'VDS', desc: 'Vehicle Descriptor Section — model, body, engine', color: 'ice' },
              { pos: '10–17', name: 'VIS', desc: 'Vehicle Identifier Section — year, plant, serial', color: 'success' },
            ].map(s => (
              <div key={s.pos} className={`card ${styles.infoCard}`}>
                <div className={`${styles.infoPos} ${styles[`pos_${s.color}`]}`}>
                  Positions {s.pos}
                </div>
                <h4 className={styles.infoName}>{s.name}</h4>
                <p className={styles.infoDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
