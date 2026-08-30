# 14 — v4 enforcement and scaffolding tooling inventory

Scope: what `beep architecture` generates, what `check` proves, every other repo gate that
touches slice shape, where each gate runs, and which slice-consistency conventions have any
mechanical check today. Read-only audit at `~/YeeBois/projects/beep-effect7` (HEAD
`3435c24f94`, 2026-08-29). No package scripts were executed; every number comes from
`rg`/`find`/`grep`/`sed`/`awk` over the checkout, with the command shown next to the claim.

## TL;DR

1. `beep architecture` is a **template retargeter over a static manifest**, not a grammar-aware generator: `AcceptedProofManifest.ts` lists 140 hard-coded `packages/architecture-lab/**` (+ proof-app + db-admin) file paths; `TemplateRetarget.ts` string-replaces `ArchitectureLab`/`WorkItem`/`Worker`/`WorkPriority` tokens. `writer: "ts-morph"` is a label — `OperationPlanExecution.renderWritableOperation` writes `operation.content` verbatim.
2. `architecture check` validates one operation-plan JSON against disk (`matching|missing|differing|unexpected|absent`). It has no walker over existing packages and is not wired into any CI lane, `beep:preflight`, or yeet tier (`rg 'architecture check' package.json .github packages/tooling/tool/cli/src/commands/{Ci,Quality,Yeet}` = 0 hits; only `test/architecture-operation-plan.test.ts`).
3. Of 12 slice-consistency conventions, **1 has a real hard check** (boundary direction, partially: `beep fallow boundaries --check` pins 3 doctrine rules for domain/tables/ui/drivers); **4 have narrow or scoped checks** (casing: PascalCase filenames only under `packages/tooling/tool/cli/src`; role-suffix export grammar and barrel non-re-export only for `@beep/schema`; test import aliasing; identity-registry completeness); **7 have none** (spine completeness, domain-kind placement, concept-folder/file-prefix agreement, role-suffix vocabulary, barrel completeness, namespace-export style, export-map grammar, test collocation, error placement, Layer placement).
4. The canonical proof itself diverges from doctrine vocabulary (`WorkItem.repository.ts`/`.use-cases.ts`/`.http.ts`/`.rpc.ts`/`.tools.ts`, `config/src/layer.ts`, `tables/src/tables.ts`) and the live corpus follows the proof, not the doctrine: `.repository.ts` 7 vs `.ports.ts` 13, `.http.ts` 1 vs `.http-handlers.ts` 0, `.rpc.ts` 8 vs `.rpc-handlers.ts` 1, `.tools.ts` 2 vs `.tool-handlers.ts` 1, `tables.ts` 3 pkgs vs `Tables.ts` 1, `Schema.ts` 3.
5. Nearest hosts for new checks: `Lint.command.ts:collectTypeScriptFiles` (symlink-safe repo walker, already used for PascalCase), `PackageTestImports.collectPackageSourceRoots` (package discovery by `package.json` name), `SchemaTopology.ts` (export-map + concept-index regexes, currently pinned to `packages/foundation/modeling/schema`), and `Fallow.command.ts:classifyWorkspaceRole` (role from path segment; add `use-cases`/`client`/`config` roles and the missing direction rules).

## 1. Architecture CLI (`packages/tooling/tool/cli/src/commands/Architecture/`)

Files read fully (`wc -l`): `Architecture.command.ts` 299, `Architecture.plan.ts` 350,
`Architecture.schemas.ts` 986, `OperationPlanExecution.ts` 323, `OperationPlanPackageJson.ts` 139,
`OperationPlan.ts` 22 (re-export shim), `index.ts` 35, `internal/AcceptedProofManifest.ts` 864,
`internal/PackageShell.ts` 670, `internal/RoleTopology.ts` 300, `internal/TemplateRetarget.ts` 267.

### 1.1 Command grammar

| Command | Args / flags | Code path | Writes |
|---|---|---|---|
| `beep architecture create slice <slice> <concept>` | `--domain-kind` (default `aggregates`), `--stage` (default `core`), `--dry-run` | `makePlanFromCommand` → `makeArchitectureOperationPlan(repoRoot, target, O.none())` → `runWriteCommand` | full staged concept + package files; then `registerMissingWorkspaceIdentityPackages` |
| `beep architecture create package <slice> <role>` | role ∈ `ArchitecturePackageRole`; `--dry-run` | `makeArchitecturePackageOperationPlan` (PackageShell.ts) | shell-only package (no concept) |
| `beep architecture add concept <slice> <concept>` | same flags as `create slice` (default stage `core`) | **identical code path to `create slice`** (only the `withDescription` string differs, `Architecture.command.ts:228-241`) | same as create slice |
| `beep architecture add role <slice> <concept> <role>` | role ∈ `ArchitectureSliceRole`; `--domain-kind`; `--stage` (default `full` = `defaultArchitecturePlanTarget.stage`); `--dry-run` | same path with `roles = O.some([role])`; `validateRequestedRoles` rejects roles outside the domain-kind archetype | only files whose manifest `role` matches |
| `beep architecture plan` | `--slice` (default `architecture-lab`), `--concept` (default `WorkItem`), `--domain-kind`, `--stage` (default `full`) | `printPlanJson` | stdout JSON only |
| `beep architecture apply --file/-f <plan.json>` | | `applyCanonicalSliceOperationPlan` | per-operation conflict policy |
| `beep architecture check --file/-f <plan.json>` | | `checkCanonicalSliceOperationPlan` + `ensureIdempotent` | nothing; exits non-zero if not idempotent |

`--dry-run` prints the encoded plan JSON instead of applying (`runWriteCommand`,
`Architecture.command.ts:145-157`). Stage/domain-kind strings are decoded with
`S.decodeUnknownEffect(ArchitecturePlanStage|ArchitectureDomainKind)`; invalid values fail
with `DomainError` before any planning.

### 1.2 Operation-plan schema (`Architecture.schemas.ts`)

All literal domains are `LiteralKit(...)` with `$I.annoteSchema`:

