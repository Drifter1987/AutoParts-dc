# AutoParts-fb — Three-Phase Improvement Plan

**Status:** Draft for execution  
**Baseline app commit:** `13d0eed` (deployed; Pages run `45067537086`)  
**Baseline grade:** C+ overall — strong engineering, weak parts depth, too many empty surfaces  
**Product goal:** a trustworthy VIN-first way to identify a vehicle, check its safety record, and find the part that fits.  
**Execution status (2026-11-23):** P1-01 through P1-06 complete and verified; P1-08 verification, tracker update, and deployment are done, leaving only P1-07's provider selection open on the Phase 1 gate. `docs/parts-data-spec.md` holds the 36-vehicle draft; no provider is chosen or implied.

This file is the execution plan and backlog. Work top to bottom. Do not start a phase until its predecessor's gate is met. One backlog item should normally be one branch and one commit.

---

## 0. How to use this plan

### Status legend

| Mark | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Done and verified |
| `[!]` | Blocked — record the blocker in the item |
| `[-]` | Dropped or deferred — record why |

### Rules for every item

1. Read `PROJECT_TRACKER.md` before changing behavior, data claims, accessibility, or deployment.
2. Keep the item small enough to review as one change. If it grows, split it and update this file.
3. Update the backlog status and add the commit/run ID in the item when done.
4. Run the checks listed on the item before marking it done.
5. Never commit VIN lists, license plates, stock numbers, backup files, or `docs/fleet-vehicles.md`.
6. Do not push or deploy without explicit authorization. If authorized, pushing to `main` triggers GitHub Pages; verify the deployed origin afterward.
7. If a task cannot meet its acceptance criteria, leave it `[!]` and write the reason. Do not weaken a test or a claim to make it pass.

### Standard verification commands

```bash
npx tsc -b
npm run lint
npm run build
PLAYWRIGHT_CHANNEL=msedge npx playwright test --reporter=line
```

For a focused change, run the affected spec plus:

```bash
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/accessibility.spec.ts --reporter=line
```

### Non-negotiables

- **Data honesty:** never invent parts, fitment, prices, stock, recall status, or coverage. If a surface is not connected, say so or remove it.
- **VIN/camera privacy:** camera frames and uploaded photos are processed locally; no image is uploaded.
- **Accessibility/mobile:** serious or critical Axe violations are failures. Core flows must work at 320/360/390 px with 44 px touch targets and keyboard support.
- **No backend by default:** do not add auth, a database, or a server merely to solve a client-side problem. Phase 3 explicitly revisits this as a product decision.
- **No unsolicited deployment:** building and prerendering locally is allowed; pushing and deploying require authorization.

---

## 1. Baseline and phase map

### Current facts

| Area | Baseline |
|---|---|
| VIN/safety | Real NHTSA decode, recalls, complaints; strong international/inferred-identity states |
| Parts catalog | **1 vehicle** (2020 Honda Civic), 4 assemblies, 36 parts |
| Brand metadata | 63 brands, 1,249 models — mostly without parts |
| Commercial data | 0 fitment records, 0 offers, no source |
| Retention | localStorage only: garage, checklist, demand, verification |
| Tests | >100 Playwright tests; Axe gate on core routes |
| Performance | Entry 253.7 kB / 81.7 kB gzip; brands chunk 201 kB |

### Phase map

| Phase | Goal | Main output | Gate |
|---|---|---|---|
| **1 — Credibility & focus** | Stop presenting empty surfaces as product; measure the real funnel | Clean, honest UI; Recall Checklist; consolidated garage; analytics/error baseline; data-provider shortlist | No empty product surfaces; no PII without delivery; baseline funnel exists; provider selected |
| **2 — Core coverage** | Make “find the part that fits my car” real | 25–50 vehicles with licensed parts/fitment; VIN-first flow; search/provenance/scale | 25+ validated vehicles; VIN-to-part works; search and fitment quality measured |
| **3 — Retention & commercial** | Make it worth returning to and transacting through | Accounts/sync, real monitoring, availability/pricing, fleet pilot, extension decision | Cross-device retention; monitoring delivered; one real commerce source; fleet validated or de-scoped |

---

## 2. Phase 1 — Credibility, focus, and measurement

**Effort:** 3–5 weeks · **Risk:** low · **Dependencies:** none  
**Goal:** remove the theater, make every surface truthful, and establish the measurement needed to justify Phase 2.

### Phase 1 backlog

| ID | Item | Size | Depends on | Status |
|---|---|---|---|---|
| P1-01 | Remove empty product surfaces | M | — | `[x]` |
| P1-02 | Rename and fix Recall Watch as a local Recall Checklist | M | — | `[x]` |
| P1-03 | Consolidate My Garage import/export | M | P1-01 | `[x]` |
| P1-04 | Capability labels and copy audit | S | P1-01, P1-02 | `[x]` |
| P1-05 | Simplify the VIN safety report | S | — | `[x]` |
| P1-06 | Measurement and error baseline | M | P1-04 | `[x]` |
| P1-07 | Parts-data procurement groundwork | M | — | `[~]` |
| P1-08 | Phase 1 verification and tracker update | S | P1-01…P1-07 | `[~]` |

### P1-01 — Remove empty product surfaces

**Do**

