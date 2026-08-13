# `lint:deprecated-apis` in-place speed investigation

## 1. TL;DR

Recommend two changes, in this order:

1. Keep the current 24 shards, but execute **4 shards concurrently** and use one ESLint cache file per shard. On the measured 8-vCPU/64-GiB runner, four lint processes consume about 6 vCPU from the local samples and should normally occupy 12-20 GiB RSS; even the four 8-GiB V8 heap ceilings total 32 GiB before process overhead. Projected cold step: **975s -> 270-360s (model midpoint 305s, 5.1 min)**.
2. Persist the per-shard cache directory with `actions/cache`, add `--cache-strategy content`, and accept only an **exact type-universe key** (no `restore-keys`). Projected exact-hit step with four-way fan-out: **20-45s**; a source/type-input change deliberately causes a cold **4.5-6 min** run.

Do **not** replace the shards with one full-repo process yet. Combining two tiny roots reduced local cold wall from 31.64s to 18.68s (0.59x), suggesting **~575s / 9.6 min** if that ratio scaled, but the process already reached 4.07 GiB RSS for only 10 lint targets and Git history shows that a large `packages/epistemic` shard had to be split specifically to bound memory. One invocation is likely to hit the current 8-GiB heap ceiling, and raising it enough would weaken runner headroom.

`allowDefaultProject` cleanup is worthwhile hygiene, not the primary speed lever. The 160 setting is only a failure threshold; lowering it alone saves approximately **0s**. Only 23 checked-in files match the 14 allow globs, so moving those files into real TSConfig projects is projected to save **0-45s** until measured.

### Numeric model

| Scenario | Deprecated step | Whole `lint-policy` command | Model |
| --- | ---: | ---: | --- |
| Current cold | 975s | 1,124s measured | shared brief |
| 4-way shards, cold | 270-360s (305s midpoint) | ~390-480s | `975 / 4 / 0.80 = 305`; outer two-worker pool must still drain ~564s of other work |
| Exact cache hit, sequential | 80-150s | ~300-360s | 24 starts; measured warm small-shard start was 3.28s |
| Exact cache hit + 4-way shards | 20-45s | ~280-330s | six waves at ~3.3s plus discovery/cache restore variance |
| One full invocation, cold, if it fits | 480-720s | ~650-800s | midpoint applies measured two-root factor: `975 * 18.68 / 31.64 = 575s` |
| Default-project cleanup alone | 930-975s | ~1,080-1,124s | only <=23 candidate files; cap change itself does no work |

The whole-command projections use the brief's ~564s of non-deprecated work and the existing outer concurrency of 2. They are scheduling estimates, not hosted measurements. A cold combined run should bring the command itself into single digits; the ~66s setup remains outside it.

## 2. Evidence

### Live implementation and CI

- There are **24**, not ~30, current roots. The constants define one shared cache path, an 8-GiB heap ceiling, and roots spanning apps/infra/package groups: `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:46-74`.
- Every shard launches a fresh local ESLint process with `--cache`, the shared cache location, the root config, and the deprecated profile: `Lint.command.ts:461-493`. The plain `for...of` awaits every process before starting the next: `Lint.command.ts:500-503`.
- The policy command runs 25 independent steps with outer concurrency 2: `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:119-124,1470-1512,1573-1577`. Thus four internal ESLint processes overlap one other policy subprocess.
- Hosted `lint-policy` is on `beep-ec2-heavy`, does not enable Turbo, and receives no affected-scope arguments: `.github/workflows/check.yml:63-68,217-231`.
- The runner fleet is fixed at 64 GiB because other lanes have measured 24.77-47.59-GiB peaks: `infra/src/CiFleetController.ts:30-35`. Those build lanes are not nested inside this policy step.
- Setup restores only Bun and optional Turbo caches; it has no ESLint cache: `.github/actions/setup-monorepo-ci/action.yml:43-62`. The matrix explicitly passes `cache-write: "false"`: `.github/workflows/check.yml:195-200`.

### Why the shards exist / memory evidence

