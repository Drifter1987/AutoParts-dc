# Parts Data Provenance & Pipeline

## Current status

The 2020 Honda Civic dataset in `src/data/parts/civic-2020.json` is a **representative product-development catalog**, not a licensed OEM feed. Part names and OEM/reference number formats are realistic, but every record is marked `confidence: "reference"` and the UI displays a verification disclaimer. Do not present this dataset as verified OEM fitment.

Catalog files in `src/data/parts/` are loaded automatically by `src/data/parts/index.ts`; the validator also checks the synthetic fixtures in `tests/fixtures/parts/`. Every catalog must declare a `recordType` and a `rights` block (`licensed`, `unlicensed`, or `synthetic`) before it validates.

The vertical slice exists to prove the schema, navigation, search, fitment presentation, and provenance fields before investing in licensed data.

## Record contract

Every part must carry:

| Field | Purpose |
|---|---|
| `slug` | Stable URL key, unique within the vehicle |
| `name` | Human-readable part name |
| `oemNumber` | Primary OEM or reference number |
| `alternateNumbers` | Other numbers printed on the part or superseded by it |
| `supersedes` | Numbers this record replaces or is replaced by |
| `interchange` | Aftermarket/interchange references |
| `aliases` | Search aliases used by mechanics and counter staff |
| `fitment.years` | Model years covered by the record |
| `fitment.engines` | Engine options from the catalog vehicle |
| `fitment.trims` | Trim options from the catalog vehicle |
| `fitment.market` | Market scope (US in the current slice) |
| `fitmentNotes` | Human-readable caveats and checks |
| `source` | Source or license identifier |
| `lastUpdated` | ISO date for the record |
| `confidence` | `verified`, `reference`, or `unconfirmed` |

The top-level catalog records its source, last-updated date, confidence, market, engine options, trim options, record type, rights status, and customer-facing disclaimer. Unlicensed development catalogs cannot declare public-web redisplay, carry `verified` confidence, or validate under `--require-licensed`.

## Validation gate

Run:

```bash
npm run validate:parts
```

The build runs this gate before `tsc` and Vite. It rejects:

- fewer than 3 or more than 5 assemblies
- fewer than 30 or more than 50 parts
- duplicate part or assembly slugs
- duplicate normalized OEM numbers
- missing source, date, confidence, or fitment fields
- unknown engine/trim values
- a fitment market that disagrees with the catalog market
- assemblies without parts

The validator prints normalized OEM counts, supersession coverage, interchange coverage, and per-assembly counts.

## Production ingestion requirements

Before replacing the representative slice:

1. **License first.** Secure written rights for OEM part data, diagrams, numbering, and trademark use. Do not scrape or republish OEM diagrams without permission.
2. **Preserve source evidence.** Keep the source document/feed ID, retrieval date, license ID, and confidence per record. Do not let a source label be overwritten by an aggregator.
3. **Normalize deliberately.** Store display formatting separately from the normalized key (`15400-PLM-A02` → `15400PLMA02`) and never use a lossy normalized key as the displayed number.
4. **Model fitment as rules, not prose.** Keep year/model/engine/trim/market scope in structured fields. Keep caveats in `fitmentNotes`.
5. **Version supersessions.** Record direction and effective dates; a superseded number should still be searchable.
6. **Validate before publishing.** Fail the publish job on duplicates, missing provenance, impossible fitment, or empty assemblies.
7. **Show confidence.** Distinguish verified OEM fitment from reference-only or unconfirmed records in the UI and in analytics.
8. **Respect trademarks.** Use brand names nominatively; do not imply affiliation, OEM endorsement, or licensed diagrams that are not licensed.

## Fitment policy

The current UI treats VIN decoding as year/make/model identification and asks the user to confirm engine and trim where needed. It never claims a VIN alone proves a brake pad, suspension, or emissions part fits. Every part page includes:

- a fitment signal for the selected engine/trim
- the catalog fitment scope
- a dealer-verification instruction
- source, last-updated date, and confidence

The production system should add market-specific rules, VIN pattern decoding, and supplier fitment validation before calling a result verified.
