# Round 1 inventory — claudecode-events

Read-only review of `scratchpad/claudecode/Hook/Events/` against
`.patterns/jsdoc-documentation.md` and the annotation conventions.

Census claimed 31 modules missing `@packageDocumentation` and 116 open
owning exports. This review **confirms the 31 module misses** and
**rejects all 116 open-export mechanicals** (86 `declare namespace`
companions flagged for a required Example; 30 barrel `export { … }`
graph edges on `index.ts`). Editorial findings are the real work:
signature-echo leads, placeholder `console.log(Hook.Event.symbol)`
Examples, zero `@see` tags in the tree, and Gotchas that already live
in file-header comments but never reached the constructor that can
hurt a caller.

`$I.annote` / `$I.annoteSchema` is present on exported schemas. No
legacy `@example` / `@remarks` / `@module` / `@template`. No named
`Schema`/`Option`/`Array` example imports.

---

## Mechanical — missing `@packageDocumentation` (one item per file)

### claudecode-events-R1-001: ConfigChange.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/ConfigChange.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Header has `@since 0.0.0` and a second paragraph of real semantics, but the lead is the name-echo "ConfigChange hook event." and there is no `@packageDocumentation`.
- `impact`: Exporting modules require a useful lead, `@packageDocumentation`, and `@since 0.0.0`. The ratchet scores this file as an open module.
- `suggestedFix`: Make the fire-when / `decision: "block"` / matcher-on-`source` paragraph the single lead. Add `@packageDocumentation` immediately before `@since 0.0.0`. Never `@module`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-002: CwdChanged.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/CwdChanged.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead is "CwdChanged hook event." Useful semantics (observability-only, `$CLAUDE_ENV_FILE`, no matcher) sit in a second paragraph; no `@packageDocumentation`.
- `impact`: Same module-header contract as the rest of the pack.
- `suggestedFix`: Promote the purpose paragraph to the lead; add `@packageDocumentation` before `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-003: Elicitation.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Elicitation.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "Elicitation hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead covering accept/decline/cancel without user interaction and matcher on `mcp_server_name`; add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-004: ElicitationResult.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/ElicitationResult.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "ElicitationResult hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (post-user-response override, matcher on `mcp_server_name`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-005: FileChanged.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/FileChanged.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "FileChanged hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (observability-only; matcher is basename of `file_path`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-006: InstructionsLoaded.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/InstructionsLoaded.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "InstructionsLoaded hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (output is not acted on; matcher on `load_reason`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-007: MessageDisplay.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/MessageDisplay.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "MessageDisplay hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (display-only; transcript keeps original text; no matcher); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-008: Notification.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Notification.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "Notification hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (cannot block or modify the notification; matcher on `notification_type`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-009: PermissionDenied.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PermissionDenied.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "PermissionDenied hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (denial already happened; `retry: true` asks the model to try again); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-010: PermissionRequest.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PermissionRequest.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "PermissionRequest hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (allow/deny before the dialog, optional rule persistence, matcher on `tool_name`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-011: PostCompact.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostCompact.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "PostCompact hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (observability-only; matcher on `trigger`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-012: PostToolBatch.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostToolBatch.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "PostToolBatch hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (after a parallel batch, no matcher); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-013: PostToolUse.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostToolUse.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "PostToolUse hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (block/feedback, extra context, replace tool or MCP output, matcher on `tool_name`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-014: PostToolUseFailure.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostToolUseFailure.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "PostToolUseFailure hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (attach context beside the raw error; matcher on `tool_name`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-015: PreCompact.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PreCompact.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "PreCompact hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (can `block` compaction; matcher on `trigger`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-016: PreToolUse.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PreToolUse.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "PreToolUse hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (`allow`/`deny`/`ask`/`defer`; matcher on `tool_name`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-017: SessionEnd.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SessionEnd.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "SessionEnd hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (observability-only; matcher on `reason`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-018: SessionStart.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SessionStart.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "SessionStart hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (no `permission_mode`; inject context via `addContext`; matcher on `source`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-019: Setup.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Setup.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "Setup hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (`--init-only` / maintenance triggers; matcher on `trigger`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-020: Stop.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Stop.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "Stop hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (`decision: "block"` forces continuation; no matcher); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-021: StopFailure.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/StopFailure.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "StopFailure hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (output **and** exit code ignored; matcher on `error`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-022: SubagentStart.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SubagentStart.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "SubagentStart hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (inject context only; **cannot block spawn**; matcher on `agent_type`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-023: SubagentStop.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SubagentStop.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "SubagentStop hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (`block` forces the subagent to continue; matcher on `agent_type`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-024: TaskCompleted.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/TaskCompleted.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "TaskCompleted hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (block completion via exit 2 + stderr; no matcher); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-025: TaskCreated.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/TaskCreated.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "TaskCreated hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (block creation via exit 2 + stderr; no matcher); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-026: TeammateIdle.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/TeammateIdle.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "TeammateIdle hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (`keepWorking` is exit 2 + stderr; no matcher); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-027: UserPromptExpansion.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/UserPromptExpansion.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "UserPromptExpansion hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (slash-command expansion before Claude; matcher on `command_name`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-028: UserPromptSubmit.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/UserPromptSubmit.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "UserPromptSubmit hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (block erases the prompt; no matcher); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-029: WorktreeCreate.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/WorktreeCreate.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "WorktreeCreate hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (command hooks print the path on stdout; HTTP hooks return `hookSpecificOutput.worktreePath`); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-030: WorktreeRemove.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/WorktreeRemove.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead "WorktreeRemove hook event."; no `@packageDocumentation`.
- `impact`: Module fails the exporting-module header law.
- `suggestedFix`: One purpose-first lead (cleanup/observability; output is not acted on; no matcher); add `@packageDocumentation`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-031: index.ts missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/index.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead already explains the aggregate re-exports plus `HookInput`; `@since 0.0.0` is present; `@packageDocumentation` is not.
- `impact`: This is the pack entry; missing `@packageDocumentation` is the census open-module bit.
- `suggestedFix`: Keep the existing purpose lead; add `@packageDocumentation` before `@since 0.0.0`. Do not document the `export { ConfigChange, … }` names as new symbols.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Editorial — signature-echo leads (one item per file)

Leads that restated the name (`Schema for \`Input\``, `Constructor for \`define\``, `Type-level model for \`Trigger\``, `X hook event.`) are listed. Constructors whose lead already teaches a decision are omitted from `evidence`. `declare namespace` companions ("Decoded and wire-encoded companion types for {@link …}") are precise enough and are not listed.

