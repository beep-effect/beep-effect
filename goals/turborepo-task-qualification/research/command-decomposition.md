# Command decomposition: current static boundary review

Observed 2026-09-09 UTC. This is a source and manifest classification, with
all runtime purity and capture claims still unassessed. The exact strings and
membership are in [command-groups.json](./command-groups.json). The current
population is 1,503 executable configured scripts represented by 40 top-level
command strings, 65 distinct `beep:*` wrapper definitions, and 70 root scripts.
Recreate the groups with `python3 goals/turborepo-task-qualification/research/refresh-command-groups.py .beep/cache-census-governance.json` after collecting that census.
The 1,337 graph-only nodes are excluded from executable membership.

## Boundaries requiring distinct experiments

| Computation boundary | Observed nested behavior | Qualification implication |
| --- | --- | --- |
| Package lint | `bun run beep:lint` reaches Biome; 135 wrapper definitions use `biome check .`. Other packages narrow paths or use shell and Git root expansion. | Source/config/Grit/VCS-ignore, runtime, root paths, logs and timing need independent observation. Only identity is the current pilot. |
| Lint fix | Biome adds `--write`; root lint also has a fix mode. | Source mutation requires fresh execution; a read-only check is a separate computation. |
| Build | TypeScript/Babel, Vite, Next, Storybook; one wrapper runs codegen first. | Generated files, compiler build info, absolute paths, framework environment and output-tree capture cannot be inferred from a build label. |
| Check | `tsgo` may chain test/script/story typechecks, `tsc`, `ai-sync check`, codegen checks or migration checks. | Keep nested commands in the contract; evaluate emission settings, repository/config inputs and any cross-workspace reads. |
| Unit/property tests | Vitest wrappers vary exclusions/config, may call Lambda tests or Python tooling. | Test code can use network, clocks, randomness, services and writes. Property seed/run count are semantic input candidates. Generic test-name classification proves no purity. |
| Integration tests | Vitest includes service tests, Testcontainers settings, desktop sidecar build/IPC and Python dependencies. | Require explicit service/secret/process ownership and fresh external verdicts; seek a narrower pure prerequisite. |
| Coverage | Vitest coverage varies included suites and exclusions. | Coverage trees and aggregate publication remain distinct from pure individual test results. |
| Package audit | Composite wrappers include build/check/test/integration/lint, sometimes generate, policy and docgen. | Inherit the union of child obligations. Do not qualify a composite because one child lint is deterministic. |
| Docgen/doctest | Standalone docgen binary or repository docgen driver; root docgen has full and bounded modes. | Generated docs, source mutation, Markdown rendering, code examples and package selection need separate input/output contracts. |
| Codegen | Generator scripts, migration sync with `--write`, snapshot scripts, CLI codegen; 26 placeholder echo commands also have real scripts. | Mutators stay fresh. Placeholders execute a log-only command and are low-value; they are not phantom absent scripts. |
| Development/browser services | Portless wraps watch, Next, Vite, Storybook and previews. | Persistent/service behavior is ineligible at this boundary. A finite build prerequisite is a different candidate. |
| Package test typecheck | `beep-cli quality test-tsgo-package`. | Keep scheduler, proof receipt and compiler work separate; do not replace the existing proof owner with a task-cache label. |

## CI, Quality and Yeet dispatch

[entrypoint-plans.json](./entrypoint-plans.json) captures the current pure
planner output for all 23 replayable CI identifiers under three option sets
(full; affected/summary/envelope; no-docgen/last-commit), plus all nine Quality
mode plans. It also preserves all 25 CI descriptors without treating their
hand-maintained required flag as hosted authority. These are 69 CI variant
plans, not 69 executed experiments. The recipe is
[refresh-entrypoint-plans.ts](./refresh-entrypoint-plans.ts). It uses `/repo`
as a portable placeholder and never launches the planned subprocesses.

The [v2 dynamic review](./dynamic-entrypoints.md) adds a clean hosted-context
snapshot, retains each step's environment through the existing schema, and
records partition, local-dispatch and documentation-selection branches. The
original environment omission has been repaired. Both snapshots retain their
source-only authority; dynamic runtime selection still requires observation.

Live `CiLane.ts` confirms the following distinctions:

- Lint dispatches the package Turbo graph directly. Required Lint Policy uses
  `beep lint policy --full`, a separate repository battery.
- Property dispatch explicitly supplies seed/run settings. Check concurrency
  may depend on admission state, which needs an orchestration-invariance test.
- Codegen checks include desktop migration data without a package dependency
  edge. Ecosystem runs type tests and a bundle probe; desktop IPC builds and
  exercises a sidecar. Those commands cannot be reconstructed from generic
  Turbo task names alone.
