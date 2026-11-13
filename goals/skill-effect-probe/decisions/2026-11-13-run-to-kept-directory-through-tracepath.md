---
title: "Run to kept directory through tracePath"
date: 2026-11-13
reversal: "If a later harness drops tracePath, fall back to one case and one arm per invocation."
---

Each --json run entry carries tracePath = <kept dir>/out/trace.jsonl, so case, arm and index tie to the kept directory in one invocation (P0 slice).
