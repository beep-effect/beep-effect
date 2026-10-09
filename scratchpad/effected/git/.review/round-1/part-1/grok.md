I'll review `scratchpad/effected/git/Git.ts` against the port decisions and the pinned upstream oracle, and report findings only. First I'm loading the review laws, the port ledger, and that file.The ledger records no deviations for git. I'll compare `Git.ts` with the pinned upstream file and check the laws the gates do not already cover.The prior pass closed the `orElseSucceed` hypothesis. I am re-checking the remaining defect-class and documentation sites against the pinned oracle and the port decisions before I write findings.### grok-1-1
- file: scratchpad/effected/git/Git.ts:4588
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 and section 14; beep-laws/no-native-runtime (`Effect.die(new Error(...))` is a strict violation). Operator ruling 2026-10-09: one ledger plus README deviation entry per systemic class, not one entry per site.   evidence: Upstream `notStubbed` dies with `new Error` (`packages/git/src/Git.ts:4054`). The port dies with `NotStubbedError` (`_tag` `"NotStubbedError"`, `S.TaggedError`). `scratchpad/test/git/GitTestDouble.test.ts:37` asserts `instanceOf(defect, NotStubbedError)`; upstream `__test__/GitTestDouble.test.ts:33` asserts `instanceOf(defect, Error)`. The message string is unchanged, and `YieldableError` still extends `Error`. `w1-git.deviations` is `[]` and README Port notes → Deviations is `None`.
- failure: The defect tag and constructor differ from upstream, and the adjusted test is not cited in the ledger or Port notes.
- fix: Add one native-runtime deviation entry for `NotStubbedError`, citing `GitTestDouble.test.ts:37`. Do not restore `new Error`.

### grok-1-2
- file: scratchpad/effected/git/Git.ts:255
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D9 and section 14; `@effect/tsgo` `schemaNumber` (Schema.Number accepts NaN and the infinities; Schema.Finite rejects them). Same systemic-class recording rule as grok-1-1.   evidence: `GitCommandError.exitCode` is `S.optionalKey(S.Finite)` at line 255; upstream is `Schema.optionalKey(Schema.Number)` (`packages/git/src/Git.ts:239`). `LsFilesEntry.stage` is `S.Finite` at line 1330; upstream is `Schema.Number` (`packages/git/src/Git.ts:1233`). `parseLsFiles` still does `Number(header[2] ?? "0")` (line 1349), so a non-numeric stage becomes NaN and `LsFilesEntry.make` throws. No upstream test passes a non-finite exit code or stage. Neither site is in `w1-git.deviations` or Port notes.
- failure: Direct construction or decode of a non-finite `exitCode` or `stage` is rejected. Upstream accepts those values. Real git exit codes and stages `0`–`3` are unchanged.
- fix: Add one `schemaNumber` deviation entry listing both fields, with no upstream test to retarget. Do not restore `Schema.Number`.

REQUIRED: 0
BACKLOG: 2
