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
- A census of backticked infra/... spans in the live (non-archival) Markdown that the knowledge
  gates read (section 2, "Knowledge gates").

Line numbers are for the tree above. They drift, so re-run the search, not the line.

Revision 4 (2026-11-14, after #3341 merged) marks R1 and R2 done, records the gate's rulings on R6.6 and on references in hard-scanned files, rewrites this document's mentions of paths #3341 deleted as plain text, and re-measures the dependents on its own tree (325; R7 starts at 235, section 6.2). Revision 3 (2026-11-14) adds section 6: what `delete-package` offers for acknowledged residue, the 330 remaining dependents classified by PR, the true residue, and the R6.6 design. Revision 2 (2026-11-14, same day) records the gate's rulings on Q1 to Q10 (section 4), the lab
check (Q6, seven more read-only AWS calls), the changeset and coverage answers (Q7, Q8) and
the new PR R6.5.

## Checklist for an implementing lane

Use this for any P6 deletion PR (R1, R2, R4, R5, R6, R6.5, R7). Section 2 lists each PR's files.

1. **Wait for your PR's precondition** (summary table at the end of section 2). Merge `origin/main` first.
2. **Delete the files** listed in your PR's entry. Prune `infra/src/index.ts` and the `infra/package.json`
   dependencies they used. Remove each root catalog entry only when no other importer is left
   (table 1.3). Then run `bun install`.
3. **Edit the readers** named in your entry: code, tests, workflows, runbooks, READMEs and JSDoc.
   R7 also removes "replaces the Pulumi ..." provenance prose from package source, JSDoc and
   READMEs (Q10). Keep the DNS comment string (Q4).
4. **Rewrite broken path references (Q3).** Recompute the live spans that name a path you delete
   (the census command in "Knowledge gates", section 2). In every live doc, decision files and
   closed packets included, replace the backticked path, or the Markdown link, with the same path
   as plain text followed by "(removed in #N)", where N is your PR number. Change nothing else in
   a dated record. Exception: in a file `delete-package` scans as a hard dependent (anything under
   `packages/`, `apps/`, `.github/`, or a root policy file), drop the reference instead. The
   plain-text path still matches and stays a dependent of R7 (section 6.2). Edit decision files through `bun run beep goals decisions write --slug <slug>`
   so the generated SPEC and PLAN blocks follow.
5. **Coverage.** In `standards/coverage.regression-baseline.jsonc`, delete the rows of the files you
   removed. Keep every other byte, the `@beep/infra` totals included. Do not re-measure locally.
   Check "Coverage" in section 2 for whether your PR's total rises (passes) or falls (sequence it,
   or follow up with a rows-only PR).
