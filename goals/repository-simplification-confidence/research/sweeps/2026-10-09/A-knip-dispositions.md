# Gap follow-up 1: Knip finding dispositions

## Gap follow-up (2.A Knip ("transfer findings into a one-time remediation list ... fix genuine issues and document legitimate cases"); 5 Stage 2 exit; 7 named unmatched candidates)

Provenance: lane `rsc-packet`, head `e62411d63f` (= main), 2026-10-09. Read-only sweep. Input: scratch
`rsc/knip-fresh-rows.tsv` (41 rows, Knip 6.40.0 patched, reproduced at `e62411d63f`; `diff` against
`standards/knip.regression-baseline.jsonc` is empty, per scratch `rsc/knip-reconciliation.md`).

Commands used (all from the checkout root):

- Definition check: `rg -n -w <name> <file>` per row.
- Importers: `rg -l --hidden -w <name> -g '!node_modules' -g '!**/dist/**' -g '!graft/**'` minus the defining
  file, then `rg -n 'import[^;]*\b<name>\b|\b<name>\b[^;]*from'` over `packages apps tools scripts` to separate
  real imports from same-name local copies, JSDoc example text, and inventory/history records.
- `graft callers <name>` for the 11 named candidates (graft resolves 6; `ledgerRowsDir`,
  `CHROME_EPOCH_OFFSET_SECONDS`, `RESEARCH_UNITS`, `VAULT_ENV_VAR`, `parseCard` are not in the graph, so rg is the evidence).
- `jq '.exports' <pkg>/package.json`, `jq '.exclude' <pkg>/docgen.json`, `head` of generated files,
  `git log -G parseCard`, and a comparison of `tsconfig.test.json` and `devDependencies` across sibling drivers.

"Importers" = code files outside the defining file that import the symbol by name, tests and scripts included.
Hits counted as NOT importers: `standards/knip.regression-baseline.jsonc` (every row), schema/JSDoc inventories
(`standards/*.generated.jsonc`, `standards/jsdoc-documentation.inventory.*`), `goals/**` history and inventory
records, and same-name private definitions in other files (named per row).

## Cross-cutting facts

1. Every flagged export at head is used inside its own file and imported by zero other code files. Knip flags them
   because the root `knip.jsonc` does not set `ignoreExportsUsedInFile` (only one workspace block, `knip.jsonc:60`, does).
   These are exports that are wider than they need to be, not dead logic. The one exception is `parseCard`
   (row 30): it has no caller anywhere, including its own file.
2. The internal subpaths are not public. Every flagged package's export map sets `"./internal/*": null`.
   Checked: `occt`, `codegen-kit`, `wink`, `box`, `data`, `ai-metrics`, `colors`, and `repo-cli` (`./commands/<X>/internal/*`
   is `null` for Quality, Research, Lint, Docgen, HarnessLedger, Yeet). Removing `export` cannot break an external
   consumer, because none can resolve these modules.
3. Four JSDoc examples import symbols that this sweep proposes to un-export: `FormatterInput`
   (`ColorsSchema.ts:20`, `:43`), `PackageSubjectCandidateResult` (`Quality.subjects.ts:892`), and
   `ignoredDirectoryNames` (`WorkspaceWalk.ts:34`). The internal directories are excluded from docgen
   (`colors/docgen.json`, `cli/docgen.json` `src/**/internal/**/*.ts`), so these examples are not compiled.
   The examples also import from subpaths the export map blocks. Remove each example together with its `export`.

## Per-finding table

Paths: `B` = `packages/drivers/box-provisioning/src/internal/canonical.ts`, `Q` = `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts`,
`T` = `packages/tooling/library/codegen-kit/src/internal/transforms.ts`, `R` = `packages/tooling/tool/cli/src/commands/Research/internal/`.

