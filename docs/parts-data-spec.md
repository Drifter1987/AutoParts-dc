# Parts Data Specification — Phase 2

**Status:** Draft for provider discussions and P2-01/P2-02 execution  
**Owner:** TBD  
**Last updated:** 2026-11-22

This document defines the parts data AutoParts needs before it can claim to be a parts catalog. It is the input to `plan-AutoParts-fb.md` Phase 2 and the gate for replacing the current representative 2020 Civic slice with licensed, traceable records.

---

## 1. Objective and non-goals

### Objective

For each vehicle in the shortlist, a user must be able to:

1. confirm the vehicle by VIN or year/make/model/engine/trim;
2. see the assemblies and parts that fit that configuration;
3. see an OEM/reference number, supersessions/interchange where available, and fitment notes;
4. see where the record came from, when it was updated, and how confident the catalog is;
5. reach a dealer or retailer handoff without AutoParts inventing price, stock, or fitment.

### Non-goals for Phase 2

- No live price, stock, or checkout. Those are Phase 3.
- No VIN-specific open-recall determination. Recalls stay model-year with a VIN-specific NHTSA link.
- No AI-generated part numbers, fitment, diagrams, or descriptions.
- No diagrams or images unless redisplay rights are explicit.
- No “representative” data presented as licensed OEM data.

---

## 2. Coverage target

**Minimum Phase 2 release:** 25 vehicles with validated parts and fitment.  
**Recommended target:** 36 anchor vehicles (listed below), expandable to 50 after the first ingestion proves the pipeline.

### Per-vehicle acceptance

| Requirement | Threshold |
|---|---|
| Assemblies per vehicle | At least 4 |
| Parts per vehicle | At least 30 |
| OEM/reference number present | 100% of parts |
| Source + last-updated present | 100% of parts |
| Fitment rule present | 100% of parts |
| Engine/trim variants represented | At least 2 where the vehicle was sold with more than one |
| Diagram/asset rights | Only where explicit; otherwise omit |
| Spot-check sample | At least 10% of records, including every assembly |
| Material fitment errors in sample | ≤2% |
| Duplicate part numbers within a vehicle | 0 unless intentionally documented |

A vehicle with fewer than 30 parts is a **partial coverage** record and must be labeled as such, not counted toward the 25-vehicle gate.

---

## 3. Vehicle shortlist

**Anchor year:** 2020. The provider must support at least 2018–2022 for each nameplate; start with 2020 to match the existing Civic slice and expand by year after validation.

**Selection logic:** US-market volume, aftermarket parts availability, engine/trim variety, and a mix of passenger cars, SUVs, trucks, and fleet vehicles. The list intentionally includes direct platform siblings (Silverado/Sierra, Tucson/Sportage) because they exercise shared-fitment handling.

