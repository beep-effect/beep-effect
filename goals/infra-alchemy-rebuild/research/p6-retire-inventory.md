# P6 Retire: inventory and deletion plan

Read-only analysis for phase P6 of `goals/infra-alchemy-rebuild` (delete `infra/`, Pulumi, the
TypeScript 6 pin and the root `postinstall` hook; rewrite the runbooks). Measured on `main` at
`653c2cdef189e13221571bda75f43c14ea14c29c` (2026-11-14, about 12:30Z). All evidence is from
`rg`/`git ls-files` on that tree, one `delete-package --dry-run`, four read-only AWS calls and
three read-only `gh` listings. Nothing was changed outside this file.

Method, so a later lane can re-run it:

- `git ls-files infra` (119 tracked files).
- `rg -n -i pulumi --hidden -g '!infra/**' -g '!goals/**' -g '!explorations/**' -g '!research/**'`
  (63 files, 233 lines outside generated history).
- `rg -n` for `infra/`, `@beep/infra` (exact) and `"infra"` outside `infra/`, minus
  `packages/tooling/infra/` (614 lines in 150 files).
- `bun run beep delete-package @beep/infra --dry-run --prune-catalog`. It exits 1 and prints the
  inverse registration plan this document's last PR has to satisfy (section 2, R7).
- A census of backticked `infra/...` spans in the live (non-archival) Markdown that the knowledge
  gates read (section 2, "Knowledge gates").

Line numbers are for the tree above. They drift, so re-run the search, not the line.

## 1. Inventory

### 1.1 What is left in the Pulumi backend (external, read 2026-11-14)

`s3://oip-law-pulumi-state` (versioning `Enabled`, tagged `Project=oip`, `Repository=beep-effect`;
not managed by any Pulumi or Alchemy program: `infra/src/OipWeb.ts:34` only names it as the
default backend URL) holds 507 objects:

| Prefix | Objects | Meaning |
| --- | --- | --- |
| `.pulumi/stacks/beep-ci-runners/production.json` | 1 | **The only live stack** (2.67 MB, 354 resources per the packet). |
| `.pulumi/stacks/*/*.json.bak` | 5 | Leftover `.bak` files of removed stacks: `beep-ci-runners/production`, `beep-storybook/production`, `beep-turbo-cache-lab/lab-c1023a`, `opip-web/production`, `opip-web/staging`. |
| `.pulumi/history/beep-ci-runners/production/` | 110 | Update history of the live stack. |
| `.pulumi/backups/` | 75 | `beep-ci-runners` (55), `beep-turbo-cache-lab` (4), `opip-web` (16). |
| `.pulumi-migration-archive/2026-06-02T19-37-02.652Z/` | 315 | An earlier backend-migration archive (object names are base64 of old `opip-web` keys). |
| `.pulumi/meta.yaml` | 1 | Backend metadata. |

`beep-turbo-cache-lab/lab-c1023a` has no stack file, only a `.bak`, and no decision file in the
packet records its removal (`rg lab-c1023a goals` finds nothing). See open question Q6.

### 1.2 `infra/` by stack

Every tracked file under `infra/`, grouped by the Pulumi project or capability it belongs to. "Live"
is the state today, "Leaves with" is the PR in section 2.

**Storybook** (Pulumi project `beep-storybook`; stack removed 2026-11-13, decision
`2026-11-13-pulumi-beep-storybook-stack-removed.md`). Leaves with R1/R2.

- `infra/storybook/Pulumi.yaml`, `infra/storybook/Pulumi.production.yaml`
- `infra/src/Storybook.ts` (425 lines; imports `@pulumiverse/vercel`, `@pulumi/pulumi`)
- `infra/src/internal/storybook-entry.ts`, `infra/test/Storybook.test.ts`

**Turbo-cache lab** (Pulumi project `beep-turbo-cache-lab`; stack gone, `.bak` only; disposable
conformance lab of the completed goal `turborepo-cache-conformance`). Leaves with R1.

- `infra/turbo-cache-lab/Pulumi.yaml`, `infra/turbo-cache-lab/lab-aws.sh`, `infra/turbo-cache-lab/.gitignore`
- `infra/src/internal/turbo-cache-lab-entry.ts` (imports `resolveTurboCacheLabBuckets` and
  `TurboCacheLabBucketsInput` from `infra/src/CiTurboCache.ts:17-24`; those two exports and their
  tests go with it, the rest of `CiTurboCache.ts` stays until R6)

**OIP web** (Pulumi project `opip-web`; both stacks removed 2026-11-14 11:57Z and 11:59Z). Leaves
with R2, which another lane is building.

- `infra/oip-web/Pulumi.yaml`, `Pulumi.production.yaml`, `Pulumi.staging.yaml`
- `infra/src/OipWeb.ts` (1,147 lines; `@pulumi/aws`, `@pulumi/cloudflare`, `@pulumiverse/vercel`)
- `infra/src/Vercel.ts`, `infra/src/internal/oip-web-entry.ts`, `infra/test/OipWeb.test.ts`

**Hosts: AI metrics and OpenClaw** (Pulumi projects `beep-effect-ai-metrics` and `beep-openclaw`;
never had Pulumi state, decision `2026-11-13-hosts-no-pulumi-state.md`). Leaves with R4.

- `infra/Pulumi.yaml` (the root project is the AI metrics program, `main: ./src/internal/ai-metrics-entry.ts`)
- `infra/Pulumi.beep-ai-metrics-dankserver.yaml`
- `infra/openclaw/Pulumi.yaml`
- `infra/src/AIMetrics.ts` (743 lines; `@pulumi/command`, `@beep/repo-ai-metrics`)
- `infra/src/OpenClaw.ts` (699 lines; `@pulumi/command`, re-exports `@beep/infra-hosts/OpenClawGeneration`)
- `infra/src/OpenClawArtifacts.ts` (12-line re-export)
- `infra/src/internal/ai-metrics-entry.ts`, `infra/src/internal/openclaw-entry.ts`
- `infra/test/AIMetrics.test.ts`, `AIMetricsPulumi.test.ts`, `OpenClaw.test.ts`, `OpenClawPulumi.test.ts`

**Runner fleet, shard-overflow pool, AWS turbo cache and the turbo-cache throttle alarm** (Pulumi
project `beep-ci-runners`, stack `production`, the only live stack). Frozen until the cost-controls
removal PR merges. Leaves with R6 (fleet) and R5/R6 (cache).

- `infra/ci-runners/Pulumi.yaml` (pins the `ghaRunners` terraform-module package 0.2.2),
  `infra/ci-runners/Pulumi.production.yaml`
- `infra/ci-runners/runner-image.json`: intended runner-image receipt. CI reads it at
  `.github/workflows/check.yml:421` (`beep runners bake --check --manifest infra/ci-runners/runner-image.json`).
- `infra/ci-runners/sdks/ghaRunners/` (14 files): the generated Pulumi terraform-module bridge SDK.
  It includes `scripts/build.js` (run by root `postinstall`, section 1.4) and `test/build.test.js`.
- `infra/src/CiRunners.ts` (1,659), `CiFleetController.ts` (1,169; the only `@pulumi/gharunners`
  importer), `CiRunnerPool.ts`, `CiShardOverflowPool.ts`, `CiTurboCache.ts` (896),
  `infra/src/internal/ci-runners-entry.ts` (composes all of them at lines 23-61)
- `infra/src/AccountCostControls.ts` and its test: removed by the held cost-controls PR (branch
  goals/infra-alchemy-rebuild-p3-cost-controls-pulumi-removal at `0170e453e16`). That PR adds
  `infra/src/NotificationRecipients.ts` and its test, because the AWS cache's throttle alarm still
  reads the recipients key. Both leave with R6.
- Tests: `infra/test/CiFleetController.test.ts`, `CiRunners.test.ts`, `CiShardOverflowPool.test.ts`,
  `CiTurboCache.test.ts`
- `infra/lambda/turbo-cache/` (29 files): the AWS cache's authorizer and writer Lambdas, its own
  `package.json` and `bun.lock` (not a root workspace), `build.sh`, `package-zip.sh`, a local
  `lab/` (gateway, worker, `lab.sh`, seven target JSONs) and tests. `@beep/infra`'s `test:lambda`
  script runs them.

**R2 cache pilot** (an Alchemy stack with local state outside the repo, not Pulumi; D7 deletes
it). CI calls into it today. Leaves with R5.

- `infra/r2-cache/adapter.sh`, `alchemy.sh`, `check.sh`, `policy.sh`, `turbo.sh`, `workstation.sh`
- `infra/r2-cache/alchemy.run.ts.template`, `alchemy.signed-credentials.ts.template`
- `infra/r2-cache/patches/` (the 4.0.20 signed-policy patch of `brunojppb/turbo-cache-server`, its
  pins JSON, upstream licence, `.gitattributes`)
