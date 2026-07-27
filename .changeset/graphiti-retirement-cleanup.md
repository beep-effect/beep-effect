---
"@beep/repo-cli": patch
---

Graphiti retirement cleanup: remove the retired `beep graphiti` command group
(service, config, schemas, errors, proxy step executor, tests, and tsconfig
aliases), drop the `postResearchEpisode` dual-write from `research cognify`
(Cognee is the durable memory lane), and remove the root `graphiti:*` scripts,
`GRAPHITI_*` env passthrough, and env examples. The `mcp-graphiti-memory`
skill notice flips from deprecation to retirement per the 2026-07-25
memory-architecture decision-log entry (bitemporal port landed in PR #452).
