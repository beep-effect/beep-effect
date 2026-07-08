# DA-2 lane — `packages/tooling/tool/cli` dual-arity remediation

Wave: `DA-2`, lane: `da-2-repocli`. Single writer for `@beep/repo-cli`
(entry slice `ops/slices/P3/packages_tooling_tool_cli.json`, 6 candidates + 4
exceptions), plus the granted cross-package extension for
`@beep/repo-ai-metrics` (`AgentEffectivenessPhoenixSyncInput.new`, deferred
from DA-1's `da-1-batch` lane as `blocked: ripple` because its only real call
sites live in `@beep/repo-cli`). No commits made — driver owns commits per
SPEC. `standards/*.jsonc`, inventories, and `ops/progress.json` were never
opened; no inventory regen run.

## Candidates (`@beep/repo-cli`)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `aggregateLawFraction` | `src/commands/AgentEffectiveness/internal/EvalScorer.ts:634` | missing-dual + third-param-not-object-like (3 params, all `number`) | **fixed** | Symmetric 3-number mean (`schemaFirst`/`tsgo`/`biome`) — no argument is a more natural pipeable subject than the others, same shape as the P2-audit's `checkAssociativity` precedent (`ops/reports/P2-audits/p2-d5d8.md` D5). Collapsed to a single named-type options param (`LawFractionComponents`), arity 1 — at arity 1 the dual-arity law (2–3 params) no longer applies, so no `dual()` wrap was added. Swept the 1 in-file call site (inside `buildAgentEffectivenessEvalScoreReport`) and 1 test call site (`test/agent-effectiveness-eval-scorer.test.ts:134`). |
| `buildAgentEffectivenessEvalScoreReport` | `.../EvalScorer.ts:1029` | missing-dual (3 params: `task`, `completion`, `law`, all object-like) | **fixed** | `task` is the natural pipeable subject. `dual(3, ...)`; data-first calls (1 in-file, 2 in `test/agent-effectiveness-eval-scorer.test.ts`) remain valid unchanged. |
| `runWithResearchDb` | `src/commands/Research/internal/Catalog.ts:66` | missing-dual + third-param-not-object-like (`databasePath: string, message: string, work: Effect`) | **fixed** | Restructured to arity 2: pipeable subject is `work` (an `Effect`, one of RC-DUAL's blessed pipeable names), `databasePath`/`message` collapsed into a named-type options object (`RunWithResearchDbOptions`). `dual(2, ...)`. This reorders args, so it is a signature break: swept all 8 real call sites, all in `Research.service.ts` (same package), from `runWithResearchDb(databasePath, message, effect)` to `runWithResearchDb(effect, { databasePath, message })`. No test call sites exist. |
| `slugPartsOf` | `src/commands/Research/internal/RepoCards.ts:193` | missing-dual (2 params) | **fixed** | `remoteUrl: O.Option<string>` is the pipeable subject, `localDirname` the argument. `dual(2, ...)`; both real call sites (`RepoCards.ts:229`, `Research.service.ts:560`) are data-first and needed no change. |
| `renderCard` | `src/commands/Research/internal/Vault.ts:170` | missing-dual (2 params) | **fixed** | `frontmatter` is the pipeable subject, `body` the argument. `dual(2, ...)`; both real call sites (`Research.service.ts:278,322`) are data-first, unchanged. |
| `slugFor` | `.../Vault.ts:150` | missing-dual (2 params) | **fixed** | `title` is the pipeable subject, `urlNorm` the argument. `dual(2, ...)`; all 3 real call sites (`Research.service.ts:277,475,670`) are data-first, unchanged. |

## Exceptions (`@beep/repo-cli`, `src/commands/Lint/SchemaFirst.ts`)

All four share the exact shape `(astNode, file: string, owner: string) =>
O.Option<Entry>` and the recorded reason "no pipeable data subject, exported
solely for direct fixture-test invocation." This exact conversion was
attempt-verified 26/26 by the P2 audit (`ops/reports/P2-audits/p2-d5d8.md`
D8 #8-11) — the fix the recorded reason implies is impossible (a working
dual) isn't what's needed; collapsing the trailing `file`/`owner` pair into
one strict-object-like param resolves both `missing-dual` and
`third-param-not-object-like` at once.

| qualifiedName | file:line | disposition | reason / evidence |
|---|---|---|---|
| `fnSchemaEntryFromFunctionLike` | `SchemaFirst.ts:1504` (pre-fix) | **fixed** (exception does not hold) | `dual(2, (node, {file, owner}: SchemaFirstDetectorLocation) => ...)`. |
| `nullReturnEntryFromFunctionLike` | `SchemaFirst.ts:1555` (pre-fix) | **fixed** | Same fix, same shared type. |
| `normalizationEntryFromCallExpression` | `SchemaFirst.ts:1612` (pre-fix) | **fixed** | Same fix. |
| `getsomesStructEntryFromCallExpression` | `SchemaFirst.ts:1668` (pre-fix) | **fixed** | Same fix. |

Introduced one shared, non-exported named type `SchemaFirstDetectorLocation
= { readonly file: string; readonly owner: string }` (matching this file's
own precedent of documenting non-exported detector-input types with full
`@category`/`@since` JSDoc, e.g. `DetectInterfaceReasonInput`/
`DetectTypeAliasReasonInput`), placed as a **named TypeReference** rather
than an inline object literal per this initiative's SFV4-fn-schema-advisory
precedent, and inserted *above* the JSDoc block it precedes (not between an
existing doc comment and its export) to avoid the orphaned-doc bug recorded
in `ops/reports/P25-detectors/p25-detectors.md` "Follow-up 3." Updated each
function's `@param` docs from separate `file`/`owner` params to the combined
`location` param; existing minimal `@example` blocks (`console.log(fnName)`)
were left as-is since they still compile unchanged (no call-site inside the
examples). Swept the 4 internal scan-loop call sites in
`scanSchemaFirstInventory` (`SchemaFirst.ts`, all within this package) and 9
test call sites in `test/schema-first.test.ts` (2 each for the 4 detectors +
1 in the "G4 foundation family-flip regression fixture" describe block) from
`fn(node, filePath, owner)` to `fn(node, { file: filePath, owner })`.

## Granted extension (`@beep/repo-ai-metrics`)

| qualifiedName | file:line | diagnostic | disposition | reason / evidence |
|---|---|---|---|---|
| `AgentEffectivenessPhoenixSyncInput.new` | `src/agent-effectiveness.ts:1232` (pre-fix) | third-param-not-object-like (already `dual(3,...)`; 3rd param `confirmToken?: string` not object-like) | **fixed** | Collapsed params 2-3 (`dryRun: boolean`, `confirmToken?: string`) into one named-type options object (`AgentEffectivenessPhoenixSyncNewOptions`), `dual(2, ...)`. This was deferred from DA-1's `da-1-batch` lane as `blocked: ripple` (`ops/reports/DA-1/da-1-batch.md` §5) because both real call sites live in `@beep/repo-cli`, not this package — this lane owns both packages, so updated both call sites in `packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.command.ts:505-506` from `.new(!write)` / `.new(!write, confirmToken)` to `.new({ dryRun: !write })` / `.new({ confirmToken, dryRun: !write })`. No test call sites use `.new(` (test suite uses `.make(...)` directly throughout). |

## Files touched

- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalScorer.ts`
- `packages/tooling/tool/cli/test/agent-effectiveness-eval-scorer.test.ts`
- `packages/tooling/tool/cli/src/commands/Research/internal/Catalog.ts`
- `packages/tooling/tool/cli/src/commands/Research/internal/RepoCards.ts`
- `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts`
- `packages/tooling/tool/cli/src/commands/Research/Research.service.ts`
- `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`
- `packages/tooling/tool/cli/test/schema-first.test.ts`
- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.command.ts`
- `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts`
- `packages/tooling/tool/cli/src/commands/Laws/DualArity.ts` (scope addition)
- `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts` (scope addition)
- `packages/tooling/tool/cli/src/internal/cli/RepoFile.ts` (new, scope addition)
- `packages/tooling/tool/cli/src/internal/cli/DateStamp.ts` (new, scope addition)

## Commands run + outcomes

- `npx tsgo -b tsconfig.json` in `packages/tooling/tool/cli` — 0 errors in
  every file this lane touched. The only diagnostics printed came from
  `packages/tooling/library/repo-utils/src/__probe1.ts`, a staged-but-
  uncommitted scratch file outside this lane's fence (not owned by
  `@beep/repo-cli` or `@beep/repo-ai-metrics`, evidently concurrent
  in-flight work from another lane) — confirmed by filtering the output to
  paths under this lane's fence, which is empty.
