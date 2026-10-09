# config-file — round-1 review inventory

Seats read: `grok.md` (5 records), `sol.md` (8 records), `fable.md` (15 records), and their shared `BRIEF.md`. There are no part-N subdirectories. All 28 seat findings are accounted for below.

Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`; pinned oracle: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` from the brief. Binding precedence: the entire operator revision/rulings/grilling block, D1–D20, sections 12.5 and 14, and the explicit inventory write-surface restriction.

Counts after deduplication: **Required 7 · Backlog 12 · Codemod 1 · Rejected 3 · Groups 4**. Counts refer to merged records, not original seat totals.

Native-runtime allowlist: parsed `standards/effect-laws.allowlist.jsonc`; **0 entries** match `scratchpad/effected/config-file/**`, so there are no `allow-<n>` findings to add. Surviving scanner misses are handled independently below.

S2 and S3 have not run. Documentation, JSDoc, coverage/property-floor and vitest-canon findings remain backlog. Repo-level changes are not assigned: a future requirement for one belongs in Backlog with reason "outside the port's write surface". Shared ledger and README Port notes work is centralized under the codemod section.

Group ownership in `required.json`: g1 owns ConfigMigration.ts and ConfigMigration.test.ts; g2 owns internal/deepMerge.ts and MergeStrategy.test.ts; g3 owns ConfigFile.ts; g4 owns ConfigResolver.ts. Each source/test file has one owner; mechanical alias/wrapper fixes need no test rewrites. All groups have at most one source file.

Non-required records retain `severity: backlog` in the section-12.4 shape; their section and disposition distinguish deferred work, centralized bookkeeping and rejected proposals. A rejected proposal is not an assignment. Required fixes never authorize writes to shared ledger, root/package configs, locks or README Port notes.

## Required

### grok-1-3 — VersionAccess.default.set adds an index property when stamping an empty string.
- file: scratchpad/effected/config-file/ConfigMigration.ts:77
- class: bug   severity: required
- standard: D9; section 11.1; later operator ruling requiring restoration of unforced upstream divergences.   evidence: The pinned oracle spreads raw directly; the port spreads Str.split(raw, ""). A read-only Node probe returned emptySplit: [""], emptySpread: {"version":1}. Thus the port produces {0:"",version} for an empty string. The same probe showed symbolSpread and bigintSpread both equal {"version":1}; grok's claim that those upstream spreads throw is false.
- failure: A custom migration returning "" gains a spurious own property "0". A green example-test gate did not exercise this input.
- fix: Preserve upstream own-property spread semantics without unsafe casts: retain object/function spreading and nonempty strings' UTF-16 index keys, but use an empty object for an empty string. Keep primitive symbol/bigint handling as an empty object. Add an empty-string regression in ConfigMigration.test.ts; retain upstream cases. Do not take fable's suggestion to drop all string keys or grok's suggestion to introduce symbol/bigint defects.
- seats: grok-1-3, fable-1-9

### sol-1-1 — Non-finite migration versions turn a declared step failure into a defect during error construction.
- file: scratchpad/effected/config-file/ConfigMigration.ts:22
- class: bug   severity: required
- standard: D9, D11; structured recoverable failures in .patterns/error-handling.md; section 14 upstream-bug/compatibility evidence.   evidence: Sol's pinned-oracle differential probe used {version:Infinity,name:"fails",up:()=>Effect.fail("step failure")} and parsed {"version":0}. The oracle returned Fail(ConfigMigrationError); the port returned Die(Error: Schema validation failed). The live runPhase constructs ConfigMigrationError.make with the unvalidated number against S.Finite.
- failure: Effect.catchTag("ConfigMigrationError") cannot recover a declared step failure and the original cause is obscured. This is an actual failure-channel bug, not a request to record the S.Finite substitution.
- fix: Make the error's annotated version schema safely represent the numeric domain admitted by ConfigFileMigration.version, using the reported S.declare(P.isNumber) compatibility schema rather than restoring diagnostic-producing S.Number. Add the Infinity failing-step regression in ConfigMigration.test.ts and preserve its typed failure and original cause. Any resulting deviation bookkeeping belongs to the central codemod.
- seats: sol-1-1

