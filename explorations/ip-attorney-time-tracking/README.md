# IP Attorney Time Tracking

## Status

Stage: `graduate`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Can a local-first Tauri + PGlite + Effect/TypeScript product help an IP
attorney capture billable and nonbillable time without becoming the billing
system of record? The central bet is that agents can observe activity and
draft candidate time entries, while the attorney keeps approval authority over
what becomes billable.

## Current Recommendation

Treat Beep as a **capture and prebill overlay** for Tom's solo IP practice, not
the billing ledger. FreshBooks remains authoritative. Build in two slices:

1. Slice 1 proves the manual spine: visible timer, matter and native
   patent-task association, evidence-backed candidate duration/narrative,
   attorney edit/approval, and CSV/prebill preview.
2. Slice 2 adds one metadata-first, explicitly consented M365 signal only after
   a bounded Graph P0 spike, through the same candidate contract.

A vendor-neutral approved-entry port keeps FreshBooks in `drivers/*`; its first
goal begins with an API evaluation spike. FreshBooks wins after export, and a
separate LEDES path remains dormant until a client mandates e-billing.

## Next Open Question

Queued gates: FreshBooks P0 API/write/mapping proof; M365 P0
permission/sync/retention proof and explicit consent; a real PST reconstruction
need; enough Slice 1 data for a bounded profitability view; or the first client
mandate with a concrete LEDES/UTBMS target.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`../ip-practice-rundown.html`](../ip-practice-rundown.html) - standalone two-tab lawyer-facing handout for time tracking + docketing.
3. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
4. [`RESEARCH.md`](./RESEARCH.md) - summary, recommendation, repo inventory, and constraints.
5. [`DECISIONS.md`](./DECISIONS.md) - ratified decisions and deferred gate log.
6. [`research/01-solo-small-firm-time-tracking.md`](./research/01-solo-small-firm-time-tracking.md) - small-firm legal time systems.
7. [`research/02-mid-large-enterprise-time-platforms.md`](./research/02-mid-large-enterprise-time-platforms.md) - mid/large-firm platforms.
8. [`research/03-agent-developer-integration-and-handroll.md`](./research/03-agent-developer-integration-and-handroll.md) - APIs, MCP, M365, and build/buy boundary.
9. [`research/SOURCES.md`](./research/SOURCES.md) - citation and capability provenance ledger.
10. [`BRIEF.md`](./BRIEF.md) - ratified shaped pitch, metrics, and retention contract.
11. [`MAP.md`](./MAP.md) - candidate goal packets, gates, and first vertical slice.

## Trail

- 2026-07-14: shape signed off with `BRIEF.md` ratified as drafted; graduated
  [`law-time-capture-spine`](../../goals/law-time-capture-spine/README.md) and
  the standalone
  [`IP Attorney Time Tracking`](../../docs/product/ip-attorney-time-tracking.md)
  product page. Five candidates remain queued behind their named gates.
- 2026-07-14: recorded ten align outcomes (nine LOCKED product decisions plus
  the DEFERRED M365 Graph spike), including the FreshBooks pivot that made
  the prior vendor ranking moot; drafted `BRIEF.md`, `MAP.md`, and
  `research/SOURCES.md` for shape sign-off, with appetite, success criteria,
  and retention explicitly proposed rather than ratified.
- 2026-06-18: added this packet to the shared standalone [`ip-practice-rundown.html`](../ip-practice-rundown.html) handout for nontechnical lawyer review; packet remains at `align`.
- 2026-06-18: packet opened from live `beep-effect2`; scaffolded from the exploration template, researched the market and repo inventory, aligned to a prebill-overlay recommendation, and stopped at human review gate.