- Read-only Git inspection found the shard list in its introduction (`491893715f`, 2026-06-04). More importantly, `git show 4cd02e6962` (`fix(tooling): bound deprecated API lint memory`, 2026-07-31) replaces one `packages/epistemic` root with its seven present subroots. This is direct OOM/heap-pressure intent even though the commit body does not preserve a crash log.
- A cold local run of the 3-file `apps/architecture-lab-proof` root took **13.91s**, **2,914,300 KiB (2.78 GiB) max RSS**, and 147% CPU. A cold 7-file `packages/epistemic/client` run took **17.73s**, **4,156,348 KiB (3.96 GiB) RSS**, and 151% CPU. Commands used the checked-in `./node_modules/.bin/eslint`, current profile/config, 8-GiB heap limit, and isolated `/tmp` caches.
- Combining those roots in one ESLint invocation took **18.68s**, **4,264,568 KiB (4.07 GiB) RSS**, and 150% CPU, versus **31.64s** sequential. This proves material project-service re-creation overhead, but also shows memory approaching half the heap cap for tiny target sets.
- There are 3,803 checked-in TS/TSX paths under apps/packages/infra. Target counts are highly skewed (3 in the smallest sample; 771 under `packages/tooling`), so the parallel projection includes a 20% scheduling/contention penalty instead of assuming perfect `975/4` scaling.

### Cache correctness for a type-aware rule

- The only enabled rule is `@typescript-eslint/no-deprecated`, and parsing uses `projectService`: `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:90-132`. Its result depends on types and declarations outside the target file.
- ESLint considers a cached result valid iff the target file is present, that target is unchanged, and its resolved ESLint config hash is unchanged: `node_modules/eslint/lib/cli-engine/lint-result-cache.js:135-169`. It does **not** include imported source, declarations, TSConfigs, or package resolution metadata in that per-file validity test.
- The config hash includes ESLint version, Node version, and serialized resolved config: `node_modules/eslint/lib/cli-engine/lint-result-cache.js:30-60`. That still does not capture the TypeScript program's dependency graph.
- Default `metadata` compares only target mtime and size: `node_modules/file-entry-cache/cache.js:93-133`; `content` compares only target content hash: `cache.js:136-162`. Therefore neither strategy alone makes cross-package typed lint caching sound.
- `content` is nevertheless required for a restored cache because checkout/restoration mtimes need not match. ESLint confirms `metadata` is the default: `node_modules/eslint/lib/options.js:283-294`.
- Unsound example: package A changes an exported symbol from non-deprecated to `@deprecated`; unchanged package B imports it. With a coarse cache key, B's cached clean result is reused under either strategy even though `no-deprecated` should now fail.
- Sound vanilla-ESLint policy: invalidate **all shard caches** whenever any type-semantic input changes. The action key must exactly hash Node/toolchain inputs, `bun.lock`, root/workspace `package.json` files, ESLint config/profile source, all TSConfigs, and all lint-universe `.ts/.tsx/.d.ts` files. Use `--cache-strategy content` and **no prefix restore key**. This preserves correctness but only hits for same-input reruns or changes outside the type universe.
- Parallel processes must not share today's cache file. Each process loads and reconciles a whole flat-cache snapshot (`node_modules/file-entry-cache/cache.js:252-287`), so concurrent writers can overwrite one another's additions. Stable per-shard filenames remove that race and enable partial cache files to be archived together.

### One process and project-service tuning

- The lint config already narrows targets to app/package TS/TSX and infra TS and ignores generated, build, vendored, declaration, and type-test outputs: `DeprecatedApisESLintConfig.ts:18-44`.
- `allowDefaultProject` has 14 globs and a maximum of 160: `DeprecatedApisESLintConfig.ts:103-125`. A targeted live `rg --files` found only 23 candidate files matching those globs.
- TypeScript-eslint documents that every actual default-project match slows lint and defaults the guard to 8: `node_modules/@typescript-eslint/types/dist/parser-options.d.ts:12-34`. The implementation adds actual fallback files to a set and only then checks the maximum: `node_modules/@typescript-eslint/typescript-estree/dist/useProgramFromProjectService.js:103-119`. Therefore 160 is not a preallocation or scan target.
- Every linted file does run the allow-glob `some(minimatch)` check: `useProgramFromProjectService.js:174-204`; 14 patterns over 3,803 paths is cheap relative to TypeScript program construction.
- Debugging `packages/_internal` showed two files actually entering the default project; the rest resolved to package/root TSConfigs. The root config covers broad test/root inputs but excludes fixtures: `tsconfig.json:9-28`, explaining why exceptional scripts/fixtures need explicit treatment.

