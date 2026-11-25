# AutoParts — Project Tracker

**Last updated:** 2026-11-23

**Live deployment:** https://len-golani.github.io/AutoParts-fb/ — app commit `65c4f7d`, GitHub Pages run `45095451575` succeeded, including the deployed Pages smoke job. The live build carries the Phase 1 credibility and measurement pass (P1-01–P1-06).

**Branch/worktree state:** app commit pushed to `main`; this tracker is committed separately. Markdown-only pushes do not redeploy Pages.

**Verification snapshot (2026-11-23):** Phase 1 is deployed as `65c4f7d` in Pages run `45095451575`: full local suite **129 passed** (1.6 min), `tsc -b`, ESLint, production build (entry **254.68 kB / 82.05 kB gzip**), local prerender (112 route files, 109-URL sitemap), GitHub offline smoke **129 passed** under Chromium, and the deployed Pages suite plus live route/report checks all passed. **History:** My Garage review pass verified with 6 targeted Playwright tests, `tsc -b`, ESLint, production build, Pages deploy and deployed-Pages smoke, plus a live backup-restore check on the deployed origin. Cross-tab garage sync adds a seventh two-tab test, the write-failure test now also covers remove and save-to-garage, and both are live in `e924f0f` (Pages run `45020132430`), verified against the deployed origin. Recall Watch now has the same storage-event bridge, committed as `95f0d2d` and deployed in Pages run `45024064731`; its two-tab add/remove behavior was verified on the deployed origin. The Recall Center Remove button now meets a 44 px mobile tap target — measured at **44.0 px** at 390 px wide and **30.8 px** at 1280 px (unchanged desktop) — committed as `3d79727`, documented in `ea27bd8`, and live in Pages run `45029726054`. Full suite on 2026-11-22: **109 passed** in 1.1 min (includes the Recall Watch sync, the Remove-button tap-target regression, the expanded garage test, and the local route-focus spec). The later Recall Watch write-failure change (uncommitted) adds `reports rejected Recall Watch writes and leaves the watch list intact`; full suite on 2026-11-22: **112 passed** in 1.2 min, with `tsc -b` and ESLint clean. The European Audi VIN fallback (uncommitted) adds two fleet tests; full suite on 2026-11-22: **114 passed** in 1.3 min, with `tsc -b`, ESLint, and the production build clean. The My Garage fleet-sheet import (uncommitted) adds three focused import tests and a 20-vehicle cap; full suite on 2026-11-22: **117 passed** in 1.4 min, with `tsc -b`, ESLint, and the production build clean (entry **253.56 kB / 81.64 kB gzip**). The international VIN state fixes missing make/model rendering and the false zero-recall message. All of that work — the 20-vehicle garage, fleet-sheet import, European VIN fallback, international market states, Recall Watch write reporting, and SPA route focus — shipped as app commit `ed75f3f` in Pages run `45060201710`. Full suite before deploying on 2026-11-22: **118 passed** in 1.5 min, with `tsc -b`, ESLint, and the production build clean (entry **253.56 kB / 81.63 kB gzip**; VIN page chunk **74.87 kB / 22.44 kB gzip**).

This file is the continuity record for the AutoParts project. Read it before changing behavior, accessibility, data claims, or the static-host pipeline.

---

## 1. Product intent and non-negotiable constraints

AutoParts is a browser-only automotive parts and VIN safety app. It helps a user identify a vehicle from its VIN, see recalls/complaints, browse a representative 2020 Honda Civic parts slice, save vehicles locally, and hand a VIN or fleet list to a dealer/parts counter.

**Constraints that must not be undone:**

- **No server component.** VIN decoding and recall lookup call NHTSA directly from the browser. Catalog data is bundled or served as static files.
- **Static/GitHub Pages compatible.** The app is built with Vite, prerendered to directory-index HTML, and deployed under `/AutoParts-fb/`. Route-level code splitting must not break prerendering or deep links.
- **Data honesty.** The 2020 Civic catalogue is a representative development slice, not licensed OEM data. The 2026 manufacturer catalogue is active, but unverified part numbers and fitment must not be presented as OEM truth. Never invent coverage.
- **VIN/camera privacy.** Camera frames and uploaded photos are processed locally in the browser. No image is uploaded. Keep the visible disclosure and the local-only OCR path.
- **Accessibility and mobile quality are release gates.** Serious/critical Axe violations are treated as failures. Core flows must remain usable at 320 px, 360 px, and 390 px with 44 px touch targets and keyboard support.
- **No unsolicited deployment.** Building and prerendering locally is allowed; committing, pushing, and deploying require explicit authorization.

---

## 2. Stack, commands, and environment

| Area | Choice |
|---|---|
| UI | React 19, TypeScript, Vite 8 |
| Routing | React Router 7, `BrowserRouter` with basename from `BASE_URL` |
| VIN API | NHTSA vPIC, direct browser fetch, 15 s timeout |
| Recalls/complaints | NHTSA recalls and complaints APIs |
| Catalog | Bundled JSON + validator + static `/public/data/` assets |
| OCR | Tesseract.js, local canvas frames, optional Code 39 `BarcodeDetector` |
| Storage | `localStorage` for My Garage, the Recall Checklist, cached decodes, and coverage requests |
| Offline | Service worker + web app manifest |
| Tests | Playwright, `@axe-core/playwright`, deterministic NHTSA/camera/OCR stubs |
| Hosting | GitHub Pages via prerendered `dist/` |

```bash
npm run dev                 # Vite on http://127.0.0.1:5173
npm run build               # validate parts + tsc -b + vite build
npm run lint
npx tsc -b
PLAYWRIGHT_CHANNEL=msedge npx playwright test --reporter=list
PLAYWRIGHT_CHANNEL=msedge npm run prerender
```

`PLAYWRIGHT_CHANNEL=msedge` is the reliable local fallback on this Windows machine. The standard CI path installs Playwright Chromium, but this worktree currently lacks the bundled headless-shell binary.

---

## 3. Architecture map