### sol-1-3 — Deep merge deletes validated own constructor/prototype fields and violates its promised output type.
- file: scratchpad/effected/config-file/internal/deepMerge.ts:81
- class: type-safety   severity: required
- standard: D11; MergeStrategy<A>.resolve promises Effect<A>; section 14 verified upstream-bug exception.   evidence: Sol decoded both documents with S.Struct({constructor:S.String,prototype:S.String,port:S.Finite}). Both the pinned oracle and port merged them into {"port":3}; S.is(schema)(result) was false and result.constructor was inherited. Both copy loops skip the FORBIDDEN names at lines 81 and 85; the generic deepMerge overload nevertheless promises T.
- failure: Valid configuration inputs silently lose required own data fields, producing a value outside A/T. Existing pollution tests establish inertness, not validity of documents with these legitimate own keys.
- fix: Preserve legitimate own data fields using the existing defineProperty data-property helper and own-property checks, without invoking inherited setters or traversing prototype chains. Add a schema-validity regression in MergeStrategy.test.ts and retain all prototype-pollution assertions. Treat this as the demonstrated upstream bug; central bookkeeping records it before any upstream expectation is adjusted.
- seats: sol-1-3

### sol-1-4 — Migration ordering still calls native Array.prototype.sort.
- file: scratchpad/effected/config-file/ConfigMigration.ts:116
- class: law   severity: required
- standard: standards/effect-laws-v1.md short law 10; standards/effect-first-development.md EF-38.   evidence: The reviewed and live source executes [...options.migrations].sort((a,b)=>a.version-b.version). There are zero config-file allowlist entries. This concrete surviving site demonstrates the reported green law gates missed it.
- failure: A binding native-runtime law remains violated despite green gates.
- fix: Use A.sort(options.migrations, Order.mapInput(Order.Number, migration => migration.version)), with imports from effect/Array and effect/Order. Preserve ascending ordering and stable equal-version order, including the module's admitted numeric cases; retain existing ConfigMigration.test.ts ordering assertions and extend them only as needed.
- seats: sol-1-4

### fable-1-4 — ConfigFile uses the forbidden Schema namespace alias.
- file: scratchpad/effected/config-file/ConfigFile.ts:12
- class: law   severity: required
- standard: standards/effect-laws-v1.md short law 1 (A/O/P/R/S aliases).   evidence: ConfigFile.ts imports * as Schema from effect/Schema and uses Schema throughout. Fable identifies EffectImports.ts alias-preserving behavior at lines 423–428, 657 and 853, explaining why a green effect-imports gate missed this occurrence.
- failure: The schema alias violates the authoritative alias law.
- fix: Rename the namespace import to S and all references to that binding in ConfigFile.ts, including examples that refer to it. No other files or test rewrites are necessary.
- seats: fable-1-4

### fable-1-5 — The internal event-emission callback adds an unnecessary named tracing span.
- file: scratchpad/effected/config-file/ConfigFile.ts:430
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-14 (fnUntraced for internal hot paths); D9; later operator ruling on unforced divergences.   evidence: The port uses onSome: Effect.fn("onSome")(function* ...) inside emit. The pinned oracle callback at src/ConfigFile.ts:416–421 was an untraced Effect.gen. Emission runs for Discovered/Parsed/Validated/Resolved/Loaded; neighboring internal helpers use fnUntraced.
- failure: Wired config events create a new span named onSome for every emission. The effect-fn law forces a wrapper, but does not force this internal tracing addition.
- fix: Replace the internal callback wrapper with Effect.fnUntraced, retaining its body, error/interruption handling and event order. No upstream test lines were rewritten for this tracing choice; no test-file edit is required.
- seats: fable-1-5

### fable-1-6 — Internal root predicates add a named span for every ancestor directory probe.
- file: scratchpad/effected/config-file/ConfigResolver.ts:343
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-14; D9; later operator ruling on unforced divergences.   evidence: isGitRoot at line 343 and isWorkspaceRoot at line 353 use named Effect.fn wrappers. The oracle predicates at src/ConfigResolver.ts:332–357 were untraced Effect.gen and run once per directory during rootAnchored's upward walk.
- failure: Resolution adds tracing spans per ancestor under bare predicate names. An untraced wrapper clears the same law without changing the oracle's tracing behavior.
- fix: Use Effect.fnUntraced for both internal predicates while retaining their explicit function types and bodies. No upstream test lines were rewritten for this wrapper choice; no test-file edit is required.
- seats: fable-1-6


## Backlog

### sol-1-5 — Legacy documentation carriers, incomplete examples and missing metadata await S2.
- file: scratchpad/effected/config-file/ConfigFile.ts:862
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md; operator deferral of S2.   evidence: ConfigFile.Service and ConfigEvents retain @example/@remarks. Export blocks lack canonical @category/@since; ConfigEvents examples depend on surrounding AppConfig, schema, codec, resolvers and strategy bindings.
- failure: The final documentation and compiling-example contract is not satisfied; S2 has not run.
- fix: During S2, convert carriers to titled Example/Details sections, supply complete bindings, and add canonical categories and @since 0.0.0 while preserving upstream prose.
- seats: sol-1-5
- backlog reason: Deferred documentation/JSDoc work under the operator order.