| Schema | Members |
|---|---|
| `ArchitectureDomainKind` | `aggregates`, `entities`, `values` |
| `ArchitecturePlanStage` | `core`, `persistence`, `protocol`, `client`, `full` (rank order in `RoleTopology.stageOrder`; `full` includes everything) |
| `ArchitectureSliceRole` | `domain`, `use-cases`, `config`, `server`, `tables`, `client`, `ui`, `proof-app`, `db-admin` |
| `ArchitecturePackageRole` | `domain`, `use-cases`, `config`, `server`, `tables`, `client`, `ui` |
| `ArchitectureOperationKind` | `write-file`, `write-package-json`, `ensure-file`, `ensure-absent-path` |
| `ArchitectureWriterKind` | `template`, `json`, `jsonc`, `package-json`, `ts-morph` |
| `ArchitectureOperationWriteMode` | `write-if-missing`, `ensure-present`, `remove-if-present` |
| `ArchitectureOperationConflictPolicy` | `skip-identical-fail-different`, `require-present`, `remove-existing` |
| `ArchitectureOperationSource` | `accepted-proof`, `package-shell`, `legacy-cleanup`, `legacy-plan` |
| `ArchitectureOperationCheckStatus` | `matching`, `missing`, `differing`, `unexpected`, `absent` |

Classes: `ArchitectureSliceRolePlan{role,packageName,path,exports}`,
`ArchitecturePlanTarget{boundedContext,concept,domainKind,conceptPath,stage}`,
`WriteFileOperation{kind,operationId,role,path,writeMode,conflictPolicy,operationSource,writer,content,description}`,
`WritePackageJsonOperation{…,packageName,packageDescription,repositoryDirectory,exports,dependencies,devDependencies}`,
`EnsureFileOperation`, `EnsureAbsentPathOperation`, `ArchitectureOperation = S.Union([...4])`,
`ArchitectureOperationCheck{operationId,kind,path,status}`,
`CanonicalSliceOperationPlan{schemaVersion: "architecture-operation-plan/v1", target, roles, operations}`,
`OperationPlanCheckResult{idempotent,operationStatuses,missingPaths,differingPaths,unexpectedPaths}`,
`OperationPlanApplyResult{writtenPaths,skippedPaths,removedPaths}`.
`defaultArchitecturePlanTarget = {architecture-lab, WorkItem, aggregates/WorkItem, aggregates, full}`.
`operationId = "<kind>:<path>"`; write-mode and conflict-policy are derived from kind
(`Architecture.plan.ts:54-64`), so they carry no independent information today.

### 1.3 How files are produced

```
acceptedProofFiles (static list, AcceptedProofManifest.ts:130-844)
  │  filter roleAllowedForTarget(target, file.role)         RoleTopology.ts:153
  │  filter isStageIncluded(target.stage, file.stage)       RoleTopology.ts:44
  │  filter proofFileMatchesDomainKind(target, file)        TemplateRetarget.ts:404
  │  filter roles (add role only)
  ▼
for each file: operationPath = targetPathFor(file.path, target)          TemplateRetarget.ts:439
               content = isPackageLevelFile(file.path) && exists(operationPath)
                           ? read(operationPath)            # preserve existing package file
                           : renderAcceptedTemplateForPlan(read(file.path))   # string replace
               WriteFileOperation{writer: file.writer, content}
+ legacyFixturePaths → EnsureAbsentPathOperation (3 paths)
```

Load-bearing facts:

| Fact | Evidence |
|---|---|
| Proof file list is static, 140 `AcceptedProofFile.make` entries + 8 scaffold files × 9 roles via `rolePackageFiles` | `grep -c 'AcceptedProofFile.make' internal/AcceptedProofManifest.ts` → 140 (incl. the class example); `rolePackageFiles` emits AGENTS.md, LICENSE, README.md, docgen.json, package.json, tsconfig.json, vitest.config.ts, test/.gitkeep per role |
| Role archetypes | `RoleTopology.ts:53-65`: aggregates → all 9 roles; entities → domain, use-cases, server, tables, db-admin; values → domain only |
| `db-admin` only for the default target | `dbAdminProofTargetAllowed` (`RoleTopology.ts:130`): bounded context must be `architecture-lab` and concept `WorkItem`/aggregates or `Worker`/entities |
| Source concept/domain-kind is inferred from the *source path* | `sourceConceptForPath` checks `WorkPriority`→`WorkItem`→`Worker` substrings, default `WorkItem`; `sourceDomainKindForPath` uses `/values/`, `/entities/`, `/aggregates/` segments or the concept default (`TemplateRetarget.ts:317-332`) |
| Package-level files are always included, regardless of domain-kind | `isPackageLevelFile` = scaffold suffixes ∪ `{/src/index.ts, /src/public.ts, /src/server.ts, /src/Layer.ts, /src/test.ts, /src/tables.ts, /src/schema.ts, /src/targets.ts, /src/migrations/ArchitectureLab.ts, /drizzle.config.ts}` (`TemplateRetarget.ts:334-364`) |
| Retarget = ordered `Str.replaceAll` over 10 token pairs | `replacementPairs` (`TemplateRetarget.ts:486-515`): `ARCHITECTURE_LAB`, `WORK_ITEM`, `ArchitectureLab`, `architecture-lab`, `architecture_lab`, `architecture lab`, then concept Pascal/camel/kebab/snake |
| `writer` is metadata only | `OperationPlanExecution.ts:renderWritableOperation`: `write-file` → `Effect.succeed(operation.content)`; `rg 'ts-morph' commands/Architecture` finds only the literal domain |
| Only `create package` renders `package.json` structurally | `WritePackageJsonOperation` is built only in `PackageShell.shellPackageJsonOperationFor`; concept plans copy `packages/architecture-lab/<role>/package.json` as text with writer `package-json` |