- [ ] Part page: remove the `CommercialPanel` render and import from `src/pages/PartPage.tsx`. Also remove the now-dead `commercialVehicle` object and the `fitmentConfirmed` prop that existed only for that panel. Remove `src/components/ui/CommercialPanel.tsx`, `src/services/commercial.ts`, and `src/data/commercial-catalog.json` if nothing else imports them. Keep a one-line “Pricing and stock are not connected” note only if the part page still needs it.
- [ ] Fleet page: remove the **B2B API** section, `SAMPLE_API`, and the now-unused `Terminal` and `CopyButton` imports from `src/pages/FleetPage.tsx`. The fleet checker itself stays.
- [ ] Garage: remove the `GarageTransferPanel` render and import from `src/pages/GaragePage.tsx`; delete `src/components/ui/GarageTransferPanel.tsx` and `src/services/garageTransfer.ts` if unused. Update the hero/empty-state copy so it no longer promises a transfer code. Backup/restore and fleet-sheet import remain; P1-03 consolidates them.
- [ ] Safety intelligence: remove the **Manufacturer communications** card from `src/components/ui/SafetyIntelligencePanel.tsx` and drop the unused `FileWarning` import. Change the inner `styles.grid3` to `styles.grid2` so two cards do not leave an empty third column.
- [ ] Fitment support: remove the dealer verification form, correction form, `mode` state, `reference` state, and the `verification.ts`/telemetry imports from `src/components/ui/FitmentSupport.tsx`. Keep the conflict explanation and same-assembly alternatives. Change the “Dealer handoff” badge and closing queue copy to a catalog-explanation/disclaimer treatment. Delete `src/services/verification.ts`.
- [ ] Demand capture: remove the email input and the `email` field from `src/components/ui/DemandCapture.tsx`, `src/services/demand.ts`, and `DemandRequest` in `src/types/index.ts`. Update the Tools card copy and local-only summary so no “optional email” promise remains.
- [ ] Tools page: remove the **Commercial layer**, **Garage transfer**, and **Listing browser extension** cards and the entire `#extension` section from `src/pages/ToolsPage.tsx`. Remove the **Commercial fitment records** summary tile, `getCommercialCoverage`, `getFitmentVerifications`, and the “Queue count” meta paragraph. Keep the watched-VIN, garage, and coverage-request tiles. Drop imports left unused (`CircleDollarSign`, `Puzzle`, `Bookmark`, commercial/verification services). Keep the extension source in `extension/` but do not advertise it as a shipped workflow.
- [ ] Home page: remove the **Development roadmap** section from `src/pages/HomePage.tsx`, its now-unused roadmap CSS classes in `HomePage.module.css`, and the dead commercial/fitment-handoff type definitions in `src/types/index.ts`.
- [ ] Search for remaining references before finishing:

```bash
rg "CommercialPanel|B2B API|GarageTransfer|Manufacturer communications|saveFitmentVerification|saveFitmentCorrection|getFitmentVerifications|getCommercialCoverage|roadmap|Listing browser extension"
```

- [ ] Update or remove tests that assert the removed UI. Exact current work:
  - `tests/smoke.spec.ts` — **delete** “keeps the commercial layer honest when no feed is connected”.
  - `tests/smoke.spec.ts` — **rewrite** “explains a fitment conflict and queues a dealer verification request” as “explains a fitment conflict and offers same-assembly alternatives”. Assert the conflict and alternatives, assert there is no “Request fitment verification” button, no contact form, and no `FIT-` reference.
  - `tests/smoke.spec.ts` — **delete** “moves My Garage between browsers with a transfer code”. P1-03 adds a backup round-trip test; do not leave a transfer-code test behind.
  - `tests/smoke.spec.ts` — keep “opens the tools hub and hands off to the fleet checker”, and add absence assertions for “Eight connected workflows”, “B2B API”, “Manufacturer communications”, and “Create transfer code”.
  - Add a PartPage absence assertion in the fitment test: no “Fitment, price & availability” heading and no “No ACES/PIES” copy.
- [ ] Update `PROJECT_TRACKER.md` only in P1-08; do not mix the tracker rewrite into this item.

**Acceptance**

- No route renders a card or form for a capability that is not connected.
- Tools has no commercial/verification summary tile or queue-count line, and no imports reference deleted services.
- PartPage has no commercial state or render left behind.
- The extension remains in the repo but is not presented as a product workflow.
- Demand capture stores no email or contact data.
- All checks pass and no dead imports remain.

**Verify**

```bash
npx tsc -b
npm run lint
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/smoke.spec.ts tests/accessibility.spec.ts --reporter=line
```

---

### P1-02 — Rename and fix Recall Watch as a local Recall Checklist

**Do**

- [ ] Rename user-facing “Recall Watch” to **“Recall Checklist”** everywhere it is product copy, while keeping internal identifiers stable:
  - `src/components/layout/Layout.tsx` — mobile nav and footer;
  - `src/pages/RecallCenterPage.tsx` — metadata title/name/description, H1, subtitle, empty state, “Watched VIN” eyebrow, badge, and remove-button aria-label;
  - `src/components/ui/RecallWatchButton.tsx` — inactive action becomes **Add to checklist**; active link becomes **On your checklist** with aria-label `Recall checklist is active for <VIN>`;
  - `src/pages/VINDecoderPage.tsx` — “Open Recall Checklist”;
  - `src/components/ui/VINSafetyReport.tsx` — “Add this VIN to your Recall Checklist” and “Open Recall Checklist”;
  - `src/pages/GaragePage.tsx` — hero copy, header link, and card action label;
  - `src/pages/ToolsPage.tsx` — card title/text/link;
  - `src/services/recallWatch.ts` — the two write-error messages (user-facing).
- [ ] Keep the route `/recall-center`, the storage key `autoparts.recall-watch.v1`, and service/component file names unchanged to avoid breaking links/data.
- [ ] State the local-only limitation plainly: checks run only while this browser/app is open; no email or SMS is sent; the checklist does not run after the tab is closed.
- [ ] Fix `src/components/RecallWatchdog.tsx`:
  - import `getRecallLookupScope` from `src/services/vehicleIdentity.ts`;
  - for each stored watch, skip when the scope is not `'model-year'`;
  - do not call `recordRecallCheck` for a skipped lookup, so `lastCheckedAt` is not advanced by a query that never ran.