### claudecode-events-R1-032: ConfigChange.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/ConfigChange.ts:26
- `symbol`: ConfigSource, ConfigSource (type), Input, Output, allow, block, define
- `kind`: value
- `evidence`: "`Schema for \`ConfigSource\`." / "`Constructor for \`allow\`." / "`Type-level model for \`ConfigSource\`." `onMatcher` already has a useful lead and is not in this list.
- `impact`: Hover docs tell the caller the identifier, not that `block` cannot stop `policy_settings` or that `allow()` is empty `Output.make()`.
- `suggestedFix`: Rewrite each lead as the problem the symbol solves. Keep `onMatcher`. Add described `@see` among `allow` / `block` / `define` / `onMatcher`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-001
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-033: CwdChanged.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/CwdChanged.ts:32
- `symbol`: Input, Output, passthrough, watchPaths, define
- `kind`: value
- `evidence`: Every value lead is `Schema for \`Input\`` / `Constructor for \`passthrough\`` / same shape for `watchPaths` and `define`.
- `impact`: Callers cannot tell `watchPaths` writes `Output.watchPaths` versus persisting via `$CLAUDE_ENV_FILE`.
- `suggestedFix`: Purpose-first leads; described `@see` among `passthrough` / `watchPaths` / `define`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-002
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-034: Elicitation.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Elicitation.ts:25
- `symbol`: Action, Action (type), Mode, Mode (type), Input, HookSpecificOutput, Output, accept, decline, cancel, define
- `kind`: value
- `evidence`: Schema/type/constructor echo. `passthrough` ("No-op output — Claude Code continues the normal elicitation flow.") is already useful.
- `impact`: `accept` vs `decline` vs `cancel` are the choice a caller must make; the leads do not say so.
- `suggestedFix`: Teach the three actions and when `content` is required; keep `passthrough`; add described `@see`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-003
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-035: ElicitationResult.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/ElicitationResult.ts:25
- `symbol`: Action, Action (type), Mode, Mode (type), Input, HookSpecificOutput, Output, accept, decline, cancel, define
- `kind`: value
- `evidence`: Same echo pattern as Elicitation. `passthrough` lead is already useful.
- `impact`: Callers cannot see that this event overrides an already-collected user response, not the original prompt.
- `suggestedFix`: Purpose-first leads that distinguish Result from Elicitation; described `@see` across accept/decline/cancel/passthrough.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-004
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-036: FileChanged.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/FileChanged.ts:35
- `symbol`: FileChangedEvent, FileChangedEvent (type), Input, Output, passthrough, watchPaths, define
- `kind`: value
- `evidence`: Schema/constructor echo. `onMatcher` already says it matches basenames from `file_path`.
- `impact`: `watchPaths` vs `passthrough` vs `onMatcher` are siblings a caller must choose; echo leads hide that.
- `suggestedFix`: Purpose-first leads; keep `onMatcher`; described `@see`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-005
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-037: InstructionsLoaded.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/InstructionsLoaded.ts:30
- `symbol`: MemoryType, MemoryType (type), LoadReason, LoadReason (type), Input, Output, passthrough, define
- `kind`: value
- `evidence`: Schema/type/constructor echo. `onMatcher` lead is useful.
- `impact`: Nothing on the symbols says returning Output does not affect Claude Code.
- `suggestedFix`: Purpose-first leads that mention observability-only; keep `onMatcher`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-006
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-038: MessageDisplay.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/MessageDisplay.ts:23
- `symbol`: Input, HookSpecificOutput, Output, passthrough, display, define
- `kind`: value
- `evidence`: All value leads are `Schema for` / `Constructor for`, including `display`, whose file header already warns the transcript is unchanged.
- `impact`: A caller using `display` will think they rewrote Claude's message.
- `suggestedFix`: Purpose-first leads; put the display-only invariant on `display` (see R1-100).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-007
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-039: Notification.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Notification.ts:27
- `symbol`: NotificationType, NotificationType (type), Input, Output, define
- `kind`: value
- `evidence`: Schema/type/`Constructor for \`define\`` echo. `passthrough` and `onMatcher` already have useful leads.
- `impact`: `define` looks like a decision API on an event that cannot block or modify the notification.
- `suggestedFix`: Purpose-first leads; keep `passthrough` / `onMatcher`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-008
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-040: PermissionDenied.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PermissionDenied.ts:25
- `symbol`: Input, HookSpecificOutput, Output, define
- `kind`: value
- `evidence`: Schema echo plus `Constructor for \`define\``. `accept` / `passthrough` / `retry` / `onMatcher` already teach.
- `impact`: Schema hovers do not say the denial has already happened.
- `suggestedFix`: Purpose-first schema leads; keep the decision-helper leads.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-009
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-041: PermissionRequest.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PermissionRequest.ts:92
- `symbol`: PermissionSuggestion, Input, ModePermissionUpdate, DirectoryPermissionUpdate, PermissionUpdate, PermissionUpdate (type), PermissionDecision, HookSpecificOutput, Output, allow, deny, define
- `kind`: value
- `evidence`: Mixed file — `PermissionRule` and `RulePermissionUpdate` already teach; `passthrough` / `onMatcher` teach; the listed symbols are still `Schema for` / `Constructor for` / `Type-level model`.
- `impact`: `allow` can persist `updatedPermissions`; the echo lead hides the only reason to pick it over `passthrough`.
- `suggestedFix`: Purpose-first leads on the listed symbols; described `@see` across allow/deny/passthrough and the three `PermissionUpdate` variants.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-010
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-042: PostCompact.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostCompact.ts:23
- `symbol`: Trigger, Trigger (type), Input, Output, passthrough, define
- `kind`: value
- `evidence`: Schema/constructor echo. `onMatcher` lead is useful.
- `impact`: Callers will emit decision-shaped Output on an observability-only event.
- `suggestedFix`: Purpose-first leads that state there is no decision control.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-011
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-043: PostToolBatch.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostToolBatch.ts:22
- `symbol`: ToolCall, Input, HookSpecificOutput, Output, passthrough, block, addContext, define
- `kind`: value
- `evidence`: Every value lead is `Schema for` / `Constructor for`. No matcher exists; that fact is only in the file header.
- `impact`: `block` vs `addContext` vs `passthrough` is the caller choice and is undocumented on the symbols.
- `suggestedFix`: Purpose-first leads; described `@see` among the three decisions and `define`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-012
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-044: PostToolUse.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostToolUse.ts:30
- `symbol`: Input, HookSpecificOutput, Output, replaceMcpOutput, define, onTool
- `kind`: value
- `evidence`: Schema/`Constructor for \`replaceMcpOutput\`` / `define` / `onTool` echo. `passthrough` / `block` / `addContext` / `replaceOutput` / `onMatcher` / `onAdapter` already teach (see R1-102 for the misleading MCP sentence on `replaceOutput`).
- `impact`: `onTool` is the typed-tool entry; its lead is "Constructor for `onTool`." while `OnToolConfig` wears the real onTool prose.
- `suggestedFix`: Move the onTool semantics onto `onTool`; give `replaceMcpOutput` a lead that names `updatedMCPToolOutput`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-013
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-045: PostToolUseFailure.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostToolUseFailure.ts:24
- `symbol`: Input, HookSpecificOutput, Output, passthrough, addContext, block, define
- `kind`: value
- `evidence`: Schema/constructor echo. `onMatcher` lead is useful.
- `impact`: `addContext` is the reason this event exists; the lead is "Constructor for `addContext`."
- `suggestedFix`: Purpose-first leads; described `@see` among passthrough/addContext/block.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-014
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-046: PreCompact.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PreCompact.ts:27
- `symbol`: Trigger, Trigger (type), Input, Output, passthrough, block, define
- `kind`: value
- `evidence`: Schema/constructor echo including `block`. `onMatcher` lead is useful.
- `impact`: Callers cannot see that `block` prevents compaction rather than stopping the session.
- `suggestedFix`: Purpose-first leads; described `@see` between `passthrough` and `block`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-015
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-047: PreToolUse.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PreToolUse.ts:82
- `symbol`: PermissionDecision (type), onTool
- `kind`: value
- `evidence`: Most PreToolUse decision helpers already teach. Remaining echo: `Type-level model for \`PermissionDecision\`` and `Constructor for \`onTool\``. `OnToolConfig` currently holds the onTool prose and is tagged `@category constructors`.
- `impact`: Callers looking at `onTool` get a name restatement; the config type looks like a constructor.
- `suggestedFix`: Put onTool semantics on `onTool`; retarget `OnToolConfig` as type-level config (see R1-109); rewrite the type-alias lead as "Decoded value produced by {@link PermissionDecision}."
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-016
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-048: SessionEnd.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SessionEnd.ts:26
- `symbol`: ExitReason, ExitReason (type), Input, Output, passthrough, define
- `kind`: value
- `evidence`: Schema/constructor echo. `onMatcher` lead is useful.
- `impact`: Returning Output looks like session control on an observability-only event.
- `suggestedFix`: Purpose-first leads that state output is not acted on.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-017
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-049: SessionStart.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SessionStart.ts:35
- `symbol`: Source, Source (type), Input, HookSpecificOutput, Output, passthrough, startWithMessage, renameSession, watchPaths, reloadSkills, define
- `kind`: value
- `evidence`: Schema/constructor echo. `addContext` already names the canonical use-case; `onMatcher` is useful.
- `impact`: `startWithMessage` vs `addContext` vs `reloadSkills` are distinct session-start effects hidden behind "Constructor for".
- `suggestedFix`: Purpose-first leads; described `@see` among the HookSpecificOutput helpers.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-018
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-050: Setup.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Setup.ts:23
- `symbol`: Trigger, Trigger (type), Input, HookSpecificOutput, Output, passthrough, addContext, define, onMatcher
- `kind`: value
- `evidence`: Entire file is `Schema for` / `Constructor for`, including `onMatcher` (other events already upgraded that lead).
- `impact`: `Trigger` is `init` vs `maintenance`; the matcher default and `addContext` contract are invisible.
- `suggestedFix`: Purpose-first leads on every listed symbol.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-019
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-051: Stop.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Stop.ts:26
- `symbol`: BackgroundTask, SessionCron, Input, HookSpecificOutput, Output, addContext, define
- `kind`: value
- `evidence`: Schema/constructor echo. `allowStop` and `block` already teach the inverted `block` means continue.
- `impact`: `addContext` vs `block` is the remaining choice; `addContext` is still a name restatement.
- `suggestedFix`: Purpose-first leads; keep `allowStop` / `block`; described `@see`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-020
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-052: StopFailure.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/StopFailure.ts:24
- `symbol`: ErrorType, ErrorType (type), Input, Output, passthrough, define
- `kind`: value
- `evidence`: Schema/constructor echo. `onMatcher` lead is useful.
- `impact`: File header says output **and exit code** are ignored; none of the symbol leads say that.
- `suggestedFix`: Purpose-first leads that state Claude Code ignores both JSON and process status.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-021
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-053: SubagentStart.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SubagentStart.ts:24
- `symbol`: Input, HookSpecificOutput, Output, passthrough, addContext, define
- `kind`: value
- `evidence`: Schema/constructor echo. `onMatcher` lead is useful.
- `impact`: Nothing on `addContext`/`passthrough` says the spawn cannot be blocked.
- `suggestedFix`: Purpose-first leads; put the cannot-block invariant on Output/addContext (see R1-099).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-022
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-054: SubagentStop.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SubagentStop.ts:28
- `symbol`: Input, HookSpecificOutput, Output, allowStop, block, addContext, define
- `kind`: value
- `evidence`: All of those are `Schema for` / `Constructor for`. `onMatcher` already notes mismatch defaults to `allowStop()`. Unlike Stop.ts, `block` here does not explain the inverted meaning.
- `impact`: A caller will read `block` as "stop the subagent".
- `suggestedFix`: Mirror Stop.ts: `block` forces continuation; described `@see` to `allowStop`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-023
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-055: TaskCompleted.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/TaskCompleted.ts:22
- `symbol`: Input, Output, allow, block, define
- `kind`: value
- `evidence`: `Constructor for \`block\`` on a helper that returns `stderrExit(reason)` (`HookProcessOutput`), not JSON `Output`. `stopTeammate` already teaches.
- `impact`: Callers will treat `block` like ConfigChange.block (`decision: "block"` JSON). It is a process-exit protocol instead (see R1-107).
- `suggestedFix`: Lead must say exit 2 + stderr. Described `@see` among allow / block / stopTeammate.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-024
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-056: TaskCreated.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/TaskCreated.ts:23
- `symbol`: Input, Output, allow, define
- `kind`: value
- `evidence`: Schema/`Constructor for \`allow\`` / `define` echo. `block` and `stopTeammate` already teach.
- `impact`: `allow` looks like a permission decision rather than "let task creation proceed".
- `suggestedFix`: Purpose-first leads; keep `block` / `stopTeammate`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-025
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-057: TeammateIdle.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/TeammateIdle.ts:23
- `symbol`: Input, Output, allowIdle, define
- `kind`: value
- `evidence`: Schema/`Constructor for \`allowIdle\`` / `define` echo. `keepWorking` and `stopTeammate` already teach.
- `impact`: `allowIdle` vs `keepWorking` is the choice; `allowIdle` is a name restatement.
- `suggestedFix`: Purpose-first lead on `allowIdle`; described `@see` to `keepWorking`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-026
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-058: UserPromptExpansion.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/UserPromptExpansion.ts:22
- `symbol`: ExpansionType, ExpansionType (type), Input, HookSpecificOutput, Output, allow, block, addContext, define, onMatcher
- `kind`: value
- `evidence`: Entire file is echo, including `onMatcher` (`Constructor for \`onMatcher\``). Implementation defaults `onMismatch` to `allow()`, unlike most events' `passthrough()`.
- `impact`: A matcher miss silently allows the expanded prompt.
- `suggestedFix`: Purpose-first leads; document the `allow()` mismatch default on `onMatcher` (see R1-096).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-027
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-059: UserPromptSubmit.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/UserPromptSubmit.ts:27
- `symbol`: Input, HookSpecificOutput, Output, define
- `kind`: value
- `evidence`: Schema/`Constructor for \`define\`` echo. `allow` / `block` / `addContext` / `renameSession` already teach.
- `impact`: Schema hovers do not mention that `block` erases the prompt from context.
- `suggestedFix`: Purpose-first schema leads; keep the decision-helper leads.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-028
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-060: WorktreeCreate.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/WorktreeCreate.ts:24
- `symbol`: Input, HookSpecificOutput, Output, define
- `kind`: value
- `evidence`: Schema/`Constructor for \`define\`` echo. `created` and `createdHttp` already distinguish stdout vs JSON, but neither `@see`s the other.
- `impact`: `define`'s handler type is `Output | HookProcessOutput`; the echo lead hides the dual return.
- `suggestedFix`: Purpose-first schema/`define` leads; described `@see` between `created` and `createdHttp` (see R1-101).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-029
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-061: WorktreeRemove.ts signature-echo leads

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/WorktreeRemove.ts:20
- `symbol`: Input, Output, passthrough, define
- `kind`: value
- `evidence`: All four value leads are `Schema for` / `Constructor for`.
- `impact`: Output is not acted on; echo leads make `passthrough` look like a decision.
- `suggestedFix`: Purpose-first leads that state cleanup/observability only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-030
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-062: index.ts signature-echo / wrong-role lead

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/index.ts:153
- `symbol`: HookInput (type)
- `kind`: type
- `evidence`: Lead is "Public utility for `HookInput`." `@category utilities` on a same-name decoded type companion. `HookInput` value, `HookInputEncoded`, and `HookEventName` leads are already useful.
- `impact`: Callers think this is a helper function. Annotation patterns require a decoded-type companion with `@category type-level` and a described `@see` to the runtime schema.
- `suggestedFix`: "Decoded value produced by {@link HookInput}." `@category type-level`. `@see {@link HookInput} for the runtime union and decoding behavior.`
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-031
- `status`: open
- `fixedCommit`: pending

