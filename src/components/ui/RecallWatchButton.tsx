import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellPlus, BellRing } from 'lucide-react';
import {
  getRecallWatch,
  recallWatchChangedEvent,
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

  useEffect(() => {
    const refresh = () => setWatching(Boolean(getRecallWatch(result.vin)));
    window.addEventListener(recallWatchChangedEvent(), refresh);
    return () => window.removeEventListener(recallWatchChangedEvent(), refresh);
  }, [result.vin]);

  if (watching) {
    return (
      <Link
        to="/recall-center"
        className={className}
        data-report-action={reportMode ? '' : undefined}
        aria-label={`Recall watch is active for ${result.vin}`}
      >
        <BellRing size={14} /> Watching recalls
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      data-report-action={reportMode ? '' : undefined}
      onClick={() => {
        watchRecallResult(result);
        setWatching(true);
        trackEvent('recall_watch_added', { vin: result.vin });
      }}
    >
      <BellPlus size={14} /> Watch recalls
    </button>
  );
}
