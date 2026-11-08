---
title: "mine runs tiers as spawned runners with output schemas, span-checked findings and argv on ModelRun"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
reversal: "Drop the mine command group and the additive ModelRun argv field (decoding default empty); recorded findings stay valid"
---

Port of the academia T1/T2/T3 scripts (codex exec with an output schema per job) into research library mine: mine triage (T1, gpt-6-luna), mine read (T2, Junie claude-opus-5-5 while JetBrains credits remain, then claude-opus-5-5), mine synthesize (T3, imports session-authored synthesis). Each job spawns a configured runner, validates the JSON result against a schema, rejects any finding whose span is not verbatim in the bound capture text, and records a LibraryModelRun carrying model, effort, route and the exact launch argv (new additive field, decoding default empty so existing catalogs decode). Private-partition artifacts never route to Junie or Cursor runners. Rejected: keeping the runners as packet scripts (the academia packet lost them) and an MCP-driven runner (not reproducible from argv).
