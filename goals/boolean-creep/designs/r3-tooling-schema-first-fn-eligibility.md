# Design: r3-tooling-schema-first-fn-eligibility

Current P2 design at source `93217d998f851e2e93d9864e2b5315552eaa58a7`,
main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Actual owner `appendFunctionEntries`;
4 representable / 3 legal, Tier 1.
The source audit, bounded correction and native adjudication are bound by
`data/r28-cli-l-q-integration.json`. This design supplies no independent P3
approval; replacement review and merged packet ratification remain required.

## Current shape

At SchemaFirstScan239–242, inspectFnSchema is sourceHasFnSchemaSignal(sourceFile)
AND isFnSchemaEligibleFilePath(filePath); inspectNullReturn is
isNullReturnEligibleFilePath(filePath). Both are computed Boolean values in the
same appendFunctionEntries call. They are not the function-valued predicates
recorded as members, and no function flag parameters are admitted here.

SchemaFirstDetectors662/783 both reject exactly the `.tsx` suffix.
sourceHasFnSchemaSignal657–660 checks the full source text for schema-field or
Fn tokens using patterns27–28/39. Scan232–238 gathers effectively exported named
functions, variable arrow functions and default-export arrows; the latter logic
lives in Detectors627–644. For each candidate, Scan244–248 invokes the fn-schema
detector first when enabled and then the null-return detector when enabled.
Each produces Option<SchemaFirstInventoryEntry>; appendOptionEntry89–91 appends
Some's complete entry and preserves None as no finding.

TSX is not filtered before this helper. Lint.schemas53–54 includes both TS and
TSX; SchemaFirstProject57–62 passes those globs to ProjectFactory34–53, which
uses tsconfig only for compiler options. Scan315's generic/ecosystem exclusion
does not include ordinary `.tsx`. Existing public command tests503–559 and
1411–1446 prove that TSX enters the project and other scanners while function
checks are excluded.

## Cardinality gap

There are four Boolean pairs but only three legal function scan modes:

| inspectFnSchema | inspectNullReturn | Mode | Supported witness |
| --- | --- | --- | --- |
| false | false | skip | ordinary TSX, with or without source signal |
| false | true | null-return | ordinary TS with no schema/Fn source signal |
| true | true | fn-schema-and-null-return | ordinary TS with schema/Fn source signal |

True/false contradicts the identical path eligibility predicates. This is an
E4 implication, not a claim that two independent detectors always produce
findings together. A schema-signaled TS file can still produce zero findings,
only either rule, or both after AST checks. The mode models enabled work only.
Preserve both None and full Some finding alternatives and all source text.

The old three-member D1 seed was also incorrect: its two eligibility values
were equal, giving8/4. Current source combines signal/eligibility into one value,
so the stable ID now describes4/3. The original labels are historical metadata,
not a reason to create an overlapping ID or preserve the wrong D1 conclusion.

## Target schema

Use the existing schema-role file `commands/Lint/Lint.schemas.ts`, its `$I`
composer18 and existing LiteralKit import9. Introduce one named mode domain:

```ts
export const SchemaFirstFunctionScanMode = LiteralKit([
  "skip",
  "null-return",
  "fn-schema-and-null-return",
]).pipe(
  $I.annoteSchema("SchemaFirstFunctionScanMode", {
    description: "Function detectors enabled for one schema-first source file.",
  })
)
export type SchemaFirstFunctionScanMode = typeof SchemaFirstFunctionScanMode.Type
```

The source search found no existing mode owner for these three enabled-work
states. A LiteralKit is sufficient: there is no conditional payload, optional
state field, reason subtype, or runtime handle to wrap in a tagged union. The
source file, candidate nodes, owning package string and findings array remain
in their current roles and retain all of their data.

Import the mode into SchemaFirstScan and derive it directly at the former local
pair. Use one existing path predicate and one conditional source-signal read;
there is no derived Boolean alias or new conversion helper wall. One valid
Effect Match formulation is:

```ts
const mode = Match.value(filePath).pipe(
  Match.when(SchemaFirstDetectors.isNullReturnEligibleFilePath, () =>
    SchemaFirstDetectors.sourceHasFnSchemaSignal(sourceFile)
      ? SchemaFirstFunctionScanMode.Enum["fn-schema-and-null-return"]
      : SchemaFirstFunctionScanMode.Enum["null-return"]
  ),
  Match.orElse(SchemaFirstFunctionScanMode.thunk.skip)
)

if (SchemaFirstFunctionScanMode.is.skip(mode)) return
for (const functionLike of candidates) {
  if (SchemaFirstFunctionScanMode.is["fn-schema-and-null-return"](mode)) {
    appendOptionEntry(entries, SchemaFirstDetectors.fnSchemaEntryFromFunctionLike(functionLike, filePath, owner))
  }
  appendOptionEntry(entries, SchemaFirstDetectors.nullReturnEntryFromFunctionLike(functionLike, filePath, owner))
}
```

This calls the existing source signal only on eligible paths. That predicate is
pure getFullText plus local non-global regex tests at Detectors657–660, with no
producer mutation, IO, or diagnostic side effect. Skipping that read for TSX
therefore preserves supported behavior. Keep candidate discovery at its current
position before mode derivation; do not turn this into an unrelated traversal
optimization. The guard after mode derivation applies only within
appendFunctionEntries, not the whole source scan.

Use the kit's derived predicates/thunks and named enum values. Do not store
inspectFnSchema/inspectNullReturn getters, encode a Boolean pair in a struct,
add validation of a pair that no caller constructs, or introduce a second path
eligibility rule. Leave the existing detector predicates and their exported
module object unchanged in this bounded implementation; removing their former
call is not permission to redesign unrelated detector APIs.

## Migration inventory

- `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts:9,18,88`:
  add the annotated mode with its runtime type alias in the existing schema
  module, beside the schema-first domains. Follow exported JSDoc laws with
  a meaningful Enum example, category and since. No new role file/dependency.
- `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts:10,16–25,226–251`:
  add Match and the existing-module mode import; replace the pair/dispatch as
  above while retaining candidate enumeration and per-function append order.
- `SchemaFirstDetectors.ts:27–28,39,627–644,657–662,690–720,750–783`:
  preserve patterns, exported-candidate logic, generic skips, explicit-return
  checks and safe wrappers. No field/cardinality change inside finding schemas.
- `SchemaFirstScan.ts:311–323`: sole direct appendFunctionEntries call319
  remains between call and property scanners. Excluded files and other TSX
  detector families retain their current scheduling and findings.
- `SchemaFirstScan.ts:481–511`: exported runSchemaFirstLint calls the scan482,
  merges inventory, applies policy, writes only when options.write496–498,
  renders summaries/diagnostics and fails through the existing typed path507–508.
  Its input/output types and every option/default remain unchanged.
- `commands/Lint/SchemaFirst.ts:147,380–391`: reexport and CLI schema-first
  entry still construct the same SchemaFirstLintOptions with write=false default.
  `commands/Lint/Lint.command.ts:733,750–752` registers the same subcommand.
- `commands/Lint/index.ts:41–53,95–112` exports existing schemas and facade
  symbols explicitly; no new facade export is required. The new schema has a
  module export for its Scan import; the existing `./commands/*` package pattern
  at package.json66 can address the schema module. This additive TypeScript
  schema export creates no serialized mode field. Keep package export maps and
  the source-only test facade `src/test/Lint.test-kit.ts:8` unchanged.
- `packages/tooling/tool/cli/package.json:46,62,66,68,132,137`:
  commands/Lint facade remains public; internal scan/detector subpaths are
  blocked and test exports remain source-only. No internal helper export is
  needed to test the public scan operation.

