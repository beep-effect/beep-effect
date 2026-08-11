# CI-graph check baseline (per-process, cold)

Measured 2026-08-11 at `9b74f0013b` on `feat/heavy-lane-typecheck-cost`. This is the
handoff's step 1 (`ops/handoffs/p2-build-mode-oom-handoff.md`): the first per-process
measurement of the workload CI actually executes, plus the four build-mode census rows the
prior census omitted.

Raw data:

- [`data/ci-graph-check-baseline.tsv`](./data/ci-graph-check-baseline.tsv) — every compiler
  process of one cold root Check run (204 rows).
- [`data/build-mode-census-extension.tsv`](./data/build-mode-census-extension.tsv) — cold
  isolated `tsgo -b` closure rows for the four packages the build-mode census omitted.

## Method

One cold root run of the exact CI check command, from the repo root:

```sh
bunx turbo run check --concurrency=1 --force --summarize
```

- Cold protocol: every workspace package's `node_modules/.tmp/*.tsbuildinfo` and `dist/`
  removed first (131 build-info files, 127 dist dirs), verified zero build-info remaining.
  `--force` bypasses Turbo cache reads.
- Per-process capture: `node_modules/.bin/tsgo` and `.bin/tsc` were temporarily replaced by
  wrappers that exec the real compiler under `/usr/bin/time -v`, recording cwd, argv, max
  RSS, and wall per process. Absolute tool paths were baked into the wrappers because
  Turbo's strict env mode strips unlisted variables from task environments. Symlinks were
  restored after the run (verified).
- The whole lane also ran under `/usr/bin/time -v` (`timeout 5400s`), giving lane wall and
  the process-tree max RSS.
- Census-extension rows used the census's own protocol: full workspace re-clean before each
  row, then `/usr/bin/time -v timeout --signal=INT --kill-after=30s 1200s bunx tsgo -b
  tsconfig.json` from the package dir.
- Toolchain: `tsgo 7.0.2+effect-tsgo.0.24.3` (identical to both prior censuses),
  turbo 2.10.9, Bun workspace install refreshed pre-run.
- Host: 64-thread workstation, 125 GiB RAM. Quiet relative to the census: load average
  3.07 at start (census ran at 19–35), ~75 GiB available. A 2 s sampler recorded system
  memory throughout; peak system used was ~80 GiB, consistent with the single largest
  process plus steady-state.

Single-observation caveat: the census saw a 10.73 GiB spread between two cold
professional-desktop runs under load. These rows are one cold observation each on a quiet
box; treat ±20% as plausible variance until re-measured.

## Results

Lane totals (cold, concurrency one):

| Metric | Value |
| --- | ---: |
| Lane wall (turbo, whole graph) | 241.4 s |
| Lane process-tree peak RSS | 23.28 GiB |
| Compiler processes | 204 |
| Sum of compiler wall | 235.4 s |
| — `tsgo -b tsconfig.json` (130 procs) | 149.0 s |
| — `tsgo -p tsconfig.test.json` (59 procs) | 69.6 s |
| — scripts/stories/drizzle/other (15 procs) | 16.9 s |

Per-process peaks, every row over 4 GiB (full table in the TSV):

| Package | Kind | RSS | Wall |
| --- | --- | ---: | ---: |
| `@beep/epistemic-server` | build | 23.28 GiB | 22.8 s |
| `@beep/professional-desktop` | build | 19.23 GiB | 26.4 s |
| `@beep/db-admin` | test | 7.46 GiB | 6.4 s |
| `@beep/epistemic-ui` | build | 6.09 GiB | 8.6 s |
| `@beep/db-admin` | build | 4.90 GiB | 5.8 s |
| `@beep/epistemic-client` | build | 4.50 GiB | 9.3 s |
| `@beep/epistemic-server` | test | 4.31 GiB | 3.7 s |
| `@beep/epistemic-tables` | build | 4.19 GiB | 4.0 s |

Census extension (cold isolated closure, census method — the four omitted packages):

