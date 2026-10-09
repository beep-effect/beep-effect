# semver — round-1 merged inventory

Seats read: `grok.md` (3 findings), `sol.md` (11), `fable.md` (15), and their shared `BRIEF.md`; no part-N reports exist. Review commit: `3fa5876691901fccf3d1cd29e9324564df134b56`. Oracle: the brief's pinned `af7566a9da2eff169cb74955efcc5ede1e5de9f8` semver package.

**REQUIRED: 13  BACKLOG: 7  CODEMOD: 3  REJECTED: 3  GROUPS: 1**

Applied the entire top operator revision/rulings/grilling block, D1–D20, sections 12.4/12.5 and 14. Counts are merged defects/dispositions, not seat totals; compound records are split where their remedies differ. Each contributing seat finding id is retained. Report fixes that conflict with later rulings are explicitly rejected. S2/S3 work stays backlog. Law-forced bookkeeping is owned by the per-module, per-class deviation codemod.

The live `standards/effect-laws.allowlist.jsonc` contains **zero semver entries** (no file under `scratchpad/effected/semver/**`), so there are no `allow-<n>` findings to add. No new allowlist exceptions are proposed.

Read-only differential probes reproduced all six Range counterexamples in both lab and pinned oracle; source inspection confirmed static-schema annotation omissions and the sort/import gate gaps. No full audit was rerun: the brief supplies the green-gate baseline. The codec regressions are proven behavioral defects, independent of the deferred property floor.

Write group `g1` owns six TypeScript source files, four tests, and the README/ledger records required for the verified upstream-bug fixes. The shared sort, alias and operator-domain findings connect the source surfaces; the Range tests also exercise normalization, so they remain with that owner. README and PORT_LEDGER.json are D9 recording surfaces, not additional source files. Law-forced records remain central codemod work and are excluded from required.json.

## Required

### sol-1-1 — Range.simplify removes every equivalent branch and loses union members.

- file: scratchpad/effected/semver/Range.ts:343
- class: bug   severity: required
- standard: D9, D11 and section 14 (verified upstream bug); simplify must preserve union membership.
- evidence: Sol's differential counterexample was reproduced read-only against both the lab and the pinned oracle: range ">=1.0.0 || >=1.0.0 || <0.5.0" matches 1.2.3 before simplify and rejects it afterwards. Fable's equivalent-set examples show the same mutual-elimination root cause; the all-empty fallback sometimes hides it.
- failure: Equivalent comparator sets eliminate one another; when an unrelated branch survives, simplify loses valid matches.
- fix: Remove strict subsets while retaining the earliest representative of mutually containing sets (break equivalence ties by original index). Retain all existing assertions and add duplicate-plus-unrelated and equivalent-set regressions in Range.test.ts. Record the verified upstream-bug deviation in PORT_LEDGER.json and README Port notes, citing the regressions.
- seats: sol-1-1; fable-1-11

### sol-1-2 — Range intersection broadens prerelease admission.

- file: scratchpad/effected/semver/Range.ts:273
- class: bug   severity: required
- standard: D9, D11 and section 14 (verified upstream bug); intersection membership equals conjunction of operand membership.
- evidence: Reproduced in lab and oracle: a = ">=1.0.0-alpha", b = "<2.0.0", v = 1.0.0-beta gives a.test(v)=true, b.test(v)=false, intersectResult(a,b).success.test(v)=true. Range.ts concatenates the sets, while testComparatorSet permits a prerelease tuple when any merged comparator mentions it.
- failure: Intersection combines prerelease permissions with OR, accepting versions rejected by one operand.
- fix: Construct each intersection with both operands' prerelease restrictions: separate stable bounds from prerelease branches and retain a prerelease tuple only when both original sets admit it. Add the counterexample and membership-conjunction regressions to Range.test.ts without weakening existing tests. Record the upstream-bug deviation in PORT_LEDGER.json and README.
- seats: sol-1-2

### sol-1-3 — Range subset checks ignore prerelease tuple permissions.

