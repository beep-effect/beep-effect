# github-references — round-1 merged inventory

Read all three seats: `grok.md` (7 findings), `sol.md` (6), and `fable.md` (12),
and their shared `BRIEF.md`; there are no `part-N` reports. The brief pins review
commit `3fa5876691901fccf3d1cd29e9324564df134b56` and oracle commit
`af7566a9da2eff169cb74955efcc5ede1e5de9f8`. The source and test surfaces have no
diff between that review commit and the current HEAD.

**Required: 7 · Backlog: 5 · Codemod: 0 · Rejected: 0 · Groups: 1.**
All 25 seat findings are accounted for below; contributing report IDs appear
on each `seats:` line. Aggregate `sol-1-2` contributes to each of the three
distinct literal-domain defects it reports.

Adjudication follows the complete operator revision block, D1–D20, §12.5,
and §14 in `scratchpad/EFFECTED_PORT_GOAL.md`. S2/S3 findings stay backlog.
The two deferred idiom findings are promoted under D11 because they cite
applicable standards and concrete fixes; absence of an enforcing gate does
not make a cited idiom violation backlog. The four green S1 law gates do
not cover these schema/idiom defects. The performance finding carries a
measured regression rather than a speculative optimization.

`standards/effect-laws.allowlist.jsonc` contains **zero** entries whose file
starts with `scratchpad/effected/github-references/`; there are no `allow-<n>`
findings to add. No seat identifies an existing unforced upstream-shape or
upstream-test rewrite requiring restoration.

## Required

### grok-1-1 — Closing keywords lack a shared, annotated literal kit
- file: scratchpad/effected/github-references/IssueReferences.ts:51; scratchpad/effected/github-references/ClosingList.ts:95
- class: schema
- severity: required
- standard: `standards/effect-laws-v1.md` laws 17/19; `standards/effect-first-development.md` EF-12/EF-35; D5; operator identity requirement.
- evidence: The nine-item `CLOSING_KEYWORDS` tuple and indexed-access `ClosingKeyword` type are reused in parser results and keyword-family mapping, but the only schemas are anonymous `S.is(S.Literals(CLOSING_KEYWORDS))` guards at IssueReferences.ts:53 and ClosingList.ts:95. All seats identify the same domain and duplicate guard. Neither `LiteralKit` nor `$ScratchpadId` appears in the module; the green S1 laws do not check named-domain modeling or identity annotations.
- failure: The named closing-keyword domain has parallel type/guard definitions and no canonical annotated schema; ClosingList independently reconstructs its membership predicate.
- fix: Define `ClosingKeyword` with `LiteralKit` and canonical `$ScratchpadId` annotations; derive its same-name type and `CLOSING_KEYWORDS` from the kit while preserving all nine literals and their order. Share the kit with ClosingList. If exported as a value, expose it through index.ts without removing any upstream export. Use the schema-derived Enum lookup in the parser hot paths as specified by fable-1-5, rather than retaining the measured full-parse cost. Extend IssueReferences.test.ts with kit/tuple parity and invalid-keyword regression cases, keeping existing upstream cases unchanged. Added-export bookkeeping belongs to the central codemod.
- seats: grok-1-1, sol-1-2, fable-1-1

### grok-1-2 — Reference and combined list keywords lack named literal kits
- file: scratchpad/effected/github-references/ClosingList.ts:60; scratchpad/effected/github-references/ClosingList.ts:92
- class: schema
- severity: required
- standard: `standards/effect-laws-v1.md` laws 17/19; `standards/effect-first-development.md` EF-12/EF-35; D5.
- evidence: `REFERENCE_KEYWORDS` supplies a named indexed-access `ReferenceKeyword` type but no kit. The reused closing-or-reference domain is an anonymous `S.Literals([...CLOSING_KEYWORDS, ...REFERENCE_KEYWORDS])` at line 92. `ReferenceList`, `HarvestedReferenceList`, and the keyword-family table use this domain. These modeling requirements are outside the four green S1 law checks.
- failure: The reference-only and combined list-keyword domains have no annotated schema source of truth, and their membership/type definitions can drift.
- fix: Define annotated `ReferenceKeyword` and combined `ListKeyword` literal kits; derive `REFERENCE_KEYWORDS`, same-name types, and the result-model keyword field from them, retaining literal order. Compose the combined kit from the shared ClosingKeyword and ReferenceKeyword literals; remove the independent anonymous schemas. Export new runtime values through index.ts if public. Apply fable-1-5's Enum lookup on hot paths. Extend ClosingList.test.ts with kit/domain parity and invalid/prototype-name rejection cases without rewriting upstream assertions. Route export records to the central codemod.
- seats: grok-1-2, sol-1-2, fable-1-2

