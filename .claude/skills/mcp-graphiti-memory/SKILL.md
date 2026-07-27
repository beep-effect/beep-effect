---
name: mcp-graphiti-memory
description: "RETIRED (2026-07-25): the graphiti-memory service is decommissioned and its repo surfaces are removed. Do not start, install, or call it. Kept only as a historical pointer to standards/memory-architecture/04-decision-log.md. Durable dev-memory lives in Cognee."
---

# MCP Graphiti Memory (retired)

> **RETIRED 2026-07-25** — per `standards/memory-architecture/04-decision-log.md`.
> The `@beep/epistemic-tables` bitemporal port landed (PR #452) and superseded
> this service. Do not start it, do not install it, do not call its MCP tools.
> Route all durable dev-memory to Cognee.

This file is retained as a historical pointer only. There is no supported
workflow here — not reads, not writes, not diagnostics.

## What Replaced It

Bitemporal edge storage now lives in `@beep/epistemic-*` (see
`goals/epistemic-bitemporal-edge-core/`). Durable agent memory goes to Cognee.

## Removed Surfaces

The 2026-07-25 retirement removed the `beep graphiti` CLI command group, the
`graphiti:*` root package scripts, the `GRAPHITI_*` environment plumbing, and
the research pipeline's episode posting. Nothing in this checkout starts or
talks to a Graphiti service.

## If You Landed Here From An Old Reference

Read `standards/memory-architecture/04-decision-log.md` for the decision trail,
then use Cognee for the memory operation you were about to perform.