- file: scratchpad/effected/semver/Range.ts:483
- class: bug   severity: required
- standard: D9, D11 and section 14 (verified upstream bug); conservative subset approximation may have false negatives, not false positives.
- evidence: Reproduced in lab and oracle: isSubset(">=1.0.0-alpha <2.0.0", ">=0.0.0 <2.0.0") is true, although 1.0.0-beta matches only the first range. isComparatorSetSubset checks comparator implication and never checks tuple admission.
- failure: False containment lets simplify discard a union branch that admits otherwise rejected prereleases.
- fix: Before declaring containment, conservatively establish that the superset admits every potentially matching prerelease tuple admitted by the subset; return false when this cannot be established. Add subset and union-simplification membership regressions in Range.test.ts and record the upstream-bug deviation in PORT_LEDGER.json and README.
- seats: sol-1-3

### sol-1-4 — Range satisfiability accepts empty gaps between adjacent stable versions.

- file: scratchpad/effected/semver/Range.ts:445
- class: bug   severity: required
- standard: D9, D11 and section 14 (verified upstream bug); intersectResult must fail with UnsatisfiableConstraintError when no admissible version exists.
- evidence: Both lab and oracle return Success for intersectResult(">1.0.0", "<1.0.1"). These adjacent patch endpoints leave no stable version between them, and neither comparator admits prereleases. isSetSatisfiable merely compares ordered endpoints.
- failure: Satisfiability treats the SemVer domain as dense and reports an intersection that matches no version.
- fix: Require an actual admissible witness satisfying every comparator: check the least possible stable version within the bounds and any permitted prerelease tuples. Reject candidates with no witness. Add the adjacent-patch regression in Range.test.ts and record the upstream-bug deviation in PORT_LEDGER.json and README.
- seats: sol-1-4

### sol-1-5 — Range parsing throws on desugared safe-integer overflow.

- file: scratchpad/effected/semver/Range.ts:136
- class: bug   severity: required
- standard: D9, D11 and section 14 (verified upstream bug); Effect-first EF-1/EF-3 typed boundary validation.
- evidence: Both lab and oracle throw "Schema validation failed" for parseResult("^9007199254740991.0.0") and parseResult("~1.9007199254740991.0"). Desugaring increments an initially safe component past the cap; the subsequent SemVer.make throws outside Result. Sol also observed a defect in Effect.runSyncExit(Range.parse(...)).
- failure: Valid grammar can trigger a defect instead of the declared InvalidRangeError failure channel.
- fix: Validate normalized/desugared comparator parts with a non-throwing schema decoder before constructing Range. Translate validation failure to InvalidRangeError with the original input and available position. Add incrementing-sugar boundary regressions for parseResult and parse in Range.test.ts; record the upstream-bug deviation in PORT_LEDGER.json and README.
- seats: sol-1-5

### sol-1-6 — Range.FromString changes membership when serializing empty model structures.

- file: scratchpad/effected/semver/Range.ts:96
- class: bug   severity: required
- standard: D9, D11 and section 14 (verified upstream bug); successful codec serialization must preserve represented membership.
- evidence: Reproduced in lab and oracle with encodeUnknownResult/decodeUnknownResult: sets: [] encodes to "" and changes 1.0.0 membership from false to true; sets: [[]] also encodes to "" and changes 1.0.0-beta membership from true to false.
- failure: Distinct accepted empty models serialize to the same stable-only wildcard and silently change semantics. This is a demonstrated codec bug, not a deferred property-floor finding.
- fix: In Range.FromString's encode boundary, encode the empty union as an explicitly unsatisfiable expression (for example "<0.0.0-0"). Fail through a typed schema encoding issue for unrestricted empty comparator sets that the string grammar cannot represent. Keep formatRange unchanged for representable nonempty sets. Add both model round-trip regressions in Range.test.ts and record the upstream-bug deviation in PORT_LEDGER.json and README.
- seats: sol-1-6

### sol-1-7 — Public exact/pinnable string schemas and reusable checks lack identity metadata.

- file: scratchpad/effected/semver/SemVer.ts:143,164
- class: schema   severity: required
- standard: D5; operator revision step 4; standards/effect-first-development.md EF-12/EF-12c; effect-laws-v1 laws 17/18.
- evidence: Sol's probe found both string schemas and their custom filters without annotations; a fresh read-only probe reproduced absent schema AST annotations. Source constructs ExactVersionString and PinnableVersionString independently with S.String and unannotated S.makeFilter. The owning class's identity does not propagate to these statics.
- failure: Two public schemas and their reusable checks lack composer-derived identity/title/description despite the green gates; the runtime annotation inspection demonstrates the miss.
- fix: Annotate both string schemas with $I.annoteSchema metadata and both custom filters with composer-derived identifier, title and description. Preserve string types and validation behavior. Add metadata and unchanged-validation assertions in SemVer.test.ts.
- seats: sol-1-7

