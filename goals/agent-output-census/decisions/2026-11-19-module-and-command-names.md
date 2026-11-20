---
title: "The census lives in four flat modules of @beep/repo-ai-metrics and runs as beep ai-metrics census"
date: 2026-11-19
lane: "goals/agent-output-census-library"
reversal: "Move the census into its own tooling library and re-point the command."
---

The library's sources are flat kebab-case modules, so the census follows: census-report.ts (the agent-output-census/v1 report and baseline file schemas), census-rules.ts (the closed class domains with each member's matching rule and the rule version), census-projection.ts (the in-memory projection of one record into calls, results and usage, internal), and census.ts (the Census Context.Service contract and its layer). The command is census under the existing ai-metrics group, with --since and --until for the window, --claude-root, --codex-root and --repository for selection, --json for the encoded report, and --write-baseline to add the run's file.
