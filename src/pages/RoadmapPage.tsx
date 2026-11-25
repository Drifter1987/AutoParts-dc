import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import styles from './RoadmapPage.module.css';

type FeatureStatus = 'live' | 'local' | 'soon';

interface RoadmapFeature {
  title: string;
  text: string;
  status: FeatureStatus;
  href?: string;
  linkLabel?: string;
  needs?: string;
}

interface RoadmapPhase {
  id: string;
  number: string;
  title: string;
  goal: string;
  features: RoadmapFeature[];
}

const PHASES: RoadmapPhase[] = [
  {
    id: 'phase-1',
    number: 'Phase 1',
    title: 'Credibility & focus',
    goal: 'Make every surface truthful and useful before adding depth.',
    features: [
      {
        title: 'VIN decode & safety report',
        text: 'Real NHTSA decode, model-year recalls, complaints, and a printable report.',
        status: 'live',
        href: '/vin',
        linkLabel: 'Decode a VIN',
      },
      {
        title: 'Recall Checklist',
        text: 'Saved VINs, first-seen campaign history, and self-reported repairs in this browser.',
        status: 'local',
        href: '/recall-center',
        linkLabel: 'Open the checklist',
      },
      {
        title: 'My Garage',
        text: 'Saved vehicles, fleet-sheet import, and backup/restore without an account.',
        status: 'local',
        href: '/garage',
        linkLabel: 'Open My Garage',
      },
      {
        title: 'Coverage & fitment feedback CSV',
        text: 'Coverage requests and fitment reports export as one CSV from this device.',
        status: 'local',
        href: '/tools#feedback-export',
        linkLabel: 'Open the export',
      },
      {
        title: 'Fleet VIN checker',
        text: 'Batch model-year recall checks with a CSV export and per-VIN NHTSA links.',
        status: 'live',
        href: '/fleet',
        linkLabel: 'Open fleet tools',
      },
      {
        title: 'Honest labels & telemetry baseline',
        text: 'Live, on-device, and not-connected states; no VIN, email, plate, or notes in telemetry.',
        status: 'live',
        href: '/tools#privacy',
        linkLabel: 'Read the privacy posture',
      },
    ],
  },
  {
    id: 'phase-2',
    number: 'Phase 2',
    title: 'Core coverage',
    goal: 'Make “find the part that fits my car” real, without inventing data.',
    features: [
      {
        title: 'Parts schema, validator & loader',
        text: 'Multi-vehicle catalogs, rights metadata, fitment checks, and a strict licensing gate.',
        status: 'live',
        href: '/catalog/honda/civic/2020',
        linkLabel: 'See a validated catalog',
      },
      {
        title: 'Ranked parts search',
        text: 'Exact OEM numbers first, formatting-tolerant numbers, aliases, and typo-tolerant names.',
        status: 'live',
        href: '/search',
        linkLabel: 'Search parts',
      },
      {
        title: 'Published parts slice',
        text: 'One representative 2020 Honda Civic vehicle: 4 assemblies and 36 OEM-reference parts.',
        status: 'live',
        href: '/catalog/honda/civic/2020',
        linkLabel: 'Browse the Civic',
      },
      {
        title: 'VIN → parts handoff',
        text: 'A decoded, covered vehicle opens its exact catalog with VIN context preserved.',
        status: 'live',
        href: '/vin',
        linkLabel: 'Try a VIN',
      },
      {
        title: 'Provenance & freshness',
        text: 'Source, rights, confidence, market, last-updated date, and a freshness label per record.',
        status: 'live',
        href: '/catalog/honda/civic/2020/brakes/front-brake-pads',
        linkLabel: 'See a part record',
      },
      {
        title: 'Fitment QA & conflict explanations',
        text: 'Same-assembly alternatives, explicit mismatch reasons, and validator fixtures.',
        status: 'live',
        href: '/catalog/honda/civic/2020/engine/engine-air-filter?engine=2.0L&trim=LX',
        linkLabel: 'See a fitment conflict',
      },
      {
        title: 'Licensed 25–50 vehicle coverage',
        text: 'The next coverage step is blocked until a provider grants consumer redisplay and bulk-storage rights.',
        status: 'soon',
        needs: 'Needs a licensed parts-data agreement.',
      },
      {
        title: 'Full catalog fitment depth',
        text: 'Engine, trim, and market rules across every covered vehicle, including diagrams where rights allow.',
        status: 'soon',
        needs: 'Needs licensed fitment data and diagram rights.',
      },
    ],
  },
  {
    id: 'phase-3',
    number: 'Phase 3',
    title: 'Retention & commercial',
    goal: 'Make the product worth returning to and transacting through.',
    features: [
      {
        title: 'Accounts & cross-device sync',
        text: 'Move My Garage and the Recall Checklist between browsers under a real account.',
        status: 'soon',
        needs: 'Needs a backend, auth, and a privacy/data-retention decision.',
      },
      {
        title: 'Background recall monitoring',
        text: 'Check saved VINs while the app is closed and deliver email or SMS alerts.',
        status: 'soon',
        needs: 'Needs a scheduled backend and an email/SMS subscription.',
      },
      {
        title: 'Live pricing & availability',
        text: 'Distributor price, stock, and dealer handoff on a part page.',
        status: 'soon',
        needs: 'Needs a commerce or distributor feed subscription.',
      },
      {
        title: 'Fleet API & partner routing',
        text: 'A hosted API for batch fleet checks and partner workshop integrations.',
        status: 'soon',
        needs: 'Needs a hosted API, auth, and rate-limit plan.',
      },
      {
        title: 'Browser extension',
        text: 'A packaged extension for VIN and part lookup on supported listing pages.',
        status: 'soon',
        needs: 'Needs packaging, permissions review, and store submission.',
      },
      {
        title: 'Checkout & monetization',
        text: 'Paid plans or part referrals with clear pricing and conversion measurement.',
        status: 'soon',
        needs: 'Needs a payments provider and a business decision.',
      },
      {
        title: 'Observability & freshness alerts',
        text: 'Runbooks, data-freshness alerts, and production error monitoring.',
        status: 'soon',
        needs: 'Needs a monitoring/observability subscription.',
      },
    ],
  },
];