### fable-1-1 — VersionCache query thunks were changed into Effect properties without operator authorization.

- file: scratchpad/effected/semver/VersionCache.ts:82,84,86,204-214
- class: law   severity: required
- standard: D9; operator Grilling, 2026-10-09 (later), explicit VersionCache thunk-restoration ruling.
- evidence: Oracle VersionCacheShape uses () => Effect for versions/latest/oldest; the lab uses Effect properties and Effect.suspend. VersionCache.test.ts:27,38,47,55,63,66,75,76 was rewritten to property access. The operator names this exact change and orders restoration, overriding the reports' competing lazyEffect justification.
- failure: Upstream callers invoking cache.latest(), cache.oldest() or cache.versions() fail; rewritten tests conceal unauthorized API drift.
- fix: Restore upstream query signatures and implementations: versions: () => Ref.get(ref), latest/oldest as their upstream Effect.fn thunks; remove property-shape suspend wrappers. Restore the eight upstream test lines in VersionCache.test.ts and the upstream thunk documentation in VersionCache.ts. Do not retain this shape as a recorded deviation.
- seats: fable-1-1; grok-1-2; sol-1-8

### fable-1-3 — Tagged bump overflow error has unstructured message and an unserializable cause schema.

- file: scratchpad/effected/semver/SemVer.ts:600-610
- class: schema   severity: required
- standard: .patterns/error-handling.md structured error fields and Defect causes; effect-laws-v1 law 19; D5.
- evidence: SemVerBumpOverflowError stores { message: S.String, cause: S.Unknown } although overflow knows the component. The module's other errors derive messages from structured payloads; S.Unknown encodes the raw SchemaError rather than a serializable defect. This payload-shape issue is not checked by the green native-error gate.
- failure: The law-forced tagged error loses structured component information and the documented serializable error contract.
- fix: Keep S.TaggedError. Introduce an identity-annotated SemVerBumpComponent LiteralKit; store component and cause: S.Defect({ includeStack: true }); derive the existing message text in a getter. Pass { component, cause } from overflow. Add structured-field and cause encode/decode assertions in SemVer.test.ts while retaining current overflow-message checks. Delegate recording of the law-forced tagged-error replacement to the codemod.
- seats: fable-1-3

### fable-1-6 — Three native array sorts evade the hotspot-scoped law gate.

- file: scratchpad/effected/semver/SemVer.ts:393,398; scratchpad/effected/semver/internal/normalize.ts:20
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; D5.
- evidence: Source contains three native .sort calls. NoNativeRuntime.ts:463 only checks sort inside inHotspotScope; NoNativeRuntimeHotspots.ts's extra-check patterns exclude scratchpad/effected/semver. The source and checker scope verify the green-gate miss.
- failure: Domain sorting violates law 10 at three sites.
- fix: Use A.sort(versions, SemVer.Order) and A.sort(versions, Order.flip(SemVer.Order)); replace normalize's native sort with A.sort and an explicit Order comparing operator weight then version precedence. Preserve stable ordering, build-metadata deduplication, fresh-array return behavior and existing tests; add focused ordering assertions in SemVer.test.ts and Range.test.ts.
- seats: fable-1-6

### fable-1-7 — Array imports use the noncanonical Arr namespace alias.

- file: scratchpad/effected/semver/SemVer.ts:2; scratchpad/effected/semver/VersionCache.ts:2; scratchpad/effected/semver/internal/order.ts:9
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 1 (A/O/P/R/S aliases).
- evidence: All three source files import effect/Array as Arr. The runner does execute effect-imports on a mirror (Gates.ts:575), so scratchpad exclusion alone is not the miss; EffectImports.ts preserves namespace local names and checks root/specifier routing, not canonical alias spelling.
- failure: The mandated Array namespace alias is violated in three files despite the green import gate.
- fix: Rename Arr to A in SemVer.ts, VersionCache.ts and internal/order.ts and update all uses. Coordinate with the same group's thunk and sort fixes; preserve behavior.
- seats: fable-1-7

### fable-1-8 — ComparatorOperator is a duplicated named literal domain instead of a LiteralKit.