**Inferred hazard (not executed; the only non-default test, `research-lab/Ticket` at
`test/architecture-operation-plan.test.ts:368-393`, asserts written *paths*, not content):**
for an aggregates target, `sourceDomainKindForPath` drops `entities/**` and `values/**`, but the
package-level `domain/src/index.ts` (which exports `Entities`, `Worker`, `Values`, `WorkPriority`
namespaces — `grep -v '^\s*\*' packages/architecture-lab/domain/src/index.ts`) and
`domain/package.json` (exports `./entities/Worker`, `./values/WorkPriority`) are retargeted with
`WorkItem`-only replacement pairs (`sourceConceptForPath("…/package.json")` → `WorkItem`), so
the emitted barrel/export map references files the plan never writes. The same applies to
`use-cases/src/public.ts` (`export * as Worker from "./entities/Worker/index.ts"`) and
`server/src/Layer.ts` (imports `WorkerServerLayer`). A follow-up must verify with a real
`--dry-run` before relying on this.

**Second-concept limitation:** the domain-kind barrel `src/aggregates/index.ts` is *not*
package-level, so it is always re-rendered from the template (`export * as WorkItem from
"./WorkItem/index.ts"` → new concept). If a package already has a concept under the same
kind, `apply` hits `skip-identical-fail-different` on that barrel and fails with
"would overwrite a differing file" (`OperationPlanExecution.ts:ensureWritableOperationMatches`).
The generator cannot append to barrels; there is no AST merge despite the `ts-morph` label.

### 1.4 Exact role files per tier, per stage (concept plan, aggregates target `<C>`, slice `<s>`)

Derived from the manifest by applying the three filters by hand. `pkg-scaffold` = AGENTS.md,
LICENSE, README.md, docgen.json, package.json, tsconfig.json, vitest.config.ts, test/.gitkeep.

| Tier | `core` | `persistence` adds | `protocol` adds | `client` adds |
|---|---|---|---|---|
| `domain` | pkg-scaffold; `src/index.ts`; `src/aggregates/index.ts`; `src/aggregates/<C>/{index.ts, <C>.errors.ts, <C>.model.ts, <C>.values.ts}`; `test/<C>.test.ts`; `test/TaggedError.equivalence.test.ts` | — | — | — |
| `use-cases` | pkg-scaffold; `src/{index,public,server}.ts`; `src/aggregates/<C>/{index.ts, server.ts, <C>.commands.ts, <C>.errors.ts, <C>.repository.ts, <C>.use-cases.ts, <C>.service.ts}`; `test/<C>.test.ts`; `test/SchemaParity.test.ts`; `test/TaggedError.equivalence.test.ts` | — | — | — |
| `server` | pkg-scaffold; `src/{index,Layer,test}.ts`; `src/aggregates/<C>/{index.ts, <C>.layer.ts, <C>.repo.ts}`; `test/<C>Server.test.ts` | `test/integration/<C>DrizzleRepository.pglite.test.ts` | `src/aggregates/<C>/{<C>.http.ts, <C>.rpc.ts, <C>.tools.ts}` | — |
| `config` | — | pkg-scaffold; `src/{index,public,server,secrets,layer,test}.ts`; `src/aggregates/<C>/{index.ts, <C>.config.ts, <C>.layer.ts}`; `test/<C>Config.test.ts` | — | — |
| `tables` | — | pkg-scaffold; `src/{index,tables}.ts`; `src/aggregates/<C>/{index.ts, <C>.table.ts}`; `test/<C>Table.test.ts` | — | — |
| `client` | — | — | — | pkg-scaffold; `src/index.ts`; `src/aggregates/<C>/{index.ts, <C>.client.ts}`; `test/<C>Client.test.ts` |
| `ui` | — | — | — | pkg-scaffold; `src/index.ts`; `src/aggregates/<C>/{index.ts, <C>.view-model.ts}`; `test/<C>ViewModel.test.ts` |
| `proof-app` | — | — | — | `apps/<s>-proof/{scaffold, src/index.ts, test/<S>Proof.test.ts}` |
| `db-admin` | — | default target only (29 manifest entries incl. migrations, snapshots, pglite tests) | — | — |

Entities target (`Worker` template): domain core = `src/entities/index.ts`,
`src/entities/<C>/{index.ts, <C>.model.ts, <C>.values.ts, <C>.behavior.ts}`, `test/<C>.test.ts`
— **no `.errors.ts`** (Worker has none); use-cases/server/tables mirror the aggregates rows
with `Worker.*` sources; no config/client/ui/proof-app. Values target (`WorkPriority`): domain
only — `src/values/index.ts`, `src/values/<C>/{index.ts, <C>.model.ts, <C>.behavior.ts}`,
`test/<C>.test.ts`. Note the manifest tags `TaggedError.equivalence.test.ts` and
`SchemaParity.test.ts` as aggregates (concept default), so entity/value targets never get them.

`create package <s> <role>` (PackageShell.ts) writes: AGENTS.md, LICENSE, README.md,
docgen.json, tsconfig.json, **tsconfig.test.json, tsconfig.check.json** (which the concept plan
does *not* write — architecture-lab packages have no `tsconfig.test.json`: `ls
packages/architecture-lab/*/` shows only `tsconfig.check.json`), vitest.config.ts,
test/.gitkeep, `src/index.ts` (`VERSION` + role extras); domain adds
`src/{aggregates,entities,identity,values}/index.ts` (empty `export {}`); use-cases adds
`src/{public,server}.ts`; config adds `src/{public,server,secrets,layer,test}.ts`; server adds
`src/{Layer,test}.ts`; tables adds `src/tables.ts` (`DbSchema = {}`). Its `package.json` is
structural (`OperationPlanPackageJson.renderPackageJsonOperation`): exports = role subpaths +
`"./internal/*": null` + `./package.json`, dual `src/*.ts` / `publishConfig.exports dist/*.js`.

### 1.5 What `check` validates, and what it cannot see

`checkCanonicalSliceOperationPlan` (`OperationPlanExecution.ts:533-607`) walks **the plan's
operations only**: for each `write-file`/`write-package-json` it renders expected content and
compares byte-for-byte with disk (`matching|missing|differing`); `ensure-file` → exists?
(`matching|missing`); `ensure-absent-path` → absent? (`absent|unexpected`). `idempotent` =
no missing, differing, or unexpected. It also rejects paths escaping the repo root.