```text
src/
  App.tsx                     Route table; pages are lazy-loaded
  main.tsx                    Root, error boundary, telemetry, service worker
  components/
    ErrorBoundary.tsx         Full-page recovery with reload
    layout/                   Header, footer, nav, skip link, scroll effects/progress
    ui/                       VIN scanner/review, recalls, safety report, demand, fleet widgets
  pages/                      Home, VIN, catalog, brand, model-year, assembly, part,
                              search, garage, recall-center, fleet, tools, 404
  services/                   NHTSA, recalls, catalog, parts, OCR, frames, garage,
                              recall checklist, demand, fleet, telemetry sanitizer
  data/                       brands.json, popular models, Civic slice
  styles/                     Global tokens, shared parts/features styles
scripts/
  validate-parts.mjs          Enforces catalogue shape and normalized OEM data
  prerender.mjs               Emits route HTML, 404, sitemap, metadata
tests/
  smoke.spec.ts               Product flows, responsive recall panel, metadata
  accessibility.spec.ts       Nine core routes at 390 px + skip-link keyboard test
  vin-camera-ocr.spec.ts      Camera lifecycle, OCR review, upload failures
  vin-camera-mobile.visual.spec.ts
  vin-ocr.spec.ts             OCR extraction/normalization regressions
  nhtsa-stubs.ts              Deterministic NHTSA fixtures
```

**Routes:** `/`, `/vin`, `/catalog`, `/catalog/:brand`, `/catalog/:brand/:model/:year`, assembly, part, `/search`, `/garage`, `/recall-center`, `/fleet`, `/tools`, and a prerendered 404.

**No backend.** Do not add Supabase, FastAPI, Express, auth accounts, or a database just to solve a client-side problem without an explicit product decision.

### Capability coverage by route (P1-04)

This is the current route-level capability truth. Historical sections below may describe earlier builds; where they conflict, this table and the code win.

**Vocabulary:** **Live** = data the app actually provides from NHTSA, EPA-sourced catalog metadata, or the published 2020 Civic parts slice; representative records are called out. **On this device** = browser localStorage or local-only browser processing. **Not connected** = deliberately absent.

| Route | Live | On this device | Not connected |
|---|---|---|---|
| `/` | Links to NHTSA VIN decode and safety report; 2020 Civic 36-part published slice | No stored data on this entry page | Parts for other vehicles, prices/stock, accounts |
| `/vin` | NHTSA vPIC specs, model-year recalls, complaints, investigations | Camera frames/OCR stay in the browser; Garage and Recall Checklist write to localStorage | VIN-specific open-recall/repair status; non-NHTSA market recalls; accounts |
| `/catalog` | 63-brand/1,249-model EPA metadata; 2020 Civic 36-part published slice | None | Parts for models other than the 2020 Civic; prices/stock |
| `/catalog/:brandSlug` | Brand/model metadata; VIN decoder handoff | Coverage request saved locally | Parts for models without published data; dealer routing |
| `/catalog/:brandSlug/:modelSlug/:year` | 2020 Civic: published 36-part representative slice; other vehicles: engine metadata and VIN link | Uncovered vehicles: coverage request saved locally | Parts, fitment, price/stock for unpublished vehicles |
| `/catalog/:brandSlug/:modelSlug/:year/:assemblySlug` | Published 2020 Civic assembly record, fitment rules, representative diagram | Engine/trim selection in the URL | Licensed OEM data; price/stock; ordering |
| `/catalog/:brandSlug/:modelSlug/:year/:assemblySlug/:partSlug` | Published 2020 Civic part record, fitment explanation, provenance | VIN/engine/trim context in the URL | Licensed OEM fitment; price/stock; dealer ordering |
| `/search` | Ranked OEM/alias/name search over the 36-part Civic slice; vehicle, engine, trim, and fitment filtering; 63-brand metadata | No-match: coverage request saved locally | Parts outside the Civic slice |
| `/garage` | NHTSA links from saved VINs | Garage, names, notes, fleet import, backup/restore in localStorage | Accounts/cloud sync; server backup |
| `/recall-center` | NHTSA model-year campaigns; VIN-specific NHTSA links | Checklist, first-seen history, self-reported repairs, browser alerts | Email/SMS, background monitoring, VIN-specific open-recall status |
| `/fleet` | NHTSA VIN identity and model-year campaign counts; CSV generated in the browser | VIN batch and CSV stay in this browser; nothing is uploaded | B2B API, server-side fleet storage, VIN-specific repair status |
| `/tools` | Links to NHTSA tools and the published Civic slice | Local counts for Garage, Recall Checklist, coverage requests, fitment reports, and the combined feedback CSV | Commercial feed, price/stock, dealer routing, accounts |
| `/roadmap` | Three-phase capability map with every live, on-device, and Coming soon feature | No stored data | Licensed coverage, pricing/stock, accounts/sync, background monitoring, fleet API, extension, checkout, observability |
| `*` (404) | None | None | The requested page |

**Caveat:** the 2020 Civic slice is representative development data, not licensed OEM data. “Live” here means shipped in this build, not a licensed feed.

---

## 4. Completed capability map

- VIN decode with check-digit advisories, cached fallback, URL-shareable reports, vehicle specs.
- International VINs with an incomplete market identity show an explicit “Model data not available for this market” state; model-year recall lookup is skipped instead of being reported as zero campaigns.
- Local My Garage with fleet-sheet import, the Recall Checklist, recall rechecks, the recall action center, fleet bulk checker, and CSV export.
- The Recall Checklist and its stored watch records are the same local record (`autoparts.recall-watch.v1`); adding or removing a checklist entry in one tab updates the list and any VIN-page button in other open tabs through the browser `storage` event. Covered by `syncs Recall Watch additions and removals across tabs`.
- **Recall Checklist write-failure handling:** adding a watch, removing one, changing its alert opt-in, marking a campaign reviewed, and marking or undoing a repair all report a refused write. A browser-refused write shows “Could not update Recall Checklist. Browser storage is unavailable or full.” in a `role="alert"` and leaves the stored list untouched. A save past the 24-entry cap is refused with “Could not update Recall Checklist. Remove a vehicle first; the checklist holds up to 24.” instead of silently dropping the oldest watch. Covered by `reports rejected Recall Watch writes and leaves the watch list intact`.
- Real NHTSA recalls/complaints/investigations, and model-level safety intelligence.
- VIN camera scanner: live frame quality feedback, auto-read gating, rear/front switch, torch recovery, permission/track-end recovery, Code 39 support, photo upload, OCR review/correction, retake, cancellation.
- Local OCR confidence/candidate handling; ordinary prose no longer creates false VIN matches.
- 2020 Civic vertical slice: 4 assemblies, 36 parts, normalized OEM numbers, supersessions, interchange data, diagrams, search.
- Responsive recall details at 320/360/390 px, 44 px touch targets, focus-visible outlines, labeled VIN/stat groups.
- Route metadata, canonical/OG/Twitter/JSON-LD, sitemap, prerender, offline shell.
- Accessibility: muted text contrast fix, named NHTSA recall links, focusable/labeled VIN and stats strips, keyboard recall toggles, axe gate across core routes, skip link.
- Performance: route-level lazy loading with the shell and a status fallback preserved.

