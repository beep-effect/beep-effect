# @beep/practice-kg-mcp Agent Guide

Runnable home of the practice knowledge-graph MCP surface (goals/practice-kg-mcp,
D-9 placement ruling). The app owns NO business logic: it parses flags, composes
runtime layers, and calls into `@beep/law-practice-server` projections.

| Surface | Key exports | Notes |
| --- | --- | --- |
| `src/build.ts` | bundle-build entrypoint | contract §5 flags (`--corpus-root`, `--bundle-out`, `--include-refresh`, `--skip-emails`, `--max-text-bytes`, `--overwrite`) |
| `src/runtime` | `Layer.ts`, `Pglite.ts` | app-local file-backed PGlite provider (professional-desktop precedent); the DuckDb layer arrives with PR-3's injected host seam |

Rules that bind here:

- Read-only posture (SPEC D-4): no write/approval MCP tools; stop and report
  before adding any.
- Corpus content and PII never enter the repo; bundles are built on the
  workstation and shipped out-of-band.
- The stdio MCP server `bin.ts` lands with PR-3 (tool declarations in
  `law-practice/use-cases`, handlers in `law-practice/server`).
- Follow `goals/practice-kg-mcp/SPEC.md` for decisions and
  `goals/practice-kg-mcp/research/bundle-contract.md` for the data contract.
