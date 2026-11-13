# Goal Closeout Hosted Verification

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Verify goal completion from hosted GitHub facts after the merge, close goals in one PR, and stop goals-only finals from running unrelated coverage

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/goal-closeout-hosted-verification/GOAL.md
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

P0 to P3 are complete. PR B merged as #3245 (supporting). PR A is #3248, the
final: it carries the `closeout` record and the reflection
[`history/reflections/2026-11-13-claude.md`](./history/reflections/2026-11-13-claude.md).
The goal is done once #3248 merges and
`bun run beep goals completion refresh --slug goal-closeout-hosted-verification`
prints `verified`. Migration outcomes are in
[`history/migration-2026-11-13.md`](./history/migration-2026-11-13.md).

## Latest Evidence

- 2026-11-12: five read-only maps under [`research/`](./research/):
  completion pipeline, schema/set-status/doctor, templates and docs, the
  11-packet migration set, and the coverage cause for #3101.
- 2026-11-12: the PR A design, with 27 open choices decided as DN-1 to DN-27,
  each with its reversal. Nothing was committed, pushed or run beyond
  read-only probes.

## Notes

- Two PRs. PR A carries rulings D-after, D-hosted, D-red, D-exit, D-done,
  D-onepr and D-mig, and is this packet's final. PR B carries D-cov from lane
  `final-check-coverage-scope`, merges first, and is recorded as
  `supporting`.
- Deadline: literal-kit-subset-algebra's rule suite (#2080) leaves GitHub's
  one-month listing around 2026-11-22. Do its migration read before then.
- Run `bun run beep goals manifest --write` before committing: `research/`
  holds files that `researchReports` does not list yet.
