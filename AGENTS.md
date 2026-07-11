# Agent Guide

Canonical rules for all coding agents. Claude Code loads this via the
`CLAUDE.md` symlink; Codex reads it directly. Laws only — architecture lives
in `standards/ARCHITECTURE.md`, workflows in skills.

## Mission

Ship reliable code with effect-first and schema-first patterns.

## Code Laws

- Use schema-first domain models; prefer typed errors and tagged unions.
- Prefer effect helper modules (`String`, `Equal`, ...) over native helpers;
  keep root `effect` imports for core combinators.
- Prefer match helpers over conditional chains; prefer service composition
  over global state; keep service boundaries explicit.
- Prefer tersest equivalent helper forms when behavior is unchanged: direct
  helper refs over trivial lambdas, `flow(...)` for passthrough `pipe(...)`
  callbacks, shared thunk helpers when already in scope.
- Prefer named schema building blocks, derived `S.is(...)` guards, and
  `LiteralKit` internal domains over ad-hoc predicate helpers. Do not add
  `as const` to inline arrays passed to `LiteralKit(...)` — it uses const
  type parameters already.
- Apply schema defaults when safe. Keep changes focused and testable.
- In `packages/**/{test,dtslint}/**/*.{ts,tsx}`, import package source through
  `@beep/*` aliases instead of relative paths into any workspace `src/`;
  relatives only for local helpers, fixtures, snapshots, and other
  non-`src` test files.

## Discovery & Reuse

- Before recreating a shared helper, schema, utility, model, or known symbol,
  search live source and barrels first:
  `rg -n "export (const|function|class|type|interface) .*<intent>" packages --glob '**/src/**/*.{ts,tsx}' --glob '!**/*.test.*'`
  and `rg -n "<intent>" packages --glob '**/src/index.ts'`. Use the
  `repo-symbol-discovery` skill for broader lookups.
- The old `standards/repo-exports.catalog.*` is retired; never look for it or
  run repo-export catalog commands as a discovery or proof step.

## Quality Operator

- Yeet is the canonical repo-quality path: `bun run beep yeet repair`,
  `... verify`, `... publish --message "..."`, `... monitor` for End-to-End
  Green (repair, proof, commit, push, PR checks, closeout, merge readiness).
  Keep repo quality commands green.
- `main` is PR-only. Do not commit saving/wip/tmp checkpoints to shared
  branches; publish from a feature branch through Yeet and let hosted required
  checks gate the merge. GitHub merge/squash commit messages are also
  server-side commitlint input; keep body lines wrapped under 100 characters.
- Fast-plus-monitor is opt-in only (`publish --fast --monitor`, PR-branch
  guarded). Default to plain `publish --message`. Keep
  `bun run audit:github pre-push` as the explicit full local fallback for
  secrets, security, SAST, or Nix lanes.
- Docgen: prefer `bun run docgen:local` for edit loops (bounded,
  `origin/main...HEAD` + dirty files); `bun run docgen` only for the full
  repo proof.

## Codegen

- Use `bun run beep architecture` for canonical slice, concept, role, and
  architecture proof generation instead of hand-authoring boilerplate.
- Architecture concepts use canonical `--domain-kind` archetypes:
  `aggregates` (full slice concepts), `entities` (persisted domain entities),
  `values` (domain-only value objects).

## Docs & Knowledge

- `docs/` is tracked authored documentation (see `docs/README.md`); docgen
  aggregate lands in gitignored `docs/generated/`; `docs/_internal/` is
  private and must never be committed (public repo).
- `explorations/` is the fuzzy front end (capture → graduate), driven by the
  `/explore` skill; crystallized work graduates into `goals/` packets and
  `docs/product/` prose.

## Agent Memory

- Cognee (`beepintir` MCP + cognee-memory plugin hooks/skills) is the sole
  always-on durable dev-memory (2026-07-08 decision,
  `standards/memory-architecture/04-decision-log.md`). It is OPERATOR-LEVEL
  config (user plugin + user MCP settings), not provisioned by this repo's
  `.mcp.json` — checkouts without it fall back to file memory and repo docs,
  by design. Bounded use only: embedded/local or all-Postgres profile;
  semantic memory is a managed cache (TTL, pruning, consolidation, node-set
  scoping) — never source of truth. No uncited LLM output crosses the
  authority boundary.
- File memory (this file via the `CLAUDE.md` symlink, auto-memory
  `MEMORY.md`) remains Layer 1 for durable curated knowledge.
- `graphiti-memory` is DEPRECATED: write-frozen, read-available for
  historical context only until the `@beep/epistemic-tables` bitemporal port
  lands, then decommissioned. Read helpers until then:
  `bun run graphiti:proxy`, `bun run graphiti:proxy:ensure`; `group_ids`
  must be a JSON array containing `beep_dev`.
- If memory is unavailable in-session, fall back to repo-local docs, code
  search, and this file.

## Tool Routing

- effect v3↔v4 differences: prefer the `effect-v4-imports` skill; reach for
  Cognee recall (or read-frozen `graphiti-memory`) only for historical
  context.
- shadcn: editor app = app workspace, shared UI package = shared base; prefer
  the shadcn skill + shadcn MCP for registry discovery and installs.
- MUI: prefer `mui-mcp` — `useMuiDocs` first, then `fetchDocs` only with URLs
  it returned.

## Context Economy

- Keep the MCP/tool surface stable within a session; settle `.mcp.json` and
  enabled tools before working, not mid-task.
- Always-loaded files (this file, skill frontmatter, settings) are the prompt
  cache prefix: batch edits to them, keep them lean; durable cross-session
  knowledge belongs in file-memory or Cognee, not here.
- Front-load stable context; let volatile per-task detail arrive later in the
  conversation.
- Continue related follow-ups on an existing subagent (SendMessage) instead
  of spawning fresh ones; avoid idle gaps over ~5 minutes (cache TTL).
