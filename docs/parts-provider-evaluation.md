# Parts Data Provider Evaluation — P1-07 Decision Package

**Status:** prepared for the repo owner's decision. **No provider is selected, no data is licensed, and nothing has been ingested.**
**Prepared:** 2026-11-23
**Inputs:** `docs/parts-data-spec.md` (36 anchors, required fields, QA gates) and `plan-AutoParts-fb.md` P1-07.
**Companion:** `docs/parts-provider-rfq-email.md` (send-ready quote request).

---

## 1. Bottom line

1. **Coverage cannot be compared from public pages.** No candidate publishes a per-nameplate matrix. MOTOR and Epicor both claim broad US light-duty scope; neither publishes whether a 2020 BMW 330i has 30+ engine- and trim-specific parts. Only a sample export answers the 36-vehicle question.
2. **Only two candidates publish OEM-numbered, light-duty US parts data:** MOTOR Parts/AccuPI and Epicor Catalog. The other four candidates are a standards body, a specialty-brand pool, a purchasing API, and ingestion middleware — not primary catalog sources.
3. **The standard license, not coverage, is the likely blocker.** Epicor's published supplement prohibits consumer-facing use of MOTOR/Mitchell content and caps lookup caching at 24 hours. MOTOR's published DaaS terms say fees "preclude ... consumer facing applications", and its end-user terms are vehicle-by-vehicle lookups with no electronic retrieval system. AutoParts is a public, static, bundled catalog — the opposite shape.
4. **The decision to test is a licensing path, not a coverage winner.** If neither vendor will grant written consumer redisplay plus scheduled bulk storage, the real options are: pivot the parts surface to a business-facing tool, use brand-authorized aftermarket data, or defer Phase 2.
5. **No choice is made here.** Sections 7–8 lay out the evaluation order, kill criteria, and the five decisions that belong to the repo owner.

**Evidence standard:** every capability or price below is either cited to a provider page or marked **❓ not published**. Nothing is inferred from marketing language, and no per-vehicle coverage is claimed.

---

## 2. Candidate map

| Candidate | What it actually is | Published scope | Role for AutoParts |
|---|---|---|---|
| **MOTOR Parts + AccuPI** | Licensed OEM/aftermarket parts database; AccuPI is a separate supersession product | 1985+ domestic and import light-duty, US market; OEM and aftermarket numbers; YMME and ACES lookup; ACES/PIES; bulk TXT/CSV/XML or REST API [1][2] | **Primary candidate** — the only candidate publishing OEM numbers, supersession, and a bulk path |
| **Epicor Catalog for Automotive** | Aftermarket catalog, cloud app, and Catalog API | 17M+ part numbers (the page also says 20M+), 1.4B+ applications (also 2.3B), US/Mexico/Canada, 1896+; ACES-compliant; OE↔aftermarket interchange [3] | **Primary candidate**, but standard terms block B2C and offline storage [4] |
| **SEMA Data** | Brand-owned specialty/performance data pool | Hundreds of participating brands; ACES/PIES; API and exports; brand-by-brand approval [5][6][7] | **Not primary** — specialty accessory scope; possible optional accessory layer |
| **Auto Care ACES/PIES reference databases** | Standards body; VCdb, Qdb, PCdb, PAdb, Brand Table | Vehicle configuration, qualifiers, product classification — **no part records** [8][9] | **Not a data source**; required decoder if we receive ACES/PIES XML |
| **PartsTech** | Shop purchasing and quoting API | Participating supplier catalogs; API for parts research and purchases [13] | **Not Phase 2**; possible Phase 3 commerce source |
| **PartsLogic Connect** | Catalog ingestion and search middleware | Loads supplier or ACES/PIES files you are already authorized to use; from $500/month [14] | **Not a data source**; optional pipeline after licensing |

**Why this matters:** four of the six cannot supply the Phase 2 catalog at any price. Only MOTOR and Epicor are worth an OEM-data RFQ, and both need a licensing exception for this product's shape.

---

## 3. Decision matrix — the two primary candidates

Legend: **✅** published and fits · **◐** published but partial or needs confirmation · **❓** not published, RFQ question · **⛔** published and conflicts.

