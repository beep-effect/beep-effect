# effect-vitest-reachable-helper-flags

P2 at f97a89bdfdc5bc71b69aab09b8d425591698d42a, 2026-09-24.
Separate derived output owner from stored FunctionReachability. No implementation
or independent P3 credit. Preserve live-only as distinct from test-clock.

## Current shape and ownership

EffectVitestSyntax.ts627-640 exports a function-bearing harness index contract.
Its reachableHelper method returns Option of callback plus four derived Boolean
facts: effect, testClock, plain, shared (629-636). helperReachability1043-1056
is its production constructor: it requires a real callback node and plain OR
effect, then projects the three reachability bits and shared=outside OR uncertain.
The helper function itself is private, but the type and factory are exported via
EffectVitest.ts114,134, Lint/index.ts20 and the commands/Lint package subpath.
Calling this an entirely unexposed internal API would be inaccurate.

This owner is distinct from the stored graph vertex: a separate declared return
record with separate derived members, collapses outside/uncertain to shared,
and filters out nodes without test reachability. Removing the stored vertex's
invalid pair does not eliminate this output's independently typed four-bit bag.
Record storage=derived. Do not store a second per-vertex helper-mode cache.

## Cardinality gap and evidence

Full four-bit present result:16 representable,10 legal. Five nonempty harness
reachability cases times independent shared false/true:

| plain | effect | testClock | case |
| --- | --- | --- | --- |
| true | false | false | plain |
| false | true | false | live |
| true | true | false | plain-live |
| false | true | true | test-clock |
| true | true | true | plain-test-clock |

Both-false plain/effect results are excluded by the explicit emission guard1046;
clock implies effect by source854-856 and every seed892-893,986-987 and monotone
propagation1027-1031. The full result has six invalid tuples, including
clock-without-effect even if plain=true. This is ordered-strength E4, not equality.
At the Option wrapper level there is one additional None case:17 representable
finite strata vs11 legal if absence is included. Inventory counts the present
record owner as16/10; preserve wrapper absence and callback identity separately.
Shared remains independent and means outside OR uncertain, never just plain
plus effect. A plain-live mixed helper need not be shared under current policy.

## Public acceptance and API compatibility

The exported structural type currently permits callers to fabricate all16
combinations. That fact must be acknowledged; it is not proof those fabricate a
truthful result of this documented lexical callback lookup. More decisively,
no public function consumes an injected EffectVitestHarnessIndex: the sole
public detector entry1572-1588 accepts SourceFile/file/owner and builds its own
index, while DetectorState663-674 is private. Exhaustive repo references found
no other producer or exported harness-input parameter. Therefore this migration
changes an exported output TypeScript contract, not an accepted wire/input
schema. Preserve all AST/import inputs and all ten legitimate result meanings;
never insert a decoder silently rejecting arbitrary legacy user-created indexes.

External code reading flags or constructing mock indexes requires source
migration to the new result schema. State that breaking decoded API explicitly
in the implementation PR; do not claim source compatibility because the package
is private. Public path/factory/index member names remain. P3 must verify this
output-only evidence and that no new injected-index boundary appeared on main.
If such a boundary exists at implementation time, stop this owner's application
for compatibility design repair instead of restricting its input to producer
states. This does not authorize migration of unrelated public index functions.

## Target schema

Use an annotated LiteralKit named ReachableHelperMode with literals plain,
live, plain-live, test-clock, plain-test-clock. Use @beep/schema/LiteralKit
namespace import and no inline as const. Five payload-free exclusive cases need
no tagged union. Define a named callback schema via S.declare using
Node.isNode(value) && existing functionNode(value), annotations identifying an
already-constructed function-like AST node. S.declare preserves object identity;
do not serialize the AST or accept arbitrary JSON as a callback. Derive any
new guard from this schema, not a second ad-hoc predicate family.

Define annotated S.Class ReachableHelper with callback, mode:ReachableHelperMode,
shared:Boolean. Its Type is the return payload under Option. Keep the function-
bearing EffectVitestHarnessIndex contract; only replace its inline four-Boolean
return bag with the schema-derived ReachableHelper type. Re-export the new
runtime mode/model through the existing EffectVitest facade for public callers
to construct valid test doubles, with required JSDoc and module-local identity.
This is already parsed AST analysis, so no JSON codec or encoded migration is
added. No new package or shared foundation concept.

Expose schema-derived mode subset guards by S.Literals(kit.pickOptions(...)) and S.is for plain
containing modes, Effect-containing modes, and TestClock-containing modes.
Do not reconstruct or retain effect/testClock/plain as getters or stored fields.
One shared flag is independent and remains. Prefer annotated named subsets to
repeated string comparisons scattered through detectors.

## Migration inventory

