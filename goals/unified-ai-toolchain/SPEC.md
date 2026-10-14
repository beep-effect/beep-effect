# Unified AI Toolchain Specification

## Status

**V1 COMPLETE. V2 ACTIVE. V3 PLANNED.**

## Owner

@beep-team

## Created / Updated

- **Created:** 2026-05-22
- **Updated:** 2026-06-07

## Purpose

The repo needs a durable schema, operation, and sync layer for AI coding agent
configuration.

The toolchain must answer:

- is this agent config valid for the agent that will read it?
- can this config shape be transformed into another agent's native shape
  without losing meaning?
- which upstream source of truth backs each field?
- has an upstream schema or documentation surface drifted since the package was
  generated?
- can beep-effect validate its own agent-facing configuration during normal
  checks?
- can operators safely refresh drift metadata and review the resulting PR?
- can a canonical config source emit native files without overwriting
  hand-authored agent config blindly?

The schema package is
`packages/tooling/library/ai-sync`, published as
`@beep/ai-sync`.

The V2 operator surface lives in the existing root repo CLI,
`packages/tooling/tool/cli`, as `beep ai-sync <command>`.

The V3 canonical source file is `.ai-sync/project.jsonc`.

## Scope

### V1 Scope

V1 is complete and remains the schema truth layer:

- Claude Code, Codex, Grok Build, JetBrains AI Assistant, and Junie
- Skills, Rules, Commands, Hooks, Plugins, and MCP server configuration domains
  where each agent supports them
- explicit N/A and `unknown_schema` metadata for unsupported or undocumented
  cells
- generated Effect Schemas from Tier-1 JSON Schema sources
- hand-authored Effect Schemas for Tier-2 documentation-backed domains
- Tier-3 adapter-code and Tier-4 introspection metadata for fallback sources
- bidirectional transforms where semantics are proven and documented
- drift detection against pinned upstream sources
- validation of beep-effect's `.codex/config.toml` during `bun run check`

### V2 Scope

V2 makes the schema layer safe to operate:

- root `beep ai-sync` command group in `@beep/repo-cli`
- offline audit/check of every registered repo agent config file:
  `.codex/config.toml`, `.mcp.json`, `.claude/settings.json`, `AGENTS.md`, and
  `CLAUDE.md`
- schema-first JSON reports plus human-readable summaries for validation,
  drift, and compatibility evidence
- strict drift reporting that exposes affected source ids and hashes
- scheduled weekly plus manual-dispatch drift refresh workflow that opens or
  updates an automation PR only when generated artifacts change
- rulesync schema-backed config/MCP import and audit evidence
- ruler mapping research only, without a V2 parser promise

### V3 Scope

V3 makes sync and native file emission production-ready:

- schema-first canonical per-domain models for instructions/rules, skills,
  commands, hooks, plugins, MCP servers, and config/profile data
- committed canonical source file at `.ai-sync/project.jsonc`
- import of current native repo files into canonical models
- dry-run emission plans with file diffs, validation results, and loss reports
- explicit apply workflow that writes only selected native paths after
  validation
- native emitters for the current five-agent matrix before expansion
- V3b research-gated additional-agent batch after the core emitters are green

## Out Of Scope

Out of scope for all versions unless this spec is revised:

- runtime control of agents, agent sessions, MCP servers, or IDEs
- secret resolution or secret value printing
- plugin installation, marketplace publishing, or managed enterprise policy
  rollout
- modeling undocumented native shapes from guesswork
- making Yeet the Auto-PR dependency while Yeet remains proof-mode

Out of scope for V2:

- writing native agent files
- committing `.ai-sync/project.jsonc` as a required source
- parsing ruler config as a supported input format
- adding additional agents

Out of scope for V3a:

- additional-agent expansion before current-matrix emitters are production-ready

## Architectural Boundaries

`@beep/ai-sync` is a non-slice tooling library. It lives at
`packages/tooling/library/ai-sync` and declares
`beep.family = "tooling"` and `beep.kind = "library"`.

Operator workflows live in `@beep/repo-cli`, the existing
`packages/tooling/tool/cli` package. Do not create a separate
`packages/tooling/tool/agent-configs` package for V2.

This placement follows `standards/architecture/07-non-slice-families.md`:
repo operations, generators, policy support, and automation route to
`tooling`; reusable support code routes to `tooling/library`; CLIs and
orchestrators route to `tooling/tool`.

The package may depend on foundation modeling helpers such as `@beep/schema`,
identity helpers, repo utility packages, `effect`, and codegen dependencies. It
must not own product semantics, app runtime composition, server adapters, slice
ports, or shared-kernel language.

The V2 Auto-PR workflow follows the existing scheduled PR precedent in
`.github/workflows/data-sync.yml`. It must not use Yeet publish while Yeet is
documented as proof-mode in `AGENTS.md`.

