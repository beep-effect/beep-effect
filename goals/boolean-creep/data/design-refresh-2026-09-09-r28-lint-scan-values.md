# R28 lint scan value adjudication — 2026-09-09

## Scope and result

Frozen source: `93217d998f851e2e93d9864e2b5315552eaa58a7`.
Corpus: `origin/main@d1b4d769fbaffddd55717f3b1ba461897dd545c5`.
Old comparison source: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Only this new audit and `data/provisional-r28-schema-first-function-scan-mode.md`
were written. Current designs, inventory, source/tests, prior R27/R28 receipts,
archives, package/dependency files, statuses and Git state remain unchanged by
this task. No package commands, service, browser run or independent review ran.

All three current clusters contain actual computed Boolean values in a function
scope; they are eligible before cardinality. Their detector functions are not
members. No anonymous flag-parameter group or required payload comparison was
invented as a new carrier.

| Stable id | Actual current owner/members | Native source disposition |
| --- | --- | --- |
| `r3-tooling-schema-first-fn-eligibility` | SchemaFirstScan.ts239, appendFunctionEntries: inspectFnSchema, inspectNullReturn | Proposed D1→qualified E4, 4/3, derived/internal/Tier1 LiteralKit. Existing stable ID retained; independent owner confirmation/correction still required before parent admission. |
| `r3-tooling-schema-first-normalization-signals` | SchemaFirstScan.ts218, appendCallEntries: hasNormalizationSignal, hasGetSomesSignal | Retain D1, 4/4; correct old line195 and synthetic owner label. |
| `r3-tooling-lint-tagged-union-pattern-gates` | Lint.command.ts466, taggedUnionViolation: missesLiteralKitPattern, usesAllowedFallback | Retain D1, 4/4; correct old line371, synthetic owner, and renamed members. |

## Discovery and source proof

Graft callers for appendFunctionEntries reached the containing scan and import
facades, and graph regex search located the two scan calls. Graft had no symbol
for taggedUnionViolation; the direct source search found its sole call at
Lint.command.ts512. Graph import edges to SchemaCatalog do not establish calls
to appendFunctionEntries. Complete exact-symbol searches across packages/apps
followed the graph. Read-only old/current Git diff and numbered source reads
established the changed declarations. No missing edge is treated as absence.

Full paths used below:

- Scan: `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts`
- Detectors: `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstDetectors.ts`
- Project: `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstProject.ts`
- Schemas: `packages/tooling/tool/cli/src/commands/Lint/Lint.schemas.ts`
- Command: `packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts`

## Function scan: project eligibility before the truth table

Project57–62 passes SchemaFirstSourceFileGlobs to createRepoTsMorphProject.
Schemas53–54 explicitly includes `apps/**/*.{ts,tsx}` and
`packages/**/*.{ts,tsx}` plus infra TS, with only a docs-negative glob.
`packages/tooling/tool/cli/src/internal/tsmorph/ProjectFactory.ts:34–53` reads only
tsconfig compiler options, iterates the requested filesystem glob matches and
adds them to the project; tsconfig include/exclude does not remove ordinary TSX
from those requested matches.

Scan311–319 computes a normalized relative path, appends arbitrary/tagged-error
findings, then skips isSchemaFirstExcludedFile before calling appendFunctionEntries.
Project88–89 composes ecosystem-member exclusion with the shared path exclusion.
`packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts:39–44` excludes
packages/ecosystem/<member>/…; it does not exclude the whole packages or apps
roots. `packages/tooling/library/repo-utils/src/schemas/TypeScriptSourceExclusions.ts:29–74,117–124`
excludes named generated/build/docs/test directories and d.ts/test/spec/gen/story
suffixes. Plain `.tsx` is not one of those suffixes. Normalized
`packages/example/src/Example.tsx` reaches appendFunctionEntries.

Existing public command fixtures prove this scope instead of relying only on
glob permissiveness: `packages/tooling/tool/cli/test/lint-command.test.ts:503–559`
feeds otherwise corresponding TS/TSX files through `lint schema-first`. The TS
fixture contains S.Class and an exported inline-parameter function and expects
the fn-schema advisory; TSX expects none. Lines1411–1446 additionally show a
pure DataPayload interface in a TSX file entering inventory, while render props
are skipped. Those tests were read, not run in this audit.

