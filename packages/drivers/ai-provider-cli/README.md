# @beep/ai-provider-cli

Driver-level CLI capability checks and scoped, owned native sessions for Codex,
Grok Build, Claude Code, and Cursor.

`AiProviderCliSession.open` launches a managed process within the caller's Effect
scope. The caller supplies the executable, replacement environment, distinct
workspace and private profile root, existing subscription route, and scoped MCP
server declarations. Explicit API credentials and alternate paid endpoint
selectors are rejected. Configuration files are created exclusively; an existing
managed configuration is a typed profile error.

The returned session serializes queued prompts, collects bounded response text,
and exposes terminal results separately from best-effort progress events. Codex
supports steering fenced to the observed active turn ID. Other steering routes
return a typed unsupported error. Cancellation dispatch does not establish a
terminal cancellation result. An ambiguous turn deadline closes the owned
process and fences later prompts.

Codex verifies its model, effort, and read-only policy before inference and again
when resuming a completed persistent turn. Claude uses restricted mode, empty
inherited setting sources, strict explicit MCP configuration, and an exact MCP
tool allowlist. Explicit settings exclude inherited instruction files and disable
auto memory; managed administrator instructions remain applicable. Safe mode is
unsuitable for this route because it also disables explicitly configured MCP
servers. Bare mode is unsuitable because it excludes the subscription OAuth
authentication route. Claude verifies the first system initialization event
before accepting a response. Instruction exclusions follow the documented
[memory settings](https://code.claude.com/docs/en/memory#exclude-specific-claude-md-files).
Grok uses a private named sandbox extending read-only, explicit mediator tools,
and scoped MCP allow-once permissions. Its declared writable paths must be
canonical private directories strictly beneath the profile parent's owned
directory. Cursor negotiates ACP identity and ask mode; an access denial is
classified independently of a provider's successful end-turn marker. These are
owned process sessions; they do not attach to arbitrary existing desktop chats.

## Installation

```bash
bun add @beep/ai-provider-cli
```

## Usage

```ts
import { VERSION } from "@beep/ai-provider-cli"
```

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/ai-provider-cli` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
