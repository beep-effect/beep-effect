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
