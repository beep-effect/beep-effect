---
title: "Keep a parent-killed child process with one regex worker at a time per request"
date: 2026-11-12
lane: "explore/citation-engine-install-and-worker-reuse"
reversal: "Return to one process per evaluation (protocol v2)."
---

Bun cannot terminate a worker thread inside `RegExp.exec`, so the kill stays an OS process kill. The worker is spawned lazily, serves the request's jobs in sequence under a parent timer per job, and never respawns after a deadline, because a regex deadline already fails the request. Operator answer, exploration align round 1. Rejected: an engine-lived pool (needs replace, recycle and poisoned-job rules, and one process sees every request's text) and a slimmer one-job entry (291 spawns remain). Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, regex worker lifetime.
