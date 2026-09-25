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


## R39 source and test reconciliation (authoritative current map)

Bound to HEAD `220d9426dad4b708807b6297cb71d75449288749`. This appendix supersedes older numeric
locations for the files listed here; it preserves earlier design semantics and
immutable historical evidence. It grants no blanket P3, implementation or dry credit.

Complete Syntax source byte-identical to f97a89bd design binding. Retain 32/24 and monotone join: testClock implies effect, not equality. plain/outside/uncertain remain independent. Current detector boundary is Effect-based with Crypto requirement and occurrence-error mapping; preserve current stable-ID anchoring and ordered findings while migrating the graph.

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
