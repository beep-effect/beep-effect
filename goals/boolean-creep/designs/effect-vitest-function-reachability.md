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
