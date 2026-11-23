import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellPlus, BellRing } from 'lucide-react';
import {
  getRecallWatch,
  recallWatchChangedEvent,
  recallWatchWriteError,
  watchRecallResult,
} from '../../services/recallWatch';
import { trackEvent } from '../../services/telemetry';
import type { VINDecodeResult } from '../../types';

interface RecallWatchButtonProps {
  result: VINDecodeResult;
  className?: string;
  reportMode?: boolean;
}

export default function RecallWatchButton({
  result,
  className = 'btn btn-ghost',
  reportMode = false,
}: RecallWatchButtonProps) {
  const [watching, setWatching] = useState(() => Boolean(getRecallWatch(result.vin)));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setWatching(Boolean(getRecallWatch(result.vin)));
      setError(null);
    };
    window.addEventListener(recallWatchChangedEvent(), refresh);
    return () => window.removeEventListener(recallWatchChangedEvent(), refresh);
  }, [result.vin]);

  if (watching) {
    return (
      <Link
        to="/recall-center"
        className={className}
        data-report-action={reportMode ? '' : undefined}
        aria-label={`Recall checklist is active for ${result.vin}`}
      >
        <BellRing size={14} /> On your checklist
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className={className}
        data-report-action={reportMode ? '' : undefined}
        onClick={() => {
          const { outcome } = watchRecallResult(result);
          const failure = recallWatchWriteError(outcome);
          if (failure) {
            setError(failure);
            return;
          }
          setError(null);
          setWatching(true);
          trackEvent('recall_watch_added');
        }}
      >
        <BellPlus size={14} /> Add to checklist
      </button>
      {error && (
        <p
          role="alert"
          style={{
            flexBasis: '100%',
            margin: 0,
            color: 'var(--error)',
            fontSize: '0.8rem',
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      )}
    </>
  );
}
