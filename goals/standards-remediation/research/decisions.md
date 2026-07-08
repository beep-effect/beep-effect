# Locked rulings — standards-remediation

Rulings are locked once the driver has personally verified the evidence
(SPEC D-C). Do not reopen without new evidence; record the new evidence here.

## R1 — dual-arity D1: static-property schema-codec exclusion (LOCKED, driver-verified 2026-07-07)

`DualArity.ts` applies `isNonHelperCallableValue` in the exported-const path
(`:964`) but never in `collectStaticPropertyCandidate` (`:1068-1134`) — the
driver read both paths directly. Schema-class codec statics
(`static decodeUnknownEffect = S.decodeUnknownEffect(this)` etc.) are flagged
only through this inconsistency; EF-18 scopes the dual law to reusable helper
combinators, which schema-derived codecs are not. **Ruling: detector bug.
Fix in P1** (apply the exclusion in the static path; widen
`SCHEMA_CALLABLE_VALUE_FACTORY_PATTERN` with Sync/Exit/Promise variants);
fixture pair mandatory. Expected prune ≈ 59 candidates.

## R2 — jsdoc J1: @example required on barrel re-exports (LOCKED, driver-verified 2026-07-07)

Driver-run count over the live inventory: 1,215 direct-export vs 797
re-export missing-@example findings. `.patterns/jsdoc-documentation.md:91-96`
states re-export declarations are graph edges — "do not add fake examples to a
barrel just to satisfy quality tooling." **Ruling: detector bug. Fix in P1**
(stop requiring `@example` on re-export declarations; keep `@category`/`@since`
behavior unchanged — measured misses there are already 0); fixture pair
mandatory. Expected prune ≈ 797 findings.

## R3 — three more detector bugs (LOCKED, driver-verified 2026-07-07)

- **D2 (LOCKED)**: `collectCandidateDiagnostics` emits
  `third-param-not-object-like` unconditionally for every 3-param candidate
  (`DualArity.ts:852-854`) — including properly-dual combinators. Driver read
  `GraphOps.bimap` (`packages/foundation/modeling/nlp/src/Graph/GraphOps.ts:266-279`):
  a textbook `dual(3, ...)` with both call signatures, flagged solely for its
  callable 3rd param — the `A.reduce(self, b, f)` shape Effect core itself
  uses. **Ruling: exempt the diagnostic only when the candidate has a VALID
  dual (`validSource` + matching arity) AND the 3rd param type is callable.**
  Primitive 3rd params stay flagged even on duals. 13 solo entries affected.
- **J2 (LOCKED)**: `parseTopoSortOutput` (`QualityArtifactSupport.ts:456-469`)
  takes the first whitespace token of every non-`$` line, so section lines like
  `dependencies:` become phantom packages (4 in the live inventory). **Ruling:
  intersect parsed names with discovered workspace package names.**
- **J3 (LOCKED)**: `unsafeExampleViolations`
  (`JSDocDocumentationInventory.ts:351-387`) strips only lines *starting with*
  `import ` (`:357`) before running the `as`-assertion regex (`:377`), so
  continuation lines of multi-line imports (`type X as Y,`) false-positive
  `no-type-assertions-in-examples`. Confirmed instance:
  `packages/architecture-lab/ui/src/aggregates/WorkItem/WorkItem.view-model.ts:80`.
  **Ruling: strip complete (multi-line) import statements before the regexes.**

## R4 — crispening policy family gap (LOCKED, driver-verified 2026-07-07)

`SCHEMA_CRISPENING_FAMILY_PREFIXES` (`SchemaFirst.ts:634-644`) omits
`packages/shared/**` and `infra/**`; the doc comment (`:646-660`) calls them
"unassigned until their P1 wave assignment lands" — that assignment never
landed after crispening closed. Unassigned ⇒ `resolveSchemaCrispeningPolicyBlocking`
falls to `false` (`:682`) ⇒ carded advisories in those paths are exempt
(`isSchemaCrispeningPolicyExempt:705-718`) while the scan scope includes them.
**Ruling: assign `packages/shared/` → `apps-slices` and `infra/` → `tooling`
(both families blocking), update the doc comment, and replace the
unassigned-exempt test with assigned-not-exempt coverage.**

## R5 — jsdoc re-export exemption scope (LOCKED with R2)

Per the policy prose, re-export declarations are graph edges: exempt them from
ALL `requiredExportTags` (not only `@example`); measured `@category`/`@since`
misses on re-exports are already 0, so the observable delta is the 797
`@example` findings. Fixture: direct export still fires; re-export silent.