- [ ] Audit `src/pages/RecallCenterPage.tsx` for any remaining “watch” wording that implies background monitoring. “Rechecks while this page is open” is allowed; “watch”, “watching”, and “notify me” are not.
- [ ] Add a regression test in `tests/incomplete-identity.spec.ts`: seed an incomplete identity and an inferred `model_source: 'vin-pattern'` watch, open a non-`/recall-center` route, trigger `focus`, and assert `lastCheckedAt` stays `null` for both and no NHTSA recall request is made.
- [ ] Update all tests that use the old name/actions. Exact current work:
  - `tests/route-focus.spec.ts` — footer link and H1 become **Recall Checklist**.
  - `tests/incomplete-identity.spec.ts` — test title and any labels become **Recall Checklist**.
  - `tests/smoke.spec.ts` — “Open Recall Watch” → “Open Recall Checklist”, H1 → “Recall Checklist”, `Watch recalls` → `Add to checklist`, `Recall watch is active` → `Recall checklist is active`, `Stop watching` → `Remove from checklist`, and the two write-error strings.
  - Keep the test intent and storage assertions; update only the labels and copy.
- [ ] Search for remaining references before finishing:

```bash
rg "Recall Watch|recall watch|Watch recalls|Watching recalls|watchlist|Stop watching|Could not update Recall Watch" src tests
```

**Acceptance**

- The UI never implies monitoring while the app is closed.
- Incomplete/inferred identities cannot record a phantom check.
- The checklist still supports add/remove, recheck, first-seen history, and self-reported repair marks.
- Existing Recall Watch data loads without migration.

**Verify**

```bash
npx tsc -b
npm run lint
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/incomplete-identity.spec.ts tests/smoke.spec.ts --reporter=line
```

---

### P1-03 — Consolidate My Garage import/export

**Do**

- [x] Create one **Import / export** area on `/garage` containing:
  - fleet-sheet import (existing `GarageFleetImportPanel`),
  - backup download/restore (existing `GarageBackupPanel`).
- [x] The transfer-code panel is already removed in P1-01; do not reintroduce it or a replacement account promise.
- [x] Use tabs or an accordion so the page does not stack three large panels below the vehicle grid.
- [x] Show the current count and capacity in the panel header: `15 of 20 garage spaces used`.
- [x] Keep backup/restore semantics exactly as they are: restore replaces the garage, previews the file date/count, and reports dropped entries at the cap.
- [x] Do not change the JSON formats or storage keys.
- [x] Replace the removed transfer-code smoke test with a backup round-trip test if one does not already exist: download, clear, restore, and assert names/notes/fleet identifiers survive.

**Progress (2026-11-22)**

- `GarageImportExportPanel` now owns the single card: header count (`n of 20 garage spaces used`), accessible tablist (`Fleet sheet` / `Backup file`), arrow/Home/End keyboard behavior, and one visible panel at a time.
- `GarageFleetImportPanel` and `GarageBackupPanel` render as embedded content; backup download/restore and fleet import logic are unchanged.
- Added `tests/garage-backup.spec.ts`: downloads a backup, clears the garage, restores the file, and asserts name, notes, AU/stock, and plate survive.
- Targeted garage tests, garage smoke subset, and `/garage` Axe check pass.

**Acceptance**

- A user can import a fleet sheet or restore a backup from one area.
- The page has one clear import/export entry point, not three competing panels.
- Backup data remains compatible with the pre-change format.
- No VIN/plate data is added to the repository.

**Verify**

```bash
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/garage-fleet-import.spec.ts --reporter=line
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/smoke.spec.ts -g "garage|backup|restore" --reporter=line
```

---

### P1-04 — Capability labels and copy audit

**Do**

- [ ] Define one vocabulary and use it everywhere:
  - **Live** — real data from NHTSA or a licensed source.
  - **On this device** — localStorage only.
  - **Not connected** — deliberately absent.
- [ ] Audit every route and major panel for claims that overstate the product. Start with:

```bash
rg -n "connected workflows|Global coverage|live 2020|all brands|marketplace|AI|3D|magic-link|optional account" src
```

- [ ] Tools page: remove “Eight connected workflows”; title it by what it is (e.g. “Safety & garage tools”) and label each card’s status.
- [ ] Home page: lead with the VIN decoder and safety report. Show live parts coverage honestly (one vehicle, 36 parts) rather than implying 63-brand coverage.
- [ ] Catalog pages: distinguish **brand/model metadata** from **published parts coverage**. Do not present `1,249 models` as catalog depth.
- [ ] Part page: keep the “representative catalog / verify with a dealer” disclosure until licensed data replaces it.
- [ ] Fleet page: keep the model-year campaign caveat and the VIN-specific NHTSA link.
- [ ] Add a short **coverage table** to `PROJECT_TRACKER.md` mapping each route to Live / On this device / Not connected.

**Acceptance**

- A new user can tell what is real on every screen without opening a disclosure.
- No page claims breadth or connectivity the app does not have.
- The capability table matches the code.

**Verify**

```bash
rg -n "connected workflows|Global coverage|live 2020|magic-link|optional account" src
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/smoke.spec.ts tests/accessibility.spec.ts --reporter=line
```

---

### P1-05 — Simplify the VIN safety report

**Do**

- [x] At the top of `src/components/ui/VINSafetyReport.tsx`, add a compact **“What this report can tell you”** summary:
  - VIN-specific specifications: yes.
  - Model-year recall campaigns: yes/no/not run.
  - VIN-specific open-recall status: no — link to NHTSA.
  - Complaints/investigations: model-level context, not VIN-specific.