---

## Editorial — vacuous Examples (one item per file)

Placeholder pattern: `import { Hook } from "effect-claudecode"` then `console.log(Hook.Event.symbol)` with the function **not called**. Type-level leftovers are unused `type Example = Hook.Event.X`. Law: a titled Example must show the symbol doing its job with an observable result; `console.log(fn)` is a defect. The sole exception in this pack is `PreToolUse.define`, which actually calls `define({ handler })` and logs `hook.event`.

### claudecode-events-R1-063: ConfigChange.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/ConfigChange.ts:28
- `symbol`: ConfigSource, Input, Output, allow, block, define, onMatcher
- `kind`: value
- `evidence`: "`console.log(Hook.ConfigChange.allow)`" (and the same inspect-the-export shape for every listed symbol). Titles like "Use allow" never call `allow()`.
- `impact`: Docgen compiles a no-op. Callers never see `block("…")` produce `decision: some("block")`.
- `suggestedFix`: Call the constructors with realistic inputs; decode a sample `Input`; show `onMatcher` building a `HookDefinition`. Observable `console.log` of the returned `Output` or `hook.event`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-032
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-064: CwdChanged.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/CwdChanged.ts:34
- `symbol`: Input, Output, passthrough, watchPaths, define
- `kind`: value
- `evidence`: `console.log(Hook.CwdChanged.passthrough)` / `.watchPaths` / `.define` — logs the function, never `passthrough()` or `watchPaths(["/tmp"])`.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Invoke helpers; show `watchPaths` wrapping `O.some(paths)`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-033
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-065: Elicitation.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Elicitation.ts:27
- `symbol`: Action, Mode, Input, HookSpecificOutput, Output, accept, decline, cancel, passthrough, define, onMatcher, Action (type), Mode (type)
- `kind`: value
- `evidence`: Inspect-the-export `console.log` on values. Type Examples are unused `type Example = Hook.Elicitation.Action` (no narrowing/inference).
- `impact`: `accept({ field: "value" })` vs `decline()` is the API and is never shown.
- `suggestedFix`: Call accept/decline/cancel; drop or replace type Examples with a narrowing demonstration, or omit them (type-level Example is optional).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-034
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-066: ElicitationResult.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/ElicitationResult.ts:27
- `symbol`: Action, Mode, Input, HookSpecificOutput, Output, accept, decline, cancel, passthrough, define, onMatcher, Action (type), Mode (type)
- `kind`: value
- `evidence`: Same inspect-the-export / unused `type Example` pattern as Elicitation.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Call the action helpers with an override payload; omit unused type Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-035
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-067: FileChanged.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/FileChanged.ts:37
- `symbol`: FileChangedEvent, Input, Output, passthrough, watchPaths, define, onMatcher, FileChangedEvent (type)
- `kind`: value
- `evidence`: `console.log(Hook.FileChanged.onMatcher)` despite a lead about basename matching. Type Example is unused `type Example = …FileChangedEvent`.
- `impact`: The basename matcher is the non-obvious behavior and is never demonstrated.
- `suggestedFix`: Show `onMatcher({ matcher: "package.json", handler })` and `watchPaths` producing `Output`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-036
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-068: InstructionsLoaded.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/InstructionsLoaded.ts:32
- `symbol`: MemoryType, LoadReason, Input, Output, passthrough, define, onMatcher, MemoryType (type), LoadReason (type)
- `kind`: value
- `evidence`: Inspect-the-export plus unused `type Example` aliases.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Decode a sample Input; call `passthrough()`; omit unused type Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-037
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-069: MessageDisplay.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/MessageDisplay.ts:25
- `symbol`: Input, HookSpecificOutput, Output, passthrough, display, define
- `kind`: value
- `evidence`: `console.log(Hook.MessageDisplay.display)` never calls `display("…")`.
- `impact`: Callers never see `hookSpecificOutput.displayContent`.
- `suggestedFix`: Call `display` and `passthrough`; log the resulting Output fields.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-038
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-070: Notification.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Notification.ts:29
- `symbol`: NotificationType, Input, Output, passthrough, define, onMatcher, NotificationType (type)
- `kind`: value
- `evidence`: Inspect-the-export plus unused `type Example`.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Call `passthrough()`; show `onMatcher` selecting `notification_type`; omit unused type Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-039
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-071: PermissionDenied.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PermissionDenied.ts:27
- `symbol`: Input, HookSpecificOutput, Output, accept, passthrough, retry, define, onMatcher
- `kind`: value
- `evidence`: Useful leads on accept/retry still pair with `console.log(Hook.PermissionDenied.retry)` — the function is never called.
- `impact`: `retry: some(true)` vs `retry: some(false)` vs omitted output is never shown.
- `suggestedFix`: Call `accept()`, `retry()`, and `passthrough()` and inspect `hookSpecificOutput`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-040
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-072: PermissionRequest.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PermissionRequest.ts:32
- `symbol`: PermissionRule, PermissionSuggestion, Input, RulePermissionUpdate, ModePermissionUpdate, DirectoryPermissionUpdate, PermissionUpdate, PermissionDecision, HookSpecificOutput, Output, allow, passthrough, deny, define, onMatcher, PermissionUpdate (type)
- `kind`: value
- `evidence`: Inspect-the-export on every value. Type Example is unused `type Example = Hook.PermissionRequest.PermissionUpdate`.
- `impact`: `allow({ updatedPermissions })` vs `deny(message, { interrupt: true })` is the product API and is never shown.
- `suggestedFix`: Construct `allow`/`deny` with realistic options; show the union discriminator on `PermissionUpdate`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-041
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-073: PostCompact.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostCompact.ts:25
- `symbol`: Trigger, Input, Output, passthrough, define, onMatcher, Trigger (type)
- `kind`: value
- `evidence`: Inspect-the-export plus unused `type Example`.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Call `passthrough()`; show `onMatcher` on `"auto"`; omit unused type Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-042
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-074: PostToolBatch.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostToolBatch.ts:24
- `symbol`: ToolCall, Input, HookSpecificOutput, Output, passthrough, block, addContext, define
- `kind`: value
- `evidence`: `console.log(Hook.PostToolBatch.block)` never calls `block("…")`.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Call `block` / `addContext` / `passthrough` and inspect Output.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-043
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-075: PostToolUse.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostToolUse.ts:32
- `symbol`: Input, HookSpecificOutput, Output, passthrough, block, addContext, replaceOutput, replaceMcpOutput, define, onTool, onMatcher, onAdapter, OnToolConfig
- `kind`: value
- `evidence`: Inspect-the-export on values. `OnToolConfig` Example is unused `type BashHook = Hook.PostToolUse.OnToolConfig<"Bash", never, never>` and lives on the type, not on `onTool`.
- `impact`: `replaceOutput` vs `replaceMcpOutput` is never shown as different fields.
- `suggestedFix`: Call both replace helpers; move a real `onTool({ toolName: "Bash", handler })` Example onto `onTool`; drop the unused type Example or make it teach inference.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-044
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-076: PostToolUseFailure.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostToolUseFailure.ts:26
- `symbol`: Input, HookSpecificOutput, Output, passthrough, addContext, block, define, onMatcher
- `kind`: value
- `evidence`: Inspect-the-export including `onMatcher` titled "Inspect the documented API".
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Call `addContext` / `block`; show `onMatcher` on `tool_name`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-045
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-077: PreCompact.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PreCompact.ts:29
- `symbol`: Trigger, Input, Output, passthrough, block, define, onMatcher, Trigger (type)
- `kind`: value
- `evidence`: Inspect-the-export plus unused `type Example`.
- `impact`: `block` never shown producing `decision: some("block")`.
- `suggestedFix`: Call `block("keep the long context")`; omit unused type Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-046
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-078: PreToolUse.ts vacuous Examples (except define)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PreToolUse.ts:32
- `symbol`: Input, PermissionDecision, HookSpecificOutput, Output, allow, passthrough, deny, ask, defer, allowWithUpdatedInput, onTool, onMatcher, onAdapter, PermissionDecision (type), OnToolConfig
- `kind`: value
- `evidence`: Decision helpers titled "Build `deny` decision with a required explanation" still do `console.log(Hook.PreToolUse.deny)`. `OnToolConfig` / `PermissionDecision` type Examples are unused aliases. **Exempt:** `define` (lines 313–324) actually calls `define` and logs `hook.event // "PreToolUse"` — do not rip that Example out; extend it if needed.
- `impact`: The richest decision API in the pack has no observable `deny("…")` / `defer()` result.
- `suggestedFix`: Call allow/deny/ask/defer/passthrough/allowWithUpdatedInput; put a real `onTool` call on `onTool`; keep `define`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-047
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-079: SessionEnd.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SessionEnd.ts:28
- `symbol`: ExitReason, Input, Output, passthrough, define, onMatcher, ExitReason (type)
- `kind`: value
- `evidence`: Inspect-the-export plus unused `type Example`.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Call `passthrough()`; show `onMatcher` on `"logout"`; omit unused type Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-048
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-080: SessionStart.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SessionStart.ts:37
- `symbol`: Source, Input, HookSpecificOutput, Output, passthrough, addContext, startWithMessage, renameSession, watchPaths, reloadSkills, define, onMatcher, Source (type)
- `kind`: value
- `evidence`: `addContext` has a strong lead and still logs the function. Unused `type Example` for `Source`.
- `impact`: Canonical SessionStart use-case is never shown running.
- `suggestedFix`: Call `addContext("…")` and `startWithMessage`; omit unused type Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-049
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-081: Setup.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Setup.ts:25
- `symbol`: Trigger, Input, HookSpecificOutput, Output, passthrough, addContext, define, onMatcher, Trigger (type)
- `kind`: value
- `evidence`: Inspect-the-export plus unused `type Example`.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Call `addContext`; show `onMatcher` on `"maintenance"`; omit unused type Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-050
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-082: Stop.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Stop.ts:28
- `symbol`: BackgroundTask, SessionCron, Input, HookSpecificOutput, Output, allowStop, block, addContext, define
- `kind`: value
- `evidence`: `block` lead correctly says it forces continuation, then `console.log(Hook.Stop.block)` never calls it.
- `impact`: The inverted `block` semantics are never observed.
- `suggestedFix`: Call `block("continue investigating X")` and show `decision`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-051
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-083: StopFailure.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/StopFailure.ts:26
- `symbol`: ErrorType, Input, Output, passthrough, define, onMatcher, ErrorType (type)
- `kind`: value
- `evidence`: Inspect-the-export plus unused `type Example`.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Decode an Input tagged `rate_limit`; call `passthrough()`; omit unused type Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-052
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-084: SubagentStart.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SubagentStart.ts:26
- `symbol`: Input, HookSpecificOutput, Output, passthrough, addContext, define, onMatcher
- `kind`: value
- `evidence`: Inspect-the-export including `onMatcher`.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Call `addContext`; show `onMatcher` on `agent_type`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-053
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-085: SubagentStop.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SubagentStop.ts:30
- `symbol`: Input, HookSpecificOutput, Output, allowStop, block, addContext, define, onMatcher
- `kind`: value
- `evidence`: Inspect-the-export. `onMatcher` lead mentions `allowStop()` default but still logs the function.
- `impact`: Inverted `block` is never observed (same trap as Stop).
- `suggestedFix`: Call `block` / `allowStop`; show mismatch default if demonstrating `onMatcher`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-054
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-086: TaskCompleted.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/TaskCompleted.ts:25
- `symbol`: Input, Output, allow, block, stopTeammate, define
- `kind`: value
- `evidence`: `console.log(Hook.TaskCompleted.block)` never shows `stderrExit`.
- `impact`: Callers will assume JSON `decision: "block"`.
- `suggestedFix`: Call `block("incomplete")` and show it is `HookProcessOutput`; contrast with `stopTeammate` JSON `continue: false`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-055
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-087: TaskCreated.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/TaskCreated.ts:25
- `symbol`: Input, Output, allow, block, stopTeammate, define
- `kind`: value
- `evidence`: `block` lead already says exit 2 + stderr, then logs the function.
- `impact`: The process-exit protocol is still not observed.
- `suggestedFix`: Call `block` and `allow`; contrast return types.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-056
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-088: TeammateIdle.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/TeammateIdle.ts:25
- `symbol`: Input, Output, allowIdle, keepWorking, stopTeammate, define
- `kind`: value
- `evidence`: `keepWorking` lead already says exit 2, then `console.log(Hook.TeammateIdle.keepWorking)`.
- `impact`: Process-exit vs JSON `stopTeammate` is never shown.
- `suggestedFix`: Call both helpers; contrast return types.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-057
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-089: UserPromptExpansion.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/UserPromptExpansion.ts:24
- `symbol`: ExpansionType, Input, HookSpecificOutput, Output, allow, block, addContext, define, onMatcher, ExpansionType (type)
- `kind`: value
- `evidence`: Inspect-the-export plus unused `type Example`.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Call `block` / `allow` / `addContext`; show `onMatcher` on `command_name`; omit unused type Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-058
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-090: UserPromptSubmit.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/UserPromptSubmit.ts:29
- `symbol`: Input, HookSpecificOutput, Output, allow, block, addContext, renameSession, define
- `kind`: value
- `evidence`: Strong `block` lead ("erased from context") still does `console.log(Hook.UserPromptSubmit.block)`.
- `impact`: `suppressOriginalPrompt` is never shown.
- `suggestedFix`: Call `block("…", { suppressOriginalPrompt: true })`, `addContext`, and `renameSession`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-059
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-091: WorktreeCreate.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/WorktreeCreate.ts:26
- `symbol`: Input, HookSpecificOutput, Output, created, createdHttp, define
- `kind`: value
- `evidence`: `created` / `createdHttp` leads distinguish channels, then log the functions.
- `impact`: Callers never see `rawStdout` vs JSON `worktreePath`.
- `suggestedFix`: Call both with the same path and show the two return shapes.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-060
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-092: WorktreeRemove.ts vacuous Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/WorktreeRemove.ts:22
- `symbol`: Input, Output, passthrough, define
- `kind`: value
- `evidence`: `console.log(Hook.WorktreeRemove.passthrough)` / `.define`.
- `impact`: Placeholder Examples fail the quality bar.
- `suggestedFix`: Call `passthrough()`; show `define` returning `event: "WorktreeRemove"` (same shape as PreToolUse.define).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-061
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-093: index.ts vacuous HookInput Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/index.ts:100
- `symbol`: HookInput
- `kind`: value
- `evidence`: "**Example** (Inspect the union discriminator)" does `console.log(Hook.HookInput.ast._tag) // "Union"`. That peeks at schema AST internals instead of decoding/matching on `hook_event_name`. Type companions correctly have no Example.
- `impact`: The union exists so callers can dispatch; the Example never decodes a payload or narrows `hook_event_name`.
- `suggestedFix`: Decode a realistic tagged input (e.g. `{ hook_event_name: "Stop", … }`) and show the narrowed event name. Do not add Examples to the barrel re-exports.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-031
- `status`: open
- `fixedCommit`: pending