### grok-1-3 — Keyword families remain a handwritten literal union
- file: scratchpad/effected/github-references/KeywordFamily.ts:19
- class: schema
- severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-12/EF-35; D5.
- evidence: `KeywordFamily` is the named, exported union `"close" | "fix" | "resolve" | "ref"`, used by the exhaustive `FAMILIES` record and `keywordFamily` return type. It has no schema or identity annotation. Grok, Sol's aggregate finding, and Fable all identify this same domain.
- failure: The reusable family domain is type-only and cannot supply schema-derived validation, matching, or generation.
- fix: Define an identity-annotated `LiteralKit(["close", "fix", "resolve", "ref"])` without an inline-array `as const`, and derive the existing same-name type. Preserve the exhaustive `FAMILIES` record and keywordFamily behavior; use the shared list-keyword type where useful. Expose a new runtime value through index.ts if public. Extend KeywordFamily.test.ts with kit/domain parity while retaining every existing twelve-keyword mapping assertion. Added-export recording is central codemod work.
- seats: grok-1-3, sol-1-2, fable-1-3

### sol-1-1 — Five parser-result models have no schema source of truth
- file: scratchpad/effected/github-references/IssueReferences.ts:60,80; scratchpad/effected/github-references/ClosingList.ts:67,79,365
- class: schema
- severity: required
- standard: `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `standards/effect-first-development.md` EF-33/EF-12; D5/D9/D11.
- evidence: `IssueReference`, `BareLineReference`, `ClosingList`, `ReferenceList`, and `HarvestedReferenceList` are handwritten pure-data interfaces, with no corresponding schemas. They are not service contracts or type-level machinery. Upstream-derived plain-object expectations appear in IssueReferences.test.ts:134,143,155 and ClosingList.test.ts:167,174,189,196. The schema-first standard explicitly permits `S.Struct` when the boundary shape is the desired value; therefore schema authorship need not alter parser values. The four green S1 law gates do not verify these models.
- failure: Parser-result fields lack an annotated schema source from which validation, equivalence, codecs, and generators can derive.
- fix: Define annotated `S.Struct` models and same-name `.Type` aliases for all five shapes, using the named keyword kits, `S.Int` for safe integer issue numbers/offsets, `S.Array(S.Int)` for issue-number lists, and `S.Boolean` for closing. Preserve readonly structural types and object-literal parser outputs; derive HarvestedReferenceList from ReferenceList fields plus offsets. Expose new runtime schemas through index.ts if public, and add focused schema/result-shape assertions in IssueReferences.test.ts and ClosingList.test.ts without changing existing plain-object expectations. Record any added exports centrally. Grok's suggested hold is unnecessary: this fix follows schema law without a behavior deviation.
- seats: grok-1-4, sol-1-1, fable-1-4

### fable-1-5 — Schema membership parsing causes a measured parser slowdown
- file: scratchpad/effected/github-references/ClosingList.ts:430; scratchpad/effected/github-references/ClosingList.ts:228,237,281; scratchpad/effected/github-references/IssueReferences.ts:148,186
- class: perf
- severity: required
- standard: D11's measured-regression criterion; `standards/effect-laws-v1.md` law 6; D9/§14.
- evidence: Fable reports a read-only Bun comparison over 836,000 characters, five repetitions in two rounds, with byte-identical outputs: harvestReferenceLists 23.5/24.0 ms lab versus 11.0/10.6 ms upstream; parseReferenceList 3.5/1.6 versus 1.2/0.9 ms; harvestIssueReferences 3.0/2.0 versus 2.1/1.6 ms. The report checks that the live oracle source matches the pin. Membership uses SchemaParser's full parse once per ASCII word in the dominant harvest path. Its two-million-call microbenchmark reports S.is(S.Literals) 57 ns, S.is(LiteralKit) 54 ns, native Set.has 6–8 ns, and R.get(Kit.Enum) 10 ns; prototype-name Enum lookups return None. These measurements are seat evidence, not a benchmark rerun during inventory merging.
- failure: Parser paths regress by approximately 1.3–2.9 times versus upstream; merely substituting LiteralKit into S.is retains the dominant per-word cost.
- fix: After the literal-kit fixes, use `R.get(ListKeyword.Enum, lowered)` or `R.get(ClosingKeyword.Enum, lowered)` to validate and obtain the canonical typed keyword without casts. Use `R.has(ClosingKeyword.Enum, keyword)` for the closing flag and `O.map` over closing-keyword lookup for parseClosingList. Preserve the existing regex grammar, scanner semantics, offsets, order, and unsafe-number behavior. Add invalid/prototype-name regression cases to IssueReferences.test.ts and ClosingList.test.ts and rerun the seat's oracle comparison/benchmark; a predicted speedup is not proof. Do not restore native Set or fold the deferred regex/coverage rewrite into this fix.
- seats: fable-1-5

### grok-1-5 — Domain helper absence is represented by undefined sentinels
- file: scratchpad/effected/github-references/IssueReferences.ts:110; scratchpad/effected/github-references/ClosingList.ts:124,148,171,448
- class: effect-idiom
- severity: required
- standard: `standards/effect-first-development.md` EF-2, “Absence is Option”; D11.
- evidence: `safeIssueNumber` returns `number | undefined`, consumed at IssueReferences.ts:145/183. ClosingList's readItem, scanSeparator, and parseItems return undefined for absence, and harvestReferenceLists maintains `unsafeNext: number | undefined`. Grok and Fable cite EF-2 and identify the sites. The green import/function/terse/native-runtime gates do not enforce EF-2. Fable's suggested scanner allocation regression is hypothetical; no measurement or operator ruling establishes an exception.
- failure: Internal domain absence remains nullish despite the cited Option idiom; public parser Options do not remove the helper-level violation.
- fix: Return `O.Option<number>` from safeIssueNumber using a safe-integer predicate and consume it at both call sites without changing skip/reject behavior. Convert readItem to an Option of its existing item/unsafe variant, scanSeparator to Option<number>, and parseItems to Option<ReadonlyArray<number>>; unwrap with Option combinators/guards at their existing consumers. Represent unsafeNext as Option<number>, retaining scan resumption and whole-candidate rejection. Preserve every upstream case, add focused malformed/unsafe-candidate continuation assertions in the two parser test files, and check the prose benchmark alongside fable-1-5. Do not invent a ledger exception as a substitute for the fix.
- seats: grok-1-5, fable-1-11

### fable-1-12 — Line-level string processing bypasses Effect helpers
- file: scratchpad/effected/github-references/ClosingList.ts:263,309,329,223,227,429; scratchpad/effected/github-references/IssueReferences.ts:206,181,147,185
- class: effect-idiom
- severity: required
- standard: AGENTS.md Code Laws, “Prefer effect helper modules”; `standards/effect-first-development.md` EF-5; D11. Law 2 specifies the dedicated import path rather than independently prohibiting native string methods.
- evidence: The cited sites use native split, trim, and toLowerCase for line splitting and keyword normalization. Fable identifies installed equivalent Str.split, Str.trim, and Str.toLowerCase APIs. There are ten cited call sites, despite the report's “eight” count. These helpers are outside the character-by-character scanner; none of the four green S1 law gates enforces this EF-5 idiom.
- failure: Domain line/keyword processing bypasses the explicitly preferred Effect helper modules despite equivalent helpers being available.
- fix: Import `effect/String` as Str and replace the cited line-level split/trim/toLowerCase calls with their equivalent Effect helpers, preserving split-on-newline, CRLF trimming, keyword normalization, and output order. Keep the finding scoped to those cited calls rather than expanding it into a scanner redesign. Preserve upstream tests and add a focused mixed-case/CRLF/Unicode-whitespace parser equivalence case in the existing parser test files. This cited idiom falls within D11 even though the seat labeled it backlog.
- seats: fable-1-12

All required fixes share **g1**, owning IssueReferences.ts, ClosingList.ts,
KeywordFamily.ts, index.ts, and their three existing test files. Cross-file
schema composition and shared parser lookups prevent independent write lanes.
No README or global ledger write belongs to this required group.

## Backlog

### grok-1-6 — Deferred JSDoc carrier, metadata, and example conversion
- file: scratchpad/effected/github-references/IssueReferences.ts:118; scratchpad/effected/github-references/ClosingList.ts:47,190,246,279,297,319,375; scratchpad/effected/github-references/KeywordFamily.ts:44; scratchpad/effected/github-references/index.ts:31
- class: jsdoc
- severity: backlog
- standard: `.patterns/jsdoc-documentation.md`; `scratchpad/EFFECTED_PORT_GOAL.md` §10.2; operator S2 deferral.
- evidence: All seats identify legacy @remarks/@example carriers, absent @category/@since, and runtime exports lacking examples. Fable enumerates the eight example omissions; Sol also identifies kind-split example requirements. S2 has not run, so the existing green S1 gates are not documentation proof.
- failure: Current export documentation does not meet the future S2 grammar/metadata/example gate.
- fix: In S2, preserve upstream bodies while converting to titled **Example** and **Details**/**Gotchas** sections; add canonical categories and @since 0.0.0 and meaningful missing runtime examples. Handle the barrel carrier according to the docgen rubric.
- seats: grok-1-6, sol-1-3, fable-1-7

### grok-1-7 — README examples and boilerplate still target the published package
- file: scratchpad/effected/github-references/README.md:3,10,28,49,180
- class: docs
- severity: backlog
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` §10.3/D4; operator S2 deferral.
- evidence: The README retains upstream badges, pre-1.0/plugin advice, Install instructions, imports from @effected/github-references, and a compat section describing @effected/github re-exports. All seats report the package-versus-lab guidance mismatch. Added exports currently says None; any future law-forced export additions are separate central bookkeeping, not a present documentation defect.
- failure: Readers following the current setup/examples exercise the upstream package rather than the lab module.
- fix: During S2, remove publishing-only badges/stability/install boilerplate and obsolete compatibility guidance, and rewrite example imports to the lab barrel. Preserve grammar, API, and Features prose. Let the deviation/export codemod maintain the added-export record rather than hand-authoring it in this fix.
- seats: grok-1-7, sol-1-4, fable-1-8