- JSDoc first writes inventory artifacts, then applies the ratchet. Fallow
  writes reports/envelopes. Coverage and docs have their own output surfaces.
- Commitlint depends on the selected Git range or last commit. Repository
  sanity includes manifest/config checks and a live dependency audit. Nix
  evaluates all systems and a development shell. Security/SAST/secrets
  dispatch through their own external Quality lanes. Their verdicts stay fresh.
- Quality's cheap-gate plan now invokes `quality cache-policy`. Yeet's
  `proofLanesForTier` consumes that plan for its cheap-gates tier. Existing
  lane proof, full-proof and hosted status authorities are unchanged.

The current gate is wired into the local/Yeet cheap-gate route and the hosted
repository-sanity plan. `check.yml` runs `ci lane repo-sanity`, which dispatches
the repository-sanity audit plan containing `repo-sanity:cache-policy`.
Quality and Yeet planner regressions cover the route. A successful required
hosted execution still belongs to the final implementation PR's acceptance.

## Remaining inventory obligations

The planner snapshots do not cover dynamic partition resolution, changed-file
selection, every ambient option, shell expansion, or actual nested subprocess
reads/writes. Workflow actions, remote reusable workflow revisions and the two
CI-native checks remain source-owned boundaries requiring their own current
review. The source inventory retains 106 CI/Quality/Yeet/workflow files. P0
remains in progress until those mappings and per-computation semantic classes
are integrated into the operational census and outstanding cases are explicit.

No row is qualified by this review. After the identity-lint exclusion, 927 cached executable
computations remain unassessed. At least one real computation must still pass
the complete local, shadow and signed-remote protocol before this goal closes.

## Resumed manifest boundary review (2026-09-11)

The refreshed census contains 1,892 executable computations and 1,377 graph-only
nodes across 143 workspaces. Its entrypoint inventory now includes 125 files,
including Cache's execution boundary. These numbers supersede the historical
population above; they do not supersede its unresolved semantic obligations.
The runtime enforcement receipt binds the census, exact command groups, local
alias expansion and selected nested manifest definitions by SHA-256.

Review of all 76 command strings after exact local `bun run beep:*` expansion
identifies the following boundaries. Counts below describe manifest definitions,
not independent executions or qualified tuples.

| Boundary | Current manifest evidence | Qualification implication |
| --- | --- | --- |
| Composite audits | 140 `beep:audit` definitions; 79 include integration tests, 50 use the basic build/check/test/lint chain, and 11 have additional variants | Resolve each invoked script in its own workspace. A cached audit must account for every nested computation and its outputs. |
| Generation within audits | Four audits invoke `generate` before build; six workspaces map `generate` to `scripts/generate.ts` | Inventory generator inputs, writes and any external reads before treating the enclosing audit as reusable. |
| Compiled output rewriting | 117 Babel definitions rewrite `dist` and source maps after TypeScript emission | Both producer stages and generated files belong to the computation boundary. |
| Nested typechecking | Test, scripts, stories, examples and type-test scripts use distinct configurations; stories use `tsc`, while most checks use `tsgo` | Compiler identity and all selected configurations must be included; the root check configuration alone is insufficient. |
| Nested dependency installation | `@beep/infra`'s `test:lambda` changes into `lambda/turbo-cache`, installs with a frozen lockfile, then runs typecheck, tests, bundle and ZIP checks | Review the nested lockfile, installation behavior, directory change and bundle/ZIP artifacts separately. Frozen lockfile syntax does not prove offline or deterministic execution. |
| Cross-workspace file selection | Storybook lint expands the Git repository root and a UI stories glob through `sh -c` | File membership depends on shell expansion and checkout layout, beyond the Storybook workspace manifest. |
| Source mutation | Biome `--write`, barrel codegen, migration synchronization and allowlist generation appear explicitly | Keep mutation and validation boundaries distinct; inspect actual writes before any reuse decision. |
| Persistent services | Portless commands start watch, Next, Vite, Storybook or preview processes | Their service lifetime requires explicit policy; a finite successful-task cache contract is not established. |
| Tests and build tools | Vitest, coverage, integration configurations, Next, Vite and Storybook builds remain terminal commands in this manifest review | Test/configuration source, environment, clock, randomness, network/service dependencies and output/log behavior still need evidence. |

The 140 top-level `bun run --if-present beep:audit` commands were outside the
earlier narrow alias-expansion rule. Their workspace definitions were inspected
explicitly here. Compound shell execution, optional-script semantics and nested
external tools have not been interpreted by that alias recipe. The selected
manifest evidence is retained privately as
`runtime-nested-manifest-boundaries.json`; the public runtime boundary receipt
records its hash. This review grants no qualification and does not claim a
complete transitive interpreter/source inventory.
