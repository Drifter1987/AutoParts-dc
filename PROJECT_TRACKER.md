# AutoParts — Project Tracker

**Last updated:** 2026-11-20  
**Live deployment:** https://len-golani.github.io/AutoParts-fb/ — app commit `abab5f5`, GitHub Pages run #10 succeeded.  
**Branch/worktree state:** app commit pushed to `main`; this tracker is committed separately. Markdown-only pushes do not redeploy Pages.  
**Verification snapshot:** 96 Playwright tests pass; TypeScript, ESLint, production build, prerender, Pages deploy, and deployed Pages smoke pass.

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
| Storage | `localStorage` for My Garage, watchlist, cache, transfer codes |
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
                              recall watch, demand, fleet, commercial, telemetry
  data/                       brands.json, popular models, Civic slice, commercial catalogue
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

---

## 4. Completed capability map

- VIN decode with check-digit advisories, cached fallback, URL-shareable reports, vehicle specs.
- Local My Garage, watchlist, recall rechecks, recall action center, fleet bulk checker and CSV export.
- Real NHTSA recalls/complaints/investigations, model-level safety intelligence, fitment verification requests.
- VIN camera scanner: live frame quality feedback, auto-read gating, rear/front switch, torch recovery, permission/track-end recovery, Code 39 support, photo upload, OCR review/correction, retake, cancellation.
- Local OCR confidence/candidate handling; ordinary prose no longer creates false VIN matches.
- 2020 Civic vertical slice: 4 assemblies, 36 parts, normalized OEM numbers, supersessions, interchange data, diagrams, search.
- Responsive recall details at 320/360/390 px, 44 px touch targets, focus-visible outlines, labeled VIN/stat groups.
- Route metadata, canonical/OG/Twitter/JSON-LD, sitemap, prerender, offline shell.
- Accessibility: muted text contrast fix, named NHTSA recall links, focusable/labeled VIN and stats strips, keyboard recall toggles, axe gate across core routes, skip link.
- Performance: route-level lazy loading with the shell and a status fallback preserved.

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
| Reliability/error handling | B+ | A− | 96 tests, camera/OCR recovery, cache fallback, explicit upload errors; still no production error collector configured |
| Accessibility | B | A− | Nine-route Axe gate, skip link, prior contrast/focus/label fixes; no manual screen-reader pass |
| Performance | C+ | B+ | Entry JS −63% minified, −51% gzip, warning removed; no field LCP/INP/CLS measurement |
| Privacy/trust | B | A− | Local OCR now disclosed at camera; image never uploaded; no independent security audit |
| Mobile UX | A− | A− | 320/360/390 recall checks, 44 px targets, short-screen camera metrics all pass |
| Documentation/handoff | B− | A− | README/docs plus this tracker; tracker is now the continuity source |

**Overall: B (about 3.35/4.0) → A− (about 3.75/4.0).**

Why not higher: accessibility is automated-only, performance has no real-user data, reliability has no configured remote telemetry, and the catalogue remains a deliberately limited representative slice.

---

## 7. Verification evidence (2026-11-20)

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

---

## 8. Known limitations and open risks

- **Live Pages is a static deployment.** There is no server, rollback button, or server-side rate limiting; recovery means redeploying a previous artifact.
- **Historical catalogue coverage** before 1984 is not available from the EPA source used for the 2026 manufacturer catalogue.
- **Representative Civic data:** 36 parts are for product development, not licensed OEM fitment. Keep the provenance disclaimer visible.
- **Automated accessibility only.** Axe catches a subset; run NVDA/VoiceOver and keyboard-only smoke tests before claiming full WCAG conformance.
- **No field performance data.** Bundle sizes are build measurements, not LCP/INP/CLS.
- **No server-side rate limiting** because there is no server; NHTSA calls are direct and subject to its availability/CORS behavior.
- **Browser cameras and OCR** require real device testing; Playwright uses mocked media streams.
- **A stale lazy chunk after a deploy** is handled by the existing error boundary reload, but has not been chaos-tested against a live Pages rollout.

---

## 9. Next highest-value candidates (not implemented)

1. **Manual assistive-technology audit** of VIN decode → report → camera review → recall watch, with NVDA and VoiceOver notes. Automated Axe is necessary but insufficient.
2. **Field performance/RUM instrumentation** (opt-in) for LCP, INP, CLS, and route-chunk failures. Use it to decide whether the shared brand dataset or Tesseract load should be deferred further.
3. **Offline recall snapshot** for saved vehicles: show the last-known campaigns and a clear “last checked” state without implying live freshness. This is a meaningful reliability gain but needs storage/versioning design.
4. **Service-worker upgrade drill across a real deploy:** confirm an open tab moves from old hashed chunks to new assets without a hard refresh, and document the rollback path.

---

## 10. Session handoff

- Worktree: `C:\Users\GNKU0BO\.freebuff\worktrees\de09c1dc\a6d163dd7de11114ee28c64d1b66174d1cf7c85f33b6be42`
- App commit `abab5f5` is live at https://len-golani.github.io/AutoParts-fb/. The tracker is a separate documentation commit.
- Do not commit, push, or deploy further without explicit authorization.
- Dev server may be running at `http://127.0.0.1:5173`; reuse it rather than starting a duplicate.
- Test fixtures: 2020 Civic VIN `2HGFC2F59LH500001`; other examples `1HGCM82633A004352`, `4T1BF3EK8AU561547`.
- When changing routes: update `src/App.tsx`, ensure lazy imports remain compatible with `scripts/prerender.mjs`, and rerun build + prerender.
- When changing the camera/photo path: preserve local-only processing and update both the disclosure and upload-failure tests.
- When changing colors, focus styles, labels, or interactive controls: run `tests/accessibility.spec.ts` and the relevant responsive test; never suppress an Axe rule to get green.
- When changing catalogue data: run `npm run validate:parts` and keep `docs/parts-provenance.md` truthful.
