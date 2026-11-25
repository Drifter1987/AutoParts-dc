# Parts Data RFQ — Email Draft (P1-07)

**Purpose:** send to MOTOR data services and Epicor catalog/API sales. This is the quote request required by P1-07.
**Do not attach or paste:** VINs, plates, stock numbers, fleet sheets, backup files, API keys, or sandbox credentials.
**Do not accept:** a verbal "consumer is fine" without it appearing in the order, contract, or a signed exception.

---

## How to use

1. Replace the `[bracketed]` fields. Keep the subject line.
2. Send the same core email to both primary candidates, then append the matching provider-specific block from the end.
3. Copy legal or whoever will sign the data agreement.
4. Ask for answers in writing. A call is fine, but the licensing answers must be confirmed in the contract or an email you can attach to it.
5. Log the send date and reply in `PROJECT_TRACKER.md`; do not record contract values or credentials there.

---

## Licensing triage email — send this first

Use this to get a fast yes/no on the two licensing points before anyone spends time on coverage, samples, or pricing. Send it as its own email, not as part of the RFQ.

### Triage subject

`Licensing question: public consumer redisplay and scheduled bulk storage`

### Five-line body

```text
We are [Company / project name], building a public, no-login parts catalog for 36 US 2020 vehicles.
Before I send the full RFQ, I need a yes/no on licensing only.
Will [MOTOR / Epicor] license public consumer redisplay of parts and fitment data?
Will it also license scheduled bulk storage in our static build — records refreshed weekly or monthly, served without a per-lookup API call?
A one-line written answer (yes / no / yes with conditions) is enough; no coverage, sample, or pricing detail is needed yet.
```

**Send as:** `Hello [Name],` above the five lines, and `Thank you,` plus your name, title, company, email, and website below them. Swap `[MOTOR / Epicor]` per recipient; send separate emails and do not cc the other provider.

**Log the result** in `PROJECT_TRACKER.md` (date, provider, answer, who replied). A no ends that path before the RFQ; a conditional yes means the condition goes in writing with the full RFQ.

---

## Full RFQ subject

`Licensed parts and fitment data — 36 US 2020 vehicles, public consumer site, static build`

Alternate: `Data license request: OEM parts and fitment for 25–36 US vehicles (consumer redisplay)`

---

## Email body

Hello [Name],

I am [Name], [role] at [Company / project name] ([website]). We run AutoParts, a VIN-first vehicle research site for US consumers. A visitor decodes a VIN, confirms year, make, model, engine, and trim, and browses the parts that fit that configuration. Every record is meant to show its source, source record ID, last-updated date, and confidence, with a dealer-verification caveat.

We are evaluating a licensed parts and fitment dataset for 36 anchor vehicles (2020 model year, with 2018–2022 support), starting with 25. The target per vehicle is at least 4 assemblies and 30 parts, an OEM or reference number on every part, structured fitment (years, engines, trims, drivetrain, market, inclusions, exclusions), and per-record provenance.

Our use is public and pre-built rather than a live counter lookup, so I want to confirm licensing and delivery before we compare coverage or price.

### 1. Redisplay and storage — please answer in writing

a. Do you license display of part numbers, names, fitment, and provenance on a public, consumer-accessible website?
b. Do you permit us to store licensed records in our build and serve them as static files, refreshed on a schedule (for example weekly or monthly), instead of calling an API for each lookup?
c. If API-only: what is the maximum cache or storage period, and would a build-time snapshot be permitted?
d. Are OEM/manufacturer approvals included for every make in our list, or must we obtain them per make? Which makes require separate approval?
e. What attribution, disclaimer, trademark, or hyperlink requirements apply?
f. What must we delete or stop displaying when the agreement ends?

### 2. Coverage

a. Which of the 36 vehicles below do you cover for 2018–2022 with engine- and trim-specific fitment?
b. For each, how many parts and how many assemblies are available?
c. How do you represent exclusions — trim, drivetrain, brake or sport package, hybrid versus gas, market?
d. Do you cover the hybrid variants (RAV4 Hybrid, CR-V Hybrid, Escape Hybrid, Highlander Hybrid)?
e. Do you have the 2020 Honda Civic 1.5L Turbo and 2.0L with at least 30 parts across 4 assemblies? We currently have a representative slice and need to replace it with licensed data.

