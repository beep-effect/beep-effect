# walker — round-1 inventory

Seats read: `grok.md`, `sol.md`, `fable.md`, and their shared `BRIEF.md`; no `part-N` directories.
Reviewed commit: `3fa5876691901fccf3d1cd29e9324564df134b56`.
The current walker source/test surface has no committed diff from that reviewed commit and no dirty source/test changes.
All 27 seat finding records are accounted for below; compound findings are split by disposition and duplicate defects are merged.

Counts after merge: **Required 7 · Backlog 8 · Codemod 1 · Rejected 1 · Groups 1**.

Binding precedence: the complete operator revision/rulings at the top of `EFFECTED_PORT_GOAL.md`, D1-D20, section 12.5 and section 14. S2/S3 documentation, JSDoc, property/coverage and vitest-canon work stays backlog. Green gates are not treated as proof for sites the reports demonstrate they omit. Internal representation fixes preserve upstream behavior; unforced oracle divergence must be restored rather than recorded as a deviation. No actionable unforced implementation divergence is established by these reports.

Allowlist check: `standards/effect-laws.allowlist.jsonc` contains **zero** entries whose file is under `scratchpad/effected/walker/**`; therefore there are no `allow-<n>` findings. Native-runtime misses reported by the seats remain explicit findings.

Ownership: `g1` owns `Descend.ts`, `Expand.ts`, `Walker.ts`, `index.ts` and the four walker test files in `required.json`. Overlapping model, getter and fixture changes are intentionally kept together. No root manifest, lockfile, repository configuration, ledger or README Port-notes write is assigned. Central bookkeeping is represented under the codemod section only. This inventory merge writes exactly `INVENTORY.md` and `required.json`; graph refreshes, session-ledger writes and implementation are outside this read-mostly task.

## Required

### req-1

- file: scratchpad/effected/walker/Descend.ts:402
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10; standards/effect-first-development.md EF-38; D11.
- evidence: The source calls results.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)). Fable identifies the concrete gate miss: NoNativeRuntime.ts:463 checks sort only under inHotspotScope; walker is outside that scope. The checker condition was confirmed by read-only inspection. Fable reports errors=0 for the source scan and verifies lexical order against Effect 4.0.2.
- failure: Production traversal still uses forbidden native Array.prototype.sort; the green scanner does not enforce this site.
- fix: Import effect/Array as A and effect/Order, and replace the final sort and return with return finish(A.sort(results, Order.String)). Preserve lexical path order and the existing sorted-result assertions in Descend.test.ts.
- seats: sol-1-5, fable-1-1

### req-2

- file: scratchpad/effected/walker/Descend.ts:159; scratchpad/effected/walker/Expand.ts:86
- class: law   severity: required
- standard: standards/effect-first-development.md EF-3 and EF-19; D11.
- evidence: DescendError.message calls JSON.stringify at Descend.ts:159, :161 and :162; GlobExpansionError.message calls it at Expand.ts:86. Fable establishes that NoNativeRuntime.ts has no JSON-call detector, while Walker.ts:17/:89-90/:147-148 already uses the schema JSON codec. The getter sites were confirmed in source.
- failure: Both public error getters retain native JSON serialization despite the schema-codec requirement; green gates miss these calls.
- fix: Use S.fromJsonString(S.String) with S.encodeResult and an explicit synchronous Result codec in both getters, following the existing Walker quoting implementation. Keep getters synchronous and preserve quoting, escaping, the 64-character truncation and all upstream message bytes. Retain or extend exact-message assertions in Descend.test.ts and Expand.test.ts.
- seats: sol-1-4, fable-1-2

### req-3