- file: scratchpad/effected/semver/internal/order.ts:23; scratchpad/effected/semver/Comparator.ts:59; scratchpad/effected/semver/internal/normalize.ts:10-16
- class: schema   severity: required
- standard: D5; effect-laws-v1 law 19; AGENTS.md named LiteralKit domains.
- evidence: ComparatorOperator is a named type union reused by order, desugar and grammar; Comparator.operator independently repeats it as S.Literals. operatorWeight matches string with an unreachable fallback. Green gates do not enforce consolidation of this named schema domain.
- failure: The reused operator domain has no single schema source of truth and its weight dispatch is not exhaustive.
- fix: Define an identity-annotated ComparatorOperator LiteralKit and derive its type in internal/order.ts; use that schema for Comparator.operator with field annotations. Type operatorWeight with the domain and match exhaustively, removing orElse. Preserve all five operators and their current weights; add domain/weight behavior assertions to Comparator.test.ts and Range.test.ts. Existing type-only consumers need no edits.
- seats: fable-1-8

### fable-1-9 — SemVer.groupBy reimplements the available Effect grouping helper.

- file: scratchpad/effected/semver/SemVer.ts:429-441
- class: effect-idiom   severity: required
- standard: AGENTS.md Effect helpers and Discovery & Reuse; effect-laws-v1 law 21; D11 cited Effect idiom.
- evidence: SemVer.groupBy manually accumulates a mutable record in a twelve-line loop. Effect Array.groupBy already returns a compatible Record of nonempty groups; grouping SemVer.sort(versions) preserves ascending members and first-key insertion order. Green gates do not detect this manual reimplementation.
- failure: A stock Effect grouping operation is reimplemented with native record mutation.
- fix: Return A.groupBy(SemVer.sort(versions), the existing exhaustive strategy-to-key match). Preserve public Record shape and group/member ordering; retain existing groupBy checks and add focused ordering coverage in SemVer.test.ts. The applicable defect is helper reuse; an ordinary record literal alone is not evidence of a banned Object.* call.
- seats: fable-1-9

## Backlog

### backlog-1 — Deferred JSDoc carrier, metadata and dependent example conversion.

- file: scratchpad/effected/semver/Comparator.ts:95,101; scratchpad/effected/semver/SemVer.ts:584-599 (and other public declarations)
- class: jsdoc   severity: backlog
- standard: Operator ordering: S2 has not run; .patterns/jsdoc-documentation.md; section 10.2.
- evidence: Legacy @remarks/@example/@public and missing canonical category/since metadata remain across public declarations. Fable also identifies the overflow-error example that must be aligned after its required payload fix.
- failure: Carried JSDoc has deferred carrier/metadata work and a dependent example update.
- fix: During S2, retain prose and examples, convert carriers to titled Example and Details/Gotchas sections, add canonical category/since tags, and update the overflow example to construct the final component/cause payload.
- seats: sol-1-9; fable-1-15

### backlog-2 — Deferred canonical Option assertions.

- file: scratchpad/test/semver/Range.test.ts:89-91 (also SemVer and VersionCache suites)
- class: test   severity: backlog
- standard: Operator ordering: S3 has not run; effect-vitest-canon D5; testing-patterns assertion policy.
- evidence: Option values are compared with deepStrictEqual and isNone instead of canonical Option assertion helpers.
- failure: Deferred test-canon criteria remain unmet.
- fix: During S3, replace these with assertSome(expected payload) and assertNone from @effect/vitest/utils without changing assertion meaning.
- seats: sol-1-10

### backlog-3 — Deferred property floor and fcRuns migration.

- file: scratchpad/test/semver/Range.test.ts:51; scratchpad/test/semver/VersionDiff.test.ts (module-wide property registrations)
- class: test   severity: backlog
- standard: D10 and S3; operator ordering defers the property floor.
- evidence: Range and VersionDiff have fixed-example codec round trips; scoped tests have only SemVer/Comparator properties and no fcRuns. This property-floor gap is separate from the concrete required Range codec bug.
- failure: Generated round-trip, fidelity/idempotence and controlled run floors are incomplete.
- fix: During S3, add schema-derived round-trip and parser/formatter properties for uncovered exported surfaces, use fcRuns(n) in property registration options, retain all oracle assertions and required bug regressions.
- seats: sol-1-11

### backlog-4 — Optional extrema and adjacent-dedupe consolidation.