## R6 — schema-first S1-generic cluster (LOCKED, driver-verified 2026-07-08)

Audit lane p2-s1 attempted four real conversions (report:
`ops/reports/P2-audits/p2-s1-generic.md`); driver re-verified the two
load-bearing claims directly: `.repos/effect-v4/packages/effect/src/Schema.ts`
contains exactly 42 `extends declareConstructor|decodeTo` interfaces, and
`MutableHashMapFromSelf` (`packages/foundation/modeling/schema/src/MutableHashMap.ts:101`)
is that exact idiom (`extends S.declareConstructor<...>` + `Rebuild: this`).

Sub-family rulings:
1. **Schema-infrastructure generics** (extends `S.declareConstructor` /
   `S.decodeTo` / `S.Bottom` / `VariantSchema.Field` + `Rebuild: this`;
   ~55-60 of 73, mostly @beep/schema): these ARE schema-combinator types —
   the named interface is structurally required (`S.make<T>()` cannot infer
   `T`; deletion ⇒ TS2339 ×2). **Detector exemption AUTHORIZED** with the
   lane's fixture pair (still-fires: `Box<A> { value: A }`; newly-excluded:
   `FooFromSelf<K> extends S.declareConstructor + Rebuild: this`).
2. **All-function-member generics** (`SegmentStrategy`, `Composable`,
   `Foldable`, `Functor`, factory call-signature types; ~10-15): §5.3 is
   unsatisfiable for behavior records (`S.toArbitrary` throws Unsupported AST
   Declaration; `encodeSync` drops function payloads to `{}`). **Detector
   exemption AUTHORIZED** (newly-excluded: all-function-member generic;
   still-fires: any generic with a data-typed field).
3. **Categorical data generics with free params** (`GraphNode<A>`,
   `EffectGraph<A>`, `OperationResult`, `StoredResult` + @beep/nlp siblings,
   ~18): naive `A extends S.Top` cascades 64 errors / 5 files — but these are
   Box-shaped pure data, exactly the shape the still-fires fixture protects.
   **NOT exempted. P4 pilot lane** gets full-package refactor authority
   (schema-factory + typeclass-over-Type redesign) on the GraphNode family;
   only if that verified-fails does a narrow driver-authored carve-out follow.

## R7 — schema-first S3-extends cluster (LOCKED, driver-verified 2026-07-08)

Driver read `detectInterfaceReason` (`SchemaFirst.ts:755-766`) directly: the
extends branch (`:759-761`) unconditionally short-circuits before the
member-safety check (`:762`) that non-extends interfaces get. Lane p2-s3's
three compile-tested attempts (report: `ops/reports/P2-audits/p2-s3-extends.md`)
hold: S.Class+S.declare wedges are §5.3-hollow; Effect's own named-interface
dual-binding idiom breaks on deletion; `S.extend` does not exist in v4.
**Detector fix AUTHORIZED**: resolve extends targets; if any target resolves
to an external module (node_modules/lib) → silent skip; otherwise compose
own+inherited members and defer to `typeLiteralMembersUnsafe` (same path as
non-extends interfaces). Expected: ~40 external-extends silent; ~17 reclassify
into the S2 signals bucket (fate rides on R-S2); repo-local pure-data derived
interfaces surface as CANDIDATES. **Sequencing rule: since candidates fail the
gate even in --write mode, the detector commit and the conversions of surfaced
candidates must land in the same push (separate commits, fence 11).**
Fixture pair: newly-excluded — Props interface extending React/external types
silent; still-fires — repo-local extends composing pure-data members surfaces
a candidate; reclassify — repo-local extends with function members lands in
the signals classification.

## R8 — jsdoc J5 @beep/html generator (LOCKED, driver-accepted 2026-07-08)

Generator: `packages/foundation/modeling/html/scripts/generate.ts`; regen
`bun run generate` (byte-deterministic, lane-verified `git diff --exit-code`
clean; `bun run generate:check` is the proof gate). 304/331 of the package's
missing-@example findings are template-fixable: kind-driven `.make()` example
per element class (`normal`→children:[], `void`→{}, `rawText`→content:""),
`Encoded`-literal example per companion namespace (precedent:
`packages/shared/domain/src/values/Rule/Rule.model.ts:69-84`), representative-
member example per category union, `HtmlCategory` idiom for Html.meta.ts, and
the `export type HtmlChildren = typeof HtmlChildren.Type` alias (compile-
tested in place, reverted). **Generator-template lane AUTHORIZED (JD-4a)**;
remaining 27 findings in Html.attributes.ts/Html.nodes.ts are ordinary
hand-fixes (JD-4b, same package, sequential). Proof: `bun run generate:check`
+ `turbo run docgen --filter=@beep/html`.

