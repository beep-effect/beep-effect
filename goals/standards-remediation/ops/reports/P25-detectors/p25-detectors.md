# P2.5 — detector framework lane (R6, R7, R11, R12)

Scope: `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`,
`packages/tooling/tool/cli/src/commands/Laws/DualArity.ts`, their test files,
plus a 2-line mechanical barrel addition in `packages/tooling/tool/cli/src/commands/Lint/index.ts`
(exports `detectInterfaceReason`/`detectTypeAliasReason` so tests can import
them, matching how the file already exports its other AST-detector helpers).
No `standards/*.jsonc` touched, no inventory regen, no commit.

## SchemaFirst.ts — per-change behavioral diff

All of R6/R7/R11 required restructuring `detectInterfaceReason`/
`detectTypeAliasReason` from a 2-state `O.Option<string>` (candidate/exception)
into a 3-state `SchemaFirstMemberClassification` (`silent | candidate |
exception`), because several rulings require emitting **no entry at all**
(not even a tracked exception) — a state the old `O.Option<string>` couldn't
express. The scan loop now `continue`s past `_tag: "silent"` declarations
instead of always pushing an entry.

1. **R6-1** — `extendsSchemaInfrastructureBase(extendsClauses)` (new
   `SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN` matching `S.declareConstructor`/
   `S.decodeTo`/`S.Bottom`/`VariantSchema.Field`, textual on the qualified
   access forms actually used in the repo) `&& hasRebuildThisMember(...)` →
   silent, checked first in the generic branch.
2. **R6-2 + R11-2** — `isSilentMemberShape(members)`: every member is either
   structurally function-like (`isFunctionLikeMember`, widened to
   MethodDeclaration/PropertyDeclaration + a `this`-typed property/field, not
   just interface-style signatures) or a curated runtime-handle signal
   (`isCuratedRuntimeHandleMember`) → silent. Applied identically in the
   generic branch, the extends branch (post-composition), and the plain
   non-extends/non-generic branch, and in `detectTypeAliasReason`'s generic
   and non-generic branches.
3. **R7** — the extends-branch unconditional short-circuit
   (`SchemaFirst.ts` old `:759-761`) is gone.
   `allExtendsClausesResolveExternal` resolves each extends clause's symbol
   declarations and checks `declaration.getSourceFile().isInNodeModules()`
   (a ts-morph path-string check — `node_modules/typescript/lib/*.d.ts` is
   itself under `node_modules`, so this covers node_modules/lib/React/JSX/DOM
   in one check). All-external → silent. Otherwise:
   `extendsSchemaInfrastructureBase` (schema-meta named-generic-instantiation
   idiom, e.g. `DateTimeInsert extends VariantSchema.Field<{...}>`) → stays a
   tracked **exception** (unchanged disposition, new dedicated reason text) —
   this is the one deliberate addition beyond the ticket's literal text,
   justified below. `hasOwnCallSignatureMember` (callable-instance mirror,
   e.g. `ChalkInstance extends ChalkInstanceSurface { (...text): string }`) →
   silent — also an addition, justified below. Otherwise
   `composeOwnAndLocalExtendsMembers` (own members + the OWN, single-hop,
   non-transitive members of every extends target resolving to a repo-local
   `InterfaceDeclaration`/`ClassDeclaration`) then falls through to the same
   `classifyComposedMembers` path as non-extends interfaces.
4. **R11-1** — `isServiceContractShape` runs first inside
   `classifyComposedMembers` (before the silent-member-shape check). Signals
   (1) same-file `Context.Service<Tag, X>()` (`captureContextServiceShapeNames`,
   textual on the class heritage clause) through ≤1 local `type X = A & B`
   intersection alias (`isIntersectionAliasedServiceContractShapeMember`) and
   (3) `*.ports.ts` are fully structural/trivial. (5) `.tsx` + `*Props`/
   `*RenderProps` or `forwardRef<Handle, X>` is name+textual. (2)
   parameter-of-a-method-of-(1) and (4) capability-registry
   `ReadonlyArray<X>` are implemented as **simplified, same-file textual**
   checks (`isServiceContractMethodParameterName`,
   `isCapabilityRegistryElementType`) rather than full call-graph
   verification — see "Deferred/simplified signals" below.