- [x] Move the long scope paragraph into a `<details>` element (“How this report is matched”) so print and screen readers keep it but it no longer dominates the first screen.
- [x] Keep the existing incomplete/inferred identity states and the VIN-specific NHTSA link.
- [x] Ensure the summary remains visible in print.

**Progress (2026-11-22)**

- Added the four-row report summary. Complete identities show model-year campaigns and model-level complaints; incomplete and inferred identities show `Not run` instead of implying a lookup.
- Moved the full matching explanation into a closed-by-default details disclosure. Print media opens it so the printed report retains the scope caveats.
- Added report coverage for summary values, details expansion, print visibility, and incomplete/inferred identity wording. Focused report suite: 8/8 passed.
- Determinism fixes found during the full-suite pass: the fleet test now stubs NHTSA responses in-page after Playwright route fulfillment exceeded the app's 15-second fetch timeout under parallel load; fleet and garage blob downloads delay URL revocation until after the browser starts the download; Playwright uses a fresh dev server on port 5174 with four workers to avoid stale HMR state and lazy-chunk starvation.

**Verification (2026-11-22)**

```bash
PLAYWRIGHT_CHANNEL=msedge npx playwright test --reporter=line
npx tsc -b
npm run lint
npm run build
git diff --check
```

- Unfiltered Playwright: **127/127 passed**.
- Typecheck, lint, production build, and whitespace check: clean.

**Acceptance**

- The report’s limits are clear in one screen.
- The report still prints/saves as a coherent document.
- Incomplete identity still says no model-year lookup ran.

**Verify**

```bash
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/incomplete-identity.spec.ts tests/smoke.spec.ts -g "report" --reporter=line
```

---

### P1-06 — Measurement and error baseline

**Do**

- [x] Decide and document the production posture:
  - either configure `VITE_TELEMETRY_ENDPOINT` with a privacy-friendly collector,
  - or explicitly run with no endpoint and state that no analytics are collected.
- [x] Add events for the real funnel, with no VIN, email, plate, or free-text notes:
  - `vin_decode_success` / `vin_decode_failure` (VIN omitted or hashed),
  - `vin_report_print` / `vin_report_share`,
  - `parts_search` with query length and result count, not the raw query,
  - `catalog_dead_end` (brand/model/year with no parts),
  - `garage_import` counts,
  - `checklist_recheck` result count.
- [x] Configure `reportError` to receive production errors if an endpoint exists. If not, keep the console-only behavior and document it.
- [x] Add a privacy note in the footer or Tools page explaining what is measured.
- [x] Add a test that intercepts the telemetry endpoint and asserts no VIN/email/plate value is present in any payload.

**Acceptance**

- A baseline funnel can be read from the chosen collector, or the absence of collection is explicit.
- No PII, VIN, plate, or free-text notes leave the browser in telemetry.
- Decode failures and unhandled errors are observable in production.

**Progress (2026-11-22)**

- Production posture: no collector by default; optional `VITE_TELEMETRY_ENDPOINT` sends sanitized JSON. `docs/telemetry.md` is the written posture, and `/tools#privacy` carries the user-facing note (footer “Privacy” link).
- Funnel wiring: `vin_decode_success`/`vin_decode_failure`, `vin_report_print`/`vin_report_share`, `parts_search` (length + count), `catalog_dead_end`, `garage_import` counts, and `checklist_recheck` counts are all emitted from their real user-action paths. VIN/search/error/notes fields were removed at the call sites.
- `reportError` now routes `window.error`, `unhandledrejection`, and the React boundary through the same sanitizer; only `errorType`, `messageLength`, sanitized context, and path are sent.
- Evidence: `tests/telemetry.spec.ts` (2 tests) proves the pure scrubber and asserts captured event/error payloads contain no VIN, email, plate, note, raw query, or raw error text while all eight funnel events fire. Full suite: **129 passed** in 2.0 min; `npx tsc -b`, `npm run lint`, and `npm run build` are clean.

**Verify**

```bash
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/telemetry.spec.ts --reporter=line
```

---

### P1-07 — Parts-data procurement groundwork

This item is intentionally document-only. Do not ingest data yet.

**Do**

- [ ] Create `docs/parts-data-spec.md` containing:
  - target segments and 25–50 high-volume vehicles (year/make/model/engine),
  - required fields: part name, OEM number, alternate/supersession/interchange, fitment years/engines/trims/market, source, confidence, last updated, diagram rights,
  - acceptable providers/formats (ACES/PIES, supplier catalog, licensed OEM data),
  - licensing and redisplay questions,
  - QA acceptance criteria and a 10% spot-check method,
  - what “representative” data would have to become before it is presented as licensed.
- [ ] Request quotes or trial access from at least two providers.
- [ ] Record the shortlist and decision-maker in `PROJECT_TRACKER.md` (no credentials or contract values in the repo).
- [ ] Do not add provider credentials to source code or client assets.

**Progress (2026-11-22)**

- Draft created at `docs/parts-data-spec.md` with 36 anchor vehicles, required vehicle/assembly/part/fitment/provenance fields, provider questions, and QA gates.
- Still open (needs the user): request quotes/trial access from at least two providers and select the provider. No provider is chosen or implied here.

**Acceptance**

- A provider/schema decision can be made without more discovery.
- The 25–50 vehicle target is written down.
- Licensing/redisplay constraints are explicit.

---

### P1-08 — Phase 1 verification and tracker update

**Do**

- [x] Run the full suite, Axe gate, build, and a local prerender.
- [x] Update `PROJECT_TRACKER.md`:
  - current app commit and Pages run,
  - Phase 1 removals and renames,
  - capability table,
  - baseline grade and remaining gaps.