- `infra/r2-cache/policy-build-tools.txt`, `osv-scanner.toml`, `cache-input-baseline-request.json`,
  `cache-input-review.md` (D7 and the SPEC require its content preserved in the turbo-cache package
  README; check that before deleting), `README.md`, `SPEC.md`, `research/OPPORTUNITIES.md`

**Package scaffolding shared by every stack.** Leaves with R7 (the last PR).

- `infra/package.json` (`@beep/infra` 0.0.4, private), `infra/CHANGELOG.md`, `infra/README.md`,
  `infra/docgen.json`, `infra/tsconfig.json`, `infra/test/tsconfig.json`, `infra/test/.gitkeep`,
  `infra/turbo.json`, `infra/vitest.config.ts`
- `infra/pulumi-typescript6.cjs` (the TS6 preload every `Pulumi.yaml` loads through `runtime.options.nodeargs`)
- `infra/src/index.ts`, `infra/src/internal/InfraArtifactPath.ts`, `infra/src/internal/PulumiConfigSchema.ts`
- `infra/test/schemaParity.ts`

Python: none left (removed by #3296, python-free-repo). Shell: the eight `.sh` files above, which
the tracked-shell law allows only because `infra/` is an allowed root
(`packages/tooling/tool/cli/src/commands/Laws/TrackedShellAllowlist.model.ts:51`).

`scratchpad/turbo-cache-r2` is already gone from `main` (`ls` fails), so half of the "Infra gone"
row passes today.

### 1.3 Pulumi dependencies and the TypeScript 6 pin

| Item | Where | Used by today | Can go after |
| --- | --- | --- | --- |
| `@pulumiverse/vercel` catalog entry | `package.json:105`; `infra/package.json` dependency | `infra/src/OipWeb.ts`, `infra/src/Storybook.ts` | R2 (with Storybook removed) |
| `@pulumi/cloudflare` | `package.json:102`; `infra/package.json` | `infra/src/OipWeb.ts` only | R2 |
| `@pulumi/command` | `package.json:103`; `infra/package.json` | `infra/src/AIMetrics.ts`, `infra/src/OpenClaw.ts` | R4 |
| `@pulumi/aws` | `package.json:101`; `infra/package.json` | `CiRunners.ts`, `CiFleetController.ts`, `CiTurboCache.ts`, `OipWeb.ts`, `AccountCostControls.ts` | R6 |
| `@pulumi/pulumi` (exact `3.276.0`) | `package.json:104`; `infra/package.json` | every program and most `infra/test/*` | R7 (last importer is `InfraArtifactPath.ts`/`PulumiConfigSchema.ts`) |
| `@pulumi/gharunners` (`file:ci-runners/sdks/ghaRunners`) | `infra/package.json` dependency | `infra/src/CiFleetController.ts` | R6 |
| `bun.lock` | `@beep/infra@workspace:infra` (`bun.lock:5335`), `@beep/infra/@pulumi/gharunners` (9699), `@beep/infra/typescript` 6.0.3 (9701), the five `@pulumi/*` packages (6953-6961) and their nested `@opentelemetry/*` and `@grpc/*` closure; 26 lines match the SPEC regex | regenerated by `bun install` in each PR | R7 for the last match |
| `typescript: ^6.0.3` | `infra/package.json:64` (devDependency); `infra/ci-runners/sdks/ghaRunners/package.json:12` | the Pulumi nodejs runtime and the ghaRunners SDK build | R7 (the SDK leaves in R6, the package in R7) |
| syncpack version group "infra keeps TypeScript 6 for the Pulumi runtime and ghaRunners SDK" | `syncpack.config.ts:165-173`; also `infra/package.json` in `source` at `syncpack.config.ts:7` | permits the TS6 pin | R7 |
| hold-ledger claim `infra-typescript-6-pulumi@1` | `hold-ledger/claims.jsonl:10` (anchor: the syncpack group label above) | `beep holds lint` keeps config and ledger in step | R7: removing the group orphans the claim; `bun run beep holds lint --write` writes the tombstone |
| `pulumi-typescript6.cjs` shim | `infra/pulumi-typescript6.cjs`, listed as a Fallow entry at `.fallowrc.jsonc:28-29` | every `Pulumi.yaml` | R7 |
| `patchedDependencies` | `package.json:328-330` holds only `@alchemy.run/domain` | nothing Pulumi (the old `@pulumi/pulumi` root patch is already retired) | — |
| `trustedDependencies` | none in `package.json`; `bun pm untrusted` lists only `onnxruntime-node` and `@mui/x-telemetry` | — | — |
| Pulumi CLI pin | no repo pin: `mise.toml` pins only bun and node. The operator workstation installs it from the user mise config (`pulumi = "latest"`, 3.271.0 active); beep-worker had 3.267.0 (`goals/cloud-agent-readiness/history/2026-10-14-pulumi-backend-qualification.md`) | operators running Pulumi | after R6's destroy (external, section 1.6) |

TS6 elsewhere: ts-morph bundles its own TypeScript 6. That is a dependency's internal copy, not a
pin, and the "Pulumi gone" regex does not match it. `docs/runbooks/typescript-toolchain.md:5` and
`docs/README.md:22` mention both copies; R7 rewrites those sentences to drop the Pulumi one.

### 1.4 The root `postinstall` hook

`package.json:396`: `"postinstall": "lefthook install && bun run infra:prepare-gha-runners"`.

- `lefthook install` stays: it installs the git hooks and has nothing to do with infra.
- `infra:prepare-gha-runners` (`package.json:380`) runs
  `node infra/node_modules/@pulumi/gharunners/scripts/build.js --compiler infra/node_modules/typescript/bin/tsc`.
  It compiles the ghaRunners bridge SDK with infra's nested TS6. It exists only for Pulumi and TS6.
- Other users of that build: `@beep/infra`'s `beep:coverage` starts with
  `bun run --cwd node_modules/@pulumi/gharunners build` (`infra/package.json`). The repo-cli coverage
  planner parses that as a preparation command (`packages/tooling/tool/cli/src/commands/Ci/CiCoverage.ts:75-130`),
  and the generated default for package kind `infra` hardcodes it
  (`packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts:1760-1764`).
- Projection: `standards/root-package.projection.generated.json:117` and `:133` mirror both keys
  and `:200` the `infra` workspace. `bun run beep tsconfig-sync` (alias `bun run config-sync`)
  rewrites the projection.
- Nothing else calls `infra:prepare-gha-runners` (`rg prepare-gha` finds only these and
  `docs/runbooks/typescript-toolchain.md:634`).

End state: `"postinstall": "lefthook install"`. It can change in R6, once the SDK is gone, or in R7.
It must not change before the SDK leaves, because `@beep/infra` checks and coverage need the built SDK.

### 1.5 References outside `infra/`

Grouped by the PR that must remove each one. "R7" means the reference names `infra` as a root or
package and only goes when the package does.

**Root configuration (R7 unless noted)**

| Reference | What it does |
| --- | --- |
| `package.json:463` `"infra"` in `workspaces` | root workspace member |
| `tsconfig.json:92`, `vitest.aliases.generated.json:43` | `@beep/infra` path alias (regenerated by `tsconfig-sync`) |
| `tsconfig.packages.json:55` | project reference |
| `syncpack.config.ts:7` | `infra/package.json` source |
| `turbo.json:170` (`//#lint:jsdoc:root`), `:235` (`//#lint:policy-fingerprint`, input `infra/package.json`), `:5782`/`:5802` (`//#lint:schema-first`, `//#lint:schema-catalog`), `:5844` (`//#lint:effect-imports`), `:5905` (`//#lint:oxlint`), `:5919`/`:5922` (`//#lint:deprecated-imports`), `:6021` (`//#lint:typos`, excludes the SDK), `:6078`-`:6317` and `:6746`, `:6919` (every `//#fallow:*` task) | root task inputs naming `infra/**` |
| `.fallowrc.jsonc:16` (entry glob for `*-entry.ts`), `:28-29` (TS6 shim), `:143` (SDK), `:145-147` (Lambda) | Fallow entries and ignores |
| `biome.jsonc:52` (`!infra/ci-runners/sdks`), `:386` (`no-bigint-literals` scope `infra/**`) | Biome |
| `.oxlintrc.docs.json:23`, `:47`; `.oxlintrc.deprecated-apis.jsonc:38`, `:46` | oxlint scopes |
| `_typos.toml:135-136`, `.semgrepignore:12` | SDK exclusions (R6, with the SDK) |
| `lefthook.yml:53` glob `{apps,packages,infra}/**/*.{ts,tsx}` | pre-commit scope |
| `README.md:287`, `docs/runbooks/reference-workspace.md:3` | "first-party work lives under ... `infra/`" |
| `standards/effect-laws-v1.md:72` | lists `infra/**` among scanned roots |
| `beep-effect.iml:277` | excludes `explorations/pulumi-to-alchemy`; not an infra path, keep |

**Workflows and actions**

| Reference | Leaves with |
| --- | --- |
| `.github/actions/setup-monorepo-ci/action.yml:315-335` "Start optional R2 cache adapter" (`infra/r2-cache/adapter.sh start-ci`, inputs `r2-*`) | R5 |
| `infra/r2-cache/adapter.sh stop-ci` guard steps: `check.yml:640`, `:752`, `:1103`, `:1299`, `:1787`, `:1956`, `:2037`; `heavy.yml:329`; `storybook.yml:214`; `data-sync.yml:100`; `property-laws-nightly.yml:127`; `shard-overflow.yml:189` | R5 |
| `r2-*` inputs fed from `vars.TURBO_R2_*` and `secrets.TURBO_R2_*`: `check.yml:566-570`, `:695-699` and the other callers of the setup action | R5 |
| `cache-warm.yml:61-72` (`adapter.sh start-ci`), `:112` | R5 |
| `heavy.yml` jobs `producer-inspect` (405), `producer-prepare` (506), `producer-execute` (733), `local-pilot-observe` (932), reading `infra/r2-cache/policy.sh`, `policy-build-tools.txt` and `patches/` (598-700, 849-850); the dispatching workflows `cache-producer-inspect.yml`, `cache-producer-prepare.yml`, `cache-producer.yml`, `cache-local-observe.yml` | R5 (D7: "the patched Rust adapter ... deleted"); see Q2 |
| `check.yml:421` runner bake check against `infra/ci-runners/runner-image.json` | R6 (the P5 cutover PR moves the bake to the stack config) |
| `check.yml:1065`, `shard-overflow.yml:151` artifact glob `infra/coverage/**/unit-results.json` | R7 |
| `heavy.yml:176` change filter `^infra/` | R7 |
| `deploy-oip-web-infra.yml:64` comment "it equals the value each Pulumi stack held" | R2 or R7 (wording) |
| `fleet-shadow-check.yml`, `fleet-lane-probe.yml` (live-fleet probes) | R6, as P5's cutover decision rules |

No workflow runs `pulumi`, and no GitHub secret, variable or environment is named for Pulumi
(`gh secret list`, `gh variable list` and the environments API read 2026-11-14). The infra-tied
GitHub objects are the R2 pilot's (`TURBO_R2_READ_ACCESS_KEY_ID`, `TURBO_R2_READ_SECRET_ACCESS_KEY`
repository secrets, the write pair `TURBO_R2_WRITE_*` that the workflows read, variables
`TURBO_R2_ENABLED`, `TURBO_R2_ENDPOINT`, `TURBO_R2_BUCKET`) and the AWS cache's (`TURBO_API`
variable, `TURBO_TOKEN`/`TURBO_READ_TOKEN` secrets, environment `turbo-cache-write`). The
turbo-cache stage 2 PR replaces them.