## Canonical Decisions

- Package home: `packages/tooling/library/ai-sync`.
- Operator home: `packages/tooling/tool/cli` as `beep ai-sync`.
- Published library name: `@beep/ai-sync`.
- Family and kind: `tooling` / `library` for the library, `tooling` / `tool`
  for operator commands.
- V1 means schema agreement and validated semantic transforms.
- V2 means safe operation, reporting, broad dogfooding, and drift Auto-PR.
- V3 means canonical source plus controlled native emission.
- V3 canonical file path: `.ai-sync/project.jsonc`.
- V3 canonical model style: per-domain schema-first models, not one mega-file
  model and not pairwise transform sprawl.
- V3 write posture: plan by default, explicit apply only.
- V2 interop posture: parse rulesync schema-backed config/MCP surfaces; keep
  ruler as research/mapping evidence.
- Additional-agent posture: V3b research-gated expansion after core emitters.
- Unknown posture: keep `unknown_schema` cells explicit until upstream docs,
  official schemas, or allowed introspection evidence exists.

## Data Products

### V1 Data Products

- Native schema package
- source metadata
- drift report
- transform evidence ledger
- repo dogfooding validation result

### V2 Data Products

- `AiSyncAuditReport`
- `AiSyncValidationReport`
- `AiSyncDriftRefreshReport`
- `AiSyncCompatibilityReport`
- CI step summary and PR body content derived from the same report data

Reports must be modeled as Effect Schemas before becoming CLI or workflow
output. Human summaries must be renderings of decoded report values, not a
parallel untyped output path.

### V3 Data Products

- `.ai-sync/project.jsonc`
- canonical per-domain config models
- native emission plan
- native emission apply result
- lossy/lossless provenance report
- V3b source-refresh and candidate-selection report

## Privacy Contract

Agent configuration can include private local paths, tokens by environment
variable name, MCP headers, marketplace URLs, internal plugin names, command
arguments, and repository-specific instructions. The toolchain must treat
validated config files as sensitive inputs.

Validation and report output may include file paths relative to the repo,
schema paths, field names, typed error tags, source ids, hashes, and bounded
excerpts of invalid scalar values only when those values are not recognized as
secret-shaped. It must not print secret values, raw header values, bearer
tokens, private home paths, or full instruction documents in CI output.

The default validation posture is local, read-only, and offline. Network drift
checks are separate strict CI or scheduled workflows and must not upload local
configuration contents to upstream services.

Native emission must never write files silently. V3 apply commands require an
emission plan, selected target paths, successful validation, and a loss report.

## Deployment Contract

V1 deploys as a repo package and check integration.

V2 deploys as repo CLI commands and a scheduled GitHub Actions workflow. The
workflow must:

- run weekly and via `workflow_dispatch`
- refresh generated AI-sync artifacts
- run focused `@beep/ai-sync` check/test
- run root `bun run check`
- run `git diff --check`
- create or update an automation PR only when a diff exists

V3 deploys as library APIs plus root CLI plan/apply commands. Apply commands
must support temp-directory tests so native emission can be proven without
mutating the real checkout.

## Completion Criteria

### V1 Completion

V1 is already complete when:

- `@beep/ai-sync` exists with correct tooling library metadata
- codegen from Tier-1 sources follows the `@beep/acp` pattern
- every domain by agent cell is supported, N/A, or `unknown_schema`
- transforms exist only where semantic mapping is proven and are tested for
  round-trip behavior
- drift detection has local, strict, and refresh modes
- this repo validates at least one real config file during `bun run check`
- closeout evidence records a deliberate invalid config failing with a typed
  Effect Schema error

### V2 Completion

V2 is complete only when:

- `beep ai-sync audit`, `check`, `drift`, and `refresh-pr` exist
- `check` validates all registered repo agent config files
- `audit --json` emits a schema-decoded report
- `drift --strict --json` reports affected source ids and expected/actual
  hashes
- rulesync config/MCP import/audit evidence is tested
- ruler mapping evidence is documented without claiming parser support
- the scheduled refresh workflow opens/updates PRs only on real diffs
- the current known drift sources can be refreshed through the V2 lane
- package and root verification commands pass

### V3 Completion

V3 is complete only when:

- `.ai-sync/project.jsonc` decodes through schema-first canonical models
- current native repo files can import into canonical per-domain models
- dry-run plans show target paths, diffs, validation, and loss reports
- explicit apply writes selected native files in temp-directory tests
- emitted files validate through native schemas
- unsupported and `unknown_schema` cells decline emission with typed errors
- current-matrix emitters are production-ready before V3b expansion starts
- V3b source refresh selects a bounded additional-agent batch using current
  evidence, not stale packet assumptions
