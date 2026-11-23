# Telemetry and error posture

This is the repo's written telemetry posture for Phase 1 (plan item P1-06).
The boundary lives in `src/services/telemetry.ts`; the privacy scrubber lives in
`src/services/telemetrySanitizer.ts`.

## Where events go

- **Default: nowhere.** `VITE_TELEMETRY_ENDPOINT` is unset in normal builds, so
  `post()` returns before any network call. No third-party analytics script,
  cookie, advertising identifier, or account is used.
- **Configured collector:** when `VITE_TELEMETRY_ENDPOINT` is set, events are
  POSTed as JSON to that endpoint. `trackEvent` uses `navigator.sendBeacon`
  with a `fetch(..., { keepalive: true })` fallback so a navigation does not
  silently drop the last event.
- **Local development:** development builds also print the same sanitized
  payloads to the browser console. Production builds do not log payloads.
- **Test proof:** Playwright sets a loopback endpoint and asserts on the actual
  captured JSON in `tests/telemetry.spec.ts`.

## Events required by the Phase 1 funnel

| Event | Real user action | Safe properties |
| --- | --- | --- |
| `vin_decode_success` | A VIN decode returns usable NHTSA data. | `year`, `make`, `model` |
| `vin_decode_failure` | A VIN decode fails. | `source` |
| `vin_report_print` | The user chooses **Print / save PDF** on a VIN report. | none |
| `vin_report_share` | The user opens the share sheet or copies the report link. | `path` |
| `parts_search` | A non-empty search settles for 450 ms. | `queryLength`, `resultCount`, `hasVehicleFilter` |
| `catalog_dead_end` | A valid brand/model/year route has no published catalog vehicle. | `vehicle` |
| `garage_import` | A fleet sheet import finishes. | `parsed`, `imported`, `matched`, `skipped`, `dropped` |
| `checklist_recheck` | A Recall Checklist watch is checked (automatic or manual). | `campaigns`, `newCampaigns`, `automatic` |

Supporting events (`page_view`, catalog/part views, print events, camera events,
garage save/remove/backup events, fleet checks, `recall_watch_added`,
`recall_repair_marked`, `coverage_demand_captured`, and online/offline notices)
use the same sanitizer.

## What is never collected

The following must never appear in an event or error payload, even if a caller
adds it later:

- VINs or partial VINs
- email addresses or phone numbers
- license plates, stock numbers, or AU numbers
- user names, saved vehicle names, notes, or free-text demand input
- raw search text or URL query strings
- raw error messages or stack traces
- precise location, cookies, account identifiers, or advertising identifiers

Local-only data (My Garage, Recall Checklist, repair marks, coverage requests,
fleet sheets, and backup files) stays in the browser's `localStorage` and is not
uploaded by telemetry.

## Scrubbing and the error baseline

Every payload runs through `sanitizeTelemetryProperties()`:

1. Keys matching VIN, email, plate, notes, query/search, message, name, or
   stock-number patterns are dropped entirely.
2. String values that look like a 17-character VIN or contain an email address
   (any `@`) are dropped.
3. Numbers, booleans, and safe strings such as counts and catalog labels pass.

`reportError()` applies the same scrubber and deliberately sends only
`errorType`, `messageLength`, sanitized `context`, and `path` — never the raw
message or stack. Global `window.error` and `unhandledrejection` listeners, plus
the React `ErrorBoundary`, all go through `reportError()`.

## User-facing privacy note

The Tools page has a stable `#privacy` section (`/tools#privacy`) that a user can
read without opening this file. It states the destination, the never-collected
list, and that garage/checklist/coverage data stays local. The footer links to
it. This document is the fuller posture the page cites.

## Verification

- Pure scrubber test: `tests/telemetry.spec.ts` imports
  `sanitizeTelemetryProperties` and asserts sensitive keys and values are
  removed.
- Payload test: the same spec exercises decode failure/success, report print,
  report share, search, catalog dead end, garage import, checklist recheck, and
  an error event, then asserts no VIN, email, plate, note, raw query, or raw
  error text appears anywhere in the captured payloads.
- Full gate: `npx tsc -b`, `npm run lint`, `npm run build`, and
  `PLAYWRIGHT_CHANNEL=msedge npx playwright test --reporter=line`.