- [~] Complete the Phase 1 gate checklist below. Six of seven items pass; the provider selection is P1-07 work that needs the user.
- [x] If deployment is authorized, push to `main`, wait for Pages, and verify the deployed home, VIN, garage, checklist, fleet, and report routes.

**Progress (2026-11-23)**

- Verification: `npx tsc -b`, `npm run lint`, `npm run build`, and `git diff --check` are clean; entry **254.68 kB / 82.05 kB gzip**. Full Playwright suite: **129 passed** in 1.6 min, including the nine-route Axe gate and the telemetry PII test. Local prerender: **112 route HTML files**, `404.html`, and a **109-URL** sitemap.
- Deployment: Phase 1 shipped as app commit `d93dc63` in Pages run `45094188817`; that rollout exposed a real 320 px footer overflow in the CI smoke suite, fixed in `65c4f7d` and deployed in Pages run `45095451575`. The offline smoke suite (129 Chromium tests), the deployed Pages suite, and live checks of the home, VIN, garage, Recall Checklist, fleet, and safety-report routes all pass on `65c4f7d`.
- The only unmet Phase 1 gate item is P1-07's provider selection. The 36-vehicle shortlist and required fields are drafted; quotes or trial access from at least two providers and the selection remain the user's decision.
- `tests/pages.e2e.ts` now defaults to the P1-04 Home metadata; the pre-P1-04 expectation is opt-in via `PAGES_EXPECT_PRE_P1_04=1` for checking an older deployment.

**Phase 1 gate**

- [x] No visible empty product surfaces.
- [x] No contact/PII collection without a delivery path.
- [x] Recall Watch is honestly named and cannot record phantom checks.
- [x] Every route is labeled Live / On this device / Not connected.
- [x] Funnel/error baseline exists or its absence is documented.
- [ ] Parts provider shortlist and vehicle target are selected. — blocked on P1-07; the provider must be selected after quotes/trial access.
- [x] Full suite, lint, build, and Axe pass.

---

## 3. Phase 2 — Make the core job real

**Effort:** 8–12 weeks · **Risk:** medium–high · **Dependencies:** Phase 1 gate + licensed parts data  
**Goal:** a user can decode a VIN and reach a plausible, sourced part for a real vehicle.

### Phase 2 backlog

| ID | Item | Size | Depends on | Status |
|---|---|---|---|---|
| P2-01 | Parts schema, validator, and multi-vehicle ingestion | L | P1-07 | `[ ]` |
| P2-02 | Populate 25–50 vehicles with licensed parts | L | P2-01 | `[ ]` |
| P2-03 | VIN-first parts flow | M | P2-02 | `[ ]` |
| P2-04 | Search upgrade | M | P2-01 | `[ ]` |
| P2-05 | Catalog scale and dead-end handling | M | P2-02 | `[ ]` |
| P2-06 | Provenance and freshness UI | S | P2-02 | `[ ]` |
| P2-07 | Performance and data loading | M | P2-02 | `[ ]` |
| P2-08 | Fitment/data QA suite | M | P2-02 | `[ ]` |
| P2-09 | Demand and fitment feedback operations | S | P1-06 | `[ ]` |
| P2-10 | Phase 2 verification and gate | S | P2-01…P2-09 | `[ ]` |

### P2-01 — Parts schema, validator, and multi-vehicle ingestion

**Do**

- [ ] Extend `VehicleCatalog`/`CatalogPart` in `src/types/index.ts` with source, license/rights, last updated, confidence, and market fields where missing.
- [ ] Update `scripts/validate-parts.mjs` to require:
  - non-empty assemblies and parts,
  - valid OEM/reference numbers,
  - explicit fitment years/engines/trims/market,
  - source and confidence,
  - no duplicate part numbers within a vehicle unless intentional.
- [ ] Add a loader/index that supports multiple vehicles without hardcoded Civic assumptions in `src/services/parts.ts`, `src/pages/SearchPage.tsx`, and `PartPage`.
- [ ] Add at least two fixture vehicles in tests so multi-vehicle behavior is exercised before real data lands.
- [ ] Keep the existing 2020 Civic data valid as one record.

**Acceptance**

- The validator fails on malformed or unlicensed records.
- Adding a second vehicle does not require editing page components.
- Existing Civic tests still pass.

**Verify**

```bash
npm run validate:parts
npx tsc -b
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/smoke.spec.ts --reporter=line
```

---

### P2-02 — Populate 25–50 vehicles with licensed parts

**Do**

- [ ] Ingest the selected vehicles from the Phase 1 provider/schema.
- [ ] Cover high-turn assemblies first: brakes, filters/fluids, engine maintenance, suspension where licensed.
- [ ] Include OEM/reference numbers, supersessions, interchange, fitment rules, and diagrams only where redisplay rights allow.
- [ ] Do not add placeholder or inferred part numbers. If a field is unknown, omit it and label the record accordingly.
- [ ] Record source/license/freshness per record.
- [ ] Spot-check at least 10% of records against the provider or dealer source; record the checks in `docs/parts-data-spec.md`.

**Acceptance**

- 25+ vehicles have real parts and fitment.
- No unlicensed images or invented numbers.
- Every record has a source and confidence.
- Spot checks meet the agreed error threshold (define it in the spec; recommend ≤2% material fitment errors).

**Verify**

```bash
npm run validate:parts
npm run build
```

---

### P2-03 — VIN-first parts flow

**Do**

- [ ] From a decoded VIN, take the user to a **confirm vehicle** step: year/make/model plus engine/trim if available.
- [ ] If the vehicle has covered parts, hand off to its catalog with VIN/engine/trim preserved.
- [ ] If not covered, show a clear no-coverage state and only the feedback path that actually exists.
- [ ] Preserve VIN context through catalog → assembly → part → search.
- [ ] Remove dead-end “notify me” promises unless P2-09 makes them operational.

