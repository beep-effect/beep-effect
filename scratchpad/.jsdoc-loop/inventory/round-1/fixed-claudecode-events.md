# Round 1 fixer report — claudecode-events

Owned surface: `scratchpad/claudecode/Hook/Events/**` only.

## Census target

`claudecode-events` **open modules → 0** (31 `@packageDocumentation` headers).

Open owning exports remain the **116 rejected false positives** from the review (86 `export declare namespace` companions + 30 `index.ts` barrel `export { … }` graph edges). No Examples were added to those.

## Changed files (31)

- `scratchpad/claudecode/Hook/Events/ConfigChange.ts`
- `scratchpad/claudecode/Hook/Events/CwdChanged.ts`
- `scratchpad/claudecode/Hook/Events/Elicitation.ts`
- `scratchpad/claudecode/Hook/Events/ElicitationResult.ts`
- `scratchpad/claudecode/Hook/Events/FileChanged.ts`
- `scratchpad/claudecode/Hook/Events/InstructionsLoaded.ts`
- `scratchpad/claudecode/Hook/Events/MessageDisplay.ts`
- `scratchpad/claudecode/Hook/Events/Notification.ts`
- `scratchpad/claudecode/Hook/Events/PermissionDenied.ts`
- `scratchpad/claudecode/Hook/Events/PermissionRequest.ts`
- `scratchpad/claudecode/Hook/Events/PostCompact.ts`
- `scratchpad/claudecode/Hook/Events/PostToolBatch.ts`
- `scratchpad/claudecode/Hook/Events/PostToolUse.ts`
- `scratchpad/claudecode/Hook/Events/PostToolUseFailure.ts`
- `scratchpad/claudecode/Hook/Events/PreCompact.ts`
- `scratchpad/claudecode/Hook/Events/PreToolUse.ts`
- `scratchpad/claudecode/Hook/Events/SessionEnd.ts`
- `scratchpad/claudecode/Hook/Events/SessionStart.ts`
- `scratchpad/claudecode/Hook/Events/Setup.ts`
- `scratchpad/claudecode/Hook/Events/Stop.ts`
- `scratchpad/claudecode/Hook/Events/StopFailure.ts`
- `scratchpad/claudecode/Hook/Events/SubagentStart.ts`
- `scratchpad/claudecode/Hook/Events/SubagentStop.ts`
- `scratchpad/claudecode/Hook/Events/TaskCompleted.ts`
- `scratchpad/claudecode/Hook/Events/TaskCreated.ts`
- `scratchpad/claudecode/Hook/Events/TeammateIdle.ts`
- `scratchpad/claudecode/Hook/Events/UserPromptExpansion.ts`
- `scratchpad/claudecode/Hook/Events/UserPromptSubmit.ts`
- `scratchpad/claudecode/Hook/Events/WorktreeCreate.ts`
- `scratchpad/claudecode/Hook/Events/WorktreeRemove.ts`
- `scratchpad/claudecode/Hook/Events/index.ts`

Runtime code was not changed: only JSDoc (and `$I.annote` / `$I.annoteSchema` already present).

## Items closed

### Mechanical — `@packageDocumentation` (R1-001 … R1-031)

Every exporting event module now has a purpose-first lead, `@packageDocumentation`, and `@since 0.0.0`. Never `@module`.

### Editorial — signature-echo leads (R1-032 … R1-062)

Replaced `Schema for \`X\``, `Constructor for \`X\``, `Type-level model for \`X\``, and `X hook event.` with purpose-first leads. Same-name decoded companions now use “Decoded value produced by {@link …}.” `OnToolConfig` and `HookInput` (type) are `@category type-level`.

### Editorial — vacuous Examples (R1-063 … R1-093)

Replaced `console.log(Hook.Event.symbol)` placeholders with observable calls of **that** symbol. `PreToolUse.define` kept its `define({ handler })` + `hook.event` quality bar and was copied to every `define`. Type-level leftover `type Example = …` aliases were dropped. Barrel re-exports were not given Examples.

### Editorial — described `@see` (R1-094)

Decision helpers, related constructors (`created`/`createdHttp`, `replaceOutput`/`replaceMcpOutput`, `allow`/`block`/`passthrough`, `accept`/`retry`, `keepWorking`/`stopTeammate`), and same-name type aliases now have described `@see` purpose phrases. No bare `@see`.

### Editorial — Gotchas lifted onto constructors (R1-095 … R1-110)

| ID | Symbol | Gotcha now on the constructor/schema |
| --- | --- | --- |
| R1-095 | `ConfigChange.block` / `onMatcher` | `policy_settings` cannot be blocked |
| R1-096 | `ConfigChange.onMatcher`, `UserPromptExpansion.onMatcher` | omitted `onMismatch` succeeds `allow()` |
| R1-097 | `FileChanged.onMatcher` | matcher is basename-only; example uses `package.json` |
| R1-098 | `Notification.Output` / `define` / `passthrough` | cannot block or rewrite the notification |
| R1-099 | `SubagentStart.Output` / `addContext` / `passthrough` | spawn cannot be blocked |
| R1-100 | `MessageDisplay.display` | TUI only; transcript keeps `delta` |
| R1-101 | `WorktreeCreate.created` / `createdHttp` / `define` | stdout vs JSON channel split |
| R1-102 | `PostToolUse.replaceOutput` / `replaceMcpOutput` | `updatedToolOutput` vs `updatedMCPToolOutput` |
| R1-103 | `PreToolUse.defer` | headless `tool_deferred`; not a no-op |
| R1-104 | `PreToolUse`/`PostToolUse` `onTool`/`onAdapter` | fail-closed on decode; passthrough on mismatch |
| R1-105 | `UserPromptSubmit.block` | `suppressOriginalPrompt` only applies when blocking |
| R1-106 | `Stop.block` / `SubagentStop.block` | inverted: `block` means continue |
| R1-107 | `TaskCompleted.block`, `TaskCreated.block`, `TeammateIdle.keepWorking` | exit-2 stderr, not JSON `decision` |
| R1-108 | observability-only `Output`/`define` | JSON ignored; StopFailure also ignores exit code |
| R1-109 | `HookInput` type, `OnToolConfig` | `@category type-level` |
| R1-110 | `SessionStart.Input` | does not carry `permission_mode` |

## Residual risk

- Census will still list **116 open owning exports** (rejected FPs). Do not document those.
- Examples compile through docgen TypeScript (`import { Hook } from "effect-claudecode"`). Nested `Option` fields are read with `O.getOrUndefined` / `O.flatMap`.
- `S.decodeUnknownSync(Hook.HookInput)` in `index.ts` depends on `S.toTaggedUnion` still decoding as a union (it does in Effect v4).

## Commands run / to confirm

This fixer surface had no shell tool. Confirm with:

```sh
bun scratchpad/.jsdoc-loop/census.ts
# expected pack row: claudecode-events open modules = 0

bun run beep docgen local --package scratchpad
# or the focused kit:
bun run --cwd scratchpad docgen:claudecode

bun run --cwd scratchpad claudecode:check
```

No symbols were left undocumentable.
