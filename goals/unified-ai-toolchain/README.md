# Unified AI Toolchain

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

V1 complete; V2 in progress at park time; V3 planned.

## Overview

This initiative owns the schema and sync layer for repo-facing AI coding agent
configuration. V1 shipped the schema truth layer in `@beep/ai-sync`: native
schemas, source metadata, drift checks, and proven transforms for Claude Code,
Codex, Grok Build, JetBrains AI Assistant, and Junie.

V2 turns that library into an operator-ready toolchain. It adds a root
`beep ai-sync` command group, broadens repo dogfooding to every registered
agent config file, emits schema-first reports, and creates a scheduled drift
refresh PR workflow.

V3 turns schema agreement into controlled sync. It introduces canonical
per-domain config models, a committed `.ai-sync/project.jsonc` source file,
dry-run emission plans, explicit apply workflows, and native file generation
for the current agent matrix before any additional-agent expansion.

## Read This First

- [GOAL.md](./GOAL.md) - compact `/goal` launcher
- [SPEC.md](./SPEC.md) - authoritative contract
- [PLAN.md](./PLAN.md) - phased execution plan and progress
- [ops/manifest.json](./ops/manifest.json) - machine-readable routing, phases,
  checks, and launcher metadata
- [history/outputs/v2-v3-bootstrap.md](./history/outputs/v2-v3-bootstrap.md)
  - decisions that reopened this V1-complete packet for V2/V3 execution
- [history/outputs/p0-current-state.md](./history/outputs/p0-current-state.md)
  - current repo state, upstream source tiers, and open gaps
- [research/sources-of-truth.md](./research/sources-of-truth.md) - per-agent
  source map with pins and drift mechanisms
- [research/codegen-and-drift-architecture.md](./research/codegen-and-drift-architecture.md)
  - codegen and drift-check architecture
- [research/claude-web-source-map.md](./research/claude-web-source-map.md) -
  preserved prior research artifact

## Current Progress

V1 is complete and retained as evidence. The implementation lives in
`packages/tooling/library/ai-sync` as the private package `@beep/ai-sync`.

The V1 package owns:

- Tier-1 source pins and committed generated metadata hashes
- native V1 schema coverage metadata for Claude Code, Codex, Grok Build,
  JetBrains AI Assistant, and Junie
- explicit `na` and `unknown_schema` cells for unsupported or undocumented
  surfaces
- local and strict drift checks, plus a refresh/generate path
- tested cross-agent transform helpers with lossy/lossless evidence
- mandatory dogfooding validation of this repo's `.codex/config.toml` during
  package and root checks

V2 is the active target. It does not replace the library or create a separate
tool package. Operator behavior belongs in the existing root repo CLI as
`bun run beep ai-sync ...`, backed by `@beep/ai-sync`.

Known live drift as of the V2/V3 bootstrap:

- `claude-code-settings`
- `rulesync-config`
- `rulesync-mcp`

## Version Ladder

### V1: Schema Truth Layer

Done. V1 validates native agent config shapes, records source metadata, detects
drift, and proves only evidence-backed transforms.

### V2: Safe Operation And Automation

Active. V2 is complete when:

- `beep ai-sync audit`, `check`, `drift`, and `refresh-pr` exist in
  `@beep/repo-cli`
- normal checks validate `.codex/config.toml`, `.mcp.json`,
  `.claude/settings.json`, `AGENTS.md`, and `CLAUDE.md`
- command output supports schema-first JSON reports and human summaries
- rulesync schema-backed config/MCP surfaces have import/audit evidence
- ruler remains research/mapping evidence rather than a parser promise
- a weekly plus manual-dispatch workflow refreshes upstream drift and
  opens/updates an automation PR only when a diff exists

### V3: Canonical Sync And Native Emission

Planned. V3 is complete when:

- `.ai-sync/project.jsonc` is the committed canonical source file
- canonical per-domain models exist for rules, skills, commands, hooks,
  plugins, MCP servers, and config/profile data
- native file emission defaults to dry-run plans with diffs and loss reports
- explicit apply writes only selected paths after validation
- current-matrix emitters cover Claude Code, Codex, Grok Build,
  JetBrains AI Assistant, and Junie without inventing unknown native shapes
- V3b refreshes public sources and adds a bounded additional-agent batch only
  after the core emitters are production-ready

## Completion Standard

This initiative is not fully complete until V1, V2, and V3 are all closed.

V1 remains closed when:

- `@beep/ai-sync` exists under
  `packages/tooling/library/ai-sync`
- every unsupported or unknown cell is explicitly represented as N/A or
  `unknown_schema` with rationale
- Tier-1 sources are pinned, generated, and drift-checked
- supported cross-agent transforms have tests and lossy/lossless metadata
- this repo validates at least one real on-disk agent config through the
  package during `bun run check`

V2 closes when safe operation, reporting, broad dogfooding, drift automation,
and rulesync audit/import evidence are implemented and verified.

V3 closes when canonical source, plan/apply emission, native validation, and
research-gated additional-agent expansion are implemented and verified.
