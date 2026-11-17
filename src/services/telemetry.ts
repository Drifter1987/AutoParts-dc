/**
 * Privacy-friendly telemetry boundary.
 *
 * Set VITE_TELEMETRY_ENDPOINT to a collector that accepts POSTed JSON. Without an
 * endpoint events stay local (debug builds only) and errors still surface in the
 * console, so the app never invents a third-party account or sends data silently.
 */
type TelemetryValue = string | number | boolean | null | undefined;

export interface TelemetryProperties {
  [key: string]: TelemetryValue;
}

const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT?.trim();
let initialized = false;

function post(payload: Record<string, unknown>): void {
  if (!endpoint) return;
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry must never break the product.
  }
}

export function trackEvent(event: string, properties: TelemetryProperties = {}): void {
  const payload = {
    event,
    properties,
    path: window.location.pathname,
    timestamp: new Date().toISOString(),
  };

  if (import.meta.env.DEV) {
    console.debug('[telemetry]', payload);
  }

  post({ kind: 'event', ...payload });
}

export function reportError(error: unknown, context: TelemetryProperties = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  if (import.meta.env.DEV) {
    console.error('[telemetry:error]', message, context);
  }

  post({ kind: 'error', message, stack, context, path: window.location.pathname });
}

/** Register global error hooks once. */
export function initTelemetry(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', event => {
    reportError(event.error ?? event.message, { source: 'window.error' });
  });
  window.addEventListener('unhandledrejection', event => {
    reportError(event.reason, { source: 'unhandledrejection' });
  });
  window.addEventListener('online', () => trackEvent('network_online'));
  window.addEventListener('offline', () => trackEvent('network_offline'));
}
