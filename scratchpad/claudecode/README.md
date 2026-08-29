# Claude Code Effect harness

This directory contains an Effect-first, schema-first Claude Code harness. It
covers Claude Code hooks, frontmatter, settings, MCP configuration, plugin
construction and loading, project services, runtime layers, and deterministic
test helpers.

The implementation remains private scratchpad code while its public surface is
proven in-repository. Its behavioral baseline is the upstream
`effect-claudecode` project pinned in [UPSTREAM.md](./UPSTREAM.md), with
deprecated Claude Code contracts intentionally omitted. The corresponding
current-surface regression suites live in `scratchpad/test/claudecode`.

## Entrypoints

- `index.ts` — complete public surface
- `Hook.ts` — hook schemas, handlers, runners, dispatch, and testing utilities
- `Plugin.ts` — plugin schemas, validation, materialization, and loading
- `Settings.ts` — settings schemas and layered loading
- `Mcp.ts` — MCP configuration schemas and JSON-file support
- `Frontmatter.ts` — command, skill, subagent, and output-style frontmatter
- `ClaudeProject.ts` / `ClaudeRuntime.ts` — project services and runtime presets
- `Testing.ts` — fixtures, mock layers, and behavioral assertions

## Focused checks

Run these commands from the repository root:

```sh
bun run --cwd scratchpad claudecode:typecheck
bun run --cwd scratchpad claudecode:test
bun run --cwd scratchpad claudecode:lint
bun run --cwd scratchpad claudecode:check
bun run beep docgen local --package scratchpad
```

The focused lane intentionally includes only this source tree and
`scratchpad/test/claudecode`. Type checking uses `tsgo`, including the Effect
diagnostic plugin configured by the workspace.

## Licensing

This migration contains code derived from Marc Suesser's
`effect-claudecode`, licensed under the MIT License. The complete upstream
notice is retained in [LICENSE.upstream](./LICENSE.upstream). See
[UPSTREAM.md](./UPSTREAM.md) for the pinned source revision and adaptation
record.
