import { Link } from 'react-router-dom';
import {
  BellRing,
  Bookmark,
  CircleDollarSign,
  FileText,
  Layers,
  Puzzle,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { getCommercialCoverage } from '../services/commercial';
import { getRecallWatches } from '../services/recallWatch';
import { getFitmentVerifications } from '../services/verification';
import { getDemandRequests } from '../services/demand';
import { getGarageVehicles } from '../services/garage';
import RollingNumber from '../components/ui/RollingNumber';
import styles from '../styles/features.module.css';

const SAMPLE_VIN = '2HGFC2F59LH500001';

const TOOLS = [
  {
    icon: <FileText size={18} />,
    title: 'VIN safety report',
    text: 'Share or print decoded specs, model-year campaigns, VIN-specific NHTSA links, model-level complaints, and next steps.',
    href: `/vin?vin=${SAMPLE_VIN}&report=1`,
    link: 'Open a sample report',
  },
  {
    icon: <BellRing size={18} />,
    title: 'Recall Watch',
    text: 'Watch saved VINs, recheck model-year campaigns, keep first-seen history, and mark self-reported repairs.',
    href: '/recall-center',
    link: 'Open the action center',
  },
  {
    icon: <ShieldCheck size={18} />,
    title: 'Fitment support',
    text: 'Explain a conflict, surface plausible same-assembly alternatives, request dealer verification, or report incorrect fitment.',
    href: '/catalog/honda/civic/2020/brakes/front-brake-pads',
    link: 'Open a part with fitment help',
  },
  {
    icon: <CircleDollarSign size={18} />,
    title: 'Commercial layer',
    text: 'The ACES/PIES and distributor availability adapter is intentionally empty. Offers only appear after exact fitment is confirmed.',
    href: '/catalog/honda/civic/2020/engine/engine-oil-filter',
    link: 'Inspect the placeholder state',
  },
  {
    icon: <Truck size={18} />,
    title: 'Fleet VIN checker',
    text: 'Paste or upload up to 25 VINs, review model-year campaign counts, export a CSV, and open per-VIN NHTSA checks.',
    href: '/fleet',
    link: 'Open fleet tools',
  },
  {
    icon: <Bookmark size={18} />,
    title: 'Garage transfer',
    text: 'Export My Garage as a transfer code, import it on another browser, and see the optional account adapter status.',
    href: '/garage',
    link: 'Open My Garage',
  },
  {
    icon: <Users size={18} />,
    title: 'Coverage demand',
    text: 'When a model or part is not published, capture the VIN, vehicle, part need, and optional email into a local demand list.',
    href: '/catalog/toyota',
    link: 'Try an uncovered brand',
  },
  {
    icon: <Puzzle size={18} />,
    title: 'Listing browser extension',
    text: 'A Manifest V3 content script detects VINs on supported listing sites and surfaces specs, recalls, and the report link.',
    href: '#extension',
    link: 'View install and privacy notes',
  },
];

export default function ToolsPage() {
  const coverage = getCommercialCoverage();
  const watches = getRecallWatches();
  const verifications = getFitmentVerifications();
  const demand = getDemandRequests();
  const garage = getGarageVehicles();

  usePageMetadata(
    'Safety & Fleet Tools — AutoParts',
    'Open the VIN safety report, recall watch, fitment support, commercial availability layer, fleet checker, garage transfer, and browser extension.',
    {
      canonicalPath: '/tools',
      jsonLd: {
        '@type': 'CollectionPage',
        name: 'AutoParts Safety & Fleet Tools',
        description: 'Safety, fitment, and fleet tools for vehicles and VINs.',
      },
    },
  );

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Product layer</p>
            <h1 className={styles.title}>Safety & fleet tools</h1>
            <p className={styles.subtitle}>
              The VIN decoder is the entry point. These tools turn a lookup into a portable safety
              report, a returning recall watch, a fitment conversation, a fleet workflow, and a
              demand signal for the data we should acquire next.
            </p>
          </div>
        </div>

        <section className={styles.summaryGrid} aria-label="Current local state">
          <div className={styles.summaryItem}>
            <RollingNumber className={styles.summaryValue} value={coverage.fitmentRecords} />
            <span className={styles.summaryLabel}>Commercial fitment records</span>
          </div>
          <div className={styles.summaryItem}>
            <RollingNumber className={styles.summaryValue} value={watches.length} />
            <span className={styles.summaryLabel}>Watched VINs</span>
          </div>
          <div className={styles.summaryItem}>
            <RollingNumber className={styles.summaryValue} value={garage.length} />
            <span className={styles.summaryLabel}>Garage vehicles</span>
          </div>
          <div className={styles.summaryItem}>
            <RollingNumber className={styles.summaryValue} value={demand.length} />
            <span className={styles.summaryLabel}>Coverage requests</span>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="tools-grid-title" style={{ marginTop: 'var(--space-8)' }}>
          <div className={styles.panelHeader}>
            <div>
              <p className="eyebrow">Start here</p>
              <h2 id="tools-grid-title" className={styles.panelTitle}>Eight connected workflows</h2>
            </div>
            <span className="badge badge-ice"><Layers size={12} /> Local-first</span>
          </div>
          <div className={styles.grid2}>
            {TOOLS.map(tool => (
              <Link key={tool.title} to={tool.href} className={`card ${styles.toolCard}`}>
                <span className={styles.toolIcon}>{tool.icon}</span>
                <span className={styles.toolTitle}>{tool.title}</span>
                <span className={styles.toolText}>{tool.text}</span>
                <span className={styles.toolLink}>{tool.link} →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className={`card ${styles.panel}`} id="extension" style={{ marginTop: 'var(--space-6)' }} aria-labelledby="extension-title">
          <div className={styles.panelHeader}>
            <div>
              <p className="eyebrow">Distribution wedge</p>
              <h2 id="extension-title" className={styles.panelTitle}>Used-car-listing browser extension</h2>
            </div>
            <span className="badge badge-amber">Source included</span>
          </div>
          <div className={styles.grid2}>
            <div>
              <p className={styles.label}>What it does</p>
              <p className={styles.muted}>
                A Manifest V3 content script watches supported listing pages for a valid 17-character
                VIN, calls NHTSA vPIC for decoded specs, and adds a small in-page panel with the
                model-year recall link, VIN-specific NHTSA check, and the printable AutoParts report.
              </p>
              <p className={styles.label} style={{ marginTop: 'var(--space-4)' }}>Load it locally</p>
              <ol className={styles.muted} style={{ paddingLeft: 'var(--space-5)', lineHeight: 1.8 }}>
                <li>Open the repository’s <span className="mono">extension/</span> folder.</li>
                <li>Open <span className="mono">chrome://extensions</span> and enable Developer mode.</li>
                <li>Choose “Load unpacked” and select the <span className="mono">extension/</span> folder.</li>
                <li>Visit a supported listing page and look for the AutoParts VIN panel.</li>
              </ol>
            </div>
            <div className={`${styles.status} ${styles.statusInfo}`}>
              <Puzzle size={16} aria-hidden="true" />
              <span>
                The extension is source-only in this build; it is not published to a browser store.
                It reads the current listing page and calls the NHTSA vPIC and recalls hosts only,
                does not read cookies, and sends no analytics. Store packaging, listing-site DOM
                changes, and review permissions remain release work.
              </span>
            </div>
          </div>
        </section>

        <section className={`card ${styles.panel}`} style={{ marginTop: 'var(--space-6)' }} aria-labelledby="data-layer-title">
          <div className={styles.panelHeader}>
            <div>
              <p className="eyebrow">Provenance</p>
              <h2 id="data-layer-title" className={styles.panelTitle}>What is real, what is empty</h2>
            </div>
          </div>
          <div className={styles.grid3}>
            <div className={styles.subcard}>
              <p className={styles.subcardTitle}>Live</p>
              <p className={styles.muted}>NHTSA vPIC VIN decode, model-year recalls, and consumer complaints. No API key required.</p>
            </div>
            <div className={styles.subcard}>
              <p className={styles.subcardTitle}>Local-only</p>
              <p className={styles.muted}>Garage, recall watch, repair marks, verification requests, corrections, demand requests, and transfer codes.</p>
            </div>
            <div className={styles.subcard}>
              <p className={styles.subcardTitle}>Not connected</p>
              <p className={styles.muted}>
                Commercial ACES/PIES feed, live price/stock, partner dealer routing, magic-link
                accounts, fleet API, investigations, and manufacturer communications. These surfaces
                say so instead of inventing data.
              </p>
            </div>
          </div>
          <p className={styles.panelMeta} style={{ marginTop: 'var(--space-4)' }}>
            Queue count: {verifications.length} fitment verification request
            {verifications.length === 1 ? '' : 's'} · {coverage.offers} commercial offer
            {coverage.offers === 1 ? '' : 's'} · {coverage.source ?? 'no commercial source connected'}.
          </p>
        </section>
      </div>
    </div>
  );
}