| # | Anchor vehicle | Engines to start | Segment | Priority |
|---:|---|---|---|---|
| 1 | 2020 Honda Civic | 1.5L Turbo, 2.0L | Compact car | P0 — existing slice |
| 2 | 2020 Toyota Camry | 2.5L, 3.5L | Midsize car | P0 |
| 3 | 2020 Toyota Corolla | 1.8L, 2.0L | Compact car | P0 |
| 4 | 2020 Honda Accord | 1.5L Turbo, 2.0L Turbo | Midsize car | P0 |
| 5 | 2020 Nissan Altima | 2.5L, 2.0L Turbo | Midsize car | P1 |
| 6 | 2020 Hyundai Elantra | 2.0L | Compact car | P1 |
| 7 | 2020 Kia Soul | 2.0L | Compact SUV | P1 |
| 8 | 2020 Ford F-150 | 2.7L EcoBoost, 3.5L EcoBoost, 5.0L | Full-size truck | P0 |
| 9 | 2020 Chevrolet Silverado 1500 | 2.7L Turbo, 5.3L | Full-size truck | P0 |
| 10 | 2020 Ram 1500 | 3.6L, 5.7L | Full-size truck | P0 |
| 11 | 2020 Toyota RAV4 | 2.5L, 2.5L Hybrid | Compact SUV | P0 |
| 12 | 2020 Honda CR-V | 1.5L Turbo, 2.0L Hybrid | Compact SUV | P0 |
| 13 | 2020 Nissan Rogue | 2.5L | Compact SUV | P1 |
| 14 | 2020 Ford Escape | 1.5L EcoBoost, 2.0L EcoBoost, 2.5L Hybrid | Compact SUV | P1 |
| 15 | 2020 Chevrolet Equinox | 1.5L Turbo, 2.0L Turbo | Compact SUV | P1 |
| 16 | 2020 Jeep Grand Cherokee | 3.6L, 5.7L | Midsize SUV | P1 |
| 17 | 2020 Subaru Outback | 2.5L, 2.4L Turbo | Wagon/SUV | P1 |
| 18 | 2020 Mazda CX-5 | 2.5L, 2.5L Turbo | Compact SUV | P1 |
| 19 | 2020 Hyundai Tucson | 2.0L, 2.4L | Compact SUV | P2 |
| 20 | 2020 Kia Sportage | 2.0L, 2.4L | Compact SUV | P2 |
| 21 | 2020 Volkswagen Jetta | 1.4L Turbo | Compact car | P2 |
| 22 | 2020 Volkswagen Tiguan | 2.0L Turbo | Compact SUV | P2 |
| 23 | 2020 BMW 330i | 2.0L Turbo | Luxury sedan | P2 |
| 24 | 2020 Mercedes-Benz C300 | 2.0L Turbo | Luxury sedan | P2 |
| 25 | 2020 Audi A4 | 2.0L Turbo | Luxury sedan | P2 |
| 26 | 2020 Lexus RX 350 | 3.5L | Luxury SUV | P2 |
| 27 | 2020 Acura RDX | 2.0L Turbo | Luxury SUV | P2 |
| 28 | 2020 Cadillac XT5 | 2.0L Turbo, 3.6L | Luxury SUV | P2 |
| 29 | 2020 GMC Sierra 1500 | 2.7L Turbo, 5.3L | Full-size truck | P2 |
| 30 | 2020 Chrysler Pacifica | 3.6L | Minivan | P1 — fleet |
| 31 | 2020 Ford Explorer | 2.3L EcoBoost, 3.0L EcoBoost | Midsize SUV | P2 |
| 32 | 2020 Toyota Highlander | 3.5L, 2.5L Hybrid | Midsize SUV | P2 |
| 33 | 2020 Honda Odyssey | 3.5L | Minivan | P1 — fleet |
| 34 | 2020 Subaru Forester | 2.5L | Compact SUV | P2 |
| 35 | 2020 Hyundai Santa Fe | 2.4L, 2.0L Turbo | Midsize SUV | P2 |
| 36 | 2020 Dodge Grand Caravan | 3.6L | Minivan | P2 — fleet |

### Expansion after the first 36

Add vehicles only if the provider covers them cleanly and the Phase 2 validator passes. Candidate next set: 2020 Tesla Model 3, 2020 Chevrolet Bolt EV, 2020 Toyota Tacoma, 2020 Nissan Sentra, 2020 Kia Forte, 2020 Mazda3, 2020 Subaru Impreza, 2020 Ford Fusion, 2020 Chevrolet Malibu, 2020 Buick Encore, 2020 GMC Terrain, 2020 Jeep Cherokee, 2020 Dodge Charger, 2020 Chrysler 300.

Do not pad the count with vehicles that only have universal accessories (wipers, floor mats) or no engine-specific fitment.

---

## 4. Required data model

The implementation should extend the existing `VehicleCatalog`, `PartAssembly`, and `CatalogPart` types rather than invent a parallel schema.

### 4.1 Vehicle record

| Field | Required | Notes |
|---|---|---|
| `vehicle_id` | Yes | Stable internal ID, e.g. `2020-honda-civic` |
| `year` | Yes | Anchor year; fitment rules may span years |
| `make` | Yes | Display make |
| `model` | Yes | Display model |
| `generation` | Yes | Platform/generation, e.g. `10th gen` |
| `market` | Yes | `US`, `CA`, `EU`, etc. |
| `body_style` | Yes | Sedan, coupe, SUV, truck, minivan |
| `engine_options` | Yes | Normalized display strings |
| `trim_options` | Yes | Normalized display strings |
| `drivetrain_options` | Where applicable | FWD, AWD, 4WD, RWD |
| `source` | Yes | Provider/dataset name |
| `source_record_id` | Yes | Provider row/vehicle ID |
| `last_updated` | Yes | ISO date from provider |
| `confidence` | Yes | `verified`, `reference`, or `unconfirmed` |
| `license` | Yes | Redisplay terms or contract reference (no secrets) |
| `disclaimer` | Yes | User-facing fitment caveat |

### 4.2 Assembly record

| Field | Required | Notes |
|---|---|---|
| `slug` | Yes | URL-safe, stable |
| `name` | Yes | e.g. `Front brakes` |
| `summary` | Yes | Short description |
| `diagram_label` | Only with rights | Do not ship an unlicensed diagram |
| `parts` | Yes | At least one validated part |

