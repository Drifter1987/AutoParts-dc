import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { checkFitment } from '../../services/parts';
import CopyButton from './CopyButton';
import type { CatalogPart } from '../../types';
import styles from '../../styles/parts.module.css';

interface PartListProps {
  parts: (CatalogPart & { assemblyName?: string; assemblySlug?: string })[];
  hrefForPart: (part: CatalogPart & { assemblySlug?: string }) => string;
  engine?: string;
  trim?: string;
  hasVin?: boolean;
  vehicleLabel?: string;
}

const toneClass = {
  success: styles.partBadgeSuccess,
  warning: styles.partBadgeWarning,
  error: styles.partBadgeError,
};

export default function PartList({
  parts,
  hrefForPart,
  engine = '',
  trim = '',
  hasVin = false,
  vehicleLabel = '',
}: PartListProps) {
  return (
    <div className={styles.partList}>
      {parts.map(part => {
        const fitment = checkFitment(part, engine, trim, hasVin, vehicleLabel);
        return (
          <div key={part.slug} className={styles.partRow}>
            <Link to={hrefForPart(part)} className={styles.partMain}>
              <span className={styles.partName}>{part.name}</span>
              <span className={styles.partNumber}>
                {part.oemNumber}
                {part.supersedes.length > 0 && (
                  <span className={styles.partMeta}>supersedes {part.supersedes.join(', ')}</span>
                )}
              </span>
              {'assemblyName' in part && part.assemblyName && (
                <span className={styles.partMeta}>{part.assemblyName}</span>
              )}
            </Link>
            <div className={styles.partActions}>
              <span className={`${styles.partBadge} ${toneClass[fitment.tone]}`}>
                {fitment.label}
              </span>
              <CopyButton
                value={part.oemNumber}
                label="OEM number"
                className={`btn btn-ghost ${styles.smallButton} ${styles.noPrint}`}
              />
              <Link
                to={hrefForPart(part)}
                aria-label={`View ${part.name} details`}
                className={`btn btn-ghost ${styles.smallButton}`}
              >
                Details <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