- `npx tsgo -b tsconfig.json` in `packages/tooling/library/ai-metrics` — 0
  errors, clean.
- `npx vitest run test/schema-first.test.ts test/agent-effectiveness-eval-scorer.test.ts`
  in `packages/tooling/tool/cli` — 47/47 pass (2 files).
- `npx vitest run` (full suite) in `packages/tooling/tool/cli` — 591/591
  pass (41 files), re-run after the scope-addition fixes below — still
  591/591.
- `npx vitest run test/agent-effectiveness.test.ts` in
  `packages/tooling/library/ai-metrics` — 14/14 pass.
- `turbo run docgen --filter=@beep/repo-cli --filter=@beep/repo-ai-metrics` —
  26/26 tasks successful; `@beep/repo-cli` 546 examples found and
  typechecked, `@beep/repo-ai-metrics` 255 examples found and typechecked,
  both "✓ Docs generation succeeded!". Re-ran `turbo run docgen
  --filter=@beep/repo-cli` after the scope-addition fixes: still 546
  examples, still green.

## Scope addition: fallow hosted-CI round-1 blockers

Driver flagged 3 introduced Fallow-audit findings in `@beep/repo-cli` after
the dual-arity work above landed (`bun run beep quality fallow audit --check
--base origin/main`). All three are fixed; the audit now exits 0 with 0
introduced findings (38 pre-existing `inherited-adjacent` findings remain,
all non-blocking, all out of scope).

