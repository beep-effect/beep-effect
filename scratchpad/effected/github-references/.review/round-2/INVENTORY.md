# github-references — round-2 merged inventory

Read all three seat reports and their shared BRIEF.md: grok.md (1 finding),
sol.md (2), fable.md (12). No part-N subdirectories exist. The brief pins
`a12bef261998d2ad92153dada46373be06950692` and upstream oracle
`af7566a9da2eff169cb74955efcc5ede1e5de9f8`. The current checkout is
`@lab/effected-2`; source/tests have no diff from the review commit.

**Required: 3 · Backlog: 10 · Codemod: 1 · Rejected: 0 · Groups: 1.**
All 15 seat findings are accounted for: two duplicate pairs merge, and
fable-2-7 splits into independent export bookkeeping and Features prose.
Every contributing seat finding ID appears below.

Adjudication applies the complete operator revision block, including both
2026-10-09 rulings, D1–D20, §12.5 and §14. The task's explicit deferral of
docs, JSDoc, coverage and vitest-canon findings controls this merge despite
the brief and S3 commit reporting those stages green. The false property
is an evidenced test bug, independent of coverage or assertion style.
Performance measurements below are seat evidence, not a rerun here.

`standards/effect-laws.allowlist.jsonc` has **zero** entries for
`scratchpad/effected/github-references/**`; no allow-<n> findings apply.
Read-only file history and diffs were checked: `79f7df472f` (step 2) removes
unsafe keyword casts and native membership sets in favor of schema guards;
`03bf79d41b` (step 2) changes documentation imports; `ba151f5092` (round 1)
implements the schema, Option, helper and membership requirements;
`1b16cb8525` (S3) explicitly attributes full-match slicing and Option.map
to unreachable-branch removal. The loops criticized by fable-2-5 already
exist in the pinned oracle. No report establishes an unforced lab rewrite
requiring restoration. Forced-change records remain central codemod work.

## Required

### grok-2-1 — Fidelity property conflates inline and bare-line whitespace
- file: scratchpad/test/github-references/IssueReferences.property.test.ts:57
- class: test
- severity: required
- standard: D9/D11; EFFECTED_PORT_GOAL.md §11.4, false properties are findings; the documented dialect distinction in IssueReferences.ts:170,177.
- evidence: Sol's read-only probe of `fixes\n#1` returns an inline hit with issueNumber 1, keyword fixes, start 0 and end 8, but parsing that exact slice as a bare line returns None; both parsers match the pinned oracle. The source confirms inline `\s+` versus bare-line `[ \t]+`. IssueReferences.coverage.test.ts:14–16 already exercises a newline-containing inline match, while IssueReferences.test.ts:186 requires its rejection as a bare line. Line 57 demands Some for every original inline slice; the structured generator at line 52 uses only a tab. Grok explains why the default string arbitrary misses the counterexample.
- failure: A valid input falsifies the new test's claimed relationship between dialects even when both parser implementations satisfy upstream behavior. Existing green tests missed it because the generated domain does not exercise the relevant opening gaps.
- fix: Replace the original-slice bare-line assertion with a payload-aware assertion on `parseBareLineReference(stringifyBare(hit))`, checking the projected keyword and issue number. Retain re-harvest normalization and exact-offset comparisons at lines 55–56. Add structured opening gaps containing newline and other inline-only whitespace so this distinction is exercised deliberately. Preserve both parser grammars and every upstream case; do not widen the bare-line grammar.
- seats: grok-2-1, sol-2-1