### European Audi VIN fallback (2026-11-22, deployed in `ed75f3f`)

NHTSA vPIC returns Audi make and model year for the European fleet VINs but leaves the model blank. `src/services/vinPatterns.ts` fills only that gap from VIN positions 7–8:

- **GY → A3/S3/RS 3**, **FJ → Q3**, **FZ → Q4 e-tron** come from Audi's 2027 VIN breakdown sheet filed with NHTSA (21 Oct 2026, position 7–8 table).
- **HC → A2 e-tron** comes from Audi's European HC series (ADAC model catalogue). HC is not in NHTSA's US sheet, so the UI calls it unverified.
- The fallback applies only to 17-character `WAU`/`WUA` VINs with the `ZZZ` European filler and only when vPIC returned a model year but no model. A model from NHTSA always wins; an unknown code stays blank.
- `VINDecodeResult` carries optional `model_source`, `model_code`, and `model_note`. `VehicleCard` shows a “Model inferred from VIN positions 7–8 (code)” note instead of presenting the model as vPIC output.
- A pattern-inferred model is not a US-market identity. `getRecallsForVehicle` and `getSafetyIntelligence` skip their NHTSA model-year queries for it; the VIN page explains that the US lookup was skipped, and the fleet table shows a skip note instead of “None returned.”
- The 16-character fleet VIN `WAUZZZGYXA000129` is not padded or guessed: the scanner keeps Decode disabled at 16/17 characters.

Two fleet rows labelled `E3 CUV` use the `HC` code; because no documented Audi E3 model exists, they decode as the HC series (A2 e-tron) and the note asks for verification against the vehicle.

**Tests:** `tests/fleet-vins.ts` holds the 15 unique fleet VINs and their expected models; `tests/vin-european.spec.ts` decodes every 17-character VIN (14) and asserts the inferred-model note plus the US recall skip, then checks the 16-character VIN is refused.

### International VIN market-data state (2026-11-22, deployed in `ed75f3f`)

vPIC can return a model year with no make/model, or a make with no model. The international check found exactly that for Renault `VF1RFB00X12345678` (2001, no make/model), which previously rendered `2001 null null` and then treated the empty recall result as “No recall campaigns returned.”