| Criterion | MOTOR Parts + AccuPI | Epicor Catalog |
|---|---|---|
| Published vehicle scope | ✅ 1985+ domestic/import light-duty, US market [1][2] | ✅ 1896+ cars, light/medium/heavy trucks, powersports, US/MX/CA [3] |
| 2020 anchors in published scope | ✅ all 36 are US light-duty 2020 vehicles | ✅ all 36 are US light-duty 2020 vehicles |
| Per-nameplate coverage (36) | ❓ not published — sample required | ❓ not published — sample required |
| OEM number on every part | ✅ "provides the OEM part numbers"; OE and aftermarket numbers [1][2] | ◐ aftermarket database with OE↔aftermarket interchange; a per-record OE field is not stated [3] |
| Supersession | ◐ AccuPI publishes full supersession trails, but it is a separate product; confirm whether the Parts feed includes them [2] | ❓ supersession not stated; interchange is stated [3] |
| Interchange | ✅ published [1][2] | ✅ OE↔aftermarket and aftermarket↔aftermarket [3] |
| Engine/trim-specific fitment | ◐ YMME and ACES-coded fitment; exclusion completeness not published [1][2] | ◐ ACES-compliant, engine/trim/VIN lookup; exclusion representation not published [3] |
| Exclusions (package, drivetrain, hybrid) | ❓ confirm ACES qualifier mapping and hybrid coverage | ❓ confirm ACES qualifier mapping and hybrid coverage |
| Delivery | ✅ bulk TXT/CSV/XML and REST (XML/JSON/BSON) [1] | ◐ Catalog API and cloud app; cloud delivery is described as eliminating data downloads [3] |
| Build-time static storage | ◐ bulk delivery exists, but the end-user terms prohibit an electronic retrieval system; the order must expressly grant storage | ⛔ data may only be accessed by real-time lookup; offline storage prohibited except a 24-hour lookup cache [4] |
| Public consumer redisplay | ⛔ standard DaaS terms exclude consumer-facing applications; a negotiated use case is required [10][11] | ⛔ standard supplement bans consumer-facing use of MOTOR/Mitchell content [4] |
| Per-OEM approvals | ⛔/❓ MOTOR submits products to OEMs for review; Ford, GM, Honda, Toyota and others add terms [12] | ❓ upstream OEM consents not described in the public supplement |
| Provenance (record ID + last updated) | ❓ not published per record | ❓ not published per record |
| Update cadence | ◐ "regular updates" and "real-time updates" claimed; no SLA published [1] | ◐ new parts within an average of five days after data receipt [3] |
| Sample or trial | ✅ DaaS Sandbox with a snapshot for a couple of vehicles, plus data-team samples [16] | ◐ demo request only; no public sandbox [3] |
| Published price | ❓ custom quote only [1] | ❓ custom quote only [3] |
| Diagram/image rights | ◐ Part Vector Illustrations are a separate license [17] | ◐ images are included in the catalog; redisplay rights not published [3] |
| Contract friction | ⛔ data license plus OEM reviews; the DaaS page describes a three-year agreement [10][12] | ⛔ Master Customer Agreement plus Automotive Information Services Supplement [4] |
| Fit with this repo (static Vite/GitHub Pages, no server) | ◐ bulk export is the right shape, but the license must permit storage | ⛔ API/real-time model and no-offline-storage clause conflict with a bundled static catalog |

### What the two candidates actually differ on

- **MOTOR** publishes the narrower catalog but the more usable delivery path: OEM numbers, supersession via AccuPI, and bulk TXT/CSV/XML. Its published end-user terms are still look-up-only, so bulk delivery and consumer redisplay must be granted in the order.
- **Epicor** publishes the broader aftermarket catalog and a cleaner API, but its standard terms are the most explicit conflict with AutoParts: no consumer-facing use of MOTOR/Mitchell content, no use on a website other than the approved one, and no offline storage beyond a 24-hour lookup cache.
- **Neither publishes per-record provenance or per-nameplate coverage.** Those are the two things Phase 2 cannot proceed without.

---

## 4. The licensing gate (decisive)

### 4.1 Epicor

The Automotive Information Services Supplement (version 2025-11-14) states, in section 2.3:

> "You acknowledge and agree that you may never use any Mitchell repair data or MOTOR Information Systems content on or make it available through a B2C website, or website or application that is accessible by consumers (rather than a website or application that is designed for and used by businesses)."