### fable-2-1 — Parser hot paths still have a measured upstream regression
- file: scratchpad/effected/github-references/ClosingList.ts:609,226–258,326,335,413,652; scratchpad/effected/github-references/IssueReferences.ts:219–230,268
- class: perf
- severity: required
- standard: D11, measured regression versus upstream; round-1 fable-1-5's explicit remeasurement requirement; D9/§14; effect-laws-v1.md law 21.
- evidence: Fable reports 1,000,000-character inputs, 10 warmups and 12 repetitions alternating call order, with identical JSON outputs. Median lab/upstream times: harvestReferenceLists on keyword-free prose 23.07/16.05 ms (1.44x), dense lists 20.70/16.10 ms (1.29x); dense harvestIssueReferences 19.78/10.24 ms (1.93x); parseReferenceLists 32.34/27.76 ms (1.17x); collectReferenceLists 55.51/45.14 ms (1.23x). Its live-oracle comparison checked source equality against the pin. The S3 diff adds full-match slicing, trimming and an Option.map closure; Option item/separator wrappers were introduced by the earlier required idiom fix. The per-word isolated lookup probe is near parity, so the claimed bottleneck attribution remains a hypothesis to measure, not a proven fix. Type arguments themselves have no runtime cost.
- failure: The measured harvest paths remain roughly 1.3–1.9x slower at equivalent outputs. The round-1 membership change did not establish performance recovery, and green correctness/law gates do not enforce that recovery.
- fix: Benchmark behavior-preserving changes against the pinned oracle using the same input families and alternating repetitions. Widen the Enum lookup records once and measure R.has on misses/R.get on hits; recover keyword/digits from regex captures instead of reparsing full matches where typing and required gates permit it; reduce unnecessary Option/map allocations without reintroducing native collections, undefined sentinels or unsafe assertions. If necessary, use a named schema-backed item/unsafe/miss union with a shared miss value for the internal scanner, retaining Option at public boundaries. Keep grammar, offsets, order and unsafe-number semantics identical and retain focused malformed/prototype-name/unsafe-continuation regressions in the existing parser tests. Close on measured improvement plus equivalent outputs, not predicted speedup. Deliver measurement evidence to the orchestrator; ledger/Port-notes recording stays central.
- seats: fable-2-1

### fable-2-2 — Result schemas admit negative numbers and empty lists
- file: scratchpad/effected/github-references/ClosingList.ts:148,181,524–529,266–279; scratchpad/effected/github-references/IssueReferences.ts:108,112,114,148
- class: schema
- severity: required
- standard: schema-first-development-prompt.md, Precision carries invariants; effect-first-development.md EF-12b/EF-35; effect-laws-v1.md law 17; D5/D11.
- evidence: ClosingList and ReferenceList use S.Array(S.Int); HarvestedReferenceList inherits those list fields and uses S.Int offsets. IssueReference/BareLineReference likewise use S.Int. S.is therefore accepts empty issue lists and negative issue numbers/offsets. The grammar requires one or more digit-only items; parseItems cannot succeed before reading one item, and harvestReferenceLists seeds its list with the first item. Offsets are non-negative string positions. The existing property schemas generate impossible result shapes. The cited schema standard explicitly requires narrower ranges and non-empty collections; no cited green gate validates these semantic constraints.
- failure: The five public result schemas and their derived types promise less than the parser contract, admitting values that cannot be parser results.
- fix: Use S.Natural for issue numbers and offsets and S.NonEmptyArray(S.Natural) for the three issue-number lists, preserving field/identity annotations. Make parseItems read a first valid item before initializing a non-empty accumulator, return Option of a non-empty readonly array, and retain that invariant through harvest/collection paths without casts. Add schema acceptance/rejection cases for zero, MAX_SAFE_INTEGER, negative/unsafe numbers, empty lists and valid duplicate lists in IssueReferences.test.ts and ClosingList.test.ts; keep both property suites round-tripping the refined schemas. Preserve parser output and upstream assertions. The law-forced numeric-domain record goes through the central codemod, not this group's writes.
- seats: fable-2-2

Required fixes share **g1**, owning two source files and four test files:
IssueReferences.ts, ClosingList.ts, IssueReferences.test.ts,
ClosingList.test.ts, IssueReferences.property.test.ts and
ClosingList.property.test.ts. The schema and perf fixes share both sources;
the false-property fix overlaps the schema property's test surface. No
README, ledger, package manifest, lockfile or repository config is assigned.

## Backlog

### sol-2-2 — Property suites compare Option containers directly
- file: scratchpad/test/github-references/ClosingList.property.test.ts:46,81,82,86; scratchpad/test/github-references/IssueReferences.property.test.ts:39,57,64,65
- class: test
- severity: backlog
- standard: effect-vitest-canon/SPEC.md D5; EFFECTED_PORT_GOAL.md §11.2; task's vitest-canon deferral.
- evidence: Both seats enumerate assert.deepStrictEqual calls on Options in the newly added property files. Fable cites EV006 hand-rolled-data-assertion and the detector's scratchpad exclusion; these occurrences escape the stated green gates.
- failure: Container comparisons bypass canonical Some/None payload diagnostics. The separate line-57 false-property defect remains required regardless of assertion style.
- fix: During canon work, use assertSome/ assertNone for known outcomes and match on generated expected Options for round-trip comparisons; preserve ordinary comparisons of plain values and every property meaning.
- seats: sol-2-2, fable-2-3

