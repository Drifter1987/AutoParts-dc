# Shared VIN decode cache — assessment

**Date:** 2026-11-22  
**Scope:** whether to add a shared, server-side cache of NHTSA VIN decodes to a static GitHub Pages app.  
**Status:** assessment only — nothing implemented.

---

## Bottom line

**Not worth adding now.** Three findings drive that:

1. **The infrastructure cost is irrelevant.** Cloudflare's free tier covers roughly 75,000 decodes/month at a 60% hit rate; $5/month covers about 2.5 million. The real cost is 3–5 engineering days plus a permanent second deploy target, monitoring surface, and a changed privacy claim — not hosting dollars.
2. **The cache cannot fix the fleet you actually listed.** Live vPIC returns `Make: AUDI` and *nothing else* for these German-market VINs (no model, trim, series, or body class). A shared cache would faithfully store and re-serve empty decodes. Meanwhile the app's real value for that fleet is the AU-number → plate mapping, which the cache does not touch.
3. **Two cheaper changes capture most of the benefit.** Fleet checking currently spends 25 decode calls where NHTSA accepts 1 batch request, and the existing `localStorage` cache is only a failure fallback rather than a fast path. Both are small, static-host-compatible fixes with no new infrastructure.

Revisit the shared cache when measured repeat-VIN traffic justifies it; see [Revisit triggers](#revisit-triggers).

The vehicle list itself is in [`docs/fleet-vehicles.md`](fleet-vehicles.md) (16 rows, verified identical to the supplied data; blank cells mean no value was provided).

---

## 1. What the app does today

| Behaviour | Current implementation | Consequence for a shared cache |
|---|---|---|
| Consumer decode | `decodeVin()` in `src/services/nhtsa.ts` — `DecodeVinValues` (flat) **plus** `DecodeVin` (verbose specs), so **2 upstream calls per decode** | A hit saves two round trips and ~12 KB of transfer |
| Local cache | `src/services/vinCache.ts` — `localStorage`, keyed by VIN, **max 8 entries**, stores `{result, savedAt}` | Only read inside the `catch` branch of `handleDecode`, i.e. a **failure fallback, never a fast path** |
| Cache hit UI | `cachedAt` renders "Cached decode from … — reconnect to refresh NHTSA data" | The honesty pattern a shared cache would also need already exists |
| Fleet check | `src/services/fleet.ts` — up to 25 VINs, 3 concurrent workers, `includeSpecs: false`, then one **model-year recall** call per VIN | Up to **50 requests per run**; fleet results are never cached at all |
| Backend | None. `vercel.json` contains only SPA rewrites; live host is GitHub Pages | A cache requires compute, which means the app stops being serverless-static |
| Traffic data | `VITE_TELEMETRY_ENDPOINT` is unset in this build; `src/services/telemetry.ts` is a no-op without it | **Actual decode volume and repeat rate are unknown** — every volume figure below is a scenario |

The constraint is explicit and documented: *"No server component. VIN decoding and recall lookup call NHTSA directly from the browser"* (`README.md`, `PROJECT_TRACKER.md`). Adding a cache is an architecture change, not a feature tweak.

---

## 2. Measured decode quality for this fleet

Live `DecodeVinValues` calls against `vpic.nhtsa.dot.gov`, 2026-11-22:

| VIN | Make | Model | Year | Trim / Series / BodyClass | Filled fields | ErrorCode | Latency |
|---|---|---|---|---|---|---|---|
| `WAUZZZHC2VA001164` (Audi A2 e-tron) | AUDI | — | 2027 | blank | 17 of ~154 | `5,14` | 0.90 s |
| `WAUZZZFJ2S1000156` (Q3 1.5) | AUDI | — | 2025 | blank | 10 of ~154 | `8` | 0.66 s |
| `2HGFC2F59LH500001` (US control) | HONDA | Civic | 2020 | LX / — / Sedan | 62 of ~154 | `1` | 0.44 s |

Error text confirms the gap: *"5 – VIN has errors in few positions; 14 – Unable to provide information for some of the characters in the VIN, based on the manufacturer submission"* and *"8 – No detailed data available currently."*

This is expected. vPIC is populated from US-market manufacturer Part 565 submissions; a `WAUZZZ…` Audi built for the German market can legitimately decode to make and model year with everything else blank. The verbose control call returned 58 usable specs (~4.4 KB normalized).

**Implications:**

- A VIN-keyed cache of this fleet would store ~1–2 KB of near-empty payloads and present them, on every later hit, as the authoritative answer.
- The cache would make thin data **sticky**: today a re-decode is a fresh chance for NHTSA to have filled the gap; a cached blank locks it in for the TTL.
- The feature that would actually help this fleet — AU number and plate lookup, plus a real European decode source — is outside the cache's scope.

**Source-data defect worth fixing regardless:** `WAUZZZGY5VA000149` appears twice, once as a `Q3` (`AU380170252`, no plate) and once as an `S3 Spb` (`AU380170257`, `IN-S3680`). One VIN cannot identify two vehicles, so one row is wrong. A VIN-keyed cache would silently collapse both rows onto a single decode, which is exactly the failure mode to avoid when the VIN itself is untrusted.

---

## 3. What a shared cache would and would not buy

| Lever | Assessment | Weight |
|---|---|---|
| **Cross-user hit rate** | Only genuine new benefit. Same-browser repeats are already covered by `localStorage` in principle (though not wired as a fast path). Consumer VIN traffic is long-tailed, so most VINs are seen once. | **Decisive — currently unknown** |
| **Latency** | Saves 0.4–0.9 s (flat) plus the verbose call on a hit; a Worker round trip is roughly 30–80 ms. Real but one-time per VIN per user. | Moderate |
| **Resilience** | Strongest technical case. NHTSA targets ~99% availability in US business hours, schedules weekend maintenance, and third-party reports describe 503s after bursts. A shared cache gives every user the warm result the 8-entry local cache can only give one browser. | Moderate–high |
| **Rate-limit protection** | Weak. NHTSA states there is **no daily query cap** and that it handles 1,000–2,000 transactions/minute. This app will not approach that. | Low |
| **Direct cost** | Zero either way. NHTSA is free and keyless, so the cache saves no vendor spend — only latency and failures. | None |
| **Recall freshness** | A cache does **not** help, and must not try. Campaigns change continuously; recall lookup is already a separate model-year call in `src/services/recalls.ts`. | Constraint |
| **European coverage** | No effect. The gap is dataset coverage, not caching. | None |

---

## 4. Hit-rate economics

The only question that matters: **how often is the same VIN decoded again by a different user or session within the TTL?**

- **Same browser, same VIN** — solvable for free by making `vinCache.ts` a read-through cache. A shared cache adds nothing here.
- **Different user, same VIN** — the shared cache's entire value. Plausible for dealer stock, repeated fleet audits, and auction re-checks. Implausible for one-off consumer lookups.
- **Fleet runs** — the best repeat-VIN candidate, because the same 16–25 VINs get re-checked on a schedule. But the batch endpoint solves the request count better than a cache does (25 → 1 request, versus 25 → ~10 on a 60% hit rate).

With no telemetry configured, the repeat rate is unmeasured. Building infrastructure on an assumed 60–70% hit rate — a number borrowed from high-volume commercial VIN APIs — would be unsupported for a static demo-scale app.

---

## 5. Serverless options

None of these can be called safely with write access directly from the browser: a Cloudflare KV namespace has no public HTTP API, and an Upstash REST token shipped in a Vite bundle is a published secret. **A small compute layer (Worker or function) is mandatory**, and it must own the upstream decode so clients can never insert arbitrary vehicle data.

| Option | Free tier | Browser-callable? | Fit |
|---|---|---|---|
| **Cloudflare Worker + Workers KV** | 100k requests/day; KV 100k reads/day, **1,000 writes/day**, 1 GB | Via the Worker with CORS; KV itself is not public | **Best fit.** Cheapest, lowest latency, tiny code, no cold-start problem. Write cap is the binding free-tier limit. |
| **Cloudflare Worker + D1** | 5M rows read/day, 100k written/day, 5 GB | Via the Worker | Works, but SQL is overkill for `VIN → JSON`. Choose only if you want per-VIN audit or querying. |
| **Vercel Function + Upstash Redis** | Upstash: 500k commands/month, 250 MB, 10 GB bandwidth | Via the function; Upstash has a REST API but its token must stay server-side | Good if hosting moves to Vercel (`vercel.json` already exists). Vercel's first-party KV was retired in favour of Upstash via the Marketplace, so this is two vendors. |
| **Vercel Edge Config** | 1 MB total store, 1 store on Hobby, 10 s write propagation | Read-only via Vercel runtimes | **Unsuitable.** A configuration store, not a per-VIN cache. 1 MB holds roughly 150 decodes. |
| **Supabase / Postgres** | Free project tier | PostgREST + RLS | Overkill: auth, RLS, and connection handling for a key-value workload. |
| **Cloudflare R2** | 10 GB, 1M Class A / 10M Class B ops | Via the Worker | Cheap but wrong shape: no TTL semantics, higher per-key latency than KV. |
| **Build-time snapshot (static JSON)** | $0, no server | Directly from the CDN | Only covers known VINs — viable for the 16-row fleet list, useless for arbitrary input. |
| **Upstash Redis called directly from the browser** | 500k commands/month | Yes, REST + CORS | **Reject.** The token would ship in the bundle, letting anyone read, poison, or wipe the cache. |

Operational caveat for either managed KV: both are eventually consistent. Cloudflare KV propagates writes globally in up to ~60 s, and Upstash lists strong consistency as unavailable on Free and Pay-as-you-go. A burst of first-time lookups for the same VIN can therefore miss repeatedly; the Worker needs single-flight coalescing, not just a cache.

---

## 6. Cost

**Assumptions:** 60% hit rate; a miss costs one KV read, one KV write, and two NHTSA calls; a hit costs one KV read; each cached entry is 6–7 KB (flat fields plus normalized `all_specs`). NHTSA itself is free.

### Cloudflare Worker + KV

| Monthly decodes | KV reads | KV writes (misses) | Worker requests | Plan | Est. $/month |
|---|---|---|---|---|---|
| 1,000 | 1,000 | 400 | 1,000 | Free | **$0** |
| 10,000 | 10,000 | 4,000 | 10,000 | Free | **$0** |
| 75,000 | 75,000 | 30,000 | 75,000 | Free (at the 1,000 writes/day ceiling) | **$0** |
| 250,000 | 250,000 | 100,000 | 250,000 | Paid | **$5** |
| 1,000,000 | 1,000,000 | 400,000 | 1,000,000 | Paid, all within allowance | **$5** |
| 2,500,000 | 2,500,000 | 1,000,000 | 2,500,000 | Paid (at the 1M writes/month ceiling) | **$5** |
| 10,000,000 | 10,000,000 | 4,000,000 | 10,000,000 | Paid | **$20** |

Paid is a $5/month account minimum including 10M requests, 10M KV reads, 1M KV writes, and 1 GB storage; extra KV writes are $5/million. **Reads are cheap; writes are the constraint.** Storage also matters if the cache is unbounded: 6.5 KB × 100,000 VINs ≈ 650 MB (inside the free 1 GB), 1M VINs ≈ 6.5 GB (≈ $2.75/month extra).

### Upstash Redis

1.4 commands per decode (one read per hit, read + write per miss). Free tier: 500k commands/month ≈ **357,000 decodes/month**. At 1M decodes, ~900k commands over the free allowance ≈ **$1.80/month**. The real free-tier cap is storage: 250 MB ≈ **38,000 cached VINs**, after which you either pay or evict.

### Engineering cost

3–5 days for a production-quality version: Worker, CORS, VIN validation, cache-aside with single-flight, negative caching, TTL policy, tests, a second deploy pipeline, privacy copy, and documentation — plus ongoing ownership of a new origin and its failure modes. That dwarfs $0–$20/month of infrastructure and is the actual budget question.

---

## 7. Stale-data risk

A VIN decode is *mostly* immutable, which is why a cache is defensible at all. It is not uniformly safe.

| Data class | Changes over time? | Safe TTL | Risk if cached too long |
|---|---|---|---|
| WMI / VDS / model year / plant | Effectively immutable (assigned at build) | 90–365 days | Very low; rare corrections only |
| Model, trim, series, body class | Manufacturer-dependent; filings and corrections land later | 30–90 days | **High for this fleet** — a blank cached today stays blank |
| Engine, fuel, drive type, equipment | Often blank at first filing, filled later | 30–90 days | "Unknown" becomes permanent in the UI |
| `ErrorCode` / `ErrorText` advisories | Depends on NHTSA's decoder logic and release cycle | Recompute, or ≤7 days | A check-digit warning shown for a VIN that has since been corrected |
| Recalls / complaints | Continuous | **Never in this cache**; hours at most | Users act on recall data — the highest-consequence staleness |
| Negative results (undecodable VIN) | A typo is permanent; coverage is not | Minutes–1 day | A mistyped VIN stays broken for everyone |

**Rules if it is ever built:**

1. **Key on the normalized VIN only** — uppercase, trimmed, reject `I`/`O`/`Q`, exactly 17 characters. Never accept client-supplied decode JSON; the Worker calls NHTSA itself.
2. **Separate TTLs by class.** Do not put recalls in the same entry or the same TTL.
3. **Never cache a failed or empty decode for long.** Negative entries deserve minutes-to-hours, not days. If `Model` is blank, that is a thin decode, not a valid answer to immortalize.
4. **Store provenance.** Keep `ErrorCode`, `ErrorText`, `fetchedAt`, and the vPIC release version, so an entry can be invalidated after a release and the UI can say how old it is.
5. **Bound the store.** TTL plus eviction; otherwise storage cost grows without limit and stale entries outlive their usefulness.
6. **Add single-flight.** Eventual consistency plus a cold key means concurrent misses would otherwise hammer NHTSA.

---

## 8. Privacy and product constraints

This is the largest non-monetary cost and the easiest to overlook.

- The Fleet page states: *"It is a client-side batch tool; no VIN list is uploaded to a server."* A shared cache makes that false unless the copy changes and the storage is tightly limited.
- A VIN identifies a vehicle; a VIN list with plates and internal AU numbers is commercially sensitive fleet data. Today none of it leaves the browser except the individual VIN sent to NHTSA.
- A cache turns the Worker into a log of every VIN looked up, by IP, unless logging is explicitly disabled. That is a new data-retention obligation for a feature that currently has none.

**If built:** store only `normalized VIN → decode + fetchedAt`. No plates, no AU numbers, no user or session identifiers, no request logs, documented retention, and updated copy on the Fleet page and in `README.md`/`PROJECT_TRACKER.md` where "no server component" is asserted.

---

## 9. Recommendation

### Do now — no infrastructure, static-host compatible

1. **Batch the fleet decode.** `DecodeVinValuesBatch` accepts up to 50 VINs in one POST, with optional model years (`vin,year; vin,year`). The fleet limit is 25 and already skips verbose specs, so this is a direct fit: up to 25 decode calls become 1. Biggest single reduction available, roughly half a day.
2. **Make `vinCache.ts` a real read-through cache.** Check it before the network call, add a TTL (30–90 days) and reuse the existing `cachedAt` age label. One to two hours, fixes same-browser repeat decodes today.
3. **Instrument the question.** The telemetry boundary already exists; when a collector is configured, record `vin_repeat_seen` with a coarse bucket and no raw VIN. You cannot size a shared cache without the repeat rate.

Optional, if the fleet list is fixed: pre-decode the 16 known VINs at build time with one batch call and ship a static JSON snapshot. Zero runtime cost, zero privacy change, and it makes the known fleet instant — at the price of being a snapshot.

### Revisit triggers

Treat any one of these as evidence to build it — and measure them before guessing:

- **≥25–30%** of decodes in a rolling 30 days are VINs seen before by a *different* session.
- Fleet runs exceed roughly **20/day**, or the same fleet is re-checked on a schedule.
- NHTSA decode failures/timeouts exceed **2–3%** of attempts and visibly degrade the flow.
- A B2B/dealer integration requires a stable, low-latency decode SLA.

### If built — reference shape

One Cloudflare Worker at a dedicated origin, called from the static app with CORS locked to the Pages origin and localhost. The Worker validates the VIN, reads KV, and on a miss calls NHTSA itself (batch when the request has multiple VINs), then writes with a class-appropriate TTL and provenance. Browser fallback to direct NHTSA stays, so a Worker outage degrades to today's behaviour rather than breaking the app. No plates, no AU numbers, no user identifiers, no request logging.

---

## 10. Limitations

- **No traffic data.** No telemetry collector is configured, so volume and repeat rate are unknown. Every cost and hit-rate figure is a labelled scenario, not a measurement.
- **Three-VIN probe.** The decode-quality finding is a 2026-11-22 point-in-time sample of two fleet VINs plus one US control, not a survey of all 16 rows or of vPIC coverage generally.
- **Third-party rate-limit reports.** NHTSA publishes no per-minute cap; the observed 429-at-sustained->5 req/s and post-burst 503 behaviour comes from third-party guides, not NHTSA documentation. NHTSA's own FAQ says there is no daily cap.
- **No load test and no prototype.** Latency and hit-rate behaviour of a real Worker deployment were modelled, not measured.
- **Pricing is as published on 2026-11-22** and can change; free-tier limits in particular are the sort of thing vendors revise.

---

## 11. Sources

- NHTSA vPIC FAQ — no daily query limit, 1,000–2,000 transactions/minute, coverage confidence, batch guidance: <https://vpic.nhtsa.dot.gov/api/home/index/faq>
- NHTSA vPIC API reference — `DecodeVinValuesBatch`, max 50 VINs per batch: <https://vpic.nhtsa.dot.gov/api>
- NHTSA vPIC release notes — v4.10 (2026-10-17), release cadence: <https://vpic.nhtsa.dot.gov/api/Home/Index/ReleaseNotes>
- Cloudflare Workers and KV pricing: <https://developers.cloudflare.com/workers/platform/pricing>
- Cloudflare KV pricing: <https://developers.cloudflare.com/kv/platform/pricing>
- Upstash Redis pricing and free tier: <https://upstash.com/pricing/redis>
- Vercel Edge Config limits: <https://vercel.com/docs/global-config/global-config-limits>
- Upstash for Vercel Marketplace: <https://vercel.com/marketplace/upstash>
- Third-party practical guides (observed 429/503 behaviour, TTL guidance): <https://auctionsapi.com/articles/nhtsa-vpic-api>, <https://eitserv.tech/en/blog/nhtsa-vin-decoder-api-tutorial>
