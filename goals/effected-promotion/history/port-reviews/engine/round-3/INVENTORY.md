# Engine — round-3 merged review inventory

Seats read: `grok.md`, `sol.md`, `fable.md`; briefs read: adjacent `BRIEF.md` and `BRIEF.grok3.md`. No `part-N` reports exist. Brief commit: `3ad7b305790c7f0903f6d55766c55186745ba2d1`. Grok reports no findings; Sol and Fable each report one. Their two records describe one defect and are merged below, retaining both seat ids and Fable's additional commented-import case.

Counts: **Required 1 · Backlog 0 · Handled by the deviation codemod 0 · Rejected 0 · Groups 1**.

Authority: the entire operator revision block in `scratchpad/EFFECTED_PORT_GOAL.md`, including the 2026-10-09 rulings and later grilling; D1–D20; sections 12.4, 12.5 and 14; the task's S2/S3 deferral and write-surface limits. This item is a demonstrated dependency-boundary test bug, not deferred coverage or vitest-canon work. The briefs' green-gate statements are review context, not a fresh verification claim.

Provenance: the available checkout is `@lab/effected-2`, rather than the requested `@lab/effected`; it was read in place without switching branches. The oracle is the briefs' pinned `af7566a9da2eff169cb74955efcc5ede1e5de9f8` snapshot under `~/.cache/beep/effected-port/upstream/`, not the moving reference checkout. Read-only Node comparisons reproduced all three missed runtime imports and confirmed the existing JSDoc and multiline/type-only controls. No compiler scratch-copy probe, vitest run, coverage run, or closeout/ledger command was used.

Allowlist audit: current `standards/effect-laws.allowlist.jsonc` contains **zero** entries for `scratchpad/effected/engine/**`; there are no `allow-<n>` findings to add. Prior-round findings are not carried forward as new round-3 records. Central deviation recording and README Port notes are not assigned to a fix group.

Dispatch ownership: `g1` owns only `scratchpad/test/engine/entrypoints.test.ts`. It has zero source files and one test file, with no overlapping write surface. Production guard changes, repo configuration and central bookkeeping are unnecessary for this fix.

## Required

### sol-3-1
- file: scratchpad/test/engine/entrypoints.test.ts:17
- class: test   severity: required
- standard: D9 (upstream tests retain their meaning), D11 (demonstrated bug), section 11.1 (no weakening of upstream tests), section 14, and the later grilling ruling on unforced divergences.   evidence: Both seats identify the narrowed import-clause regex. A fresh read-only Node probe extracted the regexes from the pinned oracle `__test__/entrypoints.test.ts:17` and the lab file: `import fs, { readFileSync } from "node:fs";`, `import fs, * as fsNamespace from "node:fs";`, and `import fs /* binding */ from "node:fs";` each produce `["node:fs"]` in the oracle and `[]` in the lab. The same probe confirms that the oracle falsely reports `unexpected-package` from the existing exported-class JSDoc fixture while the lab correctly returns `[]`; both walkers return `["effect/Schema", "./Guard.ts"]` for the existing multiline/type-only fixture. Sol also reports that prepending a combined import to actual ProcessGuard text in memory leaves the lab's detected dependencies unchanged. Current fixtures omit the three failing forms, demonstrating why the reported green gates miss this defect.
- evidence: Historical attribution: `git log --format=%h:%s -- scratchpad/test/engine/entrypoints.test.ts` identifies `f6b00b77d4` (round-2 S4); `git log --all` also exposes the earlier stage commits. The `7f67982f77` step-2 diff adds only the nodeBuiltinImport diagnostic header. The `460424e2c6` S1 diff changes the built path and guard assertions to the operator-authorized effect/* boundary, retaining the oracle regex. The `f6b00b77d4` diff introduces the narrowed regex and its two controls while removing the S3 AST walker. Thus diagnostic compliance and the effect/* ruling did not force the loss of valid runtime clauses. The existing recorded `upstream-bug` deviation justifies excluding exported-class JSDoc imports; it does not justify missing these runtime imports. This finding repairs that implementation rather than merely asking to record a forced change.
- failure: The source and built guard graph checks silently omit valid imports combining a default binding with named or namespace bindings, and imports with a comment before `from`. They can accept a forbidden runtime package or miss a reachable local module that the upstream walker detects, weakening the dependency boundary beyond the verified JSDoc false-positive correction.
- fix: In `runtimeImportsIn`, extend the import-clause matching to recognize default-plus-named, default-plus-namespace and comment-separated bindings while retaining the exported-class JSDoc exclusion, multiline runtime clauses and type-only filtering. Restore the upstream recognition of these runtime forms; preserve the diagnostic header, lab paths, HashSet traversal, effect/*-only guard assertions and main-entry controls. Add three regression fixtures using the demonstrated declarations, each asserting `["node:fs"]`, and retain the existing JSDoc `[]` and multiline/type-only fixtures. Do not revert to the unmodified oracle regex, which would reintroduce the verified JSDoc bug, or add an unrelated AST rewrite or repo dependency. Any central deviation record remains outside this group's write surface.
- seats: sol-3-1, fable-3-1

## Backlog

None. Neither round-3 seat finding concerns docs, JSDoc carriers, coverage, vitest canon, an unsupported performance claim, or a repo-level change outside the port's write surface.

## Handled by the deviation codemod

None. No round-3 finding only requests recording a law-forced change. The existing law-forced guard/schema/import changes remain central bookkeeping and are not new inventory findings.

## Rejected

None. The two contributing seat records provide concrete evidence and a concrete fix, demonstrate a miss despite the green-gate context, and agree with the operator rulings. Deduplication is not a rejection.