| # | kind | file:symbol (def line) | importers | in-file uses | evidence | disposition | reason / owner |
|---|---|---|---|---|---|---|---|
| 1 | devDependencies | `packages/drivers/freshbooks/package.json` → `@beep/test-utils` (`:74`) | 0 | n/a | `rg -n '@beep/test-utils' packages/drivers/freshbooks` returns only the manifest line. The tests import `@beep/test-runner`, `@effect/vitest`, and `@beep/utils` | fix-manifest | Remove the devDependency. Owner `@beep/freshbooks` |
| 2 | exports | `B:boxContentMigrationPlanDigest` (`:176`) | 0 | `:188`, `:193` | rg | fix-remove-export | Private helper of the plan-digest builders. Owner `@beep/box-provisioning` |
| 3 | exports | `B:boxProvisioningPlanDigest` (`:137`) | 0 | `:149`, `:154` | rg | fix-remove-export | Same as row 2 |
| 4 | exports | `B:canonicalBoxContentMigrationMap` (`:160`) | 0 | `:174` | rg | fix-remove-export | Same as row 2 |
| 5 | exports | `packages/drivers/box/src/internal/Box.runtime.ts:diagnosticsFor` (`:131`) | 0 | `:155` | rg. `xai`, `firecrawl`, `venice-ai`, and `runpod` each define their own private `const diagnosticsFor` and do not import this one | fix-remove-export | Owner `@beep/box` |
| 6 | exports | `packages/drivers/occt/src/internal/shading.ts:lightFor` (`:27`) | 0 | `:142` | `graft callers lightFor` → only `shadeFace` (same file) | fix-remove-export | Named candidate. Owner `@beep/occt` |
| 7 | exports | `…/occt/src/internal/shading.ts:pitchFor` (`:40`) | 0 | `:146` | `graft callers pitchFor` → only `shadeFace` | fix-remove-export | Named candidate. Owner `@beep/occt` |
| 8 | exports | `packages/drivers/pdf-tools/src/internal/ppm.ts:parseP6Header` (`:62`) | 0 | `:166` | `graft callers` → only `measureP6` (same file) | fix-remove-export | Named candidate. Owner `@beep/pdf-tools` |
| 9 | exports | `packages/foundation/capability/colors/src/internal/ColorsSchema.ts:FormatterInput` (const `:30`) | 0 | type alias `:52`, `Formatter` param `:70` | rg. `Colors.ts` and `Colors.browser.ts` import only `ColorsFields` and `Formatter` | fix-remove-export | Un-export the const and drop its JSDoc examples (`:20`, `:43`). The same-name type alias may stay exported because public `Formatter` references it. Owner `@beep/colors` |
| 10 | exports | `packages/tooling/library/ai-metrics/src/internal/transcript-utils.ts:repoPathToClaudeProjectName` (re-export `:20`) | 0 via this path | `:65` (imported from `../shell.ts` `:17`) | The canonical export is `src/shell.ts`, re-exported by `src/index.ts:236` (`export * from "./shell.ts"`), as `.changeset/ai-metrics-transcript-path-export.md` intended | fix-remove-export | Delete only the redundant `export { … }` at `:20` and keep the import. The public barrel export is unaffected. Owner `@beep/repo-ai-metrics` |
| 11 | exports | `T:makeDistributeUnionSiblings` (`:105`) | 0 | registry `:143` | Consumers select transforms by string name (`CodegenKit.models.ts:166-170`, `acp/scripts/generate.ts:120`, `runpod/scripts/generate.ts:31`, `CodegenKit.test.ts`), through `transformRegistry` and `composeTransforms` | fix-remove-export | Public contract is the name literal, not the function. Owner `@beep/codegen-kit` |
| 12 | exports | `T:makeFlattenAllOfRefVariants` (`:77`) | 0 | `:106`, `:142` | Same as row 11 | fix-remove-export | Same as row 11 |
| 13 | exports | `T:nullableTypeArray` (`:62`) | 0 | `:141` | Same as row 11. The other rg hits are string literals and boolean-creep history | fix-remove-export | Same as row 11 |
| 14 | exports | `T:openObjects` (`:130`) | 0 | `:144` | Same as row 11 | fix-remove-export | Same as row 11 |
| 15 | exports | `T:stripExamples` (`:135`) | 0 | `:145` | Same as row 11 | fix-remove-export | Same as row 11 |
| 16 | exports | `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts:PackageSubjectCandidateResult` (`:906`) | 0 | `:973`, `:1011` (`satisfies`) | rg (other hits are schema catalog and boolean-creep inventories) | fix-remove-export | Drop the JSDoc example at `:892`. The schema catalog row disappears when the catalog is regenerated through its owner, not by hand. Owner `@beep/repo-cli` (Docgen) |
| 17 | exports | `packages/tooling/tool/cli/src/commands/HarnessLedger/internal/LedgerChains.ts:supersededRowIds` (`:24`) | 0 | `:53` | `graft callers` → only `chainHeads` (same file) | fix-remove-export | Named candidate. Owner `@beep/repo-cli` (HarnessLedger) |
| 18 | exports | `…/HarnessLedger/internal/LedgerFiles.ts:ledgerRowsDir` (`:42`) | 0 | `:77`, `:117` | rg (not in the graft graph) | fix-remove-export | Named candidate. Owner `@beep/repo-cli` (HarnessLedger) |
| 19 | exports | `…/Lint/internal/WorkspaceWalk.ts:ignoredDirectoryNames` (`:43`) | 0 | `:105` (and `{@link}` at `:77`) | rg | fix-remove-export | Drop the JSDoc example at `:34`, which imports a blocked subpath. Owner `@beep/repo-cli` (Lint) |
| 20 | exports | `Q:expandWorkspacePattern` (`:356`) | 0 | `:458` | `goals/effect-vitest-canon/research/census/packages/_generate-census.mjs:12` is its own copy | fix-remove-export | Owner `@beep/repo-cli` (Quality) |
| 21 | exports | `Q:ignoredSourceSuffixes` (`:191`) | 0 | `:610` | rg | fix-remove-export | Same owner |
| 22 | exports | `Q:readPackageJson` (`:302`) | 0 | `:325`, `:459` | `Quality/Tasks.ts:3710`, `Quality/ChangesetGraph.ts:209`, and `docgen/src/Configuration.ts:426` each define their own private copy | fix-remove-export | Same owner. The duplication is a separate reuse candidate and outside this list |
| 23 | exports | `Q:readRootPackage` (`:321`) | 0 | `:443` | rg | fix-remove-export | Same owner |
| 24 | exports | `Q:readText` (`:199`) | 0 | `:217` | rg hits in tests are `fixture.readText` methods and local helpers, not imports | fix-remove-export | Same owner |
| 25 | exports | `Q:resolveEntryWithinRoot` (`:284`) | 0 | `:395` | rg | fix-remove-export | Same owner |
| 26 | exports | `Q:sourceExtensions` (`:183`) | 0 | `:606` | rg | fix-remove-export | Same owner |
| 27 | exports | `Q:workspacePatternsFrom` (`:336`) | 0 | `:457` | `ChangesetGraph.ts:172` is its own private copy | fix-remove-export | Same owner. Reuse candidate as in row 22 |
| 28 | exports | `R+BrowserHistory.ts:CHROME_EPOCH_OFFSET_SECONDS` (`:39`) | 0 | `:187`, `:198` | rg (not in the graft graph) | fix-remove-export | Named candidate. Owner `@beep/repo-cli` (Research) |
| 29 | exports | `R+RepoCards.ts:remoteToHttpsUrl` (`:173`) | 0 | `:196`, `:219` | `graft callers` → only `RepoCards.ts` | fix-remove-export | Named candidate. Same owner |
| 30 | exports | `R+Timers.ts:RESEARCH_UNITS` (`:42`) | 0 | `:167`, `:168` | rg (not in the graft graph) | fix-remove-export | Named candidate. Same owner |
| 31 | exports | `R+Vault.ts:parseCard` (`:205`) | 0 | **0** | rg finds only the definition. The other hit is the text of `explorations/identity-as-iri/research/repos/ontorite.md`. `git log -G parseCard` shows no caller in the cli history | fix-remove-export (delete the function) | Genuinely dead code, and the only one in the list. Delete the whole function and then re-check imports it alone used (for example `Yaml`). Named candidate. Same owner |
| 32 | exports | `R+Vault.ts:VAULT_ENV_VAR` (`:34`) | 0 | `:81`, `:91` | rg (not in the graft graph) | fix-remove-export | Named candidate. Same owner |
| 33 | exports | `…/Yeet/internal/HeadInstallPreflight.ts:HEAD_INSTALL_PREFLIGHT_FAILURE_HINT` (`:44`) | 0 | `:122`, `:142` | rg (no test imports it) | fix-remove-export | Owner `@beep/repo-cli` (Yeet) |
| 34 | files | `packages/drivers/govinfo/src/_generated/Govinfo.gen.ts` | 0 (by design) | n/a | Header `:1-8` says it is generated from the checked-in OpenAPI document as a "drift oracle" that must not be imported. It is regenerated by `scripts/generate.ts:32` and checked by `generate:check` and `test/Govinfo.generated.test.ts:52`. Export map `"./_generated/*": null`. Excluded by `vitest.config.ts:9` and `docgen.json:3` | legitimate-keep | Intentionally unreferenced generated drift oracle. Document it in the remediation list. Owner `@beep/govinfo` |
| 35 | files | `packages/foundation/primitive/data/src/internal/data/currency-codes.ts` | 0 | n/a | A 13-line bridge that re-exports `../../generated/iso4217.ts`. `src/CurrencyCodes.ts:12` imports `./generated/iso4217.ts` directly. Reachable only through the dead barrel (row 36) | fix-delete-file | Redundant bridge. Owner `@beep/data` |
| 36 | files | `…/data/src/internal/data/index.ts` | 0 | n/a | A 5-line namespace barrel. The live modules import the leaves directly (`Calendar.ts:13`, `MimeTypes.ts:13`, `KeyboardShortcuts.ts:13`) | fix-delete-file | Dead barrel. Deleting it leaves the `calendar`, `keyboard-shortcuts`, and `mime-types` leaves untouched. Owner `@beep/data` |
| 37 | files | `…/data/src/internal/data/timezones.ts` | 0 | n/a | A 447-line hand-written `TimezoneNameValues` list superseded by `src/generated/iana-timezones.ts` (generated by `beep sync-data-to-ts --target iana-timezones`), which `src/Timezones.ts:11` imports. The list is stale: it has `Europe/Kiev` (`:360`) but no `Europe/Kyiv`, which the generated file has (`:1450`) | fix-delete-file | Stale duplicate of generated data. Owner `@beep/data` |
| 38 | files | `…/data/src/internal/index.ts` | 0 | n/a | `export * from "./data/index.ts"`. Its JSDoc example imports `@beep/data/internal`, which the export map cannot serve: `"./*"` maps to the non-existent `src/internal.ts`, and `"./internal/*"` is `null`. The only other hit is a jsdoc-carrier-migration history row | fix-delete-file | Unreachable barrel. Owner `@beep/data` |
| 39 | types | `packages/drivers/wink/src/internal/bm25.ts:BM25Accessor` (`:8`) | 0 | `:12`, `:15` (exported `BM25VectorizerInstance` method signatures) | `graft callers BM25Accessor` → no edges. `WinkVectorizer.service.ts:24`, `:31` import other symbols from this file but not this one | fix-remove-export | TypeScript allows a non-exported alias in an exported interface's signature. Low priority. Named candidate. Owner `@beep/wink` |
| 40 | types | `packages/tooling/library/codegen-kit/src/internal/format.ts:Formatter` (`:9`) | 0 | `:121` (`satisfies`) | rg. Every other `Formatter` hit belongs to `@beep/colors` or another unrelated symbol | fix-remove-export | Owner `@beep/codegen-kit` |
| 41 | unresolved | `packages/drivers/freshbooks/tsconfig.test.json` → `bun-types` | n/a | n/a | `tsconfig.test.json` is byte-identical in shape to `govinfo`, `box`, and `runpod` (`"types": ["node", "bun-types"]`, 107 `tsconfig.test.json` files declare it). Those siblings list `"bun-types": "catalog:"` in devDependencies. `freshbooks` devDependencies are only `@beep/test-runner`, `@beep/test-utils`, `@effect/vitest`, and `@types/node`. It type-checks today only through the hoisted root `node_modules/bun-types` | fix-manifest | Add `"bun-types": "catalog:"` to freshbooks devDependencies (pairs with row 1). The alternative is dropping it from `types`, since freshbooks `src`/`test` use no `Bun.` API, but that diverges from the 107-file convention. Owner `@beep/freshbooks` |

