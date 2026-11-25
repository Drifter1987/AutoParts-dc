import type { ReactNode } from 'react';
import styles from '../../styles/features.module.css';

interface ComingSoonProps {
  title: string;
  children?: ReactNode;
  compact?: boolean;
}

/**
 * A visible placeholder for work that needs a subscription, license, payment
 * provider, or backend. It must never render fake data behind the label.
 */
export default function ComingSoon({ title, children, compact = false }: ComingSoonProps) {
  return (
    <div className={compact ? styles.comingSoonCompact : styles.subcard}>
      <p className={styles.subcardTitle}>{title}</p>
      {children && <p className={styles.muted}>{children}</p>}
      <p className={styles.comingSoon}>Coming soon</p>
    </div>
  );
}
