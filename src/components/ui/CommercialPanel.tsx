import { ArrowUpRight, CircleDollarSign, Database, ShieldCheck } from 'lucide-react';
import {
  getCommercialCoverage,
  getCommercialDisclosure,
  getCommercialFitment,
  getOffersForPart,
  type CommercialVehicle,
} from '../../services/commercial';
import styles from '../../styles/features.module.css';

interface CommercialPanelProps {
  partNumber: string;
  partName: string;
  vehicle: CommercialVehicle;
  fitmentConfirmed: boolean;
}

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Price unavailable';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price);
  } catch {
    return `${price.toFixed(2)} ${currency}`;
  }
}

export default function CommercialPanel({
  partNumber,
  partName,
  vehicle,
  fitmentConfirmed,
}: CommercialPanelProps) {
  const coverage = getCommercialCoverage();
  const record = getCommercialFitment(partNumber, vehicle);
  const offers = getOffersForPart(partNumber, fitmentConfirmed && Boolean(record));

  return (
    <section className={`card ${styles.panel}`} aria-labelledby="commercial-title">
      <div className={styles.panelHeader}>
        <div>
          <p className="eyebrow">Commercial layer</p>
          <h2 id="commercial-title" className={styles.panelTitle}>
            Fitment, price & availability
          </h2>
        </div>
        <span className="badge badge-ice">
          {coverage.connected ? 'Feed connected' : 'Feed not connected'}
        </span>
      </div>

      {!coverage.connected && (
        <div className={`${styles.status} ${styles.statusWarning}`} role="status">
          <Database size={16} aria-hidden="true" />
          <div>
            <strong>No ACES/PIES or distributor feed is connected.</strong>
            <p style={{ marginTop: 3 }}>
              This record is ready for licensed commercial fitment and availability data, but the
              placeholder feed is intentionally empty. No price, stock, or purchase link is shown
              until an exact part number and fitment match exist.
            </p>
          </div>
        </div>
      )}

      <div className={styles.grid3} style={{ marginTop: 'var(--space-4)' }}>
        <article className={styles.subcard}>
          <p className={styles.subcardTitle}><ShieldCheck size={15} /> Fitment gate</p>
          <p className={styles.muted}>
            {fitmentConfirmed && record
              ? 'Exact commercial fitment record found; offers can be shown below.'
              : 'Purchase links stay hidden until the catalog fitment check is successful and a commercial record matches this exact part.'}
          </p>
          <p className={styles.panelMeta} style={{ marginTop: 'var(--space-3)' }}>
            {record ? `${record.source} · ${record.confidence}` : 'No exact commercial record for this vehicle.'}
          </p>
        </article>

        <article className={styles.subcard}>
          <p className={styles.subcardTitle}><CircleDollarSign size={15} /> Availability</p>
          <span className={styles.metric}>{offers.length}</span>
          <p className={styles.metricLabel}>neutral offers with live stock data</p>
          <p className={styles.muted} style={{ marginTop: 'var(--space-3)' }}>
            Retailer ranking is neutral and every link will disclose its fitment confidence.
            Availability is never inferred from the catalog.
          </p>
        </article>

        <article className={styles.subcard}>
          <p className={styles.subcardTitle}><Database size={15} /> Coverage</p>
          <p className={styles.metric}>{coverage.fitmentRecords}</p>
          <p className={styles.metricLabel}>fitment records · {coverage.offers} offers</p>
          <p className={styles.muted} style={{ marginTop: 'var(--space-3)' }}>
            Target first: high-turn maintenance parts for the most-searched models. Current
            catalog: {partName}.
          </p>
        </article>
      </div>

      {offers.length > 0 && (
        <div className={styles.stack} style={{ marginTop: 'var(--space-4)' }}>
          {offers.map(offer => (
            <div key={offer.id} className={styles.subcard}>
              <div className={styles.panelHeader} style={{ marginBottom: 4 }}>
                <strong>{offer.retailer}</strong>
                <span className={styles.panelMeta}>{formatPrice(offer.price, offer.currency)}</span>
              </div>
              <p className={styles.muted}>
                {offer.inStock === null ? 'Stock not supplied' : offer.inStock ? 'In stock' : 'Out of stock'}
                {' · '}
                {offer.fitmentConfidence} fitment · {offer.disclosure}
              </p>
              <a
                className={styles.link}
                href={offer.url}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', gap: 4, marginTop: 'var(--space-2)', fontSize: '0.8rem' }}
              >
                View at {offer.retailer} <ArrowUpRight size={12} />
              </a>
            </div>
          ))}
        </div>
      )}

      <p className={styles.panelMeta} style={{ marginTop: 'var(--space-4)' }}>
        {getCommercialDisclosure()}
      </p>
    </section>
  );
}
