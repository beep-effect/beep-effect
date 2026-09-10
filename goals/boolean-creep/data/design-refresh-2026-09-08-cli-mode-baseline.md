# CLI mode baseline design refresh

Date: 2026-09-08

Exact source: `7440cb8c4302ce64b87860069a464bafbf65f576`

Corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`

## `goals-portfolio-index-mode` scope finding

The recorded symbol is `runGoalsIndex`, whose entire carrier is the anonymous
function parameter at
`packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:278-281`.
This falls under the explicit exclusion in
`goals/boolean-creep/ops/prompts/sweep-lane-round1.md:44`: function flag
parameters are out of census scope.

All four raw pairs have defined behavior inside that function. False/false
prints, true/false writes, false/true checks, and combined true emits the exact
Console error then fails with the exact reported-exit message at lines 282-285.
The upstream `writeFlag` and `checkFlag` declarations at lines 253-260 are CLI
parser configuration, but they are not the recorded symbol/carrier. Treating
them as the opportunity would require a distinct census record rather than
expanding this one.

The parent withdrew the record and archived its design; this is a scope
correction, not a D1 workaround. Existing byte rendering, absence-allowed check behavior at
lines 262-275, CLI flags, and tests remain source behavior outside this record.

## `fallow-boundaries-mode`

This record is rooted in actual CLI parser configuration at
`packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts:460-476`, not
only callback parameters. The command rejects combined true before
`findRepoRoot` at lines 477-481, then performs shared rendering before its
write/check/print dispatch at lines 483-499.

The refreshed design corrects the member and evidence citations and requires
the shared exclusive resolver to run at the current pre-repository boundary.
All four raw pairs preserve behavior, including the ordered pair of conflict
messages. Generated JSONC bytes, output-path resolution, doctrine checking,
package scripts, and orchestration argv remain unchanged.

## `sync-data-to-ts-run-mode`

The named `checkFlag` and `dryRunFlag` parser configuration lives at
`SyncDataToTs.command.ts:40-47`. The local resolver at lines 67-83 rejects
combined true with `SyncDataToTsError`; otherwise it maps to the already-owned
`SyncDataRunMode`. The command finds the repository root at line 558, resolves
mode at line 559, resolves targets at line 560, then passes only the literal
through execution and reporting.

The refreshed design preserves this exact error precedence and all four raw
pair behaviors. It requires command-specific coverage for write, check,
dry-run, conflict, exact message, and root-before-mode/mode-before-target
ordering. Shared helper tests alone do not prove this adapter contract. Report
JSON already emits the literal and remains unchanged.

## `skills-run-mode`

The named CLI flags at `Skills.command.ts:301-308` are parser configuration.
The local resolver at lines 879-889 rejects combined true before entering the
filesystem/repository/network workflow at lines 908-978. The workflow already
stores and reads one `SkillsRunMode` literal.

The refreshed design corrects the instance citation, reuses shared `RunMode`,
and preserves the four raw pairs, exact typed conflict, pre-work error
boundary, direct workflow seam, lock/config output, and command-specific test
coverage.

## `runners-bake-cli-mode`

`BakeCliOptions` is a named options carrier at `Runners.command.ts:93-105`.
`runBakeCommand` acquires `RunnersService`, resolves the pair, then matches the
existing `BakeMode` at lines 107-163. The dual `resolveBakeMode` is exported
through `commands/Runners/index.ts:14`, documented, and directly tested at
`runners-bake.test.ts:269-274`.

The old design incorrectly called that resolver zero-consumer and never
shipped. The refreshed design retains both public call forms and exact error as
a compatibility wrapper over the shared exclusive resolver. The options
carrier migrates to `mode: BakeMode`; CLI flags, defaults, independent JSON
toggle, required bake payloads, renderer/JSON behavior, and test service seam
remain intact.

## `r2-tooling-bin-main-fast-paths`

The two mutable booleans at `packages/tooling/tool/cli/src/bin-main.ts:197-244`
are real process state across dynamic imports. Quality is attempted first; CI
is gated behind quality not being handled; the full command tree runs only
when neither is handled. Quality parser `None` deliberately falls through.
The `canUseQualityTaskFastPath` and `canUseCiFastPath` argv predicates at lines
87-90 project the same disjoint routing decision.

The refreshed design preserves all protected imports and `rawArgv` behavior
through the `fastLintFixNoop` exit at lines 11-74. It loads the existing narrow
`@beep/schema/LiteralKit` export only afterward, classifies normalized `argv`,
and retains quality, lint-policy, CI, root-global, default, and parser-None
behavior. `lint-subcommand-allowlist.test.ts:208-230` remains the protected
module-load contract; new assertions must distinguish the post-boundary narrow
load from the forbidden pre-boundary/root-schema loads.

## Family design accounting

No shared literal or resolver behavior changed in
`family-cli-mode-flags.md`. The withdrawn `goals-portfolio-index-mode` instance
link was removed; the other five entries already use the ratified shared owners
and remain listed.

## Verification

All stored/config carriers, raw tuples, defaults, conflicts, error ordering,
writers, readers, public/test barrels, focused tests, and bin-main lazy-load
boundaries were inspected at the exact source.

- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts`
  completed against 103 qualified ids and named only the unrelated missing
  `html-link-imagesizes-disposition` and `tabstrip-overflow-disposition`
  surfaces. None of the five retained designs was named; the parent owns the
  final aggregate after those concurrent surfaces settle.
- Scoped `git diff --check` over the five retained designs, parent-owned
  withdrawal, family-list correction, and this handoff passed.

This is design preparation. Formal P3 review, implementation, inventory
status, archive/count changes, and source edits remain outside this lane.