### fable-2-4 — Optional cleanup of a side-effecting Option.map
- file: scratchpad/effected/github-references/IssueReferences.ts:223
- class: effect-idiom
- severity: backlog
- standard: effect-first-development.md EF-2; D9/§14; prior backlog fable-1-6.
- evidence: O.map runs references.push and its mapped Option<number> is discarded. The keyword regex guarantees lookup success. The S3 commit explicitly introduced this form to remove an unreachable branch. EF-2 says to consume Option via combinators, including map; it does not establish the report's claimed blanket prohibition on statement use.
- failure: An allocation and side effect are obscured by a value-transform combinator; no separate behavioral bug is shown. Regex broadening is an optional coverage/implementation proposal, rather than an established D11 requirement.
- fix: Reassess the earlier coverage proposal to capture ASCII words and validate via R.get with a reachable guard, only after demonstrating oracle equivalence for boundaries, unknown keywords and both dialects. Keep any forced-change recording central. Do not restore the forced keyword narrowing or broaden grammar solely to satisfy this backlog item. Allocation work can be addressed under required fable-2-1 with measured proof.
- seats: fable-2-4

### fable-2-5 — Optional replacement of upstream loops with array combinators
- file: scratchpad/effected/github-references/IssueReferences.ts:300–307; scratchpad/effected/github-references/ClosingList.ts:371–384,441–448,473–480
- class: effect-idiom
- severity: backlog
- standard: AGENTS.md helper preference; effect-first-development.md EF-5; effect-laws-v1.md law 21; D9/D11.
- evidence: The four line-processing functions use loops over Str.split. The pinned oracle has the same loops (IssueReferences.ts:197–205; ClosingList.ts:260–273,307–314,327–334). The lab has already substituted the preferred string helper. No diagnostic, measured regression attributable to these loops or enforcing prohibition is identified.
- failure: A possible concision preference remains; this is neither an unforced lab rewrite nor an evidenced defect requiring a new shape.
- fix: If pursued separately, compare A.getSomes/A.map and the collectReferenceLists flatMap equivalent against upstream order and outputs before adopting them. Otherwise retain the upstream loops. Do not assign a mandatory restore or require a deviation record for unchanged upstream structure.
- seats: fable-2-5

### fable-2-6 — README examples omit the lab barrel's index segment
- file: scratchpad/effected/github-references/README.md:21,36,50,64,76,90,104,120,132
- class: docs
- severity: backlog
- standard: D4; EFFECTED_PORT_GOAL.md §10.3; task's docs deferral.
- evidence: Nine examples import @beep/scratchpad/effected/github-references without /index. Fable reports a failing import probe, successful /index and /IssueReferences imports, and the scratchpad wildcard export mapping; the existing barrel example already uses /index.
- failure: Copied README examples fail to resolve the intended lab module.
- fix: Append /index to all nine example imports; do not change package exports or repository config.
- seats: fable-2-6

### fable-2-7-prose — Features still describe new runtime schemas as types only
- file: scratchpad/effected/github-references/README.md:168–171
- class: docs
- severity: backlog
- standard: D4; EFFECTED_PORT_GOAL.md §10.3; task's docs deferral.
- evidence: Fable separately identifies Features bullets describing the keyword/result domains as types, while the lab exports same-name runtime schemas. Export-table bookkeeping is split out below.
- failure: API prose understates the runtime schema surface.
- fix: Amend the Features bullets to say schema and type where appropriate; leave Port notes and exportsAdded to the central codemod.
- seats: fable-2-7

### fable-2-8 — Published-package compatibility guidance remains in the lab README
- file: scratchpad/effected/github-references/README.md:12,152–154
- class: docs
- severity: backlog
- standard: D4; EFFECTED_PORT_GOAL.md §10.3; task's docs deferral; previous grok-1-7 backlog.
- evidence: The README still discusses the published package's ESM exports map/ERR_PACKAGE_PATH_NOT_EXPORTED and instructs users migrating from @effected/github to import this package and drop that dependency.
- failure: Lab guidance describes npm packaging and migration steps that do not apply to these source files.
- fix: Remove the publishing-only paragraph and obsolete migration section, retaining the out-of-scope pointer and grammar/API documentation. Central bookkeeping owns the prior backlog's completion status.
- seats: fable-2-8

### fable-2-9 — REFERENCE_KEYWORDS lost its upstream public release tag
- file: scratchpad/effected/github-references/ClosingList.ts:94
- class: jsdoc
- severity: backlog
- standard: D4, carried documentation; task's JSDoc deferral.
- evidence: Upstream ClosingList.ts:50 has @public for REFERENCE_KEYWORDS; its converted lab block at lines 82–96 retains category/since but omits that tag while other exported values retain it.
- failure: Public release metadata differs from the carried upstream block.
- fix: Restore @public above @category constants in the documentation pass.
- seats: fable-2-9