Totals (41): fix-remove-export **34** (32 export rows 2–33 + 2 type rows 39–40; row 31 deletes the dead function, row 10 removes only a redundant re-export), fix-delete-file **4** (rows 35–38), fix-manifest **2** (rows 1, 41), legitimate-keep **1** (row 34), needs-owner **0**. `R+X.ts` in the table means `R` + `X.ts`.

## Named-candidate map (brief §7)

| Candidate | Row | Exact path:symbol |
|---|---|---|
| `lightFor` | 6 | `packages/drivers/occt/src/internal/shading.ts:lightFor` |
| `pitchFor` | 7 | `packages/drivers/occt/src/internal/shading.ts:pitchFor` |
| `parseP6Header` | 8 | `packages/drivers/pdf-tools/src/internal/ppm.ts:parseP6Header` |
| `supersededRowIds` | 17 | `packages/tooling/tool/cli/src/commands/HarnessLedger/internal/LedgerChains.ts:supersededRowIds` |
| `ledgerRowsDir` | 18 | `packages/tooling/tool/cli/src/commands/HarnessLedger/internal/LedgerFiles.ts:ledgerRowsDir` |
| `CHROME_EPOCH_OFFSET_SECONDS` | 28 | `packages/tooling/tool/cli/src/commands/Research/internal/BrowserHistory.ts:CHROME_EPOCH_OFFSET_SECONDS` |
| `remoteToHttpsUrl` | 29 | `packages/tooling/tool/cli/src/commands/Research/internal/RepoCards.ts:remoteToHttpsUrl` |
| `RESEARCH_UNITS` | 30 | `packages/tooling/tool/cli/src/commands/Research/internal/Timers.ts:RESEARCH_UNITS` |
| `VAULT_ENV_VAR` | 32 | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts:VAULT_ENV_VAR` |
| `parseCard` | 31 | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts:parseCard` (dead) |
| `BM25Accessor` | 39 | `packages/drivers/wink/src/internal/bm25.ts:BM25Accessor` |