It cannot see: any file not named in the plan (hand-added role files, extra concepts, stray
barrels), any package not produced from the manifest, semantic drift (a file that exists with
different-but-valid content is simply "differing"), doctrine vocabulary, casing, barrel
completeness, export maps of pre-existing packages, or import direction. It is not run
anywhere except the unit test (`rg -n 'architecture check|checkCanonicalSliceOperationPlan'
package.json .github/workflows packages/tooling/tool/cli/src/commands/{Ci,Quality,Yeet}` → 0).
The knip config even has to special-case the proof barrels because "operation plans read this
proof barrel by file path rather than importing it" (`knip.jsonc`, `packages/architecture-lab/{server,tables,use-cases}` entries).

### 1.6 Proof vs doctrine vs corpus

| File the generator emits | Doctrine vocabulary (`standards/ARCHITECTURE.md` L954-1135) | Corpus count in 8 slices (`find packages/{agents,…}/*/src -name '*.<suffix>.ts'`) |
|---|---|---|
| `use-cases/<C>.repository.ts` | `.ports.ts` | `.repository.ts` 7 · `.ports.ts` 13 |
| `use-cases/<C>.use-cases.ts` | not in vocabulary | `.use-cases.ts` 4 |
| `use-cases/<C>.service.ts` | `.service.ts` ✓ | 17 |
| `server/<C>.http.ts` / `.rpc.ts` / `.tools.ts` | `.http-handlers.ts` / `.rpc-handlers.ts` / `.tool-handlers.ts` (server); `.http.ts`/`.rpc.ts`/`.tools.ts` belong to use-cases | `.http.ts` 1 · `.http-handlers.ts` 0 · `.rpc.ts` 8 · `.rpc-handlers.ts` 1 · `.tools.ts` 2 · `.tool-handlers.ts` 1 |
| `server/<C>.repo.ts`, `<C>.layer.ts` | ✓ | `.repo.ts` 15 · `.layer.ts` 22 |
| `config/src/layer.ts`, `public.ts`, `server.ts`, `secrets.ts`, `test.ts` | `Layer.ts`, `PublicConfig.ts`, `ServerConfig.ts`, `Secrets.ts`, `TestLayer.ts` | epistemic/ontology config ship **both** spellings (`layer.ts` + `ServerConfig.ts` + `TestLayer.ts` + `public.ts` + `server.ts` + `secrets.ts` + `test.ts`) |
| `tables/src/tables.ts` | `Tables.ts`, `ReadModels.ts` | `tables.ts` 3 pkgs (agents, architecture-lab, documents) · `Tables.ts`+`ReadModels.ts` 1 (law-practice) · `Schema.ts` 3 (epistemic, shared, workspace) |
| `ui/<C>.view-model.ts`, `client/<C>.client.ts` | ui: `.form.tsx …`; client: `.command-client.ts`, `.query-client.ts`, `.service.ts`, `.atoms.ts` | `.view-model.ts` 1 · `.client.ts` 1 · `.atoms.ts` 4 |
| domain `<C>.model/.values/.errors/.behavior` | ✓ | `.model.ts` 148 · `.values.ts` 35 · `.errors.ts` 21 · `.behavior.ts` 9 |
| root `Api.ts`/`Rpc.ts`/`Tools.ts` (use-cases, server) | in doctrine topology | `Tools.ts` exists in `law-practice/{server,use-cases}/src` only; no `Api.ts`/`Rpc.ts` anywhere |

Verdict: the manifest is the de-facto vocabulary; doctrine and generator disagree on 6 role
names and the corpus splits between them.

## 2. Other gates

### 2.1 `beep lint` (`commands/Lint/`, 15 subcommands, `Lint.command.ts:447-463`)

| Subcommand | Walks | Fails on | Slice relevance |
|---|---|---|---|
| `circular` | madge over `packages/tooling/tool/cli/src`, `packages/tooling/library/repo-utils/src` only | any cycle | none (tooling only) |
| `deprecated-apis` | eslint `BEEP_ESLINT_PROFILE=deprecated-apis` over 25 hard-coded shards (`Lint.command.ts:41-67`) | deprecated vendor API use | none |
| `ecosystem-polarity` | `packages/ecosystem/*` source + manifests | `@beep/*` runtime edges / bundled deps | none |
| `goal-packets` | alias of `goals doctor` | manifest vs reality drift | none |
| `identity-registry` | all `.ts/.tsx` under workspace roots, skipping `node_modules dist dist-test build coverage .turbo test`; compares workspace packages to `@beep/identity/packages` composer | `missing-registration`, `orphan-registration`, `local-root-composer` (`make(...)` from `@beep/identity` root), `labs-segment-*`; `--fix` registers | package-level identity only; does not check per-file `$I` usage |
| `judge-rubric` | judge prompt vs `QaLens` schema | lens drift | none |
| `package-test-imports` | `packages/**/test/**/*.{ts,tsx}` (excl. `src/**/test/`), ts-morph import scan; package roots discovered by `package.json` name walk | relative import resolving into any workspace `src/`; suggests `@beep/<pkg>/<subpath>` (strips `/index`) | **test alias rule** — the only test-shape gate |
| `package-test-typecheck` | `apps`, `infra`, `packages` tsconfig include/exclude globs | package whose `check` never typechecks its `test/`; baseline `standards/test-typecheck.blindspot-baseline.jsonc` | test coverage of typecheck, not placement |
| `policy` | delegates to `Quality/Tasks.ts:rootRepoLintPolicySteps` (see §3) | any step non-zero | aggregator |
| `reflection-artifacts` | `goals/*/history/reflections` | missing/invalid closeout reflection | none |
| `roadmap-refs` | roadmap links | dangling goal/exploration refs | none |
| `schema-catalog` | `SchemaFirstIncludedGlobs` (`apps/**`, `packages/**` `.{ts,tsx}` minus exclusions) | stale `standards/schema-catalog.generated.jsonc` | none |
| `schema-first` | same globs, ts-morph | inventory drift vs `standards/schema-first.inventory.jsonc`; `--write` refreshes | none |
| `schema-topology` | **`packages/foundation/modeling/schema` only** (`SCHEMA_PACKAGE_ROOT` const): package.json export map, `src/<Concept>/index.ts`, root tsconfig aliases | retired lowercase topical dirs/subpaths; promoted-concept root shim files; `export … from "../…"` in concept index (cross-concept re-export); export targets not matching `^\./(src|dist)/[A-Z][^/]+/[^/]+\.[a-z][A-Za-z0-9-]*\.(ts|js)$` (`schemaRoleFileTargetPattern`) | the closest thing to a role-suffix + barrel + export-map checker, hard-wired to one package |
| `tooling-schema-first` | `packages/tooling/tool/cli/src` + 5 focus files | `pascal-case-file` (`^[A-Z][A-Za-z0-9]*$`, except `index`/`bin`), `export-interface`, `data-tagged-enum`, `service-id` (`Context.Service` must use `$I\``), `schema-annotation` (`S.Class` needs `$I.annote`), node-runtime/native-fetch/sort/string in hotspots, 10 required tagged unions | **casing gate exists but is tooling-only** |

