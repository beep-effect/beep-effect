# glob — round-1 merged inventory

Seats read: `grok.md` (5 findings), `sol.md` (11), `fable.md` (15), and their shared `BRIEF.md`; no part-N seat directories exist. Review head: `3fa5876691901fccf3d1cd29e9324564df134b56`. Oracle: the brief-pinned cached checkout at `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.

Counts after deduplication and disposition: **Required 10 · Backlog 9 · Handled by the deviation codemod 2 · Rejected 2 · Write groups 3**. All 31 seat records are represented; mixed records are split only where their claims have different dispositions or disjoint write ownership.

Binding precedence: the complete operator revision and both 2026-10-09 ruling blocks override the older stage ladder; D1–D20, section 12.5 and section 14 apply. Schema/field/check annotations belong to the completed identity stage. S2 docs/JSDoc and S3 canon/properties/coverage remain backlog. Law-forced deviation bookkeeping stays central.

`standards/effect-laws.allowlist.jsonc` contains **zero** entries for `scratchpad/effected/glob/**`; therefore there are no `allow-<n>` findings to add. The green-gate claim is from the brief, not a new gate run. Concrete missed schema/runtime/constructor/oracle defects are retained with their evidence.

Write ownership: g1 owns six source files and the constructor/overflow/guard tests; g2 owns five independent engine-helper source files; g3 owns root `package.json` and `bun.lock` for the verified override defect. `sol-1-4a` and `sol-1-4b` partition one broad seat record by distinct schema owners so a lane never exceeds six source files. No source or test file has multiple owners. Empty test lists mean existing suites must run but no test edit is needed; unchanged verification-only suites are not assigned as write surfaces. Central deviation ledger/README writes are outside these required groups.

## Required

### sol-1-1
- file: scratchpad/effected/glob/GlobPattern.ts:39
- class: bug   severity: required
- standard: D9; section 14; GlobPattern.compileResult totality; effect-tsgo schemaNumber documented intentional-non-finite exception.
- evidence: The seat probed the pinned oracle with source = "{1.." + "9".repeat(310) + "}". The oracle returned Failure / ExpansionBudgetExceeded / actual Infinity; the lab threw Schema validation failed. runSyncExit changed from Fail(GlobPatternError) to Die at both GlobPattern.compile and GlobSet.compile. The engine arithmetic at internal/braceExpansion.ts:245-247 computes an overflowing member count and throws it unchanged; GlobPatternError.actual is S.Finite.
- failure: A valid pattern string escapes the promised typed failure channel when the expansion count overflows.
- fix: Restore intentional non-finite measurements for GlobPatternError.actual using S.Number with the documented, reasoned line-local schemaNumber exception; retain finite validation for limit. Add the reproducer to GlobPattern.test.ts and GlobSet.test.ts for synchronous Result and Effect failure boundaries. Preserve actual Infinity in the GuardExceeded schema conversion (sol-1-2).
- seats: sol-1-1

### grok-1-2
- file: scratchpad/effected/glob/GlobPattern.ts:35; scratchpad/effected/glob/GlobPattern.ts:97; scratchpad/effected/glob/internal/limits.ts:32; scratchpad/effected/glob/internal/types.ts:13; scratchpad/effected/glob/internal/ast.ts:82
- class: schema   severity: required
- standard: Laws 17 and 19; EF-12b; D5; AGENTS.md named LiteralKit domains.
- evidence: GuardReason is a handwritten union duplicated in GlobPatternError.reason; Platform is another handwritten union duplicated in GlobPatternOptions.platform. ExtglobType is maintained as a union, HashSet literal list and handwritten narrowing guard. The four green S1 laws do not enforce these schema-domain requirements. These declarations remain in the reviewed source.
- failure: Named runtime domains have multiple independent sources of truth, so schema acceptance, TypeScript types and membership guards can diverge.
- fix: Create one identity-annotated LiteralKit for each of GuardReason (limits.ts), Platform (types.ts) and ExtglobType (ast.ts). Derive the same-name types from .Type, reuse the kits in GlobPatternError.reason and GlobPatternOptions.platform, and replace the ExtglobType membership set/predicate with the kit guard. Copy the actual oracle member lists exactly (Platform has 12 members despite the seat calling it 13); preserve every accepted literal.
- seats: grok-1-2, sol-1-3, fable-1-4, fable-1-5, fable-1-6

### sol-1-2
- file: scratchpad/effected/glob/internal/limits.ts:40
- class: schema   severity: required
- standard: Law 7; EF-1; D5; schema-first executable-contract and identity requirements.
- evidence: GuardExceeded extends Data.TaggedError and is exported/thrown between engine and facades. The seat runtime probe found "ast" in GuardExceeded false. The positional constructor emits message and sets name to Error. This schema-contract omission is missed by the green native-error and native-runtime checks.
- failure: The cross-module guard signal has no executable schema or identity/field metadata.
- fix: Define GuardExceeded directly with S.TaggedError and $I identity, schema and field annotations, using the shared GuardReason kit. Preserve the positional (reason, limit, actual) constructor, existing message, name = "Error", _tag and instanceof behavior so existing throw sites need no rewrites. Keep limit finite and allow the intentional actual Infinity via the documented schemaNumber exception. Extend engine.test.ts with schema/constructor parity and non-finite-measurement regression assertions. Do not adopt the behavior-changing alternatives listed under Rejected.
- seats: grok-1-3, sol-1-2, fable-1-8

### sol-1-4a
- file: scratchpad/effected/glob/internal/limits.ts:12; scratchpad/effected/glob/internal/assertValidPattern.ts:18; scratchpad/effected/glob/internal/ast.ts:42; scratchpad/effected/glob/GlobPattern.ts:179; scratchpad/effected/glob/GlobSet.ts:83
- class: schema   severity: required
- standard: EF-12; D5; operator identity step: annotations on every schema and field.
- evidence: InvalidCap, InvalidPattern and ASTError have an identity argument but no $I.annote metadata or message field annotation. The seat probe of InvalidCap.ast.annotations showed only identifier/sentinel metadata. GlobPattern.source and GlobSet.patterns are unannotated schema fields. These are executable-schema metadata omissions, not S2 JSDoc carriers.
- failure: These error contracts and facade fields lack the semantic metadata required by the already-completed identity stage.
- fix: Add meaningful $I.annote title/description metadata and message.annotateKey descriptions to InvalidCap, InvalidPattern and ASTError; add field descriptions to GlobPattern.source and GlobSet.patterns. Preserve identifiers, tags and behavior. This is the core-surface portion of sol-1-4; the two remaining error contracts are owned exclusively by sol-1-4b.
- seats: sol-1-4, fable-1-9

### sol-1-4b
- file: scratchpad/effected/glob/internal/braceExpressions.ts:17; scratchpad/effected/glob/internal/minimatch.ts:48
- class: schema   severity: required
- standard: EF-12; D5; operator identity step: annotations on every schema and field.
- evidence: BraceExpressionError and MinimatchError also declare only { message: S.String } plus the identity constructor argument, without schema title/description or message-field annotations.
- failure: These two independent error schemas lack the metadata required by the identity stage.
- fix: Add meaningful $I.annote title/description metadata and message.annotateKey descriptions to BraceExpressionError and MinimatchError. Preserve the existing error identities and tags; do not collapse them into a new error family. This is the disjoint remaining portion of sol-1-4, separated to keep each write group at six or fewer source files.
- seats: sol-1-4, fable-1-9

### sol-1-5
- file: scratchpad/effected/glob/GlobPattern.ts:180; scratchpad/effected/glob/GlobSet.ts:85
- class: schema   severity: required
- standard: Law 18; EF-12c reusable schema-check metadata.
- evidence: Both exported reusable class compilability filters pass only a title to S.makeFilter. Their enclosing class annotations do not annotate the check nodes; neither filter supplies identifier or description.
- failure: Reusable validation contracts omit required check metadata, despite the green gates.
- fix: Use distinct $I.annote metadata for each compilability check, with identifier, meaningful title and description. Preserve the predicate and existing guard-message behavior.
- seats: sol-1-5

### sol-1-6
- file: scratchpad/effected/glob/internal/braceExpansion.ts:43
- class: effect-idiom   severity: required
- standard: EF-21: runtime execution stays at application/test boundaries.
- evidence: Library import initializes five escape salts with Effect.runSync(Random.next), at lines 43-47. The installed Effect Random service exposes Random.Random.defaultValue() and nextDoubleUnsafe(); its default implementation uses the same random source.
- failure: Importing a synchronous library internally starts five Effect runtimes outside a caller-owned runtime boundary.
- fix: Acquire the default Random service once and generate the five salts with nextDoubleUnsafe(), preserving their string prefixes/suffixes and synchronous lifetime. Remove the now-unused Effect import. Retain the existing escape/brace-expansion oracle tests; no test rewrite is needed.
- seats: sol-1-6

### fable-1-7a
- file: scratchpad/effected/glob/internal/escape.ts:26; scratchpad/effected/glob/internal/unescape.ts:31; scratchpad/effected/glob/internal/braceExpansion.ts:126; scratchpad/effected/glob/internal/minimatch.ts:133
- class: effect-idiom   severity: required
- standard: Later operator ruling: restore upstream changes no law, diagnostic or ruling forced; D9; Dual-Arity Inventory Contract excludes (input, options?).
- evidence: The pinned oracle exposes plain complete one-argument arrows for escape, unescape, expand and braceExpand. The lab adds curried overloads and predicate-based dual wrappers using args.length / P.isString. The authoritative dual inventory explicitly excludes this optional-options shape, so those wrappers are not law-forced. The seat gives the exact changed definitions; the pinned braceExpansion/compliance test diffs show no assertions rewritten to use the new curried overloads.
- failure: The lab expands these upstream function shapes without a forced reason; retaining them as a deviation contradicts the later ruling.
- fix: Restore the four pinned upstream arrow signatures and full-arity behavior for escape, unescape, expand and braceExpand, keeping required import, native-runtime and typed-error changes. Remove their unused dual/Predicate imports (keep unrelated uses where needed). Restore any upstream test lines changed for these wrappers; none were identified in the reviewed test diffs. Retain upstream one-argument/default-options and full-arity oracle tests. The mandatory-arity portion of the seat report is rejected separately.
- seats: fable-1-7

### fable-1-2
- file: scratchpad/test/glob/GlobPattern.test.ts:213; scratchpad/test/glob/GlobPattern.test.ts:217
- class: test   severity: required
- standard: Section 11.1 and section 16 no weakened oracle tests; later wrong-input helper ruling; D9 and D15.
- evidence: Pinned upstream GlobPattern.test.ts:210,214 asserts GlobPatternOptions.make rejects explicit undefined and unknown platform. Lab lines 213,217 instead call decodeUnknownResult. These are different entry points: Class.make construction validation can regress without those decoder tests failing. Glob has no deliberatelyInvalid.ts helper.
- failure: Two rewritten upstream assertions no longer exercise the promised make-time rejection behavior.
- fix: Add the single sanctioned scratchpad/test/glob/deliberatelyInvalid.ts helper with export const deliberatelyInvalid = <T>(value: unknown): T => value as T and its documentation. Restore the upstream make subjects with dot: deliberatelyInvalid<boolean>(undefined) and platform: deliberatelyInvalid<"posix">("vms"). Preserve the throwing assertions and all other tests.
- seats: fable-1-2

### fable-1-3
- file: package.json:339; bun.lock:3530; scratchpad/test/glob/compliance.test.ts:17
- class: bug   severity: required
- standard: D3/D10 retained oracle dependencies; section 4 exact upstream oracle specifier; green tests do not prove dependency identity.
- evidence: The pinned upstream glob package and scratchpad/package.json:98 declare minimatch 10.2.6. The seat and this inventory pass both resolved the test import to root node_modules/minimatch/package.json version 10.2.5. Root package.json:339 overrides minimatch to 10.2.5; bun.lock mirrors that override and only records the resolved 10.2.5 package. This root cause means reinstalling alone cannot restore the oracle pin.
- failure: The differential/compliance suite proves behavior against a different oracle version than its declared and pinned contract.
- fix: Correct the root minimatch override so it permits the pinned 10.2.6 oracle (use 10.2.6 for the existing blanket override, or a supported narrower override preserving the exact glob oracle). Regenerate bun.lock through beep-heavy bun install, confirm resolution from scratchpad/test/glob is 10.2.6, then run the module test gate. Keep scratchpad/package.json's already-correct exact 10.2.6 declaration and the compliance assertions unchanged. No test file edit is required; package.json and bun.lock are an explicit shared-config write surface.
- seats: fable-1-3

## Backlog

### grok-1-4
- file: scratchpad/effected/glob/GlobPattern.ts:29; scratchpad/effected/glob/GlobSet.ts:81
- class: jsdoc   severity: backlog
- standard: JSDoc law and section 10.2; operator defers S2.
- evidence: GlobPattern and GlobSet retain @public, @remarks and @example carriers and lack canonical @category, @since and titled observable examples; the reports enumerate the repeated locations.
- failure: Carried public documentation does not yet meet the JSDoc rendering/export rubric.
- fix: During S2 preserve all prose/examples, convert to Details and titled Example sections, and add canonical categories, @since 0.0.0 and compilable value-export examples.
- seats: grok-1-4, sol-1-8

### sol-1-10
- file: scratchpad/test/glob/GlobPattern.test.ts:330; scratchpad/test/glob/GlobSet.test.ts:310
- class: test   severity: backlog
- standard: EV001; effect-vitest-canon D5; testing patterns; operator defers S3.
- evidence: Regular it callbacks execute Effect.runSync in GlobPattern comparisons (330,353,354,361) and GlobSet comparisons (310,326). Result predicates/manual branches replace specialized variant assertions.
- failure: Effect comparisons bypass the canonical Effect test runner and Result helpers.
- fix: During S3 move the cases to it.effect, yield the effects and use @effect/vitest/utils Result assertions retaining variant and payload checks; retain assert.* for plain values.
- seats: grok-1-5, sol-1-10

### sol-1-9
- file: scratchpad/effected/glob/README.md:52
- class: docs   severity: backlog
- standard: Law 2; S2 documentation deferral.
- evidence: README quick-start and later examples import Effect and Schema from the root effect barrel.
- failure: Markdown examples teach a forbidden import style.
- fix: Rewrite the adapted README examples to dedicated effect/Effect and effect/Schema namespace imports without changing behavior; leave KNOWLEDGE.md verbatim.
- seats: sol-1-9

### sol-1-11
- file: scratchpad/test/glob/GlobPattern.test.ts:280; scratchpad/test/glob/compliance.test.ts:298
- class: test   severity: backlog
- standard: D10; section 11.4; operator defers S3 property floor.
- evidence: Schema round trips are fixed examples rather than schema-generated properties for GlobPattern, FromString, options, error and GlobSet; property counts use literals such as runs 200 and 500.
- failure: The property suite does not yet prove the schema/codec round-trip floor or configurable run counts.
- fix: During S3 add Arbitrary.schema round-trip properties for every exported schema/codec, preserve differential properties, and use @beep/fc-runs for all run counts.
- seats: sol-1-11

### fable-1-11
- file: scratchpad/effected/glob/internal/ast.ts:538; scratchpad/effected/glob/internal/minimatch.ts:548
- class: test   severity: backlog
- standard: Section 11.3 unreachable branches; S3 coverage deferral; D15 narrowing requirement.
- evidence: The seat identifies cast-removal guard returns after adoption preconditions at ast.ts:538,552,588 and index-bound checks at minimatch.ts:548,760,796,851, arguing they cannot be reached through valid input.
- failure: These guards may prevent the later branch-coverage floor; no actual invariant-breaking input or regression is demonstrated.
- fix: At S3 prove the preconditions, then express safe schema/type predicates or index-free iteration to remove unreachable branches while preserving D15 and upstream behavior. Do not silently introduce new invariant failures without evidence and the D9 protocol.
- seats: fable-1-11

### fable-1-12
- file: scratchpad/effected/glob/internal/braceExpansion.ts:34; scratchpad/effected/glob/internal/braceExpansion.ts:121
- class: docs   severity: backlog
- standard: Section 10.1 prose retargeting; S2 documentation deferral; D4 verbatim knowledge bundle.
- evidence: Two brace-expansion comments still call invalid max a TypeError defect, but assertCap now throws InvalidCap and braceExpansion.test.ts:229-231 expects InvalidCap. This is the prose-only part of grok-1-1, separate from its central deviation bookkeeping.
- failure: The adapted comments contradict the runtime error class.
- fix: During S2 replace TypeError with InvalidCap at both adapted-source sites; preserve KNOWLEDGE.md:68 verbatim.
- seats: fable-1-12, grok-1-1

### fable-1-13
- file: scratchpad/effected/glob/README.md:170
- class: docs   severity: backlog
- standard: Section 10.3 attribution; S2 documentation deferral.
- evidence: The attribution list contains repeated minimatch notices and six balanced-match/brace-expansion MIT license-body fragments rather than clear engine entries.
- failure: The adapted attribution obscures the vendored-engine provenance.
- fix: Replace the dump with clear engine entries for minimatch@10.2.5 (BlueOak-1.0.0), balanced-match@4.0.4 (MIT) and brace-expansion@5.0.7 (MIT), naming source/header/license pointers. Distinguish vendored minimatch 10.2.5 from the separately pinned 10.2.6 test oracle.
- seats: fable-1-13

### fable-1-14
- file: scratchpad/effected/glob/internal/minimatch.ts:724; scratchpad/effected/glob/internal/minimatch.ts:764; scratchpad/effected/glob/internal/ast.ts:846
- class: effect-idiom   severity: backlog
- standard: Law 21 terseness preference; section 11.3 S3 coverage deferral; D11.
- evidence: Integer length/position counters use n !== 0 && !Number.isNaN(n). The seat argues the NaN checks are dead but reports no behavior failure, measured regression or algorithmic-class improvement.
- failure: Redundant predicates complicate readability and possible branch coverage; this is not a demonstrated required helper-form violation.
- fix: During S3 verify the integer invariants and simplify to n !== 0, sharing the minimatch predicate where useful and preserving existing matching semantics.
- seats: fable-1-14

### fable-1-15
- file: scratchpad/effected/glob/GlobPattern.ts:92
- class: schema   severity: backlog
- standard: Laws 17/20 preference; D11 required boundary.
- evidence: optimizationLevel uses S.Finite with built-in integer/range checks for 0..2; a S.Literals([0,1,2]) schema has identical runtime acceptance and a narrower Type. The current schema already uses built-in checks; no broken discriminated lifecycle/variant model or observed behavior failure is shown.
- failure: The schema exposes number rather than the more informative 0 | 1 | 2 type; this is a possible refinement rather than an established law violation.
- fix: Consider S.optionalKey(S.Literals([0,1,2])) with the existing field annotation after confirming public type compatibility; keep EngineOptions and all acceptance/rejection semantics.
- seats: fable-1-15

## Handled by the deviation codemod

### codemod-1
- file: scratchpad/effected/glob/README.md:192; scratchpad/effected/glob/internal/assertValidPattern.ts:24; scratchpad/effected/glob/internal/limits.ts:64
- class: law   severity: backlog
- standard: Later operator ruling: one module/class deviation entry generated centrally; law 7; D9.
- evidence: The oracle native TypeError/Error throws became InvalidPattern, InvalidCap, BraceExpressionError, ASTError and MinimatchError. README Deviations says None and w1-glob.deviations is empty. The reports cite changed assertions in engine.test.ts:105,140-141, hostility.test.ts:128-132 and braceExpansion.test.ts:229-231, plus the invariant throw sites.
- failure: Only the recording of law-forced error-class replacements is missing; these reports do not establish that the replacement itself is wrong.
- fix: The central per-module tagged-error deviation codemod must generate one ledger/README family entry listing all affected sites and adjusted upstream assertions. Added exports belong in exportsAdded. Do not create site-by-site required fixes; prose retargeting is fable-1-12 backlog.
- seats: grok-1-1, sol-1-7, fable-1-1

### codemod-2
- file: scratchpad/effected/glob/GlobPattern.ts:37; scratchpad/effected/glob/GlobPattern.ts:39
- class: schema   severity: backlog
- standard: Later operator ruling: S.Number-to-S.Finite bookkeeping is central; schemaNumber TS377098; D9.
- evidence: The public limit/actual fields changed from oracle Schema.Number to S.Finite, narrowing direct decode acceptance, without a deviation entry. The report proposes only recording that law-driven narrowing. Its claim that the engine never emits a non-finite measurement is disproved by sol-1-1.
- failure: The final law-forced numeric-schema narrowing needs central recording; the actual Infinity runtime regression is separately required as sol-1-1.
- fix: After applying sol-1-1, generate the per-module numeric-schema deviation entry for the remaining law-forced S.Finite sites, with affected tests and the intentional non-finite actual exception. Record the final implementation, not the currently broken finite-only actual field.
- seats: fable-1-10

## Rejected

### fable-1-7-rejected
- file: scratchpad/effected/glob/internal/balancedMatch.ts:49; scratchpad/effected/glob/internal/braceExpressions.ts:61; scratchpad/effected/glob/internal/limits.ts:62
- class: effect-idiom   severity: backlog
- standard: EF-18 dual combinators; D9; later unforced-change ruling.
- evidence: The report combines the four optional-options wrappers with balanced/range, parseClass and assertCap, recommending removal of every dual wrapper. parseClass actually has data-first (glob, position) and correct data-last (position)(glob); its alleged reversed subject is false. EF-18 supplies a law basis for required-argument helper dual forms.
- failure: The mandatory-arity subset does not substantiate the proposed removal or a broken full-arity oracle contract.
- fix: No required removal of balanced/range, parseClass or assertCap follows from this report. Keep fable-1-7a for the independently evidenced optional-options subset.
- seats: fable-1-7
- rejection: Reject the blanket mandatory-arity removal: EF-18 supplies a law basis, parseClass is already correctly data-first, and no concrete failure proves the remaining convention claims.

### fable-1-8-rejected
- file: scratchpad/effected/glob/internal/limits.ts:40
- class: effect-idiom   severity: backlog
- standard: D9; section 14; sol-1-1 overflow evidence.
- evidence: The seat alternative deletes name = Error, changes the positional constructor and throw sites, and validates actual with S.Finite. The pinned upstream exposes the positional constructor/name, and the overflowing brace member count really is Infinity.
- failure: Those alternative changes would introduce an unforced error-name/constructor deviation and repeat the proven non-finite measurement defect.
- fix: Use the behavior-preserving S.TaggedError conversion in sol-1-2 instead; retain the seat contribution to that deduplicated schema-contract finding.
- seats: fable-1-8
- rejection: Reject this alternative fix: deleting the upstream name/constructor has no forced cause, and S.Finite for actual repeats the confirmed overflow bug.
