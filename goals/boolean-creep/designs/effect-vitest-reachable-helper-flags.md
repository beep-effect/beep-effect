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
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:199` — tracks named Effect and Layer aliases without mistaking lexical shadows
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:203` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:203` — y
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:209` — y
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:214` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:219` — tracks the root Effect namespace and respects hoisted function shadows
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:222` — namespace
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:225` — hoisted
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:230` — emits equivalent findings for the instrumented tester runtime, scope, and TestClock boundaries
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:238` — recognizes every public instrumented it form through existing tester provenance
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:244` — direct
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:262` — namespace
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:272` — clock
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:278` — does not promote unrelated test-utils modules or non-tester Vitest exports
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:306` — preserves shadowing for direct, renamed, and namespace instrumented imports
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:321` — shadowed
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:329` — does not classify live sleep as a TestClock hang
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:331` — sleep
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:332` — sleep
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:336` — recognizes a locally constructed Context provision
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:340` — context
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:347` — keeps property members when an unrelated import uses the same local name
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:351` — property
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:358` — reads the expected literal of a node:assert equality over a data shape
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:362` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:369` — resolves an acquire-release provision instead of routing it to judgment
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:371` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:377` — recognizes const-arrow and Effect.fnUntraced resource wrapper definitions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:381` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:387` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:394` — inspects Option, Result, and Exit values supplied as matcher arguments
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:396` — o
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:397` — r
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:398` — e
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:402` — reads truthiness matchers as the polarity of the asserted data shape
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:404` — t
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:405` — f
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:409` — keeps shorter scoped lifetimes as judgments
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:412` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:421` — keeps missing resource-layer timeouts as judgments
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:424` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:432` — emits deterministic distinct identities for same-line occurrences
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:434` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:443` — recognizes standalone public harness exports, aliases, modifiers and nested layer testers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:465` — does not promote shadowed standalone exports, layer testers or Vitest-only lookalikes
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:475` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:484` — captures public allocating providers in fnUntraced composition while retaining pure stubs
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:488` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:493` — stub
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:497` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:500` — unknown
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:507` — captures same-file layer-building wrappers without requiring a with prefix
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:512` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:516` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:520` — judges imported and unknown layer constructors but permits proven pure compositions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:552` — limits withLive exemption to the wrapped wait and preserves cancellation uncertainty
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:554` — live
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:557` — live
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:563` — stall
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:568` — stall
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:573` — controlled
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:577` — count
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:581` — reviews fnUntraced live registrations without treating sleep as proof of necessity
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:587` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:591` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:598` — recognizes platform subpaths and CommonJS filesystem use with lexical require shadows
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:613` — tracks yielded results to nested assertion arguments through exact lexical bindings
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:617` — result
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:623` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:629` — unasserted
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:636` — recognizes public boolean assertions while preserving aliases, shadows and specialized helpers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:639` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:640` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:644` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:645` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:650` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:656` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:663` — keeps piped fork cancellation as judgment without hiding a subsequent direct wait
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:666` — cancel
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:673` — recognizes namespace tmpdir imports and CommonJS controls without accepting shadowed receivers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:676` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:677` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:678` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:679` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:682` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:685` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:690` — retains root namespace provenance for boolean assertions and live clock wrappers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:694` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:700` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:706` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:714` — does not assign allocating-provider findings to local pure layer builds or unrelated imported helpers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:719` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:725` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:730` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:736` — attributes same-file runtime and property helpers once through transitive callers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:746` — first
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:746` — second
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:755` — respects same-file helper binding shadows, unused definitions and imported runtime aliases
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:759` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:763` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:766` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:772` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:776` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:780` — terminates on reachable and dead same-file call cycles without multiplying findings
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:787` — cycle
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:794` — keeps module-only helpers out of test findings and mixed callers as judgments
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:798` — other
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:801` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:808` — never declares helper scopes redundant from reachability or repeated calls alone
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:811` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:820` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:829` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:830` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:830` — effect
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:835` — retains deliberate inner helper scopes and the existing direct whole-body distinction
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:842` — uses captured
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:843` — direct whole
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:863` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:870` — recognizes registered helper callbacks and keeps escaped or uncertain callback uses as judgments
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:873` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:876` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:882` — does not treat type-only references or object keys as non-test helper callers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:885` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:889` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:895` — compares lexical declarations by identity without opening semantic compiler getters
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:904` — outcome
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:932` — keeps cached lexical scopes isolated across files and fresh passes after edits
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:937` — scopes
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:947` — scopes
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:989` — preserves role spans and order through nested callbacks, shadows, JSX and parser recovery
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1002` — nested
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1059` — keeps shared scope-name results equal to fresh resolution in either reference order
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1096` — detects native Arbitrary checks through public barrel, subpath and named aliases
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1111` — barrel
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1117` — native
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1124` — keeps native property checks lexical and excludes canonical registrations and sampling
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1127` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1128` — other
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1129` — sample
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1130` — canonical
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1136` — retains native property helper reachability, shared judgment and callback execution
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1141` — first
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1141` — second
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1151` — test
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1162` — callback
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1167` — distinguishes deferred service waits from directly executed and uncertain helper waits
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1171` — provided
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1180` — unrelated
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1185` — sequential
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1199` — direct helper
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1204` — immediate
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1209` — external direct
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1214` — uncertain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1229` — retains live-only helper semantics and visible mixed clock ownership
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1233` — live
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1238` — live
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1239` — virtual
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1256` — uses exact utils Option wrapper provenance without classifying projected plain payloads
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1259` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1260` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1261` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1265` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1266` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1267` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1268` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1269` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1275` — narrows root platform and CommonJS imports to filesystem provenance and explicit opaque residue
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1296` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1316` — indexes for-of and for-in retry candidates with explicit loop presence and ordinary loop negatives
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1323` — loops
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1346` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1353` — retains shared deterministic clock review for nested single-test and reset/concurrent layers
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1356` — timeout
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1376` — routes data assertions by family, polarity and supplied operands without inventing payloads
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1397` — route
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1405` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1409` — distinguishes unknown codec module mocks from binding-proven local service candidates
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1440` — retains CommonJS tmpdir aliases without matching declaration text or shadows
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1443` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1447` — x
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1563` — residue
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1647` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1651` — keeps direct and compound tagged assertions visible without entering unrelated callbacks
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1661` — compound
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1672` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1696` — tagged
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1728` — predicate
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1751` — outcome
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1790` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1797` — requires exact provenance for computed transforms, pipe predicates and Array facades
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1800` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1801` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1802` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1806` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1807` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1808` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1809` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1810` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1811` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1812` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1813` — unknown
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1820` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1821` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1822` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1823` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1835` — reader
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1836` — tail
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1837` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1838` — shared
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1851` — hoisted
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1852` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1853` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1854` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1863` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1864` — pipe
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1865` — call
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1866` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1880` — preserves pure, unknown, shadowed and unused provider-result distinctions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1886` — stub
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1893` — opaque
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1902` — unused
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1903` — mutable
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1904` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1905` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1911` — distinguishes nested resource, pure-stub and opaque layer provisions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1915` — nested
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1925` — stub
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1930` — opaque
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1941` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1942` — success Boolean
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1943` — unknown
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1956` — known success
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1957` — known failure
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1958` — mixed
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1969` — does not invent result migration for an unexecuted unasserted effect or a shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1972` — unused
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1974` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1978` — retains inner helper pipe scopes and ambiguous generator-return lifetimes as judgment
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1982` — helper
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1991` — returned value
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:1992` — opaque body
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2005` — does not infer tagged return values across a plain or incomplete boundary: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2034` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2042` — requires exact provenance for computed transforms, pipe predicates and Array facades
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2045` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2046` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2047` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2051` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2052` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2053` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2054` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2055` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2056` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2057` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2058` — unknown
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2064` — recognizes final whole-body scope application: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2067` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2068` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2069` — health
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2070` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2081` — retains shorter or uncertain scope ownership: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2084` — reader
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2085` — tail
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2086` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2087` — shared
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2099` — does not invent applied test scopes: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2102` — hoisted
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2103` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2104` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2105` — plain
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2113` — retains applied immutable provider provenance: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2116` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2117` — pipe
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2118` — call
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2119` — alias
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2133` — preserves pure, unknown, shadowed and unused provider-result distinctions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2139` — stub
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2146` — opaque
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2155` — unused
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2156` — mutable
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2157` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2158` — fake
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2164` — distinguishes nested resource, pure-stub and opaque layer provisions
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2168` — nested
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2178` — stub
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2183` — opaque
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2193` — keeps result migration neutral without inventing expected values: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2196` — tika
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2197` — success Boolean
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2198` — unknown
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2210` — keeps Result operands intact while requiring Exit migration review: (each)
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2213` — known success
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2214` — known failure
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2215` — mixed
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2226` — does not invent result migration for an unexecuted unasserted effect or a shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2229` — unused
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2231` — shadow
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2235` — retains inner helper pipe scopes and ambiguous generator-return lifetimes as judgment
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2239` — helper
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2248` — returned value
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2249` — opaque body
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2260` — preserves instrumented tester provenance for the test-runner modules
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2266` — clock
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:2274` — namespace

The private review also supplies source-location-maps.json with exact unchanged
line blocks and explicit changed blocks, plus symbol-locations.json/test-locations.json.
Use named sites for implementation; never apply a uniform offset across changed code.
No tests were executed for this read-only reconciliation.