`Lint.command.ts:collectTypeScriptFiles` (L103-169) is a reusable symlink-safe recursive
walker using `isExcludedTypeScriptSourcePath` (`repo-utils/schemas/TypeScriptSourceExclusions.ts`:
excludes `/node_modules/ /dist/ /build/ /coverage/ /.next/ /.turbo/ /docs/ /_generated/
/generated/ /goals/ /test/ /tests/` and `.d.ts .test.ts(x) .spec.ts(x) .gen.ts(x) .stories.tsx`).

### 2.2 `beep laws` (`commands/Laws/`, 6 subcommands, `Laws.command.ts:354-376`)

All law scans share `internal/LawScan.ts`: ts-morph `syntax` mode over
`LAW_SCAN_INCLUDED_GLOBS = ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"]`,
`--include`/`--exclude` file lists, `--check` for strict exit.

| Law | Rule | Scope note |
|---|---|---|
| `effect-imports` | alias rules (`ALIAS_RULES`, `EffectImports.ts:81`), `--write` rewrites | repo-wide |
| `native-runtime` | `beep-laws/no-native-runtime`: `Object.*`, `new Map/Set`, `new Date`, `Array.*`, native errors; hotspot node/fetch/sort/string; allowlist `standards/effect-laws.allowlist.jsonc` | non-hotspot files warn-only under `--check` (`NoNativeRuntime.ts:558`) |
| `effect-fn` | `beep-laws/effect-fn`: reusable functions returning `Effect.gen` must use `Effect.fn`/`fnUntraced` | repo-wide |
| `frozen-grant-set` | `FrozenGrantSet.make` only inside `packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts` | single module |
| `terse-effect` | helper-wrapper simplifications; `--advisory` never blocks | policy runs it `--check --advisory` |
| `allowlist-check` | allowlist document integrity + generated snapshot sync | — |

None of the laws inspect file placement, names, or barrels.

### 2.3 `beep quality` (`commands/Quality/`)

Subcommands (`grep -A1 'Command.make($' Quality.command.ts FallowQuality.command.ts`):
`github-checks`, `plan-contract-check`, `dev`, `test-tsgo`, `tsgo-smoke`, `tsgo-rules`,
`jsdoc-module-tags`, `jsdoc-inventory`, `jsdoc-quality`, `jsdoc-ratchet`, `jsdoc-migrate
{extract,titles,apply,verify}`, `knip`, `turbo-config-proof`, `package-verify`, `bun-audit`,
`changeset-graph`/`changeset-status`, `flake {detect,config,status,reap}`, `tmpfs-reap`, and
`fallow {audit,dead-code,health,boundaries,flags,security,fix-preview,envelope-check,
command-contract-check,boundaries config-check,ci-contract-check}`.

| Gate | What it checks | Slice relevance |
|---|---|---|
| `knip` (`internal/KnipRatchet.ts`) | `bun run knip --reporter json` vs `standards/knip.regression-baseline.jsonc`; new packages must be clean | unused exports/files; `knip.jsonc` entry `packages/**: src/*.ts` means **top-level src modules are implicitly public**, so dead barrels are not flagged |
| `jsdoc-ratchet` | inventory totals vs `standards/jsdoc-*.baseline` | none |
| `tsgo-rules` | root `@effect/tsgo` diagnostic severities | none |
| `config-check` (`quality fallow boundaries config-check --check`) | runs `bun run fallow:boundaries:check` = `beep fallow boundaries --check` (`FallowQuality.command.ts:2053`) | see §2.4 |
| `ci-contract-check` | workflow file uses the envelope wrapper, expected lanes/promoted lanes | CI plumbing |
| `package-verify` | runs `beep:lint`/`beep:check`/`beep:test` for changed packages | none |

### 2.4 Fallow boundaries (`commands/Fallow/Fallow.command.ts`, `.fallowrc.jsonc`, `standards/fallow.boundaries.generated.jsonc`)

`beep fallow boundaries [--write|--check]` (`package.json` scripts `fallow:boundaries[:check|:write]`):

- **Zones**: one per workspace package, pattern `<workspacePath>/src/**` (137 zones vs 146
  `package.json` files under `packages apps infra`; the delta is non-workspace manifests).
- **Rules**: `allow = [self, …declared deps (dependencies+devDependencies+peer+optional)]`
  filtered by `isDoctrineAllowed(fromRole, toRole)`; `allowTypeOnly = allow`
  (`makeBoundaryConfig`, lines 234-278 stripped view).
- **Role inference**: `classifyWorkspaceRole(path)` → `drivers` if `segments[1] === "drivers"`,
  else `segments[2]` if ∈ `{domain, server, tables, ui}`, else `other`. **`use-cases`,
  `client`, `config` are all `other`.**
- **Doctrine rules** (`DOCTRINE_BOUNDARY_RULES`): `domain ⇏ drivers|tables|server`;
  `tables ⇏ server`; `ui ⇏ server`. That is the full direction law today.
- `--check` = generated file is byte-fresh **and** `checkDoctrineBoundaries`: manifest
  violations (declared deps crossing a doctrine rule) + source violations (fallow
  `dead-code --boundary-violations` findings whose zones cross a doctrine rule). Anything else
  reported by fallow is `"boundary-violation": "warn"` (generated config overrides the root
  `error`), i.e. advisory.

