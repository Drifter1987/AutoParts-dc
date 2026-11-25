import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Fuel, Settings, Gauge, MapPin, ChevronDown, ChevronUp, CheckCircle2, FileText, Info } from 'lucide-react';
import { findCatalogBrand, findCatalogModel } from '../../services/catalog';
import {
  findCatalogVehicleForDecode,
  getVehicleLabel,
  getVehiclePath,
  inferEngineFromVin,
} from '../../services/parts';
import SaveVehicleButton from './SaveVehicleButton';
import ShareButton from './ShareButton';
import { trackEvent } from '../../services/telemetry';
import { MODEL_DATA_UNAVAILABLE } from '../../services/vehicleIdentity';
import type { Brand, VINDecodeResult } from '../../types';
import styles from './VehicleCard.module.css';

interface VehicleCardProps {
  result: VINDecodeResult;
  catalogBrands: Brand[] | null;
  reportMode?: boolean;
}

const PRIORITY_SPECS = [
  'Make', 'Model', 'Model Year', 'Trim', 'Body Class',
  'Doors', 'Drive Type', 'Engine Number of Cylinders',
  'Displacement (L)', 'Fuel Type - Primary', 'Transmission Style',
  'Plant Country', 'Plant City', 'Series',
];

export default function VehicleCard({ result, catalogBrands, reportMode = false }: VehicleCardProps) {
  const [showAllSpecs, setShowAllSpecs] = useState(false);
  const catalogBrand = findCatalogBrand(catalogBrands, result.make);
  const catalogVehicle = findCatalogVehicleForDecode(result);
  const previewModel = findCatalogModel(catalogBrand, result.model);
  const previewYear =
    result.year ||
    (previewModel?.years.length ? String(Math.max(...previewModel.years)) : '');
  const previewCoveragePath =
    catalogBrand && previewModel
      ? `/catalog/${catalogBrand.slug}/${previewModel.slug}/${previewYear}?vin=${encodeURIComponent(result.vin)}`
      : null;
  const inferredEngine = inferEngineFromVin(result);
  const partsQuery = new URLSearchParams();
  if (result.vin) partsQuery.set('vin', result.vin);
  if (inferredEngine) partsQuery.set('engine', inferredEngine);
  if (result.trim) partsQuery.set('trim', result.trim);
  const partsPath = catalogVehicle
    ? `${getVehiclePath(catalogVehicle)}?${partsQuery.toString()}`
    : null;

  const specs = reportMode || showAllSpecs
    ? result.all_specs.filter(s => s.value)
    : result.all_specs.filter(s => s.value && PRIORITY_SPECS.includes(s.variable));

  const vehicleIdentity = [result.year, result.make, result.model].filter(Boolean).join(' ');
  const hasFullVehicleIdentity = Boolean(result.year && result.make && result.model);
  const vehicleSummary = hasFullVehicleIdentity
    ? vehicleIdentity
    : [vehicleIdentity, 'Model data not available for this market'].filter(Boolean).join(' · ');

  const quickStats = [
    { icon: <Car size={16} />, label: 'Vehicle', value: vehicleSummary },
    { icon: <Settings size={16} />, label: 'Engine', value: result.engine || result.cylinders ? `${result.cylinders ? result.cylinders + '-cyl' : ''} ${result.displacement_l ? result.displacement_l + 'L' : ''}`.trim() : null },
    { icon: <Fuel size={16} />, label: 'Fuel', value: result.fuel_type },
    { icon: <Gauge size={16} />, label: 'Drive', value: result.drive_type },
    { icon: <MapPin size={16} />, label: 'Made in', value: result.plant_country ? `${result.plant_city || ''} ${result.plant_country}`.trim() : null },
  ].filter(s => s.value);

  return (
    <div className={`card ${styles.card} animate-slide-up`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.checkBadge}>
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="eyebrow">VIN Decoded</p>
            <h2 className={styles.vehicleName}>
              {vehicleIdentity || 'Vehicle identity unavailable'}
              {hasFullVehicleIdentity && result.trim && (
                <span className={styles.trim}> {result.trim}</span>
              )}
            </h2>
          </div>
        </div>
        <div className={styles.vinBadge}>
          <span className={styles.vinLabel}>VIN</span>
          <span className={styles.vinValue}>{result.vin}</span>
        </div>
      </div>

      {result.model_source === 'vin-pattern' && result.model_note && (
        <div className={styles.inferred}>
          <Info size={15} aria-hidden="true" />
          <p>
            <strong>Model inferred from VIN positions 7–8 ({result.model_code}).</strong>{' '}
            {result.model_note}
          </p>
        </div>
      )}

      {!hasFullVehicleIdentity && (
        <div className={styles.inferred} role="status">
          <Info size={15} aria-hidden="true" />
          <p>
            <strong>Model data not available for this market.</strong> NHTSA returned this VIN
            without enough model-year, make, and model detail. Model-level recall and parts
            lookups need that identity, so use the VIN-specific NHTSA check to confirm this
            vehicle.
          </p>
        </div>
      )}

      {/* Quick stat strip */}
      <div className={styles.statStrip} role="group" aria-label="Vehicle summary" tabIndex={0}>
        {quickStats.map((stat, i) => (
          <div key={i} className={styles.stat}>
            <span className={styles.statIcon}>{stat.icon}</span>
            <div>
              <p className={styles.statLabel}>{stat.label}</p>
              <p className={styles.statValue}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Spec table */}
      {specs.length > 0 && (
        <div className={styles.specSection}>
          <p className={styles.specTitle}>Technical Specifications</p>
          <div className={styles.specGrid}>
            {specs.map((spec, i) => (
              <div key={i} className={styles.specRow}>
                <span className={styles.specKey}>{spec.variable}</span>
                <span className={styles.specVal}>{spec.value}</span>
              </div>
            ))}
          </div>

          {!reportMode && result.all_specs.filter(s => s.value).length > PRIORITY_SPECS.length && (
            <button
              className={styles.toggleSpecs}
              onClick={() => setShowAllSpecs(!showAllSpecs)}
            >
              {showAllSpecs ? (
                <><ChevronUp size={14} /> Show fewer specs</>
              ) : (
                <><ChevronDown size={14} /> Show all {result.all_specs.filter(s => s.value).length} specs</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Error warning */}
      {result.error_text && (
        <div className={styles.warning}>
          ⚠️ {result.error_text}
        </div>
      )}

      {/* CTA */}
      {!reportMode && (
        <div className={styles.footer}>
          <div className={styles.footerCopy}>
            <p className={styles.footerText}>
              {catalogVehicle
                ? `Representative catalog ready for the ${getVehicleLabel(catalogVehicle)}. Verify fitment with your dealer before ordering.`
                                  : catalogBrand
                  ? 'This vehicle is in the brand/model preview, but its parts data is not published yet. The live slice covers the 2020 Civic.'
                  : !hasFullVehicleIdentity
                    ? 'Model data is not available for this market, so parts coverage cannot be matched. VIN decoding is still fully live.'
                    : `${result.make || 'This make'} is not in the parts catalog yet. VIN decoding is still fully live.`}
            </p>
            <div className={styles.footerActions}>
              <SaveVehicleButton
                result={result}
                className={`btn btn-ghost ${styles.footerAction}`}
              />
              <Link
                to={`/vin?${new URLSearchParams({ vin: result.vin, report: '1' }).toString()}`}
                className={`btn btn-ghost ${styles.footerAction}`}
              >
                <FileText size={13} /> Safety report
              </Link>
              <ShareButton
                className={`btn btn-ghost ${styles.footerAction}`}
                label="Share VIN"
                title={
                  hasFullVehicleIdentity
                    ? `${vehicleIdentity} VIN result`
                    : `VIN ${result.vin} — ${MODEL_DATA_UNAVAILABLE}`
                }
                text={
                  hasFullVehicleIdentity
                    ? `Decoded VIN result for ${vehicleIdentity}.`
                    : `Decoded VIN ${result.vin}. ${MODEL_DATA_UNAVAILABLE}, so no model-year recall lookup ran.`
                }
              />
            </div>
          </div>
          {catalogVehicle && partsPath ? (
            <Link
              to={partsPath}
              className="btn btn-primary"
              onClick={() =>
                trackEvent('vin_catalog_handoff', {
                  vehicle: getVehicleLabel(catalogVehicle),
                })
              }
            >
              Browse {getVehicleLabel(catalogVehicle)} Parts
            </Link>
          ) : previewCoveragePath ? (
            <Link
              to={previewCoveragePath}
              className="btn btn-primary"
              onClick={() =>
                trackEvent('vin_coverage_request', {
                  vehicle: `${previewYear} ${catalogBrand?.name} ${previewModel?.name}`,
                })
              }
            >
              Request parts coverage
            </Link>
          ) : catalogBrand ? (
            <Link to={`/catalog/${catalogBrand.slug}`} className="btn btn-ghost">
              View {result.make} preview
            </Link>
          ) : (
            <a href="#demand-vin-uncovered" className="btn btn-ghost">
              {result.make ? `${result.make} parts not published` : 'Parts not published'}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