### 4.3 Part record

| Field | Required | Notes |
|---|---|---|
| `part_id` | Yes | Stable internal ID |
| `slug` | Yes | URL-safe, stable |
| `name` | Yes | Display name |
| `assembly_slug` | Yes | Parent assembly |
| `position` | Where applicable | Front/rear/left/right/upper/lower |
| `oem_number` | Yes | Primary OEM/reference number |
| `brand` | Yes | OEM or supplier brand |
| `alternate_numbers` | No | Only sourced numbers |
| `supersedes` | No | Only sourced supersessions |
| `interchange` | No | Only sourced interchange |
| `quantity_required` | Where applicable | Integer |
| `fitment` | Yes | See 4.4 |
| `fitment_notes` | Yes | Plain-language caveats |
| `source` | Yes | Provider/dataset |
| `source_record_id` | Yes | Provider row ID |
| `last_updated` | Yes | ISO date |
| `confidence` | Yes | `verified`, `reference`, or `unconfirmed` |
| `license` | Yes | Redisplay rights |
| `assets` | No | Only with explicit diagram/image rights |

### 4.4 Fitment rule

| Field | Required | Notes |
|---|---|---|
| `years` | Yes | Inclusive year list/range |
| `engines` | Yes | Engine(s) the part fits |
| `trims` | Yes | Trims or `all` with a source |
| `drivetrains` | Where applicable | FWD/AWD/4WD/RWD |
| `market` | Yes | Market the rule applies to |
| `inclusions` | No | e.g. heavy-duty brakes, sport package |
| `exclusions` | No | e.g. not for hybrid, not for 19-inch wheels |
| `notes` | Yes | Human-readable caveat |
| `source` | Yes | Provider/dataset |

### 4.5 Provenance block

Every part and vehicle must expose:

```json
{
  "source": "Provider name",
  "sourceRecordId": "provider-row-id",
  "lastUpdated": "2026-11-22",
  "confidence": "verified",
  "license": "Contract/reference ID or short rights note"
}
```

The UI must show `source`, `lastUpdated`, `confidence`, `market`, and the fitment caveat. A record without these fields fails ingestion.

### 4.6 Commerce fields (Phase 3 only)

Do not ingest these in Phase 2. When Phase 3 starts, offers require:

| Field | Required | Notes |
|---|---|---|
| `partNumber` | Yes | Exact match to the catalog record |
| `retailer` | Yes | Display name |
| `price` | Only if supplied | No estimation |
| `currency` | Yes | ISO currency |
| `inStock` | Only if supplied | `null` when unknown |
| `url` | Yes | Destination link |
| `fitmentConfidence` | Yes | `confirmed` or `conditional` |
| `disclosure` | Yes | Affiliate/lead disclosure |
| `updatedAt` | Yes | Feed timestamp |

No price or stock may be inferred from another retailer, another part number, or historical data.

---

## 5. Ingestion format

- One JSON file per vehicle under `src/data/vehicles/` (or the chosen equivalent), validated at build time.
- A build index lists `vehicle_id`, `year`, `make`, `model`, and data file path; the app must not load every vehicle's parts into the initial bundle.
- Extend `scripts/validate-parts.mjs` to enforce:
  - required fields;
  - non-empty assemblies and parts;
  - unique part numbers within a vehicle (unless documented);
  - valid fitment arrays;
  - source/license/last-updated present;
  - no placeholder names (`TBD`, `unknown`, `representative` unless the confidence is explicitly `reference`);
  - no diagram path without a rights flag.
- Preserve the existing URL shape: `/catalog/:brand/:model/:year/:assembly/:part`.
- Keep the 2020 Civic valid as the first record during migration.

### 5.1 Example record (shape only)