- `src/components/ui/VehicleCard.tsx` filters identity fields before joining and uses `hasFullVehicleIdentity`. When the year, make, or model is missing, the card shows **Model data not available for this market** in a `role="status"` note, and the summary strip reads e.g. `2001 · Model data not available for this market` instead of `2001 null null`. No trim is shown without a complete model identity.
- `src/components/ui/RecallsPanel.tsx` no longer calls the model-year recall lookup when that identity is incomplete. It shows the same explicit warning (“NHTSA's public recall API needs a model year, make, and model… cannot tell whether any campaigns apply”) and keeps the VIN-specific NHTSA check link. It does **not** render “No recall campaigns returned” for a lookup that never ran.
- The inferred Audi path is unchanged: a known VIN code still shows the inferred model and “US-market recall lookup skipped.” An Audi with no model also falls into the explicit market-data state instead of a null heading.

**Tests:** the existing Audi fleet loop now also asserts that the false zero-recall message never appears. The new Renault test uses the real cached VIN `VF1RFB00X12345678`, asserts the `2001` heading and explicit card/recall states, and confirms neither `null null` nor “No recall campaigns returned” is present. `tests/nhtsa-stubs.ts` now has the Renault fixture.

### My Garage local workspace (2026-11-22)

Shipped in `325ce5e` (names, notes, backup) and hardened in `a4e4331` (restore-safe notes, write-failure reporting).

- **Default naming:** the display label is derived from the decoded vehicle — model, trim, then engine detail — skipping a trim or engine token the label already carries. A blank custom name falls back to this label, so naming is optional.
- **Custom name and notes:** each vehicle stores an optional name (80 characters) and free-text notes (4,000 characters) in `localStorage` under `autoparts.garage.v1`. Notes save on blur or via the button; the name saves from an inline form.
- **Rename:** "Rename vehicle" opens an inline form under the card heading. Enter or "Save name" commits; Escape or "Cancel" discards; focus returns to the trigger. Blank input clears the custom name and restores the default label.
- **Save-failure handling:** every garage write reports when the browser refuses it. Rename, notes, save-to-garage, and remove show the shared message "Could not update My Garage. Browser storage is unavailable or full." in a `role="alert"`, leave the stored state untouched, and skip the success state (no "Notes saved.", no "Saved to My Garage", no removed card).
- **Restore-safe drafts:** a mounted card follows the stored notes, so a backup restore or fleet import that changes a vehicle's notes updates the field instead of leaving a stale draft that could overwrite the restore on blur.
- **Cross-tab sync:** `src/services/garage.ts` bridges the browser `storage` event for `autoparts.garage.v1` to the existing in-page change event. A rename, notes save, remove, or backup restore in one tab refreshes every other open tab without a reload; the writing tab still updates from its own in-page event.
- **Backup and restore:** `src/services/garageBackup.ts` exports every saved vehicle (name, notes, AU/stock number, plate, savedAt) to a versioned JSON file and restores it by **replacing** the garage, not merging. `src/components/ui/GarageBackupPanel.tsx` previews the file's date and vehicle count before the destructive restore. Import normalizes each vehicle, rejects invalid or duplicate VINs, caps at 20 vehicles, and reports skipped entries.
- **Fleet-sheet import:** `src/services/garageFleetImport.ts` parses a pasted CSV, TSV, semicolon list, or markdown pipe table with VIN, Name, AU/Stock, and Plate columns (optional Notes). A VIN must match `^[A-HJ-NPR-Z0-9]{17}$`; invalid VINs and repeated VINs in the same sheet are listed with line numbers and skipped. A VIN already saved is matched, not added twice. A row whose AU/stock matches a saved vehicle with an invalid VIN repairs that VIN — the original 16-character A3 becomes `WAUZZZGYXVA000129` — while keeping its name and notes. Existing non-empty names and notes always win, and saved AU/stock/plate values are kept; the sheet fills blanks and supplies fleet identifiers for new vehicles. This also keeps the S3's `AU380170257` / `IN-S3680` when the sheet's earlier Q3 row repeats the same VIN. New VINs are decoded through the same NHTSA path, three at a time, then the whole merge writes once. `src/components/ui/GarageFleetImportPanel.tsx` previews new/matched/skipped/overflow counts; `GARAGE_MAX_VEHICLES` is now **20**, so the 15 Audis fit with headroom and their names and notes survive. Covered by `tests/garage-fleet-import.spec.ts`.
- **Transfer code removed:** the old base64 transfer flow (`garageTransfer.ts`) was removed in P1-01. Backup/restore in the consolidated Import/export card is the only cross-browser transfer path.

**Tests added or extended (garage tests in `tests/smoke.spec.ts` unless noted):**

- `imports a CSV, keeps saved names and notes, and skips duplicate or invalid VINs` (`tests/garage-fleet-import.spec.ts`) — seeds two named Audis with notes, imports two matching VINs plus one new Q3, a duplicate Q3, and a 16-character A3; asserts the Q3 appears once, both saved names/notes and AU/plate survive, and the two bad rows are reported and skipped.
- `repairs a saved 16-character VIN from the AU/stock match and keeps its name and notes` (`tests/garage-fleet-import.spec.ts`) — pastes a markdown pipe table for the A3, corrects the saved VIN to `WAUZZZGYXVA000129`, and keeps one card with its original name/notes and AU/plate.
- `keeps the saved S3 fleet identifiers when the sheet repeats its VIN on a Q3 row` (`tests/garage-fleet-import.spec.ts`) — the earlier Q3 row is the one kept by the duplicate rule, but the saved S3's `AU380170257` / `IN-S3680`, name, and notes remain unchanged.
- `renames a saved vehicle and keeps free notes` — rename commits, focus returns to the trigger, and notes persist across reload.
- `refreshes a mounted garage card when its stored notes change` — an external restore that changes stored notes updates the field rather than leaving the old text behind.
- `reports rejected garage writes and recovers when storage works` — stubs `localStorage.setItem` to reject garage writes for rename, notes, remove, and save-to-garage; asserts each failure alert and that the failed action leaves its state unchanged (form open, notes not marked saved, card kept, button still "Save to My Garage"), then restores storage and confirms each success state.
- `syncs a rename and notes save to another open tab` — opens a second page in the same context, renames and saves notes in the first, and asserts the second updates through the `storage` event with no reload.
- `round-trips names, notes, and fleet identifiers through a backup file` (`tests/garage-backup.spec.ts`) — downloads a backup, clears the garage, restores it, and asserts the name, notes, AU/stock, and plate survive.
- `saves a VIN result to My Garage and reopens it` — still covers the save/reopen path.

---

## 5. This follow-up set: ranked by value

The four ideas below were selected as the highest-value remaining work. All four were implemented and verified.

### 1. Route-level code splitting — highest impact on first load

**Why:** The production entry chunk was 681.43 kB (164.95 kB gzip) and triggered Vite's >500 kB advisory. On a phone, that is unnecessary JavaScript before a user can see the VIN decoder, catalog, or garage.

**Implementation:**

- `src/App.tsx` now uses `React.lazy()` for every page route.
- `src/components/layout/Layout.tsx` wraps `<Outlet />` in `Suspense`, so header/footer persist and the fallback is an accessible `role="status"` message inside `<main>`.
- Added `.pageLoading` styling with design tokens. No layout flash or route-specific failure was observed.
- Prerender still waits on route content, so static deep links and SEO output are unchanged.

**Measured result:** entry chunk **681.43 kB → 252.53 kB** minified (about **−63%**), **164.95 kB → 81.30 kB gzip** (about **−51%**). Vite's >500 kB warning is gone. Route/page chunks now load on demand (VIN page 70.36 kB, home 8.71 kB, etc.); the shared brand dataset is a 201.11 kB/24.49 kB gzip chunk used only by pages that need it.

**Trade-off:** first navigation to a route downloads its chunk. The static prerender still provides content and metadata before hydration.

### 2. Core-route accessibility gate + keyboard skip link

**Why:** Axe coverage previously existed only inside the mobile recall test. Regressions on home, VIN, catalog, search, garage, recall center, fleet, and tools could ship unnoticed. Keyboard users also had to tab through the entire header and nav on every page.

**Implementation:**

- Added `tests/accessibility.spec.ts`: nine core routes scanned at 390 px with `reducedMotion: 'reduce'`, failing on any **serious or critical** Axe violation.
- Added a first-focus "Skip to main content" link, `main#main-content` with `tabIndex={-1}`, a visible focus treatment, and scroll margin so the sticky header does not cover the target.
- Added a keyboard regression test: first Tab focuses the skip link; Enter moves focus to `#main-content`.

**Measured result:** all nine routes have zero serious/critical Axe violations; the skip-link test passes. The route scan was green at baseline, so this change mainly adds durable coverage and the missing keyboard path rather than claiming a large violation cleanup.

### 3. Camera privacy disclosure

**Why:** A VIN is vehicle-identifying and camera permission is a high-trust moment. The OCR path is local, but the camera dialog did not say so; users could reasonably assume frames were uploaded.

**Implementation:** added a visible line in the camera footer: “Camera frames are processed on this device; no image is uploaded.” The existing live-quality test now asserts the disclosure is present.

**Result:** privacy claim matches the implementation and is covered by a regression test; the short-screen camera test still passes with the extra line.

### 4. Explicit supported-photo validation

**Why:** The uploader accepted `image/*`, then gave a generic “could not be read” message for unsupported formats such as a text file or HEIC. Users had no recovery instruction.

**Implementation:**

- Allowlist: JPEG, PNG, WebP, GIF, AVIF, BMP.
- Reject unsupported MIME types before the 12 MB size check or image decode, with a clear message naming supported formats and the manual-entry alternative.
- Keep the existing corrupt-image generic error, oversized-photo guard, and uploader reset.

**Result:** unsupported file test now asserts the specific format guidance; corrupt and oversized photo tests still pass.

---

## 6. Before / after grade

This is a practitioner rubric for the whole app at the start and end of this follow-up set. It is not a standardized benchmark, and it does not replace field performance or assistive-technology testing.

| Dimension | Before | After | Evidence |
|---|---|---|---|
| Product/feature depth | A− | A− | Broad VIN, safety, garage, fleet, OCR, catalogue features; no feature scope changed here |
| Reliability/error handling | B+ | A− | 129 tests, camera/OCR recovery, cache fallback, explicit upload errors, and a sanitized error baseline; no collector configured by default |
| Accessibility | B | A− | Nine-route Axe gate, skip link, prior contrast/focus/label fixes; no manual screen-reader pass |
| Performance | C+ | B+ | Entry JS −63% minified, −51% gzip, warning removed; no field LCP/INP/CLS measurement |
| Privacy/trust | B | A− | Local OCR disclosed at camera; image never uploaded; P1-06 telemetry posture plus payload-redaction test; no independent security audit |
| Mobile UX | A− | A− | 320/360/390 recall checks, 44 px targets, short-screen camera metrics all pass |
| Documentation/handoff | B− | A− | README/docs plus `docs/telemetry.md` and this tracker; tracker is now the continuity source |

**Overall: B (about 3.35/4.0) → A− (about 3.75/4.0).**

Why not higher: accessibility is automated-only, performance has no real-user data, reliability has no configured remote telemetry, and the catalogue remains a deliberately limited representative slice.

---

## 7. Verification evidence

### 2026-11-20 — follow-up set

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| `PLAYWRIGHT_CHANNEL=msedge npx playwright test --reporter=list` | **96 passed** in 56.3 s |
| `npm run build` | Pass; entry **252.53 kB / 81.30 kB gzip**; no >500 kB warning |
| `PLAYWRIGHT_CHANNEL=msedge npm run prerender` | Pass; 109 sitemap URLs, all route HTML plus 404 |
| Production-base build + prerender (`/AutoParts-fb/`) | Pass; assets under `/AutoParts-fb/`; 109 sitemap URLs |
| GitHub Actions “Deploy to GitHub Pages” #10 | Success: Build, Deploy, and Deployed Pages smoke all passed |
| GitHub Actions “Smoke tests” #11 | Success: offline suite, typecheck/lint, and production build |
| `PLAYWRIGHT_CHANNEL=msedge npm run test:pages` | **2 passed** against the live Pages URL |
| Core-route Axe scan | 9/9 routes, zero serious/critical |
| Skip-link keyboard test | Pass |
| Camera privacy / unsupported type | Pass |
| Parts validation | 4 assemblies, 36 parts, 36 normalized OEM numbers, 0 warnings/errors |

The first prerender attempt failed only because this worktree lacks Playwright's bundled Chromium headless shell. Re-running with the installed Edge channel succeeded. CI installs Chromium, so this is an environment limitation, not an application failure.

### 2026-11-22 — My Garage review pass

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass; entry **253.05 kB / 81.42 kB gzip** |
| Garage and saved-vehicle Playwright group | **6 passed** in 13.4 s |
| Rejected-save regression test | Pass: name and notes alerts, no false success, success state after storage recovers |
| GitHub Actions “Deploy to GitHub Pages” run `45019180818` (commit `a4e4331`) | Success: build, deploy, and deployed Pages smoke |
| Live backup-restore check on the deployed origin | Pass: mounted card's notes changed from `Before restore` to `Restored notes`, no alert, `localStorage` held the restored notes |
| Deployed entry asset | `index-B2oyMPe3.js` (previous `index-Cjf6IEQY.js`) |

### 2026-11-22 — Cross-tab garage sync

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| `syncs a rename and notes save to another open tab` | Pass: rename and notes save in one tab appear in a second open tab without a reload |
| Garage and saved-vehicle Playwright group (now seven tests) | **7 passed** in 13.8 s |
| Live two-tab check (deployed origin) | Pass: rename and notes save in one tab appeared in a second tab without a reload |

Committed as `e924f0f` and deployed in Pages run `45020132430`.

### 2026-11-22 — Garage write-failure coverage

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| `reports rejected garage writes and recovers when storage works` | Pass: rename, notes, remove, and save-to-garage failure alerts plus recovery |
| Garage and saved-vehicle Playwright group | **7 passed** in 22.6 s |
| Live remove check (deployed origin) | Pass: blocked remove showed the alert and kept the card; retry removed it |
| Live save-to-garage check (deployed origin) | Pass: blocked save showed the alert and kept the button label; retry saved |

Committed as `e924f0f` and deployed in Pages run `45020132430`; live checks passed.

### 2026-11-22 — Recall Watch cross-tab sync

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| `syncs Recall Watch additions and removals across tabs` | Pass: add and remove in one tab update a VIN-page button and the Recall Watch list in another |
| Recall Watch Playwright group | **3 passed** in 8.7 s |
| Live two-tab check (deployed origin) | Pass: add in one tab activated the other tab's VIN button; remove returned it; re-adding from the second tab restored the Recall Center card in the first, all without reloading |

Committed as `95f0d2d` and deployed in Pages run `45024064731`. The bridge leaves `write()`, merge/newest-campaign handling, and failure swallowing unchanged.

### 2026-11-22 — Recall Center Remove tap target

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| Recall Watch Playwright group | **8 passed** in 20.6 s |
| `keeps the Remove button tappable on mobile without enlarging it on desktop` (new) | Pass: 44 px minimum and width at 390 px; `min-height` back to `auto` and the ~30.8 px height at 1280 px |
| Live check on the deployed origin | Pass: **44.0 px** tall with `min-height: 44px` and no horizontal overflow at 390 × 844; **30.8 px** tall with `min-height: auto` at 1280 × 900, matching the pre-change 92 × 30.8 button |
| Deployed assets | `index-Cct9BjPj.js` / `features-C75z1qNG.css` (previous entry `index-Bfm69lPT.js`) |

The rule is `@media (width<=640px) { .watchRemove { min-width: 44px; min-height: 44px } }` in `src/styles/features.module.css`, applied only to the Recall Center Remove button in `src/pages/RecallCenterPage.tsx`. Shared `.btn`/`.small` styles are untouched, so desktop renders as before.

App commit `3d79727`, documentation commit `ea27bd8`, deployed as part of Pages run `45029726054` (build, deploy, and deployed Pages smoke all succeeded).

### 2026-11-22 — European Audi VIN fallback

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| `decodes every 17-character fleet VIN with an inferred model` (new) | Pass: all 14 decodable VINs show their expected model, the VIN-pattern note, and the US recall skip |
| `rejects the 16-character fleet VIN instead of inventing a model` (new) | Pass: 16/17 characters, Decode disabled, no model claimed |
| Focused VIN decoder + European fallback group | **10 passed** in 24.2 s |
| `npm run build` | Pass; entry **253.60 kB / 81.66 kB gzip** |
| Full Playwright suite | **114 passed** in 1.3 min |

Changes are uncommitted.

### 2026-11-22 — Fleet-sheet import

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| `imports a CSV, keeps saved names and notes, and skips duplicate or invalid VINs` (new) | Pass: 2 matched, 1 new, 2 skipped; Q3 appears once, saved names/notes and AU/plate survive |
| `repairs a saved 16-character VIN from the AU/stock match and keeps its name and notes` (new) | Pass: A3 VIN corrected to 17 characters; one card, original name/notes and AU/plate kept |
| `keeps the saved S3 fleet identifiers when the sheet repeats its VIN on a Q3 row` (new) | Pass: saved S3 name/notes and `AU380170257` / `IN-S3680` kept; the Q3 AU/plate did not overwrite them |
| Focused fleet-import group | **3 passed** in 7.7 s |
| `npm run build` | Pass; entry **253.56 kB / 81.64 kB gzip**; GaragePage chunk **31.44 kB / 9.59 kB gzip** |
| Full Playwright suite | **117 passed** in 1.4 min |

Changes are uncommitted.

### 2026-11-22 — International VIN decode states

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| `decodes every 17-character fleet VIN with an inferred model` (extended) | Pass: all 14 Audi VINs keep their inferred model and US recall skip; “No recall campaigns returned” is absent |
| `shows explicit market-data states for the Renault VIN without a make or model` (new) | Pass: `2001` heading, `2001 · Model data not available for this market`, explicit recall warning, no `null null`, no false zero-campaign state |
| Focused international VIN group | **3 passed** in 16.6 s |
| Live local check (`/vin?vin=VF1RFB00X12345678`) | Pass: `2001`, explicit card and recall state, no `null null`, no “No recall campaigns returned” |
| `npm run build` | Pass; entry **253.56 kB / 81.63 kB gzip**; VIN page chunk **74.87 kB / 22.44 kB gzip** |
| Full Playwright suite | **118 passed** in 1.4 min |

Changes are uncommitted.

### 2026-11-22 — 20-vehicle build deployed, live fleet restored

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass; entry **253.56 kB / 81.63 kB gzip**; GaragePage chunk **31.44 kB / 9.59 kB gzip** |
| Full Playwright suite | **118 passed** in 1.5 min |
| Commit and push | `ed75f3f` to `main` |
| GitHub Actions “Smoke tests” run `45060201674` | Success |
| GitHub Actions “Deploy to GitHub Pages” run `45060201710` | Success: build, deploy, and deployed Pages smoke |
| Deployed bundle | `garage-DP6Ei8WW.js` and `GaragePage-CD7_8Ita.js` contain the 20-vehicle cap; live garage page shows “15 of 20 garage spaces used” |
| `PLAYWRIGHT_CHANNEL=msedge npm run test:pages` | **2 passed** against the live Pages URL |
| Live backup restore | Pass: the backup panel previewed `autoparts-garage-backup-15-audis-2026-11-22.json` (15 vehicles) and restored with “Restored 15 saved vehicles. The garage now matches this backup.”; 15 cards, 15 unique VINs, every name and note present, A3 VIN `WAUZZZGYXVA000129` |
| Live note edit | Pass: editing the first card's notes and blurring saved it (“Notes saved.”) while storage stayed at 15 vehicles with the other 14 names and notes present; the edit survived a reload |
| Live note revert | Pass: restoring the original text returned the stored vehicles to the backup exactly — canonical SHA-256 of `vin\0name\0notes` rows `4be6747b9d4acd8aa4c88d1c557edeab4ba200bdd859040955304b3871cafa83`, matching the backup file |

### 2026-11-22 — Recall Watch write-failure reporting

| Check | Result |
|---|---|
| `npx tsc -b` | Pass |
| `npm run lint` | Pass |
| `reports rejected Recall Watch writes and leaves the watch list intact` (new) | Pass: a blocked add keeps the button actionable and shows the alert; a blocked Remove keeps the card and the stored watch; a 25th watch is refused instead of dropping the oldest |
| Full Playwright suite | **112 passed** in 1.2 min |

`write()` in `src/services/recallWatch.ts` now returns `'saved' | 'rejected' | 'full'` instead of swallowing the result, and refuses a save past `RECALL_WATCH_MAX_WATCHES` rather than truncating the list. `updateWatch` reports `'missing'` for a watch another tab removed. `RecallWatchButton` and `RecallCenterPage` surface `recallWatchWriteError(outcome)` in a `role="alert"` and skip their success states. Background rechecks are unchanged. Changes are uncommitted.

### 2026-11-22 — Live My Garage fleet transfer

The 15 Audi fleet vehicles were copied from the local dev preview into the deployed
My Garage at `https://len-golani.github.io/AutoParts-fb/garage/`. The deployed app is
still commit `3d79727`, whose `write()` slices the garage to 12 and whose backup
restore reports extra records as dropped. Because a normal restore would keep only
12, the records were seeded directly into the deployed origin's
`autoparts.garage.v1` localStorage from a validated backup, without changing names
or notes.

| Item | Result |
|---|---|
| Backup file | `autoparts-garage-backup-15-audis-2026-11-22.json` — 15 vehicles, 15 names, 15 notes |
| A3 repair | `vin` corrected from 16-character `WAUZZZGYXA000129` to `WAUZZZGYXVA000129`; name and note unchanged, and the note still records the original 16-character source |
| Validation | 15 records; no invalid or duplicate VINs; every name and note non-empty and unchanged from the local backup; SHA-256 of the vehicles array `bf1ffca665b800923861dbc71b74deca0124f5eff31d1860a4ad74becfe62dc9` |
| Deployed page check | 15 cards rendered; all 15 names and all 15 note values present in the page; A3 record uses the corrected 17-character VIN |

**Live-build limitation:** the deployed build is not the workspace's 20-cap build.
The 15 records are currently readable, but the next garage write in that browser
(rename, Save notes, Remove, backup restore, or transfer import) will truncate the
stored list to 12. A backup restore on the live build would also keep only 12 and
report 3 dropped. The workspace's 20-vehicle cap and fleet import remain
uncommitted and undeployed. Re-restore the backup after deploying that build to make
the 15 write-durable. No commit, push, or deploy was performed.

### 2026-11-22 — P1-06 measurement and error baseline

| Check | Result |
|---|---|
| `tests/telemetry.spec.ts` | **2 passed** (included in the full run) |
| Full suite `PLAYWRIGHT_CHANNEL=msedge npx playwright test --reporter=line` | **129 passed** in 2.0 min |
| `npx tsc -b`, `npm run lint`, `npm run build` | Pass; entry **254.68 kB / 82.05 kB gzip** |

**P1-06 is complete.** The written posture is `docs/telemetry.md`: no collector by default; optional `VITE_TELEMETRY_ENDPOINT` sends sanitized JSON; the Tools page has a user-facing `#privacy` note and the footer links to it. All eight required funnel events are wired to their real actions: `vin_decode_success`, `vin_decode_failure`, `vin_report_print`, `vin_report_share`, `parts_search` (length + count), `catalog_dead_end`, `garage_import` counts, and `checklist_recheck` counts. `trackEvent` and `reportError` share `sanitizeTelemetryProperties`, and the error path sends only `errorType`, `messageLength`, sanitized context, and path. `tests/telemetry.spec.ts` captures actual payloads from decode failure/success, report print/share, search, catalog dead end, garage import, checklist recheck, and an unhandled error, then asserts no VIN, email, plate, note, raw query, or raw error text is present.

- **P1-07 decision package is ready; the licensing/provider decision is open.** `docs/parts-provider-evaluation.md` screens six candidates against the 36 anchors, records the licensing gate, and holds the fillable 36-vehicle checklist; `docs/parts-provider-rfq-email.md` is the send-ready RFQ and sample request. Of the six screened, only MOTOR Parts/AccuPI and Epicor Catalog publish OEM-numbered US light-duty coverage. Epicor's standard supplement bars consumer-facing use of MOTOR/Mitchell content and limits caching to 24 hours; MOTOR's standard DaaS terms exclude consumer-facing apps and its end-user terms are look-up-only, with per-OEM review requirements. No provider is contacted, licensed, or selected.

### 2026-11-23 — P1-08 Phase 1 verification and deployment

| Check | Result |
|---|---|
| `npx tsc -b`, `npm run lint`, `npm run build` | Pass; entry **254.68 kB / 82.05 kB gzip** |
| Full local Playwright suite (`PLAYWRIGHT_CHANNEL=msedge`) | **129 passed** in 1.6 min, including the nine-route Axe gate and `tests/telemetry.spec.ts` |
| Local prerender (`PLAYWRIGHT_CHANNEL=msedge npm run prerender`) | Pass: **112 route HTML files**, `404.html`, **109-URL** sitemap |
| GitHub “Smoke tests” run `45095451579` | Success: offline smoke, typecheck/lint, and production build |
| GitHub “Deploy to GitHub Pages” run `45095451575` | Success: build, deploy, and deployed Pages smoke |
| Deployed Pages suite (`PLAYWRIGHT_CHANNEL=msedge npm run test:pages`) | **2 passed**: VIN decode with base-path catalog navigation, prerendered metadata without JavaScript |
| Live route checks (`/`, `/vin`, `/garage`, `/recall-center`, `/fleet`, `/tools`, `/vin?vin=…&report=1`) | 200 with expected titles/headings; the report summary and print action render |

**Phase 1 removals and renames shipped in this deployment**

- **Removed:** the commercial fitment panel and its data/services, the fleet B2B API card, the garage transfer-code panel and service, the dealer verification/correction queue, the manufacturer-communications card, the demand email field, the extension promotion and `#extension` section, the Tools commercial/verification tiles, and the Home development roadmap.
- **Renamed:** user-facing “Recall Watch” is **Recall Checklist** throughout; the `/recall-center` route, `autoparts.recall-watch.v1` storage key, and service names stay for compatibility. The checklist skips incomplete or VIN-pattern-inferred identities without recording a check.
- **Consolidated:** My Garage fleet import and backup/restore live in one tabbed Import/export card with a capacity count.
- **Added:** one central telemetry sanitizer; all eight funnel events and the error boundary use it; `/tools#privacy` and the footer Privacy link state the no-collector-by-default posture.
- **Deployment fix:** the new footer Privacy link pushed a non-wrapping footer row to 325 px inside a 288 px content box, so CI’s 320 px check measured a 341 px document. Footer links now wrap and the footer text is width-constrained (`65c4f7d`).

**Remaining Phase 1 gate item:** P1-07 licensing/provider decision. `docs/parts-data-spec.md` has the 36-vehicle shortlist and required fields, but the licensing path, quotes, sample review, and selection remain the user’s decision; the decision package is ready in `docs/parts-provider-evaluation.md` and `docs/parts-provider-rfq-email.md`. P1-08 stays `[~]` and Phase 2 does not start until that gate closes.

### 2026-11-23 — P1-07 decision package

| Item | Result |
|---|---|
| `docs/parts-provider-evaluation.md` | Six candidates screened; MOTOR Parts/AccuPI and Epicor Catalog are the only two of the six with published OEM-numbered US light-duty sources. SEMA Data, Auto Care reference DBs, PartsTech and PartsLogic Connect are not primary catalog sources. |
| `docs/parts-provider-rfq-email.md` | Send-ready RFQ with the 36-vehicle list, five-vehicle sample request, licensing questions first, and provider-specific blocks. |
| 36-vehicle checklist | Fillable MOTOR/Epicor columns; restates the 25-vehicle gate and per-vehicle thresholds. |
| Published cost floor | Auto Care VCdb **$3,218** member / **$7,021** non-member plus PAdb **$1,100** / **$2,300** at $0–5M revenue. Buys reference data, not parts. |
| Licensing gate | Epicor supplement bans consumer-facing use of MOTOR/Mitchell content and caps caching at 24 hours; MOTOR DaaS terms exclude consumer-facing apps and its end-user terms are look-up-only; OEM reviews apply per make. |

**P1-07 is not complete.** No provider has been contacted, no quote requested, no sample received, and no selection made. The next action is the repo owner's: send the RFQ and decide the licensing path (negotiated consumer license, business-facing pivot, brand-data alternative, or defer).

---

## 8. Known limitations and open risks

- **Live Pages is a static deployment.** There is no server, rollback button, or server-side rate limiting; recovery means redeploying a previous artifact.
- **Live Pages now runs the Phase 1 build.** Commit `65c4f7d` deployed in Pages run `45095451575`. The 20-vehicle garage cap and the live 15-vehicle restore from `autoparts-garage-backup-15-audis-2026-11-22.json` remain in place; the Phase 1 build also carries the Recall Checklist, consolidated garage import/export, capability labels, and the PII-safe telemetry boundary.
- **Historical catalogue coverage** before 1984 is not available from the EPA source used for the 2026 manufacturer catalogue.
- **European VIN fallback is a model-code table, not a licensed decoder.** It covers only `WAU`/`WUA` Audi VINs with `GY`, `FJ`, `FZ`, or `HC`; other European makes and model codes still return no model. `HC` is not in NHTSA's US Audi sheet, and the fleet's `E3 CUV` labels do not match a documented Audi model, so those rows decode as A2 e-tron with a verification note. VINs with no make/model (e.g. Renault `VF1RFB00X12345678`) are not guessed; they show the explicit market-data state and skip the model-year recall query.
- **No European recall source.** For pattern-inferred European models, the app deliberately skips NHTSA's US-market recall and safety queries rather than presenting US campaigns as local ones.
- **Representative Civic data:** 36 parts are for product development, not licensed OEM fitment. Keep the provenance disclaimer visible.
- **Parts data licensing is unresolved.** Both OEM-data candidates publish terms built for business or per-lookup use, not a public static catalog. Epicor's supplement bans consumer-facing use of MOTOR/Mitchell content and offline storage beyond a 24-hour cache; MOTOR's DaaS terms exclude consumer-facing applications and require per-OEM review, with GM restricting use of its parts data to build a separate electronic catalog. Do not ingest or display licensed parts data until written consumer-redisplay and bulk-storage rights exist.
- **Automated accessibility only.** Axe catches a subset; run NVDA/VoiceOver and keyboard-only smoke tests before claiming full WCAG conformance.
- **No field performance data.** Bundle sizes are build measurements, not LCP/INP/CLS.
- **No server-side rate limiting** because there is no server; NHTSA calls are direct and subject to its availability/CORS behavior.
- **Browser cameras and OCR** require real device testing; Playwright uses mocked media streams.
- **A stale lazy chunk after a deploy** is handled by the existing error boundary reload, but has not been chaos-tested against a live Pages rollout.
- **My Garage and the Recall Checklist are browser-local.** Vehicles, names, notes, and watch records live in `localStorage`; there is no account or cloud sync, and clearing site data removes them. Cross-tab updates depend on the browser `storage` event, which fires in other same-origin tabs but not in the tab that wrote.
- **Garage caps:** 20 vehicles, 80-character names, 4,000-character notes, 40-character AU/stock numbers, 20-character plates. Extra vehicles are not stored; longer notes and fleet fields are truncated at the same limits the backup importer uses.
- **Backup files are user-managed.** They contain VINs and free-text notes and are never uploaded. A backup covers My Garage only — not the Recall Checklist or coverage requests.
- **Restore is destructive by design.** Restoring a backup replaces the whole garage; the panel previews the file first, but there is no undo beyond keeping another backup.

---

## 9. Next highest-value candidates (not implemented)

1. **Manual assistive-technology audit** of VIN decode → report → camera review → recall watch, with NVDA and VoiceOver notes. Automated Axe is necessary but insufficient.
2. **Field performance/RUM instrumentation** (opt-in) for LCP, INP, CLS, and route-chunk failures. Use it to decide whether the shared brand dataset or Tesseract load should be deferred further.
3. **Offline recall snapshot** for saved vehicles: show the last-known campaigns and a clear “last checked” state without implying live freshness. This is a meaningful reliability gain but needs storage/versioning design.
4. **Service-worker upgrade drill across a real deploy:** confirm an open tab moves from old hashed chunks to new assets without a hard refresh, and document the rollback path.

---

## 10. Session handoff

- Worktree: `C:\Users\GNKU0BO\.freebuff\worktrees\de09c1dc\a6d163dd7de11114ee28c64d1b66174d1cf7c85f33b6be42`
- App commit `65c4f7d` is live at https://len-golani.github.io/AutoParts-fb/ (Pages run `45095451575`); the live My Garage holds the 15-vehicle fleet at the 20-vehicle cap.
- Do not commit, push, or deploy further without explicit authorization.
- Dev server may be running at `http://127.0.0.1:5173`; reuse it rather than starting a duplicate.
- When checking live behavior through the preview panel, first confirm which tab it reports as active (`preview_status`). The panel delivers mouse and keyboard input only to that visible tab: a background tab with `document.visibilityState === "hidden"` receives no `pointerdown`/`mousedown`/`click` or `keydown` at all, so a button there appears dead while its handler is fine. In a visible tab the same control delivers a full trusted event chain and works. Investigating the deployed Recall Center Remove button confirmed this — the click failure was panel input routing, not the page — so activate or reopen the tab before calling a live control broken.
- Test fixtures: 2020 Civic VIN `2HGFC2F59LH500001`; other examples `1HGCM82633A004352`, `4T1BF3EK8AU561547`; Renault `VF1RFB00X12345678`; Audi fleet VINs in `tests/fleet-vins.ts`.
- Pages metadata gate: `npm run test:pages` now defaults to the deployed P1-04 Home metadata. Set `PAGES_EXPECT_PRE_P1_04=1` only when checking an older deployment; the other live metadata routes are asserted in both modes.
- When changing VIN identity rendering: use the complete year/make/model check before showing a model identity. If any part is missing, show **Model data not available for this market**, do not render nulls, and do not treat a skipped recall lookup as zero campaigns. Run `tests/vin-european.spec.ts`.
- When changing routes: update `src/App.tsx`, ensure lazy imports remain compatible with `scripts/prerender.mjs`, and rerun build + prerender.
- When changing VIN decoding: keep `src/services/vinPatterns.ts` additive-only — it must never override a model NHTSA returned, and it must leave unknown codes blank. Keep `model_source` on the result so the UI, recalls, and safety services can tell an inferred model from a vPIC model. Run `tests/vin-european.spec.ts`.
- When changing the camera/photo path: preserve local-only processing and update both the disclosure and upload-failure tests.
- When changing colors, focus styles, labels, or interactive controls: run `tests/accessibility.spec.ts` and the relevant responsive test; never suppress an Axe rule to get green.
- When changing catalogue data: run `npm run validate:parts` and keep `docs/parts-provenance.md` truthful.
- When changing My Garage: keep every write in `src/services/garage.ts` returning a boolean and surface failures with `GARAGE_WRITE_FAILED_MESSAGE`; run the garage Playwright group (`--grep "My Garage|saved vehicle|garage card|rejected garage|another open tab"`).
- When changing the fleet-sheet import: keep VIN-first matching, never add a second card for an existing VIN, and only repair a saved VIN when its AU/stock matches and the saved VIN is invalid. Preserve non-empty saved names and notes. Run `tests/garage-fleet-import.spec.ts`.
- When changing notes or backup: keep `GARAGE_NOTES_MAX_LENGTH` shared by the service, textarea, and backup importer, and preserve replace-on-restore semantics — a backup import must not merge.
- When changing garage updates: keep the `storage` bridge in `src/services/garage.ts` and have consumers listen to `garageChangedEvent()`; the two-tab regression test is `syncs a rename and notes save to another open tab`.
- When changing Recall Checklist updates: keep the `storage` bridge in `src/services/recallWatch.ts` and have consumers listen to `recallWatchChangedEvent()`; the two-tab regression test is `syncs Recall Watch additions and removals across tabs`.
- When changing Recall Checklist writes: keep `write()` returning a `RecallWatchWriteOutcome`, surface every user-initiated failure through `recallWatchWriteError(outcome)` in a `role="alert"`, and never truncate past `RECALL_WATCH_MAX_WATCHES`; the regression test is `reports rejected Recall Watch writes and leaves the watch list intact`.
- When changing the Recall Center Remove button: keep the mobile-only 44 px rule on `.watchRemove` and the regression test `keeps the Remove button tappable on mobile without enlarging it on desktop`; desktop must stay at the ~30.8 px ghost-button height.