Scan232–238 gathers exported named functions and exported arrow functions before
the two values are computed. A file with no candidates still computes the
values; it emits no function finding. Empty candidates are not an additional
Boolean member and do not remove a legal mode.

## Function scan: declared values and all supported states

Current Scan239–242 declares:

```ts
const inspectFnSchema =
  SchemaFirstDetectors.sourceHasFnSchemaSignal(sourceFile) &&
  SchemaFirstDetectors.isFnSchemaEligibleFilePath(filePath);
const inspectNullReturn = SchemaFirstDetectors.isNullReturnEligibleFilePath(filePath);
```

Detectors657–660 detects S.Class/Struct/TaggedClass/TaggedStruct/Error/TaggedError,
Entity.Entity, or Fn source signals via patterns27–28/39. Detectors662 and783
both implement exactly `!Str.endsWith(".tsx")(filePath)`. Let H be the source
signal and E this shared path eligibility: the stored local values are H&&E, E.
E4 therefore excludes only true/false. H and E themselves are explanatory
predicate results, not extra invented members in the current record.

| Path and complete supported source witness | H | E | inspectFnSchema | inspectNullReturn | Intended work |
| --- | --- | --- | --- | --- | --- |
| Example.tsx with the S.Class/exported-function fixture at lint-command.test544–551 | true | false | false | false | skip both function detectors; other TSX scans still run |
| Example.ts with `export function findUser(id: string): string \| null { return null; }` | false | true | false | true | null-return only |
| Example.ts with the S.Class/exported-function fixture at lint-command.test508–515 | true | true | true | true | fn-schema and null-return checks |
| Example.tsx without any schema signal | false | false | false | false | same skip mode, not a fourth state |

The no-signal TS null-return source is the explicit ts-morph fixture at
`packages/tooling/tool/cli/test/schema-first.test.ts:335–348`; placing that same
ordinary file under the supported source path uses the existing command fixture
contract at lint-command.test72–97. This is a source-grounded composition of
supported fixtures, not an executed new command test. A combined TS fixture
with S.Struct plus `export function find(input: { id: string }): { id: string } | null { return null; }`
exercises both detectors and must retain fn-schema-before-null-return order per
function at Scan244–248.

The old row was not actually independent either. Old Scan249–251 held three real
values named hasFnSchemaSignal, isFnSchemaEligible, isNullReturnEligible; the
last two were equal. Its old eight representable tuples had four supported
values, H/E/E =000,100,011,111. The merge combines H&&E into inspectFnSchema and
leaves inspectNullReturn, yielding the current 4/3 pair. Correct the same stable
ID to current owner appendFunctionEntries and current members. Do not archive it
as callable-only, and do not create a second overlapping R28 ID. Its synthetic
old owner label was metadata drift around a real value carrier.

## Call scan: complete independence witnesses

Scan218–219 declares two Boolean values. Detectors788–791 defines normalization
as SCHEMA_BOUNDARY_CALL_PATTERN && NORMALIZATION_CALL_SIGNAL_PATTERN;
patterns40–42 cover trim/toUpperCase/toLowerCase plus S/Schema decode/encode/
validate/asserts/is calls. Detectors905–906 and pattern45 detect `getSomes(`
independently. They do not share a restricting eligibility axis.

These syntactically ordinary source files can each be placed at the existing
fixture path `packages/example/src/Example.ts` and reach appendCallEntries:

```ts
// N0G0: neither signal
export const value = 1;
```

```ts
// N1G0: normalization only
import * as S from "effect/Schema";
const Name = S.String;
export function normalizeName(input: unknown): string {
  return S.decodeUnknownSync(Name)(input).trim();
}
```

```ts
// N0G1: getSomes only; retain full Option payloads, including Some(false)
import * as R from "effect/Record";
import * as O from "effect/Option";
export function pickSomes() {
  return R.getSomes({ value: O.some(false), absent: O.none() });
}
```

N1G1 is the second and third source bodies in the same file with their three
imports. None of the patterns can remove the other match, and Scan318 has no
file-level exclusivity filter. Full-file source is accepted even when it earns
an advisory; linting nonconforming source is a supported command operation.
The fn/null function signal pair has a different constraint and is not inferred
from these independent call signals.

