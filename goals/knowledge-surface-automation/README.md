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

P4 in progress — Workstream D's projection slice. The design
([`research/p4-goals-projection-design.md`](./research/p4-goals-projection-design.md))
and its mini-grill outcomes
([`research/p4-goals-projection-decisions.md`](./research/p4-goals-projection-decisions.md),
2026-10-09) are settled; next is PR 1: `beep goals next|explain|catalog` over a
`bun:sqlite` projection, differential-tested against a pure-TS evaluator, plus the
committed catalog FP-eyeball report. P1-P3 outcomes stay as recorded: all 24 P2
decisions in [`research/p2-grill-decisions.md`](./research/p2-grill-decisions.md),
A/B/C/D Phase-0 verdicts in
[`research/p1-fp-eyeball-verdicts.md`](./research/p1-fp-eyeball-verdicts.md).
Workstream E's pure-plan report still awaits its eyeball verdict before any
materializer exists.

## Latest Evidence

[PR #529](https://github.com/beep-effect/beep-effect/pull/529) — packet opening + P0/P1
research corpus, published via yeet full local proof. P2 grill decisions landed as their
own docs-only PR per the ratified process.

## Notes

Linked campaign: [Repository freshness audit](../knowledge-freshness-audit/README.md)
adds a paused, report-first campaign for semantic claim coverage, evidence-backed
remediation, and a bounded Jev evaluation. It inherits this initiative's ratified
decisions; the broader graph, bootstrap, warehouse, and scheduling roadmap remains
owned here. Its initial planning PR does not activate or complete the audit.

Research input: [`research/2026-08-13-compound-engineering-capture.md`](./research/2026-08-13-compound-engineering-capture.md)
preserves the folded always-on compounding vision behind the friction-ledger,
buzz-channel, and reflection-skill direction.

Self-hosting seed: this packet was deliberately hand-rolled before `beep goals
bootstrap` exists. When Workstream E's adoption path lands, the doctor adopts this
packet as its own first test case (hash-pinned adoption patch + preservation report).
Grill outcomes for the open decisions in SPEC.md land as their own docs-only PR before
implementation PRs.
