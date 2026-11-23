import {
  sanitizeTelemetryProperties,
  type TelemetryProperties,
} from './telemetrySanitizer';

export type { TelemetryProperties } from './telemetrySanitizer';

/**
 * Privacy-friendly telemetry boundary.
 *
 * Set VITE_TELEMETRY_ENDPOINT to a collector that accepts POSTed JSON. Without
 * an endpoint nothing leaves the browser; development builds log locally so
 * the event wiring is still visible. Every payload goes through the shared
 * sanitizer, so VINs, email addresses, plates, notes, raw queries, and raw
 * error text never reach a collector.
 */
const endpoint = import.meta.env.VITE_TELEMETRY_ENDPOINT?.trim();
let initialized = false;

/** True when this build has a collector configured. */
export const telemetryEndpointConfigured = Boolean(endpoint);

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

function safePath(): string | undefined {
  return sanitizeTelemetryProperties({ path: window.location.pathname }).path as
    | string
    | undefined;
}

export function trackEvent(event: string, properties: TelemetryProperties = {}): void {
  const payload = {
    event,
    properties: sanitizeTelemetryProperties(properties),
    path: safePath(),
    timestamp: new Date().toISOString(),
  };

  if (import.meta.env.DEV) {
    console.debug('[telemetry]', payload);
  }

  post({ kind: 'event', ...payload });
}

export function reportError(error: unknown, context: TelemetryProperties = {}): void {
  const message = error instanceof Error ? error.message : String(error);
  const errorType = error instanceof Error ? error.name : typeof error;
  const safeContext = sanitizeTelemetryProperties(context);

  if (import.meta.env.DEV) {
    console.error('[telemetry:error]', message, safeContext);
  }

  // Keep production errors observable without shipping raw error text, which
  // can contain VINs, paths, or user input.
  post({
    kind: 'error',
    errorType,
    messageLength: message.length,
    context: safeContext,
    path: safePath(),
  });
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
