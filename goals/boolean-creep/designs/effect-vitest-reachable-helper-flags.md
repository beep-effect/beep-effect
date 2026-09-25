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
