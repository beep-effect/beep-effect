# templates — round-3 merged inventory

Seats read: `grok.md` (no findings), `sol.md` (one required finding), and `fable.md` (no findings; separate grok-4.7 medium fallback seat), together with `BRIEF.md` and `BRIEF.grok3.md`. Recursive discovery found no part directories or additional seat reports. Reviewed commit: `3ad7b305790c7f0903f6d55766c55186745ba2d1`; oracle: the briefs' pinned `af7566a9da2eff169cb74955efcc5ede1e5de9f8` templates snapshot. Live checkout: `@lab/effected-2`, inspected HEAD `843c475bfdf0e57f6f5d813d956a92b06bd73cdc`; the templates source/test diff from the review commit is empty.

**Required: 1 · Backlog: 0 · Handled by the deviation codemod: 0 · Rejected: 0 · Groups: 1.** The sole submitted finding is retained; there are no duplicates.

Binding basis: the entire top operator-revision block, including “Operator rulings, 2026-10-09” and “Grilling, 2026-10-09 (later)”, D1–D20, sections 12.4/12.5 and 14, and the merge request. The briefs' S2/S3 gate claims do not override the requested documentation/test-canon deferral. This finding is a demonstrated runtime bug beyond the cases exercised by the reported green gates, rather than a coverage request or a repeated closed round-2 item.

The current `standards/effect-laws.allowlist.jsonc` contains **zero** entries for `scratchpad/effected/templates/**`, so there are no `allow-<n>` records. File-scoped history and the round-2 diff (`8f587f5604`) show the current deterministic marker scanner was introduced to close the round-2 algorithmic finding. No finding establishes an unforced lab divergence; Sol reports the same failing input against the pinned oracle. Do not restore the older scanner or reject all Unicode attribute values.

`required.json` assigns one source file and two regression-test files to one group. No file overlaps, no group exceeds six source files, and no group owns a manifest, lockfile, repo configuration, port ledger or README Port notes. Recording the verified upstream-bug deviation under section 14 remains central integration work, outside the fix group's write surface. No compiler probe, test/coverage run, implementation fix or closeout/ledger command was performed during this merge. Runtime probe results below are attributed to the seat; current source and existing test cases were checked read-only.

## Required

### sol-3-1

- file: scratchpad/effected/templates/SectionDialect.ts:369; scratchpad/effected/templates/SectionDialect.ts:444; scratchpad/effected/templates/SectionDialect.ts:457
- class: bug   severity: required
- standard: D9; D11 runtime-bug criterion; D10 formatter fidelity; section 14 verified upstream-bug exception; SectionDialect.render's successful-render/read-back contract.
- evidence: Sol reports read-only Bun probes of both the reviewed lab source and the pinned oracle: a hash-style section with content `"body"` and attributes `{ note: "before ---\u2028after" }` renders successfully, then fails parsing with `SectionParseError`, reason `orphanedEnd`, line 3. U+2029 gives the same result. HTML-style `{ note: "before --- -->\u2028after" }` reproduces it with either separator. The current AttributeValue check excludes only double quotes, CR and LF, so these values are valid. markerMatches collects Unicode separator boundaries, selects the first closing-rule boundary at line 444 and rejects the resulting truncated quoted attribute run at line 457; render returns success without validating its synthesized BEGIN marker at line 369. SectionDialect.test.ts's existing Unicode cases put the closing-rule tail after the separator or omit a complete tail before it, so the reported green test gate misses this case.
- failure: Rendering succeeds with a block the same dialect cannot parse. ManagedSection.sync can persist an unreadable managed file; later reads, checks and syncs fail with orphanedEnd instead of reaching a fixed point.
- fix: Before returning render success, validate that markerMatches recognizes the synthesized BEGIN marker in full, with BEGIN kind, the declared identity and exactly the declared attributes. If recognition truncates or rejects it, return the existing typed SectionRenderError with reason invalidAttribute before any write. Retain normal Unicode attribute support, existing scanner grammar and linear scanning behavior. In SectionDialect.test.ts, add U+2028/U+2029 regressions for hash and HTML closing-rule tails, asserting typed refusal and retaining successful ordinary-Unicode round trips. In ManagedSection.test.ts, prove sync propagates that refusal and preserves the existing file bytes. Central integration records the inherited bug repair under section 14; the group must not edit the ledger or README Port notes.
- seats: sol-3-1

## Backlog

None. No seat submitted documentation, JSDoc, coverage, vitest-canon, outside-surface or other non-required findings.

## Handled by the deviation codemod

None. No seat submitted a finding that only requests bookkeeping for an existing law-forced change. Recording the new upstream-bug repair centrally does not create a second finding or remove the required behavioral repair.

## Rejected

None. The submitted finding supplies concrete inputs, observed failures and a concrete fix, demonstrates a case missed by the reported green gates, and does not contradict an operator ruling.