### sol-1-6 — Effectful test layers are provided per test instead of owned by it.layer.
- file: scratchpad/test/config-file/ConfigFile.test.ts:41
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D14; operator deferral of S3.   evidence: Individual it.effect bodies provide layerFor(...), which builds ConfigFile.layer with Layer.effect; the pattern repeats in event tests.
- failure: The effectful layer lifecycle does not meet the eventual vitest-canon contract.
- fix: During S3, migrate to isolated it.layer blocks, retaining distinct filesystem seeds and fault configurations.
- seats: sol-1-6
- backlog reason: Deferred vitest-canon work; S3 has not run.

### sol-1-7 — Outcome assertions manually inspect Result/Exit/Option/Cause wrappers.
- file: scratchpad/test/config-file/ConfigEvent.test.ts:72
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5, EV005/EV006; operator deferral of S3.   evidence: ConfigEvent.test.ts:72–81 manually checks Effect.result tags; JsonCodec.test.ts:53 manually inspects Exit/Option/Cause.
- failure: Assertions retain forms the canon migration replaces.
- fix: During S3, use Effect.exit and the relevant @effect/vitest/utils outcome helpers while retaining typed-failure-versus-defect checks.
- seats: sol-1-7
- backlog reason: Deferred vitest-canon work; S3 has not run.

### sol-1-8 — Generated schema/codec/parser properties are absent.
- file: scratchpad/test/config-file/JsonCodec.test.ts:21
- class: test   severity: backlog
- standard: D10; section 11.4; operator deferral of S3.   evidence: Sol's complete test-surface search found no it.prop/it.effect.prop, Arbitrary or fcRuns; the codec round trip uses a fixed {port:8080} example.
- failure: The final property floor is unmet and supported input domains are not explored by generated cases.
- fix: During S3, add schema-generated round trips and parser/formatter fidelity/idempotence properties over supported domains using canonical APIs and fcRuns; keep upstream example suites.
- seats: sol-1-8
- backlog reason: Deferred property/coverage work; S3 has not run.

### fable-1-7 — VersionAccessError has an enumerable native-name compatibility override.
- file: scratchpad/effected/config-file/ConfigMigration.ts:66
- class: effect-idiom   severity: backlog
- standard: D11; D9/section 14; .patterns/error-handling.md tagged-error convention.   evidence: The source and test-local class at ConfigMigration.test.ts:146 set override name = "Error". Fable's probe found own keys ["_tag","name"] and Error: m rendering, but no failing consumer, diagnostic or standard expressly banning this name override.
- failure: The override adds an enumerable key and hides the tag in rendering; this alone does not establish a required defect. The tagged error remains tagged and discriminable.
- fix: The proposed deletion of both overrides is optional backlog only: first establish a law or verified upstream bug authorizing the resulting Error.name/rendering deviation under section 14. Until then keep the upstream-compatible name; central codemod handles the forced constructor/tag substitution.
- seats: fable-1-7
- backlog reason: Outside D11: no cited rule mandates tag-based Error.name rendering; changing it requires a justified deviation.

### fable-1-8 — The public migration codec has a bare parse span name.
- file: scratchpad/effected/config-file/ConfigMigration.ts:121
- class: effect-idiom   severity: backlog
- standard: EF-14 naming examples; D11.   evidence: Effect.fn("parse") shares its name with EncryptedCodec.parse; other public functions use names such as ConfigFile.load.
- failure: Trace names are ambiguous, without a cited mandatory naming rule or measured regression.
- fix: Consider qualifying the wrapper as Effect.fn("ConfigMigration.parse") in later trace-name cleanup, preserving its behavior.
- seats: fable-1-8
- backlog reason: Outside D11: naming preference; reusable/public tracing is permitted by EF-14.

### fable-1-15 — Encrypted codec span names are bare parse/stringify.
- file: scratchpad/effected/config-file/EncryptedCodec.ts:154
- class: effect-idiom   severity: backlog
- standard: EF-14 naming examples; D11.   evidence: Effect.fn("parse") at line 154 and Effect.fn("stringify") at line 170 use unqualified names, colliding with ConfigMigration.parse.
- failure: Trace readability is reduced, without a mandatory naming-rule violation or measured regression.
- fix: Consider Effect.fn("EncryptedCodec.parse") and Effect.fn("EncryptedCodec.stringify") during later trace-name cleanup.
- seats: fable-1-15
- backlog reason: Outside D11: naming preference; reusable/public tracing is permitted by EF-14.