**Acceptance**

- Decode → parts is ≤3 user actions for a covered vehicle.
- Engine/trim confirmation changes the fitment signal.
- No covered vehicle dead-ends; no uncovered vehicle pretends to have parts.

**Verify**

```bash
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/smoke.spec.ts -g "VIN|catalog|handoff" --reporter=line
```

---

### P2-04 — Search upgrade

**Do**

- [ ] Add fuzzy matching for part names and common aliases.
- [ ] Normalize OEM numbers (dashes/spaces/case) and support partial numbers.
- [ ] Rank exact OEM matches first, then exact aliases, then fitment-compatible name matches.
- [ ] Add a fitment-first filter using the decoded/selected vehicle.
- [ ] Track zero-result queries by length/result count, not raw text.
- [ ] Add tests for misspellings, OEM formatting variants, synonyms (“front pads”), and no-match behavior.

**Acceptance**

- A known OEM number finds its part regardless of dashes/case.
- A common alias finds the right assembly.
- No result is shown as fitting when the fitment rules do not match.

**Verify**

```bash
PLAYWRIGHT_CHANNEL=msedge npx playwright test tests/smoke.spec.ts -g "search" --reporter=line
```

---

### P2-05 — Catalog scale and dead-end handling

**Do**

- [ ] Make brand/model/year pages reflect real coverage.
- [ ] Separate **metadata** (brands/models/engines) from **published parts** in the UI.
- [ ] Remove “all brands”/“1,249 models” framing that implies parts coverage.
- [ ] Keep a coverage request only if P2-09 gives it a delivery/export path.
- [ ] Add empty states that name the exact missing coverage and the next useful action.

**Acceptance**

- A user can tell whether their vehicle has parts before opening a part list.
- No page implies catalog depth that does not exist.
- Coverage requests are actionable.

---

### P2-06 — Provenance and freshness UI

**Do**

- [ ] Show source, last updated, confidence, market, and license/attribution on every part record.
- [ ] Add a “data freshness” line to vehicle and part pages.
- [ ] Replace “representative” with the real license status once data is licensed.
- [ ] Keep the dealer-verification reminder for fitment-critical purchases.

**Acceptance**

- Every part can be traced to a source.
- Stale records are visible, not hidden.
- The UI never presents unlicensed data as OEM truth.

---

### P2-07 — Performance and data loading

**Do**

- [ ] Move vehicle parts data out of the main bundle; load per vehicle/route.
- [ ] Add pagination or virtualization for large part lists.
- [ ] Keep the search index small and lazy.
- [ ] Measure entry JS, route JS, and search latency before/after; record the numbers in the PR/commit.
- [ ] Keep the brands chunk off first load.

**Acceptance**

- Entry JS does not grow materially from the Phase 1 baseline.
- A part route loads only its vehicle's data.
- Search remains responsive on a mid-range phone profile.

---

### P2-08 — Fitment/data QA suite

**Do**

- [ ] Add fixtures for at least three vehicles with different engine/trim combinations.
- [ ] Add Playwright coverage for VIN → confirm → parts → part detail.
- [ ] Add fitment regression cases for wrong engine, wrong trim, wrong year, and unknown configuration.
- [ ] Add a validator check that fails if a covered vehicle has zero parts.
- [ ] Re-run the Axe gate on the new catalog routes.

**Acceptance**

- A data regression fails CI, not production.
- Fitment conflicts are covered by tests.
- Accessibility remains green on the expanded catalog.

---

### P2-09 — Demand and fitment feedback operations

**Do**

- [ ] Choose one delivery mechanism: a backend endpoint or a downloadable CSV.
- [ ] If CSV: add an export button and copy that explains where the file goes.
- [ ] If endpoint: authenticate, rate-limit, store minimally, and never expose other users' data.
- [ ] Remove localStorage-only “queue” language if the data is now deliverable.
- [ ] Do not collect contact details unless the chosen path can actually contact the user.

**Acceptance**

- Every submitted request/report reaches a person or an export the team can act on.
- No orphaned local queue remains.
- Privacy copy matches the implementation.

---

### P2-10 — Phase 2 verification and gate

**Phase 2 gate**

- [ ] 25+ vehicles with validated, sourced parts.
- [ ] VIN → parts works end to end for covered vehicles.
- [ ] Search handles OEM formats and common aliases.
- [ ] Zero-result and fitment-error rates are measured.
- [ ] Provenance/freshness is visible on every part.
- [ ] Full suite, lint, build, Axe, and deployed smoke pass.
- [ ] `PROJECT_TRACKER.md` is updated with the coverage map and data sources.

---

## 4. Phase 3 — Retention, monitoring, and commercial

**Effort:** 8–12 weeks · **Risk:** high · **Dependencies:** Phase 2 gate + explicit backend/business decision  
**Goal:** make the app worth returning to and capable of a real handoff or transaction.

### Phase 3 backlog

| ID | Item | Size | Depends on | Status |
|---|---|---|---|---|
| P3-01 | Backend, auth, privacy, and data-model decision | S | Phase 2 gate | `[ ]` |
| P3-02 | Accounts and cloud sync for garage/checklist | L | P3-01 | `[ ]` |
| P3-03 | Real recall monitoring | L | P3-01, P1-02 | `[ ]` |
| P3-04 | Availability and pricing feed | L | Phase 2 gate, P3-01 | `[ ]` |
| P3-05 | Fleet workflow and optional API | M | Phase 2 gate, P3-01 | `[ ]` |
| P3-06 | Extension ship or archive decision | M | P1-04 | `[ ]` |
| P3-07 | Monetization and conversion measurement | M | P3-02, P3-04 | `[ ]` |
| P3-08 | Observability, runbooks, and data freshness alerts | M | P3-01 | `[ ]` |
| P3-09 | Phase 3 verification and gate | S | P3-01…P3-08 | `[ ]` |