Section 2.2 adds:

> "The Information Services may only be accessed on-demand, meaning real-time lookups and may not be cached or stored offline in any manner with the following exceptions: The result of lookups including the Year, Make, Model, Engine, VIN and part information may be cached for up to 24 hours."

Section 2.2(h) also prohibits use "on or through any web site, other than the Web Site".

**Implication:** a build-time bundle of 36 vehicles is offline storage, and a public site is consumer-accessible. Both are outside the standard terms. A written exception would be needed, plus clarity on which Epicor Catalog content is not MOTOR/Mitchell-derived.

### 4.2 MOTOR

MOTOR's published DaaS package terms say:

> "Fees for use of the data preclude, but are not limited to, consumer facing applications, parts e-commerce applications, or applications for parts retailers."

Its end-user terms grant a license "on a vehicle-by-vehicle look-up basis" and prohibit the licensee from making the data "part of any electronic retrieval system" or publishing, distributing, or displaying it to third parties.

MOTOR's OEM compliance page adds manufacturer-specific gates, including:

- **Ford:** may require two approvals (development/testing, then distribution) and may require a hyperlink to FordParts.com; Ford data may not be used to build a cross-reference comparison with non-Ford parts.
- **GM:** unless expressly permitted in the order, the customer may not "extract, alter or manipulate any parts information from General Motors vehicles ... for purposes of creating a new or distinct electronic parts catalog."
- **Honda:** requires a recorded product demonstration as part of its initial review.
- **Toyota:** AI models may not be used in association with Toyota service data.
- Copyright notices are required per OEM, and OEMs are third-party beneficiaries.

**Implication:** a 36-vehicle catalog spans 21 makes. Even with a MOTOR license, each make can carry its own review, demonstration, attribution, and use restrictions. GM's default term is directly aimed at building a separate electronic parts catalog.

### 4.3 What this means for AutoParts

| AutoParts property | Why it conflicts with standard terms |
|---|---|
| Public, no-login site | Both vendors distinguish consumer-facing use from business use; Epicor bans it for MOTOR/Mitchell content |
| Static build with bundled JSON | Treated as offline storage or an electronic retrieval system, not a per-lookup display |
| 36 vehicles across 21 makes | OEM approvals may be per make, not per license |
| Per-record provenance shown to users | Providers may require attribution but do not all permit exposing record IDs |
| No server | A real-time licensed API would require a backend, which the project currently forbids |

**A verbal "consumer is fine" is not a license.** The rights must appear in the order, contract, or a signed exception, and must cover redisplay, scheduled bulk storage, refresh, attribution, and deletion on termination.

---

## 5. 36-vehicle coverage screen

**Published-scope result, before samples:**

| Candidate | Scope-compatible vehicles | What that means |
|---|---|---|
| MOTOR | 36 / 36 | All are 2020 US light-duty vehicles, so none is out of scope. Coverage per nameplate is still unproven. |
| Epicor | 36 / 36 | Same: in scope, unproven per nameplate. |
| SEMA Data | 0 / 36 as an OEM replacement source | Specialty/performance brands; could add accessories, not the required OEM assemblies. |
| Auto Care reference DBs | n/a | No part records to cover. |
| PartsTech | n/a | Purchasing API, not a catalog license. |
| PartsLogic Connect | n/a | Loads data you already have rights to. |

**Per-vehicle acceptance threshold from the spec:** at least 4 assemblies, at least 30 parts, OEM/reference number on 100% of parts, source and last-updated on 100%, a structured fitment rule on 100%, at least 2 engine/trim variants where the vehicle was sold with more than one, a 10% spot check, and no more than 2% material fitment errors.

### 5.1 Sample request set

Request these five first; they cover the hard cases without asking for the whole list:

| Vehicle | Why it is in the sample |
|---|---|
| 2020 Honda Civic 1.5L Turbo | Baseline; replaces the existing representative slice |
| 2020 Toyota RAV4 2.5L Hybrid | Hybrid vs gas fitment |
| 2020 Ford F-150 3.5L EcoBoost | Three engines, two turbos, truck assemblies, Ford's extra terms |
| 2020 BMW 330i 2.0L Turbo | Luxury trim and package-dependent parts |
| 2020 Chrysler Pacifica 3.6L | Fleet minivan, single engine, fleet segment |

