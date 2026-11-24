# P7 map: what remains of @beep/nlp after P6, its consumers and dispositions

Measured at commit f30c183f20a (P7 lane head); P6 lane head consulted: f30c183f20a plus its uncommitted row-5 work tree (`Activity.ts`, `ActivityRecord.ts`, edits to nlp-processing manifests, `tsconfig.json`, `vitest.aliases.generated.json`, `standards/fallow.boundaries.generated.jsonc`).

Read-only measurement. No source was edited. Paths are repo-relative; `nlp/` abbreviates
`packages/foundation/modeling/nlp/` and `np/` abbreviates
`packages/foundation/capability/nlp-processing/`. The only command run beyond `rg`, `git` and
`grep` was `bun run beep delete-package --dry-run @beep/nlp` (no tree change; `git status` clean
before and after).

This map covers `@beep/nlp` only. `@beep/schema-org` and the cli knowledge-base `Selector`
re-check are other P7 maps; the `Selector` is noted in section 9 only because chapter 16 ties it to
the same retirement.

## 1. Method and the P6 baseline

P6 rows 0 to 3 are committed at f30c183f20a. Rows 1 and 2 are the only P6 rows that touch `nlp/`
(design `research/2026-11-24-p6-design.md:968-970`): row 1 moved `Core`, `Graph/Schema.ts` and
`internal/numbers.ts` to `np/`, row 2 deleted `Operations`, `Algebra`, `Graph/GraphOps.ts` and
`Graph/index.ts`. Rows 4 to 17 add no file to `nlp/` and remove none from it. Three later rows touch
the residue's references outside the package:

- row 6 renames the span label `package: "@beep/nlp"` at `np/src/internal/observability.ts:16`
  to `@beep/nlp-processing` (design `:864-866`);
- row 11 edits `@beep/nlp-mcp` (tool hints, design `:978`) and may touch its stale doc lines
  (section 3.3 below);
- row 17 regenerates the cache baselines, which drops the stale `@beep/nlp#build` edges of
  section 3.2.

The design states the result (`research/2026-11-24-p6-design.md:478-479`): "After P6, `@beep/nlp`
holds `IdentifierText`, `PathText`, `QueryText`, `VariantText`, the barrel and `THEORY.md`; P7
retires them with the package." The live tree agrees.

## 2. What remains in the package

`git ls-files nlp/`: 16 files. Source is 413 lines in five files; the four helper modules are 341
lines, matching the census row (`research/consumer-census.md:172`).

| File | Lines | Exports (path:line) | Imports |
| --- | --- | --- | --- |
| `nlp/src/QueryText.ts` | 83 | `normalizeQuestion` `:35`, `normalizePhrase` `:58`, `extractBacktickValue` `:82` | `@beep/utils` (`A`, `Str`), `effect/Function`, `effect/Option` |
| `nlp/src/VariantText.ts` | 40 | `orderedDedupe` `:37` (private `stringEquals` `:11`) | `@beep/utils`, `effect/Function`, `effect/Order` |
| `nlp/src/IdentifierText.ts` | 98 | `tokens` `:42`, `variants` `:69` (private `normalizeIdentifierWords` `:13`) | `@beep/utils`, `effect/Function`, `effect/Option`, `./QueryText.ts`, `./VariantText.ts` |
| `nlp/src/PathText.ts` | 120 | `normalizePathPhrase` `:49`, `isPathLike` `:73`, `filePathVariants` `:97`, `moduleSpecifierVariants` `:120` (both alias a private `pathFragmentVariants`) | `@beep/utils`, `effect/Function`, `./QueryText.ts`, `./VariantText.ts` |
| `nlp/src/index.ts` | 72 | namespaces `IdentifierText` `:24`, `PathText` `:40`, `QueryText` `:56`, `VariantText` `:72` | the four modules |
| `nlp/test/TextVariants.test.ts` | 69 | four `it` cases over all four modules (`:1-4` import the subpaths) | `@beep/test-runner`, `@effect/vitest` |
| `nlp/THEORY.md` | 180 | narrative (section 5) | n/a |
| `nlp/README.md` | 42 | already says the modules "retire with the package in P7" (`:6-9`); consumer table empty (`:28-31`) | n/a |
| `nlp/CHANGELOG.md`, `nlp/LICENSE`, `nlp/docgen.json`, `nlp/vitest.config.ts`, `nlp/tsconfig{,.check,.test}.json`, `nlp/package.json` | n/a | manifest exports `.`, `./IdentifierText`, `./PathText`, `./QueryText`, `./VariantText`, `./internal/*: null` | n/a |