**Repo CLI and policy code (`@beep/repo-cli`, `@beep/repo-cli-kit`, `@beep/repo-utils`)**

| Reference | Role | Leaves with |
| --- | --- | --- |
| `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts:851` (reads `infra/ci-runners/Pulumi.production.yaml`), `:892-900` (`pulumiPinCommand`); `Runners.schemas.ts:157`, `:175`; `Runners.command.ts:80`; `test/runners-bake.test.ts:78-79`, `:314`, `:454` | `beep runners bake` pins the AMI into Pulumi config | R6 (P5 cutover decision, "AMI ownership") |
| `.../Ci/CiShardOverflowPreflight.ts:464` (message names `pulumi stack output shardOverflowWebhook`); `.../Ci/CiShardOverflow.ts:81` (doc comment on `CiShardOverflowPool.ts`) | overflow preflight | R6 |
| `.../Cache/Cache.r2.command.ts:108` (`infra/r2-cache/workstation.sh`), `Cache.r2.live.ts:207`, `:284` (`adapter.sh serve`), `Cache.r2.ts:5`, `Cache.r2.schemas.ts:5`, `Cache.r2.fleet.ts:5`, `Cache.adapter.host.ts:5`, `Cache.workflow.ts:155` (`infra/r2-cache` in `declaredSourcePaths`); tests `cache-r2.test.ts`, `cache-producer-adapter.test.ts` | `beep cache r2`, adapter and producer commands | R5 |
| `packages/tooling/library/repo-cli-kit/src/cli/EnvConfig.ts:891` (reads the host's `beep/r2-cache/client.env`); `test/turbo-cache.test.ts` | workstation cache-client inheritance | R5 (stage 2 moves workstations to the Worker) |
| `packages/tooling/library/ai-metrics/src/install.ts:428` (step kind `"pulumi"`), `:1034` (`cd infra && pulumi preview --stack beep-ai-metrics-dankserver`), `:387`, `:1559`, `:1601`, `:1613`; `README.md:27`; `test/ingest.test.ts:1895`; `.../AIMetrics/internal/Programs.ts:1167`; `test/ai-metrics-command.test.ts:788`; schema catalog row `standards/schema-catalog/@beep/repo-ai-metrics.generated.jsonc:208` | the AI metrics installer points operators at the Pulumi stack | R4 (repoint to `@beep/infra-hosts`) |
| `.../Accounts/AccountsSecretsLayout.service.ts:52`; `docs/runbooks/onepassword-beep-secrets-layout.md:70` | `PULUMI_ENCRYPTION_PASSPHRASE` → `CLOUD_` rename table | R7, or when the 1Password field is deleted (section 1.6) |
| `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts:62` (`PackageKind` literal `"infra"`), 16 `TaskScriptRule` rows for kind `infra` (1045-1615), `ImplScriptDefault` rows (1741-1766); `PackageScriptsPolicy.ts:146` (`Match.when("infra", ...)`, matches only the root directory `infra`); tests `package-scripts.policy.test.ts`, `package-scripts.schemas.test.ts` | the scripts policy kind for the root `infra/` package. Not the tooling kind `infra` (`PackageJson.ts:299`, `CreatePackage.command.ts:150`), which the new packages use and which stays | R7 |
| `.../Quality/internal/CoverageScope.ts:156`, `:167` (`COVERAGE_TOOLING_INPUT_OWNER_ROWS`), `:373` (floor `"@beep/infra": 8.4`); `test/coverage-scope-tooling-input-owners.test.ts` | coverage scoping | R7 (the `:156`/`:167` rows exist because `@beep/infra` depends on `@beep/repo-ai-metrics`, so they could already go in R4) |
| `.../Ci/CiLanePartitions.ts:405`, `:587`, `:640` | unit partition membership | R7 |
| `.../Ci/CiLane.ts:2259` (`Str.startsWith("infra/")`), `CiOperational.schemas.ts:602` | change routing and the docs-only rule | R7 |
| Scan roots naming `infra`: `Quality.command.ts:355`, `:358`, `:1521`, `:2555-2556`; `Quality/internal/TestTsgoPrograms.ts:30`, `:36`; `Lint/Lint.schemas.ts:56-58`; `Lint/LintDeprecatedApis.schemas.ts:24`, `:30`, `:84-85`, `:152`; `Lint/LintJsdoc.command.ts:81`; `Lint/TsconfigOverlay.ts:64`; `Lint/PackageTestTypecheck.ts:72`; `Lint/internal/SchemaFirstProject.ts:37`; `Lint/internal/SchemaFirstPolicy.ts:82`; `Lint/internal/EffectVitestScan.ts:588`; `Laws/Laws.command.ts:329`; `Laws/TerseEffect.ts:116`; `Laws/internal/LawScan.ts:60`; `Laws/EffectImports.ts:361`, `:404`; `Laws/NoNativeRuntime.ts:50`; `Laws/RetiredIriAuthorities.model.ts:250`; `Laws/TrackedShellAllowlist.model.ts:31`, `:51`; `Knowledge/Knowledge.refs.ts:1376`; `Docgen/internal/Workspace.ts:36`; `Goals/Harvest.schemas.ts:191`; `DeletePackage/internal/RegistrationGeometry/RegistrationGeometry.probes.ts:42`, `.plan.ts:183`; `repo-utils/src/schemas/TypeScriptSourceExclusions.ts:35`; `policy-pack/lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts` and its `README.md:28` | every repo-cli scanner that treats `infra/` as a source root | R7. `delete-package` refuses while these are present (353 dependent hits; section 2, R7) |
| Tests with `infra` fixtures: `ci-coverage.test.ts:562-628` (`@pulumi/gharunners` preparation), `repo-utils/test/schemas/PackageJson.test.ts:384-387` (`trustedDependencies: ["@pulumi/ghaRunners"]` as fixture data), `lint-command.test.ts:1357-1372` (a `pulumi.Input` fixture), `schema-first.test.ts:208` (`infra/pulumi/src/Foo.ts`), `effect-imports.test.ts`, `catalog-shard-scope.test.ts`, `create-package.test.ts`, `root-tasks-turbo-inputs.test.ts`, `lint-workers.test.ts`, `ci-runner-security.test.ts`, `delete-package.test.ts`, `Holds.inventory.test.ts`, `laws-*.test.ts`, `goal-data-consumer-census.test.ts`, `commands/Goals/Harvest.test.ts`, `fixtures/dependency-review/manifest-inventory.json`, `fixtures/goals-plan/bootstrap-*.json` | R7. The first two match the SPEC's "Pulumi gone" regex (`packages/**`); rename the fixture strings rather than allow residue |
| `packages/foundation/capability/config-file/test/fixtures/codec-corpus/yaml/Pulumi.yaml:5-6` and `test/conformance/codec-corpus.test.ts:6` | a YAML codec fixture copied from an infra `Pulumi.yaml`. It contains `pulumi-typescript6.cjs`, so it **fails** the SPEC's `typescript6` match on `packages/**` | R7: re-key the fixture (a generic YAML with the same shape) |

**Identity, catalogs, baselines and inventories (regenerated, never hand-edited)**

| File | Rows for `@beep/infra` / `infra/` | Writer |
| --- | --- | --- |
| `packages/foundation/modeling/identity/src/packages.ts:51`, `:869-882` (`$InfraId`); `test/shape-stable.test.ts`; `biome.identity.jsonc` | identity segment | `delete-package` step "identity-segment" (R7). Use `--identity-major` only if the gate rules the removal a breaking identity change (Q7) |
| `standards/coverage.regression-baseline.jsonc:39` (reason row), `:15730+` (package totals 72.23/72.28/... and one row per `infra/src` file) | per-file and per-package coverage | each R-PR removes its file rows, and the package totals shift (section 2, "Coverage") |
| `standards/cache-qualification-baseline.json:690` subject `@beep/infra` (last recorded by the infra-hosts lane) plus root-subject task digests | cache baseline | `bun run beep cache audit`, then `bun run beep cache baseline --request <request.json>` with a review under `goals/infra-alchemy-rebuild/research/` |
| `standards/schema-catalog/@beep/infra.generated.jsonc` (31 rows) | schema catalog shard | `bun run beep lint schema-catalog --write` |
| `standards/schema-first.inventory.jsonc:7` (scope `infra/{src,test}/**/*.ts`), `:59-63` (`OipPulumiStateBackendConfig`) | schema-first inventory | `bun run beep lint schema-first --write` |
| `standards/jsdoc-documentation.inventory.jsonc` (122 lines), `standards/jsdoc-documentation.inventory.md` | JSDoc inventory | `bun run jsdoc:inventory` |
| `standards/effect-vitest.census.json` (28), `standards/effect-vitest.inventory.jsonc` (16) | effect-vitest census and baseline | `bun run beep lint effect-vitest --census` and `--write` |
| `standards/fallow.boundaries.generated.jsonc:513-517` (zone), `:3091-3112` (allow lists); `standards/fallow.boundaries.provenance.jsonc:387-392` | Fallow boundaries | `bun run fallow:boundaries:write` |
| `standards/fallow.health.regression-baseline.jsonc:29` (`infra/src/OipWeb.ts`) | Fallow health | `bun run fallow:health:baseline:write` (R2) |
| `standards/policy-tools.fingerprint.json:488` (`infra/package.json`) and the generated `turbo.json` seal inputs | policy fingerprint | `bun run beep lint policy-fingerprint --write` |
| `standards/root-package.projection.generated.json:117`, `:133`, `:200` | root manifest projection | `bun run beep tsconfig-sync` |
| `standards/cache-conformance/pins-2026-10-23.json:57`, `:76` | dated conformance evidence naming `infra/lambda/turbo-cache` and `infra/r2-cache/adapter.sh` | keep: it is a dated record (the `delete-package` plan lists it as baseline evidence to preserve) |
| `standards/instrumentation-catalog/` | no `@beep/infra` shard | — |
| `.changeset/` | `@beep/infra` is private; "private deletion emits no changeset" (`delete-package` plan) | — |

`bun run beep:preflight` (`package.json:347`) chains `tsconfig-sync`, `fallow:boundaries:write`,
`jsdoc:inventory`, `lint schema-first --write`, `lint package-scripts --write`,
`lint policy-fingerprint --write` and `lint policy`. Run it once per PR after the deletions, then
the schema catalog, effect-vitest census and cache baseline writers above.

**Docs, runbooks and standards (rewrite, section 5)**

- `docs/runbooks/alchemy-infra.md`: 45 Pulumi lines, including "Cutover from Pulumi" (476-532), the
  freeze notes in "Cost controls" (around 182), the host rollback (`infra/src/AIMetrics.ts`, 246 in
  SPEC), "Later" step 7 (528-529) and the stage-2 sentence (638).
- `docs/runbooks/ci-runner-reliability.md`: 19 Pulumi lines; the live pool table and
  "Deploy and verify" (421-425, 553) are Pulumi procedures.
- `docs/runbooks/aws-cost-operations.md`: 9 Pulumi lines (81, 190, 260, 272, 301-310, 394, 595,
  627-628, 646-648): the runner-image and AMI pin procedure and the state census row.
- `docs/runbooks/typescript-toolchain.md:5`, `:625-637` (the "infra/Pulumi" TS6 paragraph).
- `docs/runbooks/turbo-cache-inputs.md:213`, `:390`; `docs/runbooks/vercel-deploys.md:9`;
  `docs/runbooks/onepassword-beep-secrets-layout.md:70`; `docs/README.md:22`.
- `standards/turbo-remote-cache.md`: the whole document describes the AWS Lambda cache
  (`:4`, `:34`, `:350`). Rewrite it for the Worker in stage 2 or R6.
- `standards/architecture/DECISIONS.md:2512-2539`: a dated record that `infra/` is transitional.
  Keep it, and add a new dated entry when R7 merges, rather than editing the old one.
- Package READMEs and JSDoc that cite `infra/` as provenance:
  `packages/tooling/infra/cost-controls/README.md` (7 lines), `src/Config.ts`, `src/CostControls.ts`,
  `alchemy.run.ts`; `packages/tooling/infra/infra-hosts/README.md:3`, `:57-61`,
  `src/OpenClawGeneration.ts:14-16` (says "the Pulumi program imports it from here", which becomes
  false in R4), `src/AiMetricsStack.ts:6`, `src/OpenClawStack.ts:7`, `:20`;
  `packages/tooling/library/alchemy-github-runners/README.md:6` (names `infra/ci-runners/Pulumi.yaml`);
  `apps/oip-web/README.md:46-119`, `stack/OipWebStack.ts:4-5`, `:66` (the live DNS comment
  "Managed by Pulumi for oip.law Vercel routing.", see Q4), `:140`, `stack/OipWebConfig.ts:42`,
  `:149`, `:170`, `:374-375`, `test/stack/FakeCloud.ts:397-440`. Prose that says "replaces the
  Pulumi ..." is accurate history and can stay. Backticked `infra/` paths cannot (next section).
- `.claude/`, `.codex/`, `.cursor/`, `.agents/`, `AGENTS.md`, `docs/runbooks/agent-pools.md`: no
  `infra/` or Pulumi references.

**Goal packets and explorations that describe live procedures**

- Active: `goals/ci-lane-economics` (SPEC 95, 253, 290-303: the shard-overflow enablement is a
  Pulumi procedure on `infra/ci-runners`, plus two decisions dated 2026-11-13) and
  `goals/hosted-setup-tax` (SPEC 520-524, coverage owner rows that list `@beep/infra`). Neither
  owns infra work, but both cite paths R6 and R7 delete.
- Paused: `goals/turborepo-cache-trust-observability` (SPEC 52-53 links into `infra/src/CiTurboCache.ts`
  and `infra/lambda/turbo-cache/src`; PLAN 417, 637).
- Closed or superseded packets (`openclaw-workstation-agent`, `ai-metrics-stack`, `ci-fleet-endgame`,
  `scripts-to-beep-cli`, `boolean-creep`, `schema-opaque-default`, `python-free-repo`) and the
  explorations `pulumi-to-alchemy`, `openclaw-deployment-platform`, `github-merge-queue`,
  `packet-archive-and-alpha-harvest`, `turborepo-quality-cache`: historical, but their non-archival
  files are still in knowledge-gate scope (next section).

### 1.6 External state that outlives the repo

Nothing here was changed. "Who" is the actor with the authority; "First" is the precondition.

| State | Who | First |
| --- | --- | --- |
| Live stack `beep-ci-runners/production` (354 resources) | gate, operator workstation, YubiKey route | cost-controls removal PR merged (freeze lifted); P5 steps 0-6c (fresh export archived, size and sha256 in a decision); then step 6d's whole-stack or targeted destroy and `pulumi stack rm` |
| Five `.bak` stack files, `.pulumi/history`, `.pulumi/backups`, `.pulumi-migration-archive`, `meta.yaml` in `s3://oip-law-pulumi-state` | gate (AWS) | the live stack destroyed and removed; every export the decisions name present in the out-of-repo archive with a matching sha256. Then either keep the bucket as a cold archive (it costs cents) or copy it into the archive directory and delete it. The bucket is versioned, so deleting it means deleting every version. See Q5 |
| Out-of-repo export archive: the workstation's beep state directory, `infra-archives/pulumi-exports/` (2026-11-14: `beep-ci-runners-production-2026-11-13.json`, the 0520Z/0524Z before/after pair, `beep-storybook-production-2026-11-13.json`, 19 `opip-web-*` exports and logs, two URN lists) | operator | never delete before the packet closes; it holds every `pulumi stack import` reversal the decision files promise |
| 1Password field `PULUMI_ENCRYPTION_PASSPHRASE` in item `BEEP_SECRETS/BEEP_SECRETS` (backend passphrase for `beep-ci-runners`; slated for rename to `CLOUD_PULUMI_ENCRYPTION_PASSPHRASE`) | operator (human `op-human` lane) | live stack removed and its exports confirmed decryptable or no longer needed. The archived exports hold secrets encrypted with this passphrase, so deleting it makes them unreadable. Keep it as long as the archive is kept, or re-export without secrets first. See Q5 |
| 1Password field `PULUMI_CONFIG_PASSPHRASE` in item `BEEP_SECRETS/OIP_SECRETS` (the `opip-web` stacks) | operator | the same reasoning for the `opip-web` exports; both stacks are already removed |
| The rename row and code for that field: `docs/runbooks/onepassword-beep-secrets-layout.md:70`, `AccountsSecretsLayout.service.ts:52` | the R7 lane | delete the row once the field's fate is decided |
| `secure:` values still only in Pulumi config: the cost-controls recipient list, already copied to a GitHub secret (decision `2026-11-14-cost-controls-deploy-role.md:59-71`); `notificationEmailAddresses` read by the AWS cache throttle alarm | gate | nothing new to copy. Confirm at P5 step 6c that no other `secure:` key in `infra/ci-runners/Pulumi.production.yaml` lacks a 1Password or GitHub home |
| GitHub secrets and variables named for Pulumi | — | none exist |
| R2 pilot: its Alchemy state (outside the repo, the workstation's beep state directory `r2-cache/alchemy`), the frozen tool workspace and source archive under the beep cache directory, the R2 bucket and its Cloudflare tokens, `TURBO_R2_*` GitHub secrets and variables, and the `beep-turbo-r2.service` user unit plus `r2-cache/` client config on the workstation and each enrolled worker | gate and operator (Cloudflare token revocation, worker hosts over their SSH route) | turbo-cache stage 2 merged and CI plus workstations proven on the Worker; the bucket inventoried and emptied (`destroy` refuses a non-empty bucket by design); then `alchemy destroy` from the pinned workspace, unit disable and config removal per host, token revocation, secret and variable deletion |
| AWS cache (the `CiTurboCache` component: API Gateway, Lambdas, S3 bucket, SSM token parameters, throttle alarm) | gate | it lives in `beep-ci-runners/production`. Recommended: no separate Pulumi operation; P5 step 6d destroys it with the stack once stage 2 has moved every client. The `TURBO_TOKEN`/`TURBO_READ_TOKEN` secrets, the `TURBO_API` variable and the `turbo-cache-write` environment go after that |
| Old fleet IAM and keys outside Pulumi: SSM `/github-action-runners/*`, the key behind `alias/beep-ci-github-app`, the hand-maintained boundary `beep-ci-fleet-boundary` | operator decides (P5 step 6f) | the old fleet destroyed |
| IAM roles created for Pulumi deploys | — | none found. Pulumi always ran under the operator's `elpresidank-vault` credentials or the worker's approved AWS env file; every `beep-alchemy-*` role belongs to Alchemy |
| Pulumi CLI and client state: the workstation's mise `pulumi = "latest"` entry and its Pulumi home directory; beep-worker's persisted backend selection (`pulumi login s3://oip-law-pulumi-state`) | operator | after the live stack is removed. Remove the mise entry and the backend login. Workstation config is outside the repo |
| Cloudflare DNS record comments "Managed by Pulumi for oip.law Vercel routing." on the oip.law records | gate | `OipWeb` adopted them unchanged on purpose. Rewording is its own deploy (runbook 528-529). See Q4 |
| Turbo-cache lab leftovers: the `lab-c1023a` `.bak` and backups | gate | confirm with the lab's `inventory` subcommand (read-only) before R1 deletes `infra/turbo-cache-lab/lab-aws.sh`, the only tool that lists the lab's tagged resources. See Q6 |

## 2. Deletion plan

Seven PRs. The packet allows three open at once, so R1 to R4 can overlap, and R5 to R7 run one
after another after the verdict. Every PR deletes code and rewrites the docs and live spans that
named the deleted paths, in the same PR.

### Gates that react to every deletion PR

- **Coverage Regression.** `standards/coverage.regression-baseline.jsonc` holds per-file rows and
  `@beep/infra` package totals (`:15730+`). Removing a well-covered file lowers the package total,
  and the ratchet then reports a regression against the old total (two lanes were caught by this).
  Each PR removes the deleted files' rows and re-measures `@beep/infra` at the PR head. Expect
  inherited new-file rows too, because touching `@beep/infra` re-measures the whole package (memory
  coverage-ratchet-remeasures-touched-package). Do not measure locally across the package
  (`final-check --skip coverage`, operator ruling 2026-11-13); take the totals from the hosted
  Coverage Regression run. Q8 asks for the exact baseline writer: `coverage:baseline:write`
  (`package.json:359`) rewrites the whole file, not one package.
- **Cache qualification.** Any change to `infra/package.json`, root `package.json`, `turbo.json` or
  the lockfile re-keys the `@beep/infra` and root subjects. Run `bun run beep cache audit`, commit a
  request and a review under `goals/infra-alchemy-rebuild/research/` and record them with
  `bun run beep cache baseline --request ...`. Every merge of `main` conflicts in
  `standards/cache-qualification-baseline.json`: take `main`'s copy and re-record with a fresh
  `previous`.
- **Schema, instrumentation and JSDoc catalogs.** `lint schema-catalog --write` (the
  `@beep/infra` shard shrinks), `lint schema-first --write` (R2 removes `OipPulumiStateBackendConfig`),
  `jsdoc:inventory`, `lint effect-vitest --census`/`--write`. The cost-controls removal commit
  regenerated these inventories and produced +54k and +15k line diffs. Regenerate on a fresh merge
  of `main` so the diff stays reviewable.
- **Fallow.** `fallow:boundaries:write` when `infra/package.json` dependencies change (R2, R4, R6),
  and `fallow:health:baseline:write` when a file in the health baseline leaves (R2: `infra/src/OipWeb.ts`).
  Removing an `index.ts` re-export can make sibling exports dead; run `fallow dead-code` on the PR.
- **Policy fingerprint.** `lint policy-fingerprint --write` whenever a manifest, `turbo.json`,
  `.fallowrc.jsonc` or the tsconfig aliases change (R2, R4, R6, R7).
- **Knowledge gates.** `knowledge semantic-delta` reports a broken backticked path in every live
  Markdown file (scope: `goals/`, `explorations/`, `docs/`, `standards/`, `.github/`, `.claude/`,
  `.codex/`, `.agents/`, `AGENTS.md`, `CLAUDE.md`, minus `history/`, `research/`, `reflections/`
  and the other archival segments) whose span pointed at a path that HEAD no longer tracks. That
  holds even when the PR never touched the document. On `main` today, 125 backticked spans in 41
  live documents name a tracked `infra/` path. By the PR that breaks them: R1 7, R2 9, R4 21, R5 4,
  R6 40, R7 44 (41 of those are bare `infra/`). The held cost-controls PR breaks 2 more
  (`infra/src/AccountCostControls.ts` in `goals/infra-alchemy-rebuild/SPEC.md:804` and
  `goals/infra-alchemy-rebuild/decisions/2026-11-14-cost-controls-pulumi-cutover.md:84`). Decision files count as live.
  Recompute a PR's list with the census command in the method note above. A decision file's body is
  edited through `bun run beep goals decisions write`, and generated SPEC/PLAN blocks follow it.
  The rewrite policy for historical records is Q3. `knowledge refs --check` gates only host-path
  classes, so it does not catch these.
- **Identity registry.** R7 only (`delete-package` "identity-segment").
- **Lint Policy / laws.** R5 shrinks the tracked shell set. R7 removes `infra/` from
  `TrackedShellAllowedRoot` (`TrackedShellAllowlist.model.ts:51`); the law test
  `laws-tracked-shell-allowlist.test.ts` follows.

### R1: Storybook and turbo-cache-lab programs (can go now)

- Delete: `infra/storybook/`, `infra/src/Storybook.ts`, `infra/src/internal/storybook-entry.ts`,
  `infra/test/Storybook.test.ts`, `infra/turbo-cache-lab/`, `infra/src/internal/turbo-cache-lab-entry.ts`,
  the lab-only exports `resolveTurboCacheLabBuckets` and `TurboCacheLabBucketsInput` of
  `infra/src/CiTurboCache.ts` and their test cases; prune `infra/src/index.ts`.
- First: Q6 (lab inventory read).
- Recommendation: fold R1 into the OIP web deletion lane's PR (R2). Storybook is the other importer
  of `@pulumiverse/vercel`, so one PR can drop that pin, and both PRs would otherwise conflict on
  `index.ts`, the coverage baseline and the inventories.
- Regenerate: coverage rows and package totals, jsdoc inventory, effect-vitest, schema catalog, cache baseline.
- Live spans to rewrite: 7.

### R2: OIP web program (in flight, other lane; can go now)

- Delete: `infra/oip-web/`, `infra/src/OipWeb.ts`, `infra/src/Vercel.ts`,
  `infra/src/internal/oip-web-entry.ts`, `infra/test/OipWeb.test.ts`; plus R1 if folded in.
- Drop `@pulumi/cloudflare` from `infra/package.json` and the root catalog (`package.json:102`).
  Drop `@pulumiverse/vercel` (`package.json:105`) only if Storybook leaves in the same PR. `bun install`.
- Regenerate: `fallow:health:baseline:write` (`OipWeb.ts` row), `lint schema-first --write`
  (`OipPulumiStateBackendConfig`), `fallow:boundaries:write`, `lint policy-fingerprint --write`,
  coverage, jsdoc, effect-vitest, schema catalog, cache baseline.
- Docs: `docs/runbooks/alchemy-infra.md` "Cutover from Pulumi" collapses to a dated "done" note
  that points at the decision file, step 7 is removed, and `docs/runbooks/vercel-deploys.md:9` is
  rewritten. Live spans: 9.

### Cost-controls removal PR (P3, held; opens not before 2026-11-15T05:18Z)

Not a P6 PR, but R5 and R6 wait for it: it lifts the freeze on `beep-ci-runners/production`. It
deletes `infra/src/AccountCostControls.ts`, adds `infra/src/NotificationRecipients.ts`, and breaks
the 2 live spans listed above. Its lane should rewrite them, or semantic-delta will be red.

### R3: (no PR) the GitHub stack, #3324

`@beep/infra-github` replaces no Pulumi program (`@pulumi/github` was never a dependency,
`goals/ci-lane-economics/SPEC.md:298`). R3 only needs sequencing: #3324 edits the root catalog and
`bun.lock`, as R2, R4 and R7 do, so whichever merges second merges `main` and re-runs `bun install`.

### R4: Host programs (wait for the AI metrics attended cutover)

- First: `@beep/infra-hosts` prod plan and apply for `HostsAiMetrics` from the workstation (the
  hosts lane's next step), and its rollback recorded (`rollbackToCompose`). The Pulumi AI metrics
  program is the documented rollback reference until then (SPEC 246). OpenClaw was never installed,
  so it could go earlier, but it shares `@pulumi/command` with AI metrics; one PR is simpler.
- Delete: `infra/Pulumi.yaml`, `infra/Pulumi.beep-ai-metrics-dankserver.yaml`, `infra/openclaw/`,
  `infra/src/AIMetrics.ts`, `OpenClaw.ts`, `OpenClawArtifacts.ts`, `infra/src/internal/ai-metrics-entry.ts`,
  `openclaw-entry.ts`, the four AI metrics and OpenClaw tests. Remove `infra/package.json`
  dependencies `@beep/infra-hosts`, `@beep/openclaw`, `@beep/repo-ai-metrics`, `@pulumi/command`,
  and the root catalog entry `package.json:103`.
- Edit: `@beep/repo-ai-metrics` (`src/install.ts:387`, `:428`, `:1034`, `:1559`, `:1601`, `:1613`,
  `README.md:27`, `test/ingest.test.ts:1895`) and repo-cli `AIMetrics/internal/Programs.ts:1167`,
  `test/ai-metrics-command.test.ts:788` now name the `@beep/infra-hosts` stack.
  `CoverageScope.ts:156`, `:167` lose `@beep/infra`, since it no longer depends on repo-ai-metrics.
  `infra-hosts` JSDoc and README stop saying "the Pulumi program imports it from here".
- Regenerate: `fallow:boundaries:write` (the `@beep/infra` allow list shrinks), policy fingerprint,
  schema catalogs of both packages, coverage (both packages), jsdoc, effect-vitest, cache baseline
  (three subjects). `bun run beep quality package-verify @beep/repo-ai-metrics` and `@beep/repo-cli`.
- Live spans: 21 (mostly `goals/openclaw-workstation-agent`, `explorations/openclaw-deployment-platform`,
  two packet decisions).

### R5: R2 pilot and signed-producer pipeline (wait for the 2026-11-20 verdict and stage 2)

- First: the turbo-cache lane's stage 2 PR has merged (heavy.yml, check.yml, the setup action and
  the other callers on the Worker; workstations enrolled). That PR is the turbo-cache lane's, not
  P6's, and it must also replace `EnvConfig.ts:891`'s R2 client-file inheritance with the Worker
  enrollment. Then the external R2 teardown in section 1.6.
- Delete: `infra/r2-cache/` (after confirming that `cache-input-review.md` content is in
  `packages/tooling/infra/turbo-cache/README.md`); the workflows `cache-producer-inspect.yml`,
  `cache-producer-prepare.yml`, `cache-producer.yml` and `cache-local-observe.yml`, plus the
  `heavy.yml` jobs `producer-inspect`, `producer-prepare`, `producer-execute` and
  `local-pilot-observe`; the setup action's R2 step and `r2-*` inputs; every
  `adapter.sh stop-ci` guard step (13 sites listed in 1.5); the `beep cache r2` command family,
  `Cache.adapter.host.ts`, the producer and pilot code that drives the adapter, `infra/r2-cache` in
  `Cache.workflow.ts:155`, and their tests (`cache-r2.test.ts`, `cache-producer-adapter.test.ts`,
  the `ci-runner-security.test.ts` rows for the removed jobs).
- Operator merges it (workflow edits; packet rule, decision 2026-11-13 turbo-cache stage 2).
- Regenerate: coverage and catalogs for `@beep/repo-cli` and `@beep/repo-cli-kit`, policy
  fingerprint, cache baseline, `ci-runner-security` expectations.
- Live spans: 4.

### R6: Runner fleet program, AWS cache, ghaRunners SDK (wait for the verdict, P5 steps 0-6d)

- First: the cost-controls PR merged; P5 deployed, workflows moved, a full day green, the old
  fleet drained, a fresh export archived, and step 6d's destroy recorded, with the AWS cache
  included because stage 2 moved its clients. This is P5's step 6e PR, owned by the P5 lane.
  Widen its scope as below.
- Delete (P5 decision list): `infra/ci-runners/` (`Pulumi.yaml`, `Pulumi.production.yaml`,
  `runner-image.json`, `sdks/`), `infra/src/CiRunners.ts`, `CiFleetController.ts`, `CiRunnerPool.ts`,
  `CiShardOverflowPool.ts`, `infra/src/internal/ci-runners-entry.ts` and their tests.
  Add: `infra/src/CiTurboCache.ts`, `infra/src/NotificationRecipients.ts`, `infra/lambda/` and
  their tests, plus `test:lambda` in `infra/package.json`. Remove dependencies `@pulumi/aws`,
  `@pulumi/gharunners`, catalog entry `package.json:101`. Change `postinstall` to
  `lefthook install` and delete `infra:prepare-gha-runners` (`package.json:380`, `:396`), because
  the SDK is gone. Remove the `_typos.toml:135-136`, `.semgrepignore:12`, `biome.jsonc:52`,
  `.oxlintrc.docs.json:23`, `.fallowrc.jsonc:143-147` and `.oxlintrc.deprecated-apis.jsonc:38`
  exclusions, and `Quality.command.ts:1521`, `:2555-2556`.
- Edit (P5 decision): `beep runners bake` writes the stack's typed AMI config (`Runners.*`,
  `runners-bake.test.ts`, `check.yml:421`); `CiShardOverflowPreflight.ts:464`, `CiShardOverflow.ts:81`;
  `fleet-shadow-check.yml`/`fleet-lane-probe.yml` per the open P5 question;
  `standards/turbo-remote-cache.md` rewritten for the Worker (or in stage 2);
  `docs/runbooks/ci-runner-reliability.md` and `aws-cost-operations.md` rewritten for the new fleet;
  `packages/tooling/library/alchemy-github-runners/README.md:6`.
- Regenerate: `tsconfig-sync` (projection), policy fingerprint, fallow boundaries, coverage,
  schema catalog, jsdoc, effect-vitest, cache baseline.
- Live spans: 40 (`goals/infra-alchemy-rebuild/SPEC.md` and decisions, `goals/ci-lane-economics`,
  `explorations/pulumi-to-alchemy/DECISIONS.md`, runbooks).

### R7: Remove the `@beep/infra` package (the P6 exit PR; the packet's final PR, section 5)

Everything left: `infra/package.json`, `CHANGELOG.md`, `README.md`, `docgen.json`, `tsconfig.json`,
`test/tsconfig.json`, `test/.gitkeep`, `turbo.json`, `vitest.config.ts`, `pulumi-typescript6.cjs`,
`src/index.ts`, `src/internal/InfraArtifactPath.ts`, `src/internal/PulumiConfigSchema.ts`,
`test/schemaParity.ts`.

- Tool: `bun run beep delete-package @beep/infra --prune-catalog` (dry-run first). Its inverse plan
  on `main` today: remove the owned tree, the `infra` workspace literal and the identity segment;
  rebuild tsconfig-sync, the lockfile, fallow boundaries, the jsdoc inventory, the coverage
  baseline, fallow health and dead-code baselines, the schema-first inventory, the schema catalog,
  the instrumentation catalog and the test-typecheck baseline; remove modeled authored references;
  no changeset (private); preserve historical records. It refuses today with three findings that R7
  must clear: (1) 353 dependent hits; many are false matches on `packages/tooling/infra/` (Q9), the
  rest are the R7 rows of section 1.5; (2) `--prune-catalog` needs proof that no survivor lists
  `@pulumi/pulumi`, so R2, R4 and R6 must have removed every other `@pulumi/*` user; (3) a packet
  reference in `goals/_template/GOAL.md`, which needs `--rewrite-packets` or `--allow-stale-packets` (Q3).
- By hand, beside the tool: the `@pulumi/pulumi` catalog entry (`package.json:104`); the syncpack
  TS6 group (`syncpack.config.ts:165-173`) and source (`:7`), then `bun run beep holds lint --write`
  (tombstones `infra-typescript-6-pulumi`); the `PackageKind` literal `"infra"` and its rule and
  default rows (`PackageScripts.schemas.ts`, `PackageScriptsPolicy.ts:146`, tests); every repo-cli
  scan root, partition, coverage floor and route rule in 1.5; `.fallowrc.jsonc:16`, `:28-29`;
  `biome.jsonc:386`; `.oxlintrc.docs.json:47`; `.oxlintrc.deprecated-apis.jsonc:46`;
  `lefthook.yml:53`; `turbo.json` root inputs (via the fingerprint writer where generated);
  `heavy.yml:176`, `check.yml:1065`, `shard-overflow.yml:151`; `README.md:287`;
  `docs/runbooks/reference-workspace.md:3`; `standards/effect-laws-v1.md:72`;
  `Knowledge.refs.ts:1376`; the test fixtures that match the SPEC regex
  (`PackageJson.test.ts:384-387`, `ci-coverage.test.ts:562-628`, the config-file codec fixture
  `Pulumi.yaml`); `AccountsSecretsLayout.service.ts:52` and the 1Password layout row, if Q5 is settled.
- Regenerate: `bun run beep:preflight`, `lint schema-catalog --write`, `lint effect-vitest --census`
  and `--write`, cache baseline, `bun run beep quality package-verify` for every package edited
  (`@beep/repo-cli`, `@beep/repo-cli-kit`, `@beep/repo-utils`, `@beep/config-file`, `@beep/lint-rules`,
  `@beep/identity`).
- Live spans: 44.

R6 and R7 can be one PR if R6 lands late. Keeping them separate keeps the operator-merged workflow
edits (R6) apart from the large repo-cli edit (R7).

### Summary of waits

| PR | Owner | Waits on |
| --- | --- | --- |
| R1 Storybook + lab | the OIP web deletion lane (folded into R2) or a new lane | Q6 only: can go now |
| R2 OIP web | the OIP web deletion lane | nothing: can go now |
| (cost-controls) | P3 cost-controls lane | not before 2026-11-15T05:18Z; gates R5 and R6 |
| R4 hosts | hosts lane | the attended AI metrics cutover |
| R5 R2 pilot | turbo-cache lane | the 2026-11-20T20:10Z verdict, the stage 2 PR, the R2 teardown |
| R6 fleet + AWS cache + SDK | P5 lane (step 6e) | the verdict, the cost-controls PR, P5 steps 0-6d |
| R7 package removal | P6/P7 final lane | R2, R4, R5, R6 merged |

## 3. Verification matrix rows as exact commands

Run on `main` after R7 merges. Each must print nothing, or exit 0 where stated.

The SPEC's "Pulumi gone" row, unchanged:

```sh
rg -n '@pulumi|pulumiverse|typescript6' package.json packages apps bun.lock
```

Today it matches `package.json` (101-105, 380), `bun.lock` (26 lines) and three test locations
(section 1.5). The codec fixture and the two test fixtures need renaming for the row to pass. The
row's scope misses residue elsewhere, so R7 also runs these wider checks:

```sh
# No Pulumi or TS6 anywhere except dated records.
rg -n -i 'pulumi|typescript6|typescript@6' --hidden \
  -g '!.git' -g '!.repos' -g '!goals/**' -g '!explorations/**' -g '!research/**' \
  -g '!docs/history/**' -g '!docs/reports/**' -g '!hold-ledger/claims.jsonl' -g '!hold-ledger/runs.jsonl' \
  -g '!standards/architecture/DECISIONS.md' -g '!standards/cache-conformance/**' \
  -g '!beep-effect.iml' -g '!docs/agent-memory-infra/**' .
# No manifest pins TypeScript 6.
rg -n '"typescript": "[~^]?6' -g 'package.json' .
# The root postinstall is lefthook only, and the gha-runners script is gone.
jq -e '.scripts.postinstall == "lefthook install" and (.scripts["infra:prepare-gha-runners"] == null)' package.json
# No TS6 hold, version group or workspace entry.
rg -n 'infra keeps TypeScript 6|"infra",?$' syncpack.config.ts package.json standards/root-package.projection.generated.json
bun run beep holds lint
```

Allowed residue in the wide search, and why:

- `goals/**`, `explorations/**`, `research/**`: packet evidence and decision records, which keep the
  provenance of every destroy and its reversal (`pulumi stack import` recipes).
- `docs/history/**` (`commit-message-map.json`), `docs/reports/**`: dated reports.
- `hold-ledger/claims.jsonl`: append-only, so the tombstone row and the original row stay.
- `standards/architecture/DECISIONS.md`: dated doctrine entries (2512-2539 plus the new R7 entry).
- `standards/cache-conformance/pins-2026-10-23.json`: dated conformance evidence.
- `beep-effect.iml:277`: excludes the `explorations/pulumi-to-alchemy` folder.
- `docs/agent-memory-infra/trustgraph-docs.md:25`: describes a third-party product's Pulumi option,
  unrelated to this repo.
- Prose that says a stack "replaces the Pulumi project ..." in `apps/oip-web`, `packages/tooling/infra/*`
  and `packages/tooling/library/alchemy-*` is accurate history. If the gate wants zero hits there
  (Q10), add those paths as exclusions or reword them in R7.

The SPEC's "Infra gone" row, unchanged:

```sh
test ! -d infra && test ! -d scratchpad/turbo-cache-r2
```

R7 adds:

```sh
# No tracked file and no reference to the root infra/ tree outside dated records.
test -z "$(git ls-files infra)"
rg -n --hidden -e '(^|[^a-zA-Z/_.-])infra/' -e '@beep/infra([^-a-zA-Z]|$)' \
  -g '!.git' -g '!.repos' -g '!goals/**' -g '!explorations/**' -g '!research/**' \
  -g '!docs/history/**' -g '!docs/reports/**' -g '!standards/architecture/DECISIONS.md' \
  -g '!standards/cache-conformance/**' -g '!hold-ledger/**' . | rg -v 'packages/tooling/infra'
bun run beep delete-package @beep/infra --check
# The Pulumi backend holds no stack (operator, read-only).
AWS_PROFILE=elpresidank-vault AWS_REGION=us-east-1 \
  aws s3api list-objects-v2 --bucket oip-law-pulumi-state --prefix .pulumi/stacks/ \
  --query 'Contents[?ends_with(Key, `.json`)].Key' --output text
```

The last command must print `None` (no `.json` stack file; the `.bak` files end in `.json.bak`). If
Q5 deletes the bucket, it fails with `NoSuchBucket` instead, which also passes. The `rg` probe for
`(^|[^a-zA-Z/_.-])infra/` still matches `.gitignore:71` (`/docs/infra/`, unrelated); the
`[^a-zA-Z/_.-]` class excludes it only after a slash, so add `-g '!.gitignore'` if it shows.

## 4. Risks and open questions for the gate

Capabilities that `infra/` provides and no Alchemy stack replaces:

1. **The signed-producer cache pipeline** (the four `cache-*` dispatch workflows, the `heavy.yml`
   producer jobs, `beep cache producer`/`pilot`/`r2`, the patched Rust `turbo-cache-server`
   adapter). D7 deletes the R2 pilot including "the patched Rust adapter", and the Worker carries
   the signed-policy semantics, so this is a planned loss. The paused goal
   `turborepo-cache-trust-observability` cites these paths. **Q2:** confirm that R5 retires the
   whole producer/pilot family rather than repointing it at the Worker, and that the paused goal's
   owner agrees.
2. **The `beep runners bake` pin target and CI bake check** depend on the Pulumi config file until
   the P5 cutover PR moves them (planned in the P5 decision).
3. **The AWS cache's throttle alarm**: the Worker side becomes an opt-in observability alert
   (decision 2026-11-13). Its recipients key stays in Pulumi config until R6.
4. **The turbo-cache lab** (`lab-aws.sh` and the Lambda `lab/`): conformance tooling of a completed
   goal. D7 deletes it.
5. **Host deployment of AI metrics**: until R4's prerequisite, the Pulumi program is the only
   tested deploy path and the documented rollback reference.

Other sessions and goals that depend on what P6 deletes:

- `goals/ci-lane-economics` (active, window-5 census): its overflow pool is a Pulumi component in
  the live stack, and its SPEC procedure edits `infra/ci-runners/Pulumi.production.yaml`. R6 must
  not land before its verdict. The packet decision already says so.
- `goals/hosted-setup-tax` (active): coverage owner rows name `@beep/infra`; R4 and R7 change them.
- The cost-controls removal lane, the OIP web deletion lane, the hosts lane, the P5 lane and the
  turbo-cache lane each own one R-PR (summary table). All of them edit `infra/src/index.ts`,
  `standards/coverage.regression-baseline.jsonc` and the generated inventories, so they serialize
  on merge conflicts. The gate merges one at a time and tells the rest to merge `main`.
- #3324 (`@beep/infra-github`): conflicts only on the catalog and `bun.lock`.

What to keep and what to rewrite:

- Keep: every decision file, `explorations/pulumi-to-alchemy/`, `research/` reports, reflections,
  `standards/architecture/DECISIONS.md`, `standards/cache-conformance/`, the hold-ledger rows, and
  the out-of-repo export archive and the two passphrase fields as long as the archive is kept.
- Rewrite: the runbooks and standards in 1.5, package READMEs and JSDoc that point at deleted
  paths, and the live backticked spans.

Open questions:

- **Q1 (ordering of AWS cache removal):** destroy the `CiTurboCache` component with the whole stack
  at P5 step 6d (recommended: one Pulumi operation, after stage 2), or as a targeted destroy right
  after stage 2? The second means one more Pulumi operation on the frozen stack.
- **Q2:** see risk 1.
- **Q3 (historical records and the knowledge gate):** decision files and closed packets are live to
  `semantic-delta`. When a deletion breaks a backticked path in one, should the PR (a) rewrite the
  span to a commit-pinned GitHub permalink of the last commit that had the file, (b) un-backtick it
  and add "(removed in #N)", or (c) teach the knowledge scanner to treat `goals/*/decisions/` and
  closed packets as archival? (c) is a repo-cli change with wider effect. (b) is the smallest. The
  same answer settles `delete-package`'s `--rewrite-packets` versus `--allow-stale-packets` for
  `goals/_template/GOAL.md`.
- **Q4:** reword the live Cloudflare DNS comments "Managed by Pulumi for oip.law Vercel routing."
  (one `OipWeb` deploy, plus `OipWebStack.ts:66` and the fake cloud test), or keep them as inert text?
- **Q5 (backend and passphrases):** after R6, keep `oip-law-pulumi-state` as a cold archive and keep
  both passphrase fields, or copy the bucket into the out-of-repo archive and delete the bucket?
  Deleting a passphrase makes the encrypted secrets in every export unreadable, which weakens the
  `pulumi stack import` reversals the decision files promise.
- **Q6:** `beep-turbo-cache-lab/lab-c1023a` has no stack file and no decision record. Run the lab's
  read-only inventory (or a tag query) to confirm nothing tagged for the lab survives before R1
  deletes the only script that lists it, and record a short decision.
- **Q7:** is removing `$InfraId` from `@beep/identity` an identity-major change
  (`delete-package --identity-major`)? Nothing outside `infra/` imports it.
- **Q8 (coverage baseline writer):** which command rewrites only the `@beep/infra` totals and rows
  of `standards/coverage.regression-baseline.jsonc` from a hosted run? The cost-controls lane
  removed a file row by hand and left the totals. Unsure whether the hosted ratchet accepts that or
  needs re-measured totals.
- **Q9:** `delete-package`'s dependent scan counts `packages/tooling/infra/**` (for example
  `packages/tooling/infra/cost-controls/package.json:8`) as hits on the path `infra`. Fix the
  matcher in R7 or before it, or accept `--also`/manual removal? It refuses dependents regardless
  of `--force`.
