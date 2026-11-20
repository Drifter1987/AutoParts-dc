import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const REVEAL_SELECTOR = [
  'main section',
  'main article',
  'main .card',
  'main h1',
  'main h2',
  'main h3',
  'main [data-scroll-reveal]',
].join(', ');

const SKIP_SELECTOR = 'header, footer, nav, [data-no-scroll-reveal]';

/**
 * Adds the reveal class to page sections, cards, and headings, then reveals them
 * as they enter the viewport. A MutationObserver keeps tabs and async panels covered.
 */
export default function ScrollEffects() {
  const { pathname } = useLocation();

  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main');
    if (!main) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canObserve = !reducedMotion && 'IntersectionObserver' in window;
    const seen = new WeakSet<HTMLElement>();
    let scanFrame = 0;

    let observer: IntersectionObserver | null = null;
    if (canObserve) {
      observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-visible');
            observer?.unobserve(entry.target);
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
      );
    }

    const scan = () => {
      scanFrame = 0;
      let index = 0;
      for (const element of main.querySelectorAll<HTMLElement>(REVEAL_SELECTOR)) {
        if (seen.has(element) || element.closest(SKIP_SELECTOR)) continue;
        seen.add(element);
        element.classList.add('scroll-reveal');
        element.style.setProperty('--scroll-reveal-delay', `${Math.min(index, 8) * 35}ms`);
        index += 1;

        const rect = element.getBoundingClientRect();
        const inView = rect.top < window.innerHeight * 0.94 && rect.bottom > 0;
        if (observer && !inView) observer.observe(element);
        else element.classList.add('is-visible');
      }
    };

    scan();

    const mutationObserver = new MutationObserver(() => {
      if (scanFrame) return;
      scanFrame = window.requestAnimationFrame(scan);
    });
    mutationObserver.observe(main, { childList: true, subtree: true });

    return () => {
      if (scanFrame) window.cancelAnimationFrame(scanFrame);
      observer?.disconnect();
      mutationObserver.disconnect();
    };
  }, [pathname]);

  return null;
}