| Finding | Disposition | Evidence |
|---|---|---|
| COMPLEXITY (critical): `collectCandidateDiagnostics`, `DualArity.ts:843` (cyclomatic 23 / cognitive 24) | **fixed** | Decomposed into `computeDualValidity` (dual-arity/hasMatchingDualArity/hasValidDualWithCallableThirdParameter computation) plus four single-purpose diagnostic-family helpers (`arityRangeDiagnostics`, `tooManyParamsDiagnostics`, `thirdParameterDiagnostics`, `wrongFirstParameterDiagnostics`), each returning its own diagnostic slice; `collectCandidateDiagnostics` now just calls the helper, spreads, and dedupes. Verified the produced diagnostics array has byte-identical ordering to the original for every parameterCount branch (2-3 range, >3 range, and the always-checked third-param/wrong-first-param checks) before editing — the branches are mutually exclusive by `parameterCount`, so reordering the helper calls does not change output order. `test/dual-arity.test.ts` (33/33 within the 5-file run below) stayed green with no test changes needed. |
| DUPLICATION (34 lines x2): `DualArity.ts:1277` vs `SchemaFirst.ts:531` | **fixed** | The matched block was the `readInventoryDocument`-shaped JSONC-inventory reader (`fs.exists` check + `path.resolve` + `readFileString`) duplicated between the two files. Extracted a new shared module `src/internal/cli/RepoFile.ts` exporting `readExistingRepoFile(relativePath)` (resolves against cwd, existence-checks via `Effect.orElseSucceed` matching the repo's existing `pathExists`-style convention in `Architecture/OperationPlanExecution.ts`, then reads the file), used by `DualArity.ts`'s `readInventoryDocument` and both of `SchemaFirst.ts`'s `readInventoryDocument`/`readCrispeningPolicyDocument`. Each file keeps its own decode/parse-error-handling tail (`DualArity.ts` surfaces JSONC parse errors as a typed `DualArityInventoryReadError`; `SchemaFirst.ts` uses `Effect.option`) — only the genuinely-identical resolve+read glue was extracted, not the differing error-handling behavior. |
| (follow-on, same clone group) `todayYmd` byte-identical 7-line helper in both files | **fixed** | Extracting the block above shifted lines and caused the fallow re-scan to flip the (pre-existing, previously `inherited-adjacent`) `todayYmd` duplicate to `introduced` purely because the diff touched adjacent lines. Since `todayYmd` genuinely was byte-identical in both files (confirmed via `rg`), extracted it to a new shared module `src/internal/cli/DateStamp.ts`; both files now import it and their local copies (plus the now-unused `DateTime` import) were removed. |
| (follow-on, same clone group) new 12-line duplicate in the `readExistingRepoFile(...)` call-site glue | **fixed** | The first `RepoFile.ts` extraction left an `if (O.isNone(absolutePath)) { return O.none<X>(); } const fs = yield* FileSystem.FileSystem; const content = yield* fs.readFileString(absolutePath.value)` idiom duplicated at both call sites — a smaller duplicate created by the first fix. Extended `readExistingRepoFile` one level further to also perform the `fs.readFileString` call and return `O.Option<string>` directly (folding the private `resolveExistingRepoPath` helper inside `RepoFile.ts`, no longer exported since nothing outside the module calls it anymore); both files' `readInventoryDocument`/`readCrispeningPolicyDocument` now just call `readExistingRepoFile(PATH)` and branch on the result. Re-ran the fallow audit after each step to confirm no new duplicate was introduced; final run is 0 introduced findings, exit code 0. |
| DUPLICATION (5 lines x2): `JSDocDocumentationInventory.ts:539` vs `:593` | **fixed** | `analyzeExportDeclaration` and `analyzeDirectExport` both independently computed `filePath`/`repoPath`/`line` from `(declaration, sourceFile, packagePath, repoRoot, path)`. Extracted a local (file-private, not exported) helper `declarationLocationOf` returning `{ filePath, repoPath, line }`; both call sites now destructure its result. The differing `malformedConditionalTags(commentText)` vs `malformedConditionalTags(docText)` line was left as-is (different variable, correctly not part of the shared block). |

Verify (scope addition): `npx tsgo -b tsconfig.json` clean (0 errors in
touched files); `npx vitest run test/dual-arity.test.ts test/schema-first.test.ts
test/jsdoc-categories.test.ts test/jsdoc-inventory-detector-fixes.test.ts
test/agent-effectiveness-eval-scorer.test.ts` — 73/73 pass; full `npx vitest
run` re-run — 591/591 pass, no regressions; `turbo run docgen
--filter=@beep/repo-cli` re-run clean; `bun run beep quality fallow audit
--check --base origin/main --out .beep/fallow/audit.json --quiet` — exit
code 0, `findingAttributionSummary.introduced: 0` (down from 3), 38
`inherited-adjacent` (non-blocking, pre-existing, out of scope) findings
remain.

One incidental behavior note: `readExistingRepoFile`'s existence check now
swallows a `PlatformError` from `fs.exists` via `Effect.orElseSucceed`
(treating a failed existence check as "file does not exist") rather than
letting it propagate, matching the repo's existing `pathExists` convention
in `Architecture/OperationPlanExecution.ts`. This is a narrow behavior
change from the original inline code (which let any `fs.exists` failure
propagate) but is consistent with established repo convention for
existence-check helpers; flagging for driver awareness rather than treating
it as a silent behavior preservation.

A transient blocker during this scope addition: the first two `fallow audit`
attempts failed with a Bun `ReferenceError` inside
`packages/tooling/library/repo-utils/src/schemas/TSConfig.ts` (outside this
lane's fence, a dirty/uncommitted file from concurrent lane activity) —
resolved on retry once that file's mid-edit state settled; not caused by
and not fixed by this lane.

No dtslint fixtures reference any touched symbol (`@beep/repo-cli`'s only
`dtslint/Files.tst.ts` doesn't touch these files; `@beep/repo-ai-metrics` has
no `dtslint/` directory). `test/dual-arity.test.ts` doesn't reference any of
these symbols, so it was not touched and stays green as part of the full
suite run above.

## Scope addition 2: R14 categorical-generic exclusion + R15 detector-gap fixes

Locked rulings `research/decisions.md` R14/R15, evidence in
`ops/reports/SF-1/sf-1-graphnode.md` and `ops/reports/SF-1/sf-1-schema.md`.
All implemented in `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`
+ `test/schema-first.test.ts`.

### R14 item 4 — curated in-code exclusion list

Added `PERMANENT_SCHEMA_FIRST_EXCLUSIONS` (mirrors `DualArity.ts`'s
`PERMANENT_EXCLUSIONS`: `file`/`symbol`/`reason` entries) + a shared
`isPermanentlyExcludedSchemaFirstEntry(file, symbol)` predicate, wired at 4
injection points since curated entries span every entry-creation code path in
this file, not just interfaces: the top of `detectInterfaceReason` (covers
interface-kind entries), the top of `detectTypeAliasReason` (covers
type-alias-kind entries), the `S.Struct` call-expression loop right before
`pushEntry` (covers `object-struct-schema`-kind entries like `union`/
`extract`), and inside `arbitraryTestsEntryFromSourceFile`'s existing
early-return guard (covers the `schema-policy-advisory`/`SFV4-arbitrary-tests`
entries). Registered the exact 11 `@beep/nlp-processing`/`@beep/nlp`
categorical-generic symbols from the pilot's per-entry table (`GraphNode`,
`EffectGraph`, `Composable`, `ForgetfulOperation`, `TextOperation`,
`GraphOperation`, `OperationResult`, `StoredResult`, `Monoid`, `SearchIndex`,
`OperationDefinition` — exact file paths from `sf-1-graphnode.md`, not the
approximate name list in the driver's message, which used `Foldable`/
`Functor` where the report actually has `ForgetfulOperation`/`SearchIndex`),
plus `GraphOperation`/`OperationDefinition` reasons cite the deferred
descriptor/behavior-split follow-up packet per the ruling. Also carries R15's
curated additions (below).

Fixture pair (`describe("R14: categorical-generic family curated exclusion")`):
a `GraphNode<A> { value: A }`-shaped interface at the exact curated file path
→ silent; the identical shape at an unregistered path (`Box<A> { value: A }`,
already the existing R6-1 fixture) → still `exception`.

### R14 item 5 — factory-derived generic alias rule

Added `isSchemaDerivedGenericAliasTypeNode` (structural check: type node is a
`TypeReference` whose qualified name matches `/\b(?:S|Schema)\.Schema\.Type\b/`)
wired into `detectTypeAliasReason`'s generic branch. Textual/structural only —
does not verify the referenced factory's own body pipes to `S.Struct`/
`S.Class` (the pilot's fuller recommendation); the driver's simplified ruling
text ("generic type-alias whose type node is an `S.Schema.Type<...>`
TypeReference is schema-DERIVED") only requires the shape check.

Fixture pair (`describe("R14: factory-derived generic type alias silent
skip")`): `type Foo<K> = S.Schema.Type<ReturnType<typeof FooSchema<K>>>` →
silent; `type Box<A> = { value: A }` (no factory indirection) → still
`exception`. Confirmed against the **real** `TypedText` in
`packages/foundation/modeling/nlp/src/Ontology/Kind.ts` via the read-only
scan below — it goes silent by this general rule, not by curated-list
membership, closing the pilot's documented gap.

### R15 items 1-3 — detector-implementation gaps

1. `SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN` (`SchemaFirst.ts:72-73`): added
   `S.Codec`, `S.Union`, `VariantSchema.Overridable` (distinct from
   `VariantSchema.Field`).
2. `isEmptyOrMetaOnlyOwnBody` now also runs in `detectInterfaceReason`'s
   GENERIC branch (previously wired only into the non-generic extends
   branch) — as an OR alongside `hasRebuildThisMember`, gated the same way
   by `extendsSchemaInfrastructureBase`.
3. Extends-clause target resolution now walks one level of local
   alias/interface indirection before the pattern test: factored the shared
   `resolveLocalTypeAliasTypeNode(declarations)` helper out of the existing
   `resolveOneLevelLocalTypeAlias` (R11-6) so the same "find a local
   type-alias declaration, return its type node" logic backs both the
   existing member-type-safety check and the new
   `resolveExtendsClauseTargetText` (used by `extendsSchemaInfrastructureBase`)
   — avoids duplicating the `O.findFirst`/`O.flatMap` chain a second time
   (the same shape as the duplication findings fixed in scope addition 1).

Fixture pairs: `describe("R15-1: ...")` (S.Codec silent + VariantSchema.Overridable
silent + unrelated-base still-exception), `describe("R15-2: ...")` (empty-body
generic-extends-S.decodeTo silent + same-base-with-added-member still
exception — corrected my own first-draft expectation here from `candidate` to
`exception`: the generic branch's only non-silent outcome is the tracked
exception, it never reaches member composition, unlike the non-generic
branch), `describe("R15-3: ...")` (local-alias-to-schema-infra silent +
local-alias-to-unrelated-base still exception).

### R15 item 4 — additional curated entries

Extended `PERMANENT_SCHEMA_FIRST_EXCLUSIONS` with the driver-validated
entries: `LiteralKit.schema.ts::union` and `VariantSchema.core.ts::extract`
(regressions reproduced by the lane, reasons cite the reproduced failures),
`VariantSchema.core.ts::Class/Field/Struct/Union` (foundational toolkit
self-definitions, positive controls), `EntitySchema.definition.ts::
AssignedEntityParts/ClassInput` + `EntitySchema.persist.ts::PersistOptions`
(S.Top-valued compile-time DSL plumbing), and the 6 `schema-policy-advisory`
test-file entries (`CurrencyCode.test.ts`, `TerritoryCode.test.ts`,
`Timezone.test.ts`, `Fn.test.ts`, `PromiseSchema.test.ts`,
`Transformations.test.ts`, all keyed on the fixed `symbol: "schema-codec-tests"`
the advisory entries always use). These "ride the R14 fixture" per the
driver's instruction — no separate fixture pair authored per curated entry,
since the mechanism itself (file+symbol match → silent) is already proven by
the R14 fixture pair above; only the entry data differs.

### Verify

- `npx tsgo -b tsconfig.json`: clean (0 errors in touched files) at every
  intermediate step and in the final state.
- `npx vitest run test/schema-first.test.ts test/dual-arity.test.ts`: 70/70
  pass (was 47 before this addition's tests; +7 in scope addition 1's
  duplication-fix pass, +16 new R14/R15 fixture-pair tests here... final
  count 54/54 in `schema-first.test.ts` alone, 70/70 combined with
  `dual-arity.test.ts`'s unchanged 16).
- Full `npx vitest run`: 602/602 pass (41 files) — re-ran after the
  `collectCandidateDiagnostics`-style decomposition below, still 602/602.
- `bun run beep quality fallow audit --check --base origin/main --out
  .beep/fallow/audit.json --quiet`: **one new blocker appeared mid-implementation**
  — adding the curated-exclusion check plus the new branches pushed
  `detectInterfaceReason` to cyclomatic 12 / cognitive 16 (exceeded
  "cognitive", introduced complexity finding). Fixed the same way as scope
  addition 1's `collectCandidateDiagnostics`: decomposed into
  `classifyGenericInterface` and `classifyExtendsInterface` per-branch
  helpers, leaving `detectInterfaceReason` itself as 3 thin top-level checks
  that delegate. Re-ran the audit after the decomposition: **exit code 0,
  `findingAttributionSummary.introduced: 0`** (38 pre-existing
  `inherited-adjacent` findings remain, all non-blocking, all out of scope).
- Read-only `bun run beep lint schema-first` (no `--write`, exit code 1 is
  expected/normal for this command when any drift exists — it's a report,
  not a gate): confirms **40 schema-first inventory entries newly silenced**
  directly attributable to this addition's detector changes: the 11 R14
  curated `nlp-processing`/`nlp` entries, `TypedText` (R14 item 5's general
  rule, not curated-list membership — the pilot's documented gap, now
  closed), 4 from R15 item 1 (`Fn.schema.ts` ×2, `Graph.encoded.ts` ×2), 7
  from R15 item 2 (`Model.codecs.ts`/`Model.fields.ts` ×5/`Model.uuid.ts`),
  1 `Model.variants.ts::Overridable` (R15 items 1+2+4 combined), 1
  `VariantSchema.overridable.ts::Overridable` (R15 item 3), and 9 R15 item 4
  curated entries (`VariantSchema.core.ts` ×5, `LiteralKit.schema.ts::union`,
  `EntitySchema.*` ×3) plus the 6 test-file advisories. The same scan also
  surfaces ~30 unrelated "stale" entries in files this lane never touched
  (`packages/drivers/nlp-mcp/src/StreamingTools.ts`,
  `packages/tooling/library/repo-utils/src/{TSMorph/TSMorph.model.ts,
  schemas/{DocgenConfig,PackageJson,TSConfig}.ts}`,
  `CauseTaggedError.errors.ts`, `Csp.schema.ts`) — confirmed via `git status`
  that every one of those files is separately modified (uncommitted) by
  concurrent lanes on this shared branch, not by this lane; they reflect
  those lanes' own landed code fixes not yet resynced into the committed
  `standards/schema-first.inventory.jsonc` baseline via `--write` (which
  this lane was explicitly told not to run). No new `candidate`/`advisory`
  findings were introduced — the scan's "still contains candidate/advisory
  findings" sections list exactly the same 1 pre-existing candidate
  (`DocgenConfig.ts::CanonicalDocgenConfigJson`) and 1 pre-existing advisory
  (`Research.service.ts`'s `selected.toLowerCase`, already tracked before
  this lane's dual-arity edits to that file) as before — no regression.

Files touched (in addition to scope addition 1's list):
`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`,
`packages/tooling/tool/cli/test/schema-first.test.ts`. No commit, no
inventory `--write`, no `standards/*.jsonc` edit.

## Scope addition 3: R15 addendum — 3 more curated entries

Driver-accepted addendum (`research/decisions.md` "R15 addendum", evidence
`ops/reports/SF-1/sf-1-repoutils.md`). Extended
`PERMANENT_SCHEMA_FIRST_EXCLUSIONS` with the 3 residue entries from the
`sf1-repoutils` lane, all in `packages/tooling/library/repo-utils/src/schemas/TSConfig.ts`:
`makeTypeStruct`, `makeEncodedStruct` (both top-level generic factories,
confirmed via `rg`), and `strict` (the local `const strict = S.Struct(fields);`
inside `makeLooseJsonObject`, confirmed via `rg`). Reasons cite the lane's two
independently-reproduced TS-level blockers (generic-`Fields`-param "Missing
Self generic" / TS2509, and `Class.ast: Declaration` vs.
`StructWithRest.Objects` incompatibility) and the deferred
`makeLooseJsonObject` redesign. Rode the existing R14 fixture per the
established pattern — no new fixture pair needed, the curated-list mechanism
itself is already proven.

Verify: `npx tsgo -b tsconfig.json` clean; `npx vitest run
test/schema-first.test.ts test/dual-arity.test.ts` — 70/70 pass (unchanged
count, no new tests added); full `npx vitest run` — 602/602, no regression;
`bun run beep quality fallow audit --check --base origin/main` — exit 0,
`introduced: 0`; read-only `bun run beep lint schema-first` confirms all 3
new symbols (`makeTypeStruct`, `makeEncodedStruct`, `strict`) now show as
"stale" (silenced from the live scan) at the exact curated file path. No
commit, no inventory `--write`, no `standards/*.jsonc` edit.

## Scope addition 4: regen-surfaced round-2 fixes

Driver regen surfaced two latent findings, both fixed.

1. **`Str.toLowerCase` normalization fix**
   (`src/commands/Research/Research.service.ts:508`,
   `collectCloneCards`'s `--only` filter): replaced
   `path.basename(dir).toLowerCase()` with `Str.toLowerCase(path.basename(dir))`
   (`Str` already imported, same file already uses `Str.includes` on this
   line) and applied `Str.toLowerCase` to `options.only ?? ""` too, so the
   case-insensitive filter is symmetric on both sides — previously an
   uppercase `--only` value would never match any lowercased basename.
   Confirmed via `rg` that no existing test covers this filter, so per the
   driver's instruction no test was added/adjusted (behavior-preserving for
   the existing case where `options.only` is already lowercase; a genuine
   bug fix for the mixed-case case).
2. **Orphaned JSDoc on `detectInterfaceReason`**: the earlier
   `collectCandidateDiagnostics`-style decomposition (scope addition 2)
   inserted `classifyGenericInterface`/`classifyExtendsInterface` directly
   between `detectInterfaceReason`'s JSDoc block and its `export const` —
   the same orphaning failure mode as the P25-detectors "Follow-up 3"
   precedent (`ops/reports/P25-detectors/p25-detectors.md`). Fixed by
   relocating both helpers to sit *before* the `DetectInterfaceReasonInput`
   JSDoc block (as private pre-declared helpers used by the exported
   classifier below, matching this file's established convention — e.g.
   `extendsSchemaInfrastructureBase`/`isSilentMemberShape` are also
   predeclared this way), restoring `detectInterfaceReason`'s JSDoc to
   sit immediately above its own `export const`. Checked
   `detectTypeAliasReason` and `isSchemaDerivedGenericAliasTypeNode` (added
   in scope addition 2) for the same failure: both were already correctly
   placed (`isSchemaDerivedGenericAliasTypeNode` is a private, non-exported
   helper sitting between two unrelated doc blocks, not orphaning either
   one). No JSDoc added to `classifyGenericInterface`/`classifyExtendsInterface`
   themselves — both are private (non-exported) helpers, which per the
   driver's instruction don't need full tags, consistent with every other
   private helper in this file.

Verify: `npx tsgo -b tsconfig.json` clean; `npx vitest run
test/schema-first.test.ts` — 54/54 pass (unchanged count, no test changes
needed for either fix); `turbo run docgen --filter=@beep/repo-cli` —
546 examples found and typechecked clean (same count as scope addition 2,
confirming `detectInterfaceReason`'s `@example` block compiles again and no
new public doc-requiring symbol was added); read-only `bun run beep lint
schema-first` — `sfv4_normalization_advisories=0` repo-wide (confirms the
`Research.service.ts` fix landed; it was the only such advisory and now
shows as "stale" instead of live). No commit, no inventory `--write`, no
`standards/*.jsonc` edit.