- **Q10:** should the "Pulumi gone" check also cover provenance prose in the Alchemy packages
  ("replaces the Pulumi ..."), or is that allowed residue?

## 5. What the final P7 PR contains

It is R7 above, published through Yeet, plus the runbook rewrite and the packet closeout. It opens
at content-final: commit, `bun run beep yeet final-check` (skip coverage locally under the
2026-11-13 ruling and record it), `bun run beep yeet open`.

Last deletions: the `@beep/infra` package remainder, the `@pulumi/pulumi` catalog entry, the TS6
syncpack group and hold, the `infra` workspace entry and package kind, every `infra/` scan root,
and the regenerated baselines (R7).

Runbook rewrite, section by section:

| Document | Section | Becomes |
| --- | --- | --- |
| `docs/runbooks/alchemy-infra.md` | title and intro | "Infrastructure on Alchemy": the only IaC; Pulumi retired on the R7 merge date, with a link to the packet |
| | "One state store", "CI identity" | unchanged |
| | "Stacks" table | adds `CiRunners`, `InfraGithub` and `TurboCache` rows; no Pulumi column |
| | "Cost controls" | drops the freeze and the `pulumi config get` recipient bootstrap; keeps the Alchemy procedure |
| | "Host stacks" | drops "the Pulumi program stays on main until P6"; rollback is `rollbackToCompose` only |
| | "OipWeb" / "Cutover from Pulumi" | the cutover becomes a two-line historical note that points at `goals/infra-alchemy-rebuild/decisions/2026-11-14-oipweb-cutover-procedure-from-pulumi.md` |
| | "Turbo cache" | drops "until CI is flipped (cutover stage 2)"; the Worker is the only cache; token issue and rotate stay |
| | new "Runner fleet" | from `@beep/infra-ci-runners`: deploy, phases, bake-to-config, reaper, rollback |
| | new "Retired: Pulumi" | where the export archive lives (described, not a home path), which passphrase field decrypts which archive, and the `pulumi stack import` recipe from the decision files |
| `docs/runbooks/ci-runner-reliability.md` | pool table, "Deploy and verify" | new fleet names and the Alchemy deploy workflow (R6 already does most of this) |
| `docs/runbooks/aws-cost-operations.md` | runner image / AMI pin; state census row; stack table 627-628 | bake writes the stack config; the Pulumi state row becomes the archive row; the OIP and CI rows name the Alchemy stacks |
| `docs/runbooks/typescript-toolchain.md` | intro (5), "infra/Pulumi" (625-637) | the TS6 paragraph is deleted; only ts-morph's bundled TS6 is mentioned |
| `standards/turbo-remote-cache.md` | whole document | the Worker contract (if stage 2 did not already rewrite it) |
| `docs/runbooks/onepassword-beep-secrets-layout.md:70` | rename table | row removed or marked "archive only", per Q5 |
| `docs/README.md:22`, `README.md:287`, `docs/runbooks/reference-workspace.md:3`, `docs/runbooks/turbo-cache-inputs.md:213`, `:390`, `standards/effect-laws-v1.md:72` | one-line mentions | `infra/` removed from the lists |
| `standards/architecture/DECISIONS.md` | new dated entry | "the `infra/` workspace exception is closed", pointing at the 2512 entry |

Packet closeout, in the same PR:

1. `ops/manifest.json`, `PLAN.md` and `README.md`: P6 and P7 complete. The verification matrix
   evidence is the section 3 commands' output at the PR head; note that the backend check runs
   after merge.
2. Every Pulumi stack destroyed has its decision file and archive (acceptance criterion): Storybook,
   both `opip-web` stacks, cost-controls entries, `beep-ci-runners`, and the lab (Q6).
3. The reflection via the `/reflect` skill (`/reflect infra-alchemy-rebuild`) under
   `goals/infra-alchemy-rebuild/history/reflections/`, then `bun run beep lint reflection-artifacts`.
4. Once the PR is open: `bun run beep goals set-status infra-alchemy-rebuild completed-retained`.
   It writes the `closeout` record that names this PR. Commit it to the PR.
5. After the merge: `bun run beep goals completion refresh --slug infra-alchemy-rebuild` must print
   verified. Name any red required check in a committed decision file (`redAttribution`). Then run
   `bun run beep yeet sweep --retire` from the lane.
6. External cleanup that can only follow the merge, recorded as decisions as each one happens: the
   backend per Q5, the Pulumi CLI mise entry and backend logins, and the old fleet's SSM, KMS and
   boundary per P5 step 6f.