Existing detector fixtures at schema-first.test301–324 and389–400 establish the
normalization/getSomes producer routes. The command-level normalization fixture
at lint-command.test1362–1404 proves the scan invokes the exported schema-boundary
detector while omitting unrelated/private method findings. Neither source signal
itself guarantees a finding: top-level normalization is rejected at
schema-first.test326–333, and getSomes over an identifier dictionary is rejected
at403–415. These are legitimate None results. Scan167–186 invokes both enabled
detectors independently for each call and appendOptionEntry89–91 preserves each
full Some(SchemaFirstInventoryEntry), or appends nothing for None. No result
array, payload presence, or entry-status literal is reduced to a Boolean axis.

Retain D1 for all four source-signal tuples. Update stable row owner to
appendCallEntries, line218; no design or implementation is required.

## Tagged-union policy: all four supported input tuples

Command454–492 reads source text, finds the first declaration matching the
required schema name, and examines exactly the next1400 characters. The two
actual values are missesLiteralKitPattern466–469 and usesAllowedFallback470–471.
The source is a lint input string, not a decoded schema-only expression;
multiple valid declarations in the same snippet are supported. The consumer472
reports a violation only for misses=true, allowed=false.

The common declarations below may precede each matching declaration; they need
not be inside the snippet. They make the proper-pattern examples concrete:

```ts
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
const Left = S.Struct({ kind: S.tag("left") });
const Right = S.Struct({ kind: S.tag("right") });
```

Use these four short bodies inside an ordinary discovered tooling TS file:

```ts
// misses=false, allowed=false: full proper pattern, no S.Union
export const GenerationAction = LiteralKit(["left", "right"]).mapMembers(
  Tuple.evolve([() => Left, () => Right])
).pipe(S.toTaggedUnion("kind"));
```

```ts
// misses=true, allowed=false: neither recognized construction
export const GenerationAction = S.String;
```

```ts
// misses=true, allowed=true: GenerationAction's permitted fallback alone
export const GenerationAction = S.Union([Left, Right]).pipe(S.toTaggedUnion("kind"));
```

```ts
// misses=false, allowed=true: BOTH proper construction forms in the same snippet
export const GenerationAction = S.Union([Left, Right]).pipe(S.toTaggedUnion("kind"));
const OtherAction = LiteralKit(["left", "right"]).mapMembers(
  Tuple.evolve([() => Left, () => Right])
).pipe(S.toTaggedUnion("kind"));
```

Each matching body is far below1400 characters. These are supported source-string
inputs to this text reader; they were not compiled or executed in the audit.
The second body intentionally earns a diagnostic, rather than pretending the
lint command accepts only already-compliant source. Both proper patterns in the
last body are complete; it does not rely on a comment or a partial token to
manufacture the combined case. The exact first return at472–482 ignores later
files once a matching declaration is found. No match yields missing-schema484–490.

Command85–96 supplies ten schema names, including GenerationAction. For any
other name the fallback is false, but that per-name subset does not shrink the
full owner domain. The sole reader caller511–513 iterates all ten names; paths
come from collectTypeScriptFiles149–234 and are filtered to tooling at507.
Read errors normalize to empty text462, which does not reach these local values
without a declaration match. The public entry is tooling-schema-first716,
registered in lintSubcommands735/lintCommand750–752.

Preserve the exact whitespace-sensitive patterns: `.pipe(S.toTaggedUnion(`
requires adjacency, and the full check is the OR of three missing-token tests.
Do not silently replace it with AST inspection or whitespace-tolerant matching.
The actual production declarations at
`commands/CreatePackage/FileGenerationPlanService.ts:278–287` and
`commands/CreatePackage/TsMorphIntegrationService.ts:134–146` have other formatting;
this audit does not claim that the whole existing tooling-schema-first command
is green or that those snippets satisfy this exact matcher. That is separate
from proving the scanner's supported input truth table.

The old usesLiteralKitPattern name already stored the OR of missing-pattern
checks; current missesLiteralKitPattern is a naming repair, not an inversion.
usesTaggedUnionFallback became usesAllowedFallback with the same GenerationAction
restriction. Retain D1 and correct owner/name/anchor metadata; no Boolean-creep
design is warranted.

