---
title: "Agents reach detail through files and repo CLI commands, never MCP or hooks"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Add an MCP server over the gate records in a new goal"
---

Every run writes one typed record and one raw log to disk. The console prints the verdict, the failures and both paths with the log's size. The planned `gate` command family on the repo CLI shows a run and one item in full. No MCP tool and no hook is added to any harness, and pointer lines name repo CLI commands instead of upstream's MCP tool names. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `agent-surface`.