Complete source symbol searches found one direct caller each for
appendFunctionEntries and scanSchemaFirstInventory; the runtime caller of
runSchemaFirstLint is the schema-first CLI handler. Public facade consumers
outside this repository remain supported through its unchanged signature.
SchemaCatalog's graph import edge is not a scan call and requires no migration.
The unrelated normalization/getSomes and tagged-union D1 pairs stay unchanged.

## Guard-deletion accounting

- Remove the two independently named Boolean values at Scan239–242 and the
  implication encoded through their repeated path eligibility checks.
- Remove the redundant isFnSchemaEligibleFilePath call241 from this scan;
  one identical eligibility predicate selects the mode. Do not claim deletion
  of both predicate functions or any exported detector API.
- Replace the per-candidate `if (inspectNullReturn)`247 with one skip-mode
  return before the loop. Once admitted to that loop, null-return inspection
  is structurally guaranteed; impossible fn-only dispatch cannot be selected.
- Replace `if (inspectFnSchema)`244 with the kit's combined-mode predicate.
  This legitimate dispatch remains one branch; it is not counted as a deleted
  detector, diagnostic or finding guard.
- Retain Option checks in appendOptionEntry, generic-function skips,
  inline-contract checks699–705, return-annotation/wrapper checks759–765,
  source exclusions315 and inventory failure enforcement507–508. None is a
  Boolean-creep workaround removed by this mode.

## Encoded-side impact

None to existing encoded shapes. The mode is a local derived value used only
while collecting findings. It is never added to SchemaFirstInventoryEntry,
SchemaFirstInventoryDocument, policy schemas, CLI options or summaries.
`standards/schema-first.inventory.jsonc` retains exact entry fields, rule IDs,
status literals, owners, source symbols/lines, reasons, scope and version. Both
rule finding payloads remain complete: None means no entry, and Some carries
the full SchemaFirstInventoryEntry. No Boolean presence surrogate replaces it.

Preserve sort/dedupe at Scan326–333, merge/policy/render/write flow481–511,
current --write defaults and diagnostic output. Future before/after fixture
comparison must hold the clock fixed for generatedOn, compare exact encoded
inventory and structured issue lines, and preserve exit behavior. No baseline
refresh, generated file rewrite or codec migration is part of this change.

## Test impact

Use the existing public command fixture at
`packages/tooling/tool/cli/test/lint-command.test.ts:72–97` rather than exporting
appendFunctionEntries or changing blocked internal package subpaths.

- Preserve existing TS/TSX gating fixtures503–559 and TSX data scanning1411–1446.
- Add the no-schema-signal TS null-return fixture from schema-first.test335–348
  through the public scan, proving null-return-only behavior, including the
  complete rule/owner/symbol/line/reason payload.
- Add the same nullable exported function in a schema-signaled TS file with an
  inline input contract; both fn-schema and null-return advisories must survive,
  ordered as before per candidate and then sorted/deduped by the existing scan.
- Add TSX counterparts with/without schema signals: both function rule families
  skip, while an accompanying non-render pure-data declaration remains visible.
- Keep exported named/default/variable arrows, local export aliases, generic
  functions, inferred returns, and Effect/O.Option/Result/Exit return wrappers
  covered. Existing schema-first.test271–298 and335–385 prove these detector
  semantics; this migration must not change them.
- Compare exact old/new generated inventory and structured diagnostics under a
  fixed clock, for write=false and write=true fixture modes. Do not rewrite a
  real repository baseline just to obtain test parity.

At implementation, run the focused lint-command/schema-first tests and
`bun run beep quality package-verify @beep/repo-cli`; package verification is
required before implementation handoff. This provisional P2 task runs no
package command or test, and adds no gesture-bearing UI/browser requirement.

## Risk

The material risk is treating `.tsx` as excluded from the entire project and
thereby dropping unrelated data/interface findings. Keep skip local to function
inspection. Also preserve source-signal classification, nullable-wrapper
exceptions, per-candidate detector order, and full findings/defaults rather than
mistaking an enabled detector for a guaranteed finding.

