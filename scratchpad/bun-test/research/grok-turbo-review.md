# Grok adversarial review: Bun/Turbo configuration

Date: 2026-09-15. Reviewer: Grok 4.6, xhigh, Grok CLI 1.0.30.
Scope: independent read-only research, followed by bounded synthesis.
The reviewer was instructed not to read the Codex report. Its primary-document
fetches did not complete; that limitation is retained below.

The first research pass exhausted its turn allowance without a report. The
first synthesis timed out after producing an incomplete draft. A final concise
continuation completed with exit 0 and an explicit end marker. The parent
requested corrections to the draft's cache, Istanbul/V8, page-cache, queue-cost,
and falsification claims before this synthesis. This is the resulting reviewer
output, preserved as evidence rather than a runnable configuration guide.

**Read the [adjudication](configuration-adjudication.md) before using its
recommendations.** In particular, the cache wording and dry-run execution
claim below need correction; the equality and Bun discovery concerns need
qualification rather than being treated as proven regressions.

---

**Verdict:** Inconclusive. A local `@beep/schema` pilot cannot establish a ≥10% drop in **total CI cost per successful PR**, nor that the uncertainty range also clears 10%. Absence of timings does **not** falsify the hypothesis. Do not promote `scratchpad/bun-test` on inspection. Qualify work-equivalence first; then time with **both Turbo cache reads and writes disabled** (not `--force` alone). Do not drop workstation page caches.

Primary Bun, Vitest, Effect, and live Turborepo doc fetches **did not complete**. Citations below are this checkout plus a partial Turborepo search (retrieved 2026-09-15) that was not a full page fetch.

## Six findings

**1. Cost population is not “make `@beep/schema` tests faster.”**  
`scratchpad/bun-test/BENCHMARK.md` weights **total attributable CI cost per successful PR**. Test Unit shards run on **GitHub-hosted `ubuntu-24.04`** (`.github/workflows/check.yml:367–448`; partitions in `CiLanePartitions.ts:304–393`; `@beep/schema` is in `unit-b`). Coverage, Check, Build, Integration, Docgen, Doctest sit on **`beep-ec2-heavy`** (`.github/workflows/heavy.yml:11–66,127–137`). The $200/month, two-worker Spot policy (`docs/runbooks/aws-cost-operations.md:1–48`) is **EC2 occupancy**, not GitHub minutes. Queue wait is **not** billed occupancy. Partial adoption that **keeps Vitest coverage** leaves the Node coverage job. Setup/install, `--affected`, remote cache, retries, and unchanged **`^build`/`check`** can dominate. A schema-only wall-clock win does not prove a 10% PR-bill win.

**2. Ordinary tests are already Bun-hosted Vitest.**  
`@beep/schema` `test`/`test:property` → `beep:test` → `bunx --bun vitest run` (`packages/foundation/modeling/schema/package.json:21–30`). Coverage is `bunx vitest run --coverage` (**no `--bun`**). `CiLane.ts:407–427` records dual execution as **runtime-parity proof (D11)**, not duplicate waste: Test Unit under Bun, coverage under Node. Native `bun:test` vs **Bun-hosted Vitest** is a different experiment than Bun vs Node. `standards/architecture/08-testing.md:5–7,362` forbids `bun test` because it breaks `@effect/vitest`.

**3. Turbo can return cached success and hide adapter/config drift.**  
`test` is cacheable (default `cache: true`; `turbo.json:275–286`), `dependsOn: ["^transit"]`, inputs `$TURBO_DEFAULT$` + root `vitest.shared.ts`/`vitest.setup.ts`. It does **not** hash `BEEP_FC_NUM_RUNS`/`BEEP_FC_SEED` (those are on `test:property`, `turbo.json:305–313`), `bunfig.toml`, `vitest.aliases.generated.json`, or scratchpad adapter files. `coverage` is `cache: false` with `outputs: ["coverage/**"]` (`turbo.json:360–382`). `futureFlags.globalConfiguration` folds `global.inputs` (`.bun-version`, `.nvmrc`, root `package.json`, tsconfigs) into **task** hashes, not a separate global file hash. Official Turborepo: omitting `outputs` still caches **logs** and **skips execution** on hit. `--force` skips **reads**; a prior write can still poison later runs. For timings: `TURBO_CACHE` / `--cache=local:r,remote:r` off, or equivalent **no-read no-write**. Check `--dry=json` and `--summarize` so `cache.local`/`cache.remote` are miss, `execution` is executed, file lists match, and env fingerprints include the intended FC vars.

**4. Coverage is a separate, non-equivalent arm.**  
`vitest.setup.ts:1–8` documents **Istanbul under `bunx --bun vitest` instrumenting nothing** (measured 0% with passing tests). That is **not** a measured V8-on-Bun failure. Shared config uses **`provider: "v8"`**, `include: ["src/**/*.{ts,tsx}"]`, reporters text/html/lcov/json-summary (`vitest.shared.ts:22,248–267`). Hosted coverage pins **Node 22.22.3** and proves `--js-float16array` on the job, not job-wide `NODE_OPTIONS` (`heavy.yml:40–42,127–137`; `vitest.shared.ts:230–241`). Local `.nvmrc` is **24**. Native Bun coverage is not the V8 provider on Bun, and not the ratchet against `standards/coverage.regression-baseline.jsonc`. False-green: empty/wrong `include`, different statement/branch denominators, restored `coverage/**`, or comparing Bun-hosted V8 to Node 22 V8.