## Proposed plan (implementing lane)

1. Land one remediation commit before the Knip removal commit, grouped by owner package: `box-provisioning`, `box`,
   `occt`, `pdf-tools`, `colors`, `ai-metrics`, `codegen-kit`, `wink`, `data`, `freshbooks`, and `repo-cli`
   (Docgen, HarnessLedger, Lint, Quality, Research, Yeet).
2. For rows 2–33 and 39–40, remove the `export` keyword. Delete `parseCard` outright. Delete only the re-export line
   in `transcript-utils.ts`. Remove the JSDoc examples that import the un-exported symbols (rows 9, 16, 19), since
   non-exported declarations need no example. Leave the symbols' own logic unchanged.
3. Delete the four `@beep/data` internal files (rows 35–38) together. Then confirm with `rg -n 'internal/data/index|internal/index'`
   in `packages/foundation/primitive/data` that no import is left.
4. In `freshbooks/package.json`, remove `@beep/test-utils` and add `"bun-types": "catalog:"`, then run `bun install`
   to refresh the lockfile.
5. Record row 34 (Govinfo drift oracle) as the only documented legitimate case in the packet's knip-findings table,
   with its owner and a reconsideration condition: remove the file if the drift test moves to an in-memory comparison.
6. Regenerate `standards/schema-catalog.generated.jsonc` and the JSDoc inventory through their owner commands,
   because rows 9 and 16 appear in them. Then run `bun run beep quality package-verify <pkg>` for each touched package.
   As a final cross-check, run Knip once before removing it: the expected result is a single finding, row 34.
   Only then delete the baseline.

## Open questions

- Whether the `import.meta.vitest` doctest lane collects `src/internal/**` in `@beep/data`. The deleted
  `internal/index.ts` example carries a `ts import.meta.vitest` fence that would fail to resolve
  `@beep/data/internal` if it were collected. This sweep did not establish the doctest include set (`vitest.shared.ts`
  plus the `@effect/doctest` plugin), and deleting the file makes the question moot.
- Whether `parseCard` was written for a planned Research reader command. No issue or goal references it. Treat it as
  dead unless the Research owner says otherwise.
- Whether the tree has no other private copies of `readPackageJson` and `workspacePatternsFrom` beyond those named in
  rows 22 and 27. Only `packages/` and `apps/` were searched. Consolidating the copies is a reuse task, not Knip remediation.
- This sweep did not re-run Knip after the hypothetical fixes. Confirming that only row 34 remains is step 6 of the plan.
