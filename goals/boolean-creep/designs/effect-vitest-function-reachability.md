# effect-vitest-function-reachability

P2 source f97a89bdfdc5bc71b69aab09b8d425591698d42a, 2026-09-24.
Corrects the R32 raw proposal's 32/16 count and unsafe Boolean collapse.
Independent P3 and GATE2 remain required before implementation.

## Current shape

EffectVitestSyntax.ts842-850 declares a private mutable AST graph vertex with
node Option, cyclic callees Array and five stored Boolean reachability facts:
plain, effect, testClock, outside, uncertain. Initial vertex872-880 is all false;
module882 sets outside true. initializeVertex891-894 seeds plain for plain,
effect for effect OR live, testClock only for effect, outside for layer.
Registration-reference writes985-987 apply exactly the same effect/live split.
Literal callback handling973 seeds uncertainty for unknown callback APIs and
adds a call edge974. Exported bindings916 and escaping references1005 independently
set outside. Propagation1027-1031 ORs all five facts until fixed point.

The actual relation is testClock implies effect, NOT equality. Live-only
registration explicitly produces effect=true,testClock=false at892-893 and
986-987. Collapsing both to one Boolean introduces false EV008 TestClock hang
findings for live-only helpers. E4 is directly supported by the ordered
reachability strength and addsReachability854-856's documented invariant.

## Cardinality gap

| effect | testClock | Supported | Semantic state |
| --- | --- | --- | --- |
| false | false | yes | none |
| true | false | yes | live-only |
| true | true | yes | test-clock |
| false | true | no | invalid stronger fact without weaker fact |

Three supported pair states multiplied by all eight combinations of independent
plain/outside/uncertain yields **32 representable /24 legal**, eight rejected.
This audits the complete five-Boolean owner. Do not constrain outside or
uncertain based on absence of a single fixture; their independent writes and
monotone OR propagation preserve all combinations. Do not merge plain into this
chain: plain and Effect harness callers can both reach one function.

This is a private analysis state built inside helperReachability, not a public
input contract accepting arbitrary bit records. The domain proof is from all
constructors and every transition, not narrowing an exported schema solely to
currently observed producer states. Public source-file/import inputs stay intact.

## Target schema

Use private annotated LiteralKit(["none", "live-only", "test-clock"]) named
EffectHarnessReachability, with schema-derived Type and kit guards/matcher.
Import the concept namespace from @beep/schema/LiteralKit; no inline as const.
Retain mutable FunctionReachability node, callees, plain, outside, uncertain;
replace effect and testClock with one mutable effectHarness value. The wrapper
remains private cyclic AST analysis state, not a serializable exported domain
model; do not force ts-morph instances/cyclic worklists through JSON schemas.
No new public export, shared package, tagged union or Option is needed for the
three payload-free literal states. Add identity composer for this module's
new annotated schema per $RepoCliId convention; no existing identity moves.

Strength join is exactly:

| From / To | none | live-only | test-clock |
| --- | --- | --- | --- |
| none | none | live-only | test-clock |
| live-only | live-only | live-only | test-clock |
| test-clock | test-clock | test-clock | test-clock |

Use kit.$match for the pure join and derived kit guards. Keep a single named
join in this existing owner module, after defining the schema. No numeric rank
casts or independent pair of stored flags. The term live-only describes absence
of test-clock reachability, not exclusive ownership; plain/outside/uncertain
remain available and a mixed live+effect helper becomes test-clock as before.

## Migration inventory

- Vertex872-880 initializes effectHarness=none; module outside seed882 unchanged.
- initializeVertex888-896 maps effect to test-clock, live to live-only,
  plain/layer/missing to none, preserving independent plain/outside seeds and
  option behavior. Do not change modeFromMembers1082-1087 precedence or first
  registration semantics1088-1098.
- connectRegistrationArgument978-992 joins test-clock/live-only for those modes;
  plain changes only plain. Layer/unknown arguments still set uncertain and add
  owner edges. Do not overwrite prior stronger reachability during registration.
- addsReachability852-858 compares the joined effectHarness with target and
  retains exact plain/outside/uncertain change checks. Compute join once per
  edge update or in the predicate using an allocation-free scalar literal;
  no per-edge object/flag-list allocation on this hot path.
