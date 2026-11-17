import { Link } from 'react-router-dom';
import { Wrench, ArrowLeft } from 'lucide-react';
import { usePageMetadata } from '../hooks/usePageMetadata';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  usePageMetadata(
    'Page Not Found — AutoParts',
    'The page you requested could not be found. Return to AutoParts to decode a VIN or browse the vehicle catalog.',
  );

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <div className={styles.icon}>
          <Wrench size={40} />
        </div>
        <p className="eyebrow">404 — Part Not Found</p>
        <h1 className={styles.title}>Wrong turn</h1>
        <p className={styles.subtitle}>
          This page doesn't exist — like a discontinued OEM part.
        </p>
        <div className={styles.actions}>
          <Link to="/" className="btn btn-primary">
            <ArrowLeft size={15} /> Back to Home
          </Link>
          <Link to="/catalog" className="btn btn-ghost">
            Browse Catalog
          </Link>
        </div>
      </div>
    </div>
  );
}
