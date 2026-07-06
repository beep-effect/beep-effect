# Agent Pipeline Velocity

## Status

Lifecycle: `completed-retained` — **merged as [PR #295](https://github.com/beep-effect/beep-effect/pull/295)** (`2a0fca454c`, 2026-07-06). Graduated 2026-07-05 from
[`explorations/agent-pipeline-velocity`](../../explorations/agent-pipeline-velocity/README.md)
after deep-research reconciliation (zero contradictions, 5 refinements).

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Cut agent context friction (Claude + Codex) and time-to-mergeable-PR in one
pass: greptile-only reviews, read-only PR turbo cache, green main,
single-sourced instruction files, progressive-disclosure skills, permission
allowlist, instrumented + rebenchmarked yeet, local/hosted proof parity, and a
`beep worktree` helper — one goal, one PR.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/agent-pipeline-velocity/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance (inherits the exploration ledger).
6. Exploration provenance: [`explorations/agent-pipeline-velocity/`](../../explorations/agent-pipeline-velocity/README.md) — CAPTURE, RESEARCH (3 baselines), DECISIONS (9 locked), BRIEF, MAP.

## Current Phase

P0 Gate & Quick Strikes. PR #291 MERGED (gate cleared; local main at
777ca92cf4). Next concrete action: B1 review-bot consolidation — Chrome
deactivation of CodeRabbit + ChatGPT review apps, then Closeout.ts default
gate trim. Research-driven refinements active (see manifest provenance note):
laws-only instruction files, Anthropic skill budget rules, C4 hooks elevated,
optional typescript-lsp trial, CSF-001 amendment citations.

## Latest Evidence

2026-07-06: **PR #295 CLEAN/MERGEABLE — all hosted checks green** on
`950b48f456` (12 commits). Both greptile P2 threads resolved (law-pulse
counter scoped per worktree in `950b48f456`; Tasks.ts concurrency concern
answered by rqt-014 measurement, 142.4s→32.3s). Sole prior red was a one-off
PgLite hook-timeout flake (passes locally in 2.7s, green on re-run).
Baselines + negative results in
[`history/rqt-ledger.md`](./history/rqt-ledger.md). Closeout reflection:
[`history/reflections/2026-07-05-claude.md`](./history/reflections/2026-07-05-claude.md).
Merged 2026-07-06 as PR #295 (`2a0fca454c`); all phases completed;
completion gate satisfied.

## Notes

- **Supersedes** (ledger surgery 2026-07-05): `agent-effectiveness-phoenix-enrichment`,
  `agent-effectiveness-workflow-integration`, `yeet-operator-clarity` (P5 residue),
  `yeet-pr-closeout-loop`. Continues `repo-quality-throughput` numbering at **rqt-011**.
- **Fable-direct mandate**: Phase-D (pipeline) analysis/redesign is performed by
  Fable itself; Codex executes only Fable-specified mechanical changes.
- Single PR; crispen constrained to optimization-serving refactors (debt ledger for the rest).
- Deep-research addendum pending: workflow `wf_67c7da82-92f` report →
  exploration `research/deep-research-report.md`, sources merged into this
  packet's SOURCES on landing.
