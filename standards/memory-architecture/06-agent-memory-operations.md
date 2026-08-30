# Agent Memory Operations

> **SUPERSEDED (2026-08-29) — do not follow.** basic-memory and codegraph were
> removed entirely; file memory is the memory layer (see the 2026-08-29 entry
> in [`04-decision-log.md`](./04-decision-log.md) and `AGENTS.md` §Agent
> Memory). This runbook is retained as history only. Do not register, launch,
> or provision either tool from these instructions.

This runbook implements the authoritative external-memory decision in
[`04-decision-log.md`](./04-decision-log.md#2026-07-08-external-memory-stack--donor-portfolio-confirmed-cognee-is-the-sole-dev-memory-incumbent-doctrine-phrasing-sharpened).
It records mutable operator and session details only; changes here do not amend
that decision.

> **Amendment (2026-08-06).** The durable dev-memory role moved from Cognee to
> basic-memory + codegraph; see
> [`07-shared-memory-adoption.md`](./07-shared-memory-adoption.md) and the
> 2026-08-06 entry in [`04-decision-log.md`](./04-decision-log.md). The
> sections below are updated to match; the operator/product boundary is
> unchanged.

## Provisioning and operating envelope

- basic-memory and codegraph are registered in the repository `.mcp.json`;
  Cognee and the read-frozen Graphiti service remain operator-level MCP
  facilities, supplied by user plugin/settings.
- Run Cognee only in its embedded/local or all-Postgres profile, never the full
  compose stack. Treat its semantic state as a bounded cache with TTL, pruning,
  consolidation, and node-set scoping; it is not an authority source.
- File memory (`CLAUDE.md` and `MEMORY.md`) remains Layer 1 and is the fallback
  when external memory is unavailable.

## Recall routing

- Prefer basic-memory (project `beep-shared`) for durable dev-memory recall
  and for writing anything worth recalling in a later session.
- Prefer codegraph for code-structure questions — symbol definitions, callers,
  dependency edges — before falling back to repository-wide text search.
- Cognee is available for document-KG experiments; it is no longer the default
  recall path. Use `graphiti-memory` only for historical reads while the
  decision log's write freeze and decommissioning milestone remain in force.
- Start or recover the historical Graphiti read proxy with
  `bun run graphiti:proxy` or `bun run graphiti:proxy:ensure`.
- Graphiti reads scope `group_ids` to `beep_dev`: pass `["beep_dev"]` when the
  tool accepts an array, or the JSON array string `"[\"beep_dev\"]"` when its
  wrapper exposes a string field. Never pass the scalar string `"beep_dev"`.

## Session continuity

- Keep the MCP/tool surface stable within a session. Continue related work on
  an existing subagent and avoid idle gaps over ~5 minutes when preserving the
  prompt cache matters; that interval is an operational cache TTL, not an
  architecture guarantee.