## R9 — jsdoc namespaced-barrel scan blind spot (OPEN, driver investigation)

Lane p2-j5 found `export * as Foo from "./x.ts"` barrels hide inner
declarations from the jsdoc scan entirely (flat `export * from` modules are
walked; namespaced ones are not) — e.g. generated data files
(`packages/foundation/primitive/data/src/generated/*.ts`, acp/box/ai-sync
`_generated/*.gen.ts`) carry zero findings only because of this gap. This is
under-reporting (false negatives), not false positives: fixing it GROWS the
inventory. Driver to measure the hidden surface and bring a scope
recommendation to the user before P5 tail / P8. Restructuring @beep/html's
flat barrel to namespaced purely to dodge findings is REJECTED (gaming
detector intent).

## R10 — schema-first S7-struct + S9-manual clusters (LOCKED, driver-verified 2026-07-08)

Lane p2-s7s9 delivered 6 verified in-tree conversions + 1 reproduced negative
(report: `ops/reports/P2-audits/p2-s7s9.md`); driver spot-verified
`ToolCallRequest.tool: AiTool.Any` (builder-carrying, `TierGate.ts:211-214`).

- **S7 (9 entries): 100% code-fix.** Every `detectStructReason` branch yields
  `exception`, so the only exit is conversion; `S.Class` accepts spreads and
  computed keys unchanged (verified: FallowAuditRawReport compiled clean).
  **No detector change.** `LiteralKit.schema.ts` `union` gets a dedicated P4
  lane with full package test proof (repo-wide blast radius).
- **S9 (37): ~22-27 convertible** by the same S.Struct→S.Class mechanics —
  including entries whose recorded reasons are stale (`CreateThreadAtomInput`:
  no consumers exist) or weak (`FieldErrorEntry`). The generic-factory
  local-class technique (TypedTextSchema) disproves "function-local ⇒
  unconvertible" and applies to S7's GraphCollection/makeEventSchema/LiteralKit.
- **Unconvertible residue (~10-15)**: third-party runtime adapters
  (BM25VectorizerInstance), builder-carrying records (ToolCallRequest),
  ReactNode-carrying props (FieldShellProps), and the TS7056 inference-limit
  workaround (LawEntities — error reproduced verbatim). Their inventory fate
  converges on the S2-signals classification ruling (pending p2-s2);
  LawEntities may alternatively get a deep-refactor lane (file split /
  suspended schema) in P4 if S2 mechanics don't absorb it.

## R11 — schema-first S2-signals cluster + end-state framework (LOCKED, driver-verified 2026-07-08)

Lane p2-s2 read ~41% of the 85 entries in source, delivered 3 real conversions
+ 1 honest partial (report: `ops/reports/P2-audits/p2-s2-signals.md`). Driver
spot-verified: `S.Uint8Array` exists in v4 (`Schema.ts:11781`);
`UsageRecordSink extends Context.Service<UsageRecordSink, UsageRecordSinkShape>()`
(`apps/professional-desktop/src/chat/UsageRecordSink.ts:38`); detection is
textual (`SchemaFirst.ts:59-61`, `:740-753`).

**End-state framework for the signals class (dissolves `exception` status):**
1. **Service-contract silent skip** (est. 63+2 of 85): `isServiceContractShape`
   runs before the signals check and emits NO entry when any structural signal
   holds: (1) same-file `Context.Service<Tag, X>()` (through ≤1 local alias
   intersection); (2) parameter-of-a-method-of-(1); (3) file matches
   `*.ports.ts` (documented role, standards/ARCHITECTURE.md:990);
   (4) registry-of-capability-providers (ReadonlyArray<X> with Effect-returning
   member invoked); (5) `.tsx` + `*Props`/`*RenderProps`/forwardRef Props.
   Fixtures: still-fires (function-member iface with no signal) +
   newly-excluded (UsageRecordSinkShape shape).
2. **All-function-member interfaces silent** (extends R6-2 to non-generic):
   behavior records are definitionally not data (SendHandlerBox, SqlTestHooks).
3. **Curated runtime-handle signals silent** (vendor/live-resource types
   already enumerated in NON_SCHEMA_SIGNAL_PATTERN: WinkMethods,
   StartedTestContainer, pulumi.Input, ChalkInstance-like callable-instance
   mirrors, live client/session handles) — per-entry evidence table in the
   report covers all 16.
