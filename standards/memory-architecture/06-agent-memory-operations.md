# Agent Memory Operations

This runbook implements the authoritative external-memory decision in
[`04-decision-log.md`](./04-decision-log.md#2026-07-08-external-memory-stack--donor-portfolio-confirmed-cognee-is-the-sole-dev-memory-incumbent-doctrine-phrasing-sharpened).
It records mutable operator and session details only; changes here do not amend
that decision.

## Provisioning and operating envelope

- Cognee and the read-frozen Graphiti service are operator-level MCP facilities,
  supplied by user plugin/settings rather than the repository `.mcp.json`.
- Run Cognee only in its embedded/local or all-Postgres profile, never the full
  compose stack. Treat its semantic state as a bounded cache with TTL, pruning,
  consolidation, and node-set scoping; it is not an authority source.
- File memory (`CLAUDE.md` and `MEMORY.md`) remains Layer 1 and is the fallback
  when external memory is unavailable.

## Recall routing

- Prefer Cognee for durable dev-memory recall. Use `graphiti-memory` only for
  historical reads while the decision log's write freeze and decommissioning
  milestone remain in force.
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