No `nlp/decisions/` folder exists, no `AGENTS.md`/`CLAUDE.md`, no `src/internal/` and no fixtures
beyond the one test file. The manifest is `"private": true` (`nlp/package.json:6`) and still
declares `@beep/identity`, `@beep/schema` and `@beep/text` as dependencies that no source file
imports (only `@beep/utils` is imported); they leave with the package.

Neither the schema catalog (`standards/schema-catalog/@beep/` has no `nlp` shard; the five
`NLPMonoid` rows went with row 2) nor the instrumentation catalog (no `nlp` shard; `mapNodesEffect`
went with `GraphOps.ts`) names the package any more. The helpers declare no schema, no service and
no span.

## 3. Consumers (exhaustive)

### 3.1 Code consumers: none

`rg -n -P 'from "@beep/nlp(?![-\w])'` over `packages`, `apps`, `scratchpad` in both lanes returns
only `nlp/` itself. No `package.json` outside `nlp/` lists `"@beep/nlp"` in either lane
(`rg -l '"@beep/nlp"' -g package.json`). `bun run beep delete-package --dry-run @beep/nlp` agrees:
"direct: (none)", "transitive: (none)". The exported symbol names (`orderedDedupe`,
`normalizePathPhrase`, `filePathVariants`, `moduleSpecifierVariants`, `extractBacktickValue`,
`normalizeQuestion`, the four namespace names) occur nowhere in `packages`, `apps`, `standards`,
`docs`, `scratchpad` or `explorations` outside `nlp/`, `tsconfig.json`,
`vitest.aliases.generated.json` and the coverage baseline.

### 3.2 Generated registrations and baselines

Each is rewritten by its writer, never by hand (S31: rows of a deleted package are removed).

| Surface | Evidence | Writer / route |
| --- | --- | --- |
| root path map | `tsconfig.json:76`, `:144-155` | `tsconfig-sync` (delete-package rebuild step) |
| vitest aliases | `vitest.aliases.generated.json:29`, `:87-96` | same writer |
| project references | `tsconfig.packages.json:415` | same writer |
| lockfile | `bun.lock:3098` (workspace block), `:5609` | `bun install` (delete-package `lockfile` step) |
| fallow boundaries | `standards/fallow.boundaries.generated.jsonc:705-707` (zone), `:3893-3910` (`from: @beep/nlp` allow lists); `standards/fallow.boundaries.provenance.jsonc:457-462` | `fallow:boundaries:write` |
| coverage baseline | `standards/coverage.regression-baseline.jsonc:28885-28946` (package row plus `IdentifierText`, `PathText`, `QueryText`, `VariantText`, `index` files) | delete-package `coverage-baseline` step |
| cache baselines | `standards/cache-baseline/@beep/nlp.json` (16 lines); stale `@beep/nlp#build` edges in `@beep/nlp-processing.json` (8), `@beep/wink.json` (8), `@beep/semantica.json` (7), `@beep/law-practice-use-cases.json` (7), `@beep/law-practice-server.json` (9); `_root.json:2218` input glob | `bun run beep cache baseline` with a request whose subjects exclude `@beep/nlp` and whose `previous` keeps its digest (decision `2026-11-22-p2-cache-request-names-the-retired-package-in-previous-only`); the five consumer files drop the edge when P6 row 17 or P7 re-stamps them |
| turbo inputs | `turbo.json:400` | regenerated input list (P2 precedent: `turbo.json` 2 lines in `010f21e3934`) |
| policy fingerprint | `standards/policy-tools.fingerprint.json:645` | fingerprint writer |
| identity composer | `packages/foundation/modeling/identity/src/packages.ts:790-804` (`$NlpId`, its JSDoc example); `identity/test/shape-stable.test.ts:69`, `:161` | delete-package `identity-segment` step; `bun run beep lint identity-registry`. No `nlp` term exists under `identity/registry/` and no source calls `$NlpId` |
| retired-name guard | `standards/changesets.retired-packages.json` (no row yet) | add a row as P2 did for `@beep/provenance` (`:39-42`) |
| changesets | none pending name `@beep/nlp` (`.changeset/` holds only `config.json` and `README.md`) | private package: no changeset (`--retire-changesets` not needed) |
| `.gitleaks.toml:296` | names the old `nlp/src/Core/Token.ts` inside the frozen boolean-creep block | untouched (P6 design `:489-494`) |