const STATUS_LABEL: Record<FeatureStatus, string> = {
  live: 'Live',
  local: 'On this device',
  soon: 'Planned',
};

const STATUS_CLASS: Record<FeatureStatus, string> = {
  live: styles.live,
  local: styles.local,
  soon: styles.soon,
};

export default function RoadmapPage() {
  usePageMetadata(
    'Product Roadmap — AutoParts',
    'See what is live, what runs on this device, and which licensed parts, pricing, sync, monitoring, fleet API, extension, and payments features are coming soon.',
    {
      canonicalPath: '/roadmap',
      jsonLd: {
        '@type': 'WebPage',
        name: 'AutoParts Product Roadmap',
        description: 'Live, local, and coming-soon capabilities across the three product phases.',
      },
    },
  );

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <p className="eyebrow">Three-phase product plan</p>
          <h1 className={styles.title}>What is live, and what comes next</h1>
          <p className={styles.subtitle}>
            Everything that can be delivered safely in the browser is live. Features that need a
            license, subscription, payment provider, or backend are shown as placeholders so the
            product direction is visible without pretending the capability exists.
          </p>
          <div className={styles.legend} aria-label="Status legend">
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotLive}`} /> Live
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotLocal}`} /> On this device
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.dot} ${styles.dotSoon}`} /> Coming soon
            </span>
          </div>
        </div>

        {PHASES.map(phase => (
          <section key={phase.id} className={styles.phase} aria-labelledby={phase.id}>
            <div className={styles.phaseHeader}>
              <span className={styles.phaseIndex}>{phase.number}</span>
              <div>
                <h2 id={phase.id} className={styles.phaseTitle}>
                  {phase.title}
                </h2>
                <p className={styles.phaseGoal}>{phase.goal}</p>
              </div>
            </div>

            <div className={styles.featureGrid}>
              {phase.features.map(feature => (
                <article key={feature.title} className={styles.feature}>
                  <div className={styles.featureTop}>
                    <h3 className={styles.featureTitle}>{feature.title}</h3>
                    <span className={`${styles.badge} ${STATUS_CLASS[feature.status]}`}>
                      {STATUS_LABEL[feature.status]}
                    </span>
                  </div>
                  <p className={styles.featureText}>{feature.text}</p>
                  {feature.status === 'soon' ? (
                    <>
                      <p className={styles.comingSoon}>Coming soon</p>
                      {feature.needs && <p className={styles.needs}>{feature.needs}</p>}
                    </>
                  ) : (
                    feature.href && (
                      <Link to={feature.href} className={styles.link}>
                        {feature.linkLabel ?? 'Open'} <ArrowRight size={12} aria-hidden="true" />
                      </Link>
                    )
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}

        <div className={styles.cta}>
          <div>
            <p className="eyebrow">Use what is live</p>
            <h2 className={styles.phaseTitle} style={{ marginTop: 4 }}>
              Start with a VIN, then follow the part
            </h2>
          </div>
          <div className={styles.legend}>
            <Link to="/vin" className="btn btn-primary">
              Decode a VIN
            </Link>
            <Link to="/search" className="btn btn-ghost">
              Search parts
            </Link>
            <Link to="/tools" className="btn btn-ghost">
              Open tools
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
