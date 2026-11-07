---
title: "D-21 Runner retirement as built (census rows X1-X10)"
date: 2026-11-06
lane: "feat/gh-git-w7-retire"
reversal: "Restore runGitOutput, runGitPathList, runGitLines, runGitRawOutput and their capture helpers in internal/repo-run/GitExec.ts from the pre-retirement tree, point the Laws, Doctor and Knowledge sites back at them, and drop the frozen-w7b import repoints in the older differentials."
---

The generic runners `runGitOutput`, `runGitPathList`, `runGitLines`, `runGitRawOutput`, the private `runGitCaptured`,
`structuredCapture` and `gitPathOutputBound` helpers and the `gitLinesFromOutput` parser leave
`internal/repo-run/GitExec.ts`; `runGitStructured` stays for the one KEEP consumer `writeGitArchive` (X3) and
`runGitFoldedStdout` for the Yeet patch-identity digest (Y33). **Census outcomes.** X1 `currentBranch(...,
"show-current")` -> `Git.currentBranch(cwd, { mode: "show-current" })`, `None` rendered as the empty string
`branch --show-current` printed on a detached HEAD; the reader now needs only `Git`. X2
`guardCloneLocalGitAttributes` -> `Git.gitDir(cwd, { path: "info/attributes" })` (absolute, so no resolve against
`cwd`); Knowledge's wrapper narrows to `Git | FileSystem | Path`. X3 KEEP as censused. X4-X7 (`bin.ts`, `bin-main.ts`
pre-runtime `Bun.spawnSync`) and X8-X10 (ai-metrics evidence probes) stand as censused. **Uncensused live callers found
at retirement.** `Laws/EffectImports.listGitVisiblePaths` (`ls-files -z --cached --others --exclude-standard`) ->
`Git.lsFiles` plus `Git.untrackedFiles` unioned, so the Laws command, its tests and
`goals/effected-promotion/ops/glob-adoption-parity.ts` provide `Git`; `Goals/Doctor.makeGoalPacketWorkingTreeReader`
(`ls-files -z --others --ignored --exclude-standard -- goals`, landed by #2704 after the census) -> KEEP on
`runRepoCommandCaptureRaw` because the kit has no `--ignored` member, and the `GoalsGitError` adapter it fed is
deleted. **Frozen evidence.** The older differentials (`yeet-git-differential-w1b.ts`, `dirty-axis-differential-w2.ts`,
`yeet-remainder-differential-w2b.ts`) and the effected-promotion parity script import the retired runners from
`ops/frozen-w7b/GitRunners.old.ts`, the verbatim lane-base copy, so the frozen bodies keep replaying. **Seals.**
`Goals.errors.ts` leaves the goals-doctor and knowledge policy seals (`research/cache-baseline-review-w7-retire.md`).