Not present for this package: schema-catalog shard, instrumentation shard,
`standards/schema-first.inventory.jsonc` rows, effect-laws allowlist rows, the
`no-manual-effect-runtime-in-tests.ts` allowances (all moved or removed in P6 rows 1 and 2), knip,
sherif, `.github/CODEOWNERS` entries, a root docgen aggregate, pending changesets.

### 3.3 Hand-written references in live code and docs

None imports the package; each names it in prose or a registration table. These are the 33
`file-path` hits behind the dry run's hard refusal ("33 unacknowledged production/test/script/path
dependent hit(s)").

| File:line | Text | Proposed change |
| --- | --- | --- |
| `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts:412`, `:827` | `"@beep/nlp"` in two lane package lists | delete the entries |
| `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts:394` | `"@beep/nlp": 3.4` coverage weight | delete the entry |
| `packages/tooling/tool/cli/test/quality-tasks.test.ts:9343` | `"@beep/nlp"` in a ten-shard plan fixture | delete, then re-check the shard assertions (N6) |
| `packages/tooling/tool/cli/test/fixtures/dependency-review/manifest-inventory.json:672-676` | `nlp/package.json` row | delete the row (P2 changed this fixture the same way in `010f21e3934`) |
| `np/src/internal/observability.ts:2`, `:16` | module doc and span label | P6 row 6 renames the label; the `:2` doc line follows |
| `np/src/{NLPService.ts:12, Backend/Composition.ts:13, Backend/NLPBackend.ts:11, Graph/AnnotatedTextGraph.ts:13, Graph/EffectGraph.ts:14, Graph/Schema.ts:12, Graph/TextGraph.ts:10, Graph/GraphOperations/{Catalog.ts:12, Errors.ts:6, Executor.ts:12, ResultStore.ts:10, Types.ts:11}}` | "Effect v4 `@beep/nlp` implementation notes:" in 12 module docs | rename to `@beep/nlp-processing` or drop the heading line (N4) |
| `np/CHANGELOG.md:1` | heading `# @beep/nlp` on the nlp-processing changelog | `# @beep/nlp-processing` (N5) |
| `packages/drivers/wink/README.md:3` | "runtime for the product-neutral `@beep/nlp` contracts" | name `@beep/nlp-processing` |
| `packages/drivers/wink/AGENTS.md:4-5` (`CLAUDE.md` is a symlink to it) | "Keep reusable NLP schemas and contracts in `@beep/nlp`" | point at `@beep/nlp-processing` (and `@beep/annotation` for standoff kinds) |
| `packages/drivers/wink/src/WinkBackend.service.ts:13` | "Effect v4 `@beep/nlp` implementation notes" | as for `np/` |
| `packages/drivers/nlp-mcp/package.json:4`, `README.md:3`, `src/bin.ts:2`, `src/Server.ts:2`, `:8` | "exposing `@beep/nlp` operations", "`NlpToolkit` from `@beep/nlp`" (it lives in `np/src/Tools/`) | name `@beep/nlp-processing`; the server is the `nlp-mcp` driver |
| `packages/drivers/nlp-mcp/test/Server.test.ts:12` | test title "mounts the full @beep/nlp NlpToolkit" | retitle |
| `docs/PROSE_TO_PROOF_ARCHITECTURE_MAP.md:121` | "Have today ... `@beep/nlp-mcp`/`@beep/nlp`/`@beep/wink`" | drop `@beep/nlp`, keep the others |
| `standards/architecture/16-knowledge-stack.md:385-388` | L5 owner "absorbs `nlp/Operations`, ... `nlp/Algebra` ..., `nlp/Core` (Pending P6)" | P6 row 16 closes the Pending note; P7 rewords to the former nlp package (P2 precedent, decision `2026-11-22-p2-retired-name-leaves-live-standards`) |
| `standards/architecture/16-knowledge-stack.md:558` | "the `@beep/nlp` Handoff and Graph spans were deleted in P3" | "the former nlp package's" |
| `standards/architecture/16-knowledge-stack.md:773-776` | "`packages/foundation/modeling/nlp/THEORY.md` described `@beep/nlp` ... That file is deleted with its package in P7" | past tense, former-package wording (section 5) |

