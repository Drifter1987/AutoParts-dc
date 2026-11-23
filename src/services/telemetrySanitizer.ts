export type TelemetryValue = string | number | boolean | null | undefined;

export interface TelemetryProperties {
  [key: string]: TelemetryValue;
}

// Keep this list explicit: it is the privacy boundary for every event and
// error payload. VIN, contact details, plates, notes, raw queries, and raw
// error text must never be sent, even if a caller adds them by mistake.
const SENSITIVE_PROPERTY_KEY =
  /(vin|email|e-mail|plate|license_?plate|notes?|query|search|message|name|stock_?number)/i;
const SAFE_METRIC_KEY = /^(queryLength|messageLength)$/;

const VIN_VALUE = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
const EMAIL_VALUE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Drop sensitive keys and values before a payload reaches the collector. */
export function sanitizeTelemetryProperties(
  properties: TelemetryProperties,
): TelemetryProperties {
  const safe: TelemetryProperties = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!SAFE_METRIC_KEY.test(key) && SENSITIVE_PROPERTY_KEY.test(key)) continue;

    if (
      typeof value === 'string' &&
      (VIN_VALUE.test(value) || EMAIL_VALUE.test(value) || value.includes('@'))
    ) {
      continue;
    }

    safe[key] = value;
  }

  return safe;
}