**5. Same flags, different work.**  
Vitest `sequence.concurrent` is on except doctest (`vitest.shared.ts:242–247`); `maxWorkers: 2` only in doctest. `BEEP_FC_NUM_RUNS > 0` **narrows include** to property-marker files (`vitest.shared.ts:71–147`). `fcRuns` is `max(inline ?? 100, env floor)` plus optional integer `BEEP_FC_SEED` (`FastCheckRuns.ts:162–168`). Adapter `it.prop` can take **string** seeds (`scratchpad/test/bun-test/index.test.ts:191,260–301`). Wrapper timeout aborts the fiber; Bun gets **+1000 ms** backstop (`internal.ts:333–357`). `addEqualityTesters` is a **no-op** (`index.ts:324–331`). Exported `assert` has no `deepInclude`; `@beep/test-utils` `Schema.ts:7,57` uses `assert.deepInclude` from `@effect/vitest`. Schema tests use `vi.fn`/`vi.spyOn` (`ProtobufScalars.test.ts:314–328`), `vi.resetModules` (`TaggedError.equivalence.test.ts:258–271`), `expectTypeOf` (`codecStatics.test.ts:18,49–58`; `Number.test.ts:4,44`). `bunfig.toml:11–12` exclude set ≠ Vitest exclude. Cannot `export … from "bun:test"` (`index.ts:24–26`). Isolation, mocks, module reset, and pool vs in-process concurrency are unverified against Bun docs.

**6. Canonical package must go through generators, not a root test command.**  
Task-facing scripts are generated (`PackageScripts.schemas.ts`; `AGENTS.md` / `package.json:350`). `test`/`test:property` indirection → `beep:test`; coverage is **owned**. New `beep:test` values or a parallel `test:bun` task need `implScriptDefaults` + `turbo.json` inputs (adapter package, `bunfig.toml`, preload). Place as `tooling`/`test-kit` (`ARCHITECTURE.md:621–628`); consume via `@beep/*` exports, not `scratchpad/` relatives. `^transit` only follows **declared** workspace deps. Do not hand-edit production script keys.

## Configuration matrix

| Arm | Baseline | Candidate | Hold constant |
|---|---|---|---|
| Ordinary | `turbo run test --filter=@beep/schema` → `bunx --bun vitest run`; Turbo cache **r/w off**; explicit workers | Same filter/files; `bun test` + adapter; same worker/concurrency/isolation knobs **named and counted** | SHA, file list, cgroup, CPU quota |
| Property | `test:property` + fixed `BEEP_FC_NUM_RUNS`/`BEEP_FC_SEED`; expect **narrowed** Vitest include | Same env; record **generated checks**, not case count; same seed **type** | Floor/seed; do not mix `test` vs `test:property` hashes |
| Coverage | Node 22.22.3, V8, `bunx vitest run --coverage`, `cache: false` | Bounded compare only; **not** adoption-equivalent | Include globs, reporters, ratchet JSON |

Diagnostic direct `bun test` / `vitest run` ≠ Turbo/CI savings.

## Qualification (before any timed arm)

Negative controls: (1) known failing assertion still fails; (2) `vi.resetModules` Float16 path still errors; (3) `fcRuns` check count matches; (4) `expectTypeOf` not silently skipped; (5) `assert.deepInclude` helper still runs; (6) coverage include/denominator vs baseline, no restored `coverage/**`; (7) `--dry=json` shows executed, not cached; (8) test count/skip/todo match.

No-benchmark-until: those eight pass; one arm at a time; failed/timeout/retry counted in the 60-minute cap; cgroup peak labeled as cgroup, not RSS; no page-cache drop.

## Unverified / not executed

No tests, benchmarks, CI, installs, or cache commands. Installed Bun 1.4.2 / Vitest 4.1.11 / Effect rc.113 were **not re-probed**. Bun isolation/`--concurrent`/`bun test --coverage`, Vitest V8-on-Bun, Effect `@effect/bun-test` vs this scratchpad, live AWS/GitHub bills, cache hit rates, and shard setup vs execute split: **unverified**. Skill text that “missing `outputs` caches nothing” **disagrees** with Turborepo’s logs-still-cached behavior.

What would **later** falsify: after qualified CI measurement, 95% (or predeclared) interval for total cost per successful PR not entirely ≥10%, or >10% completion-time/memory regression, new OOM, or lost tests. Unchanged builds, high cache hits, and coverage remaining on Node can make a real test speedup miss the bill threshold.

END OF REVIEW

🌱 graft saved ~307,650 tokens this turn (6 calls, prior investigation)