So: **it enforces declared deps + 3 direction rules, not `domain ← use-cases ← server`.**
Missing directions with no rule: `use-cases ⇏ server|tables|client|ui`, `domain ⇏
use-cases|client|ui|config`, `client ⇏ server|tables`, `tables ⇏ use-cases|client|ui`.
Evidence that direction is currently only "whatever package.json declares": `@beep/agents-use-cases`
allow-list contains `@beep/workspace-use-cases` and `@beep/workspace-domain` (cross-slice), and
`@beep/agents-server` allows `@beep/anthropic`, `@beep/ai-provider-cli` (drivers) — all legal
under the 3 rules.

Where it runs: `githubCheckRepoSanityLanes` (`Quality/internal/GithubChecks.ts:382`) includes
`repo-sanity:fallow-boundaries-config` → `fallow boundaries config-check --check`, i.e. the
hosted `Repo Sanity` context; `beep:preflight` runs `fallow:boundaries:write` (regenerate, not
check); the `fallow` CI lane runs `boundaries` as an **advisory** sub-lane
(`CiLane.ts:809-810`: blocking = `audit`, `dead-code`; advisory = `health`, `boundaries`,
`flags`, `security`, `fix-preview`).

### 2.5 TsconfigSync (`commands/TsconfigSync/`)

