# Declaration-Only Builds

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Library package builds emit declarations and declaration maps only: the Babel
`annotate-pure-calls` pass and JavaScript emit leave the generated build
script, and each package's source is type-checked once per run if the
check-program census proves build and check agree. Graduated from
[`explorations/build-pipeline-simplification`](../../explorations/build-pipeline-simplification/README.md)
on 2026-11-10.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/declaration-only-builds/GOAL.md
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

P3 Yeet, in progress. PR 1 (#3178) and PR 2 (#3208) are merged. PR 3, check
once, is open. Next: P4 Close, a goals-only final PR with the reflection and
the closeout proposal, per [`PLAN.md`](./PLAN.md).

## Latest Evidence

- [`research/2026-11-13-check-once-cost.md`](./research/2026-11-13-check-once-cost.md):
  the own-source check costs 35.4 s serial over 182 packages and a warm
  unchanged build 19.7 s. PR 3 runs the build program as the check's first
  step for 180 packages (15.5 s less compiler work per full check run) and a
  file-set sweep finds the check program wider than the build program in
  exactly the two packages that keep the old step.
- PR 2's hosted gate (#3208) passed Build, Check, Docgen, Storybook, Test Unit,
  Test Integration and the Vercel plan with no JavaScript in any library
  `dist`; its one red was an inherited coverage ratchet row. Nothing reads
  `dist/*.js`. The Exception Ledger is empty.
- [`research/2026-11-13-build-after.md`](./research/2026-11-13-build-after.md):
  before and after, back to back on one machine state. Serial build work of
  181 packages falls from 80.9 s to 32.9 s (59%); `dist` shrinks from 232.5 MB
  to 147.9 MB (36%); the compile itself is unchanged.
- [`research/2026-11-10-build-check-equivalence.md`](./research/2026-11-10-build-check-equivalence.md):
  2,912 build-versus-check comparisons over 182 packages, all identical, from
  a cache restore, warm and cold, with `TSRS_FAST` unset and `1`. Check-once
  is kept for the 180 packages whose check program is the build program.
- [`research/2026-11-10-build-baseline.md`](./research/2026-11-10-build-baseline.md):
  the first baseline, taken at higher load on an older compiler.

## Notes

- The declaration-only flag sits on the generated build command, not in
  `tsconfig.base.json`: the base option would break 404 no-emit overlays
  (TS5069).
- A package that needs JavaScript keeps it through `javaScriptBuildOverrides`
  in the scripts policy; one whose check program is wider than its build
  program keeps the no-emit check through `ownSourceCheckOverrides`
  (`@beep/effect-drizzle`, `@beep/markdown`).
- A package whose build is not the declaration-only command must override the
  Turbo `check` task to depend on `^build` only. The scripts lint enforces it
  and `bun run beep create-package` emits it.
- `TSRS_FAST` is part of the compiler's incremental state. A build made with
  it unset is rebuilt, not reused, by a run that sets it.