If the sample is strong, add the Silverado/Sierra and Tucson/Sportage pairs to test shared-fitment handling.

### 5.2 Fillable coverage checklist

Fill each box from the sample export: **✔** meets the per-vehicle threshold · **◐** partial coverage, must be labeled partial · **✘** missing. Do not mark a box from a scope claim or a sales deck.

| # | 2020 vehicle | Engines | P | Why it is a test case | Sample | MOTOR | Epicor |
|---:|---|---|---|---|:---:|:---:|:---:|
| 1 | Honda Civic | 1.5T, 2.0 | P0 | Baseline, two engines, replaces current slice | ● | ☐ | ☐ |
| 2 | Toyota Camry | 2.5, 3.5 | P0 | NA and V6 |  | ☐ | ☐ |
| 3 | Toyota Corolla | 1.8, 2.0 | P0 | Two engines, overlapping trims |  | ☐ | ☐ |
| 4 | Honda Accord | 1.5T, 2.0T | P0 | Two turbos, trim-dependent |  | ☐ | ☐ |
| 5 | Nissan Altima | 2.5, 2.0T | P1 | NA and turbo |  | ☐ | ☐ |
| 6 | Hyundai Elantra | 2.0 | P1 | Single engine, control case |  | ☐ | ☐ |
| 7 | Kia Soul | 2.0 | P1 | Single engine, compact SUV |  | ☐ | ☐ |
| 8 | Ford F-150 | 2.7EB, 3.5EB, 5.0 | P0 | Three engines, truck, Ford terms | ● | ☐ | ☐ |
| 9 | Chevrolet Silverado 1500 | 2.7T, 5.3 | P0 | Sibling of Sierra, GM terms |  | ☐ | ☐ |
| 10 | Ram 1500 | 3.6, 5.7 | P0 | V6 and V8 |  | ☐ | ☐ |
| 11 | Toyota RAV4 | 2.5, 2.5H | P0 | Hybrid vs gas | ● | ☐ | ☐ |
| 12 | Honda CR-V | 1.5T, 2.0H | P0 | Hybrid vs turbo |  | ☐ | ☐ |
| 13 | Nissan Rogue | 2.5 | P1 | Single engine |  | ☐ | ☐ |
| 14 | Ford Escape | 1.5EB, 2.0EB, 2.5H | P1 | Three engines including hybrid |  | ☐ | ☐ |
| 15 | Chevrolet Equinox | 1.5T, 2.0T | P1 | Two turbos |  | ☐ | ☐ |
| 16 | Jeep Grand Cherokee | 3.6, 5.7 | P1 | V6 and V8 |  | ☐ | ☐ |
| 17 | Subaru Outback | 2.5, 2.4T | P1 | NA and turbo |  | ☐ | ☐ |
| 18 | Mazda CX-5 | 2.5, 2.5T | P1 | NA and turbo |  | ☐ | ☐ |
| 19 | Hyundai Tucson | 2.0, 2.4 | P2 | Sibling of Sportage |  | ☐ | ☐ |
| 20 | Kia Sportage | 2.0, 2.4 | P2 | Sibling of Tucson |  | ☐ | ☐ |
| 21 | Volkswagen Jetta | 1.4T | P2 | Single turbo |  | ☐ | ☐ |
| 22 | Volkswagen Tiguan | 2.0T | P2 | Single turbo |  | ☐ | ☐ |
| 23 | BMW 330i | 2.0T | P2 | Luxury, package-dependent parts | ● | ☐ | ☐ |
| 24 | Mercedes-Benz C300 | 2.0T | P2 | Luxury, package variants |  | ☐ | ☐ |
| 25 | Audi A4 | 2.0T | P2 | Luxury |  | ☐ | ☐ |
| 26 | Lexus RX 350 | 3.5 | P2 | Luxury, single V6 |  | ☐ | ☐ |
| 27 | Acura RDX | 2.0T | P2 | Luxury turbo |  | ☐ | ☐ |
| 28 | Cadillac XT5 | 2.0T, 3.6 | P2 | Luxury, two engines, GM terms |  | ☐ | ☐ |
| 29 | GMC Sierra 1500 | 2.7T, 5.3 | P2 | Sibling of Silverado, GM terms |  | ☐ | ☐ |
| 30 | Chrysler Pacifica | 3.6 | P1 | Fleet minivan | ● | ☐ | ☐ |
| 31 | Ford Explorer | 2.3EB, 3.0EB | P2 | Two turbos |  | ☐ | ☐ |
| 32 | Toyota Highlander | 3.5, 2.5H | P2 | V6 and hybrid |  | ☐ | ☐ |
| 33 | Honda Odyssey | 3.5 | P1 | Fleet, single V6 |  | ☐ | ☐ |
| 34 | Subaru Forester | 2.5 | P2 | Single engine |  | ☐ | ☐ |
| 35 | Hyundai Santa Fe | 2.4, 2.0T | P2 | Two engines |  | ☐ | ☐ |
| 36 | Dodge Grand Caravan | 3.6 | P2 | Fleet, single V6 |  | ☐ | ☐ |

