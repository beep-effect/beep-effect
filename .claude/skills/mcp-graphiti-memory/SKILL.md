---
name: mcp-graphiti-memory
description: "DEPRECATED (2026-07-08 memory decision): Graphiti is write-frozen, read-only for historical context until the epistemic-tables bitemporal port lands. Use only for read workflows: startup checks, fact search, handshake diagnosis. New durable memory goes to Cognee."
---

# MCP Graphiti Memory

> **DEPRECATED** — per `standards/memory-architecture/04-decision-log.md`
> (2026-07-08): graphiti-memory is write-frozen and read-available only until
> the `@beep/epistemic-tables` bitemporal port lands. Do not log new episodes;
> use Cognee for durable dev-memory.

## Use When
- You need READ-ONLY historical lookup of pre-freeze Graphiti memory.
- You see Graphiti MCP startup or handshake failures.

Never select this skill for memory WRITEBACK: the write path is frozen
(2026-07-08 decision). Route new durable memory to Cognee
(`cognee-memory:cognee-remember`).

## Quick Smoke
1. Call `mcp__graphiti-memory__get_status`.
2. Call `mcp__graphiti-memory__search_memory_facts` with `group_ids: "[\"beep_dev\"]"` when the wrapper exposes `group_ids` as a string. If the tool accepts native arrays, `["beep_dev"]` is also valid.

## Representative Calls
- Read status: `get_status`.
- Recall facts: `search_memory_facts`.
- Save findings: FROZEN — do not call `add_memory`; use Cognee instead.

## Common Failures
- `group_ids` type error.
- HTTP endpoint mismatch for `/mcp`.
- Handshake closes before `initialize` completes.

## Fix Patterns
- The server expects `group_ids` to decode to a list. Never pass the plain string `"beep_dev"`.
- If the MCP tool schema exposes `group_ids` as `string`, pass the JSON array literal string `"[\"beep_dev\"]"`.
- If the MCP tool schema exposes `group_ids` as an array, pass `["beep_dev"]`.
- Confirm URL is `http://localhost:8000/mcp`.
- Retest with a lightweight call (`get_status`) before deeper calls.
