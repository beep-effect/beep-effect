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

## Phase 2 of the lane: the `test-tsgo` sweep (previously unmeasured)

`bun run beep ci lane check` is not only the Turbo graph: `beep-cli check` runs a second
serial phase, `beep quality test-tsgo`, which re-typechecks ~128 per-package test programs
as flat reference-free source closures, outside Turbo and immune to `--affected` and any
cache. Measured warm on the same host
([`data/ci-check-sweep-baseline.tsv`](./data/ci-check-sweep-baseline.tsv)): **3:00 min
wall, 128 processes, 176 s summed compile, peak process 10.52 GiB**. The full check lane
on this host is therefore ~7 min cold (turbo 4:01 + sweep 3:00 + smoke), which maps to the
~20 min hosted lane.

## The declaration-mode anomaly (attribution of the two failing rows)

Bisection with probe tsconfigs attributed the two over-budget rows to a single mechanism:

- Checking `@beep/epistemic-server` against its dependencies' emitted `.d.ts`
  (project-reference redirection, what `tsgo -b` does) creates **10.6M types / 37M
  symbols / 25.5 GiB, 22 s check** — and `src/Layer.ts` alone reproduces all of it.
- The **identical program** with dependencies resolved to *source* (a flat, reference-free
  `-p` program) creates **2.1M types / 4.3 GiB, 3 s check**, with full diagnostics and
  zero errors.
- The cost is additive per consuming file (layer 10.9 + repo 5.1 + handlers 4.7 ≈ index
  21.6 GiB): serialized structural types in d.ts defeat the checker's type-identity
  sharing at every expression-check site, where source-mode types are shared instantiations.
- Falsified along the way: naming derived schema consts via explicit interface
  annotations (`PrincipalSchema`, `SourceKindSchema`, `SemanticVersionSchema`, shipped in
  this PR) collapses dependent d.ts text by 27–65% (`Contradiction.model.d.ts` 238K → 83K
  bytes; `ContradictionTriage.ports.d.ts` 1.58M → 0.82M) but moves **neither** Types nor
  RSS. The explosion is structural-identity loss, not file size. The deeper fix
  (declaration emit that preserves type identity) is upstream effect-tsgo work — see the
  OPPORTUNITIES receipts dated 2026-08-11.
- `tsgo -b --noCheck` emits valid declarations at 15.5–17.6 GiB (emit-side type
  materialization) — kept as a fallback recipe, not needed by the shipped mitigation.

## Mitigation shipped: flat source-mode check for reference tips

Four packages that no other package `-b`-references (`@beep/epistemic-server`,
`@beep/law-practice-server`, `@beep/practice-kg-mcp`, `@beep/professional-desktop` — the
flip set is closed: pd ← nothing, epistemic-server ← pd + law-practice-server,
law-practice-server ← practice-kg-mcp, practice-kg-mcp ← solution file only) now run
their check script against a flat `tsconfig.check.json` (extends the package tsconfig;
no references, `composite`/`incremental` off, `noEmit`) instead of `tsgo -b`. Editor and
solution builds keep the composite `tsconfig.json` unchanged. Their check-task dist/
build-info emission stops; nothing in the CI graph consumed it after the flip.

## Post-flip proof (cold, same method)

Full cold root run after the flip
([`data/ci-graph-check-postflip.tsv`](./data/ci-graph-check-postflip.tsv)): 204
processes, all rc=0, lane wall 4:03, lane process-tree peak **11.0 GiB** (was 24.4).

| Row | Before | After |
| --- | ---: | ---: |
| `@beep/epistemic-server` check | 23.28 GiB / 22.8 s | **4.21 GiB / 3.3 s** |
| `@beep/professional-desktop` check | 19.23 GiB / 26.4 s | **10.49 GiB / 10.4 s** |
| `@beep/law-practice-server` check | 2.09 GiB (post-prereq) | 6.49 GiB / 5.9 s [1] |
| `@beep/practice-kg-mcp` check | 0.53 GiB (post-prereq) | 5.40 GiB / 5.1 s [1] |
| Max process in graph | 23.28 GiB | **10.49 GiB** |
| Whole-lane peak footprint | 24.4 GiB | **11.0 GiB** |

[1] Flat mode re-checks the dependency source closure, so these two rows trade their
near-zero post-prerequisite build cost for a bounded flat cost — still far under budget,
and they drop their `-b` emit entirely.

Concurrency-two acceptance run: the two heaviest post-flip processes
(professional-desktop flat check, db-admin `tsconfig.test.json` check) executed exactly
concurrently with 0.25 s system-memory sampling: 11.06 GiB + 7.14 GiB individual peaks,
**15.64 GiB combined system delta** — under the 26 GiB bar with >10 GiB headroom. A
harsher variant (105-task mini-graph at `--concurrency=2` spanning both closures) peaked
at 14.1 GiB combined.

## Acceptance status vs the handoff bars (updated)

- Per-process < 13 GiB: **met** — max 10.49 GiB in the full cold graph (11.06 GiB in the
  pair rerun; single-observation variance on this host has been ±5–10%).
- Concurrency-two pair < 26 GiB combined: **met, measured** — 15.64 GiB.
- Mechanism merged, separate OS processes: **met** — Turbo already runs one process per
  task; the flip ships in package check scripts + committed `tsconfig.check.json` files.
- Cold honesty: **met** — zero workspace build-info verified before both lane runs;
  `--force` bypassed Turbo cache.

## Follow-ups (ranked, not started)

1. **Lane time** (single-digit-minute goal): the sweep (3:00) is now the largest
   restructurable block — fold per-package test checks into the turbo `check` tasks and
   reduce `test-tsgo` to a coverage-governance gate. Do NOT reference-ize test configs:
   the declaration-mode anomaly means flat source programs are the *cheap* mode here;
   the census's barrel de-blast remains the lever for making them cheaper still.
2. **Concurrency**: with an 11.0 GiB whole-lane footprint, `--concurrency=2` (or a
   heavy/light split) is now memory-safe even on 32 GB-class workers; expect the turbo
   phase to roughly halve. One-line change in `CiLane.ts` — coordinate with the fleet
   session before flipping.
3. **professional-desktop hardening** (10.49 GiB is the new ceiling): drop the phantom
   `@beep/box` root-barrel import in `src/runtime/Layer.ts` (no reference, no package.json
   dep — ~18 K loc of box source absorbed into the program), split the 53 test files out
   of the monolithic tsconfig, then re-measure.
4. **`@beep/schema` barrel codemod**: 876 files import the root barrel; 4 symbols cover
   ~80% of pulls; subpath infrastructure already exists except 3 entries
   (SafeRemoteHost, FileDiff, Int64). Cuts every flat program's parse/bind load.
5. **Upstream**: minimal repro of the declaration-mode type-identity loss for
   effect-tsgo; ask for pprof/trace instrumentation (receipts in OPPORTUNITIES.md).
