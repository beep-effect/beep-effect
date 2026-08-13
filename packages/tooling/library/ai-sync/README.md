# @beep/ai-sync

Schema-first AI agent configuration schemas, source metadata, drift checks,
and validated transforms.

## Surface

- Effect Schema models for AI agent config cells, support status, source
  metadata, drift reports, and typed `AiSyncError` failures.
- Native V1 schema coverage for Claude Code, Codex, Grok Build, JetBrains AI
  Assistant, and Junie across skills, rules, commands, hooks, plugins, and MCP
  servers.
- Explicit `na` and `unknown_schema` cells for unsupported or undocumented
  surfaces.
- Tier-1 generated artifacts under `src/_generated`, including committed
  source hashes for strict drift checks.
- Cross-agent transforms only where semantics are documented, with
  lossy/lossless evidence in `V1_TRANSFORM_EVIDENCE`.
- Native repo-config validation plus safety-policy checks for both
  `.codex/config.toml` and `.claude/settings.json` during package and root
  checks.

## Usage

```ts
import { validateCurrentCheckoutDogfoodConfigs, V1_SCHEMA_COVERAGE } from "@beep/ai-sync"

console.log(V1_SCHEMA_COVERAGE.length)
console.log(validateCurrentCheckoutDogfoodConfigs)
```

```ts
import { CodexConfig, codexMcpServersToClaudeMcpJson } from "@beep/ai-sync"

const config = CodexConfig.make({
  mcp_servers: {
    local: { command: "node", args: ["server.js"] },
  },
})

console.log(codexMcpServersToClaudeMcpJson(config).mcpServers.local?.command)
```

## Development

```bash
bun run generate
bun run check
bun run test
bun run drift --strict
bun run validate -- --repo-root ../../../.. --config .codex/config.toml
```

`check` stays offline and validates the committed generated artifact set plus
the current checkout's Codex and Claude configs through their native schemas
and repository safety policies. Codex is pinned to `on-request` approvals with
`workspace-write` sandboxing. Claude requires an explicit `default` permission
mode, and every Bash allow entry must belong to the exact 47-value
repository grant domain. That domain retains named read-only GitHub queries and
the intentional Git and Yeet publication commands; it does not grant broad
`gh`, shell-wrapper, or Codex execution families. `validate` checks one requested
config through its native schema. `drift --strict` may fetch upstream Tier-1
sources and compare committed content hashes. `generate` and `refresh` fetch
pinned Tier-1 sources and rewrite generated artifacts.

## License

MIT
