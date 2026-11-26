# 🔧 AutoParts — Proprietary Exploded Parts Viewer

> A proprietary automotive OEM parts catalog modeled after 7zap.com — a React + TypeScript SPA with zero paid dependencies.

![Phase](https://img.shields.io/badge/Vertical%20slice-2020%20Civic-brightgreen)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20Vite-informational)

> **Data honesty:** the 2020 Civic catalog in this repository is a representative product-development slice, not licensed OEM data. Verify every part number and fitment with a dealer. See [`docs/parts-provenance.md`](docs/parts-provenance.md).

---

## 🗺️ Project Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | VIN Decoder + Vehicle Lookup | ✅ Complete |
| 2 | Parts Catalog Database & Navigation | 🟡 2020 Civic vertical slice live (36 parts) |
| 3 | 2D Exploded Diagrams & Viewer | 🟡 One representative Civic diagram live |
| 4 | 3D Exploded Views (Three.js + glTF) | ⏳ Planned |
| 5 | Advanced Search, Compatibility & AI | 🟡 OEM/alias search live; AI planned |
| 6 | User Accounts, Pricing & Marketplace | ⏳ Planned |
| 7 | Scale licensed data, performance & SEO | 🟡 Prerender, sitemap, canonical/OG/JSON-LD live |

---

## 🧱 Tech Stack

| Layer | Tool | Cost |
|-------|------|------|
| Frontend | React 19 + TypeScript + Vite | Free |
| Routing | React Router v7 | Free |
| VIN API | NHTSA vPIC (US Gov) | Free |
| Recalls | NHTSA recalls API (US Gov) | Free |
| Catalog data | Bundled JSON (`src/data/`) + validator | Free |
| Search | Client-side OEM/alias/name search | Free |
| Local storage | `localStorage` My Garage + last VIN cache | Free |
| Offline | Web app manifest + service worker | Free |
| Analytics/errors | Optional `VITE_TELEMETRY_ENDPOINT` boundary | Free |
| Hosting | GitHub Pages (live) | Free |

> There is no server component. VIN decoding and recall lookup call NHTSA directly from the browser; catalog data is bundled from `src/data/`. There is no Supabase/FastAPI/admin backend in the current app.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+ and npm

### Install and run

```bash
npm install
npm run dev
```

Then open: **http://localhost:5173**

No environment variables or API keys are needed — NHTSA vPIC and recalls are public. Analytics is disabled unless `VITE_TELEMETRY_ENDPOINT` is set to a collector that accepts POSTed JSON.

---

## 🧪 Testing the app

1. Open the app at http://localhost:5173
2. Decode a VIN. Use the 2020 Civic fixture below to exercise the full handoff:
   - 2020 Honda Civic: `2HGFC2F59LH500001` (deterministic test fixture; not a real registration lookup)
   - Other decoder examples: `4T1BF3EK8AU561547`, `1FTFW1ET5DFC43861`
3. Click **Decode VIN** — specs, recall lookup, and the exact Civic parts CTA should appear
4. Or use the Make/Model/Year dropdowns and select 2020 Honda Civic
5. Try the vertical slice: model year → assembly → part, fitment selects, OEM search
6. Use **Save to My Garage**, **Share**, and **Print parts sheet** to test local workflows

### Automated smoke tests

The Playwright smoke tests cover VIN decoding (including check-digit advisories and undecodable VINs), the VIN → Civic handoff, model/assembly/part navigation, fitment filters, OEM-number search, recalls, My Garage, catalog search, and the header/mobile quick search.

```bash
# Install dependencies (includes @playwright/test)
npm install

# Install Playwright's bundled Chromium
npx playwright install chromium

# Run the suite (NHTSA responses are stubbed)
npm run test:e2e

# Optional: run the VIN tests against the live NHTSA API
LIVE_NHTSA=1 npm run test:e2e
```

By default the VIN tests intercept NHTSA vPIC requests with deterministic fixtures, and all tests stub Google Fonts, so the suite makes no external network requests and can run offline. Set `LIVE_NHTSA=1` to disable the stubs and check the real API (network required; on PowerShell use `$env:LIVE_NHTSA=1; npm run test:e2e`).

The suite starts or reuses the Vite dev server on `http://127.0.0.1:5173` and uses Playwright's bundled Chromium. On Linux CI, run `npx playwright install --with-deps chromium` to install the browser and its system dependencies. If Playwright's browser download is blocked locally, opt into an installed browser instead: `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e`.

---

## 🌐 Deployment

### GitHub Pages (live)

**Live site:** https://drifter1987.github.io/AutoParts-dc/

Deployment is handled by [`.github/workflows/pages.yml`](.github/workflows/pages.yml), which runs on pushes to `main` and on manual dispatch. It:

1. Runs `npm run validate:parts` and builds with `npm run build -- --base=/AutoParts-dc/`
2. Installs Chromium and runs `npm run prerender` with `PRERENDER_BASE=/AutoParts-dc/`
3. Uploads the prerendered `dist/` and deploys it with `actions/deploy-pages`
4. Runs the deployed no-JavaScript metadata smoke test

Every catalog, brand, model, assembly, part, search, and 404 route is emitted as static HTML with its own title, description, canonical URL, Open Graph/Twitter tags, and JSON-LD. GitHub Pages serves those directory indexes as static 200 responses except for the explicit 404 route. `sitemap.xml` is generated by the prerender step; `robots.txt` points to it.

The React Router basename comes from `import.meta.env.BASE_URL`, so links and assets stay under `/AutoParts-dc/` in production while local development keeps the `/` base.

### Other static hosts

```bash
npm run build
npm run prerender
```

Serve `dist/` as static files. If the host does not resolve directory indexes, configure extensions or rewrites to serve each route’s `index.html`.

---

## 🔁 Continuous Integration

The [smoke-test workflow](.github/workflows/smoke-tests.yml) runs on pushes and pull requests, plus manual dispatches.

### Push and pull request jobs

- **Offline smoke suite** — `npm run test:e2e` with Playwright Chromium. NHTSA vPIC and Google Fonts requests are stubbed, so the suite makes no external network requests.
- **Typecheck and lint** — `npx tsc -b` and `npm run lint`.
- **Production build** — `npm run build` to catch bundling failures.

### Manual live VIN job

Dispatching the workflow manually runs the VIN decoder tests against the real NHTSA API with `LIVE_NHTSA=1`:

```bash
LIVE_NHTSA=1 npm run test:e2e -- --grep "VIN decoder"
```

The live job installs Playwright Chromium and does not run on push or pull request events.

### Concurrency and failure artifacts

Superseded runs on the same branch or pull request are cancelled automatically. The workflow uses:

```yaml
concurrency:
  group: smoke-tests-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

When a run fails, it uploads the HTML Playwright report and test results as artifacts (`playwright-report-offline` or `playwright-report-live-vin`). The bundle includes `playwright-report/` and `test-results/`, retained for 7 days. Traces are retained on failure (`trace: 'retain-on-failure'`), so a failed test's `trace.zip` can be inspected with `npx playwright show-trace <path>`.

---

## 📁 Project Structure

```
autoparts/
├── src/
│   ├── components/     # UI, VIN scanner, parts diagram, recall panel
│   ├── pages/          # Home, VIN, catalog, model year, assembly, part, search, garage
│   ├── services/       # NHTSA, recalls, parts lookup/search, garage, telemetry
│   ├── data/           # brands.json, popular-models.json, parts/*.json
│   ├── types/          # TypeScript interfaces
│   └── styles/         # Global and shared parts CSS
├── scripts/
│   ├── validate-parts.mjs   # provenance/schema/duplicate/fitment gate
│   └── prerender.mjs        # static route HTML + sitemap.xml
├── docs/               # provenance, usability plan, project status
├── public/             # favicon, manifest, service worker, robots.txt
├── tests/              # Playwright smoke + deployed Pages tests
├── index.html
├── vite.config.ts
└── package.json
```

---

## 📜 License

Proprietary software — all rights reserved.