### P3-01 — Backend, auth, privacy, and data-model decision

**Do**

- [ ] Write a short ADR (in `docs/` or `PROJECT_TRACKER.md`) covering:
  - why the no-backend constraint is being relaxed,
  - auth/session approach,
  - database/storage choice,
  - per-user isolation model,
  - PII retention and deletion,
  - backup/restore and export,
  - threat model and abuse controls.
- [ ] Choose the smallest backend that supports garage/checklist sync and recall notifications. Do not add a general application server.
- [ ] Define what stays client-side (camera/OCR, anonymous decode) and what becomes server-side.
- [ ] Get explicit approval for the backend direction before writing schema or auth code.

**Acceptance**

- A reviewer can explain where each piece of user data lives and how it is deleted.
- No credentials are committed; secrets live in the platform's secret store.
- The decision is recorded before implementation.

---

### P3-02 — Accounts and cloud sync for garage/checklist

**Do**

- [ ] Add sign-in using the chosen provider (magic link or OAuth).
- [ ] Sync My Garage and the Recall Checklist per user; keep localStorage as an offline cache.
- [ ] Provide export and delete-account/data paths.
- [ ] Handle first-sign-in merge: local records upload once, duplicates resolved by VIN, newest notes/name wins or the user chooses.
- [ ] Add two-account isolation tests: account A cannot read or mutate account B's garage/checklist.
- [ ] Keep the app usable signed out.

**Acceptance**

- A user can save on one device and reopen on another.
- Signed-out local use still works.
- Account isolation, sign-out, export, and deletion are tested.
- No VIN/notes leak in logs or analytics.

---

### P3-03 — Real recall monitoring

**Do**

- [ ] Add a scheduled server-side check per watched VIN/model identity.
- [ ] Use the model-year NHTSA data only; never claim a campaign is open or repaired on a specific VIN.
- [ ] Send email or push with the VIN-specific NHTSA link.
- [ ] Support opt-in, unsubscribe, frequency, and quiet failure handling.
- [ ] Make the job idempotent: one notification per new campaign, not one per run.
- [ ] Store only what is needed; do not store VINs in logs.

**Acceptance**

- A check reaches the user without the app being open.
- Notifications are deduplicated and actionable.
- The copy distinguishes model-year campaigns from VIN-specific open-recall status.
- Unsubscribe and failure paths are tested.

---

### P3-04 — Availability and pricing feed

**Do**

- [ ] Integrate one real retailer/distributor feed.
- [ ] Gate offers on confirmed fitment and exact part-number match.
- [ ] Show stock only when supplied; never infer it.
- [ ] Use neutral ranking or disclose paid placement.
- [ ] Cache responses and show last-updated time.
- [ ] Add a clear affiliate/lead disclosure.

**Acceptance**

- At least one real price/stock source works end to end.
- No offer appears without confirmed fitment.
- Stock and price freshness are visible.
- Disclosure is present and accurate.

---

### P3-05 — Fleet workflow and optional API

**Do**

- [ ] Add saved fleets, failed-row retry, column mapping, and printable summaries.
- [ ] Publish an API only if a pilot customer or contractual need exists.
- [ ] If publishing: authenticate, rate-limit, document the contract, and return model-year scope explicitly.
- [ ] If no pilot exists, keep the CSV workflow and remove the API promise from all product surfaces.

**Acceptance**

- A fleet user can rerun only failed rows and export a clean summary.
- No API is advertised without a real endpoint and auth.
- The API/CSV never claims VIN-specific repair status.

---

### P3-06 — Extension ship or archive decision

**Do**

- [ ] Decide: publish to a browser store or archive the extension from the product.
- [ ] If publishing: package it, document supported listing sites, minimize permissions, add privacy disclosure, and test DOM changes.
- [ ] If archiving: remove it from `extension/` or move it to an archive folder and remove all product references.
- [ ] Do not leave a source-only extension advertised as available.

**Acceptance**

- The extension is either installable from a store with a tested supported-site list, or absent from the product story.
- No listing-site scraping breaks silently without a user-facing fallback.

---

### P3-07 — Monetization and conversion measurement

**Do**

- [ ] Choose one handoff: affiliate offer, dealer/parts-counter lead, or none.
- [ ] Measure qualified clicks, handoff completion, and return usage — not just page views.
- [ ] Add UTM/partner attribution with no PII.
- [ ] Show users what happens when they click and whether the link is paid.
- [ ] Review results after a fixed window; keep or remove the monetization path.

**Acceptance**

- One monetization path is measurable end to end.
- Disclosure is visible before the click.
- No dark patterns or fake urgency.

---

### P3-08 — Observability, runbooks, and data-freshness alerts

**Do**

- [ ] Add error tracking, uptime checks, and alerts for failed decode/recall jobs.
- [ ] Alert when parts data or a commerce feed is stale beyond its SLA.
- [ ] Write runbooks for: recall job failure, auth outage, data-provider outage, bad fitment report, account deletion.
- [ ] Add a backup/restore test for the backend data.
- [ ] Document on-call/ownership if the product is public.

**Acceptance**

- A failure is detected before a user reports it.
- Recovery steps are written and tested.
- Data freshness is monitored, not assumed.

---

### P3-09 — Phase 3 verification and gate

**Phase 3 gate**

- [ ] Cross-device garage/checklist sync works and is isolated per account.
- [ ] Recall monitoring reaches users without the app being open.
- [ ] At least one real availability/pricing source works.
- [ ] Fleet has a validated pilot or is explicitly de-scoped.
- [ ] Extension is shipped or archived.
- [ ] Privacy, deletion, and unsubscribe paths are tested.
- [ ] Full suite, lint, build, Axe, backend tests, and deployed smoke pass.