1. Syntax629-636: return Option<ReachableHelper>; keep enclosingLayerBlock and
   enclosingTest contracts unchanged. Syntax1043-1056: retain node Option and
   no-test guard, derive one of five mode literals and shared exactly once on
   lookup, preserving callback identity. Source node without reachability still
   returns None; no synthetic mode for absence.
2. Stored FunctionReachability remains a separate migration. When applied after
   it, project from effectHarness none/live-only/test-clock plus plain into this
   five-case mode. When considering old source, the same projection follows
   plain/effect/testClock. Land stored owner first and this owner second in the
   same tooling batch, preserving each record's guard accounting. Reuse the
   existing schema concept machinery; do not export private vertex strength as
   a substitute for the distinct five-case output domain.
3. Syntax1138-1146 lazy cache remains a cached function, not cached per-node
   ReachableHelper values. EffectVitest.ts public type/function exports and
   Lint/index.ts20 carry the new schema/model exports with proper docs.
4. Detectors inspectContext681-717 retains helper acquisition/absence policy.
   detectRuntimeBoundary719-743 uses presence/shared and needs no mode change.
   scopeLifetimeClass820-832 replaces plain read with the plain-containing
   derived guard; keep shared OR plain policy and callback whole-body logic.
   detectScopeLifetime841 uses Effect-containing mode guard.
5. directWaitFunction1140-1158 keeps shared policy. detectClockWait1197 uses
   TestClock-containing guard (live alone must not trigger it).
   detectAppliedScope1367-1371 uses Effect-containing guard; direct enclosing
   test mode remains a distinct contract and is unchanged.
6. Update type/constructor examples and add public import tests. No existing
   test directly references reachableHelper/createEffectVitestHarnessIndex;
   existing detector tests cover behavior through the public entrypoint.

## Guard-deletion accounting

Remove three independently typed derived flags (effect/testClock/plain) from
this return model and its object projection. Replace their consumer tests with
named schema-derived mode membership. The no-test emission guard and outer
Option node gate are required partial-lookup semantics and remain; do not claim
them deleted. Retain shared and its source outside OR uncertain computation.
No second count for stored vertex removal: that belongs to FunctionReachability.
No runtime invariant rejection guard currently exists in this return model.

## Encoded-side impact

Tier1/internal exposure in inventory means no wire/persisted encoding, not no
public TypeScript surface. Retain finding/report encoded bytes and ordering;
only harness lookup output API changes. AST references are opaque and never
encoded. Do not add legacy flags to the canonical value to pretend the exported
shape stayed unchanged. Public acceptance concerns are addressed above.

## Test impact

Private check enumerates16 present-result tuples, confirms10 accepted and six
rejected, and checks all32 vertex projections:24 valid internal states yield
four non-emitted states and20 emitted preimages collapsing to10 distinct output
tuples. Preserve all subset predicates and callback/shared meaning. None adds
one wrapper state. This is mathematical design proof, not implementation tests.

After GATE2 construct all five modes with shared both ways through the new
schema, test invalid literals fail, and check function callback identity and
rejection of nonfunction nodes. Public harness fixture cases: plain-only,
live-only, clock-only, mixed plain/live, mixed plain/clock and live/clock; each
with known exclusive versus outside/uncertain shared callers. Include uncalled
helper None, module-only None, transitive/cyclic/shadowed references and layer
callbacks. Compare complete public detector findings before/after: EV008 absent
for live-only, EV004 retains both live and clock reachability, mixed plain
continues scope judgment even when shared=false, shared uncertainty remains.

Run CLI owning package check/tests, package-verify @beep/repo-cli, applicable
schema-first lint and docgen:local for new exports; regenerate schema catalog
only if a pre-existing identity moves. Require independent P3 on exposed API
and distinct-owner accounting before implementation.

## Risk

The main risk is treating public structural fabrication as a decoded input
contract or pretending the output shape is source-compatible. A second risk is
conflating mixed plain/Effect callers with shared=true; current shared means
outside OR uncertain. Five explicit modes preserve both live-only and mixed
plain distinctions without turning this view into stored graph state.


## R39 source and test reconciliation (authoritative current map)

Bound to HEAD `220d9426dad4b708807b6297cb71d75449288749`. This appendix supersedes older numeric
locations for the files listed here; it preserves earlier design semantics and
immutable historical evidence. It grants no blanket P3, implementation or dry credit.

Complete Syntax source byte-identical to f97a89bd design binding. Retain 16/10 present-result domain, five nonempty modes times independent shared, callback identity and None for no reachable test. Current Effect/Crypto detector boundary and its error behavior remain supported; no synchronous scanner assumption.

### Current named test locations

- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:81` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:82` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:86` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:87` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:92` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:94` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:98` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:99` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:103` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:104` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:108` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:109` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:113` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:114` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:118` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:119` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:123` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:124` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:128` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:129` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:144` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:145` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:149` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:151` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:156` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:157` — unshared
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:173` — tracks named Effect and Layer aliases without mistaking lexical shadows
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:177` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:177` — y
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:183` — y
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:188` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:193` — tracks the root Effect namespace and respects hoisted function shadows
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:196` — namespace
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:199` — hoisted
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:204` — emits equivalent findings for the instrumented tester runtime, scope, and TestClock boundaries
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:212` — recognizes every public instrumented it form through existing tester provenance
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:218` — direct
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:236` — namespace
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:246` — clock
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:252` — does not promote unrelated test-utils modules or non-tester Vitest exports
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:280` — preserves shadowing for direct, renamed, and namespace instrumented imports
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:295` — shadowed
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:303` — does not classify live sleep as a TestClock hang
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:305` — sleep
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:306` — sleep
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:310` — recognizes a locally constructed Context provision
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:314` — context
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:321` — keeps property members when an unrelated import uses the same local name
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:325` — property
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:332` — reads the expected literal of a node:assert equality over a data shape
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:336` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:343` — resolves an acquire-release provision instead of routing it to judgment
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:345` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:351` — recognizes const-arrow and Effect.fnUntraced resource wrapper definitions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:355` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:361` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:368` — inspects Option, Result, and Exit values supplied as matcher arguments
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:370` — o
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:371` — r
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:372` — e
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:376` — reads truthiness matchers as the polarity of the asserted data shape
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:378` — t
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:379` — f
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:383` — keeps shorter scoped lifetimes as judgments
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:386` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:395` — keeps missing resource-layer timeouts as judgments
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:398` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:406` — emits deterministic distinct identities for same-line occurrences
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:408` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:417` — recognizes standalone public harness exports, aliases, modifiers and nested layer testers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:439` — does not promote shadowed standalone exports, layer testers or Vitest-only lookalikes
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:449` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:458` — captures public allocating providers in fnUntraced composition while retaining pure stubs
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:462` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:467` — stub
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:471` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:474` — unknown
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:481` — captures same-file layer-building wrappers without requiring a with prefix
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:486` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:490` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:494` — judges imported and unknown layer constructors but permits proven pure compositions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:526` — limits withLive exemption to the wrapped wait and preserves cancellation uncertainty
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:528` — live
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:531` — live
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:537` — stall
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:542` — stall
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:547` — controlled
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:551` — count
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:555` — reviews fnUntraced live registrations without treating sleep as proof of necessity
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:561` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:565` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:572` — recognizes platform subpaths and CommonJS filesystem use with lexical require shadows
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:587` — tracks yielded results to nested assertion arguments through exact lexical bindings
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:591` — result
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:597` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:603` — unasserted
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:610` — recognizes public boolean assertions while preserving aliases, shadows and specialized helpers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:613` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:614` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:615` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:616` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:621` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:627` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:634` — keeps piped fork cancellation as judgment without hiding a subsequent direct wait
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:637` — cancel
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:644` — recognizes namespace tmpdir imports and CommonJS controls without accepting shadowed receivers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:647` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:648` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:649` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:650` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:653` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:656` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:661` — retains root namespace provenance for boolean assertions and live clock wrappers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:665` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:671` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:677` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:684` — does not assign allocating-provider findings to local pure layer builds or unrelated imported helpers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:690` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:696` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:701` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:707` — attributes same-file runtime and property helpers once through transitive callers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:717` — first
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:717` — second
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:726` — respects same-file helper binding shadows, unused definitions and imported runtime aliases
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:730` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:734` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:737` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:743` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:747` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:751` — terminates on reachable and dead same-file call cycles without multiplying findings
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:758` — cycle
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:765` — keeps module-only helpers out of test findings and mixed callers as judgments
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:769` — other
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:772` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:779` — never declares helper scopes redundant from reachability or repeated calls alone
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:782` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:791` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:800` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:801` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:801` — effect
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:806` — retains deliberate inner helper scopes and the existing direct whole-body distinction
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:813` — uses captured
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:814` — direct whole
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:834` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:841` — recognizes registered helper callbacks and keeps escaped or uncertain callback uses as judgments
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:844` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:847` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:853` — does not treat type-only references or object keys as non-test helper callers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:856` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:860` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:866` — compares lexical declarations by identity without opening semantic compiler getters
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:875` — outcome
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:903` — keeps cached lexical scopes isolated across files and fresh passes after edits
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:908` — scopes
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:918` — scopes
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:960` — preserves role spans and order through nested callbacks, shadows, JSX and parser recovery
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:973` — nested
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1030` — keeps shared scope-name results equal to fresh resolution in either reference order
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1067` — detects native Arbitrary checks through public barrel, subpath and named aliases
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1082` — barrel
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1088` — native
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1095` — keeps native property checks lexical and excludes canonical registrations and sampling
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1098` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1099` — other
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1100` — sample
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1101` — canonical
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1107` — retains native property helper reachability, shared judgment and callback execution
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1112` — first
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1112` — second
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1122` — test
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1133` — callback
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1138` — distinguishes deferred service waits from directly executed and uncertain helper waits
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1142` — provided
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1151` — unrelated
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1156` — sequential
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1161` — direct helper
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1166` — immediate
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1171` — external direct
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1176` — uncertain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1191` — retains live-only helper semantics and visible mixed clock ownership
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1195` — live
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1200` — live
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1201` — virtual
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1218` — uses exact utils Option wrapper provenance without classifying projected plain payloads
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1221` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1222` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1223` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1227` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1228` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1229` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1230` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1231` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1237` — narrows root platform and CommonJS imports to filesystem provenance and explicit opaque residue
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1258` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1278` — indexes for-of and for-in retry candidates with explicit loop presence and ordinary loop negatives
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1285` — loops
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1308` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1315` — retains shared deterministic clock review for nested single-test and reset/concurrent layers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1318` — timeout
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1338` — routes data assertions by family, polarity and supplied operands without inventing payloads
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1359` — route
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1367` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1371` — distinguishes unknown codec module mocks from binding-proven local service candidates
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1402` — retains CommonJS tmpdir aliases without matching declaration text or shadows
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1405` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1409` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1525` — residue
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1607` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1611` — keeps direct and compound tagged assertions visible without entering unrelated callbacks
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1621` — compound
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1632` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1656` — tagged
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1688` — predicate
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1711` — outcome
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1750` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1757` — requires exact provenance for computed transforms, pipe predicates and Array facades
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1760` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1761` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1762` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1766` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1767` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1768` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1769` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1770` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1771` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1772` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1773` — unknown
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1780` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1781` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1782` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1783` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1795` — reader
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1796` — tail
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1797` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1798` — shared
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1811` — hoisted
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1812` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1813` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1814` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1823` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1824` — pipe
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1825` — call
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1826` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1840` — preserves pure, unknown, shadowed and unused provider-result distinctions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1846` — stub
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1853` — opaque
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1862` — unused
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1863` — mutable
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1864` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1865` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1871` — distinguishes nested resource, pure-stub and opaque layer provisions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1875` — nested
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1885` — stub
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1890` — opaque
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1901` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1902` — success Boolean
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1903` — unknown
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1916` — known success
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1917` — known failure
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1918` — mixed
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1929` — does not invent result migration for an unexecuted unasserted effect or a shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1932` — unused
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1934` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1938` — retains inner helper pipe scopes and ambiguous generator-return lifetimes as judgment
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1942` — helper
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1951` — returned value
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1952` — opaque body
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1965` — does not infer tagged return values across a plain or incomplete boundary: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1994` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2002` — requires exact provenance for computed transforms, pipe predicates and Array facades
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2005` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2006` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2007` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2011` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2012` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2013` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2014` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2015` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2016` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2017` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2018` — unknown
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2024` — recognizes final whole-body scope application: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2027` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2028` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2029` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2030` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2041` — retains shorter or uncertain scope ownership: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2044` — reader
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2045` — tail
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2046` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2047` — shared
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2059` — does not invent applied test scopes: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2062` — hoisted
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2063` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2064` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2065` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2073` — retains applied immutable provider provenance: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2076` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2077` — pipe
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2078` — call
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2079` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2093` — preserves pure, unknown, shadowed and unused provider-result distinctions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2099` — stub
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2106` — opaque
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2115` — unused
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2116` — mutable
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2117` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2118` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2124` — distinguishes nested resource, pure-stub and opaque layer provisions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2128` — nested
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2138` — stub
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2143` — opaque
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2153` — keeps result migration neutral without inventing expected values: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2156` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2157` — success Boolean
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2158` — unknown
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2170` — keeps Result operands intact while requiring Exit migration review: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2173` — known success
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2174` — known failure
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2175` — mixed
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2186` — does not invent result migration for an unexecuted unasserted effect or a shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2189` — unused
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2191` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2195` — retains inner helper pipe scopes and ambiguous generator-return lifetimes as judgment
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2199` — helper
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2208` — returned value
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2209` — opaque body
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2220` — preserves instrumented tester provenance for the test-runner modules
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2226` — clock
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2234` — namespace

The private review also supplies source-location-maps.json with exact unchanged
line blocks and explicit changed blocks, plus symbol-locations.json/test-locations.json.
Use named sites for implementation; never apply a uniform offset across changed code.
No tests were executed for this read-only reconciliation.
