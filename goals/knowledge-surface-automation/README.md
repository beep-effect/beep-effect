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

P4 in progress. Shipped on main so far:

- **D:** `beep goals next|explain|catalog` (in-memory SQLite projection,
  differential-tested) and the Mermaid capability-graph section in `goals/INDEX.md`.
- **E:** `goals bootstrap|adopt --write --expect <planId>` (atomic publish, exclusive
  adoption). This packet adopted itself with its own executor (self-hosting test case
  #1).
- **B:** the read-only `beep skills lock-plan` with six ratified resolution seeds.
- **C:** Stage-2 PR 1, the read-only `beep knowledge doctor --report`
  ([`research/p4-report-knowledge-doctor.md`](./research/p4-report-knowledge-doctor.md)).
- **Designs:** B, E, and C Stage 2
  ([`research/p4-skills-warehouse-design.md`](./research/p4-skills-warehouse-design.md),
  [`research/p4-goals-materialize-design.md`](./research/p4-goals-materialize-design.md),
  [`research/p4-knowledge-doctor-design.md`](./research/p4-knowledge-doctor-design.md)).

The D and B verdicts are recorded. The D verdict unlocked this PR (design PR 3):
`beep goals doctor` now emits `capability-duplicate-declaration` and
`capability-reference-provides` (blocking, ratcheted) and `capability-stranded`
(advisory). All three are zero on the live census, so the baseline is unchanged. A
separate manifest-only PR declares the four missing `provides`. The B verdict gates the
lock write on a path-history reclassification (B-3).

Waiting on verdicts: the C report gates PR 2 (domain evaluators and the
assertion/planned-command classification fixes).

Phase-0 verdicts: [`research/p1-fp-eyeball-verdicts.md`](./research/p1-fp-eyeball-verdicts.md).

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
