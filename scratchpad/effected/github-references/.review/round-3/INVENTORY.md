# github-references — round-3 merged inventory

Read all three seat reports: grok.md (1 finding), sol.md (2 findings), and
fable.md (2 findings, independent third seat routed through Grok 4.7 medium).
Read BRIEF.md and BRIEF.grok3.md. There are no part-N subdirectories.
The briefs pin review commit `3ad7b305790c7f0903f6d55766c55186745ba2d1`
and upstream oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.
The current checkout is `@lab/effected-2`, rather than the requested
`@lab/effected`; module source and tests have no diff from the review commit.

**Required: 2 · Backlog: 1 · Codemod: 0 · Rejected: 1 · Groups: 1.**
All five reported findings are accounted for. sol-3-1 and fable-3-1 name
the same defect and merge under sol-3-1, retaining both seats' evidence.

Adjudication applies the complete operator revision block, D1–D20, §12.5,
and §14. The task's explicit S2/S3 deferral controls the documentation and
property-quality classifications despite the briefs' green-stage claims.
The required schema findings demonstrate semantic constraints that the
green gates missed; they do not reopen round 2's numeric-domain finding.
The reported schema probe results are seat evidence, corroborated by reading
the unchanged schemas, parser assignments, and tests; no schema probe or test
was rerun. A read-only string-prefix check disproves fable-3-2 below.

`standards/effect-laws.allowlist.jsonc` contains **zero entries** for
`scratchpad/effected/github-references/**`, so there are no allow-<n> findings.
Read-only history and step-2/law diffs were checked: `79f7df472f` replaces
unsafe keyword casts and native membership sets with schema guards;
`03bf79d41b` rewrites documentation imports. `f66ff21358` implements the
round-2 numeric/non-empty constraints and performance fixes. Neither seat
establishes an unforced rewrite requiring an upstream restore. The schema
fixes below are law-forced precision changes under law 17 and §14, preserving
parser outputs and object field shapes. Their deviation records, and the
Port notes clause requested by grok-3-1, remain central codemod work.

## Required

### sol-3-1 — List schemas accept a closing flag that contradicts the keyword
- file: scratchpad/effected/github-references/ClosingList.ts:179; scratchpad/effected/github-references/ClosingList.ts:530
- class: schema
- severity: required
- standard: standards/schema-first-development-prompt.md, "Precision carries invariants"; standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-35; D5/D11 and §14 (`law:17`).
- evidence: ReferenceList independently validates ListKeyword and S.Boolean; HarvestedReferenceList spreads ReferenceList.fields and adds offsets. There is no whole-object relationship check. Sol's read-only probe returned true from S.is and Success from S.decodeUnknownResult for `{ keyword: "refs", closing: true, issueNumbers: [1] }` and `{ keyword: "fixes", closing: false, issueNumbers: [1] }`; the harvested schema accepts the same crossed flags with valid offsets. The parsers set closing from closing-keyword membership at ClosingList.ts:343 and :659 and produce false for "refs #1" and true for "fixes #1". Fable confirms the schemas, parser assignments, unrestricted round-trip arbitrary at ClosingList.property.test.ts:69, and missing rejection cases in ClosingList.test.ts:174–190. Round 2 refined numbers and list cardinality, not this relationship.
- failure: Public schemas successfully decode classifications that reverse the keyword's documented meaning and cannot be produced by the parsers. Independent field validation and existing round-trip properties miss the contradiction.
- fix: Add one shared, annotated schema check requiring closing to equal membership in ClosingKeyword, and apply it to both ReferenceList and HarvestedReferenceList. Spreading fields does not inherit a whole-object check. Preserve field/identity annotations, encoded object shape, parser outputs, order, and offsets. In ClosingList.test.ts reject both crossed keyword/flag combinations for both schemas and retain acceptance of consistent values and parser results. Update ClosingList.property.test.ts so schema-derived round-trip arbitraries honor the relationship without weakening schemas or deleting properties. A discriminated union is an alternative only if it preserves the shared field API; this finding does not independently require a new narrowing API. Central tooling records the law-forced tightening.
- seats: sol-3-1, fable-3-1