5. **R11-4** — the old "Interface contains non-schema signals..." exception
   reason is retired; anything that isn't silenced by (1)/(2)/(3) above is
   now `candidateClassification`, full stop. This dissolves the S2-signals
   "exception" bucket into `silent | candidate` as R11's own framework
   requires.
6. **R11-3** — `isCuratedRuntimeHandleMember` checks only
   `NON_SCHEMA_SIGNAL_PATTERN` (kept as its own function, separate from the
   structural `isFunctionLikeMember`, per the instruction to keep this list
   "explicit and separate").
7. **R11-5** — `\bUint8Array\b` removed from `NON_SCHEMA_SIGNAL_PATTERN`.
8. **R11-6** — `resolveOneLevelLocalTypeAlias` resolves a `TypeReferenceNode`
   member type to its local `TypeAliasDeclaration`'s own type node (one hop)
   before both `isFunctionLikeMember`'s structural test and
   `isCuratedRuntimeHandleMember`'s textual test.

### Deliberate additions beyond the ticket's literal R7 text

The ticket describes R7 as: external → silent, else compose members → member
safety. Reading the actual 55-entry S3-extends cluster (per
`ops/reports/P2-audits/p2-s3-extends.md`) surfaced two sub-families that a
literal member-composition would have misclassified:

