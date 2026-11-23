import { Link } from 'react-router-dom';
import {
  BellRing,
  FileText,
  Layers,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import { getRecallWatches } from '../services/recallWatch';
import { getDemandRequests } from '../services/demand';
import { getGarageVehicles } from '../services/garage';
import { telemetryEndpointConfigured } from '../services/telemetry';
import RollingNumber from '../components/ui/RollingNumber';
import styles from '../styles/features.module.css';

const SAMPLE_VIN = '2HGFC2F59LH500001';

const TOOLS = [
  {
    icon: <FileText size={18} />,
    status: 'Live',
    title: 'VIN safety report',
    text: 'Share or print decoded specs, model-year campaigns, VIN-specific NHTSA links, model-level complaints, and next steps.',
    href: `/vin?vin=${SAMPLE_VIN}&report=1`,
    link: 'Open a sample report',
  },
  {
    icon: <BellRing size={18} />,
    status: 'On this device',
    title: 'Recall Checklist',
    text: 'Keep saved VINs on a local checklist, recheck model-year campaigns while this app is open, and keep first-seen history and self-reported repairs.',
    href: '/recall-center',
    link: 'Open the checklist',
  },
  {
    icon: <ShieldCheck size={18} />,
    status: 'Live',
    title: 'Fitment support',
    text: 'Explain a fitment conflict in the published 2020 Civic slice and surface plausible same-assembly alternatives. Confirm the exact part with a dealer before ordering.',
    href: '/catalog/honda/civic/2020/brakes/front-brake-pads',
    link: 'Open a part with fitment help',
  },
  {
    icon: <Truck size={18} />,
    status: 'Live',
    title: 'Fleet VIN checker',
    text: 'Paste or upload up to 25 VINs, review model-year campaign counts, export a CSV, and open per-VIN NHTSA checks.',
    href: '/fleet',
    link: 'Open fleet tools',
  },
  {
    icon: <Users size={18} />,
    status: 'On this device',
    title: 'Coverage demand',
    text: 'When a model or part is not published, record the VIN or vehicle and the part need in a local coverage-request list.',
    href: '/catalog/toyota',
    link: 'Try an uncovered brand',
  },
];

export default function ToolsPage() {
  const watches = getRecallWatches();
  const demand = getDemandRequests();
  const garage = getGarageVehicles();

  usePageMetadata(
    'Safety & Garage Tools — AutoParts',
    'Open the VIN safety report, Recall Checklist, fitment help, fleet checker, and coverage request.',
    {
      canonicalPath: '/tools',
      jsonLd: {
        '@type': 'CollectionPage',
        name: 'AutoParts Safety & Garage Tools',
        description: 'Safety, fitment, garage, and fleet tools for vehicles and VINs.',
      },
    },
  );

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className="eyebrow">Product layer</p>
            <h1 className={styles.title}>Safety & garage tools</h1>
            <p className={styles.subtitle}>
              The VIN decoder is the entry point. These tools turn a lookup into a portable safety
              report, a local recall checklist, a fitment explanation, a fleet workflow, and a
              coverage signal for the data we should acquire next.
            </p>
            <p className={styles.muted}>
              <strong>Live</strong> means fetched from NHTSA or published in the 2020 Civic slice.{' '}
              <strong>On this device</strong> means stored in this browser.{' '}
              <strong>Not connected</strong> means deliberately absent.
            </p>
          </div>
        </div>

        <section className={styles.summaryGrid} aria-label="Current local state">
          <div className={styles.summaryItem}>
            <RollingNumber className={styles.summaryValue} value={watches.length} />
            <span className={styles.summaryLabel}>Checklist VINs</span>
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
              <h2 id="tools-grid-title" className={styles.panelTitle}>Five practical workflows</h2>
            </div>
            <span className="badge badge-ice"><Layers size={12} /> Browser-only</span>
          </div>
          <div className={styles.grid2}>
            {TOOLS.map(tool => (
              <Link key={tool.title} to={tool.href} className={`card ${styles.toolCard}`}>
                <span className={styles.toolIcon}>{tool.icon}</span>
                <span className={`badge ${tool.status === 'Live' ? 'badge-success' : 'badge-ice'} ${styles.toolStatus}`}>
                  {tool.status}
                </span>
                <span className={styles.toolTitle}>{tool.title}</span>
                <span className={styles.toolText}>{tool.text}</span>
                <span className={styles.toolLink}>{tool.link} →</span>
              </Link>
            ))}
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
              <p className={styles.muted}>NHTSA vPIC VIN decode, model-year recalls, consumer complaints, and investigations. No API key required.</p>
            </div>
            <div className={styles.subcard}>
              <p className={styles.subcardTitle}>On this device</p>
              <p className={styles.muted}>Garage, Recall Checklist, repair marks, and coverage requests.</p>
            </div>
            <div className={styles.subcard}>
              <p className={styles.subcardTitle}>Not connected</p>
              <p className={styles.muted}>
                Commercial ACES/PIES feed, live price/stock, partner dealer routing, and
                accounts/cloud sync. These surfaces say so instead of inventing data.
              </p>
            </div>
          </div>
        </section>

        <section
          id="privacy"
          className={`card ${styles.panel}`}
          style={{ marginTop: 'var(--space-6)' }}
          aria-labelledby="privacy-title"
        >
          <div className={styles.panelHeader}>
            <div>
              <p className="eyebrow">Privacy</p>
              <h2 id="privacy-title" className={styles.panelTitle}>
                What this site measures — and what it never collects
              </h2>
            </div>
          </div>
          <p className={styles.muted}>
            {telemetryEndpointConfigured
              ? 'This build can send anonymous product events and sanitized error counts to the configured collector. It uses no advertising identifiers, cookies, or third-party analytics.'
              : 'This build has no telemetry endpoint configured, so product events and error reports stay in your browser. It uses no advertising identifiers, cookies, or third-party analytics.'}
          </p>
          <p className={styles.muted}>
            Payloads never include a VIN, email address, license plate, stock number, saved
            vehicle name, notes, raw search text, URL query string, or raw error message.
            Garage, Recall Checklist, repair marks, coverage requests, fleet sheets, and backup
            files remain in <span className="mono">localStorage</span> on this device.
          </p>
          <p className={styles.muted}>
            The full posture, including the event list and scrubbing rules, is in{' '}
            <span className="mono">docs/telemetry.md</span> in the source repository.
          </p>
        </section>
      </div>
    </div>
  );
}
