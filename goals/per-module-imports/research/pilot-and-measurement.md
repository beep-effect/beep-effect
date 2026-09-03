# Pilot candidates and measurement protocol

Status: research draft for lane C4. This report designs the pre-migration measurement gate. It does not run builds, dev servers, or benchmarks.

## Scope and method

The gate compares one pilot slice before and after replacing imports through the `effect` and `@beep/*` foundation barrels with per-module imports. All value and type imports participate; `pipe`, `flow`, and `identity` move to named imports from `effect/Function`. Existing barrel entrypoints and export declarations remain untouched as the public/docgen surface. The gate measures production output where the selected app makes that reproducible, but it does not assume a production bundle win. It also measures cold module-graph startup, typechecking, and test startup because those paths may expose costs that production tree shaking already removes.

Inventory commands in this lane were read-only. Existing `dist`, `.next`, `storybook-static`, `.turbo/runs`, and goal-packet artifacts were inspected, but no build, dev server, test, or typecheck was run. Generated-directory byte counts below are therefore snapshots, not baselines.

## Bundle and executable surfaces

| Workspace | Framework and canonical command | Output | Reproducible size evidence today | Pilot value |
| --- | --- | --- | --- | --- |
| `@beep/architecture-lab-proof` | TypeScript contract harness, not a browser app. `beep:build` runs `tsc` and then the pure-call Babel pass. [apps/architecture-lab-proof/package.json:14-24](../../../apps/architecture-lab-proof/package.json) | `dist/`, covered by the root Turbo `build` output glob. [turbo.json:53-65](../../../turbo.json) | Emitted file bytes only. The observed `dist/` snapshot was 5,938 bytes across 4 files. There is no bundle or stats harness. | Too small for bundle or cold-dev evidence. |
| `@beep/trustgraph-workbench` | Vite + React lab. `beep:build` is `vite build`; `dev` is portless-wrapped Vite. [apps/labs/trustgraph-workbench/package.json:14-28](../../../apps/labs/trustgraph-workbench/package.json) | Vite's default `dist/`; the app does not override `build.outDir`. [apps/labs/trustgraph-workbench/vite.config.ts:5-20](../../../apps/labs/trustgraph-workbench/vite.config.ts) | Raw and compressed asset bytes are reproducible, but no manifest or stats output is configured. The observed `dist/` snapshot was 374,708 bytes across 3 files. | Very small blast radius, but the current app has no target barrel imports, so it cannot measure the migration. |
| `@beep/oip-web` | Next.js 16.4 canary. The normal build is `next build --turbopack`; `build:pwa` is the Webpack/Serwist build; dev uses portless plus Turbopack. [apps/oip-web/package.json:14-32](../../../apps/oip-web/package.json) | `.next/` plus `public/sw.js` for the PWA variant. The root Turbo task caches `.next/**` but excludes `.next/cache/**`. [turbo.json:53-65](../../../turbo.json) | Route/build manifests and NFT traces exist under `.next/`, and the shared config has both a bundle-analyzer plugin and the `ANALYZE` toggle. [packages/tooling/policy-pack/repo-configs/src/next/SharedNextConfig.model.ts:380-418](../../../packages/tooling/policy-pack/repo-configs/src/next/SharedNextConfig.model.ts) Next 16 no longer prints JS bundle-size metrics from `next build`; its supported Turbopack comparison artifact is `next experimental-analyze --output`, written to `.next/diagnostics/analyze`. [Next CLI](https://nextjs.org/docs/app/api-reference/cli/next) The observed `.next/` tree was 397,638,727 bytes across 360 files, but that includes caches and is not a usable bundle metric. | Good low-blast app pilot. It has 21 target-import files among 38 TypeScript files, but route-specific size extraction is more involved than Vite. |
| `@beep/professional-desktop` | Vite + React webview in a Tauri shell. `beep:build` is `vite build`; `dev` is portless-wrapped Vite; `dev:tauri` is separate. [apps/professional-desktop/package.json:14-40](../../../apps/professional-desktop/package.json) | Web assets in `dist/`; Tauri's Rust/application outputs are outside the canonical `build` script and outside this pilot metric. | No Vite manifest or stats plugin is configured. Raw, gzip, and Brotli bytes of `dist/assets/*.{js,css}` are reproducible. The config deliberately produces named chunk groups, including `effect-vendor`, which gives the migration a narrow Effect-specific bundle observation. [apps/professional-desktop/vite.config.ts:44-60](../../../apps/professional-desktop/vite.config.ts) The observed `dist/` snapshot was 8,981,568 bytes across 149 files; its `effect-vendor` chunk was 325,825 raw bytes. | Best single-workspace coverage of bundle, Vite cold start, typecheck, and Vitest startup. It has 103 target-import files among 126 TypeScript files, so the blast radius is moderate rather than tiny. |
| `@beep/storybook` | Storybook 10 on `@storybook/react-vite`. Build is `storybook build -o storybook-static`; dev is portless-wrapped Storybook. [apps/storybook/package.json:14-34](../../../apps/storybook/package.json) [apps/storybook/.storybook/main.ts:48-85](../../../apps/storybook/.storybook/main.ts) | `storybook-static/`, explicitly cached by both the root `build` task and `storybook:build`. [turbo.json:53-65](../../../turbo.json) [turbo.json:242-252](../../../turbo.json) | Static JS/CSS bytes and `index.json` are reproducible. The observed tree was 67,160,010 bytes across 717 files, but it includes the copied `emojibase-data` directory, so asset comparisons must exclude that static payload. | Broad UI dependency graph, but the host itself has no target barrel imports. Migrating its external story sources would enlarge and blur the pilot. |
| `@beep/practice-kg-mcp` | Bun/Node ESM MCP host built with `tsc`; no browser bundler and no `dev` script. [apps/practice-kg-mcp/package.json:14-32](../../../apps/practice-kg-mcp/package.json) | `dist/`. The observed snapshot was 89,469 bytes across 44 emitted files. | Emitted bytes are reproducible but do not represent a bundle. Process-to-first-ready startup is potentially useful only after choosing a hermetic command that does not open databases, the network, or stdio protocol state. | Strong server/test/typecheck alternative: 9 of 14 TypeScript files use target barrels, and recorded check/test tasks are non-trivial. |

Tree-shaking-relevant configuration is intentionally sparse:

- TrustGraph does not define a Vite `build` block, so it inherits Vite's production minification and module-preload defaults. [apps/labs/trustgraph-workbench/vite.config.ts:5-20](../../../apps/labs/trustgraph-workbench/vite.config.ts) [Vite build options](https://vite.dev/config/build-options)
- Professional Desktop does not override `build.minify` or `build.modulePreload`; it adds explicit Rolldown code-splitting groups. Its `optimizeDeps.include`/`exclude` list is dev-only but directly relevant to the cold-start experiment. [apps/professional-desktop/vite.config.ts:44-91](../../../apps/professional-desktop/vite.config.ts)
- Storybook's Vite merge changes the chunk-size warning and module resolution/plugins, not minification or module preload, so its static build inherits the same Vite production defaults. The Storybook host marks CSS as its only side-effectful file family. [apps/storybook/.storybook/main.ts:48-85](../../../apps/storybook/.storybook/main.ts) [apps/storybook/package.json:67-69](../../../apps/storybook/package.json)
- OIP does not disable production optimization. Its shared Next preset enables `optimizePackageImports`, but the default list contains selected UI libraries rather than Effect or the foundation barrels. [packages/tooling/policy-pack/repo-configs/src/next/SharedNextConfig.model.ts:34-45](../../../packages/tooling/policy-pack/repo-configs/src/next/SharedNextConfig.model.ts) [packages/tooling/policy-pack/repo-configs/src/next/SharedNextConfig.model.ts:482-493](../../../packages/tooling/policy-pack/repo-configs/src/next/SharedNextConfig.model.ts) The app's only Webpack customization replaces/stubs Node built-ins for the client PWA build; it does not change tree shaking or minification. [apps/oip-web/next.config.ts:43-76](../../../apps/oip-web/next.config.ts)
- The TypeScript/Babel and plain TypeScript executables are emitted module trees, not production bundles. Their `sideEffects` metadata may help a later consumer bundle, but it does not shrink their own `dist` byte count.

### Tree-shaking conclusion

The installed Effect snapshot is `4.0.0-rc.111`. [node_modules/effect/package.json:1-5](../../../node_modules/effect/package.json) It declares `"sideEffects": []`, maps the package root to `dist/index.js`, maps `effect/*` to `dist/*.js`, and blocks internal and redundant index subpaths. [node_modules/effect/package.json:28-56](../../../node_modules/effect/package.json) Its root is an ESM barrel: Function combinators are direct re-exports and modules such as Effect are namespace re-exports. [node_modules/effect/dist/index.d.ts:4-32](../../../node_modules/effect/dist/index.d.ts) [node_modules/effect/dist/index.d.ts:120-128](../../../node_modules/effect/dist/index.d.ts) `@beep/utils`, `@beep/schema`, and `@beep/identity` likewise expose root and per-module entry points and declare no side effects. [packages/foundation/modeling/utils/package.json:47-60](../../../packages/foundation/modeling/utils/package.json) [packages/foundation/modeling/schema/package.json:49-52](../../../packages/foundation/modeling/schema/package.json) [packages/foundation/modeling/schema/package.json:309-324](../../../packages/foundation/modeling/schema/package.json) [packages/foundation/modeling/identity/package.json:36-56](../../../packages/foundation/modeling/identity/package.json)

That packaging gives production bundlers enough static information to remove unused namespace re-exports. Next says its production bundling already applies code splitting and tree shaking, while Webpack documents that production optimization honors the package `sideEffects` field. [Next package-bundling guide](https://nextjs.org/docs/app/guides/package-bundling) [Webpack tree-shaking guide](https://webpack.js.org/guides/tree-shaking/) Vite's production defaults also already include minification, module-preload generation, and a `dist` output unless overridden. [Vite build options](https://vite.dev/config/build-options)

The honest prediction is therefore **near-zero production bundle movement for a named import from a correctly marked Effect or foundation barrel**. A direct subpath can still change chunk boundaries or expose a bundler defect, so bundle bytes stay as a regression guard. The credible wins are elsewhere:

- Vite and Next cold startup may resolve, crawl, transform, or prebundle fewer modules before their production dead-code pass.
- TypeScript/tsserver may parse and bind fewer barrel declarations and fewer transitive namespace re-exports. The Effect barrel alone names every module; direct imports bypass that fan-out.
- Bun/Vitest and Node/Bun ESM startup may instantiate a smaller runtime module graph before executing a test or server entry point.

These are hypotheses. The gate must not turn packaging theory into a promised win.

## Typecheck surface

The root `check` script is not a bare compiler invocation: it enters `beep-cli`, which first runs the Turbo `check` graph and, for an unbounded root run, follows with the repo-wide tsgo rules, test, and smoke steps. [package.json:303-317](../../../package.json) [packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1727-1744](../../../packages/tooling/tool/cli/src/commands/Quality/Tasks.ts) The wrapper already prints an elapsed duration per step. [packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1237-1249](../../../packages/tooling/tool/cli/src/commands/Quality/Tasks.ts) Within Turbo, each package's `check` task depends on dependency builds, takes the package's default inputs, and has no declared output; a source edit therefore misses that package's check cache even when tsgo itself emits nothing. [turbo.json:91-99](../../../turbo.json)

Package scripts are the unit that matters. Most packages run tsgo against `tsconfig.check.json`; some add independent programs or generated-file checks. For example, Professional Desktop checks its source program, scripts program, and migration-bundle drift, while Practice KG checks source and tests separately. [apps/professional-desktop/package.json:23-29](../../../apps/professional-desktop/package.json) [apps/practice-kg-mcp/package.json:16-22](../../../apps/practice-kg-mcp/package.json) `@beep/schema` and `@beep/utils` each expose a single package-level tsgo check. [packages/foundation/modeling/schema/package.json:8-24](../../../packages/foundation/modeling/schema/package.json) [packages/foundation/modeling/utils/package.json:14-30](../../../packages/foundation/modeling/utils/package.json)

An existing all-miss Turbo run is useful for ranking, but not as a before measurement: it attempted 230 build/check tasks with 0 cached and completed in 85.766 seconds on this machine. [.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json:42-51](../../../.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json) Its longest package checks included `@beep/html` at 11.032 seconds, `@beep/repo-cli` at 8.160, `@beep/ontology-client` at 7.992, `@beep/effect-drizzle` at 7.851, Professional Desktop at 7.701, and Practice KG at 5.270. The artifact identifies the corresponding tasks and records their execution windows. [.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json:23143-23148](../../../.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json) [.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json:34820-34825](../../../.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json) [.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json:40656-40659](../../../.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json) [.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json:40071-40074](../../../.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json) These wall times are scheduling-sensitive because the tasks ran concurrently; they choose candidates, not thresholds.

The repo has one explicit instantiation-budget method. The Box packet measures a temporary no-emit, non-incremental tsconfig with extended compiler diagnostics, records compiler version, and warns that inherited `include` must be cleared for file-level probes. [goals/box-typecheck-cost/research/measurements.md:1-25](../../../goals/box-typecheck-cost/research/measurements.md) It found a 1,649,265-instantiation floor for a trivial file importing `@beep/identity`, `@beep/schema`, and `effect/Schema`; this is directly relevant to the import experiment. [goals/box-typecheck-cost/research/measurements.md:27-35](../../../goals/box-typecheck-cost/research/measurements.md) The standing budget is Box-specific—at most 750K marginal instantiations per generated file and 3M package-wide—and is a documented remeasurement ritual, not CI. [goals/box-typecheck-cost/SPEC.md:124-144](../../../goals/box-typecheck-cost/SPEC.md) [goals/box-typecheck-cost/SPEC.md:169-175](../../../goals/box-typecheck-cost/SPEC.md) It also identifies `@beep/ui` at about 3.5M instantiations as the second-tier known hot spot. [goals/box-typecheck-cost/SPEC.md:177-183](../../../goals/box-typecheck-cost/SPEC.md)

For this pilot, capture two different truths:

- Run the pilot package's complete `beep:check` for contract wall time. It includes every program or drift check the workspace owns.
- Run each tsgo program directly with `--extendedDiagnostics --incremental false --noEmit` for deterministic `Files`, `Types`, `Instantiations`, `Memory used`, and compiler phase timing. Do not compare a source-only direct run with the multi-step package script.
- Also run a filtered Turbo check once per state with `--summarize`; its task hit/miss count and total wall time estimate the CI-shaped graph, while the direct runs isolate compiler behavior.
- Record the exact tsgo/Effect versions with both states. The checked-in catalog and installed Effect snapshot currently agree on `4.0.0-rc.111`; freeze that installation before the baseline and do not change it between states. [package.json:145-153](../../../package.json) [node_modules/effect/package.json:1-5](../../../node_modules/effect/package.json)

## Dev cold-start surface

The app commands must remain the package scripts. Professional Desktop's canonical URL is `http://professional-desktop.beep.localhost:1355`; OIP's is `http://oip-web.beep.localhost:1355`. Their scripts wrap Vite and Next in portless. [apps/professional-desktop/package.json:14-25](../../../apps/professional-desktop/package.json) [apps/oip-web/package.json:14-22](../../../apps/oip-web/package.json) This is also repo law: dev servers use portless-wrapped package scripts rather than raw framework commands or numeric localhost URLs. [AGENTS.md:75-77](../../../AGENTS.md)

The measurement is process start to the first successful HTTP response for the app's root route, not merely the framework's “ready” log. That includes route compilation and the module graph needed for a usable first page. Start the portless proxy in an untimed smoke run and keep it alive across all samples so proxy boot is not misattributed to the import change. Before every timed Vite run, remove only `apps/professional-desktop/node_modules/.vite` and `.vite-temp`; before every timed Next run, remove only `apps/oip-web/.next`. The latter is necessary because the shared Next preset explicitly enables Turbopack's filesystem cache for both build and dev. [packages/tooling/policy-pack/repo-configs/src/next/SharedNextConfig.model.ts:482-488](../../../packages/tooling/policy-pack/repo-configs/src/next/SharedNextConfig.model.ts)

Hold these states constant:

- Do not reinstall or mutate `node_modules` between before and after runs.
- Bypass Turbo by invoking the app's `dev` script directly; Turbo's persistent `dev` task is uncached but depends on dependency builds, which would measure a different graph. [turbo.json:233-237](../../../turbo.json)
- Keep the same machine, power profile, terminal environment, and portless proxy. Close other builds, tests, indexers, and dev servers.
- Keep the operating-system page cache warm and uncontrolled in both states; do not use privileged `drop_caches`. Clear only the named framework cache each run.
- Require the canonical route to be inactive before launch, poll with the same one-second timeout, and terminate the complete process group after readiness.

## Test-runner startup surface

Vitest is the most direct runtime-module-graph probe because the shared config resolves TypeScript source aliases, applies an Oxc transform, loads a global setup file, and runs package test files concurrently by default. [vitest.shared.ts:93-113](../../../vitest.shared.ts) [vitest.shared.ts:113-163](../../../vitest.shared.ts) Existing logs already split total duration into transform, setup, import, tests, and environment. They show why total suite time is not a clean startup metric: Professional Desktop's 43-file run reported 8.65 seconds wall time but large worker-aggregate transform/import totals, while the one-file Practice KG suite reported 3.87 seconds wall time, 3.55 of it in import and only 10 milliseconds in the test body. [apps/professional-desktop/.turbo/turbo-test.log:541-547](../../../apps/professional-desktop/.turbo/turbo-test.log) [apps/practice-kg-mcp/.turbo/turbo-test.log:4-11](../../../apps/practice-kg-mcp/.turbo/turbo-test.log)

Use a single representative test file, a single worker, and no file parallelism. For Professional Desktop, `test/UsagePricing.test.ts` directly imports both `@beep/schema` and the Effect barrel and then exercises an Effect test; it is small enough that module loading dominates. [apps/professional-desktop/test/UsagePricing.test.ts:1-21](../../../apps/professional-desktop/test/UsagePricing.test.ts) For OIP, `test/oip-seo.test.ts` imports both `@beep/utils` and the Effect barrel while reaching a representative app content graph. [apps/oip-web/test/oip-seo.test.ts:1-19](../../../apps/oip-web/test/oip-seo.test.ts) For the foundation alternative, `@beep/schema/test/EffectSchema.test.ts` is a bounded Effect/Schema probe. [packages/foundation/modeling/schema/test/EffectSchema.test.ts:1-12](../../../packages/foundation/modeling/schema/test/EffectSchema.test.ts)

Clear Vitest/Vite's package-local transform cache before every run. The primary number is process wall time. The Vitest summary's transform, setup, import, and environment fields are diagnostic components; with one file and one worker they can explain the delta without the many-worker aggregation seen in full-suite logs. Run the package's complete test script once per state as a correctness check, not as the startup benchmark.

## Ranked pilot candidates

Scores are 1–5, higher is better. “Blast” scores small blast radius rather than raw size. A target-import file is a TypeScript/TSX file importing the Effect root or the root of a live `packages/foundation/**` workspace; the inventory includes type-only imports. The counts were produced by enumerating live foundation package names from their `package.json` files and matching exact root specifiers, rather than treating every `@beep/*` package as a foundation barrel.

| Rank | One pilot slice | Measure / represent / blast | Migration and moving metrics | Expected effort |
| ---: | --- | --- | --- | --- |
| **1** | **`@beep/professional-desktop` (recommended)** | **5 / 5 / 3 = 75** | Migrate every target root import in the workspace's `src`, `server`, `scripts`, tests, and config files; do not touch dependencies. The live inventory is 103 affected files among 126 TS/TSX files. Measures Vite output and its named `effect-vendor` chunk, HTTP cold start, two tsgo programs plus the complete check, and a single-worker Vitest probe. | Moderate mechanical rewrite, bounded to one app. Its package script already owns every relevant proof. Tauri/Rust builds and sidecar integration are explicitly outside the performance sample. |
| **2** | **`@beep/oip-web`** | **3 / 4 / 5 = 60** | Migrate all 21 affected files among 38 TS/TSX files. Measures Turbopack cold start, source tsgo, one-file Vitest startup, and Next analyzer/build artifacts. | Smallest useful app rewrite. The cost is measurement setup: Next 16 route output requires analyzer artifacts, and `.next` must be partitioned carefully so cache bytes are never presented as bundle bytes. |
| **3** | **`@beep/schema`** | **3 / 5 / 2 = 30** | Migrate all 203 affected files among 315 TS/TSX files inside the foundation package. Measures the compiler's files/types/instantiations/memory/check time and the single-file Vitest import graph. Re-run the existing Box import-floor probe because the package that defines that floor moved. | High review surface for a pilot and no app cold-start or bundle metric. It is the best type-system experiment, but changing a central foundation package also invalidates downstream task hashes, so it is a poor first gate unless typecheck is the sole decision criterion. |

Professional Desktop has the highest product because it is the only candidate that makes every requested metric directly observable in one workspace. **Select exactly Professional Desktop as the packet's one pilot slice. Do not pair it with `@beep/schema`; that would turn a pilot into a two-workspace migration and confound attribution.** The schema candidate remains the documented fallback for a future, separately authorized experiment if the app pilot says startup is neutral but leaves a specific compiler question unanswered.

## Paste-ready measurement gate

### Gate statement

> Before migrating any workspace outside `apps/professional-desktop`, capture the full baseline below, migrate every in-scope import in that workspace, and repeat the same harness without changing dependencies, compiler, lockfile, machine, power profile, or portless proxy. Store raw logs under `.beep/research/per-module-imports/measurements/{before,after}`. One untimed smoke is followed by seven cold-cache runs per state for compiler, dev-start, and test-start metrics; production build time gets five runs because output bytes should be deterministic. Report every sample, median, median absolute deviation (MAD), and interquartile range (IQR). Do not report a best run.

### Fixed environment and inventory

Run from the repo root in Bash. Set `STATE=before` for the untouched pilot and `STATE=after` only after the complete pilot migration.

```bash
set -euo pipefail

MISE_SHIMS="$HOME/.local/share/mise/shims"
MISE_BUN="$MISE_SHIMS/bun"
MISE_NODE="$MISE_SHIMS/node"
STATE="${STATE:?set STATE to before or after}"
case "$STATE" in before|after) ;; *) echo "STATE must be before or after" >&2; exit 2 ;; esac

REPO_ROOT=$(pwd)
RESULTS="$REPO_ROOT/.beep/research/per-module-imports/measurements/$STATE"
mkdir -p "$RESULTS"

"$MISE_BUN" --version | tee "$RESULTS/bun-version.txt"
"$MISE_NODE" --version | tee "$RESULTS/node-version.txt"
env PATH="$MISE_SHIMS:/usr/bin:/bin" node_modules/.bin/tsgo --version \
  | tee "$RESULTS/tsgo-version.txt"
"$MISE_NODE" -p 'require("./node_modules/effect/package.json").version' \
  | tee "$RESULTS/effect-version.txt"

foundation_names=$(find packages/foundation -name package.json -not -path '*/node_modules/*' -print0 \
  | xargs -0 jq -r '.name' | sed 's#@beep/##' | paste -sd'|' -)
{ rg -l --glob '*.{ts,tsx}' --glob '!dist/**' --glob '!node_modules/**' \
    "from[[:space:]]+\"(effect|@beep/($foundation_names))\"" apps/professional-desktop \
    || true; } | sort | tee "$RESULTS/target-import-files.txt"
```

The before inventory must contain 103 files in the current snapshot. The after inventory must be empty. If package names or counts drift before execution, record and review the new inventory; do not force the historical count.

### Metric A — compiler

Run the source and scripts programs separately. `--incremental false --noEmit` controls compiler cache/emission, while `--extendedDiagnostics` supplies structural counters. Run the complete package check once afterward so codegen drift and the script's exact contract remain covered.

```bash
for run in $(seq 1 7); do
  /usr/bin/time -f 'wall_s=%e max_rss_kb=%M' \
    -o "$RESULTS/tsgo-source-$run.time" \
    env PATH="$MISE_SHIMS:/usr/bin:/bin" node_modules/.bin/tsgo \
      -p apps/professional-desktop/tsconfig.check.json \
      --extendedDiagnostics --incremental false --noEmit \
      >"$RESULTS/tsgo-source-$run.log" 2>&1

  /usr/bin/time -f 'wall_s=%e max_rss_kb=%M' \
    -o "$RESULTS/tsgo-scripts-$run.time" \
    env PATH="$MISE_SHIMS:/usr/bin:/bin" node_modules/.bin/tsgo \
      -p apps/professional-desktop/tsconfig.scripts.json \
      --extendedDiagnostics --incremental false --noEmit \
      >"$RESULTS/tsgo-scripts-$run.log" 2>&1
done

/usr/bin/time -f 'wall_s=%e max_rss_kb=%M' \
  -o "$RESULTS/package-check.time" \
  "$MISE_BUN" run --cwd apps/professional-desktop beep:check \
  >"$RESULTS/package-check.log" 2>&1
```

Primary compiler metrics are source-program median wall time, tsgo `Check time`,
`Files`, `Types`, `Instantiations`, and maximum RSS. Scripts-program and
complete-package times are secondary/regression metrics. `Files` must be
identical across the seven runs. Preserve every structural-counter sample and
prove the tracked source hash is stable: the native parallel tsgo build can
vary `Types` and `Instantiations` slightly across identical invocations, so
compare those counters by median/MAD and require the same stability test as a
timing change. A 5% structural movement remains the minimum qualifying change;
do not treat sub-threshold counter jitter as source drift or a measured win.

Capture one CI-shaped cold local graph separately. The isolated cache directory avoids deleting or reading the user's normal Turbo cache; `--summarize` leaves the task-level run artifact under `.turbo/runs` and the log identifies it.

```bash
/usr/bin/time -f 'wall_s=%e max_rss_kb=%M' \
  -o "$RESULTS/turbo-check.time" \
  env PATH="$MISE_SHIMS:/usr/bin:/bin" node_modules/.bin/turbo run check \
    --filter=@beep/professional-desktop \
    --cache=local:rw --cache-dir="$RESULTS/turbo-cache" --summarize \
    >"$RESULTS/turbo-check.log" 2>&1
```

Do not use this single concurrent graph time as a performance threshold; compare its task count and miss fan-out as CI-cost evidence.

### Metric B — cold Vite route readiness

The untimed smoke starts and warms the portless proxy. Every timed invocation deletes only Vite's package-local transform/prebundle cache, verifies that the named route is inactive, starts the canonical package script in its own process group, and stops at the first successful root response.

```bash
measure_dev_once() {
  local label=$1
  local log="$RESULTS/dev-$label.log"
  local start_ns end_ns elapsed_ms server_pid ready=0

  for cache_dir in \
    "$REPO_ROOT/apps/professional-desktop/node_modules/.vite" \
    "$REPO_ROOT/apps/professional-desktop/node_modules/.vite-temp"; do
    if [ -d "$cache_dir" ]; then find "$cache_dir" -depth -delete; fi
  done

  # Follow Portless's normal HTTP-to-HTTPS redirect; the proxy returns 404 at
  # the HTTPS route when no app is registered, while a live app returns 200.
  if /usr/bin/curl -fsSL --max-time 1 \
    http://professional-desktop.beep.localhost:1355/ >/dev/null 2>&1; then
    echo "professional-desktop route is already active" >&2
    return 2
  fi

  start_ns=$("$MISE_NODE" -p 'process.hrtime.bigint().toString()')
  /usr/bin/setsid "$MISE_BUN" run --cwd apps/professional-desktop dev \
    >"$log" 2>&1 &
  server_pid=$!

  for _attempt in $(seq 1 480); do
    if /usr/bin/curl -fsSL --max-time 1 \
      http://professional-desktop.beep.localhost:1355/ >/dev/null 2>&1; then
      ready=1
      break
    fi
    if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
    sleep 0.25
  done

  end_ns=$("$MISE_NODE" -p 'process.hrtime.bigint().toString()')
  kill -TERM -- "-$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true

  if [ "$ready" -ne 1 ]; then
    echo "dev route did not become ready; see $log" >&2
    return 1
  fi

  elapsed_ms=$(( (end_ns - start_ns) / 1000000 ))
  printf '%s\t%s\n' "$label" "$elapsed_ms"
}

measure_dev_once smoke >"$RESULTS/dev-smoke.tsv"
: >"$RESULTS/dev-cold.tsv"
for run in $(seq 1 7); do
  measure_dev_once "$run" | tee -a "$RESULTS/dev-cold.tsv"
done
```

Primary metric: median milliseconds from process start to the first successful canonical-route response. Keep the seven server logs; they prove whether a moved median came from Vite dependency discovery, transform work, or an unrelated warning/retry. A failed readiness poll is a failed sample, not a slow numeric value.

### Metric C — cold Vitest startup

The selected file's test body is tiny compared with its imported graph. Clear the same bounded transform caches, use one fork worker, and disable file parallelism.

```bash
for run in $(seq 1 7); do
  for cache_dir in \
    "$REPO_ROOT/apps/professional-desktop/node_modules/.vite" \
    "$REPO_ROOT/apps/professional-desktop/node_modules/.vite-temp"; do
    if [ -d "$cache_dir" ]; then find "$cache_dir" -depth -delete; fi
  done
  (
    cd apps/professional-desktop
    /usr/bin/time -f 'wall_s=%e max_rss_kb=%M' \
      -o "$RESULTS/vitest-start-$run.time" \
      "$MISE_BUN" x --bun vitest run test/UsagePricing.test.ts \
        --pool=forks --maxWorkers=1 --no-file-parallelism --reporter=default \
        >"$RESULTS/vitest-start-$run.log" 2>&1
  )
done

"$MISE_BUN" run --cwd apps/professional-desktop beep:test \
  >"$RESULTS/package-test.log" 2>&1
```

Primary metric: process wall time. Secondary diagnostics: the Vitest summary's transform, setup, import, tests, and environment values. The package test is pass/fail only.

### Metric D — production build and bytes

Run five cold Vite builds. Clearing `dist` prevents stale chunks; clearing `.vite`/`.vite-temp` controls Vite's local cache without changing dependencies. The byte function sums only emitted JS/CSS assets and separately records the named Effect vendor chunk.

```bash
sum_bytes() {
  local codec=$1
  while IFS= read -r -d '' artifact; do
    case "$codec" in
      raw) stat -c '%s' "$artifact" ;;
      gzip) /usr/bin/gzip -9 -c "$artifact" | wc -c ;;
      # packet-editorial 2026-08-24: node zlib replaces the system brotli CLI,
      # which is not provisioned on all checkouts (review thread PRRT_kwDOPbO_N86bl-uu).
      brotli) "$MISE_NODE" -e 'const z=require("node:zlib");const c=[];process.stdin.on("data",(d)=>c.push(d)).on("end",()=>{console.log(z.brotliCompressSync(Buffer.concat(c),{params:{[z.constants.BROTLI_PARAM_QUALITY]:11}}).length)})' < "$artifact" ;;
    esac
  done | awk '{ total += $1 } END { print total + 0 }'
}

assets() {
  find apps/professional-desktop/dist/assets -type f \
    \( -name '*.js' -o -name '*.css' \) -print0 | sort -z
}

effect_assets() {
  find apps/professional-desktop/dist/assets -type f \
    -name 'effect-vendor-*.js' -print0 | sort -z
}

printf 'run\ttotal_raw\ttotal_gzip\ttotal_brotli\teffect_raw\teffect_gzip\teffect_brotli\n' \
  >"$RESULTS/bundle-bytes.tsv"
for run in $(seq 1 5); do
  for build_dir in \
    "$REPO_ROOT/apps/professional-desktop/dist" \
    "$REPO_ROOT/apps/professional-desktop/node_modules/.vite" \
    "$REPO_ROOT/apps/professional-desktop/node_modules/.vite-temp"; do
    if [ -d "$build_dir" ]; then find "$build_dir" -depth -delete; fi
  done

  /usr/bin/time -f 'wall_s=%e max_rss_kb=%M' \
    -o "$RESULTS/vite-build-$run.time" \
    "$MISE_BUN" run --cwd apps/professional-desktop beep:build \
    >"$RESULTS/vite-build-$run.log" 2>&1

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$run" \
    "$(assets | sum_bytes raw)" \
    "$(assets | sum_bytes gzip)" \
    "$(assets | sum_bytes brotli)" \
    "$(effect_assets | sum_bytes raw)" \
    "$(effect_assets | sum_bytes gzip)" \
    "$(effect_assets | sum_bytes brotli)" \
    | tee -a "$RESULTS/bundle-bytes.tsv"
done
```

Primary bundle regression guards: total gzip/Brotli JS+CSS and Effect-vendor gzip/Brotli bytes. Raw bytes and build wall time are secondary. The five byte rows should be identical within a state; nondeterminism must be explained before comparison.

### Variance summary

Use this exact summarizer for timing samples. It reports the sample count, median, MAD, and linearly interpolated IQR without discarding outliers.

```bash
stats() {
  "$MISE_BUN" -e '
    const xs = (await Bun.stdin.text()).trim().split(/\s+/).filter(Boolean)
      .map(Number).sort((a, b) => a - b)
    if (xs.length === 0) throw new Error("no samples")
    const q = (values, p) => {
      const i = (values.length - 1) * p
      const lo = Math.floor(i), hi = Math.ceil(i)
      return values[lo] + (values[hi] - values[lo]) * (i - lo)
    }
    const median = q(xs, 0.5)
    const deviations = xs.map((x) => Math.abs(x - median)).sort((a, b) => a - b)
    console.log(JSON.stringify({
      n: xs.length,
      median,
      mad: q(deviations, 0.5),
      q1: q(xs, 0.25),
      q3: q(xs, 0.75)
    }))
  '
}

sed -n 's/^wall_s=\([^ ]*\).*/\1/p' "$RESULTS"/tsgo-source-*.time | stats \
  | tee "$RESULTS/stats-tsgo-source.json"
sed -n 's/^wall_s=[^ ]* max_rss_kb=\([^ ]*\).*/\1/p' "$RESULTS"/tsgo-source-*.time | stats \
  | tee "$RESULTS/stats-tsgo-source-rss.json"
awk '/^Check time:/{sub(/s$/, "", $3); print $3}' "$RESULTS"/tsgo-source-*.log | stats \
  | tee "$RESULTS/stats-tsgo-check-time.json"
awk '/^Types:/{print $2}' "$RESULTS"/tsgo-source-*.log | stats \
  | tee "$RESULTS/stats-tsgo-types.json"
awk '/^Instantiations:/{print $2}' "$RESULTS"/tsgo-source-*.log | stats \
  | tee "$RESULTS/stats-tsgo-instantiations.json"
cut -f2 "$RESULTS/dev-cold.tsv" | stats \
  | tee "$RESULTS/stats-dev-cold.json"
sed -n 's/^wall_s=\([^ ]*\).*/\1/p' "$RESULTS"/vitest-start-*.time | stats \
  | tee "$RESULTS/stats-vitest-start.json"
sed -n 's/^wall_s=\([^ ]*\).*/\1/p' "$RESULTS"/vite-build-*.time | stats \
  | tee "$RESULTS/stats-vite-build.json"
```

For each metric, compute `delta % = 100 × (after median − before median) / before median`; negative timing/byte deltas are improvements. Treat a timing, RSS, `Types`, or `Instantiations` change as stable only when its magnitude is greater than both the threshold below and twice the larger state's relative MAD. If it misses that noise test, extend that metric to 15 runs in each state and recompute; never selectively add runs to only the preferred state.

Before accepting an extension, prove its first appended sample has the same
tracked source state, checkout path, toolchain, and exact `Files` count as that
state's original seven samples. A sibling worktree is not interchangeable when
its resolved compiler graph changes. Quarantine any mismatched attempt and
repeat it in the original checkout path; rejected samples never enter the
summary.

### Win, no-win, and stop rules

Correctness gates first: the complete package check, complete package test, production build, route smoke, and after-state import inventory must all pass. Any failure stops the mass migration.

A **decisive pilot win** requires at least one stable primary improvement and no stable primary regression:

- cold route readiness: at least **10% and 150 ms** faster;
- cold single-file Vitest startup: at least **10% and 100 ms** faster;
- source tsgo: at least **8% and 100 ms** faster, accompanied by at least a **5%** reduction in `Files`, `Types`, or `Instantiations` so scheduler noise alone cannot qualify it; or
- compressed production JS/CSS: at least **2%** smaller in both gzip and Brotli, with the same direction in the Effect-vendor chunk.

A **material regression** is a stable increase of at least 5% in route, Vitest, or tsgo time; at least 5% in source-program instantiations or maximum RSS; or at least 2% in both gzip and Brotli production bytes. A material regression stops the mass migration even if another metric wins, pending a documented cause and a new gate.

Classify the result as **no win** when every startup/typecheck median moves by less than 5% in absolute terms, all structural compiler counts move by less than 5%, and compressed bundle bytes move by less than 1%. Under this result, stop before mass migration and revisit the performance premise or choose a non-performance justification explicitly; consistency alone must not be recorded as a measured speed win.

Anything between these rules is **inconclusive**. Extend noisy metrics to 15 runs once. If it remains inconclusive, stop the mass migration; do not average it into a win and do not silently add the second-ranked workspace. Proceed to the phased package-family migration only on a decisive win with zero material regressions and all correctness gates green.

## CI cache-bust and batch cost

An import-only edit changes the default source inputs for the edited workspace's build, lint, check, test, and docgen tasks. Build, lint, and docgen also have dependency-task edges, so a low-level foundation edit fans through dependents; check depends on dependency builds. [turbo.json:33-38](../../../turbo.json) [turbo.json:68-79](../../../turbo.json) [turbo.json:91-110](../../../turbo.json) [turbo.json:227-231](../../../turbo.json) By contrast, editing a root global input such as `package.json` or a root tsconfig invalidates every task that consumes the global set. [turbo.json:8-17](../../../turbo.json) Migration PRs should therefore avoid incidental root-config churn.

Current read-only Turbo dry runs make the asymmetry concrete:

| Changed/selected workspace | Cold `check` graph selected by `--filter=...<workspace>` | Interpretation |
| --- | ---: | --- |
| `@beep/identity` | 232 tasks: 128 checks + 104 builds | Essentially the entire graph. |
| `@beep/utils` | 230 tasks: 126 checks + 104 builds | Essentially the entire graph. |
| `@beep/schema` | 228 tasks: 124 checks + 104 builds | Essentially the entire graph. |
| Professional Desktop | 65 tasks: 1 check + 64 dependency builds | With a warm remote cache, the dependency builds can hit and the app check is the main miss. |
| OIP Web | 13 tasks: 1 check + 12 dependency builds | Smallest app-shaped cold graph. |

These are selected-task counts, not claims that every task will miss on a normal warm-cache PR. They are reproducible without executing tasks:

```bash
MISE_SHIMS="$HOME/.local/share/mise/shims"
env TURBO_DAEMON=false PATH="$MISE_SHIMS:/usr/bin:/bin" \
  node_modules/.bin/turbo run check --filter='...@beep/schema' --dry-run=json \
  | jq '{tasks: (.tasks | length), checks: ([.tasks[] | select(.task == "check")] | length), builds: ([.tasks[] | select(.task == "build")] | length)}'
```

The local all-miss artifact gives a lower-bound machine reference: 230 attempted build/check tasks completed in 85.766 seconds, but that is neither a hosted-CI forecast nor a warm-cache batch time. [.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json:42-51](../../../.turbo/runs/3I2AnJLcKW9ZRmDOuHC4wVDf7dk.json) The latest recorded required-lane p95s are much larger: Lint 24.3 minutes, Lint Policy 20.6, Check 16.0, Test Unit 17.6, Docgen 13.4, and Coverage Regression 29.5. [goals/ci-lane-economics/research/placement-decision.md:22-34](../../../goals/ci-lane-economics/research/placement-decision.md) Those six p95 values total 121.4 runner-minutes as a conservative full-wave planning envelope; because lanes run concurrently and p95s are not additive probability estimates, 121.4 is not a predicted PR wall time. The critical-path envelope is about 29.5 minutes before queues and unrelated lanes.

A repo-wide one-shot rewrite would touch most of the roughly 1,829 files currently importing the Effect root plus foundation-root importers. It should be budgeted as one near-cold wave for every source-sensitive required lane. A normal consumer-family batch is cheaper: changed workspaces miss, while their unchanged dependency builds can reuse remote cache. A foundation batch is the expensive exception—the dry-run fan-out above predicts nearly a full check graph, and dependency-edged lint/docgen/build graphs have the same direction of travel.

Small source batches do not make every hosted lane proportionally short. The CI census found 96.9% task hits on a repeated integration graph, yet a Lint run with 127/131 hits still took 24.3 minutes because non-Turbo helpers dominate part of that lane; Docgen is recorded as non-Turbo in the placement decision. [goals/ci-lane-economics/research/cache-warm-lane-census.md:93-103](../../../goals/ci-lane-economics/research/cache-warm-lane-census.md) [goals/ci-lane-economics/research/placement-decision.md:26-31](../../../goals/ci-lane-economics/research/placement-decision.md) Batch sizing controls cache misses and review risk, but it cannot promise linear CI wall-time savings.

### Ordering that minimizes repeated misses

1. **Measure and decide on the Professional Desktop pilot with enforcement configuration held identical between states.** Mixing a global lint-rule edit into the after state would contaminate both timing and cache evidence.
2. **Introduce and freeze the warning rule once.** The repo's lint task hashes the policy-rule and policy-config trees globally, so this intentionally causes one broad lint-cache invalidation. Do not tune the global rule between migration batches. [turbo.json:68-79](../../../turbo.json)
3. **Migrate the foundation kernel in one family batch:** `@beep/identity`, `@beep/utils`, `@beep/schema`, and the other in-scope foundation siblings together. Three separate PRs for identity, utils, and schema would select almost the entire check graph three times; one coherent foundation PR pays that downstream fan-out once.
4. **Migrate each vertical package family as a unit.** Keep a domain/tables/use-cases/server/client/UI family together where practical. Splitting adjacent layers across PRs repeatedly invalidates the same downstream composition roots.
5. **Migrate remaining standalone tools, tests, and apps in outer batches, with application composition roots last.** Dependency-family PRs may already rebuild an app through dependency edges; saving the app's own import edit for its final batch avoids changing it in several migration PRs.
6. **Flip warn to error exactly once after the live inventory reaches zero.** This is the second unavoidable broad lint-cache invalidation. Keep that PR enforcement-only except for final violations, so a failure is attributable.

For every proposed batch, run `turbo ... --dry-run=json` with dependent filters for its lowest-level changed workspaces and record selected build/check counts before opening the PR. Treat a foundation-shaped count near 230 as a full-wave CI budget; treat a consumer-family count as a bounded miss set, while remembering that global helpers still set a floor on hosted lane duration.

## Recommendation

Use Professional Desktop as the sole pilot. Its production bundle is expected to be neutral, and that neutrality is informative rather than a failure if cold route, test startup, or compiler work moves decisively. Apply the gate literally: **proceed only on a stable win with no material regression; stop on no-win, unresolved variance, or correctness failure.** If the gate passes, land one combined foundation-kernel batch before vertical consumer families, freeze the warning rule during those batches, and make the error flip the final enforcement-only ratchet.
