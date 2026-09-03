# Yeet PR resume footer

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Every Yeet PR is a durable bookmark to its originating workspace and agent sessions, with a number-only resume block that leaks nothing local.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/yeet-pr-resume-footer/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P1 Implement — PR 1 on `feat/yeet-pr-resume-footer` (see `PLAN.md`).

## Latest Evidence

- 2026-09-03: P0 done. `research/2026-09-03-exploration.md` (feature history,
  CSF-005/CSF-007, harness identity facts), `research/2026-09-03-design-panel.md`
  (three-lens panel, red-team, judge), `DECISIONS.md` (seven ratified decisions).

## Notes

- Graduates speed-loop `research/OPPORTUNITIES.md` #79.
- The Codex findings pipeline has no "accepted risk" disposition: every public
  footer field must be defensible as not-a-leak. Session ids, paths, and
  harness resume commands are excluded by schema, and the boundary property
  test is the CSF-007 evidence.
- Claude Code already writes `pr-link` transcript records and supports
  `claude --from-pr <n>`; it is the no-registry fallback, not the mechanism
  (last-wins per session, Claude-only, per-project picker).

