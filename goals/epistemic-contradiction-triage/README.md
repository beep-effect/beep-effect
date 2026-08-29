# Epistemic Contradiction Triage

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver evidence-backed, reviewable `CONTRADICTS` candidates over the bitemporal
edge authority core, plus a human-approval path that resolves a candidate as one
atomic `SUPERSEDES` — with detection never mutating authority.

Graduated 2026-07-25 from
[`explorations/agent-memory-tiers-bitemporal-edges`](../../explorations/agent-memory-tiers-bitemporal-edges/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/epistemic-contradiction-triage/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth, including the P0 hard gate.
3. [`PLAN.md`](./PLAN.md) - active execution plan, P0-P4.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger inherited
   from the exploration.
6. [`history/`](./history/) - evidence and closeouts.

## Current Phase

P2 verification — active. P1 landed the P0-fixed immutable candidate, receipt,
proposal, disposition, and narrow review contracts without widening claim
disposition, together with the coordinated full-source triage UI. Focused
package, migration, integration, browser, doctrine, and documentation proof is
green; the formal quality-review loop and Yeet verification remain.

## Provenance

Back-links, not copies:

- [`explorations/agent-memory-tiers-bitemporal-edges`](../../explorations/agent-memory-tiers-bitemporal-edges/README.md)
  is the source exploration. This packet is its **order-2** candidate in
  [`MAP.md`](../../explorations/agent-memory-tiers-bitemporal-edges/MAP.md),
  gated behind the finalized core; the P0 gate is **"Deferred spike B —
  contradiction-triage fixtures"** in
  [`DECISIONS.md`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md)
  (2026-07-14).
- [`goals/epistemic-bitemporal-edge-core`](../epistemic-bitemporal-edge-core/README.md)
  is the substrate this packet composes over: immutable bitemporal lineage,
  durable `ClaimDisposition`, atomic close-and-insert supersession, and
  canonical `asOf(validAt, knownAt)` reads.
- The unconsumed dispatch note
  [`2026-07-25-academia-corpus-mining-note.md`](../epistemic-bitemporal-edge-core/research/2026-07-25-academia-corpus-mining-note.md)
  supplies the boundary-fixture candidates folded into P0 and the master align
  Q1 context on typed verdict families.

## Latest Evidence

[`history/p0/2026-07-29-fixture-spike.md`](./history/p0/2026-07-29-fixture-spike.md)
records the exact command, final `32 passed` result, per-assertion verdicts, and
the model decisions fixed by the gate.

[`history/p1/2026-07-29-implementation-and-browser-qa.md`](./history/p1/2026-07-29-implementation-and-browser-qa.md)
records the implemented surface, exact full-source browser scenarios, final
`77 passed` capture assertions, and independent `REQUIRED FINDINGS: 0` verdict.

## Notes

High-signal constraints that do not belong in the normative spec:

- **Detection is data, never an authority write.** The core's constraint stands;
  only a recorded, scoped human disposition converts a candidate into a
  supersession. A green suite that skips this distinction has not proven the
  packet.
- **Contradiction resolution owns a slice-local disposition vocabulary.**
  `ClaimDispositionStatus` remains the claim-admission vocabulary landed by the
  core. An unresolved contradiction has no contradiction disposition; review
  records either `rejected` or `superseded`.
- **Belief views are a different operation and a different packet.** Triage
  *resolves* lineages; a view *selects among* open ones
  ([`explorations/epistemic-belief-view-revision`](../../explorations/epistemic-belief-view-revision/README.md)).
  Do not grow a view mechanism ad hoc under triage.
- **Master align Q1 (verdict-family naming) is open upstream.** This packet
  names its own semantic-stance family without claiming anchor fidelity, source
  authority, disposition, or release.