### fable-2-10 — Barrel example uses native array helpers
- file: scratchpad/effected/github-references/index.ts:39
- class: jsdoc
- severity: backlog
- standard: jsdoc-documentation.md example idioms; AGENTS.md helper preference; effect-first-development.md EF-5; task's JSDoc deferral.
- evidence: The example maps references and joins with native methods while sibling examples use effect/Array. Docgen compilation does not enforce this idiom.
- failure: The example teaches a non-preferred helper form.
- fix: Import effect/Array and express the example with A.map and A.join, retaining its displayed result.
- seats: fable-2-10

### fable-2-11 — Some assertions use their actual payload as their expectation
- file: scratchpad/test/github-references/ClosingList.test.ts:37,62,121,237,381,382; scratchpad/test/github-references/IssueReferences.test.ts:163,195
- class: test
- severity: backlog
- standard: effect-vitest-canon/SPEC.md D5; EFFECTED_PORT_GOAL.md §11.4; task's canon/coverage deferral.
- evidence: Eight assertSome calls use O.getOrThrow(actual) as the expected payload. Some sites then assert fields independently (for example ClosingList.test.ts:39–40 and IssueReferences.test.ts:165–166), so the report's wrong-payload claim applies to the self-comparison itself, not uniformly to the whole test. Other sites only check presence. doesNotThrow wrappers carry contextual messages.
- failure: The self-comparison supplies no independent payload expectation and weakens diagnostics; standalone sites do not verify the known result fields.
- fix: Supply explicit expected payloads at these sites, preserve all existing input cases and independent checks until replaced by equivalent expectations, and carry per-case context in test names instead of doesNotThrow wrappers.
- seats: fable-2-11

### fable-2-12 — Repeated property helper and mixed pure-test conventions
- file: scratchpad/test/github-references/IssueReferences.property.test.ts:9–20; scratchpad/test/github-references/ClosingList.property.test.ts:9–20; scratchpad/test/github-references/KeywordFamily.property.test.ts:9–20; scratchpad/test/github-references/IssueReferences.coverage.test.ts:6; scratchpad/test/github-references/ClosingList.coverage.test.ts:6; scratchpad/test/github-references/index.coverage.test.ts:8
- class: test
- severity: backlog
- standard: AGENTS.md Discovery & Reuse; EFFECTED_PORT_GOAL.md §11.2; D11; task's coverage/canon deferral.
- evidence: The three property files repeat roundTrips and place further imports after it. Pure synchronous coverage assertions are wrapped in it.effect/Effect.sync while the example suites use plain it. No behavioral failure or missed enforcing gate is shown.
- failure: Optional maintainability/style consolidation remains, with no required port defect established.
- fix: If adopted, extract a module-local test support helper and move imports to the top; use plain it for pure sync assertions where appropriate. Any shared @beep/test-utils export proposal is outside the port's write surface and stays backlog; do not assign it to a port fix group.
- seats: fable-2-12

## Handled by the deviation codemod

### fable-2-7-exports — Added runtime exports are under-recorded
- file: scratchpad/effected/github-references/README.md:191; scratchpad/effected/github-references/index.ts:45–68
- class: docs
- severity: codemod
- standard: D2; 2026-10-09 ruling, one per-module/per-class record and exportsAdded via the central codemod.
- evidence: Fable reports only ListKeyword in Added exports/exportsAdded, while eight upstream type-only names now also have runtime values: ClosingKeyword, ReferenceKeyword, KeywordFamily, IssueReference, BareLineReference, ClosingList, ReferenceList and HarvestedReferenceList. The round-1 schema fix report already identifies nine added runtime exports.
- failure: Bookkeeping under-reports the law-forced schema-first runtime additions; no claim shows the additions themselves are wrong.
- fix: Have the central codemod record the eight additional value facets in exportsAdded and render the Added exports table. Do not assign PORT_LEDGER.json or README Port notes to any required group. The separate Features prose issue is backlog above.
- seats: fable-2-7

## Rejected

None: **0 findings**. Every retained defect/proposal has evidence and a
concrete fix. Duplicates, task-mandated deferrals, optional preferences and
central bookkeeping are merged or reclassified rather than counted as
rejections. No retained required item merely repeats what a green gate
enforces: the false property has a missed counterexample, schema precision
is unchecked, and performance carries measured evidence.
