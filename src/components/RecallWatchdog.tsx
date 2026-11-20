import { useEffect } from 'react';
import { getRecallsForVehicle } from '../services/recalls';
import { getRecallWatches, recordRecallCheck } from '../services/recallWatch';

const AUTO_RECHECK_MS = 5 * 60 * 1000;

interface RecallWatchdogProps {
  pathname: string;
}

/**
 * The Recall Watch page owns its own visible recheck loop. Everywhere else,
 * keep saved watches fresh in the background while the app is open.
 */
export default function RecallWatchdog({ pathname }: RecallWatchdogProps) {
  useEffect(() => {
    if (pathname === '/recall-center') return;

    const recheck = () => {
      if (document.visibilityState !== 'visible') return;
      const watches = getRecallWatches();
      if (!watches.length) return;

      void Promise.all(
        watches.map(async watch => {
          try {
            const recalls = await getRecallsForVehicle(watch);
            recordRecallCheck(watch, recalls);
          } catch {
            // A failed background check leaves the previous snapshot intact.
          }
        }),
      );
    };

    const interval = window.setInterval(recheck, AUTO_RECHECK_MS);
    window.addEventListener('focus', recheck);
    document.addEventListener('visibilitychange', recheck);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', recheck);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, [pathname]);

  return null;
}
