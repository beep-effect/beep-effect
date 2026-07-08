# FINAL-A — repo-cli detectors + jsdoc + curation

Lane: FINAL-A (repo-cli detector fixes, R22 curated schema-first exclusions,
`@beep/repo-cli`'s own 58 jsdoc findings). Branch `standards-remediation`.
Single writer for `packages/tooling/tool/cli`. No commits made by this lane
directly (see "Note on shared-branch auto-checkpoints" below); never edited
`standards/*.jsonc`.

## Work Set 1 — R20 detector fixes (`JSDocDocumentationInventory.ts` +
`QualityArtifactSupport.ts`)

**1a. Default-export call-expression doc attribution (R20).** Confirmed via a
ts-morph probe that `export default rule(...)` resolves `getExportedDeclarations()`
to the inner `CallExpression`, which is never JSDocable; the JSDoc lives on the
enclosing `ExportAssignment`. Fixed in the shared `getDocNode` helper
(`QualityArtifactSupport.ts`): when a node's parent is an `ExportAssignment`,
redirect to the parent before reading JSDoc. Verified the fix does not affect
`export default class Foo {}` (declaration form; parent is `SourceFile`, not
`ExportAssignment` — untouched).

**1b. String-literal stripping before unsafe-example regex scans (R20, R21).**
Added `stripStringLiterals` (strips single/double-quoted string bodies) applied
after the existing `stripImportStatements` in `unsafeExampleViolations`. Fixes
both documented false-positive classes: a string containing `"declare ..."`
prose and a string containing `"... as Effect ..."` (matches the assertion
regex's `[A-Z_$({[]` alternative on any capitalized word after `as`).

**Fixture pairs** (`test/jsdoc-inventory-detector-fixes.test.ts`, 3 new `it`
blocks, +7 pre-existing = 10/10 passing): default-export attribution
(documented → resolved, undocumented sibling → open); string-literal
stripping (prose-only string → resolved, real `declare`/`any`/`as Effect`
outside strings → 3 violations). Verified both fixes are load-bearing by
reverting them and re-running: R19 (3), R20a, R20b/R21 fixtures failed as
expected (5/10 failed), confirming the fixtures are not vacuous.

## Work Set 2 — R9 namespaced-barrel scan closure

**Finding: the described gap does not reproduce in the current code.**
Investigated in three independent ways before touching anything:

1. A ts-morph probe replicating `exportedDeclarationsFor`'s exact mechanism
   showed a namespaced target's own file gets scanned identically to a flat
   target's, because `listSourceFiles` walks every `.ts` file independently of
   any barrel's export graph — barrel style is irrelevant to whether a target
   file's own declarations get analyzed.
2. A live fixture reproduction through the real `writeJSDocDocumentationInventory`
   function (not synthetic AST-only): `index.ts` with `export * as Ns from
   "./mod.ts"`, `mod.ts` with an undocumented `export const` — the undocumented
   export is correctly flagged `"open"` with all missing tags, on the
   **unmodified** current code.
3. A full-repo cross-reference script: every `export * as X from "./y"` in the
   repo, resolved through `.js`→`.ts` extension rewriting and directory-index
   resolution, checked against the real `standards/jsdoc-documentation.inventory.jsonc`
   `modules` array. Zero unexplained gaps — every apparent miss was either an
   intentional `docgen.json` `internal/**` exclude, or a file with a literal
   `export {}` (no declarations to find).

The original P2-audit hypothesis (`p2-j5-html.md`) appears to have been an
unverified guess later cited without re-derivation; the mechanism it describes
does not hold up. Per D-C (verdict-challenge), added the regression fixture
anyway (`export * as Ns from "./mod"` undocumented target → open; flat-barrel
sibling → open; barrel line itself → resolved) as a permanent guard against a
future regression, since the fixture is valuable independent of whether a code
change was needed. **No production code change made for R9.** Recommend the
driver drop the "+~192 findings" expectation for this item when reconciling
R22/regen — closing R9 as verified-non-issue rather than closed-by-fix.

## Work Set 3 — R22 curated `PERMANENT_SCHEMA_FIRST_EXCLUSIONS` (`SchemaFirst.ts`)

All 13 symbols probe-verified against current source before adding (file/line
read directly, not taken on faith from the inventory reason text):
`WinkEngineRuntimeState`, `Step`, `Tour`, `OfficeActionReviewDeps`,
`MemberAccess`, `HubSpotErrorOptions.email`, `oipTwitterHandle`,
`schema-codec-tests` (law-practice/server fixture.ts), `PeerDependencyMetaEntry`,
`PublishConfigBase`, `LocalDateFields`, `HtmlElementMeta`,
`GlobalAttributesStruct`.

Found each entry already had a human-authored `"status": "exception"` record
with a reason in the standing `standards/schema-first.inventory.jsonc` ledger
(driver/earlier-lane authored) — promoting to `PERMANENT_SCHEMA_FIRST_EXCLUSIONS`
upgrades these from "re-declared every regen via the tracked ledger" to
"detector never emits the finding at all," matching the R14/R15 mechanism's
own stated purpose and making `entries: []` regen-invariant for these 13.

Two of the 13 (`HubSpotErrorOptions.email` via `SFV4-precision-audit`,
`oipTwitterHandle` via `SFV4-null-return`) required wiring: their emission call
sites (`precisionAuditEntryFromProperty` push, `nullReturnEntryFromFunctionLike`
push) did not consult `isPermanentlyExcludedSchemaFirstEntry` at all (unlike
the object-struct-schema loop, `detectInterfaceReason`/`detectTypeAliasReason`,
and the fn-schema loop, which already did). Added the same
`!isPermanentlyExcludedSchemaFirstEntry(...)` guard mirroring the existing
fn-schema-loop pattern exactly — the other 11 symbols' call sites were already
wired. `LocalDateFields`'s reason notes that the existing
"feeds-an-S.Class-constructor" `detectStructReason` branch
(`isStructFieldsInputForSchemaClass`) never runs for it: its first argument
(`CalendarParts.fields`, a property-access reference) fails the earlier
"is this a plain object literal" check, so the generic first branch fires
with a less-precise reason instead — noted in the added entry per the R22
instruction.

**Verification**: read-only `bun run beep lint schema-first` shows
`enforced_candidates=0` (the blocking gate) and exactly 19 stale-tracked-entry
lines — my 13 curated symbols plus 6 entries from FINAL-B's in-flight
conversions (`Agent.model.ts anonymous@65`, `AssistantContent.model.ts
anonymous@316`, `file-processing/Extraction/index.ts anonymous@111`,
`identity/Id.ts anonymous@117` + `anonymous@148`, `identity/Vocab.ts
anonymous@57`) — matching the expected shape exactly.

**Mid-session addition (driver-directed, from FINAL-B's verified analysis):**
`packages/drivers/box/src/Box.config.ts :: BoxCcgConfigShape` added as a 14th
entry. Read-only-verified against live source (never edited the file, per the
driver's collision-warning directive): `BoxCcgConfigShape = S.Struct({...}).check(...)`
feeds directly into `BoxCcgConfig`'s `S.Class(...)` fields argument — same
feeds-an-S.Class-constructor bucket as `LocalDateFields`, but here the
argument to `S.Struct(...)` *is* an inline object literal (unlike
`LocalDateFields`'s property-access reference), so `detectStructReason`
already resolves it correctly via the existing `isStructFieldsInputForSchemaClass`
branch — this addition is a ledger→permanent promotion, not a detector-gap
fix. Re-verified `tsgo -b`, `biome check`, and `test/schema-first.test.ts`
(56/56) clean after the addition.

## Work Set 4 — `@beep/repo-cli`'s own 58 jsdoc findings

Live re-audited against the committed inventory (54 open exports = 49 missing
`@example` + 3 unsafe + 6 schemaAnnotation, no R19/R20 phantoms found — all 54
were real). Fixed all 54, file by file:

| File | Findings | Disposition |
|---|---:|---|
| `Architecture/OperationPlan.ts` | 6 | 4 LiteralKit type-alias examples; `ArchitectureOperation` const missing `$I.annoteSchema` + its type alias missing example |
| `Architecture/OperationPlanPackageJson.ts` | 1 | `renderPackageJsonOperation` (`@internal`) had no reachable public import path — added a barrel re-export line in `Architecture/index.ts` (matches sibling-file convention), then a real compiling example |
| `Corpus/Corpus.schemas.ts` | 4 | LiteralKit + tagged-union type-alias examples |
| `Corpus/Corpus.service.ts` | 1 | real unsafe-example fix: `{} as CorpusCommandServiceShape` → full 7-member object literal (`() => Effect.never` per member) |
| `Files/Files.schemas.ts` | 25 | LiteralKit/refined-schema type-alias examples (mechanical, one per symbol) |
| `Files/Files.service.ts` | 1 | real unsafe-example fix: `{} as FilesCommandServiceShape` → full 9-member object literal |
| `Image/Image.schemas.ts` | 1 | tagged-union type-alias example reusing the const's own fixture |
| `Image/Image.service.ts` | 1 | real unsafe-example fix: `{} as ImageCommandServiceShape` → 2-member object literal |
| `Lint/SchemaCatalog.ts` | 1 | missing `SchemaCatalogEntryKind` runtime type alias (const had annotation already) |
| `Lint/SchemaFirst.ts` | 4 | 4 `@internal` LiteralKit consts (`SchemaFirstPolicyRuleId`, `SchemaFirstEntryKind`, `SchemaFirstEntryStatus`, `SchemaCrispeningFamily`) had neither example nor type alias, and none were barrel-exported — added both, plus 4 names to `Lint/index.ts`'s named export list |
| `Research/Research.service.ts` | 1 | missing example on an 8-member service shape — `() => Effect.never` per member |
| `Skills/Skills.command.ts` | 3 | `remoteSkillSources` (const), `renderCodexConfigWithSkills` (dual-arity fn), `runSkillsUpdate` (Effect.fn with FS/Path/Crypto/HttpClient requirements — example constructs the Effect value and asserts `Effect.isEffect`, does not run it) |
| `TsconfigSync/TsconfigSync.command.ts` | 5 | tagged-union/LiteralKit type-alias examples, 3 via `S.decodeUnknownSync` since the union's member classes are file-private |

**Self-caught bug**: first `turbo run docgen` pass failed —
`FilesCommandServiceShape`'s object literal was missing the 9th member
(`stripMetadataFiles`); I'd stopped reading the interface one member short.
Cross-checked all 4 service-shape interfaces' member counts via `grep -oP`
against my written examples before re-running; fixed and re-verified.

**Side effect on Work Set 4**: adding the two new type aliases in
`SchemaFirst.ts`/`SchemaCatalog.ts` surfaced 10 pre-existing
`effect(unnecessaryTypeofType)` `tsgo` errors elsewhere in those same files
(other call sites still wrote `typeof X.Type` where a plain `X` type alias now
resolves) — fixed all 10 (simple `typeof X.Type` → `X` simplifications).

## Verification (full, this lane's fence only)

- `npx tsgo -b` — clean, zero errors (after fixing the 10
  `unnecessaryTypeofType` errors surfaced by the new type aliases).
- `bunx biome check` on every touched file — clean (2 formatting nits
  auto-fixed and re-verified).
- `npx vitest run` (whole package) — **41 test files, 614 tests, all passing**.
- `TURBO_FORCE=1 bunx turbo run docgen --filter=@beep/repo-cli` — succeeded,
  591 examples found and typechecked, zero errors (after the
  `stripMetadataFiles` fix above).
- `bun run fallow:audit` — `dead_code_introduced: 0`, `complexity_introduced:
  0`, `duplication_introduced: 0`.
- Read-only `bun run beep lint schema-first` — `enforced_candidates=0`;
  19 stale-tracked entries exactly accounted for (13 mine + 6 FINAL-B's
  in-flight conversions per R22's CONVERT list).

## Note on shared-branch auto-checkpoints

This branch's working directory is shared with concurrently-running lanes.
Partway through this session, three automated `chore: saving...`/`chore:
sync...` commits appeared on the branch (`bd0e2f6964`, `b077a9a544`,
`5b984cc4765`) that swept up this lane's in-progress uncommitted edits
alongside other lanes' concurrent work (confirmed: `5b984cc4` mixes my
`Architecture/OperationPlan.ts`/`Corpus.service.ts`/`Image.service.ts` edits
with unrelated `Box.config.ts`/`Extraction/index.ts` changes belonging to
FINAL-B). This lane never ran `git add`/`git commit` itself; the checkpoints
are an environment/orchestration behavior outside this lane's control. All
edits described above were verified present and correct in the working tree
regardless of commit boundaries.

## Files touched (18)

`packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts`,
`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts`,
`packages/tooling/tool/cli/test/jsdoc-inventory-detector-fixes.test.ts`,
`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`,
`packages/tooling/tool/cli/src/commands/Lint/SchemaCatalog.ts`,
`packages/tooling/tool/cli/src/commands/Lint/index.ts`,
`packages/tooling/tool/cli/src/commands/Architecture/OperationPlan.ts`,
`packages/tooling/tool/cli/src/commands/Architecture/OperationPlanPackageJson.ts`,
`packages/tooling/tool/cli/src/commands/Architecture/index.ts`,
`packages/tooling/tool/cli/src/commands/Corpus/Corpus.schemas.ts`,
`packages/tooling/tool/cli/src/commands/Corpus/Corpus.service.ts`,
`packages/tooling/tool/cli/src/commands/Files/Files.schemas.ts`,
`packages/tooling/tool/cli/src/commands/Files/Files.service.ts`,
`packages/tooling/tool/cli/src/commands/Image/Image.schemas.ts`,
`packages/tooling/tool/cli/src/commands/Image/Image.service.ts`,
`packages/tooling/tool/cli/src/commands/Research/Research.service.ts`,
`packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts`,
`packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.command.ts`.
