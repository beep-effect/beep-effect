---
title: "A failing job is reached through files and a repo CLI command, not MCP or hooks"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Add an MCP tool for CI failures and drop the failing-region command"
---

Operator ruling in `explorations/agent-verification-output/DECISIONS.md`, entry `agent-surface`: an agent reaches detail beyond the verdict through typed records on disk and repo CLI commands; no MCP tools and no hooks are added. For CI this means a planned command on the repo CLI that prints a failing job's verdict and isolated failing region by run or PR number, saves the whole log under `.beep/gates/` and names it by path and size. It behaves the same under Claude, Codex, Cursor and Grok, adds nothing to always-loaded context, and replaces the raw `gh api` log recipe in the yeet skill. Footer pointers are runnable commands.