## Exact parent row proposals

The first row is a proposed classification only. Its confirmed status is the
schema-valid admission proposal, not a canonical status mutation. Parent keeps
it provisional until the independent R28 owner report/correction supports the
qualification. The other two retain D1 and need metadata/evidence repairs only.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-tooling-schema-first-fn-eligibility","file":"packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts","line":239,"symbol":"appendFunctionEntries","kind":"sibling-state","members":["inspectFnSchema","inspectNullReturn"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts","line":239},"note":"Actual computed values at239-242: inspectFnSchema = sourceHasFnSchemaSignal(sourceFile) && isFnSchemaEligibleFilePath(filePath), and inspectNullReturn = isNullReturnEligibleFilePath(filePath). Both path predicates equal !endsWith(.tsx) in SchemaFirstDetectors662/783, so inspectFnSchema implies inspectNullReturn. Project globs include ordinary TSX and generic exclusions do not remove it; supported pairs are00,01,11. See data/design-refresh-2026-09-09-r28-lint-scan-values.md for exact project/exclusion and fixture proof."}],"cardinality":{"representable":4,"legal":3},"storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"notes":"Proposed R28 D1-to-qualified correction at frozen source93217d998f851e2e93d9864e2b5315552eaa58a7 / origin-main d1b4d769fbaffddd55717f3b1ba461897dd545c5. Retain stable ID; replace stale scanSourceFile.fnEligibility/three old members with actual appendFunctionEntries/two current values. Provisional P2 design is data/provisional-r28-schema-first-function-scan-mode.md. Parent admission awaits independent R28 owner confirmation/correction and later P3; this proposed record is not an applied status change."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-tooling-schema-first-normalization-signals","file":"packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts","line":218,"symbol":"appendCallEntries","kind":"sibling-state","members":["hasNormalizationSignal","hasGetSomesSignal"],"status":"disqualified","disqualifier":{"class":"D1","note":"D1: actual sibling Boolean values at SchemaFirstScan218-219. Normalization signal requires a schema-boundary regex and trim/toUpperCase/toLowerCase; getSomes signal is a separate getSomes regex (SchemaFirstDetectors788-791/905-906). Supported source files admit all four pairs: neither, schema-boundary normalization alone, R.getSomes alone, or both in separate exported functions. Readers167-186 independently append complete optional findings; a signal is not itself a finding. Current-source audit data/design-refresh-2026-09-09-r28-lint-scan-values.md includes all four input witnesses."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-tooling-lint-tagged-union-pattern-gates","file":"packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts","line":466,"symbol":"taggedUnionViolation","kind":"sibling-state","members":["missesLiteralKitPattern","usesAllowedFallback"],"status":"disqualified","disqualifier":{"class":"D1","note":"D1: actual Boolean values at Lint.command466-471. Within the first matching declaration's1400-character snippet, complete mapMembers/Tuple.evolve/pipe(S.toTaggedUnion pattern and the GenerationAction-only S.Union/pipe(S.toTaggedUnion fallback are not mutually exclusive. Proper pattern alone gives00, proper pattern plus fallback gives01, neither gives10 (violation), fallback alone gives11 (allowed), in misses/allowed order. Preserve exact regex whitespace, first-match behavior, and the GenerationAction name restriction. The old usesLiteralKitPattern name already held a missing-pattern predicate; it was renamed, not logically inverted in this merge."}}
```

## Validation and pending work

Completed packet checks:

- Extracted the three full JSONL proposals and ran
  `bun goals/boolean-creep/ops/validate-inventory.ts /dev/stdin`:
  `inventory OK: 3 records, 3 unique ids`.
- All eight required section headings are present in the provisional design.
- Both new documents pass trailing-whitespace and code-fence balance checks.
- HEAD and origin/main match the full pins above. The eight scope/producer/
  reader source files inspected for the proof still match HEAD.

No canonical design coverage, package test, command-fixture execution or P3
result is claimed. Parent integration and independent Grok confirmation/
correction plus later independent P3 remain outstanding.

Graft reported approximately33,048 tokens in estimated whole-file-read savings
from the two successful queries; the taggedUnionViolation missing-symbol query
provided no absence proof. Exact source reads supplemented the graph.