---

## Editorial — missing described `@see`

### claudecode-events-R1-094: Pack-wide zero `@see` tags

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/ConfigChange.ts:118, scratchpad/claudecode/Hook/Events/CwdChanged.ts:88, scratchpad/claudecode/Hook/Events/Elicitation.ts:187, scratchpad/claudecode/Hook/Events/ElicitationResult.ts:186, scratchpad/claudecode/Hook/Events/FileChanged.ts:129, scratchpad/claudecode/Hook/Events/InstructionsLoaded.ts:171, scratchpad/claudecode/Hook/Events/MessageDisplay.ts:107, scratchpad/claudecode/Hook/Events/Notification.ts:136, scratchpad/claudecode/Hook/Events/PermissionDenied.ts:108, scratchpad/claudecode/Hook/Events/PermissionRequest.ts:368, scratchpad/claudecode/Hook/Events/PostCompact.ts:116, scratchpad/claudecode/Hook/Events/PostToolBatch.ts:131, scratchpad/claudecode/Hook/Events/PostToolUse.ts:126, scratchpad/claudecode/Hook/Events/PostToolUseFailure.ts:111, scratchpad/claudecode/Hook/Events/PreCompact.ts:130, scratchpad/claudecode/Hook/Events/PreToolUse.ts:159, scratchpad/claudecode/Hook/Events/SessionEnd.ts:133, scratchpad/claudecode/Hook/Events/SessionStart.ts:168, scratchpad/claudecode/Hook/Events/Setup.ts:141, scratchpad/claudecode/Hook/Events/Stop.ts:178, scratchpad/claudecode/Hook/Events/StopFailure.ts:129, scratchpad/claudecode/Hook/Events/SubagentStart.ts:105, scratchpad/claudecode/Hook/Events/SubagentStop.ts:124, scratchpad/claudecode/Hook/Events/TaskCompleted.ts:80, scratchpad/claudecode/Hook/Events/TaskCreated.ts:81, scratchpad/claudecode/Hook/Events/TeammateIdle.ts:78, scratchpad/claudecode/Hook/Events/UserPromptExpansion.ts:146, scratchpad/claudecode/Hook/Events/UserPromptSubmit.ts:119, scratchpad/claudecode/Hook/Events/WorktreeCreate.ts:104, scratchpad/claudecode/Hook/Events/WorktreeRemove.ts:74, scratchpad/claudecode/Hook/Events/index.ts:153
- `symbol`: allow, block, passthrough, define, onMatcher, created, createdHttp, replaceOutput, replaceMcpOutput, HookInput
- `kind`: value
- `evidence`: `rg @see` under `scratchpad/claudecode/Hook/Events` is empty. Inline `{@link}` exists only on namespace companion leads. Same-name type aliases (`export type ConfigSource`, `export type HookInput`, …) have neither `{@link}` nor `@see`. Constructor families a caller must choose (allow/block/passthrough/define/onMatcher; created vs createdHttp; replaceOutput vs replaceMcpOutput; accept vs retry) have no described `@see`.
- `impact`: Hover docs never send the reader to the sibling they almost picked instead. Annotation patterns require a described `@see` on decoded type companions.
- `suggestedFix`: On each decision helper, add `@see {@link sibling} for <purpose>.` On each same-name type alias, `@see {@link RuntimeSchema} for the runtime schema and decoding behavior.` Namespace `{@link}` leads may stay; do not invent `@see` on barrel re-exports.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Editorial — Gotchas present in file-header comments but missing on the symbols

