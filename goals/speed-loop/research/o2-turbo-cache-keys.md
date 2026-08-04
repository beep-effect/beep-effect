# Opportunity 2 — Turbo cache-key audit

## Executive verdict

The 24.0% fleet hit rate is real (3,845 HIT / 16,007 executions), but broad
`turbo.json` inputs are not the dominant explanation. Grouping the TSV by
`clone + timestamp`, 121 of 187 groups are **0% HIT** and those groups contain
11,380 of 12,162 misses (93.6%). Four adjacent clone39 family sweeps show the
signature directly: 116/116 test, lint, check, and build tasks all miss
(`goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv:5987-6450`).
That signature is consistent with a global-key bust, force, or an absent/cold
cache; the TSV cannot distinguish them. The repo has two concrete force
mechanisms that must be separated before assigning all those misses to inputs:

1. CI explicitly prepends `--force` unless cache control was supplied
   (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:498-504`).
2. Yeet sets `TURBO_FORCE=true` for feedback/full steps whenever `bun.lock`
   differs from the base (`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:833-840`,
   `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:584-592`).

Therefore the safe input-tightening below should remove false invalidations,
but **will not by itself double the observed fleet hit rate**. It should move
24% to roughly **27–32%** on the historical mix. Reaching ~48% requires making
at least ~3,845 additional executions reusable; that means recovering about
one third of the all-miss/forced-or-cold population as well as tightening keys.
On a byte-identical warm sweep, input tightening has zero theoretical benefit:
the existing inputs have not changed, so a miss there is force, disabled/read-
only cache, absent cache state, or an output/correctness problem.

The measurement is an anonymized scan of 49 checkouts, 199 retained summaries,
and 16,007 task executions from 11 clones
(`goals/quality-speedup/research/quality-time-inventory.md:7-14`). The TSV does
not retain command flags, task hashes, cache backend, commit SHA, or per-input
hash deltas, so the force/cold split cannot be proved row-by-row; the report
correctly calls the missing Turbo-to-Yeet join an instrument gap
(`goals/quality-speedup/research/quality-time-inventory.md:27-35`).

## Ranked findings

### 1. Forced/cold summary groups dominate the misses (highest impact, high confidence)

Across the TSV, cacheable-family rates are: build 987/3,894 = 25.3%, check
933/3,803 = 24.5%, lint 778/3,487 = 22.3%, and test 463/3,100 = 14.9%.
Those four families contribute 11,123 of 12,162 misses. The expensive tail is
concentrated in tests: `@beep/repo-cli#test` repeatedly costs about 77–114s
when missed (`goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv:727`,
`goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv:1352`,
`goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv:1856`), while the same task is effectively free on a hit
(`goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv:120`). The existing inventory reaches
the same ranking and calls out repo-cli test, OIP build, Storybook build, and
the 12–30% long tail
(`goals/quality-speedup/research/quality-time-inventory.md:95-101`).

This is why a `turbo.json`-only claim of “double the hit rate” would be an
over-promise. `coverage`, `lint:fix`, and `test:integration` are explicitly
uncached (`turbo.json:82-90`, `turbo.json:125-155`), and forced sweeps cannot hit even
for the cacheable families.

### 2. Six root files are injected into every task; four are needlessly global (high impact, high confidence)

`futureFlags.globalConfiguration` is enabled, so `global.inputs` is prepended
to every task (`turbo.json:3-17`). The current set is:

| Input | Classification | Correct scope / finding |
| --- | --- | --- |
| `.bun-version` | repo-global; very low churn | Keep global. Bun executes the package scripts, so runtime version can affect every result. |
| `.nvmrc` | repo-global; low churn; unnecessary | Remove. Turbo tasks are entered through Bun/bunx; the Node selector does not describe the executing runtime. |
| root `package.json` | repo-global; **churn-prone**; unnecessary as a file input for package tasks | Remove from `global.inputs`. It changed in 131/863 commits over the fleet interval (local `git rev-list` census). Package-local `package.json` remains in `$TURBO_DEFAULT$`, while resolved external dependencies and the lockfile remain implicit Turbo hash inputs. Root scripts merely delegate to the CLI/Turbo (`package.json:363-437`). |
| root `tsconfig.json` | repo-global; **churn-prone**; unnecessary for most families | Remove globally, then add only to Vitest-backed tasks and the Storybook check. It changed in 95/863 commits. Vitest really reads its aliases (`vitest.shared.ts:16-18`, `vitest.shared.ts:72-103`); generic build/check/lint tasks do not all read the root aggregate. |
| `tsconfig.base.json` | repo-global; low churn; correctness-critical | Keep global. Package TS configs extend it directly (for example `apps/professional-desktop/tsconfig.json:1-3`), and it controls emit, incremental artifacts, module mode, JSX, and diagnostics (`tsconfig.base.json:4-45`). |
| `tsconfig.packages.json` | repo-global; **churn-prone**; unnecessary for package tasks | Remove globally. It is the root reference inventory (`tsconfig.packages.json:7-100`), not an input read by each package's own `tsgo -b tsconfig.json` / `tsc -b tsconfig.json`. It changed in 45/863 commits. |

Two implicit all-task inputs cannot be tightened in `inputs`: `turbo.json`
itself and dependency/lockfile state. The repo already observes that touching
`turbo.json` or the lockfile escalates bounded proof to full
(`goals/quality-speedup/history/reflections/2026-08-04-claude.md:94-100`).
The lockfile changed in 198/863 commits in the same local census, and the Yeet
policy turns every such branch into forced sweeps until base catches up. That
is a much larger practical bust source than any individual explicit glob.

### 3. Cross-workspace Storybook globs invalidate unrelated packages (high impact, high confidence)

Every package's `lint`, `check`, and `audit` hashes every UI story; `lint` also
hashes the central policy rule/config trees (`turbo.json:69-80`,
`turbo.json:92-103`, `turbo.json:162-205`). UI-system changed in 97/863 commits
over the measured interval.
This is correct only for consumers that actually cross the package boundary:

- `@beep/storybook#lint` explicitly lints `../../packages/.../stories/`, and
  its check compiles `tsconfig.stories.json`
  (`apps/storybook/package.json:15-20`).
- `@beep/professional-desktop#check` deliberately has package-local Turbo
  overrides for all UI stories and db-admin drizzle
  (`apps/professional-desktop/turbo.json:3-12`). Preserve that exception.
- An arbitrary package such as `@beep/acp` neither lints nor compiles all UI
  stories; putting the glob in the root task makes every story edit invalidate
  its lint/check anyway.

Move the story input from the root `lint`/`check` tasks to the Storybook package
configuration. Keep the policy-pack rule/config globs on lint: those are only
2–3 commits in the interval and can change lint semantics. `biome.jsonc` is
also a valid global lint input (`turbo.json:72-79`).

### 4. `$TURBO_DEFAULT$` makes each task hash unrelated files inside its own package (medium impact, high confidence)

Every cacheable task starts with `$TURBO_DEFAULT$` (`turbo.json:34-210`). That
means a package's `README.md`, `CHANGELOG.md`, `LICENSE`, `AGENTS.md`, tests,
stories, and source all invalidate build/check/lint/test together even when a
command reads only a subset. This is package-local rather than fleet-global,
but it is churn-prone on feature PRs.

Do **not** replace defaults with narrow positive allowlists in the first diff:
package scripts vary, code generators read non-obvious files, and missing one
would create a stale hit. A later low-risk phase can add only proven negative
globs (`!CHANGELOG.md`, `!LICENSE`, agent instructions) task by task. Do not
exclude `README.md` from docgen: its own proof manifest explicitly hashes
README, package metadata, docgen config, sources, and TS configs
(`packages/tooling/tool/docgen/src/ProofManifest.ts:308-318`).

### 5. Environment hashing is over-global in two places and under-declared in one (medium impact; correctness first)

The global hash includes `BEEP_ESLINT_PROFILE` and `VITE_COSMOS_SPIKE` for
**every** task (`turbo.json:18`). Only ESLint configuration reads the first
(`eslint.config.mjs:5-19`), while professional-desktop reads multiple Vite
spike variables, including `VITE_GRAPH3D_SPIKE` and
`VITE_COSMOS_SPIKE_SIZE` (`apps/professional-desktop/src/App.tsx:200-211`,
`apps/professional-desktop/src/spikes/CosmosSpike.tsx:202-207`). Move the ESLint
profile to lint/audit. Let Vite framework inference hash `VITE_*` for Vite
builds, or explicitly put `VITE_*` on build/audit; one global Vite variable is
both too broad and incomplete.

`TURBO_TOKEN`, `TURBO_TEAM`, `PORTLESS_*`, `AWS_*`, and the other operational
values are global `passThroughEnv`, so their values do **not** change task
hashes (`turbo.json:19-31`). That is correct for cache credentials and dev
routing, but any pass-through value that changes generated output is a cache-
poisoning risk. Current task code specifically scrubs unresolved Turbo secret
references and forces only the UI renderer
(`packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts:234-283`); neither
changes task output.

There is a separate correctness hole: ordinary `test`, integration, coverage,
and audit include `vitest.shared.ts` but not `vitest.setup.ts`
(`turbo.json:105-155`, `turbo.json:162-190`). The shared config points at that setup file
(`vitest.shared.ts:150-172`), and the setup changes test behavior, including
FastCheck runs/seeds (`vitest.setup.ts:57-79`). Add it even though that creates
some additional legitimate misses. Cache hit rate is not worth stale green
tests.

### 6. Local and CI do not generally hash differently, but they intentionally do not share useful cache today (medium impact)

No `envMode` is configured, so Turbo's strict default applies. `TURBO_*` cache
selection/UI/SCM variables are Turbo controls, not ordinary hashed task env;
token/team are explicitly pass-through. For build, declared secrets and
framework-inferred public env correctly produce different hashes when values
differ (`turbo.json:34-53`). `audit` explicitly hashes `CI`, so local and CI
audit are intentionally separate (`turbo.json:173-190`). Check/lint/test should
otherwise hash identically for the same source, dependencies, declared env,
and Turbo version.

There is no evidence here of cross-mode cache poisoning through `envMode`.
Instead, CI bypasses reads with `--force`, PR jobs select local cache while push
jobs receive remote credentials (`.github/workflows/check.yml:108-121`), and
the property lane invokes Turbo with a deterministic run count/seed
(`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:864-875`). The practical
problem is prevented reuse, not local/CI hash collision. Keep strict mode
explicit in the proposed diff so a later CLI flag cannot silently loosen it.

## Task-by-task input/output/env audit

`R` = repo-global; `C` = churn-prone; `U` = unnecessary at that scope.
Implicit `turbo.json` and lockfile/dependency hashing applies to every cached
task and is omitted from each row.

| Task | Explicit inputs and classification | Outputs/cache/env assessment |
| --- | --- | --- |
| `build` | default package tree (`C`, partly `U`); root `.env*` (`R,C,U` for most packages; it also matches `.env.example`/`.envrc`) | Cached; union output list is broad but does not enlarge the key. Env list is intentionally broad; prefer `VITE_*`/framework inference over one global Vite flag (`turbo.json:34-67`). |
| `lint` | default (`C`, partly `U`); `biome.jsonc` (`R`, necessary); policy rules/configs (`R`, necessary); all UI stories (`R,C,U` except Storybook) | Cached; `^lint` gives dependency invalidation but serializes the family. Root TS configs are already excluded (`turbo.json:69-80`). |
| `lint:fix` | default (`C`, partly `U`); Biome config (`R`, necessary) | `cache:false`; inputs do not affect reuse and can be omitted for clarity (`turbo.json:82-90`). |
| `check` | default (`C`, partly `U`); all UI stories (`R,C,U` except scoped consumers) | Cached; emits dist/tsbuildinfo. Keep `tsconfig.base.json`; localize story glob (`turbo.json:92-103`). |
| `test` | default (`C`, partly `U`); `vitest.shared.ts` (`R`, necessary) | Cached log/result, no file outputs. Add root `tsconfig.json` and `vitest.setup.ts`; pass-through summary/fixture-file paths do not hash (`turbo.json:105-115`). |
| `test:property` | default; shared + setup (`R`, necessary) | Cached; seed/run env is correctly hashed (`turbo.json:116-124`). Add root `tsconfig.json` because shared reads aliases. |
| `test:integration` | default; shared (`R`, necessary) | `cache:false`, so input precision does not improve hits. Env is appropriately task-local; add setup only for semantic documentation/future caching (`turbo.json:125-140`). |
| `coverage` | default; shared (`R`, necessary) | `cache:false`; coverage output declared. Add setup/root tsconfig for correctness if caching is ever enabled (`turbo.json:141-155`). |
| `codegen` | default (`C`, appropriate because generators vary) | `cache:false`; `^codegen`; no cache opportunity (`turbo.json:157-160`). |
| `audit` | default plus Biome/shared/root env/all stories (`R,C`, broad; story and root env globs `U` for most packages) | Cached composite task with very broad outputs/env and `CI` hash split. Tighten only after checking each package's `beep:audit` composition (`turbo.json:162-205`; Storybook example at `apps/storybook/package.json:15-20`). |
| `docgen` | default (`C`, mostly necessary; README/package/docgen/TS configs are read) | Cached; docs and proof outputs are declared (`turbo.json:207-211`). No aggressive narrowing. |
| `dev`, `storybook`, `storybook:start` | default/none | Persistent and uncached; no hit-rate relevance (`turbo.json:213-220`, `turbo.json:234-237`). |
| `storybook:build` | default; Storybook config/vitest files; all UI src/stories (`R,C`) | Cached. External UI source/stories are necessary; explicit app-local config/vitest paths are redundant with default, and Vitest config/setup are not inputs to `storybook build` (`turbo.json:222-232`, `apps/storybook/package.json:27-31`). |
| `test:storybook` | same broad Storybook inputs | `cache:false`; input tuning cannot improve hits (`turbo.json:239-249`). |

Package overrides matter: professional-desktop intentionally replaces check
inputs with default + UI stories + db-admin drizzle
(`apps/professional-desktop/turbo.json:3-12`); Storybook adds check dependencies
(`apps/storybook/turbo.json:3-11`); infra correctly declares no build outputs
(`infra/turbo.json:1-7`).

## Minimal proposed diff sketch

This is deliberately conservative: remove only clearly mis-scoped global
inputs/env, localize Storybook's cross-workspace dependency, and close the
Vitest correctness hole. It does not attempt per-package positive allowlists.

```diff
diff --git a/turbo.json b/turbo.json
@@
   "global": {
     "ui": "tui",
+    "envMode": "strict",
     "inputs": [
       ".bun-version",
-      ".nvmrc",
-      "package.json",
-      "tsconfig.json",
-      "tsconfig.base.json",
-      "tsconfig.packages.json"
+      "tsconfig.base.json"
     ],
-    "env": ["BEEP_ESLINT_PROFILE", "VITE_COSMOS_SPIKE"],
+    "env": [],
@@
     "build": {
       "inputs": [
         "$TURBO_DEFAULT$",
-        "$TURBO_ROOT$/.env*",
         "!.beep/**"
       ],
@@
       "env": [
+        "VITE_*",
         "APP_ADMINS_EMAILS",
@@
     "lint": {
+      "env": ["BEEP_ESLINT_PROFILE"],
       "inputs": [
         "$TURBO_DEFAULT$",
         "$TURBO_ROOT$/biome.jsonc",
         "$TURBO_ROOT$/packages/tooling/policy-pack/lint-rules/rules/**",
         "$TURBO_ROOT$/packages/tooling/policy-pack/lint-rules/configs/**",
-        "$TURBO_ROOT$/packages/foundation/ui-system/*/stories/**",
         "!$TURBO_ROOT$/tsconfig*.json",
@@
     "check": {
       "inputs": [
         "$TURBO_DEFAULT$",
-        "$TURBO_ROOT$/packages/foundation/ui-system/*/stories/**",
         "!.beep/**"
@@
     "test": {
@@
         "$TURBO_DEFAULT$",
+        "$TURBO_ROOT$/tsconfig.json",
         "$TURBO_ROOT$/vitest.shared.ts",
+        "$TURBO_ROOT$/vitest.setup.ts",
@@
     "test:property": {
@@
         "$TURBO_DEFAULT$",
+        "$TURBO_ROOT$/tsconfig.json",
         "$TURBO_ROOT$/vitest.shared.ts",
@@
     "test:integration": {
@@
+        "$TURBO_ROOT$/tsconfig.json",
         "$TURBO_ROOT$/vitest.shared.ts",
+        "$TURBO_ROOT$/vitest.setup.ts",
@@
     "coverage": {
@@
+        "$TURBO_ROOT$/tsconfig.json",
         "$TURBO_ROOT$/vitest.shared.ts",
+        "$TURBO_ROOT$/vitest.setup.ts",
@@
     "audit": {
@@
-        "$TURBO_ROOT$/.env*",
-        "$TURBO_ROOT$/packages/foundation/ui-system/*/stories/**",
@@
       "env": [
+        "BEEP_ESLINT_PROFILE",
+        "VITE_*",
@@
     "storybook:build": {
       "inputs": [
         "$TURBO_DEFAULT$",
-        "$TURBO_ROOT$/apps/storybook/.storybook/**",
-        "$TURBO_ROOT$/apps/storybook/vitest.storybook.config.ts",
-        "$TURBO_ROOT$/apps/storybook/vitest.storybook.setup.ts",
         "$TURBO_ROOT$/packages/foundation/ui-system/*/src/**",
         "$TURBO_ROOT$/packages/foundation/ui-system/*/stories/**"
       ],
```

```diff
diff --git a/apps/storybook/turbo.json b/apps/storybook/turbo.json
@@
     "check": {
       "dependsOn": [
         "$TURBO_EXTENDS$",
         "@beep/dock-react#check",
         "@beep/editor#check"
-      ]
+      ],
+      "inputs": [
+        "$TURBO_EXTENDS$",
+        "$TURBO_ROOT$/tsconfig.json",
+        "$TURBO_ROOT$/packages/foundation/ui-system/*/stories/**"
+      ]
+    },
+    "lint": {
+      "inputs": [
+        "$TURBO_EXTENDS$",
+        "$TURBO_ROOT$/tsconfig.json",
+        "$TURBO_ROOT$/packages/foundation/ui-system/*/stories/**"
+      ]
     }
```

Before landing, confirm the installed Turbo schema accepts
`global.envMode` and `$TURBO_EXTENDS$` in package task `inputs`; both are
expected under the enabled global-configuration/package-extension model. If
the latter is rejected, spell the inherited root input list out in this one
package rather than moving stories back to every package.

### Risk notes

- Removing root `package.json`: stale risk if a package task reads the root
  manifest directly or if a root catalog edit is made without its corresponding
  lockfile update. Probe both; the lockfile must remain hashed.
- Removing `.nvmrc`: stale risk only if a Turbo task shells out to Node selected
  from `.nvmrc` rather than the Bun-pinned runtime. A static script scan plus a
  deliberate edit probe should prove this.
- Removing root aggregate TS configs: stale risk for Vitest aliases and
  Storybook story compilation; the diff adds those consumers explicitly.
- Removing root `.env*`: stale risk if a build reads a root dotenv file without
  exposing the consumed value through declared/framework-inferred env. Compare
  `--dry=json` inferred/configured env for every deployable app first. Exact
  env declarations are safer than a glob that also hashes `.env.example` and
  `.envrc`.
- Moving story globs: stale risk if another package command reaches outside its
  package into UI stories. Static package-script search currently identifies
  Storybook, while professional-desktop already carries its own exception.
- Adding Vitest setup/root TS config: no stale risk; it intentionally lowers
  hits when test semantics or aliases change.
- Moving global env: stale risk if ESLint profile or Vite flags affect another
  family. The source reads above support task-local placement; `--dry=json`
  must confirm Vite inference before deleting explicit names.

## Cost and expected improvement

Doubling the four headline families at their observed mix means 3,161
additional hits (987 build + 933 check + 778 lint + 463 test). Multiplying by
each family's observed mean miss duration yields about **96 aggregate task-
minutes** saved across the full fleet: 13.6 build, 13.6 check, 36.0 lint, and
33.1 test. Spread across the 199 retained summaries, that is only ~29 seconds
of summed task time per summary, and wall time is smaller when tasks run in
parallel. The benefit is lumpy: avoiding a repo-cli test miss alone saves
roughly 1.5–2 minutes; avoiding many sub-second package misses barely moves
wall time. The TSV's task duration is explicitly not wall time
(`goals/quality-speedup/research/quality-time-inventory.md:95-101`).

Expected effects:

- **Byte-identical warm repeat:** 0 additional hits from input tightening. If
  it misses, fix force/cache persistence first.
- **Warm sweep after an unrelated root manifest/root aggregate-tsconfig/story
  edit:** tens to hundreds of false misses avoided; commonly <1 minute wall,
  occasionally 1–3 minutes when a critical repo-cli/app task is spared.
- **Historical fleet mix:** estimated +3 to +8 percentage points (24% →
  27–32%), not 48%, because 93.6% of misses sit in all-zero groups.
- **True ~48% fleet target:** in addition to the diff, retain `execution.command`,
  task hash/global hash, `TURBO_FORCE`, cache backend/read-write mode, commit SHA,
  and Yeet run id in the fleet instrument; then replace blanket lockfile force
  with a proved dependency-install invariant or narrower force scope. Do not
  relax the force policy from this audit alone.

## Verification plan — deliberate edit probes

Run in a disposable clean worktree with a dedicated local cache; record
`turbo run <task> --dry=json` before/after hashes and real `--summarize` runs
for output restoration. No probe is accepted merely because the command exits
zero.

1. **Baseline/cache capability.** Run each selected task twice with no edits.
   The second run must HIT. Repeat once with `TURBO_FORCE=true`; it must MISS.
   This separates key problems from force/backend problems.
2. **Root manifest isolation.** Make a semantics-free root `package.json`
   description edit. Representative package build/check/lint/test hashes must
   stay stable. Then change a dependency plus `bun.lock`; dependency-sensitive
   hashes must change. A manifest dependency edit without lockfile update must
   be rejected by install/quality policy, not silently blessed.
3. **TS config fan-out.** Toggle a harmless compiler option in
   `tsconfig.base.json`: build/check/test/docgen must change. Toggle only a root
   `paths` alias in `tsconfig.json`: test/property/integration/coverage and
   Storybook check must change; unrelated package build/lint should not.
   Reorder one root reference in `tsconfig.packages.json`: individual package
   task hashes should remain stable while the root aggregate check's own proof
   still notices the edit.
4. **Story localization.** Edit one UI story. Storybook lint/check/build and the
   retained professional-desktop check exception must invalidate. An unrelated
   `@beep/acp` lint/check must HIT.
5. **Lint policy.** Edit `biome.jsonc`, then one policy rule and one policy
   config. Lint (and audit if kept cached) must invalidate; check/test/build
   must remain stable.
6. **Vitest semantics.** Edit `vitest.shared.ts`, `vitest.setup.ts`, and a root
   alias separately. All four Vitest-backed families must invalidate. Build and
   lint must remain stable. This specifically closes the current stale-hit hole.
7. **Environment matrix.** Compare unset/value-A/value-B for
   `BEEP_ESLINT_PROFILE`: only lint/audit hashes change. Do the same for
   `VITE_COSMOS_SPIKE_SIZE` and `VITE_GRAPH3D_SPIKE`: only applicable Vite
   build/audit hashes change. Change `TURBO_TOKEN`, `TURBO_TEAM`, `TURBO_UI`,
   and `TURBO_CACHE`: task hashes must remain stable while backend/UI behavior
   may change. Run once locally and once with `CI=true`; deterministic
   check/lint/test hashes should match, audit should differ by design.
8. **Dotenv probe.** Change `.env.example` and `.envrc`: no build hash should
   change. Change an actually consumed app env value through the environment:
   its build hash must change. If any app loads root `.env` directly, add that
   exact file only to that package's build inputs.
9. **Outputs/restoration.** For one TS library, one Vite app, and Storybook,
   populate cache, remove only the disposable worktree's declared output, and
   rerun. Turbo must restore every required output. This validates that the
   broad output unions at `turbo.json:54-67` and `turbo.json:222-232` are sufficient;
   input correctness alone is not enough.
10. **Fleet canary.** For 20 unforced local summaries, report hit rate by task
    family and separately count zero-hit/forced/cold groups. Success criterion:
    organic adjacent-edit hit rate improves without any failed invalidation
    probe. Do not judge the diff against CI forced runs.

## Decision

Land the conservative input/env localization only after the probes pass, but
do not sell it as the doubling lever. The shortest path to a defensible 2× is:
(1) add the missing force/backend/hash instrumentation, (2) land the safe key
tightening, (3) measure organic versus forced/cold misses, and only then (4)
challenge blanket lockfile forcing with an install-correctness proof. The repo's
own quality report says warm local verify is 9–17 minutes and classifies cache
misses as duplicated work
(`goals/quality-speedup/research/quality-time-inventory.md:134-143`); the proposed
change removes a portion of that duplication without weakening correctness.