- propagateReachability1025-1034 joins effectHarness and ORs other three bits,
  queueing exactly when any fact increases. Preserve mutable vertex identity,
  cyclic graph edges, worklist ordering, repeated edges and convergence.
- Lookup1043-1056 keeps its node Option gate and plain-or-effect reachability
  gate. Derive effect as non-none and testClock as test-clock when projecting
  the EXISTING reachableHelper contract; plain passes through and shared
  remains outside OR uncertain. This is the bounded compatibility boundary,
  not a second stored copy of the invalid state space. Coordinate the separate
  reachableHelper owner later; this change neither claims nor performs it.
- Other direct owner uses are local maps884-885, owner898-904 and binding/edge
  helpers905-1019; preserve references rather than clone graph vertices.
- createEffectVitestHarnessIndex1138-1146 lazy helper cache and lexical lookup
  remain unchanged. No mutable internal vertex is exposed to callers.

## Consumers and boundaries

EffectVitestHarnessIndex629-636's reachableHelper result remains structurally
unchanged for this owner. Consumer preservation is substantive:
inspectContext693 collects helpers for runtime/scoped/property checks;
detectRuntimeBoundary730-743 uses presence/shared for EV001;
scopeLifetimeClass824-831 uses plain/shared and callback shape for scope
judgment; detectScopeLifetime841 uses effect for EV004;
directWaitFunction1148-1153 refuses proof for shared helpers;
detectClockWait1197-1198 uses testClock for EV008; detectAppliedScope1370-1371
uses effect for EV004. Existing detector behavior must remain byte-identical
where reports encode findings. No finding/report codec or exposed acceptance
shape is intentionally changed; private storage is Tier1/internal.

No direct production owner consumer exists outside EffectVitestSyntax.ts;
graft exhaustive FunctionReachability/testClock plus reachableHelper searches
covered syntax and detector boundaries. Recheck after moving main.

## Guard-deletion accounting

Remove two independent mutable Boolean slots and their duplicate initialization,
registration and propagation writes. Replace addsReachability's stronger-bit
conditional856 and coherence comment854-855 with scalar join/change detection.
The monotone graph convergence guard itself remains necessary, as do independent
plain/outside/uncertain checks. Neither those nor lexical-binding guards count
as redundant invariant deletions. No runtime rejection guard exists to delete.
Project the legacy helper flags once at lookup; no compatibility getters or
post-decode coherence repair inside graph state.

## Encoded-side impact

No vertex serialization or persisted/wire boundary exists. Keep exposed helper
projection and all lint finding classes, severities, evidence and ordering.
This owner does not authorize narrowing public EffectVitestHarnessIndex values
that callers can construct. Separate reachableHelper design owns that contract.

## Test impact

Private finite check enumerates32 projections and all576 ordered pairs of
supported full vertices, proving projected join equals five-bit OR and changed
predicate equals existing addsReachability. Also proves seed mappings and
three-state join associativity/idempotence/commutativity. This is arithmetic
model proof only; no production code or runtime Schema proof claimed.

After GATE2 add focused public harness-index/detector fixtures for live-only
helper(effect=true,testClock=false), effect helper(true,true), mixed plain/live,
mixed live/effect, transitive and recursive calls, exported and escaping helpers,
unknown callbacks, layer registration, uncalled helpers, shadowed names and
shared module/test calls. Check EV008 absent for live-only sleeps while EV004
still considers effect reachability; mixed live/effect preserves EV008 behavior.
Verify exact finding count/order and shared judgment classifications against
existing effect-vitest-detectors.test.ts707-802 and live-mode303-306 cases.
Check repeat lookup uses the same lazy analysis behavior.

Run owning CLI package check/tests and full package-verify @beep/repo-cli after
code edits, schema-first lint where covered; docgen:local only if exports change.
No catalog identity migration is intended. Then campaign and Yeet gates apply.

## Risk

Raw proposal equality is disproven by two explicit live seed paths. Preserve
both paths and the strict distinction through all graph joins. Treat join as a
reachability strength, never a claim a helper belongs exclusively to one test.
Main can move the graph logic; source bindings are essential before application.