- file: scratchpad/effected/walker/Descend.ts:108,133,198; scratchpad/effected/walker/Walker.ts:24; scratchpad/effected/walker/Expand.ts:34; scratchpad/effected/walker/index.ts:19
- class: schema   severity: required
- standard: standards/effect-first-development.md EF-33; standards/ARCHITECTURE.md section 5; schema-first-development/references/repo-laws.md sections 1-3; D2, D5 and D11.
- evidence: UnreadableDirectory, DescendResult, DescendFrame, AscendOptions and CompileAndExpandOptions are interface-only representable data shapes. Fable identifies the enforcement gap: the schema-first inventory scans packages/**, leaving walker out. PlatformError and GlobPatternOptions already provide schemas for the composed fields. DescendOptions/DescendRecordOptions explicitly discriminate return overloads (Descend.ts:81-96 and Descend.test.ts:580-609).
- failure: Concrete result, configuration and traversal-state models have no schema source of truth or identity annotations. This is independent of the green compiler and lint gates.
- fix: Define identity-annotated schemas and same-name derived types for UnreadableDirectory, DescendResult, DescendFrame, AscendOptions and CompileAndExpandOptions. Use S.Struct where the existing plain object is the actual boundary result; preserve optional fields, supplied object literals, invalid-depth defects and result prototypes. Keep DescendOptions and DescendRecordOptions as the EF-33 overload-only exception, preserving their record-vs-array discriminator; CompileAndExpandOptions must continue to exclude record. Update index.ts to re-export newly introduced runtime schema values under the existing names. Preserve the overload-resolution lines and structural-result assertions in Descend.test.ts, option tests in Walker.test.ts, and compileAndExpand option tests in Expand.test.ts. Added-export bookkeeping belongs to the central codemod.
- seats: sol-1-2, fable-1-4

### req-4

- file: scratchpad/effected/walker/Descend.ts:156,160
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 20; standards/effect-first-development.md EF-13; D9, D11 and section 14.
- evidence: Sol reports successful decoding of depthExceeded without limit and unreadableDirectory with limit:1. The pinned oracle also has an optional limit and the same depth-cap fallback; its source was read. Fable correctly identifies this as a compatibility boundary. However, the lab getter branches directly on that public optional bag instead of normalizing before case-specific behavior, which EF-13 explicitly requires.
- failure: Internal case-specific message behavior operates directly on an external optional payload bag. The public acceptance of legacy combinations is not itself established as a bug.
- fix: Preserve the public DescendError schema, reason/limit access and all upstream accepted payloads. Normalize to an internal schema-derived discriminated union before the getter branches: an unreadable case without a depth payload and a depth case carrying the cap as Option, so absent cap still renders "the depth cap". Use the derived match helper for rendering. Keep wrong-case public limit behavior unchanged; do not add a required-limit check or tighten public decoding. Add focused assertions in Descend.test.ts for both legacy payload combinations and unchanged messages. This narrows Sol's proposal to the cited internal-normalization rule and drops Fable's conditional public tightening.
- seats: sol-1-3, fable-1-6

### req-5

- file: scratchpad/effected/walker/Descend.ts:238,267
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-2 and Operating Model; AGENTS.md Code Laws; D11.
- evidence: typeOf returns Effect<FileSystem.File.Info["type"] | undefined> and absorbs stat failures with undefined at :241. realPathOf returns Effect<string | undefined, DescendError> at :267-279. These sentinels drive traversal at :290, :303, :310 and :384. The actual helper signatures and branches were read; the review identifies an idiom outside the reported green diagnostic checks.
- failure: Filesystem absence remains an undefined union after crossing into domain traversal.
- fix: Return Option from typeOf and realPathOf and consume it with Option guards/combinators at every traversal branch, including the symlink-versus-plain-directory branch. Keep stat-failure absorption, NotFound races, fail/skip/record behavior, defect propagation, ancestor-chain cycle safety and all public results unchanged. Preserve the literal, missing-base, unreadable and symlink tests in Descend.test.ts.
- seats: sol-1-6

### req-6

- file: scratchpad/effected/walker/Descend.ts:53,96,152,212
- class: schema   severity: required
- standard: D5 (LiteralKit for literal domains); standards/effect-laws-v1.md laws 17 and 19; standards/effect-first-development.md EF-12/EF-13; AGENTS.md Code Laws; D11.
- evidence: The reused onUnreadable domain is spelled as fail/skip at :53, record at :96 and fail/skip/record at :212, then branched on at :270-276 and :338-344. DescendError.reason is an anonymous two-literal schema at :152 and is branched on at :160. Fable supplies both concrete sites and a concrete LiteralKit migration; no current gate catches the reused TS domain.
- failure: A reused finite mode domain lacks its required named schema source of truth. Promoted from the seat's backlog because D5 explicitly requires LiteralKit and the domain is reused rather than a one-off anonymous union.
- fix: Introduce module-local OnUnreadable and DescendErrorReason LiteralKit domains with identity annotations, using @beep/schema and no inline as const. Derive the mode types while keeping DescendOptions limited to fail/skip and DescendRecordOptions fixed to record; use kit guards/match helpers for the mode decisions and compose the internal error cases from req-4. Preserve all three modes and the overload assertions in Descend.test.ts.
- seats: fable-1-5

### req-7

- file: scratchpad/test/walker/fixtures.ts:32,44,74-80; scratchpad/test/walker/Descend.test.ts:397,458,481; scratchpad/test/walker/Expand.test.ts:120
- class: law   severity: required
- standard: D5 (Effect collections only); EFFECTED_PORT_GOAL.md section 16 (never use native Set/Map); standards/effect-laws-v1.md law 6; D11.
- evidence: Fixture options use ReadonlySet<string>, defaults construct new Set<string>(), and three Descend fixture inputs plus one Expand fixture input construct native Sets. Fable shows the gate gap: scanning all eight walker files reports scanned_files=4 because tests are excluded. Source inspection confirms these sites. This is a collection-law finding, not a deferred vitest-canon or coverage finding.
- failure: Native sets remain in module-owned fixtures and call sites despite the port's explicit collection restriction. Promoted from backlog: the test scanner exclusion explains the green gate but does not override D5 or the port's hard rule.
- fix: Change unreadable/vanished options to HashSet.HashSet<string>, default with HashSet.empty, query with HashSet.has, and seed from HashSet.union. Replace all four supplied new Set instances with HashSet.make. Keep fault membership, fixture trees, unreadable walk order and assertions unchanged. Use R.toEntries for the adjacent fixture Object.entries loops as part of the same local conversion; defer the independent Walker.test.ts Object.fromEntries cleanup to backlog-7. Touch fixtures.ts, Descend.test.ts and Expand.test.ts.
- seats: fable-1-7

## Backlog

### backlog-1

- file: scratchpad/effected/walker/Walker.ts:213,284; scratchpad/effected/walker/Descend.ts:81,112,410-469; scratchpad/effected/walker/Expand.ts:94
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md; EFFECTED_PORT_GOAL.md sections 10.1-10.2; operator deferral of S2.
- evidence: All three seats identify legacy @remarks/@example/@public carriers and missing category/version/example metadata outside descend. Fable additionally compares the merged descend docs with oracle :390-398 and identifies dropped record-mode guarantees. Walker.ts:284 still names Effect.catch while :173 calls Effect.orElseSucceed.
- failure: Remaining export documentation lacks canonical carriers and metadata; one combinator name is stale and protected record-mode prose was lost. S2 has not run, so this is backlog.
- fix: During S2, preserve upstream prose, convert carriers to titled Example and Details/Gotchas sections, add meaningful examples and category/@since metadata, name Effect.orElseSucceed while retaining the failures-not-defects warning, and restore the missing readDirectory/realPath, non-NotFound and never-aborts/never-discards guarantees.
- seats: grok-1-3, sol-1-7, fable-1-10

### backlog-2

- file: scratchpad/effected/walker/README.md:3-20,28-42,49-51,69-70,88
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3; standards/effect-laws-v1.md law 2; operator deferral of S2.
- evidence: Grok, Sol and Fable identify root effect-barrel imports in README fences. Fable also locates retained release badges, stability text, Install section and @effected/walker import examples. Grok's separate deviation-record subfinding is assigned to codemod-1.
- failure: The carried README teaches forbidden imports and retains upstream release chrome. S2 is deferred.
- fix: During S2, drop the release badges, stability block and Install section, update the walker example specifier and dedicated effect/<Module> imports (O for Option), and retain explanatory prose. Leave Port notes to the central deviation codemod.
- seats: grok-1-2, sol-1-8, fable-1-11

### backlog-3

- file: scratchpad/test/walker/Descend.test.ts:585
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md EV001; .patterns/testing-patterns.md; operator deferral of S3.
- evidence: The plain overload-resolution it callback calls Effect.runSync(GlobPattern.compile(...)); Grok contrasts the oracle's unsafe stand-in cast and supplies an it.effect migration.
- failure: An Effect runs through a manual runner in the test callback; canonical execution migration belongs to S3.
- fix: During S3, yield compilation in it.effect, retaining every satisfies/type assertion assignment, the @ts-expect-error guard and overload-selection meaning. Do not restore the unsafe oracle cast; that earlier adjustment was forced by D15.
- seats: grok-1-4

### backlog-4

- file: scratchpad/test/walker/Walker.test.ts:203; scratchpad/test/walker/Descend.test.ts:111-112
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D5; .patterns/testing-patterns.md; operator deferral of S3.
- evidence: Sol identifies deepStrictEqual of Option.some/none throughout upward suites and hand-written Exit tag/Cause.hasDies checks, including Descend.test.ts:111-112.
- failure: Container equality and manual Exit checks do not use canonical specialized assertions. S3 has not run.
- fix: During S3, use assertSome/assertNone and appropriate Exit/Cause helpers, retaining expected payloads, defect identity and probe-order assertions.
- seats: sol-1-9

### backlog-5

- file: scratchpad/test/walker/Descend.test.ts:1; scratchpad/test/walker/Expand.test.ts:1
- class: test   severity: backlog
- standard: D10; EFFECTED_PORT_GOAL.md section 11.4; operator deferral of S3.
- evidence: All three seats find no Arbitrary, property registration or fcRuns use in walker tests. DescendError and GlobExpansionError have only example tests; the latter contains a nested GlobPatternError/DescendError cause union. No numerical coverage claim is inferred.
- failure: The required exported-schema round-trip property floor has not been implemented; its stage is S3.
- fix: During S3, add schema-derived encode/decode fidelity properties for both errors and the supported nested causes, routing runs through @beep/fc-runs. Include any schemas added by req-3 when S3 inventories the final exports.
- seats: grok-1-5, sol-1-10, fable-1-12

### backlog-6

- file: scratchpad/test/walker/fixtures.ts:2
- class: tsgo   severity: backlog
- standard: D11; standards/effect-laws-v1.md Dual-Arity Inventory Contract; effect-tsgo directive documentation.
- evidence: Fable locates a missingPipeableSignature:skip-file directive covering the whole fixture file even though the two exports have the explicitly excluded (input, options?) shape. The seat acknowledges the suppression is justified and reports no current missed diagnostic.
- failure: The broader suppression could hide a future helper diagnostic; this is future-proofing outside D11's required bar, not an existing compiler failure.
- fix: Narrow the suppression to next-line missingPipeableSignature:off directives on fileSystem and platform, preserving the reason and their direct-call contracts.
- seats: fable-1-8

### backlog-7

- file: scratchpad/test/walker/fixtures.ts:79-80; scratchpad/test/walker/Walker.test.ts:294,301
- class: law   severity: backlog
- standard: standards/effect-laws-v1.md law 6 and enforcement Scope; operator deferral of S3; D11.
- evidence: The Object-method part of fable-1-7 names Object.entries in fixtures and Object.fromEntries in the two Walker filesystem helpers. Tests and fixtures are excluded from default native-runtime scope. Unlike native Set/Map, these calls are not covered by the port's explicit section-16 collection prohibition.
- failure: Test helpers retain native Object construction/iteration idioms. This test-only cleanup is backlog; the native-set part of the same seat finding is req-7.
- fix: Use R.toEntries in the fixture loops (already owned by req-7's file conversion) and R.fromEntries with Effect Array mapping in FsWith/FsDenying when S3 cleans the remaining test helpers. Preserve the exact seeds and injected faults.
- seats: fable-1-7

### backlog-8

- file: scratchpad/effected/walker/Walker.ts:77,122,139,168,184
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-14; D11; section 14.
- evidence: Fable identifies bare ascend/ascendWithin/ascendToPhysical/firstMatch/findUpward span names versus Walker.descend and Walker.compileAndExpand. Read-only standard inspection shows EF-14 prefers Effect.fn("Name") but does not require a Name.op qualification. The functions already use Effect.fn.
- failure: Trace labels are stylistically inconsistent, with no cited qualification law or demonstrated bug. Renaming introduces new trace output, so this remains a section-14 proposal outside D11.
- fix: Track qualification to Walker.<operation> as a naming proposal; retain the current law-forced Effect.fn wrappers unless a binding convention or permitted deviation justifies changing their observable span labels.
- seats: fable-1-9

## Handled by the deviation codemod

### codemod-1

- file: scratchpad/effected/walker/Descend.ts:25,148,156; scratchpad/effected/walker/Expand.ts:69; scratchpad/effected/walker/Walker.ts:11; scratchpad/effected/walker/README.md:117-119
- class: law   severity: backlog
- standard: D9 and section 14 as superseded by Grilling, 2026-10-09 (later): one central entry per module per systemic class; added exports to exportsAdded.
- evidence: Sol's differential probe establishes native Error versus WalkerDefect and upstream acceptance versus lab rejection of limit:Infinity. Fable establishes identity-derived error names/toString and cites the empty walker deviation records. Grok identifies the missing tagged-defect record within its README finding. These changes are forced by identity rules, the native-error law and schemaNumber diagnostics, not unforced divergences.
- failure: The law-forced identity, tagged-error and S.Finite changes lack deviation bookkeeping. This record-only work is owned centrally and is not a required walker fix.
- fix: The central codemod must generate walker entries per systemic class: identity-derived schema keys/error names (Fable), tagged WalkerDefect/DescendDefect replacements (Grok, Sol, Fable), and S.Finite replacing S.Number (Sol, Fable), listing sites and any adjusted upstream tests. It also records schema exports introduced by the fix wave in exportsAdded. Do not assign or edit PORT_LEDGER.json or README Port notes in a walker repair group. Sol's requested extra bookkeeping tests do not turn the authorized representation changes into defects.
- seats: grok-1-2 (deviation-record portion), sol-1-1, fable-1-3

## Rejected

### reject-1

- file: scratchpad/effected/walker/Descend.ts:148; scratchpad/effected/walker/Expand.ts:69; scratchpad/effected/walker/Walker.ts:11; scratchpad/effected/walker/Descend.ts:25
- class: bug   severity: backlog
- standard: D5; native-error law 7; Grilling, 2026-10-09 (later), systemic law-forced deviation ruling.
- evidence: Grok identifies changed names/toString and proposes oracle-name getters. Fable independently verifies the same observable names and identifies them as the established identity-derived error idiom, while the operator explicitly directs identity and tagged-error changes to the central deviation records.
- failure: Rejected: restoring oracle error names would undo the accepted observable consequences of law-forced identities/tagged errors; no evidence establishes the change itself as wrong.
- fix: Do not add name overrides or restore native errors; retain the identity-derived classes and let codemod-1 record their forced deviations.
- seats: grok-1-1