**Coverage accounting:** 25 vehicles must meet the full threshold for the Phase 2 release; the other 11 must be complete or explicitly marked partial. A vehicle with fewer than 30 parts is partial and does not count toward the 25.

---

## 6. Cost stack (published numbers only)

| Component | MOTOR path | Epicor path | Basis |
|---|---|---|---|
| Parts catalog license | ❓ quote required | ❓ quote required | Custom pricing [1][3] |
| Supersession | ❓ AccuPI quote (separate product) | ❓ not stated whether included | [2][3] |
| ACES VCdb, Light Duty & Powersports | $3,218 member / $7,021 non-member at $0–5M revenue | Same | 12-month subscription [8] |
| PIES PAdb | $1,100 member / $2,300 non-member at $0–5M revenue | Same | 12-month subscription [8] |
| Optional ingestion middleware | n/a | n/a | PartsLogic Connect from $500/month [14] |
| Optional diagrams | ❓ Part Vector quote | ❓ rights unclear | Default: omit diagrams [17] |

**Known published floor, if the feed is ACES/PIES XML:** $4,318/year member or $9,321/year non-member at the smallest revenue band, for both the VCdb and PAdb. That buys **zero part records**; it only lets us decode the standard. Auto Care states that receiving ACES or PIES XML requires the matching subscription [8][9].

**If the provider delivers normalized JSON with its own identifiers,** the Auto Care subscription may be avoidable. That is a question for the RFQ, not an assumption.

**Not estimated here:** engineering time for ingestion, validation, provenance UI, and QA. That belongs to P2-01/P2-02.

---

## 7. Evaluation plan (order of work, not a selection)

1. **Send the RFQ first, licensing question first.** Use `docs/parts-provider-rfq-email.md` to MOTOR data services and Epicor catalog/API sales, copying legal. Do not start with coverage or price; a "no" on consumer redisplay ends the conversation cheaply.
2. **Ask for the five-vehicle sample in the same email.** A sample is useful even if licensing is still under review, because it answers the coverage and provenance questions independently.
3. **Treat SEMA Data as an optional accessory layer, not a Phase 2 gate.** It is consumer-oriented and real, but specialty scope cannot satisfy OEM replacement assemblies. Do not spend the primary sample budget there.
4. **Do not buy Auto Care reference subscriptions yet.** They are only needed once a feed format is chosen, and they supply no parts.
5. **Score only after samples arrive.** Use the checklist in §5.2 and the weights below. A provider that fails a kill criterion is out regardless of score.

### 7.1 Suggested scoring weights (editable)

| Criterion | Weight |
|---|---:|
| Written consumer redisplay and storage rights | 30 |
| Sample-verified coverage of the 36 anchors | 20 |
| Fitment granularity and exclusions | 15 |
| OEM number, supersession, interchange | 10 |
| Provenance (record ID, last updated, confidence) | 10 |
| Update cadence and operational maturity | 5 |
| Total cost over 12 months | 5 |
| Diagram/image rights | 5 |
| **Total** | **100** |

Score each criterion 0–5: 0 = not offered, 3 = meets the spec with caveats, 5 = meets it with written evidence. Record the evidence next to every score.

### 7.2 Kill criteria

