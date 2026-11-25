# ADR-001 — Stay client-only, label paid and licensed surfaces

- **Status:** Proposed for the owner's approval
- **Date:** 2026-11-25
- **Scope:** Phase 2 free work and Phase 3 placeholders

## Context

The product plan has three phases. Phase 1 is shipped. Phase 2 needs licensed parts
data for coverage beyond the representative 2020 Civic slice. Phase 3's retention
and commercial features need a backend, authentication, a messaging service, a
commerce feed, a payments provider, and monitoring. None of those dependencies are
licensed or funded yet.

Building fake accounts, prices, stock, recall monitoring, or parts would violate the
product's data-honesty rules. Hiding the roadmap would make the product look smaller
than it is. The chosen middle path is to ship every capability that works entirely in
the browser and show every gated capability as an explicit **Coming soon**
placeholder with the dependency named.

## Decision

1. The application remains a static, client-only build. No account system, database,
   server API, email/SMS sender, or payment integration is added in this phase.
2. Coverage requests and fitment reports stay in `localStorage`. They reach the team
   only through the user's own CSV download from `/tools#feedback-export`. No email
   address or contact detail is collected.
3. Parts data remains the representative, unlicensed 2020 Civic slice. The validator
   gates new catalogs; `--require-licensed` fails until real rights exist. No additional
   vehicles, prices, stock, or fitment records are invented.
4. Every paid, licensed, or backend-dependent feature is visible on `/roadmap` and in
   the relevant product surface with the exact label **Coming soon** and a short
   dependency note.
5. Free Phase 2 work — schema, loader, validation, ranked search, provenance,
   freshness, fitment explanations, feedback export — is shipped client-side.
6. Telemetry stays anonymous and free of VINs, emails, plates, notes, and free text.

## Consequences

- Users can do real VIN, safety, catalog, garage, checklist, fleet, and feedback work
  today without an account.
- The roadmap is honest about what is missing; no surface claims a capability that
  does not work.
- Data remains tied to one browser until Phase 3 is approved and funded.
- Enabling any Coming soon feature requires a new ADR covering the provider, data
  model, PII retention/deletion, authentication, rate limits, and cost.

## Triggers to revisit

- A licensed parts agreement permits consumer redisplay and scheduled bulk storage.
- The owner approves a backend/auth budget and a privacy model.
- A commerce, messaging, payments, or monitoring provider is selected and funded.
