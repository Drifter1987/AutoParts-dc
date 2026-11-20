import { useEffect, useRef, useState } from 'react';

interface RollingNumberProps {
  value: number;
  duration?: number;
  className?: string;
  format?: (value: number) => string;
}

/**
 * Counts up from zero the first time the number enters the viewport.
 * The accessible label always exposes the final value, not the animation frame.
 */
export default function RollingNumber({
  value,
  duration = 900,
  className,
  format = number => Math.round(number).toLocaleString('en-US'),
}: RollingNumberProps) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const target = Number.isFinite(value) ? value : 0;
    startedRef.current = false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const reducedTimer = window.setTimeout(() => setDisplay(target), 0);
      return () => window.clearTimeout(reducedTimer);
    }

    let fallback = 0;
    const run = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      window.clearTimeout(fallback);
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(target * eased);
        if (progress < 1) frameRef.current = window.requestAnimationFrame(tick);
      };
      frameRef.current = window.requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) {
      run();
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        run();
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    // Keep off-screen dashboard values from sitting at zero indefinitely.
    fallback = window.setTimeout(run, 1200);

    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return (
    <span ref={nodeRef} className={className} aria-label={String(value)}>
      {format(display)}
    </span>
  );
}