---

## 5. Cross-phase workstreams

### A. Data procurement (start in Phase 1, deliver in Phase 2)

- Own the 25–50 vehicle shortlist.
- Own provider contracts/licensing and redisplay rights.
- Own the QA spot-check and data-freshness SLA.
- Do not let code get ahead of rights: no diagrams or part numbers without permission.

### B. Measurement (start in Phase 1, mature in Phase 3)

- One event vocabulary; no PII/VIN/plates/free text.
- Baseline funnel: decode success → report view/share → search → part view → handoff.
- Report zero-result and dead-end rates every phase.

### C. Accessibility and mobile (every phase)

- Axe gate remains a release blocker.
- New catalog/commerce/account flows need 320/360/390 px checks and 44 px targets.
- Keyboard paths for every new form/dialog.

### D. Tests and deployment (every phase)

- Every behavior change gets a regression test; every removal gets an absence assertion.
- Full suite before merge; deployed smoke after authorized deployment.
- Never test only the happy path for fitment, identity, or account isolation.

---

## 6. Execution order

```text
Phase 1
  P1-01  Remove empty surfaces
  P1-02  Recall Checklist truthfulness
  P1-03  Garage import/export
  P1-04  Copy/labels audit
  P1-05  Safety report summary
  P1-06  Measurement baseline
  P1-07  Data procurement groundwork (parallel)
  P1-08  Gate: verify + tracker
        ↓
Phase 2
  P2-01  Schema/validator/multi-vehicle
  P2-02  Data ingestion (long pole)
  P2-03  VIN-first flow
  P2-04  Search
  P2-05  Catalog scale/dead ends
  P2-06  Provenance
  P2-07  Performance
  P2-08  QA suite
  P2-09  Feedback ops
  P2-10  Gate: coverage + quality
        ↓
Phase 3
  P3-01  Backend decision/ADR
  P3-02  Auth + sync
  P3-03  Monitoring
  P3-04  Availability/pricing
  P3-05  Fleet pilot/API
  P3-06  Extension decision
  P3-07  Monetization measurement
  P3-08  Observability/runbooks
  P3-09  Gate: retention/commercial
```

### Checkpoints

| Checkpoint | When | Decision |
|---|---|---|
| C1 | End of Phase 1 | Is the app credible enough to invest in data? |
| C2 | After P2-02 | Is the data quality good enough to expose broadly? |
| C3 | Before P3-01 | Is there evidence users return or transact, justifying a backend? |
| C4 | End of Phase 3 | Keep, narrow, or stop the commercial path? |

---

## 7. Out of scope

Do not add these in any phase unless this plan is explicitly revised:

- 3D exploded views, AI assistant/chat, social features, marketplace checkout.
- More brand/model metadata without parts behind it.
- Accounts or a backend before Phase 3.
- A local queue that looks like a sent request.
- Any new “coming soon”, fake API contract, or empty commercial panel.
- Collecting email/phone without a working delivery path.

---

## 8. Change log

| Date | Change | Author |
|---|---|---|
| 2026-11-22 | Initial three-phase plan and backlog | — |
| 2026-11-22 | P1-01 complete: removed commercial panel/feed, B2B API card, transfer-code UI, dealer queue, manufacturer communications card and data field, demand email, extension card, roadmap and roadmap CSS; cleaned Tools summary/imports, PartPage state, and dead commercial/fitment types. Typecheck, lint, build, 124 Playwright tests pass. | — |
| 2026-11-22 | P1-02 complete: Recall Watch renamed to Recall Checklist across UI, action labels and errors; background watchdog now skips incomplete/inferred identities without recording a check. Regression test added. | — |
| 2026-11-22 | P1-07 draft: `docs/parts-data-spec.md` with 36-vehicle shortlist and required fields; provider work remains. | — |
| 2026-11-22 | P1-03 complete: My Garage fleet import and backup/restore consolidated into one tabbed Import/export card with capacity count; backup round-trip coverage added. | — |
| 2026-11-22 | P1-01 review: added negative coverage for the removed roadmap, Garage transfer UI, Fleet B2B API, demand email, and Tools extension card. No app-code cleanup was needed. | — |
| 2026-11-22 | P1-03 review: removed the unused embedded branches and fleet count subscription, hoisted tab definitions, and added tab keyboard plus hidden-panel coverage. | — |
| 2026-11-22 | P1-04 complete: unified Live / On this device / Not connected labels across Home, Catalog, Brand, assembly/part, Search, Fleet, Recall Checklist, and Tools; removed broad-coverage and B2B/dealer/live-investigation overclaims; added the route capability table to PROJECT_TRACKER.md and copy regression coverage. | — |
| 2026-11-22 | P1-06 complete: documented the no-endpoint-by-default posture in `docs/telemetry.md`, added the `/tools#privacy` note and footer link, wired all eight funnel events, routed events and errors through one PII sanitizer, and added `tests/telemetry.spec.ts`. Full suite 129 passed; typecheck, lint, and build clean. | — |
| 2026-11-22 | P1-05 complete: added the compact report summary, moved the matching explanation into a print-opening details disclosure, and preserved incomplete/inferred identity states. Full Playwright suite 127/127 passed; fleet route-timeout and download-revocation races fixed; test server made fresh and deterministic. | — |
| 2026-11-23 | P1-08 verification and deployment: 129 Playwright tests, typecheck, lint, build, and local prerender clean. Phase 1 deployed as `d93dc63` (Pages run `45094188817`), then `65c4f7d` (Pages run `45095451575`) after CI caught and the footer fix resolved a 320 px overflow. Phase 1 gate is green except P1-07's provider selection. | — |