- **8 entries** (`DateTimeInsert` family, `Date`, `BooleanSqlite`, etc.)
  extend `VariantSchema.Field<{...}>`/`S.decodeTo<...>` with an EMPTY own body
  (`{}`). `VariantSchema.core.ts`'s `Field<A>` interface's own member
  (`schemas: A`) is a still-generic, uninstantiated type parameter — naive
  member composition via `getMembers()` cannot see through the generic
  instantiation to the real `{select, insert, json}` shape the type argument
  carries. Rather than build a Type-API-based generic-instantiation resolver
  (high risk, unverified against this file's existing textual-check style),
  I added a direct textual intercept: if the extends clause itself matches
  `SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN`, keep the existing exception
  disposition (matching `p2-s3-extends.md`'s own conclusion: "fold into the
  non-schema-signals reason... no standing exception language change needed
  beyond that").
- `ChalkInstance extends ChalkInstanceSurface` (`declare abstract class`,
  chain-accessor methods returning `this`). Composing its class members
  needed `isFunctionLikeMember` widened to `MethodDeclaration`/
  `PropertyDeclaration` + `this`-typed properties (done, see change 2 above),
  but `ChalkInstanceSurface.level: ColorSupportLevel` is one genuine data
  property, so a literal composition still lands on `candidate`. Added
  `hasOwnCallSignatureMember` (own call signature + extends another type =
  "callable-instance mirror," verbatim the decisions.md R11-3 example) as a
  narrow, structurally-checkable silent-skip, verified against the real
  `packages/foundation/capability/chalk/src/{Chalk,Chalk.browser}.ts` shape.

Both are driver-challengeable per D-C; I verified each against the real
source before adding it (`packages/foundation/modeling/schema/src/Model/Model.datetime.ts`,
`packages/foundation/capability/chalk/src/internal/PublicSurface.ts`).

### Deferred/simplified signals (R11-1 (2) and (4))

Per the instruction to implement (2)/(4) "if tractable, else defer and name
affected entries": both are implemented as **simplified textual heuristics**
rather than full call-graph verification, since a true implementation would
need to trace call expressions through indirection (e.g.
`WinkVectorizerShape.withFreshInstance`'s nested callback parameter, or
verifying a registry array element is actually iterated and its member
invoked) — out of budget for this lane.

- Signal (2) `isServiceContractMethodParameterName`: checks whether the
  target's name appears in a parameter position (`(x: Name` / `, x: Name`)
  anywhere in the **full text** of a same-file declaration whose name is a
  captured `Context.Service` shape name. This resolves the report's own
  example (`ScopedVectorizer` passed to `WinkVectorizerShape.withFreshInstance`)
  correctly in principle, but was not re-verified against the real
  `packages/drivers/wink/src/WinkVectorizer.service.ts` file (not part of my
  fixture set) — flagging `ScopedVectorizer` as the one S2-report entry this
  signal is meant to cover but is unverified in-repo.
- Signal (4) `isCapabilityRegistryElementType`: checks for
  `ReadonlyArray<Name>`/`Array<Name>` textual presence anywhere in the file,
  without verifying iteration + an invoked Effect/Stream-returning member.
  Covers `FileProcessingEngineShape` and `SyncDataTarget` per the S2 report;
  not individually re-verified in-repo.

Both remain live, additive signals (they can only ADD silent-skips, never
remove one), so a false negative here just means the entry surfaces as a
candidate for a P4 lane rather than going silent — never a false positive
that hides a genuine candidate.

## DualArity.ts — R12

### PERMANENT_EXCLUSIONS + scanChunk

Added `PERMANENT_EXCLUSIONS: ReadonlyArray<{file, qualifiedName, reason}>`
and `isPermanentlyExcludedCandidate`, checked inside `makeInventoryEntry`
(single choke point — every candidate path funnels through it, so no
per-collector-function changes were needed). Registered
`packages/agents/server/src/AssistantTurn/ScanState.ts :: scanChunk` with the
driver-verified reason from `ops/reports/P2-audits/p2-d5d8.md` (consumed by
reference at `AnthropicTurnKernel.ts:143`).

### makeChatOperations — diagnosed failing conjunct

**`isFactoryReturnType`**, specifically its
`DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN.test(typeText)` guard. `typeText =
type.getText()` on an object return type prints the type's **full structural
signature**, including every member's own type text. `ChatOperations`
(`makeChatOperations`'s inferred return type) has methods returning
`Effect.Effect<...>`, so its printed text contains `Effect.Effect<` as a
substring purely from nested member signatures — `isFactoryReturnType`
rejected it (`return false`) before ever reaching `isStrictObjectLikeType`.
This is a plain false-positive substring match, not a semantic check: the
pattern was written to reject a return type that IS ITSELF directly an
`Effect`/`Schema`/`Promise` instantiation (e.g. `EffectOptions =
Effect.Effect<void>`, correctly rejected in the existing "requires ObjectLike
third parameters" dual-arity test), not an object/record whose members
merely mention these types in their own signatures.

Fix: `isAllMethodMembersObjectType(type, contextNode)` — checks the return
type's OWN properties (`type.getProperties()`), each resolved via
`property.getTypeAtLocation(contextNode)` (the actual per-property type, not
printed text), and accepts when every property's resolved type has call
signatures (i.e. a record of methods) and the object itself isn't callable.
Wired in as a fast-path at the top of `isFactoryReturnType`, before the
textual check — bypasses the buggy substring match entirely for this shape.
`isStrictObjectLikeType` (used independently by the dual-arity 3rd-parameter
law) was deliberately left untouched — it has the identical latent bug, but
touching it would widen blast radius onto an orthogonal law; the fix here is
scoped narrowly to `isFactoryReturnType`, per the instruction ("fix the
failing conjunct narrowly"). `isLegitimateConstructorFactory`'s one call site
now threads `docNode` through as the context node.

Zero risk to existing dual-arity tests: `isLegitimateConstructorFactory`'s
first conjunct, `hasJSDocCategory(docNode, "constructors")`, gates on an
explicit `@category constructors` JSDoc tag — none of the existing
`dual-arity.test.ts` fixtures carry any JSDoc, so none of them reach the
changed conjunct at all.

## Fixture pairs (all new, all passing)

`test/schema-first.test.ts` (+16 tests): R6-1 (Box<A> exception /
FooFromSelf+Rebuild silent), R6-2/R11-2 (all-function generic silent /
generic+data-field exception / non-generic all-function silent), R7
(external-node_modules-extends silent / repo-local pure-data extends
candidate / repo-local extends-with-function-members mixed candidate /
schema-meta VariantSchema.Field extends exception), R11-1 (Context.Service
shape silent / identical shape sans signal candidate), R11-4 (mixed
no-signal candidate), R11-3 (WinkMethods silent), R11-5 (Uint8Array
interface candidate + Uint8Array type-literal candidate), R11-6 (aliased
function member still detected → silent).

`test/dual-arity.test.ts` (+2 tests): R12-scanChunk (registered ScanState.ts
scanChunk silent / unregistered sibling 2-param export still fires),
R12-constructor-factory (all-methods-record `@category constructors` factory
silent / identical untagged shape still fires with `missing-dual`).

The external-node_modules-extends fixture uses a global-ambient declaration
(no import/export) placed at an in-memory `/node_modules/...` path —
`isInNodeModules()` is a plain path-string check (`ts-morph.js:14227`,
`indexOf("/node_modules/") >= 0`), verified by reading the compiled source
before writing the fixture, so this stands in for React/d3/frimousse without
a real npm install.

## Real-repo sanity check (read-only, no `--write`, no commit)

Ran `bun run beep lint schema-first` and `bun run beep laws dual-arity`
against the live repo (not just isolated fixtures) to confirm the
restructuring doesn't crash or misbehave at scale:

- schema-first: 156 previously-tracked entries now `stale` (silenced away —
  in line with R6/R7/R11's combined estimate of ~150-190), 2 new live
  candidates (`AddChildrenOptions`, `TraversalStart` — both plain interfaces
  with **zero** extends/generics, unaffected by any of my changes; they are
  pre-existing repo drift, new symbols never previously tracked, unrelated to
  R6/R7/R11), plus 1 unrelated new generic (`MakeOperationResultOptions`,
  correctly still "exception" per R6's unchanged Family-D disposition).
- dual-arity: confirmed `makeChatOperations` and `scanChunk` both now show as
  `[stale]` (i.e. no longer live findings) against their real production
  files — the other ~42 stale entries are unrelated, already-converted
  functions from other concurrent P3 lanes, not caused by this change.
  2 new `[missing]` entries: my own newly-exported
  `detectInterfaceReason`/`detectTypeAliasReason` (3-param AST-detector
  helpers, same shape as the existing D8 `fnSchemaEntryFromFunctionLike`
  family) — expected, standard new-code behavior, needs the driver's next
  regen pass (not a detector bug, not something I can resolve without
  touching `standards/*.jsonc`, which is out of fence).

## Follow-ups (driver review round 2)

Both beyond-ticket R7 additions (schema-meta empty-body intercept,
callable-instance-mirror intercept) were ratified and locked as **R13** in
`research/decisions.md`. Two follow-ups applied here, same file fence:

### 1. R13 refinement — schema-meta extends disposition

Driver-verified against the real `DateTimeInsert` (`Model.datetime.ts:133`,
empty own body `{}`, exists solely for the type/value dual-binding): an
extends clause matching `SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN` now goes
**silent** when the interface's own body is empty or carries only meta
members (`Rebuild: this`) — previously this landed on `exceptionClassification`
(a tracked exception). Added `isRebuildThisProperty` (factored out of
`hasRebuildThisMember`) and `isEmptyOrMetaOnlyOwnBody`. An extends of the same
schema-infra base WITH an added real data member still falls through to
`composeOwnAndLocalExtendsMembers` + `classifyComposedMembers` unchanged (per
instruction: "same extends WITH any added data member still falls through to
member composition"). The now-unused `SCHEMA_INFRASTRUCTURE_EXTENDS_REASON`
constant was removed.

Fixture pair (`test/schema-first.test.ts`, replacing the old single "tracked
exception" assertion): (a) `DateTimeInsert`-shaped empty-body extends →
`silent`; (b) same shape plus `readonly extra: string` → `candidate` (member
composition fired, composed set is genuine data, no protecting signal).

### 2. Parameter-shape fix — detectInterfaceReason/detectTypeAliasReason

Converted both from `(node, sourceFile, filePath)` (3 positional params,
2 new dual-arity "missing" findings) to a single object parameter
`(input: DetectInterfaceReasonInput | DetectTypeAliasReasonInput)` —
arity 1, structurally below the dual-arity law's 2-3-param scan range
(`parameterCount.value < 2` in `collectVariableCandidate` skips it before any
diagnostic runs), so this is a genuine drop below the candidate floor, not an
exclusion hack. Updated the two call sites in `scanSchemaFirstInventory` and
all 17 call sites across the new fixtures in `test/schema-first.test.ts`
(mechanical `sed` conversion, verified against `git diff` afterward).

**Second-order finding, fixed in the same pass**: the initial inline-object
parameter type (`(input: { readonly node: ...; ... })`) traded the 2
dual-arity findings for 2 NEW schema-first `SFV4-fn-schema` advisories —
`fnSchemaEntryFromFunctionLike`'s `isInlineTypeLiteralNode` check flags any
exported function parameter whose type node is a literal `TypeLiteral` in a
schema-modeled file (this file uses `S.Class` throughout, so it counts).
Fixed by extracting the parameter type into named type aliases
(`DetectInterfaceReasonInput`, `DetectTypeAliasReasonInput`) — the parameter's
type node is then a `TypeReferenceNode`, not a `TypeLiteral`, so the check no
longer fires. Zero-cost (plain TypeScript types, not a real runtime schema —
correctly so, since the parameter carries a live ts-morph AST node/SourceFile,
exactly the kind of non-serializable value this whole initiative treats as
out-of-scope for schema-ification elsewhere).

### Re-verify after follow-ups

```
$ npx tsgo -b tsconfig.json --force        # 0 errors
$ npx vitest run test/schema-first.test.ts test/dual-arity.test.ts
 Test Files  2 passed (2)
      Tests  59 passed (59)   # 58 prior + 1 net new (R13 replaced 1, added 1)
```

### Live read-only sanity scan, before → after follow-ups (no `--write`, no commit)

| Metric | Before follow-ups | After follow-ups |
|---|---:|---:|
| schema-first `live_entries` | 173 | 163 |
| schema-first `missing_entries` | 3 | 0 |
| schema-first `stale_entries` | 156 | 163 |
| schema-first `enforced_candidates` | 2 | 0 |
| schema-first `sfv4_fn_schema_advisories` | 0 | 0 |
| dual-arity `live_entries` | 15 | 13 |
| dual-arity `missing_entries` | 2 | 0 |
| dual-arity `stale_entries` | 44 | 44 |
| dual-arity `enforced_candidates` | 0 | 0 |

The jump from 156→163 schema-first `stale_entries` is R13 silencing the
8-entry `DateTimeInsert`/`Date`/`BooleanSqlite` schema-meta family (exactly
matching the p2-s3-extends report's "8 entries" count for that sub-class).
The `enforced_candidates` 2→0 and `missing_entries` 3→0 movement is **not**
caused by my changes — `git diff --stat` on `TextGraph.ts`/`GraphOps.ts`
confirms `AddChildrenOptions`/`TraversalStart`/`MakeOperationResultOptions`
were converted to `S.Class` by other concurrent P3/P4 lane activity in this
shared checkout between my two scan runs (verified: `TraversalStart` is now
`export class TraversalStart extends S.Class<TraversalStart>(...)`).
`scanChunk` and `makeChatOperations` remain confirmed `[stale]` (silenced) in
both dual-arity runs. Both laws now show `missing_entries=0` and
`enforced_candidates=0` against the live repo, with zero new side-effect
findings.

## Verify

```
$ npx tsgo -b tsconfig.json --force        # 0 errors
$ npx vitest run test/schema-first.test.ts test/dual-arity.test.ts
 Test Files  2 passed (2)
      Tests  59 passed (59)
```

## Follow-up 3 — JSDoc for detectInterfaceReason/detectTypeAliasReason

The jsdoc ratchet flagged both newly-exported detectors as missing
`@example`/`@category`/`@since`. Root cause found before writing anything:
follow-up 2's parameter-shape edit had inserted the new
`DetectInterfaceReasonInput`/`DetectTypeAliasReasonInput` type-alias
declarations **between** the existing JSDoc block and its `export const`,
orphaning the doc comment from the function it was meant to document (the
scanner reads the block immediately preceding the exported declaration) — a
bug in my own prior edit, not a pre-existing gap.

Fixed by moving each type alias above its own (new, minimal) JSDoc block,
then placing the detector's JSDoc block immediately above the `export const`
again. Replaced the placeholder `console.log(fnName)` example (copied from
this file's own precedent, e.g. `fnSchemaEntryFromFunctionLike`'s doc) with a
real compiling example per the instruction: a `ts-morph` `Project` with
`useInMemoryFileSystem: true`, a tiny in-memory source file, a constructed
`DetectInterfaceReasonInput`/`DetectTypeAliasReasonInput`, and
`console.log(classification)` showing the actual observable
silent/candidate/exception result — `detectInterfaceReason`'s example uses an
all-function-member interface (`silent`, the novel R6-2/R11-2 behavior);
`detectTypeAliasReason`'s uses a plain pure-data type alias (`candidate`), so
the pair shows both outcomes. `@category utilities` matches this file's
existing taxonomy for AST-detector helpers (`fnSchemaEntryFromFunctionLike`,
`nullReturnEntryFromFunctionLike`, etc.); the two new input type aliases get
their own minimal `@category models` blocks. No `any`/assertions/`declare`;
imports are the package's public entrypoint (`@beep/repo-cli/commands/Lint`)
plus `ts-morph` directly (a third-party dependency of this package, not
subject to the `S`/`A`/`O`/`P`/`R` effect-namespace aliasing rule).

Verify: `turbo run docgen --filter=@beep/repo-cli` — cache miss (fresh run),
"546 example(s) found" → "Typechecking examples..." → "✓ Docs generation
succeeded!" (repo-cli's full example set, including these 2, typechecks
clean). `npx vitest run test/schema-first.test.ts test/dual-arity.test.ts` —
59/59 still green (JSDoc-only change, no test file touched this round).

## Summary

R6/R7/R11/R12/R13 implemented in SchemaFirst.ts + DualArity.ts, 19 fixtures,
all green, 0 tsgo errors. Restructured detectInterfaceReason/
detectTypeAliasReason into silent|candidate|exception (was O.Option<string>).
Diagnosed makeChatOperations conjunct: isFactoryReturnType's
DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN false-positives on an object return
type's printed text containing nested Effect.Effect<; fixed via
isAllMethodMembersObjectType, scoped narrowly (isStrictObjectLikeType
untouched). R13 (driver-ratified): schema-meta empty-body extends now
silent, not exception. Both new exported detectors converted to a single
named-type object parameter — genuinely drops below the dual-arity candidate
floor (arity 1) and, after extracting the type alias, avoids trading it for
a new schema-first SFV4-fn-schema advisory. Fixed a self-introduced JSDoc
orphaning bug from that parameter-shape edit and replaced both placeholder
examples with real ts-morph-driven compiling examples showing the
silent/candidate outcomes — `turbo run docgen --filter=@beep/repo-cli`
green (546 examples typecheck). Live real-repo re-scan (no --write, no
commit): schema-first missing_entries 3→0, enforced_candidates 2→0 (2 of
those 3 were unrelated concurrent-lane conversions, not my changes),
stale_entries 156→163 (+8, the R13 schema-meta family); dual-arity
missing_entries 2→0, enforced_candidates steady at 0; scanChunk +
makeChatOperations confirmed silenced in both runs. Deferred: R11-1 signals
(2)/(4) remain simplified textual heuristics, not call-graph-verified. No
standards/*.jsonc touched, no commit.
