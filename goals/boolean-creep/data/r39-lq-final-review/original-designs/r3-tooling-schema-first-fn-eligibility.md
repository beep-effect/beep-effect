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