### claudecode-events-R1-095: ConfigChange.block cannot stop policy_settings

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/ConfigChange.ts:7
- `symbol`: block
- `kind`: value
- `evidence`: File header: "except `policy_settings` changes, which cannot be blocked." `block` lead is "Constructor for `block`." with no **Gotchas**.
- `impact`: A policy-enforcement hook that returns `block("…")` for `source: "policy_settings"` will believe it worked.
- `suggestedFix`: Add a **Gotchas** section on `block` (and mention it on `onMatcher`) that `policy_settings` changes cannot be blocked.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-032
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-096: onMatcher mismatch defaults to allow() not passthrough()

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/ConfigChange.ts:199, scratchpad/claudecode/Hook/Events/UserPromptExpansion.ts:253
- `symbol`: onMatcher
- `kind`: value
- `evidence`: ConfigChange `onMismatch: config.onMismatch ?? (() => Effect.succeed(allow()))`. UserPromptExpansion same with `allow()`. Most other events default to `passthrough()`. Neither `onMatcher` documents the default.
- `impact`: A matcher miss on ConfigChange/UserPromptExpansion **allows** the change/prompt rather than becoming a no-op. Callers copying PreToolUse mental models will get the wrong default.
- `suggestedFix`: **Gotchas** on both `onMatcher`s: omitted `onMismatch` succeeds `allow()`. Described `@see` to `allow`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-097: FileChanged.onMatcher matches basename not path

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/FileChanged.ts:208
- `symbol`: onMatcher
- `kind`: value
- `evidence`: Implementation uses `fileBasename(input.file_path)` then `Matcher.matchFileName`. File header says matcher is on the basename. The `onMatcher` Example does not exercise it; there is no **Gotchas**.
- `impact`: `matcher: "src/foo.ts"` or a full path never matches.
- `suggestedFix`: **Gotchas**: matcher is applied to the basename only (`package.json`, `.envrc`). Example should use a basename pattern.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-067
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-098: Notification cannot block or modify the notification

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Notification.ts:6
- `symbol`: Output, define, passthrough
- `kind`: value
- `evidence`: File header: "The hook cannot block or modify the notification; use common output fields for user-visible side effects." No **Gotchas** on Output/`define`.
- `impact`: Callers will invent a `block` helper that does not exist and cannot work.
- `suggestedFix`: **Gotchas** on Output/`define`: JSON cannot suppress the notification; only `systemMessage` / `terminalSequence` side effects apply.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-039
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-099: SubagentStart cannot block spawn

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SubagentStart.ts:6
- `symbol`: Output, addContext, passthrough
- `kind`: value
- `evidence`: File header: "The subagent cannot be blocked from starting." Helpers are only `passthrough` / `addContext`; no **Gotchas**.
- `impact`: Callers will look for `block` (as on SubagentStop) and may stuff `continue: false` into Output expecting to cancel the agent.
- `suggestedFix`: **Gotchas** on Output/`addContext`: spawn always proceeds; only additional context is honored.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-053
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-100: MessageDisplay.display does not rewrite the transcript

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/MessageDisplay.ts:4
- `symbol`: display
- `kind`: value
- `evidence`: File header: "Display-only: the transcript and Claude's context keep the original text." `display` lead is "Constructor for `display`."
- `impact`: Redaction hooks will think they scrubbed the transcript.
- `suggestedFix`: **Gotchas** on `display`: `displayContent` affects the TUI only; transcript/context keep `delta`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-038
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-101: WorktreeCreate.created vs createdHttp channel split

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/WorktreeCreate.ts:117
- `symbol`: created, createdHttp, define
- `kind`: value
- `evidence`: `created` returns `rawStdout(\`${worktreePath}\\n\`)` (`HookProcessOutput`). `createdHttp` returns JSON `Output` with `hookSpecificOutput.worktreePath`. File header states the split. Neither symbol **Gotchas** nor `@see`s the other. `define` accepts `Output | HookProcessOutput`.
- `impact`: Returning `createdHttp` from a command hook (or `created` from HTTP) will not publish the path.
- `suggestedFix`: **Gotchas** + described `@see` on both constructors; mention the union on `define`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-060
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-102: PostToolUse.replaceOutput lead claims MCP-only

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PostToolUse.ts:182
- `symbol`: replaceOutput, replaceMcpOutput
- `kind`: value
- `evidence`: `replaceOutput` lead: "Replace the MCP tool's response. Only valid for MCP tool invocations." Implementation writes `updatedToolOutput`. Sibling `replaceMcpOutput` writes `updatedMCPToolOutput` and is the actual MCP helper (`Constructor for \`replaceMcpOutput\``).
- `impact`: Callers using `replaceOutput` on MCP tools (or avoiding it for non-MCP tools) will hit the wrong field.
- `suggestedFix`: Lead `replaceOutput` as the non-MCP `updatedToolOutput` helper. Lead `replaceMcpOutput` as MCP-only `updatedMCPToolOutput`. Described `@see` both ways. **Gotchas** if Claude Code ignores the wrong field.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-044
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-103: PreToolUse.defer is headless tool_deferred

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PreToolUse.ts:252
- `symbol`: defer, passthrough
- `kind`: value
- `evidence`: `defer` lead already says headless exits with `stop_reason: "tool_deferred"` and "Use `passthrough()` for a neutral no-op." There is no **Gotchas** and no `@see` to `passthrough`. PermissionDecision lead also says "omit output entirely for a neutral no-op."
- `impact`: Interactive sessions may treat `defer` as deny/ask. The omit-output vs `passthrough()` distinction is split across two symbols.
- `suggestedFix`: **Gotchas** on `defer`: not a no-op; headless-only resume protocol. Described `@see` to `passthrough`. Clarify omit-output vs `passthrough()` on PermissionDecision.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-047
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-104: PreToolUse.onTool / onAdapter fail closed on decode errors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/PreToolUse.ts:384, scratchpad/claudecode/Hook/Events/PostToolUse.ts:308
- `symbol`: onTool, onAdapter
- `kind`: value
- `evidence`: `config.onDecodeError?.(error, input) ?? Effect.fail(error)` and mismatch `?? Effect.succeed(passthrough())`. Leads are "Constructor for `onTool`." / similar. The fail-closed default is only in implementation.
- `impact`: A malformed tool payload fails the hook Effect (and surfaces `HookToolDecodeError`) unless `onDecodeError` is provided. Callers expecting passthrough-on-error will take production failures.
- `suggestedFix`: **Gotchas** on `onTool`/`onAdapter` (PreToolUse and PostToolUse): omitted `onDecodeError` fails; omitted `onMismatch` passthroughs.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-047
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-105: UserPromptSubmit.block erases the prompt

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/UserPromptSubmit.ts:135
- `symbol`: block
- `kind`: value
- `evidence`: Lead already says the prompt is erased and the reason is shown. Implementation also sets optional `suppressOriginalPrompt`. No **Gotchas** for that flag; Example does not call `block`.
- `impact`: `suppressOriginalPrompt` is invisible except in the signature.
- `suggestedFix`: **Gotchas**: `suppressOriginalPrompt` only applies when blocking. Example should pass the option.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-090
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-106: Stop/SubagentStop `block` means continue

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/Stop.ts:194, scratchpad/claudecode/Hook/Events/SubagentStop.ts:141
- `symbol`: block
- `kind`: value
- `evidence`: Stop.block lead correctly says `decision: "block"` forces continuation. SubagentStop.block is "Constructor for `block`." File header: "return `block` to force the subagent to continue."
- `impact`: Name collision with ConfigChange/PreCompact `block` (halt). SubagentStop will be read as "stop the subagent".
- `suggestedFix`: Give SubagentStop.block the same inverted-semantics lead as Stop. **Gotchas** on both: this is not a halt. Described `@see` to `allowStop`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-054
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-107: stderrExit block helpers are process protocol, not JSON

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/TaskCompleted.ts:111, scratchpad/claudecode/Hook/Events/TaskCreated.ts:111, scratchpad/claudecode/Hook/Events/TeammateIdle.ts:108
- `symbol`: block, keepWorking
- `kind`: value
- `evidence`: All three return `stderrExit(reason): HookProcessOutput`. TaskCompleted.block lead is "Constructor for `block`." TaskCreated.block and TeammateIdle.keepWorking already mention exit 2. `define` handlers accept `Output | HookProcessOutput`. File headers mention "exiting 2 with stderr feedback."
- `impact`: Returning JSON `Output.make({ decision: "block" })` (the ConfigChange pattern) will not block these team events.
- `suggestedFix`: **Gotchas** on all three plus their `define`: blocking is exit-2 stderr, not JSON decision. Contrast `stopTeammate` (JSON `continue: false`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-055
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-108: Observability-only events ignore Output (StopFailure also ignores exit code)

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SessionEnd.ts:5, scratchpad/claudecode/Hook/Events/InstructionsLoaded.ts:5, scratchpad/claudecode/Hook/Events/PostCompact.ts:5, scratchpad/claudecode/Hook/Events/WorktreeRemove.ts:4, scratchpad/claudecode/Hook/Events/StopFailure.ts:5, scratchpad/claudecode/Hook/Events/CwdChanged.ts:5, scratchpad/claudecode/Hook/Events/FileChanged.ts:4
- `symbol`: Output, define, passthrough
- `kind`: value
- `evidence`: File headers: SessionEnd/InstructionsLoaded/PostCompact/WorktreeRemove/CwdChanged/FileChanged are observability-only / output not acted on. StopFailure: "the hook's output and exit code are both ignored by Claude Code." Symbol docs still present `passthrough`/`define` as if they decided anything. CwdChanged header also notes `$CLAUDE_ENV_FILE` persistence as the real side channel.
- `impact`: Hooks that return `continue: false` or exit non-zero on StopFailure will think they handled the failure.
- `suggestedFix`: **Gotchas** on each Output/`define`: Claude Code ignores JSON (and for StopFailure, the exit code). Mention `$CLAUDE_ENV_FILE` on CwdChanged. Do not invent empty **When to use** sections.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-109: Wrong `@category` on type companions

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/index.ts:155, scratchpad/claudecode/Hook/Events/PreToolUse.ts:350, scratchpad/claudecode/Hook/Events/PostToolUse.ts:274
- `symbol`: HookInput (type), OnToolConfig
- `kind`: type
- `evidence`: `export type HookInput` is `@category utilities`. `OnToolConfig` on PreToolUse and PostToolUse is `@category constructors`. Canonical roles: same-name decoded companions and config interfaces are `type-level`.
- `impact`: Category indexes dump types into constructor/utility buckets.
- `suggestedFix`: `@category type-level` on all three. Move constructor Examples off `OnToolConfig` onto `onTool`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-062
- `status`: open
- `fixedCommit`: pending

### claudecode-events-R1-110: SessionStart Input does not carry permission_mode

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Events/SessionStart.ts:5
- `symbol`: Input
- `kind`: value
- `evidence`: File header: "Does not carry `permission_mode`." Input schema has envelope + `source` + session fields only. Input lead is "Schema for `Input`."
- `impact`: Callers coming from other envelope events will read `input.permission_mode` and fail typechecking, or worse, widen through `envelopeFields` assumptions.
- `suggestedFix`: **Gotchas** on Input: this event omits `permission_mode`. Example should type a decoded Input and show `source`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-events
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-events-R1-049
- `status`: open
- `fixedCommit`: pending

---

## Rejected false positives (do not open)

Census listed 116 open owning exports. All 116 are rejected.

1. **86 `export declare namespace` companions** (`Input` / `Output` / `HookSpecificOutput` / event-specific class namespaces) flagged `missing=@example` / `missing-required-tags`. Law: namespaces are pure type-level; Example is optional. Each already has a useful lead, `@category type-level`, and `@since 0.0.0`. Inner `Type` / `Encoded` aliases are documented. Do not add placeholder Examples.

2. **30 `index.ts` barrel re-exports** (`export { ConfigChange, CwdChanged, … }`, lines 58–89) flagged `missing=@category|@since|@example` and `missing-summary`. Brief: re-export declarations are graph edges, not documentation subjects. A single block comment already covers the export list. Do not invent per-name Examples on the barrel.

No other census mechanicals were present on owning value/type exports: `@category` / `@since` / titled Example carriers already exist on the runtime schemas and constructors (the Examples are just vacuous — editorial, not "missing").

---

## Pack verdict

- files reviewed: 31
- owning exports reviewed: 379
- confirmed mechanical items: 31
- editorial items: 79
- rejected false positives: 116
- accepted findings: 110
