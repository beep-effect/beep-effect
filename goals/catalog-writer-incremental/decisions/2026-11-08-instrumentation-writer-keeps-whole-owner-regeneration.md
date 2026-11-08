---
title: "Instrumentation writer keeps whole-owner regeneration"
date: 2026-11-08
reversal: "Add a file field to instrumentation span entries and splice per file"
---

A scoped instrumentation-catalog run over two @beep/repo-cli files measured 566 MB max RSS and 3.4 s, already near the bun floor, because the writer adds and removes one source file at a time. Its span entries carry no file path, so a per-file splice needs a shard-format change, which SPEC.md lists as a non-goal. Only the schema-catalog writer becomes incremental.