- No written right to public consumer redisplay.
- No right to scheduled bulk storage, or an API-only model with a cache shorter than the refresh cycle.
- Any unresolved per-OEM approval for a P0 make.
- Fewer than 25 of 36 vehicles meeting the per-vehicle threshold after the sample.
- More than 2% material fitment errors in the 10% spot check.
- No stable per-record source ID and last-updated timestamp.
- A delivery model that requires a permanent backend the project has not approved.

---

## 8. Decisions for the repo owner

These are deliberately left open. None is decided in this document.

1. **Licensing path.** Pursue a negotiated consumer-redisplay license with MOTOR and/or Epicor, pivot the parts surface to a business-facing tool, use brand-authorized aftermarket data, or defer Phase 2. This is the decision that unblocks everything else.
2. **Architecture.** Keep the no-server static build, or allow a backend for real-time licensed lookups if that is the only licensable model. The current project constraint is no server; changing it is a product decision, not an engineering detail.
3. **Scope.** 25 vehicles (the gate) or all 36; P0 only (5 makes: Honda, Toyota, Ford, Chevrolet, Ram) or all 21 makes. OEM approvals and legal review scale with make count.
4. **Budget and timeline** for license and legal review. These are not recorded in the repo; the only published number is the Auto Care reference subscription in §6.
5. **Diagram rights.** Include licensed diagrams or omit them. The spec's default is omit; a diagram license is a separate cost and a separate rights review.

### What would change the answer

- **If AutoParts becomes business-facing** (shop counter, dealer, fleet desk), Epicor's business-use framing fits better, though its caching limits still conflict with a bundled catalog.
- **If the product stays consumer-facing and static**, the only viable OEM-data path is an express written exception that covers redisplay and scheduled bulk storage.
- **If OEM numbers are dropped** in favor of brand aftermarket data, SEMA Data or a brand-authorized platform becomes viable, but the catalog claim changes from OEM replacement to aftermarket accessories, which is not what the 36-vehicle spec asks for.

---

## 9. Sources

All sources accessed 2026-11-23. Provider pages and contract versions can change; re-check before signing.

1. MOTOR, *Parts* — https://www.motor.com/products-services/data-products/parts
2. MOTOR, *Parts* data sheet (2025-10) — https://www.motor.com/wp-content/uploads/2025/10/MOTOR_Parts.pdf
3. Epicor, *Catalog for Automotive* — https://www.epicor.com/en-us/products/digital-commerce/catalog-for-automotive
4. Epicor, *MCA Automotive Information Services Supplement* (2025-11-14) — https://assets.epicor.com/m/7fdc12019ddbd6eb/original/Epicor-MCA-Automotive-Information-Services-Supplement-2025-11-14.pdf
5. SEMA Data, *Resellers* — https://www.semadata.org/resellers
6. SEMA Data, *About* — https://www.semadata.org/about
7. SEMA Data, *Beyond the Data Download* (Launch tier) — https://www.semadata.org/news/mon-2026-07-27-0922/beyond-data-download
8. Auto Care Association, *Subscriptions* — https://www.autocare.org/data-and-information/data-standards/subscriptions
9. Auto Care Association, *Databases* — https://www.autocare.org/data-and-information/data-standards/databases
10. MOTOR, *Privacy Policy and Terms of Use* (DaaS package terms) — https://www.motor.com/privacy-policy-and-terms-of-use
11. MOTOR, *Privacy Policy* (end-user terms) — https://www.motor.com/privacy-policy/
12. MOTOR, *OEM Compliance Requirements* (updated 2026-08-27) — https://getstarted.motor.com/oem-compliance-requirements
13. PartsTech, *API and Services Agreement* — https://partstech.com/api-agreement-terms
14. PartsLogic, *Connect* — https://partslogic.com/connect/ and *Pricing* — https://partslogic.com/pricing
15. MOTOR, *Technology Providers* — https://www.motor.com/who-we-serve/technology-providers/
16. MOTOR, *DaaS Sandbox* — https://www.motor.com/daas-sandbox
17. MOTOR, *Part Vector Illustrations* data sheet — https://legacy-www.motor.com/wp-content/uploads/data-licensing-part-vector-illlustrations-product-description.pdf

---

## 10. Change log

| Date | Change |
|---|---|
| 2026-11-23 | Initial P1-07 decision package: six-candidate screen, two-provider matrix, licensing gate, 36-vehicle checklist, published cost stack, scoring weights, open decisions. No provider selected. |