### sol-1-5 — Deferred canonical Option assertions
- file: scratchpad/test/github-references/ClosingList.test.ts:27; scratchpad/test/github-references/IssueReferences.test.ts:94
- class: test
- severity: backlog
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` §11.2; `goals/effect-vitest-canon/SPEC.md` D5; operator S3 deferral.
- evidence: Both seats enumerate isSome/isNone boolean assertions followed by getOrThrow throughout the two parser suites. S3 has not run.
- failure: Option assertions lack the canonical payload-aware Some/None diagnostics expected at S3.
- fix: During S3, replace the container checks/extraction with assertSome/assertNone from @effect/vitest/utils while preserving every upstream case and plain-value assertion.
- seats: sol-1-5, fable-1-9

### sol-1-6 — Deferred schema/parser property floor
- file: scratchpad/test/github-references/IssueReferences.test.ts:14; scratchpad/test/github-references/ClosingList.test.ts:19; scratchpad/test/github-references/KeywordFamily.test.ts:13
- class: test
- severity: backlog
- standard: D10; `scratchpad/EFFECTED_PORT_GOAL.md` §11.4; operator S3 deferral.
- evidence: The three retained suites have example cases but no property tests, arbitrary generation, or fcRuns. Sol reports a read-only differential probe with zero mismatches across 127,008 parser comparisons and twelve keyword-family mappings; that probe is not retained in the suite.
- failure: The suites do not yet continuously enforce generated fidelity/idempotence or schema round trips.
- fix: In S3, add canonical generated schema round trips, parser fidelity/idempotence and offset/order/posture properties, and differential comparisons against the pinned oracle with fcRuns. Retain every upstream example case. Use the local, installed Effect 4/vitest APIs when implementing the properties.
- seats: sol-1-6, fable-1-10

### fable-1-6 — Deferred unreachable-branch coverage investigation
- file: scratchpad/effected/github-references/IssueReferences.ts:148,186; scratchpad/test/github-references/IssueReferences.test.ts:14
- class: test
- severity: backlog
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` §11.3/§16; operator S3 deferral; D9/§14.
- evidence: Both regexes restrict their capture to the same nine closing keywords used by the membership guard, and captured text is lowercased first. Thus the negative guard branches are unreachable under the existing regex grammar. The seat supplies a reasoning argument, not a current S3 coverage result.
- failure: These defensive branches obstruct the future 100-percent branch target; S3 has not run.
- fix: Reassess the branches after the required membership fix during S3, without coverage-ignore comments or vacuous tests. If a coverage-law-driven repair broadens the capture to ASCII words and makes the kit lookup authoritative, first establish the law cause and prove oracle equivalence for whole-line/inline grammar, offsets, boundaries, invalid keywords, and the cited éclose case. Do not broaden the regex in the round-1 required/performance wave merely to implement this deferred coverage proposal; record any justified test adjustment through the central deviation codemod.
- seats: fable-1-6

## Handled by the deviation codemod

No standalone finding asks only to record a law-forced change, so this section
has **0 findings**. The added-export recording clauses embedded in sol-1-1,
fable-1-1, fable-1-2, fable-1-3, fable-1-4, and fable-1-8 are assigned to the
central per-module/per-class codemod (`exportsAdded` and README Added exports).
They are excluded from the required group's write surface. The underlying
missing-schema defects remain required. A future justified coverage-driven
deviation likewise uses that codemod; no existing standalone recording-only
defect was reported.

## Rejected

None: **0 findings**. Every deduplicated defect has evidence and a concrete
fix; none is dismissed solely because the current gates are green. Merging
duplicates, overriding unsupported backlog severity, deferring S2/S3 work,
and routing incidental bookkeeping centrally are adjudications rather than
additional rejected findings.
