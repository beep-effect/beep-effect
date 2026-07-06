# @beep/ai-sync Agent Guide

Schema-first AI agent configuration schemas, source metadata, drift checks,
and validated transforms for repo-facing AI coding agent configuration. A
tooling library — not a CLI package, file fanout tool, or agent runtime
controller.

| Surface | Key exports | Notes |
| --- | --- | --- |
| schemas | `CodexConfig`, `ClaudeMcpJson`, `ClaudeSettings`, `AgentSkillFrontmatter`, `AgentInstructionDocument` | native and shared V1 config schemas |
| metadata | `TIER_ONE_SOURCES`, `V1_SCHEMA_COVERAGE`, `GENERATED_TIER_ONE_SOURCE_METADATA` | source pins, support matrix, committed Tier-1 hashes |
| drift | `checkGeneratedArtifacts`, `checkStrictDrift`, `checkSourceDriftWithFetcher` | local offline and strict network drift checks |
| transforms | `codexMcpServersToClaudeMcpJson`, `claudeMcpJsonToCodexConfig`, `claudeMcpJsonToJunieMcpJson`, `junieMcpJsonToClaudeMcpJson`, `normalizeInstructionDocument`, `normalizeAgentSkillFrontmatter` | only supported where V1 evidence says semantics are real |
| validation | `validateRepoConfig`, `validateDogfoodConfig`, `validateCurrentCheckoutDogfood` | repo-local config validation with typed `AiSyncError` failures |

## Laws
- Keep unsupported and undocumented cells explicit as `na` or
  `unknown_schema`; do not model closed-source native shapes by guesswork.
- Keep package-local `check` offline. Use `drift --strict` for network checks.

## Commands
- `bun run --cwd packages/tooling/library/ai-sync generate`
- `bun run --cwd packages/tooling/library/ai-sync drift --strict`