- file: scratchpad/effected/semver/SemVer.ts:402-417; scratchpad/effected/semver/Range.ts:202-226; scratchpad/effected/semver/VersionCache.ts:121-124
- class: effect-idiom   severity: backlog
- standard: D11; law 21 helper preference; upstream-verbatim behavior; no measured performance regression.
- evidence: Correct upstream max/min scans and adjacent dedupe have existing A.max/A.min/dedupeAdjacentWith alternatives. The report itself says none is wrong and supplies no measured regression or algorithmic-class improvement.
- failure: Optional consolidation could reduce duplicated scans; no demonstrated behavioral defect.
- fix: Consider A.max/A.min after a nonempty guard, Range extrema delegating to SemVer extrema over range.filter, and A.dedupeAdjacentWith over sorted versions, preserving equality and empty-array behavior.
- seats: fable-1-10

### backlog-5 — Optional kits for currently anonymous literal domains.

- file: scratchpad/effected/semver/VersionDiff.ts:10,48; scratchpad/effected/semver/SemVer.ts:373-377,427
- class: schema   severity: backlog
- standard: D11; law 19 allows anonymous inline unions; optional schema-domain consolidation.
- evidence: Diff kind, group strategy and truncate level are duplicated anonymous unions; the report acknowledges they are not named domains upstream. No failing behavior or gate diagnostic is shown. Overflow component is already owned by required fable-1-3.
- failure: Potential drift in anonymous domains, without an established required violation.
- fix: Consider VersionDiffType, GroupByStrategy and TruncateLevel LiteralKits where a named shared domain is useful; preserve current accepted values and signatures. Do not duplicate the required overflow-component fix.
- seats: fable-1-13

### backlog-6 — Deferred README API-description alignment.

- file: scratchpad/effected/semver/README.md:1 (Errors and Version cache sections)
- class: docs   severity: backlog
- standard: D4; section 10.3; operator ordering defers S2 documentation.
- evidence: README lists seven errors and lacks the new synchronous overflow error; cache prose must match the explicitly restored query thunks after required fable-1-1.
- failure: Carried user documentation does not describe the final port surface.
- fix: During S2, add the structured overflow-error row and clarify synchronous throwing; align Version cache prose with restored upstream thunks. Keep the central Port-notes bookkeeping under codemod records below.
- seats: fable-1-14

### backlog-7 — Optional public barrel exposure of the newly introduced overflow error.

- file: scratchpad/effected/semver/index.ts:39; scratchpad/test/semver/SemVer.test.ts:9
- class: effect-idiom   severity: backlog
- standard: D2 permits added exports and requires upstream export parity; D13 permits internal test imports; D11.
- evidence: SemVerBumpOverflowError is exported by SemVer.ts but absent from index.ts; tests import its defining file. Fable requests a new barrel export and a test-import switch, separately from recording the law-forced replacement.
- failure: The proposed convenience barrel export is outside D11: no cited rule requires a newly introduced internal export in the public barrel, no upstream export is missing, and the internal test import is permitted.
- fix: Consider exporting SemVerBumpOverflowError from index.ts and switching the test import during public-surface cleanup. If published, let the central codemod record it in exportsAdded and README Added exports; do not treat that bookkeeping as a required fix.
- seats: fable-1-2

## Handled by the deviation codemod

### codemod-1 — Record composer-derived JSON Schema keys centrally.

- file: scratchpad/effected/semver/SemVer.ts:90; scratchpad/test/semver/SemVer.test.ts:431,434
- class: law   severity: backlog
- standard: Operator Grilling, 2026-10-09 (later): per-module/per-class identity-key deviation codemod.
- evidence: Composer identity changed the JSON Schema definition name from SemVerEncoded to @beep/scratchpad/effected/semver/SemVer/SemVerEncoded; two oracle assertions were retargeted, while README/ledger still report no deviations.
- failure: Law-forced identity-key change needs central records, not a per-site required finding.
- fix: Generate one module identity-keys deviation entry in the ledger and README, listing schema sites and the adjusted JSON Schema assertions.
- seats: fable-1-4
- disposition: Handled centrally by the deviation codemod; not required.

### codemod-2 — Record Number-to-Finite substitutions centrally.