6. **Regenerate**, on a fresh merge of `main`: `bun run beep:preflight`, then
   `bun run beep lint schema-catalog --write`, `bun run beep lint effect-vitest --census`,
   `bun run beep lint effect-vitest --write`, `bun run fallow:health:baseline:write` (if a health
   row's file left), `bun run beep cache audit`, then a request and review under
   `goals/infra-alchemy-rebuild/research/` and `bun run beep cache baseline --request <request.json>`.
7. **Verify**: `bun run beep quality package-verify <pkg>` for every package you edited. For a
   repo-cli edit, run the touched tests on Node and on Bun. Commit, run
   `bun run beep knowledge semantic-delta` (it must report `introduced (0)`), then
   `bun run beep yeet final-check --skip coverage=<reason>`.
8. **Changesets**: none. Every package P6 touches is private (Q7).
9. **Open** with `bun run beep yeet open`. A PR that edits `.github/` is merged by the operator.
   Tell the gate which external state your PR's precondition consumed, so the closeout's operator
   list stays current.

## 1. Inventory

### 1.1 What is left in the Pulumi backend (external, read 2026-11-14)

`s3://oip-law-pulumi-state` (versioning `Enabled`, tagged `Project=oip`, `Repository=beep-effect`;
not managed by any Pulumi or Alchemy program: infra/src/OipWeb.ts:34 (removed in #3341) only names it as the
default backend URL) holds 507 objects:

| Prefix | Objects | Meaning |
| --- | --- | --- |
| `.pulumi/stacks/beep-ci-runners/production.json` | 1 | **The only live stack** (2.67 MB, 354 resources per the packet). |
| `.pulumi/stacks/*/*.json.bak` | 5 | Leftover `.bak` files of removed stacks: `beep-ci-runners/production`, `beep-storybook/production`, `beep-turbo-cache-lab/lab-c1023a`, `opip-web/production`, `opip-web/staging`. |
| `.pulumi/history/beep-ci-runners/production/` | 110 | Update history of the live stack. |
| `.pulumi/backups/` | 75 | `beep-ci-runners` (55), `beep-turbo-cache-lab` (4), `opip-web` (16). |
| `.pulumi-migration-archive/2026-06-02T19-37-02.652Z/` | 315 | An earlier backend-migration archive (object names are base64 of old `opip-web` keys). |
| `.pulumi/meta.yaml` | 1 | Backend metadata. |

`beep-turbo-cache-lab/lab-c1023a` has no stack file, only a `.bak`. When this was first measured, no decision
file recorded its removal. #3341 added that record:
`goals/infra-alchemy-rebuild/decisions/2026-11-14-turbo-cache-lab-lab-c1023a-was-destroyed-on-2026-10-24-nothing-is-live.md`.
The lab was destroyed on 2026-10-24, and nothing of it is live in AWS (checked 2026-11-14, Q6 in section 4).

### 1.2 `infra/` by stack

Every tracked file under `infra/`, grouped by the Pulumi project or capability it belongs to. "Live"
is the state today, "Leaves with" is the PR in section 2.

**Storybook** (Pulumi project `beep-storybook`; stack removed 2026-11-13, decision
`2026-11-13-pulumi-beep-storybook-stack-removed.md`). Deleted by #3341 (R1).

- infra/storybook/Pulumi.yaml (removed in #3341), infra/storybook/Pulumi.production.yaml (removed in #3341)
- infra/src/Storybook.ts (removed in #3341) (425 lines; imports `@pulumiverse/vercel`, `@pulumi/pulumi`)
- infra/src/internal/storybook-entry.ts (removed in #3341), infra/test/Storybook.test.ts (removed in #3341)

**Turbo-cache lab** (Pulumi project `beep-turbo-cache-lab`; stack gone, `.bak` only; disposable
conformance lab of the completed goal `turborepo-cache-conformance`). Deleted by #3341 (R1).

- infra/turbo-cache-lab/Pulumi.yaml (removed in #3341), infra/turbo-cache-lab/lab-aws.sh (removed in #3341), infra/turbo-cache-lab/.gitignore (removed in #3341)
- infra/src/internal/turbo-cache-lab-entry.ts (removed in #3341) (imports `resolveTurboCacheLabBuckets` and
  `TurboCacheLabBucketsInput` from `infra/src/CiTurboCache.ts:17-24`; those two exports and their
  tests go with it, the rest of `CiTurboCache.ts` stays until R6)

**OIP web** (Pulumi project `opip-web`; both stacks removed 2026-11-14 11:57Z and 11:59Z). Deleted
by #3341 (R2).

- infra/oip-web/Pulumi.yaml, infra/oip-web/Pulumi.production.yaml and infra/oip-web/Pulumi.staging.yaml (all removed in #3341)
- infra/src/OipWeb.ts (removed in #3341) (1,147 lines; `@pulumi/aws`, `@pulumi/cloudflare`, `@pulumiverse/vercel`)
- infra/src/Vercel.ts (removed in #3341), infra/src/internal/oip-web-entry.ts (removed in #3341), infra/test/OipWeb.test.ts (removed in #3341)

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
  infra/src/NotificationRecipients.ts and its test, because the AWS cache's throttle alarm still
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

scratchpad/turbo-cache-r2 is already gone from `main` (`ls` fails), so half of the "Infra gone"
row passes today.

### 1.3 Pulumi dependencies and the TypeScript 6 pin

| Item | Where | Used by today | Can go after |
| --- | --- | --- | --- |
| `@pulumiverse/vercel` catalog entry | was `package.json:105` and an `infra/package.json` dependency | nothing | removed in #3341 |
| `@pulumi/cloudflare` | was `package.json:102` and an `infra/package.json` dependency | nothing | removed in #3341 |
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
| Tests with `infra` fixtures: `ci-coverage.test.ts:562-628` (`@pulumi/gharunners` preparation), `repo-utils/test/schemas/PackageJson.test.ts:384-387` (`trustedDependencies: ["@pulumi/ghaRunners"]` as fixture data), `lint-command.test.ts:1357-1372` (a `pulumi.Input` fixture), `schema-first.test.ts:208` (infra/pulumi/src/Foo.ts), `effect-imports.test.ts`, `catalog-shard-scope.test.ts`, `create-package.test.ts`, `root-tasks-turbo-inputs.test.ts`, `lint-workers.test.ts`, `ci-runner-security.test.ts`, `delete-package.test.ts`, `Holds.inventory.test.ts`, `laws-*.test.ts`, `goal-data-consumer-census.test.ts`, `commands/Goals/Harvest.test.ts`, `fixtures/dependency-review/manifest-inventory.json`, `fixtures/goals-plan/bootstrap-*.json` | R7. The first two match the SPEC's "Pulumi gone" regex (`packages/**`); rename the fixture strings rather than allow residue |
| `packages/foundation/capability/config-file/test/fixtures/codec-corpus/yaml/Pulumi.yaml:5-6` and `test/conformance/codec-corpus.test.ts:6` | a YAML codec fixture copied from an infra `Pulumi.yaml`. It contains `pulumi-typescript6.cjs`, so it **fails** the SPEC's `typescript6` match on `packages/**` | R7: re-key the fixture (a generic YAML with the same shape) |

**Identity, catalogs, baselines and inventories (regenerated, never hand-edited)**

| File | Rows for `@beep/infra` / `infra/` | Writer |
| --- | --- | --- |
| `packages/foundation/modeling/identity/src/packages.ts:51`, `:869-882` (`$InfraId`); `test/shape-stable.test.ts`; `biome.identity.jsonc` | identity segment | `delete-package` step "identity-segment" (R7). Use `--identity-major` only if the gate rules the removal a breaking identity change (Q7) |
| `standards/coverage.regression-baseline.jsonc:39` (reason row), `:15730+` (package totals 72.23/72.28/... and one row per `infra/src` file) | per-file and per-package coverage | each R-PR removes its file rows, and the package totals shift (section 2, "Coverage") |
| `standards/cache-qualification-baseline.json:690` subject `@beep/infra` (last recorded by the infra-hosts lane) plus root-subject task digests | cache baseline | `bun run beep cache audit`, then `bun run beep cache baseline --request <request.json>` with a review under `goals/infra-alchemy-rebuild/research/` |
| `standards/schema-catalog/@beep/infra.generated.jsonc` (31 rows at 653c2cdef18; #3341 removed its deleted modules' rows) | schema catalog shard | `bun run beep lint schema-catalog --write` |
| `standards/schema-first.inventory.jsonc:7` (scope `infra/{src,test}/**/*.ts`), `:59-63` (`OipPulumiStateBackendConfig`, removed by #3341) | schema-first inventory | `bun run beep lint schema-first --write` |
| `standards/jsdoc-documentation.inventory.jsonc` (122 lines), `standards/jsdoc-documentation.inventory.md` | JSDoc inventory | `bun run jsdoc:inventory` |
| `standards/effect-vitest.census.json` (28), `standards/effect-vitest.inventory.jsonc` (16) | effect-vitest census and baseline | `bun run beep lint effect-vitest --census` and `--write` |
| `standards/fallow.boundaries.generated.jsonc:513-517` (zone), `:3091-3112` (allow lists); `standards/fallow.boundaries.provenance.jsonc:387-392` | Fallow boundaries | `bun run fallow:boundaries:write` |
| `standards/fallow.health.regression-baseline.jsonc:29` (infra/src/OipWeb.ts (removed in #3341)) | Fallow health | removed by #3341 (R2) |
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
  SPEC), "Later" step 7 (528-529; #3341 rewrote the cutover section as done and removed step 7) and the stage-2 sentence (638).
- `docs/runbooks/ci-runner-reliability.md`: 19 Pulumi lines; the live pool table and
  "Deploy and verify" (421-425, 553) are Pulumi procedures.
- `docs/runbooks/aws-cost-operations.md`: 9 Pulumi lines (81, 190, 260, 272, 301-310, 394, 595,
  627-628, 646-648): the runner-image and AMI pin procedure and the state census row.
- `docs/runbooks/typescript-toolchain.md:5`, `:625-637` (the "infra/Pulumi" TS6 paragraph).
- `docs/runbooks/turbo-cache-inputs.md:213`, `:390`; `docs/runbooks/vercel-deploys.md:9` (rewritten by #3341);
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
| Five `.bak` stack files, `.pulumi/history`, `.pulumi/backups`, `.pulumi-migration-archive`, `meta.yaml` in `s3://oip-law-pulumi-state` | operator decides; the packet keeps it (Q5 ruling) | **Kept.** The bucket is what makes the archived exports restorable, and deleting it (every version, since it is versioned) is irreversible and the operator's call. P6 only requires that it holds no stack. It goes on the closeout's operator list |
| Out-of-repo export archive: the workstation's beep state directory, `infra-archives/pulumi-exports/` (2026-11-14: `beep-ci-runners-production-2026-11-13.json`, the 0520Z/0524Z before/after pair, `beep-storybook-production-2026-11-13.json`, 19 `opip-web-*` exports and logs, two URN lists) | operator | never delete before the packet closes; it holds every `pulumi stack import` reversal the decision files promise |
| 1Password field `PULUMI_ENCRYPTION_PASSPHRASE` in item `BEEP_SECRETS/BEEP_SECRETS` (backend passphrase for `beep-ci-runners`; slated for rename to `CLOUD_PULUMI_ENCRYPTION_PASSPHRASE`) | operator decides; the packet keeps it (Q5 ruling) | **Kept.** The archived exports hold secrets encrypted with this passphrase, so deleting it makes them unreadable. It goes on the closeout's operator list |
| 1Password field `PULUMI_CONFIG_PASSPHRASE` in item `BEEP_SECRETS/OIP_SECRETS` (the `opip-web` stacks) | operator decides; the packet keeps it (Q5 ruling) | **Kept**, for the `opip-web` exports. It goes on the closeout's operator list |
| The rename row and code for that field: `docs/runbooks/onepassword-beep-secrets-layout.md:70`, `AccountsSecretsLayout.service.ts:52` | the R7 lane | delete the row once the field's fate is decided |
| `secure:` values still only in Pulumi config: the cost-controls recipient list, already copied to a GitHub secret (decision `2026-11-14-cost-controls-deploy-role.md:59-71`); `notificationEmailAddresses` read by the AWS cache throttle alarm | gate | nothing new to copy. Confirm at P5 step 6c that no other `secure:` key in `infra/ci-runners/Pulumi.production.yaml` lacks a 1Password or GitHub home |
| GitHub secrets and variables named for Pulumi | — | none exist |
| R2 pilot: its Alchemy state (outside the repo, the workstation's beep state directory `r2-cache/alchemy`), the frozen tool workspace and source archive under the beep cache directory, the R2 bucket and its Cloudflare tokens, `TURBO_R2_*` GitHub secrets and variables, and the `beep-turbo-r2.service` user unit plus `r2-cache/` client config on the workstation and each enrolled worker | gate and operator (Cloudflare token revocation, worker hosts over their SSH route) | turbo-cache stage 2 merged and CI plus workstations proven on the Worker; the bucket inventoried and emptied (`destroy` refuses a non-empty bucket by design); then `alchemy destroy` from the pinned workspace, unit disable and config removal per host, token revocation, secret and variable deletion |
| AWS cache (the `CiTurboCache` component: API Gateway, Lambdas, S3 bucket, SSM token parameters, throttle alarm) | gate | it lives in `beep-ci-runners/production`. Ruled (Q1): no separate Pulumi operation; P5 step 6d destroys it with the stack once stage 2 has moved every client. Fallback: if P5 slips more than a week past the stage-2 repoint, the gate runs an attended targeted destroy of the component, following the cost-controls pattern. The `TURBO_TOKEN`/`TURBO_READ_TOKEN` secrets, the `TURBO_API` variable and the `turbo-cache-write` environment go after that |
| Old fleet IAM and keys outside Pulumi: SSM `/github-action-runners/*`, the key behind `alias/beep-ci-github-app`, the hand-maintained boundary `beep-ci-fleet-boundary` | operator decides (P5 step 6f) | the old fleet destroyed |
| IAM roles created for Pulumi deploys | — | none found. Pulumi always ran under the operator's `elpresidank-vault` credentials or the worker's approved AWS env file; every `beep-alchemy-*` role belongs to Alchemy |
| Pulumi CLI and client state: the workstation's mise `pulumi = "latest"` entry and its Pulumi home directory; beep-worker's persisted backend selection (`pulumi login s3://oip-law-pulumi-state`) | operator | after the live stack is removed. Remove the mise entry and the backend login. Workstation config is outside the repo |
| Cloudflare DNS record comments "Managed by Pulumi for oip.law Vercel routing." on the oip.law records | — | **Left as they are** (Q4 ruling). Changing them needs a DNS write the Alchemy token lacks, and a comment does not justify a record write on oip.law. They are corrected the next time those records change for a real reason. Allowed residue in section 3 |
| Turbo-cache lab leftovers: the `lab-c1023a` `.bak` and four backups in the backend; nothing in AWS (checked 2026-11-14, Q6) | — | nothing live. The backend files stay with the bucket (Q5) |

## 2. Deletion plan

Eight PRs (R3 is not a PR; R6.5 was added by the gate). The packet allows three open at once, so R1 to R4 can overlap, and R5 to R7 run one
after another after the verdict. Every PR deletes code and rewrites the docs and live spans that
named the deleted paths, in the same PR.

### Gates that react to every deletion PR

- **Coverage Regression** (read from the ratchet's source; Q8 in section 4 has the full answer).
  `standards/coverage.regression-baseline.jsonc` holds per-file rows and `@beep/infra` package
  totals (`:15730+`). How the hosted ratchet judges a deletion PR:
  - A package that owns a changed file, or depends on one, is excluded from "self-judging"
    (`planCoverageSelfJudgeScope`, `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts:1352`).
    Changing a global coverage input (for example `bun.lock`) withdraws self-judging from every
    package. Every P6 PR does both. So a lowered `@beep/infra` row in the PR's own baseline is
    "withheld" and judged at `main`'s floor (`CoverageRegression.ts:3740-3765`).
  - A package metric fails when the measured percentage is below that floor and either the
    uncovered count rose or the package's file set changed (`metricRegressed`,
    `CoverageRegression.ts:3085-3094`). Deleting files always changes the file set, so a deletion
    PR passes exactly when the package percentage does not fall.
  - Removing the deleted files' rows is a delete-only edit and does not count as a global input.
  - Measured from today's rows (lines; branches and functions move the same way): `@beep/infra` is
    72.23% (231 uncovered of about 832 lines). R1 removes about 42 lines at 50%, R2 about 111 at
    about 37%, R4 about 330 at about 65%. All are below the average, so each raises the total and
    passes. **The cost-controls PR removes `infra/src/AccountCostControls.ts`, which is 100%
    covered, so it lowers the total.** Merged before R1+R2 it reds Coverage Regression. Merged
    after R1+R2 (with `main`'s floor still 72.23), the measured total stays near 76-77% and it
    passes. Gate: merge R1+R2 first, or follow the cost-controls PR with a rows-only PR (below).
  - R6 leaves only 100%-covered scaffolding, so the total rises. R7 deletes the package, and the
    ratchet treats a package missing from the proposal and from the measurement as retired
    (`retiredByProposal`, `CoverageRegression.ts:3868-3873`); `delete-package` subtracts its rows.
  - Lowering a floor is legitimate only in a PR that changes nothing `@beep/infra` owns or depends
    on: a rows-only PR that edits just the baseline file. Then the package self-judges and the
    lowered row is accepted.
  - Do not measure locally across the package (operator ruling 2026-11-13). Use
    `final-check --skip coverage=<reason>`; hosted Coverage Regression is the proof.
- **Cache qualification.** Any change to `infra/package.json`, root `package.json`, `turbo.json` or
  the lockfile re-keys the `@beep/infra` and root subjects. Run `bun run beep cache audit`, commit a
  request and a review under `goals/infra-alchemy-rebuild/research/` and record them with
  `bun run beep cache baseline --request ...`. Every merge of `main` conflicts in
  `standards/cache-qualification-baseline.json`: take `main`'s copy and re-record with a fresh
  `previous`.
- **Schema, instrumentation and JSDoc catalogs.** `lint schema-catalog --write` (the
  `@beep/infra` shard shrinks), `lint schema-first --write` (R2 removed `OipPulumiStateBackendConfig` in #3341),
  `jsdoc:inventory`, `lint effect-vitest --census`/`--write`. The cost-controls removal commit
  regenerated these inventories and produced +54k and +15k line diffs. Regenerate on a fresh merge
  of `main` so the diff stays reviewable.
- **Fallow.** `fallow:boundaries:write` when `infra/package.json` dependencies change (R2, R4, R6),
  and `fallow:health:baseline:write` when a file in the health baseline leaves (R2: infra/src/OipWeb.ts (removed in #3341)).
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

### R1: Storybook and turbo-cache-lab programs (done in #3341)

**Done.** #3341 merged at 13:35Z on 2026-11-14 (`e051bd152f3`), together with R2. Its merge touched
`apps/oip-web/stack/**`, so the armed `Deploy oip-web infrastructure` workflow ran (run 43600573838) and
planned no changes on both stages.

- Delete: infra/storybook/ (removed in #3341), infra/src/Storybook.ts (removed in #3341), infra/src/internal/storybook-entry.ts (removed in #3341),
  infra/test/Storybook.test.ts (removed in #3341), infra/turbo-cache-lab/ (removed in #3341), infra/src/internal/turbo-cache-lab-entry.ts (removed in #3341),
  the lab-only exports `resolveTurboCacheLabBuckets` and `TurboCacheLabBucketsInput` of
  `infra/src/CiTurboCache.ts` and their test cases; prune `infra/src/index.ts`.
- First: nothing. The lab check (Q6) found no live AWS resource, so infra/turbo-cache-lab/lab-aws.sh (removed in #3341)
  may go with the rest.
- Ruled by the gate: R1 is folded into the OIP web deletion lane's PR (R2). Storybook is the other
  importer of `@pulumiverse/vercel`, so that PR drops the pin.
- The PR also records the lab's end in a short decision file
  (`bun run beep goals decisions add infra-alchemy-rebuild --title "Turbo-cache lab lab-c1023a was destroyed on 2026-10-24; nothing is live" --reversal "n/a (record only)"`),
  with the evidence in Q6.
- Regenerate: coverage rows (delete-only; the total rises), jsdoc inventory, effect-vitest, schema
  catalog, cache baseline.
- Live spans to rewrite: 7.

### R2: OIP web program (done in #3341)

**Done.** Merged in #3341 with R1; see R1. Two things it left behind are cleaned up by the P6
housekeeping PR:

- the `LEGACY_BASELINE` entries in `packages/tooling/policy-pack/lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts`
  for its two deleted tests;
- the rows of its deleted files in `standards/effect-vitest.census.json` and
  `standards/jsdoc-documentation.inventory.jsonc`, hand-removed. A separate lane owns the whole-file refresh.

The same PR drops its three "(removed in #3341)" rewrites in `apps/oip-web` (gate ruling below).

- Delete: infra/oip-web/ (removed in #3341), infra/src/OipWeb.ts (removed in #3341), infra/src/Vercel.ts (removed in #3341),
  infra/src/internal/oip-web-entry.ts (removed in #3341), infra/test/OipWeb.test.ts (removed in #3341); plus R1 if folded in.
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
deletes `infra/src/AccountCostControls.ts`, adds infra/src/NotificationRecipients.ts, and breaks
the 2 live spans listed above. Its lane should rewrite them per Q3, or semantic-delta will be red.
It also lowers `@beep/infra` coverage (see "Coverage"). Merge it after R1+R2, or follow it with a
rows-only PR.

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
- Ruled by the gate (Q2): R5 retires the signed-producer, pilot and R2 command family under D7. It
  stays tied to the stage-2 release, and the gate raises it with the orchestrator then.
- Delete, tree: `infra/r2-cache/`, all of it. First confirm that the content of
  `infra/r2-cache/cache-input-review.md` is in `packages/tooling/infra/turbo-cache/README.md`, as the
  SPEC requires.
- Delete, whole workflows (all `workflow_dispatch`, main-only):
  - `.github/workflows/cache-producer-inspect.yml`
  - `.github/workflows/cache-producer-prepare.yml`
  - `.github/workflows/cache-producer.yml`
  - `.github/workflows/cache-local-observe.yml`
- Delete, `heavy.yml` jobs, with the inputs that only select them (`producer_inspection`,
  `producer_preparation`, `producer_execution`, `producer_channel`, `local_pilot_observation`,
  `local_pilot_computation`):
  - `producer-inspect` (line 405)
  - `producer-prepare` (506; its steps "Install pinned portable build tools" and "Build pinned
    portable candidate" read `infra/r2-cache/policy-build-tools.txt`, `policy.sh` and `patches/`)
  - `producer-execute` (733; "Verify selected candidate before issuer delivery" reads the same pins)
  - `local-pilot-observe` (932)
- Delete, steps in jobs that stay:
  - `.github/actions/setup-monorepo-ci/action.yml:316` step "Start optional R2 cache adapter", and
    the action inputs `r2-enabled`, `r2-endpoint`, `r2-bucket`, `r2-access-key-id`,
    `r2-secret-access-key`.
  - Step "Stop R2 cache adapter" in 12 jobs: `check.yml` jobs `labs` (636), `lint-shard` (748),
    `test-unit-shard` (1099), `test-integration-shard` (1295), `property-laws-shard` (1783),
    `fallow-advisory` (1952), `jsdoc-ratchet` (2033); `heavy.yml` `verify` (325); `storybook.yml`
    `storybook` (210); `data-sync.yml` `sync-data` (96); `property-laws-nightly.yml`
    `property-sweep` (123); `shard-overflow.yml` `test-unit-shard` (185).
  - The `r2-*:` arguments that each of those jobs passes to "Setup monorepo CI" (for example
    `check.yml:566-570`, `:695-699`), fed from `vars.TURBO_R2_*` and `secrets.TURBO_R2_*`.
  - `cache-warm.yml` job `warm`: "Start optional R2 cache adapter" (63), "Qualify R2 credentials
    and exact-hash reuse" (74; it runs `beep cache r2 probe`), "Upload sanitized R2 qualification
    receipt" (100), "Stop R2 cache adapter" (109) and the `r2_probe` input.
- Delete, repo-cli (`packages/tooling/tool/cli/src/commands/Cache/`): the subcommands the removed
  workflows call, and their modules.
  - `r2`: `Cache.r2.command.ts`, `Cache.r2.ts`, `Cache.r2.fleet.ts`, `Cache.r2.live.ts`,
    `Cache.r2.schemas.ts`.
  - `pilot`, `signed-pilot`: `Cache.pilot.ts`, `Cache.pilot.capture.ts`, `Cache.pilot.runner.ts`,
    `Cache.pilot.schemas.ts`, `Cache.pilot.signed.ts`, `Cache.pilot.signed.schemas.ts`.
  - `producer-run`, `producer-publish`, `producer-fetch`, `producer-cleanup`, `producer-inspect`,
    `producer-diagnose`, `producer-provision`, `producer-install`: `Cache.producer.ts`,
    `Cache.producer.schemas.ts`.
  - The adapter: `Cache.adapter.ts`, `Cache.adapter.host.ts`, `Cache.adapter.schemas.ts`.
  - Their registrations in `Cache.command.ts:1524-1560`, and `infra/r2-cache` in
    `Cache.workflow.ts:155`.
  - Unsure: `accept` (`Cache.acceptance*.ts`) and the `conformance-*` commands may serve only the
    producer pipeline and the completed conformance goal. The R5 lane decides from the call graph
    (`fallow dead-code --config .fallowrc.jsonc` after the deletions), not from names.
- Delete, tests: `cache-r2.test.ts`, `cache-producer-adapter.test.ts`, the tests of every removed
  module, and the `ci-runner-security.test.ts` expectations for the four removed `heavy.yml` jobs.
  The P5 cutover decision lists those expectations as `producer-inspect`, `producer-prepare` and
  `local-pilot-observe`. Remove `packages/tooling/library/repo-cli-kit/src/cli/EnvConfig.ts:891` and
  `test/turbo-cache.test.ts` too, unless the stage-2 PR already replaced them.
- Notice for the paused goal `turborepo-cache-trust-observability`: it was paused by operator ruling
  (finish board, 2026-11-13) and has no owner lane, so the notice goes to the operator through the
  orchestrator when the gate raises R5. Text: "R5 of `goals/infra-alchemy-rebuild` deletes the
  R2 pilot (`infra/r2-cache`), the patched signed-policy adapter, the four cache-producer and
  observe workflows, the `heavy.yml` producer jobs and the repo-cli `cache r2`, pilot and producer
  commands (D7). The Worker cache (`@beep/infra-turbo-cache`) carries the signed-policy
  semantics. Your SPEC links to `infra/src/CiTurboCache.ts` and `infra/lambda/turbo-cache/src`
  (SPEC 52-53), which R6 deletes; they become plain text plus '(removed in #N)'. On resume, the
  packet re-scopes its producer receipt contract to the Worker." No live backticked spans in that
  packet point at R5 paths (census 2026-11-14); its two links break in R6.
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
  Add: `infra/src/CiTurboCache.ts`, infra/src/NotificationRecipients.ts, `infra/lambda/` and
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

### R6.5: Fix `delete-package`'s path matcher (#3343; must merge before R7)

**Status:** #3343, open at `fb850d55014`. Three beep-reviewer rounds, each fixed in one push:

1. The doctor probes `derived-rebuild`, `authored-reference` and `historical-record` share the dependents scan's matcher.
2. The four path-keyed inventories (`generated-inventory`) use the same matcher, and the PR body tables every matcher in the command.
3. The module doc and the `needleMatcherFor` comment state that coverage.

The gate posts the final.

Ruled by the gate (Q9): fix the matcher at its root, in its own small PR, not by working around it
in R7.

- Root cause: the dependent scan treats the package path as a whole token through
  `mentionsToken`/`mentionsAnyToken` (`packages/tooling/library/repo-cli-kit/src/WholeToken.ts:48-50`).
  The guard there is `(?<![\w$-])<needle>(?![\w$-])`, and its classes do not include `/` or `.`.
  So the needle `infra` matches inside packages/tooling/infra/cost-controls/..., the homepage
  and `srcLink` URLs of every `packages/tooling/infra/*` package, and any other path that only
  contains `/infra/` as an inner segment. The callers pass `[target.packageName, target.packagePath]`
  at `packages/tooling/tool/cli/src/commands/DeletePackage/internal/RegistrationGeometry/RegistrationGeometry.probes.ts:500`,
  `:522` and `:662`. The authored and historical needle lists at `:111`, `:174` and `:254` should
  be checked for the same case.
- Fix: add a repo-path matcher beside `mentionsToken` in `WholeToken.ts` (for example
  `mentionsRepoPath`). It matches the path needle only at a repository-root position: at the start
  of the text, after a character that cannot continue a path, or after a run of `./` or `../`
  segments. It refuses a match preceded by `<segment>/`. Use it for `target.packagePath` at the three
  call sites. Leave `mentionsToken` unchanged for package names: its lookahead already keeps
  `@beep/infra` from matching `@beep/infra-hosts`.
- Tests, both failing today:
  - `packages/tooling/library/repo-cli-kit/test/cli-helpers.test.ts` (the existing WholeToken
    test): the matcher for `infra` is false for
    `packages/tooling/infra/cost-controls/package.json` and for
    `https://github.com/beep-effect/beep-effect/tree/main/packages/tooling/infra/cost-controls`.
    It stays true for `infra/package.json`, `"./infra/src/index.ts"`, ../../infra/src/CiTurboCache.ts
    and a bare `infra` in `"workspaces": ["infra"]`.
  - `packages/tooling/tool/cli/test/delete-package.test.ts`: in a fixture repository holding a
    root-level `infra` workspace and a packages/tooling/infra/x workspace, a dry-run deletion of
    the root package reports no dependent hit in packages/tooling/infra/x/package.json.
- repo-cli tests must pass on Node and on Bun (repo rule). Run both suites for the two files, then
  `bun run beep quality package-verify @beep/repo-cli-kit` and `@beep/repo-cli`.
- Check afterwards: `bun run beep delete-package @beep/infra --dry-run` on the new head lists no
  `packages/tooling/infra/**` hit.

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
  must clear: (1) 353 dependent hits; R6.5 removes the false matches on `packages/tooling/infra/`, and
  the rest are the R7 rows of section 1.5; (2) `--prune-catalog` needs proof that no survivor lists
  `@pulumi/pulumi`, so R2, R4 and R6 must have removed every other `@pulumi/*` user; (3) a packet
  reference in `goals/_template/GOAL.md`, which takes `--rewrite-packets` (Q3 ruling).
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
  `Pulumi.yaml`); `AccountsSecretsLayout.service.ts:52` and the 1Password layout row: R7 does not rename the kept
  passphrase field (Q5); it marks the row "kept for the Pulumi export archive" and drops the
  rename proposal.
- Provenance prose (Q10 ruling: not allowed residue): R7 removes "replaces the Pulumi ..." and
  similar Pulumi provenance from package source, JSDoc and READMEs. Today that means
  `packages/tooling/infra/cost-controls` (`README.md` 4, 22, 31, 58-63; `src/Config.ts` 101-104,
  239-243, 295; `src/CostControls.ts` 30, 72, 193; `alchemy.run.ts` 20; `test/support/FakeAws.ts` 95),
  `packages/tooling/infra/infra-hosts` (`README.md` 3, 57-61; `src/AiMetricsStack.ts` 6;
  `src/OpenClawStack.ts` 7, 20; `src/OpenClawGeneration.ts` 14-16), `apps/oip-web` (`README.md`
  46-119; `alchemy.run.ts` 4; `stack/OipWebStack.ts` 4-5, 140; `stack/OipWebConfig.ts` 42, 149, 170,
  374-375; `test/stack/FakeCloud.ts` 397), `packages/tooling/library/alchemy-vercel/src/Project.ts` 66,
  `packages/tooling/library/alchemy-github-runners/README.md` 6 and
  `packages/tooling/library/alchemy-aws-extras/README.md` 5. Keep only the DNS comment string (Q4).
  The `opip-web` bucket fakes (`FakeCloud.ts` 440 `ManagedBy: "pulumi"`) and the
  `ReservedBucketName` entries for the Pulumi buckets should already have left with R2, because
  those buckets were deleted.
- Changesets: none. `@beep/infra`, `@beep/identity` and every other package R7 edits are
  `private: true` (Q7).
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
| R1 Storybook + lab | the OIP web deletion lane (folded into R2) | done: #3341 merged 2026-11-14 13:35Z |
| R2 OIP web | the OIP web deletion lane | done: #3341 merged 2026-11-14 13:35Z; the armed deploy (run 43600573838) planned no changes |
| (cost-controls) | P3 cost-controls lane | not before 2026-11-15T05:18Z. R1+R2 have merged, so the coverage merge-order note is satisfied; gates R5 and R6 |
| R4 hosts | hosts lane | the attended AI metrics cutover |
| R5 R2 pilot | turbo-cache lane | the 2026-11-20T20:10Z verdict, the stage 2 PR, the R2 teardown |
| R6 fleet + AWS cache + SDK | P5 lane (step 6e) | the verdict, the cost-controls PR, P5 steps 0-6d |
| R6.5 delete-package matcher | this lane (#3343) | open at `fb850d55014`; the gate posts the final |
| R6.6 delete-package acknowledgements + tracked-file scan | a repo-cli lane | #3343 merged; mechanism ruled (section 6.6) |
| R7 package removal | P6/P7 final lane | R2, R4, R5, R6, R6.5, R6.6 merged |

## 3. Verification matrix rows as exact commands

Run on `main` after R7 merges. Each must print nothing, or exit 0 where stated.

The SPEC's "Pulumi gone" row, unchanged:

```sh
rg -n '@pulumi|pulumiverse|typescript6' package.json packages apps bun.lock
```

It matched `package.json` (101-105, 380), `bun.lock` (26 lines) and three test locations at 653c2cdef18. After #3341 it matches `package.json` 101-103 and 378 and `bun.lock` (20 lines), plus the same test locations
(section 1.5). The codec fixture and the two test fixtures need renaming for the row to pass. The
row's scope misses residue elsewhere, so R7 also runs these wider checks:

```sh
# No Pulumi or TS6 anywhere except dated records.
rg -n -i 'pulumi|typescript6|typescript@6' --hidden \
  -g '!.git' -g '!.repos' -g '!goals/**' -g '!explorations/**' -g '!research/**' \
  -g '!docs/history/**' -g '!docs/reports/**' -g '!hold-ledger/claims.jsonl' -g '!hold-ledger/runs.jsonl' \
  -g '!standards/architecture/DECISIONS.md' -g '!standards/cache-conformance/**' \
  -g '!beep-effect.iml' -g '!docs/agent-memory-infra/**' . \
  | rg -v -F 'Managed by Pulumi for oip.law Vercel routing.'
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
- The DNS comment string "Managed by Pulumi for oip.law Vercel routing." (filtered out by the
  `rg -v -F` above). It is declared as `dnsRecordComment` at `apps/oip-web/stack/OipWebStack.ts:66`
  and mirrored by the fake cloud at `apps/oip-web/test/stack/FakeCloud.ts:433`. It matches the six live
  Cloudflare record comments the `OipWeb` stack adopted unchanged. Gate ruling (Q4): leave them.
  Changing them needs a DNS write the Alchemy token lacks, and a comment is not worth a record write
  on oip.law. Correct the string and the six comments the next time those records change for a real
  reason. Only the exact string is allowed; any other Pulumi text in those two files is not.
- Not allowed (Q10 ruling): "replaces the Pulumi ..." provenance prose in package source, JSDoc and
  READMEs. R7 removes it; the history stays in the decision files and the exploration, which the
  search excludes.

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

The last command must print `None` (no `.json` stack file; the `.bak` files end in `.json.bak`). The
bucket itself stays (Q5 ruling): the row is "the backend holds no stack", not "the bucket is gone". The `rg` probe for
`(^|[^a-zA-Z/_.-])infra/` still matches `.gitignore:71` (`/docs/infra/`, unrelated); the
`[^a-zA-Z/_.-]` class excludes it only after a slash, so add `-g '!.gitignore'` if it shows.

## 4. Risks and open questions for the gate

Capabilities that `infra/` provides and no Alchemy stack replaces:

1. **The signed-producer cache pipeline** (ruled under Q2: retired in R5) (the four `cache-*` dispatch workflows, the `heavy.yml`
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

Open questions, each ruled by the gate on 2026-11-14 (the question is kept as asked, with its ruling
and any evidence gathered after it):

- **Q1 (ordering of AWS cache removal):** destroy the `CiTurboCache` component with the whole stack
  at P5 step 6d (recommended: one Pulumi operation, after stage 2), or as a targeted destroy right
  after stage 2? The second means one more Pulumi operation on the frozen stack.
  **Ruled by the gate, 2026-11-14:** with P5's whole-stack destroy. Fallback: if P5 slips more than
  a week past the stage-2 repoint (for example the 11-20 verdict releases stage 2 but holds the fleet
  for window 6), the gate runs an attended targeted destroy of the cache component then, following
  the cost-controls pattern (fresh export archived and named in a decision first, then the destroy
  by target).
- **Q2:** see risk 1.
  **Ruled by the gate, 2026-11-14:** yes, R5 retires the signed-producer, pilot and R2 command family
  under D7. It is CI-affecting and the paused goal `turborepo-cache-trust-observability` links to
  those paths, so R5 stays tied to the stage-2 release and the gate raises it with the orchestrator
  then. R5's entry (section 2) lists the exact files and CI steps and the notice text for that goal.
- **Q3 (historical records and the knowledge gate):** decision files and closed packets are live to
  `semantic-delta`. When a deletion breaks a backticked path in one, should the PR (a) rewrite the
  span to a commit-pinned GitHub permalink of the last commit that had the file, (b) un-backtick it
  and add "(removed in #N)", or (c) teach the knowledge scanner to treat `goals/*/decisions/` and
  closed packets as archival? (c) is a repo-cli change with wider effect. (b) is the smallest. The
  same answer settles `delete-package`'s `--rewrite-packets` versus `--allow-stale-packets` for
  `goals/_template/GOAL.md`.
  **Ruled by the gate, 2026-11-14:** (b). In the PR that deletes the path, rewrite the span as plain
  text followed by "(removed in #N)". No scanner change and no archival exemption. Decision files
  are dated records, so the rewrite touches only the backticks and adds the removal note, never the
  reasoning. For the template packet, use `--rewrite-packets`.
- **Q4:** reword the live Cloudflare DNS comments "Managed by Pulumi for oip.law Vercel routing."
  (one `OipWeb` deploy, plus `OipWebStack.ts:66` and the fake cloud test), or keep them as inert text?
  **Ruled by the gate, 2026-11-14:** leave them. Changing them needs a DNS write the Alchemy token
  lacks, and a record write on oip.law is not worth making for a comment. The declared string in
  `apps/oip-web` and the six live comments are allowed residue in the "Pulumi gone" check, with that
  reason (section 3). They are corrected the next time those records change for a real reason.
- **Q5 (backend and passphrases):** after R6, keep `oip-law-pulumi-state` as a cold archive and keep
  both passphrase fields, or copy the bucket into the out-of-repo archive and delete the bucket?
  Deleting a passphrase makes the encrypted secrets in every export unreadable, which weakens the
  `pulumi stack import` reversals the decision files promise.
  **Ruled by the gate, 2026-11-14:** keep both. They are what make the archived exports restorable,
  and deleting either is irreversible and the operator's to decide. The "Pulumi gone" row is "the
  backend holds no stack", not "the bucket is gone". Both go on the closeout's operator list
  (section 5, step 7).
- **Q6:** `beep-turbo-cache-lab/lab-c1023a` has no stack file and no decision record. Run the lab's
  read-only inventory (or a tag query) to confirm nothing tagged for the lab survives before R1
  deletes the only script that lists it, and record a short decision.
  **Ruled by the gate, 2026-11-14:** check it now, read-only, before R1 deletes the script.
  **Result (2026-11-14, read-only, `AWS_PROFILE=elpresidank-vault`, `us-east-1`, each call once):**
  - What it was: the disposable AWS conformance lab of the completed goal
    `turborepo-cache-conformance`. Epoch `c1023a`, Pulumi stack `beep-turbo-cache-lab/lab-c1023a`.
    The program (infra/src/internal/turbo-cache-lab-entry.ts (removed in #3341)) deployed two `CiTurboCache`
    components, an incumbent and an "evolved" incumbent. Each had an S3 bucket
    (`beep-tcl-c1023a-832907639880` and `beep-tcl-c1023a-evo-832907639880`), an HTTP API with its
    authorizer, reader and writer Lambdas, their IAM roles and log groups. `lab-aws.sh bootstrap`
    added one KMS key and three SecureStrings under `/beep-ci/cache-lab/c1023a/`. Every resource
    carries the tags `beep:lab=turbo-cache-conformance` and `beep:lab-epoch=c1023a`.
  - Lifetime, from the backend's four backups of that stack: first update 2026-10-24T01:12:05Z
    (100 KB checkpoint), grown at 02:23:46Z (201 KB, both incumbents), last full checkpoint
    03:21:10Z (191 KB), then 03:21:59Z at 392 bytes, an empty deployment. That fits `lab-aws.sh
    destroy`: a targeted destroy of the bucket policies, bucket emptying, a full destroy and
    `pulumi stack rm`, which leaves only the `.bak`.
  - Live today: nothing.
    - `resourcegroupstaggingapi get-resources` with `beep:lab-epoch=c1023a`: none.
    - The same with `beep:lab=turbo-cache-conformance` (any epoch): none.
    - `ssm describe-parameters` under `/beep-ci/cache-lab/`: none.
    - `logs describe-log-groups` with prefix `/aws/lambda/beep-tcl-`, and with pattern `beep-tcl`: none.
    - `iam list-roles` starting `beep-tcl`: none.
    - `s3api list-buckets` starting `beep-tcl`: none.
    - The 7-day KMS deletion window has long passed, and the key no longer shows in the tag query.
  - Cost: nothing accrues. The only remnants are five small objects in the Pulumi backend (the
    `.bak` and four backups, about 0.5 MB), which stay with the bucket (Q5).
  - Consequence: no removal procedure is needed. R1 may delete infra/turbo-cache-lab/lab-aws.sh (removed in #3341)
    with the program. #3341 did both: it deleted the script and recorded this result in
    `goals/infra-alchemy-rebuild/decisions/2026-11-14-turbo-cache-lab-lab-c1023a-was-destroyed-on-2026-10-24-nothing-is-live.md`. Note that
    `lab-aws.sh` cites standards/cache-conformance/lab-deployment-preview.md (plain text: no such file) for the approved cost
    ceiling, and that document is not in the tree.
- **Q7:** is removing `$InfraId` from `@beep/identity` an identity-major change
  (`delete-package --identity-major`)? Nothing outside `infra/` imports it.
  **Ruled by the gate, 2026-11-14:** follow the changeset gate. **Answer:** no changeset.
  - `bun run beep quality changeset-status` checks only workspaces that are publish-enabled
    (`publishEnabled: document.private !== true`,
    `packages/tooling/tool/cli/src/commands/Quality/ChangesetStatus.ts:550`), versioned and not
    ignored (`:360`).
  - `@beep/identity` is `"private": true` (version 0.1.1; its `publishConfig` block is inert while
    the package is private). `.changeset/config.json` has `privatePackages: { version: false, tag: false }`.
  - Every package R7 edits is private too: `@beep/infra`, `@beep/repo-cli`, `@beep/repo-cli-kit`,
    `@beep/repo-utils`, `@beep/config-file`, `@beep/lint-rules`, `@beep/repo-ai-metrics`.
  - `delete-package --identity-major` only prints that the deletion note "remains empty until an
    identity release policy writer is ratified" (`DeletePackage.command.ts:784-786`). R7 omits it.
- **Q8 (coverage baseline writer):** which command rewrites only the `@beep/infra` totals and rows
  of `standards/coverage.regression-baseline.jsonc` from a hosted run? The cost-controls lane
  removed a file row by hand and left the totals. Unsure whether the hosted ratchet accepts that or
  needs re-measured totals.
  **Ruled by the gate, 2026-11-14:** find the exact command and state what a deletion PR must do.
  **Answer:**
  - The writer: `bun run coverage:baseline:write` (`package.json:359`,
    `beep-cli coverage -- --write-baseline --concurrency=3`; the ratchet names it as
    `coverageRegressionRegenerationCommand`, `CoverageRegression.ts:80`). Unscoped, it re-measures
    the workspace and rewrites the whole document.
  - It can be limited to one package with exact selectors, `bun run coverage:baseline:write
    --filter=@beep/infra`. The selectors must name exact workspace packages that define coverage
    (`Tasks.ts:826-833`).
  - A scoped write adopts the changed owners and their dependents. `--replace-all` is "the
    deliberate re-measure path" that adopts every package the run measured (`Tasks.ts:1103-1110`).
  - `--add-missing-files-only` with exact `--filter` selectors adds only new file rows
    (`Tasks.ts:1032-1035`).
  - Its input is a local measurement (it runs the selected packages' coverage tasks). It does not
    read hosted artifacts. The local-coverage ruling of 2026-11-13 therefore applies.
  - What a deletion PR must do: delete the removed files' rows by hand (delete-only, every other
    byte unchanged) and leave the `@beep/infra` totals alone. The PR owns changed `@beep/infra`
    files, so the ratchet judges it at `main`'s floor whatever totals the PR writes. A lowered
    total in the PR is withheld, not accepted. The PR passes when the measured percentage does not
    fall (section 2, "Coverage"). R1, R2, R4 and R6 raise it; the cost-controls PR lowers it.
  - When a total must come down: a rows-only PR that edits just the baseline file (the one changed
    path exempt from the global-input test). There `@beep/infra` self-judges and the lowered row is
    accepted. Its values come from the hosted Coverage Regression report of `main` after the
    deletion merged, or, for a package as small as `@beep/infra` (19 source files), from
    `bun run coverage:baseline:write --filter=@beep/infra` under `nice -n 19 ionice -c3` if the
    gate allows that one local run.
  - That rows-only PR is the only case where the ratchet accepts a lowered row. R7
    needs none of this: a deleted package is retired (`retiredByProposal`).
- **Q9:** `delete-package`'s dependent scan counts `packages/tooling/infra/**` (for example
  `packages/tooling/infra/cost-controls/package.json:8`) as hits on the path `infra`. Fix the
  matcher in R7 or before it, or accept `--also`/manual removal? It refuses dependents regardless
  of `--force`.
  **Ruled by the gate, 2026-11-14:** fix the matcher at the root, in its own small repo-cli PR before
  R7, not as a workaround in R7. Added to the plan as R6.5 (section 2), with the root cause
  (`WholeToken.ts:48-50`), the call sites, the two failing tests, and the rule that repo-cli tests
  pass on Node and Bun.
- **Q10:** should the "Pulumi gone" check also cover provenance prose in the Alchemy packages
  ("replaces the Pulumi ..."), or is that allowed residue?
  **Ruled by the gate, 2026-11-14:** not allowed residue. R7 removes it from package source, JSDoc
  and READMEs (the list is in R7's entry). The history lives in the decision files and the
  exploration, which the check excludes.

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
| | "OipWeb" / "Cutover from Pulumi" | #3341 already rewrote it as a dated "done" section; it shrinks to a short historical note that points at `goals/infra-alchemy-rebuild/decisions/2026-11-14-oipweb-cutover-procedure-from-pulumi.md` |
| | "Turbo cache" | drops "until CI is flipped (cutover stage 2)"; the Worker is the only cache; token issue and rotate stay |
| | new "Runner fleet" | from `@beep/infra-ci-runners`: deploy, phases, bake-to-config, reaper, rollback |
| | new "Retired: Pulumi" | where the export archive lives (described, not a home path), which passphrase field decrypts which archive, and the `pulumi stack import` recipe from the decision files |
| `docs/runbooks/ci-runner-reliability.md` | pool table, "Deploy and verify" | new fleet names and the Alchemy deploy workflow (R6 already does most of this) |
| `docs/runbooks/aws-cost-operations.md` | runner image / AMI pin; state census row; stack table 627-628 | bake writes the stack config; the Pulumi state row becomes the archive row; the OIP and CI rows name the Alchemy stacks |
| `docs/runbooks/typescript-toolchain.md` | intro (5), "infra/Pulumi" (625-637) | the TS6 paragraph is deleted; only ts-morph's bundled TS6 is mentioned |
| `standards/turbo-remote-cache.md` | whole document | the Worker contract (if stage 2 did not already rewrite it) |
| `docs/runbooks/onepassword-beep-secrets-layout.md:70` | rename table | row kept and marked "kept for the Pulumi export archive"; the rename proposal is dropped (Q5) |
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
   Pulumi CLI mise entry and backend logins, and the old fleet's SSM, KMS and boundary per P5 step 6f.
7. Operator list, handed over in the closeout prompt and not acted on by agents (Q5 ruling): the
   decision whether to keep or delete `s3://oip-law-pulumi-state` (versioned, so deletion removes
   every version) and the two passphrase fields, `PULUMI_ENCRYPTION_PASSPHRASE` in
   `BEEP_SECRETS/BEEP_SECRETS` and `PULUMI_CONFIG_PASSPHRASE` in `BEEP_SECRETS/OIP_SECRETS`. Both
   are what make the archived exports restorable, and deleting either is irreversible. Also on the
   list: the six oip.law DNS comments (Q4), to correct at their next real change.

## 6. Revision 3: dependents residue and the R6.6 design

Read-only, 2026-11-14. Measured with `bun run beep delete-package @beep/infra --dry-run` at #3343's
head `4810cc93ccc`, on a tree with gitignored local build output removed. Result: 330 hard dependent
hits (329 `file-path` and 1 `script`). Nothing was applied. Revision 4 re-measured after #3341 merged: 325 (6.2).

### 6.1 What `delete-package` offers for acknowledged residue today

Nothing that accepts named hits. Read from
`packages/tooling/tool/cli/src/commands/DeletePackage/DeletePackage.command.ts:867-889` and
`DeletePackage.policy.ts`:

- The refusal rule for hard dependents (`DeletePackage.policy.ts:79-85`) refuses whenever any hit
  of a hard kind (`manifest-*`, `import-prod`, `import-test`, `script`, `file-path`) exists. No
  flag, input or plan file filters that list.
- Every refusal, hard or soft, fails the run before dry-run, check or apply
  (`DeletePackage.command.ts:845-848`).
- `--force` is decorative. It is parsed (`:883`) and copied into `DeletePackagePolicy.force`
  (`:701`), but no refusal rule reads it. The refusal text says so: "--force never overrides
  dependents".
- `--also` is dead. It is parsed (`:878`) and typed (`:671`), and nothing reads it.
- `--rewrite-packets` and `--allow-stale-packets` do the same thing. Each only suppresses the soft
  `packet-claim` refusal (`DeletePackage.policy.ts:136`). Neither rewrites anything. For the Q3
  ruling, the template packet (`goals/_template/GOAL.md`) still has to be edited by hand, and the
  flag only stops the refusal.
- `--cascade`, `--allow-published`, `--prune-catalog`, `--drop-data` and `--allow-non-local-data`
  gate other refusals, not dependents.
- No human-edited plan file exists. The printed inverse plan is output only.

### 6.2 The dependents, by the PR that removes them

Re-measured on this PR's tree, which is `main` at `e051bd152f3` plus this PR's edits, with gitignored build output
removed. The command was #3343's CLI (`fb850d55014`), run from that branch's worktree because this branch does not
contain the R6.5 matcher yet: `delete-package @beep/infra --dry-run` reports **325** hard hits (324 `file-path`, 1
`script`). This branch's own CLI reports 348; the difference is the 23 sibling false matches R6.5 removes. The
first measurement, at #3343's `4810cc93ccc` before #3341 merged, was 330. #3341 changed no counted line except the
three `apps/oip-web` rewrites below. This PR removes 5 hits, all R7: those three references and
`no-manual-effect-runtime-in-tests.ts:61-62`.

| Removed by | Hits | Notes |
| --- | --- | --- |
| R1 + R2 (#3341) | 0 | #3341 rewrote the three `apps/oip-web` lines to plain text plus "(removed in #3341)", and the path text still matched. It also left the `LEGACY_BASELINE` entries for its two deleted tests in `no-manual-effect-runtime-in-tests.ts:61-62`, and those are hits too: the hit is the path text in the scanned rule file. The P6 housekeeping PR removes all five, so R7 falls from 212 to 207. |
| Cost-controls removal | 0 | No hit is in a file it changes. |
| R4 (hosts) | 8 | AI metrics installer and tests, `infra-hosts` provenance, the AIMetrics allowlist entry. |
| R5 (R2 pilot) | 57 | `Cache.r2*`, adapter, producer tests, every `r2-cache` CI line, the tracked-shell test fixture. |
| R6 (fleet) | 25 | `beep runners bake`, overflow preflight, SDK and Lambda exclusions, `check.yml:421`. |
| R7 (package removal) | 207 (212 before the P6 housekeeping PR removed 5) | Scan roots, globs, the `infra` package kind, coverage and partition rows, the root policy files, and Q10 provenance prose. Four of these only borrow the word as fixture text (6.3). |
| True residue | 28 | Listed in 6.3. |

If every earlier PR merges, the command sees **235** hits when R7 starts (207 + 28). The table sums to the measured 325: 8 + 57 + 25 + 207 + 28. After R7's own
edits it sees **32**: the 28 residue lines plus the 4 borrowed fixture lines, or 28 if R7 renames
those four. Lines that R4 to R6 or other lanes add before R7 are not predicted. One case is
predictable: a Q3 rewrite in a hard-scanned file (anything under `packages/`, `apps/`, `.github/`, or
a root policy file) keeps the `infra/...` text and stays a dependent. In those files a PR should
drop the reference (Q10), not rewrite it. Q3 rewrites under `goals/`, `explorations/` and
`research/` are classed as `packet`, `historical-doc` or `baseline`, which do not block.

Per-file detail (line numbers on this PR's tree, at the 325-hit measurement):

R4:

| File | Hits | Lines |
| --- | --- | --- |
| `packages/tooling/infra/infra-hosts/README.md` | 1 | 89 |
| `packages/tooling/infra/infra-hosts/src/OpenClawGeneration.ts` | 2 | 14, 16 |
| `packages/tooling/library/ai-metrics/README.md` | 1 | 27 |
| `packages/tooling/library/ai-metrics/src/install.ts` | 1 | 1034 |
| `packages/tooling/library/ai-metrics/test/ingest.test.ts` | 1 | 1895 |
| `packages/tooling/policy-pack/lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts` | 1 | 60 |
| `packages/tooling/tool/cli/test/ai-metrics-command.test.ts` | 1 | 788 |

R5:

| File | Hits | Lines |
| --- | --- | --- |
| `.github/actions/setup-monorepo-ci/action.yml` | 2 | 331, 332 |
| `.github/workflows/cache-warm.yml` | 2 | 112, 72 |
| `.github/workflows/check.yml` | 14 | 1103, 1104, 1299, 1300, 1787, 1788, 1956, 1957, 2037, 2038, 640, 641, 752, 753 |
| `.github/workflows/data-sync.yml` | 2 | 100, 101 |
| `.github/workflows/heavy.yml` | 11 | 329, 330, 598, 600, 638, 640, 664, 665, 691, 849, 850 |
| `.github/workflows/property-laws-nightly.yml` | 2 | 127, 128 |
| `.github/workflows/shard-overflow.yml` | 2 | 189, 190 |
| `.github/workflows/storybook.yml` | 2 | 214, 215 |
| `packages/tooling/tool/cli/src/commands/Cache/Cache.adapter.host.ts` | 1 | 5 |
| `packages/tooling/tool/cli/src/commands/Cache/Cache.r2.command.ts` | 2 | 108, 120 |
| `packages/tooling/tool/cli/src/commands/Cache/Cache.r2.fleet.ts` | 2 | 143, 5 |
| `packages/tooling/tool/cli/src/commands/Cache/Cache.r2.live.ts` | 2 | 207, 284 |
| `packages/tooling/tool/cli/src/commands/Cache/Cache.r2.schemas.ts` | 2 | 430, 5 |
| `packages/tooling/tool/cli/src/commands/Cache/Cache.r2.ts` | 1 | 5 |
| `packages/tooling/tool/cli/src/commands/Cache/Cache.workflow.ts` | 1 | 155 |
| `packages/tooling/tool/cli/test/cache-producer-adapter.test.ts` | 2 | 106, 397 |
| `packages/tooling/tool/cli/test/cache-r2.test.ts` | 2 | 572, 730 |
| `packages/tooling/tool/cli/test/ci-runner-security.test.ts` | 4 | 194, 3118, 3121, 3122 |
| `packages/tooling/tool/cli/test/laws-tracked-shell-allowlist.test.ts` | 1 | 51 |

R6:

| File | Hits | Lines |
| --- | --- | --- |
| `.github/workflows/check.yml` | 1 | 421 |
| `packages/tooling/library/alchemy-github-runners/README.md` | 1 | 6 |
| `packages/tooling/library/repo-utils/src/schemas/TypeScriptSourceExclusions.ts` | 1 | 35 |
| `packages/tooling/tool/cli/src/commands/Ci/CiShardOverflow.ts` | 1 | 81 |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts` | 1 | 404 |
| `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts` | 1 | 56 |
| `packages/tooling/tool/cli/src/commands/Quality/internal/TestTsgoPrograms.ts` | 2 | 30, 32 |
| `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` | 3 | 1521, 2555, 2556 |
| `packages/tooling/tool/cli/src/commands/Quality/Quality.plan.ts` | 1 | 87 |
| `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts` | 2 | 851, 892 |
| `packages/tooling/tool/cli/test/ci-route-classify.test.ts` | 1 | 362 |
| `packages/tooling/tool/cli/test/effect-imports.test.ts` | 1 | 228 |
| `packages/tooling/tool/cli/test/fixtures/dependency-review/manifest-inventory.json` | 3 | 1148, 193, 198 |
| `packages/tooling/tool/cli/test/quality-tsgo-profile.test.ts` | 2 | 213, 214 |
| `packages/tooling/tool/cli/test/runners-bake.test.ts` | 3 | 314, 454, 79 |
| `packages/tooling/tool/cli/test/schema-first.test.ts` | 1 | 134 |

R7:

| File | Hits | Lines |
| --- | --- | --- |
| `apps/todox/vercel.json` | 1 | 7 |
| `biome.jsonc` | 1 | whole file |
| `.github/workflows/catalog-regeneration.yml` | 1 | 75 |
| `.github/workflows/check.yml` | 1 | 1065 |
| `.github/workflows/heavy.yml` | 1 | 176 |
| `.github/workflows/shard-overflow.yml` | 1 | 151 |
| `lefthook.yml` | 1 | whole file |
| `package.json` | 1 | whole file |
| `packages/foundation/capability/config-file/test/fixtures/codec-corpus/yaml/Pulumi.yaml` | 1 | 5 |
| `packages/foundation/capability/walker/test/Descend.test.ts` | 1 | 604 |
| `packages/tooling/infra/turbo-cache/README.md` | 2 | 50, 6 |
| `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScriptsPolicy.ts` | 1 | 146 |
| `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScripts.schemas.ts` | 28 | 1001, 1045, 1082, 1119, 1156, 1193, 1230, 1272, 1314, 1346, 1383, 1420, 1462, 1499, 1541, 1578, 1615, 1741, 1743, 1747, 1748, 1750, 1755, 1760, 1765, 1766, 266, 62 |
| `packages/tooling/library/repo-cli-kit/test/package-scripts.policy.test.ts` | 14 | 104, 107, 122, 123, 126, 166, 176, 177, 178, 184, 186, 187, 203, 40 |
| `packages/tooling/library/repo-cli-kit/test/package-scripts.schemas.test.ts` | 3 | 121, 123, 192 |
| `packages/tooling/library/repo-utils/test/schemas/PackageJson.test.ts` | 1 | 383 |
| `packages/tooling/policy-pack/lint-rules/README.md` | 2 | 28, 74 |
| `packages/tooling/policy-pack/lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts` | 1 | 53 |
| `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts` | 3 | 405, 587, 640 |
| `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` | 1 | 2259 |
| `packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json` | 1 | 5 |
| `packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts` | 2 | 529, 602 |
| `packages/tooling/tool/cli/src/commands/Ci/CiPartitions.service.ts` | 1 | 76 |
| `packages/tooling/tool/cli/src/commands/DeletePackage/internal/RegistrationGeometry/RegistrationGeometry.plan.ts` | 1 | 183 |
| `packages/tooling/tool/cli/src/commands/DeletePackage/internal/RegistrationGeometry/RegistrationGeometry.probes.ts` | 1 | 42 |
| `packages/tooling/tool/cli/src/commands/Docgen/internal/Workspace.ts` | 1 | 36 |
| `packages/tooling/tool/cli/src/commands/Goals/Harvest.schemas.ts` | 1 | 191 |
| `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts` | 1 | 1376 |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts` | 1 | 361 |
| `packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts` | 1 | 60 |
| `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts` | 1 | 329 |
| `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts` | 1 | 50 |
| `packages/tooling/tool/cli/src/commands/Laws/RetiredIriAuthorities.model.ts` | 1 | 250 |
| `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts` | 1 | 116 |
| `packages/tooling/tool/cli/src/commands/Laws/TrackedShellAllowlist.model.ts` | 2 | 31, 51 |
| `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestScan.ts` | 1 | 588 |
| `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstPolicy.ts` | 1 | 82 |
| `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstProject.ts` | 1 | 37 |
| `packages/tooling/tool/cli/src/commands/Lint/LintDeprecatedApis.schemas.ts` | 6 | 112, 152, 24, 30, 84, 85 |
| `packages/tooling/tool/cli/src/commands/Lint/LintJsdoc.command.ts` | 1 | 81 |
| `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts` | 8 | 1747, 1754, 1755, 1756, 1757, 1807, 1814, 58 |
| `packages/tooling/tool/cli/src/commands/Lint/PackageTestTypecheck.ts` | 1 | 72 |
| `packages/tooling/tool/cli/src/commands/Lint/TsconfigOverlay.ts` | 1 | 64 |
| `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts` | 3 | 156, 167, 373 |
| `packages/tooling/tool/cli/src/commands/Quality/internal/TestTsgoPrograms.ts` | 1 | 36 |
| `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` | 4 | 3174, 355, 358, 459 |
| `packages/tooling/tool/cli/test/build-turbo-outputs.test.ts` | 1 | 83 |
| `packages/tooling/tool/cli/test/catalog-shard-scope.test.ts` | 10 | 160, 210, 216, 45, 46, 74, 88, 89, 91, 92 |
| `packages/tooling/tool/cli/test/ci-coverage.test.ts` | 20 | 1035, 1041, 1046, 1048, 507, 509, 521, 552, 557, 569, 603, 606, 611, 614, 620, 639, 641, 691, 694, 999 |
| `packages/tooling/tool/cli/test/ci-docs-policy.test.ts` | 1 | 121 |
| `packages/tooling/tool/cli/test/ci-runner-security.test.ts` | 2 | 1809, 498 |
| `packages/tooling/tool/cli/test/commands/Goals/Harvest.test.ts` | 4 | 175, 318, 320, 321 |
| `packages/tooling/tool/cli/test/coverage-scope-tooling-input-owners.test.ts` | 3 | 193, 23, 30 |
| `packages/tooling/tool/cli/test/delete-package.test.ts` | 3 | 308, 310, 316 |
| `packages/tooling/tool/cli/test/doctest-lane.test.ts` | 1 | 37 |
| `packages/tooling/tool/cli/test/effect-fn.test.ts` | 1 | 51 |
| `packages/tooling/tool/cli/test/effect-imports.test.ts` | 11 | 1055, 1062, 1071, 1449, 1456, 1468, 1514, 1520, 1532, 1572, 1575 |
| `packages/tooling/tool/cli/test/effect-vitest-files.test.ts` | 1 | 56 |
| `packages/tooling/tool/cli/test/fixtures/dependency-review/manifest-inventory.json` | 1 | 203 |
| `packages/tooling/tool/cli/test/frozen-grant-set.test.ts` | 1 | 44 |
| `packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts` | 4 | 281, 45, 47, 52 |
| `packages/tooling/tool/cli/test/Holds.inventory.test.ts` | 3 | 222, 239, 269 |
| `packages/tooling/tool/cli/test/laws-package.test.ts` | 1 | 137 |
| `packages/tooling/tool/cli/test/laws-retired-iri-authorities.test.ts` | 1 | 399 |
| `packages/tooling/tool/cli/test/lint-command.test.ts` | 9 | 104, 301, 302, 347, 349, 358, 407, 470, 650 |
| `packages/tooling/tool/cli/test/lint-workers.test.ts` | 7 | 227, 276, 297, 592, 752, 767, 775 |
| `packages/tooling/tool/cli/test/policy-fingerprint-turbo-inputs.test.ts` | 2 | 493, 536 |
| `packages/tooling/tool/cli/test/root-tasks-turbo-inputs.test.ts` | 7 | 1014, 217, 58, 68, 77, 958, 984 |
| `packages/tooling/tool/cli/test/schema-first.test.ts` | 1 | 208 |
| `turbo.json` | 1 | whole file |

### 6.3 True residue: hits that survive every PR

Each line names `infra` as a word, not as the root package or path. None of them will be deleted.

| Path:line | Text (abridged) | Why it matches |
| --- | --- | --- |
| `packages/tooling/infra/cost-controls/package.json:16` | `"kind": "infra"` | tooling kind value |
| `packages/tooling/infra/infra-hosts/package.json:16` | `"kind": "infra"` | tooling kind value |
| `packages/tooling/infra/turbo-cache/package.json:16` | `"kind": "infra"` | tooling kind value |
| `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:150` | `VALID_TOOLING_KINDS = [..., "infra"]` | tooling kind list |
| `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1162` | "Tooling supports: library, tool, policy-pack, test-kit, infra" | tooling kind help text |
| `packages/tooling/library/repo-utils/src/schemas/PackageJson.ts:299` | `BeepToolingKind = S.Literals([..., "infra"])` | tooling kind schema |
| `packages/tooling/tool/cli/test/create-package.test.ts:107` | `kind: S.Literals([..., "infra"])` | tooling kind test |
| `packages/tooling/tool/cli/test/create-package.test.ts:1401` | "creates infra packages under packages/tooling/infra with the infra kind" | tooling kind test |
| `packages/tooling/tool/cli/test/create-package.test.ts:1422` | `"infra",` (create-package argv) | tooling kind test |
| `packages/tooling/tool/cli/test/create-package.test.ts:1435` | `path.join(rootDir, "packages", "tooling", "infra", ...)` | a sibling path split into `path.join` arguments, which no prefix rule can see |
| `packages/tooling/tool/cli/test/create-package.test.ts:1440` | `kind: "infra"` | tooling kind test |
| `packages/drivers/git/test/integration/Git.int.test.ts:451` | "...runCollected's generic infra..." | prose |
| `packages/drivers/runpod/AGENTS.md:7` | "...infra consumers depend on..." | prose |
| `packages/drivers/runpod/CLAUDE.md:7` | the same line (`CLAUDE.md` mirrors `AGENTS.md`) | prose |
| `packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts:1848` | "a durable product/infra ability" | prose |
| `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.ts:325` | "Decide changes to public API, schema, data migration, auth, infra, security" | packet template prose |
| `packages/tooling/tool/cli/test/fixtures/goals-plan/bootstrap-full.json:25` | the rendered template | template fixture |
| `packages/tooling/tool/cli/test/fixtures/goals-plan/bootstrap-minimal.json:25` | the rendered template | template fixture |
| `packages/tooling/tool/cli/test/fixtures/goals-plan/bootstrap-report-first.json:25` | the rendered template | template fixture |
| `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts:833` | "infra failures" | runner-infrastructure prose |
| `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts:834` | "managed-runner infra success" | runner-infrastructure prose |
| `packages/tooling/tool/cli/test/ci-lane-timings.test.ts:726` | "is an infra failure" | prose |
| `packages/tooling/tool/cli/test/ci-lane-timings.test.ts:727` | `const infra = job({` | local variable name |
| `packages/tooling/tool/cli/test/ci-lane-timings.test.ts:732` | `ciLaneTimingRow(infra).infraFailure` | local variable name |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Ack.ts:179` | `reason: "flaky infra lane, rerun queued"` | example text |
| `packages/tooling/tool/cli/test/yeet-ack.test.ts:53` | `reason: "flaky infra lane"` | example text |
| `packages/tooling/tool/cli/test/yeet-ack.test.ts:54` | `"wontfix: flaky infra lane"` | example text |
| `packages/tooling/tool/cli/test/yeet-base-conflict.test.ts:1103` | `reason: "flaky infra lane"` | example text |

The four borrowed fixture lines (counted in R7's 212; they survive unless R7 renames them):
`packages/tooling/tool/cli/test/Holds.inventory.test.ts:222`, `:239` and `:269` (the retired hold
label "infra keeps TypeScript 6" used as fixture data), and
`packages/foundation/capability/walker/test/Descend.test.ts:604` (`{apps,packages,infra}/**` as a
glob example). Renaming them costs nothing and changes no behaviour.

### 6.4 Mechanism for the residue: recommendation

**(a) rejected: it is not correct.** The residue matches only because the needle is the bare
package path `infra`. Matching the name `@beep/infra` plus a root-anchored `infra/` segment, and
never the bare word, would clear the 28 residue lines. But it would also hide 117 real dependents
(106 of R7's 212, plus 11 in R4 to R6) that name the root directory without a slash, for example:

- scan-root lists: `["apps", "packages", "infra"]` in `Quality.command.ts:358`,
  `TestTsgoPrograms.ts:36`, `PackageTestTypecheck.ts:72` and `TsconfigOverlay.ts:64`;
  `deprecatedApiSweepRoots` in `LintDeprecatedApis.schemas.ts:30`;
- `Laws.command.ts:329`, `Knowledge.refs.ts:1376` and the probes' own `SCAN_ROOTS`;
- brace globs such as `{apps,packages,infra}/**` in `Lint.schemas.ts:1754-1814`, `lefthook.yml:53`
  and about 40 `turbo.json` inputs;
- regex alternations such as `(packages|apps|infra)/` in `CiOperational.schemas.ts:529` and
  `CiOperational.patterns.json:5`;
- the `biome lint apps packages infra` root script and `apps/todox/vercel.json:7`'s `find ... infra ...`.

Those are exactly what the scan exists to find; each keeps scanning a directory that no longer
exists. Renaming the tooling kind away from `infra` would remove 11 of the 28. That is a breaking
rename of a public kind (`"kind": "infra"` in three manifests, `create-package --kind infra`), done
only to satisfy a matcher, and it would leave the 17 prose lines. Not recommended.

**(b) recommended: an explicit acknowledgement input, in R6.6.** Proposed shape (schema-first, in
`DeletePackage.schemas.ts`):

- `DeletePackageAcknowledgements`, a JSONC file passed as `--acknowledge <path>`, committed in the
  deleting PR. Recommended home: `goals/infra-alchemy-rebuild/ops/delete-infra.acknowledgements.jsonc`.
  Fields: `schemaVersion: "delete-package-acknowledgements/v1"`, `target` (package name; must equal
  the resolved target) and `entries`.
- Each entry is `{ path, text, reason }`: `path` repository-relative, `text` the exact trimmed line
  content, `reason` non-empty. It is matched by path and text, not line number, so unrelated edits
  above it do not break it. An optional `occurrences` (default 1) covers a line that repeats in one
  file.
- Behaviour:
  - Only `file-path` and `script` hits can be acknowledged. A `manifest-*` or `import-*` hit is a
    real code edge and is never accepted.
  - The command prints every acknowledged hit under its reason, as a "[delete-package] ACK" block
    in the plan.
  - It refuses (hard) when an entry matches no current hit (stale acknowledgement), when an entry's
    occurrence count differs, when the file names another target, and, as today, when any hard hit
    is left unacknowledged.
- The doctor honours the same file. The `authored-reference` surface records evidence per file
  today; to apply line-level acknowledgements it must record the matching lines, and a file whose
  only matches are acknowledged lines reads `clean`. Otherwise the post-apply doctor would report
  the three manifests as residue after the tree is gone, the same failure as #3343's round-1 finding.
- `--force` and `--also` are inert today (6.1). R6.6 should delete both, or give `--force` a
  defined meaning, so no caller believes they bypass anything. Fix-where-found applies.
- Tests (repo-cli, Node and Bun):
  1. An acknowledged `file-path` hit is accepted and printed with its reason.
  2. A stale entry (no matching hit) refuses.
  3. A new unacknowledged hit beside acknowledged ones refuses.
  4. An entry that tries to acknowledge an `import-prod` hit refuses.
  5. An entry still matches after a line moves (same text, different line number); a changed text
     refuses.
  6. A file whose `target` differs refuses.
  7. After a simulated apply, an acknowledged line keeps `authored-reference` clean and
     `doctorIsClean` true; an unacknowledged real reference still makes it residue.
  8. The decode rejects an empty `reason` and an absolute or `..` path.

**(c) nothing else.** With (b) in place, R7's file acknowledges the 28 (or 32) lines explicitly.
The gate reviews them as a list, and any new collision fails loudly.

### 6.5 Tracked files only: the scan's file enumeration

Today the dependents scan and the doctor enumerate files by walking the filesystem.
`collectFiles` (`RegistrationGeometry.probes.ts:73-98`; line numbers in this section are at #3343's `4810cc93ccc`) recurses from each root and skips only the
directory names in `EXCLUDED_DIRECTORIES` (`.git`, `node_modules`, `dist`, `coverage`, `.turbo`,
`.beep`, at `:53`). It never consults git, so gitignored output is read. Callers:

- the dependents scan over `SCAN_ROOTS` (`:761`);
- the `authored-reference` surface over the whole repository (`:212`);
- the `historical-record` surface (`:292`);
- `pending-changeset` over `.changeset` (`:234`);
- `runtime-artifact` over `.beep/ci` (`:265`).

Measured on 2026-11-14: after `package-verify` ran docgen, the scan read
`packages/tooling/tool/cli/docs/modules/**` and `packages/tooling/library/repo-cli-kit/docs/modules/**`
(gitignored by `.gitignore:56` `**/docs`). It also read the docs-lint bundle under
`packages/tooling/policy-pack/lint-rules/.prebuilt/` (`.gitignore:52`). That added 23 phantom
dependents: 353 instead of 330.

Smallest correct change, in R6.6:

- Enumerate the candidate files once per run through git, through the existing `@beep/git` service
  (`Git.lsFiles`, `packages/drivers/git/src/Git.ts:2447`; `GitCommand.lsFiles` at
  `packages/drivers/git/src/GitCommand.ts:1222`). It needs one new option: untracked files that are
  not ignored, rendering `git ls-files -z --cached --others --exclude-standard`. Today it renders
  only `ls-files --stage -z`, the index. That lists tracked files plus new files a lane has not yet
  `git add`ed, and honours every `.gitignore`, so local docgen, bundles and caches can never appear.
  The index alone ("tracked only") would miss a dependent in a new uncommitted file, which is exactly
  when a lane runs `delete-package`.
- Filter that list by root prefix and suffix in place of `collectFiles` for the dependents scan,
  `authored-reference` and `historical-record`. Skip entries that no longer exist on disk: after
  apply, the deleted tree is still in the index until it is staged.
- Keep the filesystem walk for `runtime-artifact` (`.beep/ci` is gitignored on purpose: it is the
  machine-local state that probe looks for) and for `owned-tree`, which checks existence.
  `.changeset` is tracked, so `pending-changeset` can take the git list too.
- When `repoRoot` is not a git work tree, fail with a typed error naming it. Do not fall back to
  the walk, which would bring the phantoms back silently.
- Tests:
  1. A gitignored `packages/consumer/docs/modules/X.md` that names the target yields no dependent
     and no `authored-reference` evidence.
  2. An untracked but not-ignored new file that names the target is still a dependent.
  3. A tracked file deleted from disk but still in the index yields nothing.
  4. `runtime-artifact` still finds a file under `.beep/ci`.
  5. A non-git root fails with the typed error.
  6. `@beep/git`: `GitCommand.lsFiles` renders the new flags, and its parser reads mixed output.
  Every delete-package fixture becomes a git repository (one test helper: `git init`, a local
  `user.email`/`user.name`, `git add -A`). That touches about 15 existing tests, and each runs on
  Node and Bun.

### 6.6 R6.6 entry (built after #3343 merges, its own small PR)

**Ruled by the gate, 2026-11-14:** mechanism (b), the committed acknowledgement file (path plus exact line text;
stale or new entries fail; import edges can never be acknowledged; the doctor honours the same file), together
with the tracked-files-only enumeration through `@beep/git` (6.5). It is built after #3343 merges, in its own small PR.

**Also ruled:** in files `delete-package` scans as hard dependents (under `packages/`, `apps/`, `.github/`), a
reference to a deleted path is dropped, not rewritten. The "(removed in #N)" rewrite is for docs, decisions and
packets. The checklist at the top of this document applies it.

- Files:
  - `packages/drivers/git/src/GitCommand.ts` and `Git.ts` (the untracked option), with their tests;
  - `RegistrationGeometry.probes.ts` (git-backed enumeration; line-level authored evidence;
    acknowledgements in the doctor);
  - `DeletePackage.schemas.ts` (`DeletePackageAcknowledgements`), `DeletePackage.policy.ts` (the
    acknowledgement-aware dependent rule), `DeletePackage.command.ts` (`--acknowledge`; drop `--also`;
    decide `--force`);
  - `delete-package.test.ts` (fixtures as git repositories; the tests above).
- Gates as for #3343: `package-verify` for `@beep/git` and `@beep/repo-cli`; tests on Node and Bun;
  100% on touched files without a baseline row; docs oxlint; Fallow audit; knowledge gates.
- Check afterwards: `delete-package @beep/infra --dry-run` on a checkout with local docgen output
  reports the same count as on a clean one.
- R7 then commits the acknowledgement file for the 28 (or 32) lines from 6.3 and runs
  `delete-package @beep/infra --acknowledge <file> --prune-catalog --rewrite-packets` (the last flag
  only waives the packet refusal; the template packet is edited by hand).
