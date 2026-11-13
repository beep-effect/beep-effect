# What check-once can save, and which shape of it is sound

Packet: `goals/declaration-only-builds`. Date: 2026-11-13, on `main` @
d8326d55935 (after PR 2). This note sizes PR 3 before it is built and records
one finding that decided its design.

## Method

For each of the 182 packages whose `beep:build` is the declaration-only
command, on a built tree, serial, inside one admission job, fastest of three:

- `tsrs -p tsconfig.check.json`: the own-source check that `beep:check` runs
  first today;
- `tsrs -p tsconfig.json --emitDeclarationOnly` with nothing changed since
  the last build: the build program on warm incremental state.

Plus one run of `tsrs -p tsconfig.test.json --noEmit` where the package has a
test config. Rows: [`2026-11-13-check-once-cost.tsv`](./2026-11-13-check-once-cost.tsv).
Every command exit 0. Load average 60 to 70.

## Result

| Step | Serial total |
| --- | --- |
| Own-source check (`tsconfig.check.json`) | 35.4 s |
| Warm unchanged build | 19.7 s (about 108 ms a package) |
| Test program check | 47.3 s |

- The own-source check is 43% of the compiler work in `beep:check`
  (35.4 s of 82.7 s).
- A warm unchanged build is close to process start-up cost. For
  `@beep/repo-cli` it is 171 ms against 3,685 ms for the check.
- Two ways to check once:
  - **Drop the step** and rely on a Turbo edge to the package's own build:
    saves 35.4 s serial. `bun run check` run directly in a package, outside
    Turbo, would then check only the sources its tests import.
  - **Run the build program as the first step**, after the package's own
    build: saves 15.7 s serial. Under Turbo the step finds its incremental
    state current; run directly, it still checks every source file. `check`
    also starts to see declaration-emit diagnostics, which only the build
    reported before.
- On a 64-thread machine either saving is a few seconds of wall time: the
  critical path is `@beep/repo-cli`, 3.5 s.

PR 3 takes the second shape (decision
`2026-11-13-check-runs-the-build-program`).

## What PR 3 serves

180 of the 182 packages. `@beep/effect-drizzle` and `@beep/markdown` keep the
no-emit step because their check program is wider than their build program.
For the 180, the own-source check costs 34.9 s serial and the warm build
19.4 s, so a full check run does 15.5 s less compiler work.

`@beep/repo-cli` is the largest package and its check passes
`--checkerCostCache`. Measured: with `dist` current, the build command with
that flag takes 0.18 s and leaves `tsconfig.tsbuildinfo` byte-identical, and a
plain build afterwards is still a no-op; its separate check takes 3.8 s. The
flag does not disturb incremental state, so the rewrite carries extra flags on
the first segment over to the build command.

## `TSRS_FAST` and incremental state

Measured on `@beep/repo-cli`, built with `TSRS_FAST` unset:

| Run | Wall | `tsconfig.tsbuildinfo` |
| --- | --- | --- |
| warm build, `TSRS_FAST` unset | 0.4 s | unchanged |
| warm build, `TSRS_FAST=1` | 5.9 s | rewritten |
| again, `TSRS_FAST=1` | 0.6 s | unchanged |
| back to unset | 7.3 s | rewritten to the first state |

The setting is part of the incremental state: switching it re-checks the
whole program and rewrites the build info. Diagnostics still match in both
settings (the equivalence sweep). Under Turbo this is harmless, because
`TSRS_FAST` is a global input: a build and the check that follows it in one
invocation share the setting, and a cached build is only restored into a run
with the same setting. It does mean a build made by one lane is never reused
by a lane that sets `TSRS_FAST` differently.

## Caveats

- One machine, under load; seconds are upper bounds, ratios hold better.
- Hosted Check and Build lanes run on separate machines, so on a cold hash the
  check lane computes the builds it depends on itself. PR 3 does not change
  that; it removes the second pass over each package's own sources inside the
  check lane.
