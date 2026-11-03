# @beep/ai-provider-cli

Driver-level CLI capability checks for Codex, Grok Build, Claude Code, and
Cursor, plus the home-layout isolation rules a managed launch needs.

`AiProviderCli` probes a locally installed provider CLI for its authentication
state without returning raw account or token output. `AiProviderCliHome`
resolves and validates per-provider home directories so an owned process can
run with a private configuration root instead of the shared user home.

The owned native-session half of this package (`AiProviderCliSession.*`) was
removed on 2026-11-02 with the `beep agent-message` stack: cross-session and
cross-provider messaging now runs through T3 Code's MCP tools (see the
`orchestrate` skill). The probe and home services are unchanged.

## Installation

```bash
bun add @beep/ai-provider-cli
```

## Usage

```ts
import { AiProviderCli } from "@beep/ai-provider-cli"
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