```json
{
  "vehicle": {
    "vehicle_id": "2020-honda-civic",
    "year": 2020,
    "make": "Honda",
    "model": "Civic",
    "generation": "10th gen",
    "market": "US",
    "engine_options": ["1.5L Turbo", "2.0L"],
    "trim_options": ["LX", "EX", "EX-L", "Sport", "Si", "Type R"],
    "source": "Licensed provider",
    "source_record_id": "provider-vehicle-123",
    "last_updated": "2026-11-22",
    "confidence": "verified",
    "license": "Redisplay permitted; diagrams excluded"
  },
  "assemblies": [
    {
      "slug": "front-brakes",
      "name": "Front brakes",
      "summary": "Pads, rotors, calipers, and hardware for the front axle.",
      "parts": [
        {
          "part_id": "provider-part-456",
          "slug": "front-brake-pads",
          "name": "Front brake pad set",
          "position": "front",
          "oem_number": "45022-TBA-A01",
          "brand": "Honda",
          "alternate_numbers": [],
          "supersedes": [],
          "interchange": [],
          "fitment": {
            "years": [2020],
            "engines": ["1.5L Turbo", "2.0L"],
            "trims": ["LX", "EX", "EX-L", "Sport"],
            "drivetrains": ["FWD"],
            "market": "US",
            "inclusions": [],
            "exclusions": ["Type R", "Si"],
            "notes": "Verify with VIN; pad shape varies by trim."
          },
          "fitment_notes": "Confirm the exact pad shape with the VIN before ordering.",
          "source": "Licensed provider",
          "source_record_id": "provider-part-456",
          "last_updated": "2026-11-22",
          "confidence": "verified",
          "license": "Redisplay permitted"
        }
      ]
    }
  ]
}
```

---

## 6. Provider requirements and questions

Ask every provider:

1. Which of the 36 anchors do you cover for 2018–2022, with engine and trim-specific fitment?
2. Is the data ACES/PIES, a proprietary API/export, or both?
3. Do you supply OEM numbers, supersessions, interchange, and quantity required?
4. How are fitment exclusions (trim, drivetrain, brake package, market) represented?
5. What are the redisplay rights for part data, diagrams, and images?
6. How often is the data updated, and how do we detect a stale feed?
7. Can we store and display the provider record ID and last-updated date?
8. What is the correction/indemnity process for a wrong fitment?
9. Can we export a sample for 3 vehicles before signing?
10. What is the cost model (flat license, per-vehicle, per-part, API call)?

### Minimum provider answers

- Explicit redisplay rights for the fields we show.
- A sample with at least 3 vehicles and 100 parts.
- A stable record ID and update timestamp.
- A documented fitment-exclusion format.
- No requirement to hide provenance from users.

---

## 7. QA and acceptance process

### Sample validation

1. Pick 10% of parts per vehicle, including every assembly.
2. Compare OEM number, engine/trim fitment, and supersession/interchange against the provider or a dealer source.
3. Record the check in this document or a linked QA sheet (no customer/VIN data).
4. Classify errors:
   - **Material:** wrong part for the vehicle, wrong engine/trim, wrong OEM number.
   - **Minor:** formatting, missing optional alternate number, wording.
5. A material error rate above 2% blocks the vehicle from release.

### Automated gates

- `npm run validate:parts` passes.
- A covered vehicle with zero parts fails the build.
- A part with no source/license/last-updated fails the build.
- A diagram asset without a rights flag fails the build.
- A duplicate part number within a vehicle fails unless explicitly allowed.

### Manual gates

- VIN → confirm vehicle → assembly → part → provenance works for every P0 vehicle.
- Fitment conflict states are tested for wrong engine, wrong trim, wrong year, and unknown configuration.
- The Axe gate passes on catalog and part routes.
- No “representative” label remains on licensed records.
- Every part page shows source, last updated, confidence, market, and the dealer-verification caveat.

---

## 8. Phase 2 exit checklist

- [ ] 25+ vehicles meet the per-vehicle acceptance table.
- [ ] 36 anchor vehicles are either complete or explicitly marked partial.
- [ ] Every part has OEM number, source, last-updated, confidence, and fitment.
- [ ] 10% spot check completed; material error rate ≤2%.
- [ ] Validator rejects missing provenance and zero-part vehicles.
- [ ] VIN-first flow works for every P0 vehicle.
- [ ] Search handles OEM formats and common aliases.
- [ ] No unlicensed diagram or image is shipped.
- [ ] `PROJECT_TRACKER.md` lists covered vehicles, sources, and known gaps.
- [ ] `plan-AutoParts-fb.md` P2-02 and P2-08 are marked done with the validation evidence.

---

## 9. Open decisions

| Decision | Owner | Needed by |
|---|---|---|
| Provider / license | TBD | Before P2-02 |
| First 12 vehicles vs full 36 | TBD | Before P2-02 |
| Diagram rights included? | TBD | Before any diagram UI |
| JSON files vs generated index | TBD | P2-01 |
| Public “coverage” count wording | TBD | P2-05 |
| Error threshold (2% proposed) | TBD | P2-08 |

---

## 10. Change log

| Date | Change |
|---|---|
| 2026-11-22 | Initial draft: 36 anchors, required fields, provider questions, QA gates |