### 3. Fields and provenance

a. Is an OEM number present on every part? Are aftermarket numbers present as separate fields?
b. Do you supply supersessions with direction and effective date, alternate numbers, and interchange?
c. Do you supply quantity required and position?
d. Is there a stable source record ID and a last-updated timestamp per record?
e. May we display the provider name, record ID, and last-updated date to users?

### 4. Delivery and operations

a. What formats do you deliver: ACES/PIES XML, normalized JSON, CSV, API, or several?
b. If ACES/PIES: do you deliver decoded values, or would we need Auto Care reference database subscriptions (VCdb, Qdb, PCdb, PAdb) to interpret the files?
c. What is the update cadence, and how do we detect a stale or failed feed?
d. Do you offer sandbox or sample access and technical documentation?
e. If API: rate limits, availability target, and notice for breaking changes?

### 5. Quality and liability

a. What is the correction process for a wrong fitment, and what turnaround do you commit to?
b. What indemnity or limitation of liability applies to fitment errors?
c. May we run and publish a 10% spot-check method, including a material-error rate?
d. Can you provide references from a customer with a comparable public catalog?

### 6. Commercials

Please quote separately, in USD, for a 12-month term:

- annual license or platform fee;
- per-vehicle, per-part, per-API-call, or per-end-user fees;
- setup and onboarding;
- supersession, diagram, or image add-ons;
- minimums, renewal increases, and termination notice;
- trial or sample terms and duration.

State the assumptions behind the quote (number of makes, vehicles, records, and expected traffic) so we can compare providers like for like.

### 7. Sample request

Before any contract, please provide a sample export for:

1. 2020 Honda Civic 1.5L Turbo
2. 2020 Toyota RAV4 2.5L Hybrid
3. 2020 Ford F-150 3.5L EcoBoost
4. 2020 BMW 330i 2.0L Turbo
5. 2020 Chrysler Pacifica 3.6L

For each: all available assemblies, at least 30 parts, one assembly expanded to every part, fitment qualifiers and exclusions, OEM numbers, supersessions and interchange, and the record ID plus last-updated fields. A CSV or JSON sample and your data dictionary are enough. Please do not send credentials in email.

### 8. Next steps

We are comparing at least two providers and will decide by [date]. Please reply with the licensing answers, the sample, and the quote by [date]. If a call is easier, send a few times that work for you.

Thank you,
[Name]
[Title, Company / project]
[Email] · [Phone]
[Website]

---

## The 36 vehicles

Include this list in the email or attach it as a plain table. It is the same list as `docs/parts-data-spec.md` §3.