The old independent-gates rationale is disproven. The successful bounded L–Q correction independently confirms this 4/3 owner; native P2 supplies the full migration design. Independent P3 review and packet ratification remain pending. Implement within Tier 1E.


## R39 source and test reconciliation (authoritative current map)

Bound to HEAD `220d9426dad4b708807b6297cb71d75449288749`. This appendix supersedes older numeric
locations for the files listed here; it preserves earlier design semantics and
immutable historical evidence. It grants no blanket P3, implementation or dry credit.

Only earlier const-assertion iteration changed; appendFunctionEntries body is unchanged and moves one line. Current declaration225, selected locals238-241, reads243/246. Retain source-signal gating plus local TSX exclusion, full finding payloads and detector order.

### Current named test locations

- `packages/tooling/tool/cli/test/schema-first.test.ts:43` — applies decoding defaults for FileGenerationPlanInput.symlinks
- `packages/tooling/tool/cli/test/schema-first.test.ts:58` — uses tagged-union helpers for GenerationAction
- `packages/tooling/tool/cli/test/schema-first.test.ts:74` — creates deterministic plans via schema-backed input
- `packages/tooling/tool/cli/test/schema-first.test.ts:105` — exposes toTaggedUnion helpers for VersionSyncOptions
- `packages/tooling/tool/cli/test/schema-first.test.ts:124` — excludes generated docs examples from source-law scans
- `packages/tooling/tool/cli/test/schema-first.test.ts:132` — recognizes repo-owned schema arbitrary helpers as schema-derived property coverage
- `packages/tooling/tool/cli/test/schema-first.test.ts:182` — resolves schema-crispening wave families by path prefix
- `packages/tooling/tool/cli/test/schema-first.test.ts:210` — exempts nothing when the policy document is absent (fail-safe)
- `packages/tooling/tool/cli/test/schema-first.test.ts:214` — does not exempt an entry whose ruleId is not a policy-tracked card
- `packages/tooling/tool/cli/test/schema-first.test.ts:226` — exempts a tracked card whose resolved family is non-blocking
- `packages/tooling/tool/cli/test/schema-first.test.ts:238` — does not exempt a tracked card whose resolved family is blocking
- `packages/tooling/tool/cli/test/schema-first.test.ts:250` — lets a blocking owner override win over a non-blocking family
- `packages/tooling/tool/cli/test/schema-first.test.ts:262` — treats an unassigned family (e.g. packages/shared) as non-blocking, hence exempt
- `packages/tooling/tool/cli/test/schema-first.test.ts:281` — fires for an exported function with an inline object parameter contract
- `packages/tooling/tool/cli/test/schema-first.test.ts:296` — does not fire for a generic exported function
- `packages/tooling/tool/cli/test/schema-first.test.ts:310` — fires for a trim() call beside a schema decode in the same exported function
- `packages/tooling/tool/cli/test/schema-first.test.ts:335` — does not fire for a module-top-level trim() call
- `packages/tooling/tool/cli/test/schema-first.test.ts:346` — fires for an exported function with an explicit null return annotation
- `packages/tooling/tool/cli/test/schema-first.test.ts:360` — does not fire for a function without an explicit return annotation
- `packages/tooling/tool/cli/test/schema-first.test.ts:375` — does not fire when nullish values are carried inside an approved return wrapper
- `packages/tooling/tool/cli/test/schema-first.test.ts:398` — fires for R.getSomes over an inline Option-struct literal
- `packages/tooling/tool/cli/test/schema-first.test.ts:412` — does not fire for R.getSomes over an identifier dictionary argument
- `packages/tooling/tool/cli/test/schema-first.test.ts:458` — resolves the fixture paths to the flipped and still-exempt families
- `packages/tooling/tool/cli/test/schema-first.test.ts:465` — counts the foundation violation and exempts the drivers violation (flipped policy)
- `packages/tooling/tool/cli/test/schema-first.test.ts:491` — keeps the same ratchet result against the real committed policy document
- `packages/tooling/tool/cli/test/lint-command.test.ts:145` — reports runtime and schema metadata violations through the pure test seam
- `packages/tooling/tool/cli/test/lint-command.test.ts:240` — constructs unique content-cache shard commands at concurrency four
- `packages/tooling/tool/cli/test/lint-command.test.ts:246` — fails the aggregate when any shard exits nonzero
- `packages/tooling/tool/cli/test/lint-command.test.ts:252` — skips the labs shard when the labs root is absent
- `packages/tooling/tool/cli/test/lint-command.test.ts:258` — passes --no-error-on-unmatched-pattern to the labs shard only
- `packages/tooling/tool/cli/test/lint-command.test.ts:302` — reports redundant LiteralKit const assertions
- `packages/tooling/tool/cli/test/lint-command.test.ts:331` — accepts direct LiteralKit inline arrays without const assertions
- `packages/tooling/tool/cli/test/lint-command.test.ts:347` — reports untracked SFV4 numeric-domain advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:380` — reports untracked SFV4 static-api discriminator switch advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:418` — reports untracked SFV4 precision-audit broad email advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:449` — accepts precise email schemas without precision-audit advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:467` — reports untracked SFV4 fn-schema advisories for a .ts function (R17-2 still-fires case)
- `packages/tooling/tool/cli/test/lint-command.test.ts:499` — does not report SFV4 fn-schema advisories for a .tsx component (R17-2 newly-excluded case)
- `packages/tooling/tool/cli/test/lint-command.test.ts:517` — excludes inventoried precision-audit exceptions from active advisory counts
- `packages/tooling/tool/cli/test/lint-command.test.ts:543` — blocks tracked active schema-first advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:580` — reports untracked SFV4 arbitrary-tests static-only schema test advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:614` — accepts schema-derived property tests without arbitrary-tests advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:637` — does not treat a non-schema-derived fast-check property as arbitrary-tests coverage
- `packages/tooling/tool/cli/test/lint-command.test.ts:665` — counts class-local static codec calls toward the arbitrary-tests threshold
- `packages/tooling/tool/cli/test/lint-command.test.ts:693` — reports SFV4 arbitrary-tests advisories for synchronous schema codec helpers
- `packages/tooling/tool/cli/test/lint-command.test.ts:726` — accepts schema-derived static match usage without static-api advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:746` — reports untracked SFV4 equivalence manual equals advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:779` — accepts schema-derived equivalence helpers without equivalence advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:798` — accepts S.TaggedError declarations that rely on the derived field equivalence
- `packages/tooling/tool/cli/test/lint-command.test.ts:817` — reports S.TaggedError declarations that install a redundant toEquivalence hook
- `packages/tooling/tool/cli/test/lint-command.test.ts:853` — reports named effect/Schema TaggedError imports that install a redundant toEquivalence hook
- `packages/tooling/tool/cli/test/lint-command.test.ts:881` — reports named effect/Schema Class imports that install a redundant toEquivalence hook
- `packages/tooling/tool/cli/test/lint-command.test.ts:904` — reports S.Class declarations that install a redundant toEquivalence hook
- `packages/tooling/tool/cli/test/lint-command.test.ts:931` — reports S.Error declarations that install a redundant toEquivalence hook
- `packages/tooling/tool/cli/test/lint-command.test.ts:958` — reports S.TaggedClass declarations that install a redundant toEquivalence hook
- `packages/tooling/tool/cli/test/lint-command.test.ts:986` — ignores class declarations whose heritage is not a Schema class factory call
- `packages/tooling/tool/cli/test/lint-command.test.ts:1008` — follows annotation aliases up to three hops before giving up on the reference chain
- `packages/tooling/tool/cli/test/lint-command.test.ts:1046` — accepts field-level toEquivalence annotations inside the declared fields
- `packages/tooling/tool/cli/test/lint-command.test.ts:1065` — ignores unrelated local TaggedError factories
- `packages/tooling/tool/cli/test/lint-command.test.ts:1081` — reports a toEquivalence hook reached through a referenced annoteClass annotation record
- `packages/tooling/tool/cli/test/lint-command.test.ts:1107` — accepts annoteError tagged-error annotations
- `packages/tooling/tool/cli/test/lint-command.test.ts:1126` — preserves existing tagged-error exceptions without excepting new write findings
- `packages/tooling/tool/cli/test/lint-command.test.ts:1183` — reports untracked SFV4 boundary-codec JSON.parse advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:1213` — accepts schema JSON codecs without boundary-codec advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:1229` — reports untracked SFV4 defaults parameter object advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:1261` — accepts schema-owned constructor defaults without defaults advisories
- `packages/tooling/tool/cli/test/lint-command.test.ts:1280` — writes SFV4 numeric-domain advisories to the schema-first inventory
- `packages/tooling/tool/cli/test/lint-command.test.ts:1311` — filters generic and wholly runtime declarations before inventory comparison
- `packages/tooling/tool/cli/test/lint-command.test.ts:1434` — limits normalization advisories to exported schema-boundary helpers
- `packages/tooling/tool/cli/test/lint-command.test.ts:1479` — omits render contracts without hiding pure data declared in TSX
- `packages/tooling/tool/cli/test/lint-command.test.ts:1518` — recognizes local export lists for declarations, schema companions, structs, and functions
- `packages/tooling/tool/cli/test/lint-command.test.ts:1571` — recognizes anonymous direct default exports with stable fallback symbols
- `packages/tooling/tool/cli/test/lint-command.test.ts:1616` — inventories only exported top-level plain S.Struct object models
- `packages/tooling/tool/cli/test/lint-command.test.ts:1657` — rejects conflicting and out-of-package scan scopes
- `packages/tooling/tool/cli/test/lint-command.test.ts:1678` — scopes the scan to one package root
- `packages/tooling/tool/cli/test/lint-command.test.ts:1705` — reports same-package relative imports into src
- `packages/tooling/tool/cli/test/lint-command.test.ts:1734` — allows relative imports to local test fixtures
- `packages/tooling/tool/cli/test/lint-command.test.ts:1763` — allows source test-kit files under src internal test directories
- `packages/tooling/tool/cli/test/lint-command.test.ts:1792` — allows internal package alias imports
- `packages/tooling/tool/cli/test/lint-command.test.ts:1876` — reports a package whose check script never typechecks its test sources
- `packages/tooling/tool/cli/test/lint-command.test.ts:1903` — accepts a package whose check script transitively runs a test-covering project
- `packages/tooling/tool/cli/test/lint-command.test.ts:1936` — reports a test-covering project the check script never runs
- `packages/tooling/tool/cli/test/lint-command.test.ts:1970` — does not treat compiler names echoed as script text as test typechecking
- `packages/tooling/tool/cli/test/lint-command.test.ts:2003` — treats a baselined blind spot as green
- `packages/tooling/tool/cli/test/lint-command.test.ts:2034` — reports a tail-filtered include that leaves a sibling helper unselected
- `packages/tooling/tool/cli/test/lint-command.test.ts:2076` — accepts a tail-filtered include when it selects every test source
- `packages/tooling/tool/cli/test/lint-command.test.ts:2111` — reports a one-level include because nested sources stay unselected
- `packages/tooling/tool/cli/test/lint-command.test.ts:2151` — accepts a bare test directory include as a recursive subtree
- `packages/tooling/tool/cli/test/lint-command.test.ts:2194` — honors exclude when deciding which test sources a project selects
- `packages/tooling/tool/cli/test/lint-command.test.ts:2236` — follows check-script delegation through bun run flags
- `packages/tooling/tool/cli/test/lint-command.test.ts:2271` — preserves hand-authored notes when rewriting the baseline

The private review also supplies source-location-maps.json with exact unchanged
line blocks and explicit changed blocks, plus symbol-locations.json/test-locations.json.
Use named sites for implementation; never apply a uniform offset across changed code.
No tests were executed for this read-only reconciliation.
