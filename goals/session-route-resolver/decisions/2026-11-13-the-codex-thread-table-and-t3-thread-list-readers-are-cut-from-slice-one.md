---
title: "The Codex thread-table and t3 thread list readers are cut from slice one"
date: 2026-11-13
lane: "feat/session-route-resolver"
reversal: "Add a Codex state_5.sqlite reader and a t3 thread list reader as further claim sources in Resolve.service.ts."
---

BRIEF.md names these two as first to cut. Slice one resolves through the ledger, presence and the Claude live index, and reads T3 thread state with `t3 thread show` and link state with `t3 environment list`. A key with no ledger claim prints one t3_thread_search per linked environment, which covers T3-owned work on any host; Codex desktop sessions are discoverable but unroutable either way.