The exit gate `rg -l '@beep/nlp["/]' packages apps standards tsconfig.json` matches only the
quoted and slash forms. Today it lists `tsconfig.json`, the coverage baseline, both fallow files,
`cache-baseline/@beep/nlp.json`, the three cli files, `np/src/internal/observability.ts`, both
identity files and `nlp/` itself. The backticked prose forms in wink, nlp-mcp, `np/` module docs
and chapter 16 pass that gate but fail `delete-package --check`, so both gates are run.

### 3.4 Historical records (preserved)

The dry run classifies 1,775 `historical-doc` hits (most in the turborepo-quality-cache-adoption,
turborepo-task-qualification and claim-check-performance packets, and 168 in this packet's
research) and 1,389 `packet` hits. The packet hits include completed manifests that name
`@beep/nlp` as a phase subject: `goals/nlp-adjunct-port/ops/manifest.json:8-30`,
`goals/langextract-capability/ops/manifest.json:122-126` (`reuseGate.preferredHome`),
`goals/law-practice-office-action-spike/ops/manifest.json:89`, and boolean-creep sweep lane maps.
`standards/architecture/DECISIONS.md:2807-3213` (ten lines) is history: the doctor's history
predicate names `standards/architecture/DECISIONS.md` and the retired-package registry
(`packages/tooling/tool/cli/src/commands/DeletePackage/internal/RegistrationGeometry/RegistrationGeometry.plan.ts:60-61`).
`explorations/` (35 files) and `docs/reports/` (16 files) are dated records. Rewriting any of
these would falsify them; the soft refusal ("Packet reference remains at
goals/boolean-creep/data/design-refresh-2026-09-09-main-52fcc8d-impact.md") is answered with
`--allow-stale-packets`, as P2 did.

This packet's own live files name the package as the thing being retired: `GOAL.md:13`,
`README.md:22`, `PLAN.md:31`, `SPEC.md` (lines 73, 81, 199, 234, 471, 554, 590, 1607, 1656, 1744,
2719, 2861-2867), `research/consumer-census.md` group b, `research/law-test-plan.md:33-35` (the
"`@beep/nlp` -> `@beep/nlp-processing`" owner column of L5-1 to L5-3).

## 4. Dispositions

| Module | Disposition | Reason |
| --- | --- | --- |
| `QueryText` | delete | 0 consumers; chapter 11 "In-repo deprecations without a release train" (`standards/architecture/11-evolution-and-deprecation.md:100-107`) removes an unreleased in-repo symbol with no consumer in the change that finds it. No stack layer of chapter 16 owns lookup-phrase normalization: L1 (`@beep/text`) owns occurrence identity and offsets, not query rewriting. |
| `VariantText` | delete | 0 consumers; `orderedDedupe` is `A.filter(Str.isNonEmpty)` then `A.dedupeWith` (`VariantText.ts:37-40`), an inline composition any future consumer writes in one line. |
| `IdentifierText` | delete | 0 consumers; nearest existing symbols are the case converters `Str.camelCase`/`snakeCase`/`kebabCase` (`packages/foundation/modeling/utils/src/Str.ts:363`, `:381`, `:399`), which convert rather than tokenize, so they are not a replacement, only a starting point. |
| `PathText` | delete | 0 consumers; `Path.basename` (`packages/foundation/modeling/utils/src/Path.ts:190`) covers the basename fallback the variants generate. |
| barrel `nlp/src/index.ts` | delete | no importer of `@beep/nlp` (census `:145`) |
| `nlp/test/TextVariants.test.ts` | delete with its module | rule 3 (`11-evolution-and-deprecation.md:148-152`) |
| `THEORY.md` | delete after the chapter check of section 5 | decision `DECISIONS.md:3157-3174` ("absorbed by section 14 ... deleted with `@beep/nlp` in P7") |
| `README.md`, `CHANGELOG.md`, `LICENSE`, `docgen.json`, `vitest.config.ts`, tsconfigs, `package.json` | delete with the owned tree | delete-package `owned-tree` step |

Nothing moves. No helper has a chapter 16 home, and moving dead code to keep it would add
inventory rows the next sweep deletes.

## 5. `THEORY.md` against chapter 16 section 14

Chapter 16 section 14 (`standards/architecture/16-knowledge-stack.md:771-801`) already absorbs the
file: six kept claims restated with ledger rows and four withdrawn claims. Per `THEORY.md` section:

| `THEORY.md` | Claim | Chapter 16 status |
| --- | --- | --- |
| header, `:1-13` | "full categorical fidelity" | said: `:773-776` quotes and rejects it ("category theory only where it predicts a law a test can falsify") |
| §1 `:17-29` | typed text strata as objects; nodes are schemas | kept: row "Text strata ... cannot confuse" -> `L2-5` (`:784`) |
| §2 `:31-42` | the graph is the colimit of passes; merge is a monoid, order-independent | kept: row "Merging independent annotation passes" -> `L2-1` (`:783`); the colimit wording is dropped, not withdrawn by name |
| §3 `:44-61` | Kleisli category; identity, associativity; `product` as tensor | kept: `L5-1`, `L5-2` (`:781-782`) |
| §4 `:63-71` | monoids and their laws | withdrawn: "Monoid and typeclass laws as stack laws" (`:794-796`) |
| §5 `:73-86` | F-algebras: `cata`/`ana` as first-class recursion schemes | not said. `cata`/`ana` live on in `np/src/Graph/EffectGraph.ts:10-15`, `:517-547`; the `L4-3` row (`:786`) covers only "Graph theory comes from Effect's `Graph` module" (N2) |
| §6 `:88-110` | structure/projection and query/index pairs; triangle identities | withdrawn (`:797-798`) |
| §7 `:112-126` | backends as functors; `BackendNotSupported` makes capability detection total; granular contract lets nlp-mcp expose each operation | not said. `BackendNotSupported` is live (`np/src/Backend/NLPBackend.ts`, 23 lines; wink 1) (N2) |
| §8 `:128-133` | handoff IR as a free object | withdrawn (`:789-793`) |
| §9 `:135-148` | laws as FastCheck proofs | restated by section 13 "What counts as a law" (`:742-769`: "A property test is falsification, not proof") |
| §10 `:150-160` | deferred: serialization folds, streaming MCP tools | stale: the streaming suite shipped (`goals/nlp-adjunct-port/ops/manifest.json:22-25`); nothing to absorb |
| §11 `:162-175` | map from mathematics to modules | superseded by the layer table (`:43-61`) and the L5 owner text |
| footer `:179-180` | "upstream half of the `ip-law-knowledge-graph` initiative" | withdrawn with the free-object claim ("the downstream owner the file named no longer exists", `:792-793`) |

So ten of the thirteen rows are in force on the chapter now; §5 and §7 are the only structural
claims with neither a ledger row nor a withdrawal, and §10 is stale. SPEC success criterion 8
(`SPEC.md:73-75`) still says `THEORY.md` is "rewritten as a narrative that links each structural
claim to its test", while `SPEC.md:234-235` and the DECISIONS entry say it is absorbed and deleted
(N1).

## 6. S31 inventory counts for `nlp/`

Base counts are the P0 table (`research/consumer-census.md:545-560`, `grep -cE
"packages/foundation/modeling/nlp/" <file>`). After P7 every row is 0.

| Inventory | P0 base | f30c183f20a | after P7 |
| --- | --- | --- | --- |
| `standards/coverage.regression-baseline.jsonc` | 29 | 5 (plus the package row `:28885-28886`) | 0 |
| `standards/schema-first.inventory.jsonc` | 1 | 0 | 0 |
| `standards/fallow.boundaries.provenance.jsonc` | 1 | 1 | 0 |
| `.gitleaks.toml` | 1 | 1 (frozen block, untouched) | 1 |
| `no-manual-effect-runtime-in-tests.ts` allowances | 3 | 0 | 0 |
| `standards/effect-laws.allowlist.jsonc`, `fallow.health`, `fallow.dead-code`, `test-typecheck.blindspot`, `jsdoc-totals`, `check-census`, `effect-vitest.inventory` | 0 | 0 | 0 |

The `.gitleaks.toml` line is a recorded hash in an immutable evidence block, not a live allowance;
it stays at the base count.

## 7. delete-package dry run

`bun run beep delete-package --dry-run @beep/nlp` at f30c183f20a prints the inverse plan: remove
the owned tree, the workspace literal and the `$NlpId` identity segment; rebuild `tsconfig-sync`,
the lockfile, fallow boundaries, coverage, fallow health and dead-code, schema-first inventory,
schema catalog, instrumentation catalog and test-typecheck baselines; remove modeled authored
references and refuse unknown hits; preserve historical records in 19 globs. It then refuses:

- hard: 33 `file-path` hits (section 3.3), acknowledgeable only for file-path and script hits;
- soft: packet references (section 3.4), answered with `--allow-stale-packets`.

Hit classes: 86 `baseline`, 33 `file-path`, 1,775 `historical-doc`, 1,389 `packet`. The P2 order
applies: edit the section 3.3 lines in the same commit, run delete-package with
`--allow-stale-packets`, then `delete-package --allow-stale-packets --check` must print clean
(decision `2026-11-22-p2-retired-name-leaves-live-standards`).

## 8. Proposed P7 rows for the nlp part

Subjects at most 98 characters.

| # | Subject | Files | Gate |
| --- | --- | --- | --- |
| a | docs(standards): absorb the remaining THEORY claims before the nlp file retires | chapter 16 section 14 rows or withdrawals for `THEORY.md` §5 and §7 (N2), `:558` and `:773-776` in former-package wording, SPEC criterion 8 reconciled (N1) | Biome; `goals decisions check --slug text-knowledge-stack-rebuild` |
| b | refactor(nlp)!: retire the nlp package; its four text helpers had no consumer | `delete-package @beep/nlp --allow-stale-packets` output; section 3.3 edits (cli tables and fixtures, wink and nlp-mcp docs, `np/` module docs and changelog heading, `docs/PROSE_TO_PROOF_ARCHITECTURE_MAP.md:121`); `standards/changesets.retired-packages.json` row; cache request with `@beep/nlp` in `previous` only | `delete-package --allow-stale-packets --check` clean; `rg -l '@beep/nlp["/]' packages apps standards tsconfig.json` empty; `bun run beep lint identity-registry`, `lint package-scripts`, `lint schema-first`; package-verify identity, nlp-processing, wink, nlp-mcp and repo-cli (`quality-tasks.test.ts`, `CiLanePartitions` tests); fallow; cache audit; no S31 growth (section 6) |
| c | docs(goals): record the nlp retirement dispositions | census group b rows dispositioned `retired in P7`, law-test-plan owner column, decision file for the deletion (N3) | manifest write then check; decisions check |

## 9. Adjacent item: the cli knowledge-base `Selector`

Chapter 16 section 5 (`16-knowledge-stack.md:562-564`) keeps the cli `Selector`, whose
`TextQuote` case (`packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts:114`) is a text anchor,
"because it is repo tooling with no consumer in the stack; P7 re-checks it". It does not import
`@beep/nlp` or any helper in section 2, so the nlp retirement does not change it.

## Open questions

N1. SPEC success criterion 8 (`SPEC.md:73-75`) asks for `THEORY.md` "rewritten as a narrative
that links each structural claim to its test", but `SPEC.md:234-235`, `PLAN.md:31` and
`DECISIONS.md:3157-3174` say the narrative is absorbed by chapter 16 section 14 and the file is
deleted. Does P7 reword criterion 8 to "absorbed by the chapter, file deleted" by decision file, or
must a rewritten file exist first?

N2. `THEORY.md` §5 (`cata`/`ana` recursion schemes, live in `np/src/Graph/EffectGraph.ts`) and §7
(backends as functors; `BackendNotSupported` makes capability detection total) have no kept row
and no withdrawal in chapter 16 section 14. Does the chapter add each as a withdrawn claim (no law
row names a defect they catch), add a law row (for example totality of capability detection over
`NLPBackend`), or leave them to the nlp-processing README as non-doctrinal notes?

N3. Chapter 11's slice procedure ends with a dated DECISIONS entry (step 5, `:16`), while the
`foundation/modeling` rules put the census in the goal packet's decision log. Is a goal decision
file enough for this retirement (the 2026-11-19 DECISIONS entry at `:2935` already says the package
"then retires"), or does P7 add a dated DECISIONS entry marking that entry delivered?

N4. The twelve `np/` module docs and `WinkBackend.service.ts:13` carry "Effect v4 `@beep/nlp`
implementation notes:" headings. Rename the package in the heading, or delete the heading line and
keep the bullets? The bullets are JSDoc on exported modules, so the comment law does not apply,
but the heading names port history, not behaviour.

N5. `np/CHANGELOG.md:1` reads `# @beep/nlp`, and its entries predate the rename that created
nlp-processing. Is the heading corrected only, or is the changelog's pre-rename history moved out?
The changeset writer regenerates the file on the next release.

N6. Removing `"@beep/nlp": 3.4` from `CoverageScope.ts:394` and the package from the ten-shard
fixture (`quality-tasks.test.ts:9343`) changes the coverage shard plan. Do the "calibrated
ten-shard plan" assertions in that test hold without re-calibration, or does P7 re-run the weight
measurement?

N7. P6 row 6 renames the `observability.ts:16` label and row 17 re-stamps the five consumer cache
baselines that still carry `@beep/nlp#build`. If P6 lands with either deferred, does P7 take them
over, or is P7 blocked until P6 merges? The P7 lane is cut from P6 at f30c183f20a, so P7 rebases
onto whatever P6 ships.

N8. Should P7 add `@beep/nlp` to `standards/changesets.retired-packages.json` with a "recover the
source from commit" pointer, as P2 did for `@beep/provenance`? The package is private and never
published, so the row only guards against reuse of the name.

N9. The completed manifests of other packets (`goals/nlp-adjunct-port/ops/manifest.json`,
`goals/langextract-capability/ops/manifest.json` `reuseGate.preferredHome: "@beep/nlp"`) name the
retired package as a live-looking field. They are left as history under `--allow-stale-packets`.
No tooling source reads `preferredHome` (`rg -l preferredHome packages/tooling` is empty), so it
is inert today; is it left as history, or rewritten so no completed manifest names a retired package
as a home?