### fable-1-10 — Implementation generics are erased by the public make signature.
- file: scratchpad/effected/config-file/ConfigMigration.ts:114
- class: type-safety   severity: backlog
- standard: D11; D2; crispen suggestion.   evidence: The public make type accepts ConfigMigrationOptions at its unknown defaults while the implementation declares EM/EV, and its helper explicitly instantiates runPhase<number, EV | VersionAccessError>. No failed type check or unsafe assertion is demonstrated.
- failure: The implementation is harder to follow and may suggest unavailable public error inference, but its public error-channel contract remains intact.
- fix: Consider removing the dead implementation/interface generics if the green diagnostics permit it, or exposing them on make when a concrete consumer requires the inference.
- seats: fable-1-10
- backlog reason: Outside D11: no demonstrated type-safety failure or diagnostic; API cleanup must retain law-required typing.

### fable-1-11 — MergeStrategy repeats object checks to satisfy type narrowing.
- file: scratchpad/effected/config-file/MergeStrategy.ts:85
- class: effect-idiom   severity: backlog
- standard: Short law 21; D15; D11.   evidence: canMerge already checks both operands are record-like, but its boolean return does not narrow both operands; the two P.isObject checks supply narrowing after upstream casts were removed.
- failure: Predicate logic is repeated, but deleting it directly loses the law-required typing. No gate miss of a tersest equivalent expression is established.
- fix: Consider a reusable pair refinement or exported isRecordLike guard and update the merge call together if that produces a proven equivalent, shorter typed form.
- seats: fable-1-11
- backlog reason: Outside D11: optional guard/API consolidation rather than an evidenced correctness defect.

### fable-1-12 — Inline event fields and the short-ciphertext message lack descriptions.
- file: scratchpad/effected/config-file/ConfigEvent.ts:44
- class: schema   severity: backlog
- standard: Operator identity step field annotations; schema-first-development; S2 documentation deferral.   evidence: The twelve ConfigEventPayload S.TaggedStruct members at lines 44–66 lack annotateKey descriptions on their fields; CiphertextTooShortError.message at EncryptedCodec.ts:15 is also undescribed.
- failure: Schema documentation is inconsistent; no decoding/encoding or identity defect is shown.
- fix: During S2, add annotateKey descriptions from the carried field comments to those event fields and CiphertextTooShortError.message.
- seats: fable-1-12
- backlog reason: Documentation-only annotation work is deferred to S2.

### fable-1-13 — The internal crypto module lost its upstream lead documentation.
- file: scratchpad/effected/config-file/internal/crypto.ts:1
- class: docs   severity: backlog
- standard: D4; section 10.1; operator deferral of S2.   evidence: The oracle src/internal/crypto.ts:1–14 lead explains AES-GCM/WebCrypto primitives, dependency isolation and CryptoFailure lifting; the lab starts with imports.
- failure: Design rationale and failure-contract prose were dropped.
- fix: During S2, restore the entire upstream lead prose and @internal marker, converting its @remarks carrier to Details without dropping content.
- seats: fable-1-13
- backlog reason: Deferred carried-documentation repair under S2.

### fable-1-14 — README adaptation and its import examples are unfinished.
- file: scratchpad/effected/config-file/README.md:3
- class: docs   severity: backlog
- standard: Section 10.3; short law 2; D13; operator deferral of S2.   evidence: The README retains badges at lines 3–6, stability/pnpm-plugin-effect text at 10–14 and Install at 26; examples still import @effected/config-file and the root effect barrel.
- failure: The README describes installation of upstream and its examples do not meet the final lab import conventions.
- fix: During S2, remove the specified badges/Install/stability material and rewrite examples to lab paths and dedicated Effect module imports. Leave README Port notes bookkeeping to the central codemod.
- seats: fable-1-14
- backlog reason: Deferred README/docs work under S2; Port notes are outside this fix assignment.


## Handled by the deviation codemod

