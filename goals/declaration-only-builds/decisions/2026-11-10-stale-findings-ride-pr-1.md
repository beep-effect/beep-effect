---
title: "Three stale findings land in the first PR"
date: 2026-11-10
reversal: "Revert the PR."
---

The `Bun.build 1.3.14` comment in the effect-drizzle bundle probe (retired by Experiment 1 on 2026-10-09), the probe's floor-only size check (a 98-byte invalid stub passes a floor, so add presence and import-validity assertions), and the pre-#1874 `node_modules/.tmp` tsbuildinfo glob in `turbo.json` `build.outputs` if no package still writes there. Agent call under the fix-where-found rule.

Source: exploration `explorations/build-pipeline-simplification/DECISIONS.md` (Q9).
