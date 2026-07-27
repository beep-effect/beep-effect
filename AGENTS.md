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
- Attribute verification failures before repairing — introduced / inherited /
  unrelated / environment-only; attribution decides fix vs rebase vs report,
  not blind rerun.

## Codegen

- Use `bun run beep architecture` for canonical slice, concept, role, and
  architecture proof generation instead of hand-authoring boilerplate.
- Architecture concepts use canonical `--domain-kind` archetypes:
  `aggregates` (full slice concepts), `entities` (persisted domain entities),
  `values` (domain-only value objects).

## Dev Servers

- Dev servers run only through the portless-wrapped package scripts; canonical
  URLs are `http://<app>.beep.localhost:1355` (`storybook.beep`,
  `oip-web.beep`, `professional-desktop.beep`, `graph3d-bench.beep`).
- Never launch raw `vite`/`next`/`storybook dev` or test against numeric
  localhost ports; `PORTLESS=0 <script>` is diagnostic-only.

## Docs & Knowledge

- `docs/` is tracked authored documentation (see `docs/README.md`); docgen
  aggregate lands in gitignored `docs/generated/`; `docs/_internal/` is
  private and must never be committed (public repo).
- `explorations/` is the fuzzy front end (capture → graduate), driven by the
  `/explore` skill; crystallized work graduates into `goals/` packets and
  `docs/product/` prose.
- same-PR packet-state flips: flip goal manifest/lifecycle status and land the
  closeout reflection in the same PR as the final work.

## Agent Memory

- Cognee is the durable always-on dev-memory; file memory (`CLAUDE.md` /
  `MEMORY.md`) remains Layer 1; `graphiti-memory` is retired (bitemporal port
  landed — see the 2026-07-25 memory-architecture decision-log entry).
- See `standards/memory-architecture/` for all memory decisions and operational
  detail.
- If memory is unavailable in-session, fall back to repo-local docs, code
  search, and this file.

## Tool Routing

- effect v3↔v4 differences: prefer the `effect-v4-imports` skill.
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
  of spawning fresh ones.
- Durable on-disk handoffs: agent/session transitions exchange deliverables as
  files on disk (packet `research/`, scratchpad), never chat-only summaries.
