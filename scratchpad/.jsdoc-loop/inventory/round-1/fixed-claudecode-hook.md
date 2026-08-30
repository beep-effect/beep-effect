# Round 1 fix report — claudecode-hook

JSDoc upgrades under `scratchpad/claudecode/Hook/**` except `Hook/Events/**`.
One barrel edit on `scratchpad/claudecode/Hook.ts` so titled Examples can
construct `processOutput` / `matchValue` / `matchFileName` through
`effect-claudecode` (`import { Hook } from "effect-claudecode"`). Function
bodies are unchanged.

## Changed files

- `scratchpad/claudecode/Hook.ts` — re-export `processOutput`, `rawStdout`,
  `stderrExit`, `handleMatcher`, `matchFileName`, `matchValue`, `testValue`
  (needed so Examples call the owning symbols via the public `Hook` namespace)
- `scratchpad/claudecode/Hook/Bus.ts`
- `scratchpad/claudecode/Hook/Context.ts`
- `scratchpad/claudecode/Hook/Envelope.ts`
- `scratchpad/claudecode/Hook/Matcher.ts`
- `scratchpad/claudecode/Hook/Runner.ts`
- `scratchpad/claudecode/Hook/Tool.ts`
- `scratchpad/claudecode/Hook/Transcript.ts`

Unchanged on purpose: `Hook/Events/**` (owned by another fixer); barrel
fileoverview on `Hook.ts` (0-owning hub; census skips module findings).

## Items closed

| ID | Status | Fix |
| --- | --- | --- |
| R1-001 | closed | `Bus.ts` fileoverview: `@packageDocumentation` before `@since 0.0.0`. |
| R1-002 | closed | `Context.ts` fileoverview: `@packageDocumentation` before `@since 0.0.0`. |
| R1-003 | closed | `Envelope.ts` fileoverview: `@packageDocumentation` before `@since 0.0.0`. |
| R1-004 | closed | `Matcher.ts` fileoverview: `@packageDocumentation` before `@since 0.0.0`. |
| R1-005 | closed | `Runner.ts` fileoverview: `@packageDocumentation` before `@since 0.0.0`. |
| R1-006 | closed | `Tool.ts` fileoverview: `@packageDocumentation` before `@since 0.0.0`. |
| R1-007 | closed | `Transcript.ts` fileoverview: `@packageDocumentation` before `@since 0.0.0`. |
| R1-008 | closed | Replaced `console.log(Hook.Tool.X)` placeholders with `.make` / `decodeUnknownSync` / `definePreAdapter`/`definePostAdapter` / `decodePreToolUseWith`/`decodePostToolUseWith` (adapter `toolName` plus a decoded field). |
| R1-009 | closed | **Gotchas** on untyped post adapters (`Write`, `Edit`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `AskUserQuestion`): `tool_response` is `unknown`. `@see` `decodePostToolUse` and `BashAdapter`. |
| R1-010 | closed | Same-name aliases: decoded-value leads + described `@see`. `Decoded*` → matching `decode*` pair. Adapter interfaces → `definePreAdapter`/`definePostAdapter`. Replaced tautological namespace `IsWireObject` Examples with `.make` + `S.encodeSync` round-trips (census treats `declare namespace` bodies as value exports). |
| R1-011 | closed | `matchValue` / `testValue` / `matchFileName` Examples now call those symbols. `matchFileName` shows literal `|` basenames and a regex-looking string that does not compile as regex. Left `matchTool` / `testTool` / `handleMatcher` Examples as-is. |
| R1-012 | closed | Described `@see` between `matchTool`/`matchValue`/`testTool`/`testValue` and `matchFileName`. Gotcha that settings.json already filters before spawn. `testTool` lead no longer says "regex". |
| R1-013 | closed | `processOutput` / `stderrExit` / `rawStdout` leads and Examples construct those helpers and log `exitCode` plus `Option` stream presence. Cross-`@see` among the three. `HookProcessOutput` Example uses `processOutput`. |
| R1-014 | closed | `runHookProgram`/`runDispatchProgram` log `hook.event` / registered keys and `typeof program` without running. `runMain`/`dispatch` no longer invoke process takeover; `@see` the testable program + `hookTeardown`. Unknown-event Gotcha on `dispatch`. |
| R1-015 | closed | `readTranscript` Gotchas (blank lines dropped, JSONL decode, `TranscriptReadError`). Example maps `events.length` without touching the filesystem. `@see` `TranscriptReadError`. |
| R1-016 | closed | Dropped unused `Interface` Example. `Service`/`layer` provide `Hook.Bus.layer` and publish a `SessionStart` event. Left `bus`/`publish` Examples as-is. |
| R1-017 | closed | `publish` `@category events`. Described `@see` among `publish`, `bus`, `layer`, and `Interface.stream`. |
| R1-018 | closed | Accessor leads describe session correlation, transcript path, cwd, optional `Option` fields. `transcriptPath` `@see` `readTranscript`. Accessors `@see` `fromEnvelope`. Existing `runPromise` Examples kept. |
| R1-019 | closed | Dropped unused `Interface` Example. `Service`/`layer` provide `Hook.Context.layer(Testing.makeMockEnvelope())` and log `sessionId`. |
| R1-020 | closed | `EffortLevel` / `HookPermissionMode` type aliases: decoded-value leads, described `@see`, dropped unused `type Example`. |
| R1-021 | closed | `HookPermissionMode` / `HookEffort` value leads describe envelope role. Kept existing decode/`.make` Examples. `@see` `envelopeFields` / `HookEnvelope`. |

## Residual risk

- `Hook.ts` barrel still has lead + `@since` without `@packageDocumentation`.
  Census only emits module findings when `owningExportCount > 0`; inventory
  rejected opening it.
- Barrel re-exports of matcher/runner constructors are a public-namespace
  expansion so Examples compile. Runtime of the functions is unchanged.
- `{@link readTranscript}` from `Context.ts` is a cross-file name; census
  undescribed-see stays closed because the purpose phrase is present.
- `declare namespace` companions keep titled Examples because census classifies
  a namespace *with a body* as a value export. The new fences encode a `.make`
  value instead of the old unused `IsWireObject` binding.
- Example TypeScript / owning-package `claudecode:check` were not executed in
  this fixer process (no shell tool). Parent should run the commands below
  before treating the pack as merge-ready.

## Commands run

- Static re-application of `scratchpad/.jsdoc-loop/census.ts` rules against the
  owned surface: every exporting module with owning symbols now has
  `@packageDocumentation`; no leftover `console.log(Hook.Tool.Symbol)`
  placeholders; no `@example` / `@remarks` / `@module` / `@template`.
- Not run here (no shell): `/home/elpresidank/.local/share/mise/installs/bun/latest/bin/bun scratchpad/.jsdoc-loop/census.ts`
- Not run here (no shell): `zsh -ic 'bun run docgen:local'`
- Not run here (no shell): `zsh -ic 'bun run --cwd scratchpad claudecode:check'`

Expected census after the first command: pack `claudecode-hook`
`openModuleCount: 0`, `openOwningExportCount: 0`.

## Symbols not documented

None of the accepted findings were blocked by unclear runtime behavior.
