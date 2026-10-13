# TOML round-3 inventory

Seats read: `grok.md` (1 finding), `sol.md` (no findings), and `fable.md` (1 finding; separate Grok 4.7 medium third seat). Briefs read: `BRIEF.md` and `BRIEF.grok3.md`. No part subdirectories are present. Two seat findings deduplicate to **1 required, 0 backlog, 0 codemod, 0 rejected; 1 non-overlapping group**.

Both finding-bearing reports use the id `fable-3-1`; the seats lines below qualify that recorded id by report filename rather than inventing a new seat id. The briefs name commit `3ad7b305790c7f0903f6d55766c55186745ba2d1`; the inspected checkout is on `@lab/effected-2` at `576451bec24c6452dc359a863b5c99e4f7888fef`, rather than the requested `@lab/effected`. The cited defect remains present in the live source. Classification applies the full operator revision block, including the 2026-10-09 rulings and later grilling, D1–D20, sections 12.4/12.5 and 14, and the explicit merge instructions. Docs, JSDoc, coverage and vitest-canon findings would be backlog despite the briefs' S2/S3-green claim.

The current `standards/effect-laws.allowlist.jsonc` has zero entries for `scratchpad/effected/toml/**`, so there are no `allow-<n>` findings. Historical removed entries are not reassigned. Only this round's seat findings are merged; previous-round backlog and closed required records are not re-imported.

## Required

### r-guard-reason
- file: scratchpad/effected/toml/internal/limits.ts:35; related sites at lines 63 and 100
- class: schema   severity: required
- standard: D5 and D11; standards/effect-laws-v1.md laws 17 and 19; standards/effect-first-development.md EF-12b; operator step 4
- evidence: Live line 35 declares `export type GuardReason = "NestingDepthExceeded"`; `GuardExceeded.new` takes that handwritten type at line 100, while the error's `reason` field independently declares `S.Literal("NestingDepthExceeded")` at line 63. This named, reused internal domain has no owning schema or identity annotations. EF-12b requires named/reused domain concepts to be schema-first and named internal literal domains to use LiteralKit. The duplicate declaration remains in the code the briefs describe as green, demonstrating that those gates missed this schema-authority requirement. Both seats identify the same three sites and the same fix; the third seat adds the missing identity metadata evidence.
- failure: The constructor parameter and the decoded error field take their allowed reason from separate declarations. The named guard-reason domain lacks the schema-derived type and identity metadata required by the cited standards.
- fix: Import `LiteralKit` from `@beep/schema`, define module-local `GuardReason = LiteralKit(["NestingDepthExceeded"])` with `$I.annoteSchema` identity metadata, derive the existing exported type as `export type GuardReason = typeof GuardReason.Type`, and use `GuardReason` for the error's `reason` field while preserving its field description. Preserve the literal, `GuardExceeded.new` signature and message, error carrier, and all upstream test lines. Do not export the schema value or add a barrel export.
- seats: grok.md:fable-3-1, fable.md:fable-3-1
- disposition: This is an outstanding schema-law repair, not bookkeeping for a completed forced change. `git log --format=%h:%s -- scratchpad/effected/toml/internal/limits.ts` and the all-ref history were read, followed by the file diffs for `db5c0f854b` (effected-port step 2) and `b45c0b463a` (effected-port S1). Step 2 forced the native-to-tagged guard error conversion; S1 forced the tagged cap error. Both leave the literal alias intact. Those forced adaptations are retained. No finding alleges an unforced upstream divergence, and no upstream restore is assigned.

## Backlog

None. Neither finding-bearing seat proposes docs, JSDoc, coverage, vitest-canon work, an unsupported performance change, or a fix outside the port's write surface.

## Handled by the deviation codemod

None. Neither seat asks only to record a law-forced change. Any resulting systemic schema/export/deviation bookkeeping remains centrally owned and is not assigned to the fix group.

## Rejected

None. The sole distinct defect has concrete source evidence, a cited schema standard and a concrete fix. It is a requirement the reported green gates missed and contradicts no operator ruling. Duplicate seat records are merged, not counted as rejections. Sol's `NO FINDINGS` report is not a finding to reject.

Group ownership: `g1` owns only `scratchpad/effected/toml/internal/limits.ts`. The repair preserves the current literal domain and runtime behavior and requires no test-file edits, so `tests` is empty. Existing `scratchpad/test/toml/internal/limits.property.test.ts` already exercises `GuardExceeded` schema encode/decode; it is a validation input, not an assigned write. The group has one source file, no overlap and no repo-level config, ledger or README Port-notes assignment.

REQUIRED: 1  BACKLOG: 0  CODEMOD: 0  REJECTED: 0  GROUPS: 1