## 3. Implementation sketch

1. In `Lint.command.ts`, derive a stable cache filename from each shard, for example `.eslintcache-packages__tooling`, under the existing cache directory.
2. Add `--cache-strategy content` to every ESLint call.
3. Replace the sequential loop with bounded `Effect.forEach(DEPRECATED_API_LINT_SHARDS, runDeprecatedApiLintShard, { concurrency: 4 })`. Preserve failure propagation and child interruption/cleanup. Do not use unbounded concurrency.
4. Add a focused test that inspects constructed shard commands: 24 unique cache paths, content strategy present, concurrency fixed at 4, and nonzero exit still fails the aggregate.
5. Add lint-policy-only cache restore/save around the verification lane (or a narrowly named input in the composite action). Archive `node_modules/.cache/eslint-deprecated-apis/`.
6. Use a versioned exact key such as `eslint-deprecated-v2-${runner.os}-${runner.arch}-${hashFiles(...)}` over `.nvmrc`, `bun.lock`, all relevant `package.json`, `eslint.config.mjs`, policy-config `.ts`, all TSConfigs, and the explicit `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`, and `infra/**/*.ts` universes (which include `.d.ts`). Do not configure `restore-keys`. Save only after a completed lint-policy execution.
7. Emit shard duration and max concurrency in logs. Validate on the 8-vCPU fleet member, then compare cold wall/RSS with concurrency 3 and 4; retain 4 only if peak job RSS stays below ~48 GiB and no swap/OOM occurs.
8. Separately ratchet `maximumDefaultProjectFileMatchCount...` from 160 to a measured near-current ceiling (for example actual count + 2). Move exceptional files into appropriate package TSConfigs or a deliberately small scripts/fixtures config before deleting allow globs. This is correctness/anti-creep work, not part of the primary timing promise.

For the one-process experiment only: run all 24 existing roots as arguments in an isolated CI diagnostic with `/usr/bin/time -v` and no concurrent outer policy work. Try the current 8-GiB cap first. Adopt it only if it completes below ~6 GiB RSS and beats four-way shards; current evidence makes that unlikely.

## 4. Risks / correctness tradeoffs

- **Cache false negatives are the largest correctness risk.** Any fallback restore key or key omitting cross-package source/declarations/TSConfigs/package resolution is unacceptable for `no-deprecated`.
- The exact broad key sacrifices incremental hits on normal source-changing PRs. That is intentional; dependency-aware per-shard keys would require a proven transitive type graph, not hand-written package guesses.
- Four-way fan-out competes with one outer policy subprocess. CPU should fit the measured ~1.5 CPU/process profile, but large shards may have different behavior; hosted RSS and CPU telemetry are the acceptance evidence.
- An 8-GiB V8 heap setting is not an 8-GiB RSS hard cap. Four pathological processes can exceed the simple 32-GiB heap sum after native/TypeScript overhead.
- One process maximizes reuse but retains every opened project longer. The 2026-07-31 split is strong evidence against assuming a full invocation fits.
- Lowering the default-project maximum before counting actual fallback files can turn current coverage into parser failures. First inventory, then ratchet.
- Per-shard cache filenames change cache semantics but not lint scope. One global cache file is safe only while calls remain sequential.

## 5. Open questions

1. What are hosted per-shard durations and max RSS, especially `packages/tooling`, `packages/drivers`, `packages/foundation/modeling`, and `packages/epistemic/*`? Instrumentation is needed to replace the 20% scheduling allowance.
2. How many of the 23 allow-glob candidates truly fall back to the default project across the full run, and which TSConfig should own each one?
3. Does a four-way cold run keep total job RSS below ~48 GiB while docgen or semantic-delta occupies the second outer slot?
4. Is exact-input cache reuse frequent enough (reruns, main-to-doc-only PRs) to justify the cache action, or should caching remain local-only after parallelism lands?
5. Can the repo's project/reference graph produce a tested transitive dependency hash per shard? If yes, that could unlock sound incremental cache reuse; until then, use the broad exact key.