4. **Mixed data+function interfaces with NO structural signal become
   CANDIDATES** (gate STRENGTHENED — today they're tolerated exceptions):
   fix by descriptor-extraction/splitting (ExportedTool pattern, proven).
   Residue that trips fence 6 (Graph-carrying, e.g. StoredResult) gets
   per-entry driver sign-off during P4 regen iterations.
5. **Narrow `\bUint8Array\b` out of NON_SCHEMA_SIGNAL_PATTERN** — v4 has
   native `S.Uint8Array`; SyncDataFetchedSource then converts (proven clean).
6. **Fix the alias-indirection false negative**: member-type checks must
   resolve one level of local type aliases (the lane proved hiding `=>` behind
   a named alias silences the textual check). Fixture pair. Gate STRENGTHENED.

Sequencing: R6+R7+R11 detector changes land as ONE SchemaFirst.ts lane
(single writer), driver regens, surfaced candidates (S4 extends-local, mixed
interfaces, SyncDataFetchedSource) are converted by P4 lanes BEFORE the push
(R7 sequencing rule).

## R12 — dual-arity D5 + D8 residue (LOCKED, driver-verified 2026-07-08)

Lane p2-d5d8: 4 verified options-object conversions + 2 stash-confirmed
negatives (report: `ops/reports/P2-audits/p2-d5d8.md`). Driver verified both
holds directly: `scanChunk` is consumed BY REFERENCE as a fold step
(`Stream.mapAccum(() => initialScanState, scanChunk)`,
`AnthropicTurnKernel.ts:143`); `makeChatOperations` already carries
`@category constructors` (`ChatOrchestrator.ts:357`) yet is still flagged.

- **D5 (10): ALL convert** to options objects. `checkAssociativity` converts
  with `{x, y, z}` keys (math notation preserved in field names; SPEC
  aggressive-conversion default overrides the notation argument). The 5
  by-analogy entries (batchNodes/foldTraversal/traverseNodes/
  traverseNodesCollect/zipWith) must be attempt-verified in their P3 lane,
  not assumed.
- **D8 (11): 7 convert.** observeHttpApiHandler legacy-overload deletion
  (verified, 56/56); rco-001..004 options-object (verified 26/26 — SEQUENCED
  after the detector lane, same-file writer rule); slice/indexOf/lastIndexOf
  convert (native-parity purpose noted and overridden per posture);
  spliceInPlace attempted with driver diff-review (rest-param lossiness).
- **2 HOLD with driver-verified evidence → zero-entry mechanisms:**
  `scanChunk` → in-code PERMANENT_EXCLUSION (file::qualifiedName + reason) in
  DualArity.ts with fixture (stronger than JSONC: DualArity.ts is its own
  enforcedRoot). `makeChatOperations` → NOT an exception: the existing
  constructor-factory exclusion should cover it; detector lane diagnoses the
  failing conjunct (likely isFactoryReturnType on an all-methods record) and
  fixes with fixture.

## R13 — P2.5 additions ratified + schema-meta extends refinement (LOCKED, driver-verified 2026-07-08)

Lane p25-detectors' two beyond-ticket additions are RATIFIED after driver
review: (a) `hasOwnCallSignatureMember` callable-instance-mirror silent skip
(ChalkInstance family, matches R11-3 evidence); (b) keeping schema-meta
extends as exceptions was correct caution, but is now REFINED: driver verified
`DateTimeInsert extends VariantSchema.Field<{...}>` (`Model.datetime.ts:133`)
has an EMPTY own body and exists solely for the type/value dual-binding
(deletion breaks compilation, S3 audit attempt 2). **Ruling: extends target
matching SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN + empty own body (no data
members) → silent.** Fixture pair: empty-body schema-meta extends silent;
same extends WITH an added data member falls through to member composition.
Also: the R11-1 signals (2)/(4) simplified textual heuristics are ACCEPTED
(additive-only; false negatives surface as candidates, never hide one).
The makeChatOperations conjunct diagnosis (isFactoryReturnType substring
false-positive on printed structural text) is ratified; the identical latent
bug in isStrictObjectLikeType is deliberately deferred (orthogonal law,
noted for P8 review).

## R14 — categorical-generic family end-state (LOCKED, driver-verified 2026-07-08)

The R6-3 pilot (lane sf1-graphnode, full-refactor authority; report:
`ops/reports/SF-1/sf-1-graphnode.md`) produced fresh evidence beyond the S1
probe, driver-verified directly: `Monoid.Endo = <A>(): Monoid<(a: A) => A>`
(`Monoid.ts:630`) and `ap(opFn: TextOperation<A, (b: B) => C>, ...)`
(`TypeClass.ts:672-674`) — the type parameters are INSTANTIATED WITH FUNCTION
TYPES in the public API. No schema can represent these; conversion probes
cascade 104/96 errors. Zero concrete schema consumers exist for the family.

Rulings:
1. **Curated in-code exclusion list in SchemaFirst.ts** (mirror of DualArity's
   PERMANENT_EXCLUSIONS): file::symbol + reason entries for the verified
   categorical-generic family (~11 across @beep/nlp-processing and @beep/nlp,
   per the pilot's per-entry table). Fixture pair: registered symbol silent;
   unregistered `Box<A> { value: A }` still flagged. Explicit, reviewable,
   driver-owned — NOT a blanket structural exemption.
2. **Factory-derived generic aliases silent** (TypedText pattern): generic
   type-alias whose type node is an `S.Schema.Type<...>` TypeReference is
   schema-DERIVED — flagging it is a category error. Fixture pair per the
   lane's recommendation. (TypedText itself was genuinely converted to derive
   from TypedTextSchema — the one convertible entry, landed.)
3. **GraphOperation/OperationDefinition descriptor/behavior split**: viable
   but public-contract-breaking at every call site — DEFERRED to a follow-up
   goal packet; their curated-list reasons must cite the deferred redesign.

Implementation goes to the SchemaFirst.ts owner lane after da2-repocli frees
the package (fence 11 fixtures mandatory).

## R15 — R6-implementation gaps + @beep/schema residue (LOCKED, driver-verified 2026-07-08)

Lane sf1-schema (report: `ops/reports/SF-1/sf-1-schema.md`) fixed 2 with parity
proofs and REPRODUCED regressions for 2 unconvertibles (LiteralKit `union`:
S.Class members break `S.toTaggedUnion` guards — `S.is` requires instanceof;
VariantSchema `extract`: 12 failures, public `Extract` type promises
`S.Struct`). Driver verified the four detector-implementation gaps directly
(`SchemaFirst.ts:71-72`, `:873`, `:1072` placement):

1. **Pattern additions**: `S.Codec`, `S.Union`, `VariantSchema.Overridable`
   join `SCHEMA_INFRASTRUCTURE_EXTENDS_PATTERN` (covers 4+1 entries).
2. **Wire the schema-infra + isEmptyOrMetaOnlyOwnBody check into the GENERIC
   branch** of detectInterfaceReason (generics short-circuit before :1072
   today; covers 8 empty-body schema-meta generics like JsonFromString,
   Model.fields Overridable family).
3. **Apply one-level local-alias resolution to extends-clause targets** before
   the pattern test (R11-6 helper exists; covers 5: Edge, LiteralKit,
   MappedLiteralKit, Overrideable ×2).
4. **Curated exclusion entries** (R14 mechanism) with validated reasons for:
   LiteralKit.schema.ts `union` + VariantSchema.core.ts `extract` (reproduced
   regressions), VariantSchema.core.ts `Class`/`Field`/`Struct`/`Union`
   (foundational toolkit self-definitions; keep as positive-control fixtures
   where feasible), EntitySchema DSL type-literals
   (AssignedEntityParts/ClassInput/PersistOptions — S.Top-valued compile-time
   plumbing), and the 6 SFV4-arbitrary-tests advisories (reasons re-validated
   by the lane: finite enumerations / meta-tests / lossy transform).
Fixture pairs per change (fence 11). Implementation: SchemaFirst.ts owner lane.

### R15 addendum (driver-accepted 2026-07-08)

Lane sf1-repoutils (report: `ops/reports/SF-1/sf-1-repoutils.md`): 15/17 fixed
including two verified-safe dual-use Shape→Class reorders. 3 residue entries
(`TSConfig.ts` `makeTypeStruct`/`makeEncodedStruct`/`strict` in
`makeLooseJsonObject`) join the R15 curated exclusion list: S.Class cannot be
constructed inside a function generic over abstract `Fields extends
S.Struct.Fields` ("Missing Self generic", TS2509 — reproduced in two forms),
and Class `.ast: Declaration` is incompatible with StructWithRest's
`ast: Objects` constraint (independently reproduced by BOTH sf1-schema and
sf1-repoutils). A wider makeLooseJsonObject redesign is out of initiative
scope; the exclusion reasons cite it.

## R16 — effect-laws allowlist adjudication, AL-1a (LOCKED, driver-verified 2026-07-08)

Lane al1a-batch (report: `ops/reports/AL-1/al-1a.md`) challenged 6 entries
with benchmark-grade evidence; driver spot-verified the two key claims
(effect v4's own `Hash.ts:527-529`/`MutableHashMap.ts:295` use native
WeakMap/WeakSet for the identical identity-cache problem; vendored
`wink-nlp/utilities/similarity.js:111+` requires native-Set instance members).

- **FIXED (3 rows removable)**: both ECFR generator entries (R.keys/values/
  toEntries + MutableHashSet + A.dedupe; regenerated output byte-identical)
  and the desktop sidecar native-error (Data.TaggedError, end-to-end verified
  incl. failure path — the recorded "build-tool conventions" justification
  was REFUTED by the sibling script's existing precedent).
- **VERIFIED IRREPLACEABLE (3)**: chalk WeakMap (heap benchmark: 1.01MB vs
  48.21MB retention over 200k discarded instances; unbounded public
  constructor); wink native-Set bridge (third-party interface requires
  instance members — TS2740 + runtime TypeError against the real module);
  rdf WeakSet traversal — recorded GC reason is FALSE (set is per-call,
  nothing retained); TRUE reason is identity-vs-structural equality
  (8.8x-31.1x measured slowdown at depth 200-2000). Reason must be rewritten.
- **End-state mechanism (P8)**: migrate the 3 survivors to an in-code curated
  exclusion list in the native-runtime law checker (fixture pair; rdf entry
  carries the corrected reason), then empty
  standards/effect-laws.allowlist.jsonc. Escalated to the user with evidence
  per SPEC scope rule; survivors remain only via the in-code mechanism.

## R17 — generic-branch member-safety parity + fn-schema .tsx exemption (LOCKED, driver-verified 2026-07-08)

Lane sf2-tailb flagged 6 entries with 2 root causes (report:
`ops/reports/SF-2/sf-2-tailb.md`); driver verified both mechanisms directly:
`classifyGenericInterface` (`SchemaFirst.ts:1236+`) documents that generics
only resolve to silent-schema-infra or tracked exception — the R11 member
carve-outs (service-contract signals, curated runtime-handle members,
ReactNode/render-boundary members) never run for generics; and
`fnSchemaEntryFromFunctionLike` has no `.tsx` exemption while its sibling
null-return rule skips `.tsx` via `isNullReturnEligibleFilePath` (`:1882`).

**AUTHORIZED (fixture pairs each):**
1. Wire the R11 member-safety carve-outs into `classifyGenericInterface`
   (compose own members; apply service-contract/runtime-handle/ReactNode
   signals) so generics get the same silent/candidate treatment as
   non-generics. Covers FieldOption(form), Step/Tour(ui),
   PgliteSqlTestLayerOptions/SqlTestDriver(test-utils).
2. Mirror the `.tsx` file exemption into the SFV4-fn-schema rule (React
   component boundary — same rationale as the rule's own null-return
   sibling and the original HeroVideo advisory). Covers
   CountryFieldDemo/UploadFieldDemo.
3. After regen, curate (R14 list) only the unconvertible residue that
   survives R17 rules, with the lane's file:line evidence: acp x4 terminal/
   protocol handles, mcp-kit FieldTierSet+GatedLayer, box
   BoxStreamingOperations, api-transport x2, form assertUploadedPreview,
   test-utils Pglite/SqlTestHooks residue.
Also ratified: `S.declare(Effect.isEffect)` opaque-guard for inherently
opaque runtime values follows the @beep/schema AbortSignal precedent and is
an honest fix, not gate-dodging.

## R15 correction + R18 — tail-a adjudication (LOCKED, 2026-07-08)

Lane sf2-taila (report: `ops/reports/SF-2/sf-2-taila.md`) live-probe-corrected
R15 item 3: alias resolution covers 3 of the estimated 5 — LiteralKit and
MappedLiteralKit resolve to `S.Literals<L> & {...}` text with SUBSTANTIVE
custom helper members (Options/Enum/is/$match/toTaggedUnion), not pure
aliases. They are schema-toolkit types per the R6-1 category argument but
need CURATED entries, not pattern matching. R15's estimate stands corrected.

R18 — curated exclusion additions (R14 list; implementation rides
sf2-repocli's R17 item-3 batch, evidence file:line in the tail-a report):
- @beep/schema LiteralKit + MappedLiteralKit (schema-toolkit self-definitions
  with helper members; R6-1 rationale).
- @beep/utils makeEventSchema (THIRD independent reproduction of the TS2509
  abstract-`Fields extends S.Struct.Fields` blocker — joins the R15-addendum
  TSConfig.ts family) + DrainableWorker<A> (TS2562 base-class-expression
  type-param blocker + Effect-values-not-data).
- @beep/md PureRenderAdapter + EffectRenderAdapter (deliberate
  plugin-extension contracts; descriptor/behavior split breaks 5 call sites +
  dtslint — same deferral class as R14 GraphOperation/OperationDefinition).
- @beep/identity IdentityComposer (TS2740: callable template-tag signature
  unsatisfiable by any S.Class instance; reproduced probe).
Also ratified: expand/contract null-return resolution by EXPORTING the
existing Option-returning helpers and deleting the null fallback overloads —
the strongest form of SFV4-null-return fix (API improved, not annotated).

## R19 — jsdoc overload-group consolidation (LOCKED, driver-verified 2026-07-08)

Background verification (empirical ts-morph probe + inventory JSON refs +
clean-package precedent sweep): `exportedDeclarationsFor`
(`JSDocDocumentationInventory.ts:645-681`) emits one scored entry PER overload
signature line (key `name:getStart()`), and `getJsDocText` reads only that
node's own docs — so a fully-documented overloaded function still yields open
findings for every non-first signature AND the implementation line. The
policy (.patterns/jsdoc-documentation.md) is SILENT on overloads; no
overload-bearing package has ever reached clean; the universal repo practice
documents the first signature (TSDoc/IDE convention).

**Ruling: detector gap.** Consolidate function-overload groups into ONE
scoring unit per exported name: the group is resolved when its doc block
(conventionally on the first signature) satisfies the required tags; overload
continuation signatures and the implementation line emit no independent
findings. Malformed/forbidden-tag checks still apply to any doc block found
on any signature. Fixture pair: documented-first-signature group → single
resolved entry; fully undocumented group → one open entry (not N).
Implementation: jsdoc detector owner (queued on sf2-repocli behind R17/R18).
Affects: Predicate.chainRefinements (x12), Curie expand/contract/
expandPredicate, Fn.schema Fn/ThunkOf, PatternBuilders pos/entity families.

### R17 implementation note (ratified 2026-07-08)

sf2-repocli's flagged extension is RATIFIED: PERMANENT_SCHEMA_FIRST_EXCLUSIONS
was wired into the fn-schema loop (it existed only in the struct-scan and
interface/type-alias paths), which the assertUploadedPreview curation entry
requires to take effect — mechanical choke-point symmetry, not new judgment.
Also noted: the lane empirically probe-verified all 19 interface/alias curated
entries resolve silent and the 2 conditional entries (Pglite/SqlTestDriver)
still resolve candidate before curating them — the probe-over-trace method is
the preferred curation verification going forward.

## R20 — jsdoc default-export call-expression misattribution (LOCKED, 2026-07-08)

Lane jd-modelingb (Assignment 2, report: `ops/reports/JD-MB/jd-mb.md`) found
six fully-documented @beep/lint-rules files still flagged: `export default
<CallExpression>` (the ESLint-rule module shape) misattributes the doc block —
the checker reads the inner expression node, not the export declaration
carrying the docs. Same attribution-bug family as R19. **Ruling: detector
fix authorized** (attribute docs from the export-assignment/declaration node
for default-exported call expressions), fixture pair mandatory. Implementation
rides the next repo-cli-owner lane (with the package's own 58-finding jsdoc
pass). The 6 phantom findings reconcile at that regen.

Also recorded as a repo lesson (annotate-before-toTaggedUnion): calling
`.annotate(...)` AFTER `S.toTaggedUnion(...)` silently strips the `.match`
static — proven by 12 real test failures and fixed by annotating first.
Candidate for the SPEC API-corrections table in future initiatives.

## R21 — agents-client identity registration + string-literal regex gap (LOCKED, 2026-07-08)

Driver verified `packages/foundation/modeling/identity/src/packages.ts:66-68`
registers agents-domain/use-cases/server but NOT agents-client — an omission
(the sibling trio pattern), not a design choice. **Ruling: complete the
registration** (add "agents-client" + export $AgentsClientId per the exact
sibling pattern), then fix Chat.atoms.ts StreamingTurn/EditTarget with
$I.annote. Unblocks the last 2 JD-8b findings.

Also: SECOND independent instance of unsafe-example regexes matching inside
string literals (" as Effect" in prose; earlier: "declare" in fixture data).
**Added to the R20 detector batch**: strip string literals before the
declare/any/as-assertion regex scans, fixture pair. And the
annotate-before-toTaggedUnion trap was hit independently twice — promoted to
the SPEC API-corrections table.

## R22 — final-residue adjudication (LOCKED, 2026-07-08)

Wave-3 regen residue (dual-arity 3, schema-first 27, jsdoc 121) adjudicated
against established classes:
- **CONVERT (FINAL-B lane)**: dual-arity projectWithinBudget (regression from
  the un-bundle: 4 positional + invalid arity — restructure to dual(2/3) with
  options), expandOption/contractOption dual(2) wraps; schema-first 5
  candidates (box Box.config anonymous@63, file-processing Extraction
  anonymous@111, identity Id.ts x2 + Vocab anonymous structs) + convertible
  exceptions: GraphCollection (m365, P2-proven local-class), usptoDocumentFieldTiers,
  Agent anonymous@65, AssistantContent anonymous@316, CreateThreadAtomInput
  (P2-audited convertible), lint-rules anonymous@155; 3 advisories: ecfr +
  html generator .toUpperCase -> Str.toUpperCase (Research.service precedent),
  uspto R.getSomes -> O.getSomesStruct (Law 20/47).
- **CURATE (FINAL-A lane, in-code list)**: WinkEngineRuntimeState (R11-3),
  Step/Tour (ReactNode render boundary, non-generic — R17 class),
  OfficeActionReviewDeps (service-shape DI container, R11-1 family),
  MemberAccess (ESTree runtime handles), HubSpotErrorOptions.email
  (SFV4-precision-audit intentional diagnostic), oipTwitterHandle
  (SFV4-null-return Next.js Metadata contract), law-practice
  fixture SFV4-arbitrary-tests (same class as the 6 curated),
  PeerDependencyMetaEntry + PublishConfigBase (StructWithRest ast,
  R15-addendum family), LocalDateFields (feeds-S.Class shape the existing
  exclusion missed — note for the fixture), HtmlElementMeta (generated
  lookup), GlobalAttributesStruct (toolkit-internal spread source).
- **FINAL-A also lands**: repo-cli's 58 jsdoc findings, the R20 detector fixes
  (default-export attribution + string-literal stripping before unsafe-example
  regexes), and the R9 namespaced-barrel scan closure (scan `export * as`
  targets as owning modules; expected +~192 findings absorbed by FINAL-B/C).

## R23 — FINAL-lane corrections (LOCKED, driver-verified 2026-07-08)

Two R22 assumptions were corrected by the FINAL lanes with evidence; both accepted:

1. **R9 namespaced-barrel gap does NOT reproduce** (FINAL-A, 3 independent
   verifications: ts-morph trace, live fixture through real
   writeJSDocDocumentationInventory showing namespaced-target exports already
   flagged, full-repo cross-ref with zero unexplained gaps). The p2-j5-html
   hypothesis was never re-derived before citing. **R9 closes as
   verified-non-issue — NO +192 findings expected at regen, NO detector change.**
   A permanent regression-guard fixture pair was still added.

2. **uspto Uspto.service.ts:144 R.getSomes STAYS** (FINAL-B: O.getSomesStruct
   returns Partial<Record> incompatible with the `Record<string,string>`
   contract; optionalField's key param is a plain `string` called from 13
   spread sites — the exact "homogeneous dynamic-key dictionary" carve-out the
   Law 20/47 amendment reserves for R.getSomes). The SFV4-getsomes-struct
   advisory must be moved to a documented **exception**, not converted.

Git-state note: automated "chore: saving/continue/sync" tooling committed +
pushed lane work incrementally and merged origin/main (HEAD=origin, all on PR
#326). Shared-tree file-reversion collisions occurred twice (identity, uspto)
but were caught+reapplied by the affected lanes; `fix(uspto): restore
R.getSomes` at HEAD confirms the correct final uspto state. Detector files
(SchemaFirst.ts curated entries + R20 fixes) verified present in committed tree.

## R24 — jsdoc BindingElement doc-attribution gap (LOCKED 2026-07-08)

The 8 Model.variants.ts findings are a STRUCTURAL detector gap: destructured
`const { /** doc */ Class, ... } = VariantSchema.make(...)` exports resolve to
BindingElement nodes, which ts-morph's canHaveJSDoc excludes, so getJsDocs()
returns nothing regardless of placement. Docs already exist as leading /** */
blocks (jd-s2). **Detector fix**: getJsDocText now reads getLeadingCommentRanges()
for BindingElement docNodes, returning the last /**-prefixed block. Fixture
pair. Clears all 8 at regen, zero source edits.

## R25 — final consolidation (Opus driver, lanes stopped)

Auto-tooling pushed a BROKEN mid-work snapshot to PR #326 (5 red). Local
coherent-tree fixes: Check (R9 test .filePath -> .repoPath endsWith); Fallow
(ecfr complexity present); JSDoc-Ratchet/Lint-Policy (stale inventories ->
local regen green); Property Laws (ecfr test:property exit-130 CI kill;
passes locally 3/3 -> flake, re-run on clean push). Consolidation commits the
coherent tree over the broken HEAD.
