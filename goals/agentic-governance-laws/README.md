# Agentic Governance Laws

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Give three repo-wide governance laws an owner with enforcement: a minting
process cannot raise its own ceiling; every capped walk declares per-edge
lifetime caps and records why it stopped; every law scanner asserts its own
scan matched something. Laws without an owner stay prose — the caps and
non-vacuity laws land as scanners with violating fixtures, never prose alone.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/agentic-governance-laws/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (decision log included).
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger
   (back-linked to the source exploration).
6. [`history/`](./history/) - evidence and closeouts, once they exist.

## Current Phase

P0 Research — not started. The exploration paid for most of it; what remains
is three concrete answers: re-confirm the four scan paths at current HEAD,
write down the boundary between a legitimate zero-file scan and a vacuous one,
and choose the first ceiling declaration site from live evidence. That site is
deliberately unnamed in `SPEC.md` — the mining offers no verified candidate,
so naming one before this packet's own shaping would be invention.

## Latest Evidence

Not started. Graduated 2026-08-06 from
[`explorations/graphnosis-prior-art`](../../explorations/graphnosis-prior-art/README.md)
as the second of that exploration's two graduations (Q1: dissolve into
amendments, graduate exactly two packets). The exploration's decisions Q1, Q3,
Q6, and Q8 bind this packet; Q10 explicitly does not ride here.

## Why This Packet Exists

No active packet owned any of the three laws. The third has a live
counterexample in the tree: `LawScan.ts:175` computes `scannedFiles` and
returns it unguarded, `Laws.command.ts` only logs it, so a glob typo would
report the repo law-clean forever. The mining first claimed that one edit at
that choke point would cover all seven law modules; verification against the
live tree showed `runLawScan` serves only two of them, with three more scan
paths of their own — the corrected scope is in
[`SPEC.md`](./SPEC.md) Constraints and the exploration's `RESEARCH.md`
2026-08-06 addendum. The appetite moved from small to medium because of it.

## Notes

- **Rule 5 needs no scanner to be true.** Effective authority is
  `min(declared ceiling, ambient session ceiling)` computed at use time, so a
  minter writing a generous declaration buys nothing — the clamp comes from
  the consumer. The schema is the enforcement; any bypass scan is
  belt-and-suspenders lint built last, not the mechanism.
- **TierGate already ships the runtime clamp half**
  (`packages/foundation/capability/mcp-kit/src/TierGate.ts`, implemented
  write-ahead and fail-closed by
  `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts`).
  This packet adds the declaration half and must not weaken the gate.
- **`cap-reached` is a normal outcome, not an error.** The adherence
  instrument that consumes these stop-reason records is Q8's *second* step and
  a Non-Goal here — it cannot exist before something produces its input.
- **Territory boundary.** `explorations/agent-governance-control-plane` is
  adjacent. This packet owns laws and their scanners; it owns no control-plane
  surface, policy UI, or runtime beyond the clamp that already ships.
- **Cut line.** If the work sprawls past one short PR ladder, keep the first
  slice — standards statements plus the vacuity fixture — and let the ceiling
  schema and caps follow, rather than extending the appetite.