`beep tsconfig-sync [--check|--dry-run|--write] [--filter] [-v]`. Plans (`TsconfigSync.plan.ts`):
`planRootReferenceSync` (root `tsconfig.json` references from workspace list),
`planRootAliasSync` (root path aliases), `planRootSyncpackSync`, `planPackageReferenceSync`
(each package's `references` from its workspace deps; undeclared refs are pruned),
`planPackageDocgenSync`. It derives graph edges from `package.json`; it never validates the
export-map subpath grammar or file placement. Runs first in `beep:preflight` and as
`repo-sanity:tsconfig-sync` (`config-sync:check`).

### 2.6 CreatePackage (`commands/CreatePackage/CreatePackage.command.ts`)

`beep create-package <name> [--type library|tool|app] [--app-kind nextjs|vite|service|tauri|runtime-proof] [--lab] [--family drivers|ecosystem|foundation|tooling] [--kind …] [--parent-dir] [--dir-name] [--with-stories-tsconfig] [--dry-run]`.
Literal domains: `PackageType`, `AppKind`, `PackageFamily`, `FoundationKind`, `ToolingKind`
(`library|tool|policy-pack|test-kit`), `PackageKind = S.Union([FoundationKind, ToolingKind])`
(L225-290). Validation is **family/kind only**; `grep -n 'use-cases\|SliceRole' CreatePackage.command.ts`
→ 0 hits: it has no notion of slice roles, so a slice package created through it (via
`--parent-dir packages/<slice> --dir-name server`) gets the generic `src-index.ts.hbs` shell.
It also owns identity registration (`internal/IdentityRegistration.ts`,
`IdentityBulkRegistration.ts`), which `architecture` reuses.

### 2.7 Config-level linters

`biome.json*` has no `useFilenamingConvention` (`rg` → 0); no `.oxlintrc`/`oxlint*` file at
root; `eslint.config.mjs` selects `docs`/`deprecated-apis` profiles only, no import-boundary
plugin. No dependency-cruiser. `knip.jsonc` workspace entry `src/*.ts` (see §2.3).

## 3. Where gates run

| Surface | Definition | Contents |
|---|---|---|
| `bun run beep:preflight` | `package.json:334` | `tsconfig-sync` → `fallow:boundaries:write` → `quality jsdoc-inventory` → `lint schema-first --write` → `quality test-tsgo` → `ci lane repo-sanity` → `ci lane jsdoc-ratchet` → `ci lane knip` → `lint policy` |
| `beep lint policy [--full]` | `Quality/Tasks.ts:2063-2118` (`rootRepoLintPolicySteps`, concurrency 3) | `lint deprecated-apis`, `knowledge semantic-delta`, `knowledge refs --check`, `lint schema-first`, `laws terse-effect --check --advisory`, `eslint . --max-warnings=0`, `laws native-runtime --check`, `lint identity-registry`, `laws frozen-grant-set --check`, `lint circular`, `laws effect-fn --check`, `lint package-test-imports`, `laws effect-imports --check`, `lint package-test-typecheck`, `quality tsgo-rules`, `oxlint --quiet`, `lint ecosystem-polarity`, `laws allowlist-check`, `quality jsdoc-module-tags`, `goals doctor`, `goals index --check`, `lint reflection-artifacts`, `lint roadmap-refs`, `lint judge-rubric`, `typos` |
| `beep ci lane <id>` | `Ci/CiLane.ts:CI_LANE_ID_VALUES` (23 lanes) | `build check codegen commitlint coverage desktop-ipc docgen doctest ecosystem fallow jsdoc-ratchet knip labs lint lint-policy nix property repo-sanity sast secrets security test-integration test-unit` |
| `.github/workflows/check.yml` | verify matrix (ubuntu) + standalone jobs | matrix: `lint`, `repo-sanity`, `test-unit`, `ecosystem`, `codegen`, `labs`; jobs: `desktop-ipc`, `property`, `fallow` (+ envelope-check), `knip`, `jsdoc-ratchet`, `build`, `commitlint`, `secrets`, `security`, `nix`, `sast` |
| `.github/workflows/heavy.yml` | verify matrix on `beep-ec2-heavy` | `lint-policy`, `check`, `test-integration`, `coverage`, `docgen`, `doctest` |
| `beep ci local` | `CI_LOCAL_DEFAULT_LANES` (23), `--fast` skips `coverage test-integration nix` | local replay of the above |
| `beep yeet verify --tier full|cheap-gates|review-fix` | `Yeet/internal/Planner.ts:108,380-412` | `cheap-gates` = changeset-status lanes + `githubCheckCheapGateLanes`; `full` = full pre-push proof; `review-fix` = affected `--base/--head` |

Lane-to-gate mapping that matters for slice shape: `lint` lane = turbo `lint` graph only
(biome per package); `lint-policy` lane = the battery above; `repo-sanity` = changeset-graph,
tsconfig-sync check, **fallow boundaries doctrine check**, version-sync, syncpack, sherif;
`knip` = ratchet. No lane runs `architecture check`.

## 4. Uniformity ledger (enforcement-relevant conventions)

Counts over the 8 slices (`packages/{agents,architecture-lab,documents,epistemic,law-practice,ontology,shared,workspace}`), 41 role packages.

| Convention | Applied N/M | Verdict | Enforced by |
|---|---|---|---|
| Package has `package.json`, `docgen.json`, `tsconfig.check.json`, `test/` dir | 41/41 pkg · 39/41 docgen (epistemic use-cases, server lack it) · 41/41 check · 41/41 test | uniform / habitual | tsconfig-sync (docgen sync), create-package templates |
| Package has `tsconfig.test.json` | 14/41 | absent | none (create-package emits it; architecture concept plan does not) |
| `"./internal/*": null` in exports | 33/41 (0 in agents domain/use-cases, documents tables, epistemic tables, law-practice domain, workspace domain/tables) | habitual | none |
| Concept folder has `index.ts` | 215/217 concept dirs under `src/{aggregates,entities,values}/<C>` | uniform | none (knip does not see missing barrels; SchemaTopology checks only `@beep/schema`) |
| Domain-kind folders present in role packages | domain 8/8 use kinds; use-cases 5/8; server 5/8; tables 8/8; client 3/5; ui 2/3 (epistemic, law-practice, shared use `<Concept>/` bare or topical dirs: epistemic server/use-cases 7 other top dirs each) | habitual | none |
| Server root `Layer.ts` | 6/7 server pkgs (agents/server has `test.ts` only) | habitual | none (`exportsForRole` assumes `./layer`) |
| Use-cases root `public.ts` + `server.ts` | 8/8; `test.ts` 2/8 (agents, law-practice) | uniform / absent | none |
| Tables root collection file | `tables.ts` 3 · `Tables.ts`+`ReadModels.ts` 1 · `Schema.ts` 3 · (documents tables: `tables.ts`) | split three ways | none |
| Test dirs flat (no concept mirroring) | 41/41 flat; subdirs only `integration/` (4), `browser/`, `fixtures/` | uniform (flat) | `package-test-imports` (alias rule only) |
| Wildcard export keys (`./*`, `./<dir>/*`) | 33/41 packages have ≥1 wildcard key; 8 enumerate only | habitual | doctrine says wildcard is "Forbidden In New Work"; no check |
| Workspace package registered in identity composer | 138 accessor exports vs 137 fallow zones | uniform | `lint identity-registry` |
| Fallow zone per workspace package | 137/137 | uniform | `fallow boundaries --check` (freshness) |

## 5. Gap list — mechanical coverage of the 12 conventions

| Convention | Any check today? | Nearest existing walker to host it |
|---|---|---|
| Spine completeness (which role packages a slice has) | **No.** `roleAllowedForTarget` only gates plan generation | `Fallow.command.ts:resolveBoundaryWorkspaceEntries` + `classifyWorkspaceRole` already list every package with its role; add a per-slice aggregation |
| Domain-kind folder placement (`aggregates|entities|values` vs bare `<Concept>/`) | **No** | `Lint.command.ts:collectTypeScriptFiles` over `packages/<slice>/<role>/src`; reuse `ArchitectureDomainKind` literal |
| Concept-folder / file-prefix agreement (`<C>/<C>.role.ts`) | **No** for slices; `SchemaTopology.schemaRoleFileTargetPattern` proves the regex shape for `@beep/schema` export targets | generalize `SchemaTopology.ts` by parameterizing `SCHEMA_PACKAGE_ROOT` into a package list |
| Role-suffix vocabulary | **No.** Doctrine table exists only as prose (`ARCHITECTURE.md` L969-1135) | same walker; encode vocabulary as `LiteralKit` per role (the manifest and doctrine must first agree — see §1.6) |
| Casing (PascalCase concept dirs/files) | **Partial**: `tooling-schema-first` `pascal-case-file` for `packages/tooling/tool/cli/src` only; biome has no filename rule | lift `pascal-case-file` out of `runLintToolingSchemaFirst` into a slice-scoped subcommand |
| Barrel completeness (`index.ts` per concept, kind barrels export every concept) | **No** (215/217 by habit) | `SchemaTopology.collectSourcePathViolations` already reads `src/<Concept>/index.ts`; extend to compare directory listing vs `export` statements |
| Namespace-export style (`export * as` vs `export *`) | **No**; `SchemaTopology.crossConceptIndexExportPattern` only forbids `../` re-exports | same file |
| Export-map subpath grammar | **Partial**: `SchemaTopology.collectPackageJsonViolations` for one package; `OperationPlanPackageJson.packageExportMapFor` encodes the generator's grammar | generalize `exportRecordViolations` with `RoleTopology.exportsForRole` as the expected set |
| Test collocation ratio / placement | **Partial**: `package-test-imports` (alias), `package-test-typecheck` (typecheck coverage); no placement/mirroring rule and doctrine does not require one (`08-testing.md` examples are flat `test/<Name>.test.ts`) | `PackageTestImports.collectPackageTestFiles` |
| Error placement (`<C>.errors.ts` beside model vs central) | **No** | file-prefix walker above |
| Layer placement (root `Layer.ts`, concept `.layer.ts`) | **No** | file-prefix walker above; `exportsForRole` expects `./layer` |
| Boundary direction (`domain ← use-cases ← server`) | **Partial**: 3 doctrine rules (`domain⇏drivers|tables|server`, `tables⇏server`, `ui⇏server`) + declared-deps allow-list; `use-cases`/`client`/`config` are role `other` | `Fallow.command.ts:DOCTRINE_BOUNDARY_RULES` + `classifyWorkspaceRole` — add roles and rules; the check already runs in `Repo Sanity` |

## 6. Surprises vs scout facts

| Scout claim | Finding |
|---|---|
| "No file-role/suffix/casing/barrel gate exists" | Two narrow ones exist: `lint tooling-schema-first` enforces PascalCase filenames (tooling CLI only) and `lint schema-topology` enforces role-file export grammar + no cross-concept re-exports (`@beep/schema` only). Neither touches slices. |
| Laws listed as `effect-fn, effect-imports, native-runtime, frozen-grant-set, allowlist-check` | Six laws: `terse-effect` is also a law (`Laws.command.ts:368-375`); scout filed it under Quality. `config-check`/`ci-contract-check` live under `quality fallow`, not top-level quality. |
| "Fallow boundaries: zones from workspace deps" | True, plus 3 hard doctrine direction rules in `Fallow.command.ts` that run in the `Repo Sanity` hosted context; `use-cases`/`client`/`config` are unclassified (`other`). |
| "No Api.ts/Rpc.ts/Tools.ts root files anywhere" | `packages/law-practice/server/src/Tools.ts` and `packages/law-practice/use-cases/src/Tools.ts` exist (`ls packages/law-practice/{server,use-cases}/src`). No `Api.ts`/`Rpc.ts`. |
| "use-cases public.ts/server.ts/test.ts (all slices)" | `public.ts`+`server.ts` 8/8, but `test.ts` only in `agents` and `law-practice` use-cases. |
| "tables Tables.ts+ReadModels.ts only in law-practice" | Confirmed, and the other seven split `tables.ts` (3) vs `Schema.ts` (3) vs `tables.ts` (documents). |
| "check validates an operation-plan JSON for idempotency, NOT existing packages" | Confirmed; additionally it is not wired into any lane or preflight. |
| "TemplateRetarget renames WorkItem→Concept" | It also renames `Worker`/`WorkPriority` when the *source path* names them; package-level files are retargeted with `WorkItem` pairs only, leaving `Worker`/`WorkPriority` references (inferred, §1.3). |
| `writer: ts-morph` implies AST merging | Label only; `renderWritableOperation` writes `content` verbatim; no `ts-morph` import in `commands/Architecture`. |
| Architecture-lab "server test dir is flat" | Flat plus `test/integration/` (`WorkItemDrizzleRepository.pglite.test.ts`, stage `persistence`). |
| Scout suffix `.repository 6` | 7 in slice `src/` by `find` (`.repository.ts`), `.ports.ts` 13, `.rpc.ts` 8, `.use-cases.ts` 4. |
| Identity `$I` in 380 v4 files | Not re-measured; note `lint identity-registry` checks package registration and forbids local roots, not per-file `$I` presence. |

## 7. Evidence appendix (commands run)

| Path | Command | Result |
|---|---|---|
| `packages/tooling/tool/cli/src/commands/Architecture/**` | `wc -l *.ts internal/*.ts` | 4255 lines, 11 files, all read |
| `Architecture/internal/AcceptedProofManifest.ts` | `grep -c 'AcceptedProofFile.make'` | 140 |
| `Architecture/**` | `rg -n 'ts-morph' … \| grep -v 'writer: "ts-morph"'` | only the `ArchitectureWriterKind` literal |
| `package.json`, `.github/workflows`, `commands/{Ci,Quality,Yeet}` | `rg -n 'architecture check\|checkCanonicalSliceOperationPlan'` | 0 outside `test/architecture-operation-plan.test.ts` |
| `commands/Lint/Lint.command.ts` | `grep -n 'Command.make("' + lintSubcommands` | 15 subcommands |
| `commands/Laws/Laws.command.ts` | `withSubcommands` | 6 laws |
| `commands/Quality/Tasks.ts:2063-2118` | `sed -n` | 25 policy steps |
| `commands/Ci/CiLane.ts` | `CI_LANE_ID_VALUES` | 23 lanes |
| `.github/workflows/check.yml`, `heavy.yml` | `sed -n '54,110p'`, `sed -n '10,60p'`; `rg 'bun run beep ci lane'` | matrix ids listed in §3 |
| `commands/Fallow/Fallow.command.ts` | stripped read of `DOCTRINE_BOUNDARY_RULES`, `classifyWorkspaceRole`, `makeBoundaryConfig` | 3 rules; roles `domain drivers other server tables ui` |
| `standards/fallow.boundaries.generated.jsonc` | `grep -c '"name": "@beep/'`, `grep -c '"from": "'`, `tail -12` | 137 zones, 137 rules, `boundary-violation: warn` |
| `packages/foundation/*/identity/src/packages.ts` | `rg -c 'export const \$[A-Za-z0-9]*Id'` | 138 |
| `packages apps infra` | `find -name package.json -not -path '*/node_modules/*'` | 146 |
| `commands/Lint/SchemaTopology.ts` | `SCHEMA_PACKAGE_ROOT` const | `packages/foundation/modeling/schema` |
| `commands/Lint/PackageTestImports.ts` | `packageTestFilePattern` | `^packages\/.+\/test\/.+\.(ts\|tsx)$` |
| `commands/CreatePackage/CreatePackage.command.ts` | `grep -n 'use-cases\|SliceRole'` | 0 |
| `biome.json*`, root | `rg 'useFilenamingConvention'`; `ls oxlint* .oxlintrc*` | none |
| `packages/{8 slices}/*/src` | `find … -name '*.<suffix>.ts' \| wc -l` per suffix | table in §1.6 |
| same | concept dirs under `src/{aggregates,entities,values}/<C>` with `index.ts` | 215/217 |
| same | per-package scaffold census (`package.json`, `./internal/*`, `tsconfig.test.json`, `tsconfig.check.json`, `test/`, `docgen.json`) | table in §4 |
| same | `ls <pkg>/src` root files | §4 root-file rows; `Tools.ts` in law-practice |
| same | `find <pkg>/test -name '*.test.ts*' \| wc -l`; subdirs | all flat, `integration/` ×4 |
| `packages/architecture-lab/*/package.json` | `awk '/"exports"/…' \| grep -o '"\./[^"]*"'` | generator export grammar in §1.4 |
| `standards/ARCHITECTURE.md` | `sed -n '681,700p;827,970p;954,1135p;1912,1990p'` | anchors, topology, vocabulary, enforcement lanes |
| `goals/canonical-slice-factory/` | `ls -R`; `grep -n '^#' SPEC.md` | PLAN/SPEC/README + reflection 2026-06-12 |
