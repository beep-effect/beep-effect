# commands — round-3 review inventory

Seats read: `grok.md` (grok), `sol.md` (sol), and `fable.md` (independent grok-4.7 medium fallback seat). Read both adjacent briefs, `BRIEF.md` and `BRIEF.grok3.md`; there are no part-N reports. Grok and the fable seat report no findings; Sol reports one required finding.

Merged counts: **Required 1 · Backlog 0 · Handled by the deviation codemod 0 · Rejected 0 · Groups 1**. No duplicate findings. The current `standards/effect-laws.allowlist.jsonc` contains **zero** entries for `scratchpad/effected/commands/**`, so there are no `allow-<n>` additions.

Review baseline: `3ad7b305790c7f0903f6d55766c55186745ba2d1`, as pinned by both briefs. Inspected checkout: branch `@lab/effected-2`, HEAD `843c475bfdf0e57f6f5d813d956a92b06bd73cdc`; the group's source and test have no diff from the review baseline and no local edits. The requested `@lab/effected` branch was not selected or changed. Classification follows the entire operator revision block, D1–D20, section 12.5 and section 14; the operator rulings supersede the briefs' assertion that S2/S3 have run. Previous-round entries are context, not new round-3 findings.

## Required

### sol-3-1
- file: scratchpad/effected/commands/ScriptedSpawner.ts:106
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, Core Principle 5 (Schemas Are Executable Contracts); `standards/effect-first-development.md` EF-3; D11 schema-defect criterion; D9 and section 14 require the law-forced validator to preserve core's accepted key domain.
- evidence: The Sol seat's read-only Bun probes supplied a complete SpawnRecord with `options.additionalFds: { "fd 3": { type: "input", stream: 42 } }`: `S.is(SpawnRecord)` returned true and `S.decodeUnknownOption(SpawnRecord)` returned Some, preserving the options object and the numeric stream. The same invalid payload under `fd3` returned false / None; `fd0x3` also bypassed validation. Its in-memory TypeScript check accepted `fd 3` and `fd0x3` as `fd${number}` keys and rejected the control `fdNaN`. Source inspection confirms `additionalFds` uses `S.Record(S.TemplateLiteral(["fd", S.Finite]), ...)` at :106–109, then the enclosing `S.declare<ChildProcess.CommandOptions>` preserves the original object at :110. Core declares `additionalFds?: Record<\`fd${number}\`, AdditionalFdConfig>` in `node_modules/effect/src/process/ChildProcess.ts:512`. The narrower template excludes those numeric spellings, so their values are treated as excess properties and never checked by the input/output union. `scratchpad/test/commands/ScriptedSpawner.test.ts:175–194` checks canonical fd3/fd4 and options identity, with no noncanonical numeric-key regression. These code paths are unchanged from the reviewed commit.
- failure: The public guard and decoder accept an invalid additional-FD configuration as ChildProcess.CommandOptions. After narrowing an entry to `type: "input"`, a consumer receives `stream: 42` where the type promises an optional Stream<Uint8Array, PlatformError>. The corresponding output arm can leave invalid sink payloads unchecked too. This is a concrete validation hole missed by the existing green gates.
- fix: Replace the additional-FD key schema with one covering core's full fd${number} key domain so every matching entry is validated by the existing input/output configuration union. Preserve the original options object and its opaque stream/sink carriers. In scratchpad/test/commands/ScriptedSpawner.test.ts add guard and decoder regressions proving that "fd 3" and "fd0x3" accept valid input/output configurations and reject invalid stream/sink payloads; retain canonical fd3/fd4 cases and options-object identity assertions. Keep D15 compliance, using the module's deliberatelyInvalid helper if a wrong-input cast is necessary.
- seats: sol-3-1
- classification: Required under D11: the evidence shows the forced schema change itself is wrong, rather than missing bookkeeping or an optional schema preference. `git log --format=%h:%s -- scratchpad/effected/commands/ScriptedSpawner.ts` identifies the round-1 progress commit and round-2 repair; the original round-1 law/schema repair diff `8528abab64` introduces this exact additional-FD validator and opaque carrier. Preserve that forced schema repair and fix its fidelity; do not restore the upstream type-only declaration, broadly substitute S.Number to evade the finite-number rule, or assign ledger/README Port-notes writes. Group g1 owns the sole source file and the regression test file.

## Backlog

None. The round-3 seats supplied no docs, JSDoc, coverage, vitest-canon, outside-D11 or outside-write-surface findings. Earlier-round backlog is not re-counted here.

## Handled by the deviation codemod

None. No round-3 finding asks only to record a law-forced change. Central bookkeeping for the original schema repair remains with the codemod; sol-3-1 concerns the validator's incorrect behavior and stays required.

## Rejected

None. The sole reported finding supplies evidence, an observable failure and a concrete fix. It demonstrates a gate miss and does not contradict an operator ruling. NO FINDINGS seat summaries are not rejected findings.

REQUIRED: 1  BACKLOG: 0  CODEMOD: 0  REJECTED: 0  GROUPS: 1
