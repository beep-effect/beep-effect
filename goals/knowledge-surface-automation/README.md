# Knowledge-Surface Audit & Automation

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Turn the agent-facing knowledge surfaces — `goals/`, `explorations/`, `.claude/skills/`,
`.agents/skills/`, `docs/`, `CLAUDE.md` / `AGENTS.md`, and the `.claude` / `.agents` /
`.codex` trees — into audited, gated, self-proving infrastructure: permanent
new-violation gates, not a one-time cleanup.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/knowledge-surface-automation/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (ratified 2026-07-31 doctrine:
   workstreams A-E, ratified decisions, remaining grill items, spin-offs).
3. [`PLAN.md`](./PLAN.md) - active execution plan (phases P0-P6).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing; declares
   `provides: [knowledge/doctor, skills/warehouse, goals/graph, goals/bootstrap]`
   (Workstream D's additive capability extension, declared ahead of schema support on
   purpose - decode-compatibility is a P1 test).
5. [`research/`](./research/) - P0 deliverables (`prior-ritual-lessons.md`,
   `surface-inventory.md`, `cli-ground-truth.md`, `SOURCES.md`) and the ratified
   [`p2-grill-decisions.md`](./research/p2-grill-decisions.md).
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P2 complete — all 24 open decisions ratified in
[`research/p2-grill-decisions.md`](./research/p2-grill-decisions.md) (2026-08-01 grill
session); do not relitigate them in implementation PRs. P1 Phase-0 report commands
remain in progress and are now unblocked with full doctrine: `KnowledgeFinding` golden
tests, `beep skills provenance` (pilot: shadcn), `beep knowledge refs --tree HEAD`,
manifest capability decode-retention tests, and Workstream E's pure bootstrap/adoption
plans. P1 execution shape (tranches, orchestration, publish cadence, evidence path,
per-workstream P3 unlock) is ratified in
[`research/p1-execution-decisions.md`](./research/p1-execution-decisions.md)
(2026-08-04 session).

## Latest Evidence

[PR #529](https://github.com/beep-effect/beep-effect/pull/529) — packet opening + P0/P1
research corpus, published via yeet full local proof. P2 grill decisions landed as their
own docs-only PR per the ratified process.

## Notes

Self-hosting seed: this packet was deliberately hand-rolled before `beep goals
bootstrap` exists. When Workstream E's adoption path lands, the doctor adopts this
packet as its own first test case (hash-pinned adoption patch + preservation report).
Grill outcomes for the open decisions in SPEC.md land as their own docs-only PR before
implementation PRs.