- file: scratchpad/effected/semver/VersionDiff.ts:54-58; scratchpad/effected/semver/SemVer.ts:36,46; scratchpad/effected/semver/Comparator.ts:26; scratchpad/effected/semver/Range.ts:31
- class: law   severity: backlog
- standard: Operator Grilling, 2026-10-09 (later): per-module/per-class S.Finite codemod; schemaNumber diagnostic.
- evidence: VersionDiff deltas and the three optional error-position fields changed Number to Finite, rejecting nonfinite inputs that upstream accepted. The nonNegativeInteger base also uses Finite, but its existing integer/bounds checks already rejected nonfinite components (Grok's stronger qualification).
- failure: Law-forced numeric narrowing is unrecorded.
- fix: Generate one module S.Finite deviation entry listing every substitution and its actual behavior effect; note which sites have no semantic change and whether upstream tests were adjusted. Keep S.Finite.
- seats: grok-1-3; sol-1-8; fable-1-5
- disposition: Handled centrally by the deviation codemod; not required.

### codemod-3 — Record native-error replacement and actual added exports centrally.

- file: scratchpad/effected/semver/SemVer.ts:600-610; scratchpad/test/semver/SemVer.test.ts:238
- class: law   severity: backlog
- standard: Operator Grilling, 2026-10-09 (later): tagged-error deviation codemod and exportsAdded; effect-laws-v1 law 7.
- evidence: Native Error was replaced with SemVerBumpOverflowError, and the oracle instanceof assertion changed to that class; ledger deviations/exportsAdded and README Port notes are empty.
- failure: The law-forced replacement and any actual added public export need central bookkeeping. The payload defect remains required as fable-1-3; the optional barrel edit is backlog-7.
- fix: Generate one tagged-errors ledger/README deviation entry citing the adjusted assertion and law 7. Populate exportsAdded and README Added exports from the final actual export surface rather than inventing a barrel export.
- seats: sol-1-8; fable-1-2
- disposition: Handled centrally by the deviation codemod; not required.

## Rejected

### reject-1 — Restore native Error

- file: scratchpad/effected/semver/SemVer.ts:607
- class: bug   severity: backlog
- standard: Operator tagged-error ruling; effect-laws-v1 law 7.
- evidence: Grok proposes deleting SemVerBumpOverflowError and reinstating new Error to restore upstream tag/constructor; the report overlooks the production native-Error law.
- failure: The proposed fix reintroduces a forbidden native error.
- fix: Retain the tagged error; fix its payload under fable-1-3 and centralize records under codemod-3.
- seats: grok-1-1
- rejection: Rejected: restoring new Error contradicts law 7 and the operator's tagged-error replacement ruling.

### reject-2 — Keep and record VersionCache property shape

- file: scratchpad/effected/semver/VersionCache.ts:82,84,86
- class: docs   severity: backlog
- standard: Operator Grilling, 2026-10-09 (later), explicit VersionCache restoration.
- evidence: Grok proposes retaining Effect properties as a lazyEffect deviation; Sol's compound bookkeeping record makes the same proposal, and Fable offers recording it as an alternative.
- failure: Recording would preserve the unauthorized shape rather than restore the upstream oracle.
- fix: Restore the thunks and rewritten upstream test lines under required fable-1-1; do not generate a cache-property deviation.
- seats: grok-1-2; sol-1-8 (cache portion); fable-1-1 (alternative only)
- rejection: Rejected: keeping the cache-property shape contradicts the operator's explicit restore-upstream ruling, even though lazyEffect is configured as an error.

### reject-3 — Remove internal dual wrappers

- file: scratchpad/effected/semver/internal/order.ts:36,50,80; scratchpad/effected/semver/internal/desugar.ts:106,176
- class: effect-idiom   severity: backlog
- standard: Green tsgo gate; tsconfig.base.json:176 missingPipeableSignature=error; Effect-tsgo docs/rules/missing-pipeable-signature.md (TS377101).
- evidence: Oracle diff confirms plain exported fixed-arity helpers became dual. Unlike the unsupported premise in the finding, the actual configured diagnostic reports exported fixed-arity functions lacking a pipeable overload, including these internal exports; EF-18 also calls for dual reusable combinators.
- failure: The proposed rollback would remove diagnostic-forced overloads. There is no measured runtime regression or demonstrated bug in the wrappers.
- fix: Keep diagnostic-forced dual overloads and the D15-safe operator narrowing. Do not restore upstream casts or plain fixed-arity signatures.
- seats: fable-1-12
- rejection: Rejected: the existing error-level missingPipeableSignature diagnostic forces the overloads; the claim that no diagnostic requires them is false.

REQUIRED: 13  BACKLOG: 7  CODEMOD: 3  REJECTED: 3  GROUPS: 1