| Package | Closure RSS | Wall | Same package in the CI graph |
| --- | ---: | ---: | ---: |
| `@beep/practice-kg-mcp` | 32.64 GiB | 38.3 s | 0.53 GiB (build) |
| `@beep/law-practice-server` | 28.07 GiB | 37.2 s | 2.09 GiB (build) |
| `@beep/ontology-client` | 5.55 GiB | 14.4 s | 0.42 GiB build / 3.25 GiB test |
| `@beep/agents-client` | 5.25 GiB | 13.4 s | 0.64 GiB (build) |

## Findings

1. **Exactly two processes in the real CI graph exceed the 13 GiB budget:**
   `@beep/epistemic-server` build (23.28 GiB) and `@beep/professional-desktop` build
   (19.23 GiB). Every other process is under 7.5 GiB. The fleet-blocker set is these two
   rows, nothing else.
2. **Build-graph splitting is falsified as the epistemic-server lever.** With all
   dependencies prebuilt (Turbo `^check` ordering), its own single-project build still
   peaks at 23.28 GiB — within noise of the 24.77 GiB cold-closure census row. The peak is
   intrinsic to checking epistemic-server's sources against its dependencies' declaration
   surfaces, not retention of dependency projects in one process. Sharding cannot reduce
   it; only reducing what the check instantiates can (type-level fixes, slimmer dependency
   declaration surfaces, demand-scoping).
3. **Turbo ordering already delivers the release for professional-desktop** — 47.59 GiB
   cold-closure vs 19.23 GiB post-prerequisites. The census's process-sharding
   recommendation is thereby largely already implemented by the existing task graph; the
   residual 19.23 GiB still fails the budget and needs demand-scoping/type-level work.
4. **The four omitted census packages are not fleet blockers.** Their cold-closure numbers
   are large (practice-kg-mcp at 32.64 GiB would alone exceed a 32 GiB worker;
   law-practice-server 28.07 GiB) but their real-graph rows are ≤2.09 GiB build. The
   inflation is pure one-process closure retention, which the CI graph never pays. The
   cold-closure cost is a *local dev* hazard (a cold `tsgo -b` from those package dirs),
   not a CI one.
5. **Concurrency math today:** worst pair 23.28 + 19.23 = 42.5 GiB — concurrency two is
   unsafe on a 32 GB worker and marginal on 64 GB with other overhead. Once the two hog
   rows are under 13 GiB, the concurrency-two acceptance bar (< 26 GiB combined) becomes
   reachable and lane wall can roughly halve.
6. **Lane wall is essentially pure compile.** 241 s lane vs 235 s summed compiler wall at
   concurrency one: Turbo/Bun per-task overhead is negligible (~6 s over 130 tasks). Lane
   time reduction = compile time reduction (or safe concurrency).
7. **The second, never-censused compiler process per package is material.**
   `tsgo -p tsconfig.test.json --noEmit` runs for 59 packages (69.6 s, 30% of compile
   wall). Test configs have no project references, `composite`/`incremental` off, and
   `include: ["src", "test"]`; with `moduleResolution: nodenext` and package `exports`
   pointing at `./src/*.ts`, each test check re-checks its own src *and dependency source
   closures* with no build-info reuse. `@beep/db-admin`'s test check (7.46 GiB) costing
   more than its build check (4.90 GiB) is the smoking gun. Referencing prebuilt projects
   from test configs (so test programs check only `test/` against emitted `.d.ts`) is the
   direct lever.

## Acceptance status vs the handoff bars

- Per-process < 13 GiB: **failing on 2 of 204 processes** (23.28, 19.23).
- Concurrency-two pair < 26 GiB: **not yet attemptable** (worst pair 42.5 GiB).
- Mechanism merged: already true for build configs (Turbo graph + per-package processes);
  test configs are the unshared residue.
- Cold honesty: verified (zero build-info before the run; `--force`).

## Next falsifiable steps

1. Attribute the 23.28 GiB inside epistemic-server's own program (import-group A/B or
   compiler diagnostics), then attack the dominant term and re-measure.
2. Demand-scope professional-desktop's entry imports (census rec #2) and re-measure.
3. Add project references to generated test tsconfigs so test programs consume emitted
   declarations; re-measure the test-kind rows (expect most of 69.6 s and the 7.46 GiB
   db-admin test peak to collapse).