### fable-1-3 — Law-forced deviations lack centralized per-module, per-class bookkeeping.
- file: scratchpad/effected/config-file/README.md:246
- class: law   severity: backlog
- standard: Later operator ruling on generated deviation entries and exportsAdded; D9/section 14; EF-3/EF-19 JSON boundaries.   evidence: Seat reports identify empty deviations in the module ledger and README. Sites include identity-derived schema/error/service keys (ConfigEvent.ts:129 and ConfigFileKeyTyping.test.ts:15), S.Finite (ConfigMigration.ts:22), tagged causes (ConfigMigration.ts:65 and EncryptedCodec.ts:14), native-runtime substitutions (deepMerge.ts and crypto.ts), and JSON schema/codec substitutions (JsonCodec.ts and JsoncCodec.ts). Sol's codec probes confirm SchemaError/JsoncStringifyError causes and rejection of top-level undefined after the schema migration.
- failure: The record does not yet describe the forced identity, numeric-schema, error, runtime or schema-JSON classes and their adjusted tests. This bookkeeping defect does not create a module fix-lane assignment.
- fix: The central deviation codemod generates one module entry per systemic class, listing sites, actual upstream/lab behavior, the forcing law/diagnostic and adjusted upstream test lines, plus exportsAdded where applicable. It writes the shared ledger and README Port notes centrally. Do not hand-edit those surfaces or create one record per site. For JSON codecs, retain the law-required implementation and record the observed error/input differences. Required findings above address demonstrated implementation bugs separately.
- seats: fable-1-3, grok-1-5, sol-1-2
- disposition: handled centrally by the deviation codemod


## Rejected

### grok-1-1 — Restore native JSON calls and native causes in JsonCodec.
- file: scratchpad/effected/config-file/JsonCodec.ts:6
- class: bug   severity: backlog
- standard: D9; EF-3/EF-19; tsgo prefer-schema-over-json; operator restriction of restoration to unforced changes.   evidence: Both seats show SyntaxError/TypeError becoming SchemaError with opaque parser detail and top-level undefined becoming a failure. Fable explicitly names the forcing prefer-schema-over-json diagnostic and proposes moving native calls outside the Effect to evade it; the binding EF-3 text says never use JSON.parse/JSON.stringify.
- failure: There is an observable law-forced codec deviation, whose bookkeeping is included under the codemod record. A successful diagnostic-avoidance probe is not evidence that the binding JSON law permits the proposed implementation.
- fix: Rejected proposal: Effect.try around native JSON.parse/JSON.stringify, or native Result-returning try/catch outside the Effect. Retain the Schema JSON codec; the central codemod records the forced deviation.
- seats: grok-1-1, fable-1-1
- disposition: rejected
- rejection: The proposed native-JSON restoration violates EF-3/EF-19; these are forced changes, so the operator's unforced-divergence restoration rule does not apply.

### grok-1-2 — Restore native JSON.stringify and TypeError in JsoncCodec.
- file: scratchpad/effected/config-file/JsoncCodec.ts:26
- class: bug   severity: backlog
- standard: D9; EF-3/EF-19; tsgo prefer-schema-over-json; later operator rulings.   evidence: Both seats show JsoncStringifyError replacing the native TypeError and top-level undefined failing instead of returning undefined. The proposed native stringify or out-of-Effect try/catch conflicts with the JSON-boundary law. Missing rewritten prose belongs to deferred S2 carried-documentation work, not a required restoration of native calls.
- failure: The forced serializer seam changes its cause/input domain; those observable differences need central deviation records. The evidence does not justify reintroducing a prohibited implementation.
- fix: Rejected proposal: restore JSON.stringify(value,null,2) through Effect.try or diagnostic-avoiding Result try/catch. Retain the Effect-native seam and have the central codemod record it; carry the original design prose forward accurately during S2.
- seats: grok-1-2, fable-1-2
- disposition: rejected
- rejection: The proposed restoration violates EF-3/EF-19; an unforced native-API restoration cannot be assigned as required.

### grok-1-4 — Make CiphertextTooShortError masquerade as native Error.
- file: scratchpad/effected/config-file/EncryptedCodec.ts:160
- class: bug   severity: backlog
- standard: Short law 7; later operator ruling on native-error replacements and their centralized recording.   evidence: The cause now comes from S.TaggedError instead of new Error, so its constructor/tag/name differ. No changed phase or message, lost typed failure, or defect is demonstrated; these are the expected law-forced representation changes.
- failure: Only the forced tagged-error representation differs; no independent incorrect implementation is shown.
- fix: Rejected proposal: add override name = "Error" and hand-record the remaining change per site. Keep the tagged error; central codemod records its systemic class.
- seats: grok-1-4
- disposition: rejected
- rejection: The finding treats the operator-accepted, law-forced tagged-error change as a required bug; per-site bookkeeping also contradicts the codemod ruling.
