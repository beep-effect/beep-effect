---
title: "HANDOFF.md renderer regenerates data sections and keeps prose"
date: 2026-11-06
lane: "feat/orchestrator-handoff-p2"
reversal: "Delete session handoff and session ruling and go back to hand-writing HANDOFF.md from the template."
---

`session handoff [--file] [--gate-snapshot <file>] [--write]` regenerates the sections whose truth is a file: the holder line (newest open orchestrator row in the ledger), Rulings in force (when the rulings store has one in force), Gate snapshot (when given), Register (always) and Journal pointer (last STATE.md line). Promises, pending decisions, operator-hands items, next actions, recipes, routes and the broadcast are prose written at the moment of the event; they are carried over verbatim, the template placeholder is written only when a section is missing, and sections the template does not know are kept before the journal pointer. `--write` backs the old file up as `HANDOFF.<instant>.bak.md`. Rulings are a new append-only store, `orchestrator-ruling/v1` rows in `<repo>.rulings.jsonl` next to the register, keyed by a kebab-case id with `--supersedes` retiring the replaced ruling. This supersedes the 2026-10-06 'HANDOFF.md is a template, not a schema' row for the data-backed sections only.