| # | Vehicle | Engines |
|---:|---|---|
| 1 | 2020 Honda Civic | 1.5L Turbo, 2.0L |
| 2 | 2020 Toyota Camry | 2.5L, 3.5L |
| 3 | 2020 Toyota Corolla | 1.8L, 2.0L |
| 4 | 2020 Honda Accord | 1.5L Turbo, 2.0L Turbo |
| 5 | 2020 Nissan Altima | 2.5L, 2.0L Turbo |
| 6 | 2020 Hyundai Elantra | 2.0L |
| 7 | 2020 Kia Soul | 2.0L |
| 8 | 2020 Ford F-150 | 2.7L EcoBoost, 3.5L EcoBoost, 5.0L |
| 9 | 2020 Chevrolet Silverado 1500 | 2.7L Turbo, 5.3L |
| 10 | 2020 Ram 1500 | 3.6L, 5.7L |
| 11 | 2020 Toyota RAV4 | 2.5L, 2.5L Hybrid |
| 12 | 2020 Honda CR-V | 1.5L Turbo, 2.0L Hybrid |
| 13 | 2020 Nissan Rogue | 2.5L |
| 14 | 2020 Ford Escape | 1.5L EcoBoost, 2.0L EcoBoost, 2.5L Hybrid |
| 15 | 2020 Chevrolet Equinox | 1.5L Turbo, 2.0L Turbo |
| 16 | 2020 Jeep Grand Cherokee | 3.6L, 5.7L |
| 17 | 2020 Subaru Outback | 2.5L, 2.4L Turbo |
| 18 | 2020 Mazda CX-5 | 2.5L, 2.5L Turbo |
| 19 | 2020 Hyundai Tucson | 2.0L, 2.4L |
| 20 | 2020 Kia Sportage | 2.0L, 2.4L |
| 21 | 2020 Volkswagen Jetta | 1.4L Turbo |
| 22 | 2020 Volkswagen Tiguan | 2.0L Turbo |
| 23 | 2020 BMW 330i | 2.0L Turbo |
| 24 | 2020 Mercedes-Benz C300 | 2.0L Turbo |
| 25 | 2020 Audi A4 | 2.0L Turbo |
| 26 | 2020 Lexus RX 350 | 3.5L |
| 27 | 2020 Acura RDX | 2.0L Turbo |
| 28 | 2020 Cadillac XT5 | 2.0L Turbo, 3.6L |
| 29 | 2020 GMC Sierra 1500 | 2.7L Turbo, 5.3L |
| 30 | 2020 Chrysler Pacifica | 3.6L |
| 31 | 2020 Ford Explorer | 2.3L EcoBoost, 3.0L EcoBoost |
| 32 | 2020 Toyota Highlander | 3.5L, 2.5L Hybrid |
| 33 | 2020 Honda Odyssey | 3.5L |
| 34 | 2020 Subaru Forester | 2.5L |
| 35 | 2020 Hyundai Santa Fe | 2.4L, 2.0L Turbo |
| 36 | 2020 Dodge Grand Caravan | 3.6L |

---

## Provider-specific closing blocks

Append one block, not all of them.

### MOTOR

> We have looked at MOTOR Parts and AccuPI. Please also confirm:
>
> - whether the Parts feed includes supersession trails or whether AccuPI is required;
> - whether bulk delivery (TXT, CSV, or XML) is available for a build-time catalog, not only REST lookups;
> - which OEM reviews and approvals would apply to the 21 makes in our list, and whether the order can expressly permit a public consumer catalog;
> - whether the DaaS sandbox can be extended beyond its snapshot for a couple of vehicles to the five sample vehicles.

### Epicor

> We have reviewed the Epicor Automotive Information Services Supplement dated 2025-11-14. Sections 2.2 and 2.3 appear to require on-demand, real-time lookups, cap caching at 24 hours, and prohibit consumer-facing use of MOTOR and Mitchell content. Please confirm:
>
> - whether Epicor can offer a written exception for a public consumer catalog with scheduled bulk refresh;
> - which Epicor Catalog content is not subject to the MOTOR/Mitchell restrictions;
> - which OEM consents are required for the 21 makes in our list;
> - whether an Order can name our public site as the approved Web Site.

### SEMA Data (optional accessory layer only)

> We understand SEMA Data covers specialty and performance brands with brand-by-brand approval. Please confirm current reseller tiers and API requirements, whether public consumer redisplay is permitted, and whether any participating brands cover 2020 replacement parts for Honda, Toyota, Ford, BMW, and Chrysler rather than accessories.

---

## If they answer "consumer use is fine"

Get these five points into the contract or a signed exception before any ingestion:

1. **Redisplay:** public, consumer-accessible website, no login required.
2. **Storage:** scheduled bulk storage in a build artifact, with a stated refresh interval and no per-lookup requirement.
3. **OEM approvals:** all 21 makes named, or a written list of which makes are excluded.
4. **Attribution:** exact copyright, disclaimer, and hyperlink text, and where it must appear.
5. **Termination:** what derived data must be deleted and in what timeframe.

A sales email that says "should be fine" is not a license. Keep the written answer with the contract.

---

## What not to send

- VINs, license plates, stock numbers, or `docs/fleet-vehicles.md`.
- Garage backup JSON files.
- API keys or the published MOTOR sandbox credentials.
- Traffic or revenue projections presented as commitments.
- Any statement that we already have a provider or an exclusive deal.

---

## Change log

| Date | Change |
|---|---|
| 2026-11-23 | Initial P1-07 RFQ email, vehicle list, provider-specific blocks, and contract checklist. No provider contacted yet. |
| 2026-11-23 | Added five-line licensing triage email to send before the full RFQ. |