### sol-3-2 — Harvested-result schemas accept empty or reversed match spans
- file: scratchpad/effected/github-references/IssueReferences.ts:107; scratchpad/effected/github-references/ClosingList.ts:530
- class: schema
- severity: required
- standard: standards/schema-first-development-prompt.md, "Precision carries invariants"; standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-35; documented match-offset semantics; D5/D11 and §14 (`law:17`).
- evidence: IssueReference and HarvestedReferenceList independently validate start and end with S.Natural and have no ordering check. Sol's read-only probe returned true from S.is and Success from S.decodeUnknownResult for IssueReference values `{ keyword: "fixes", issueNumber: 1, start: 10, end: 0 }` and `{ keyword: "fixes", issueNumber: 1, start: 0, end: 0 }`, and for analogous harvested lists with consistent keyword/flag fields. Every parser match includes a keyword, whitespace, #, and digits, so its exclusive end exceeds its start. Current schema round trips do not enforce the relationship. Round 2's independent S.Natural constraints do not imply ordered spans.
- failure: Successfully decoded harvested results can carry spans that identify no match and yield empty slices or highlights under the documented text.slice(start, end) convention.
- fix: Add an annotated whole-object check enforcing end > start to IssueReference and HarvestedReferenceList, preserving fields, annotations, parser outputs, and encoded shape. Add equal/reversed rejection cases and real-harvest acceptance cases in IssueReferences.test.ts and ClosingList.test.ts. Keep the existing schema round-trip properties in IssueReferences.property.test.ts and ClosingList.property.test.ts, supplying schema-derived arbitrary support that generates ordered spans and, for harvested lists, consistent keyword/flag pairs. Do not weaken the refined schemas or rewrite unrelated upstream assertions. Central tooling records the law-forced tightening.
- seats: sol-3-2

Both required findings share **g1**, which owns two source files
(ClosingList.ts and IssueReferences.ts) and four test files
(ClosingList.test.ts, IssueReferences.test.ts, ClosingList.property.test.ts,
and IssueReferences.property.test.ts). HarvestedReferenceList and its tests
are shared by both fixes, so separate groups would overlap. No README Port
notes, ledger, manifest, lockfile, or repository configuration is assigned.

## Backlog

### grok-3-1 — README dependency and Effect-surface descriptions are stale
- file: scratchpad/effected/github-references/README.md:4; scratchpad/effected/github-references/README.md:14
- class: docs
- severity: backlog
- standard: D4; EFFECTED_PORT_GOAL.md §10.1; task's S2 documentation deferral.
- evidence: Line 4 says effect is the only peer and there are no runtime dependencies; line 14 says Option is the only part of Effect the surface touches. The source imports @beep/identity/packages and @beep/schema/LiteralKit, plus effect/Array, effect/Option, effect/Record, effect/Schema, and effect/String. The barrel exports runtime schemas. This evidence concerns two specific sentences, distinct from earlier published-package guidance findings.
- failure: The README describes the upstream dependency/schema surface rather than the lab source.
- fix: During documentation work, rewrite those two sentences to describe the lab imports and runtime schema exports, retaining the grammar, dialect, fidelity, and synchronous-call guidance. Route the requested schema-first/effect-imports Port notes clause through the central deviation codemod; do not assign Port notes edits to a fix group.
- seats: grok-3-1

## Handled by the deviation codemod

None: **0 standalone findings**. No seat reports a separate bookkeeping
defect. The incidental recording clauses in grok-3-1 and fable-3-1, together
with records for both future schema tightenings, belong to the central
per-module/per-class codemod. They neither add required work nor authorize
README Port notes or PORT_LEDGER.json edits by the assigned group.

## Rejected

### fable-3-2 — Claimed resolve/ref prefix counterexample is false
- file: scratchpad/test/github-references/KeywordFamily.property.test.ts:25
- class: test
- severity: rejected
- standard: EFFECTED_PORT_GOAL.md §12.5, evidence requirement; D11.
- evidence: The seat claims resolve, resolves, and resolved start with ref. A read-only string-prefix check returns false for all three; their third character is s, whereas ref has f. The existing keyword.startsWith(family) assertion therefore rejects the proposed mapping of those keywords to ref. KeywordFamily.test.ts:24–47 also pins the full twelve-row table.
- failure: No demonstrated failure remains: the report's sole counterexample fails the property it claims to evade.
- fix: The proposed explicit table or longest-prefix property is optional test work with no supported defect here; retain the current checks for this fix wave.
- seats: fable-3-2
- rejection: The asserted counterexample is disproven, so the finding lacks valid evidence.

The retained schema findings show specific gate misses and allowed
law-forced fixes; the duplicate pair is merged and documentation is backlog.
