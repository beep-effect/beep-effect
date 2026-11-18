---
title: "The console renders from the record, never from a tool stream or a replayed log"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Render from streams again and drop the task output declaration"
---

A gate writes one typed, versioned record (`gate-report/v1`) and sends the raw stream to a log file whose path and size the console prints. The package record under `.beep/gates/` is a declared Turbo output of the `test` and `check` tasks, so a cache hit restores the record and the console is rendered from it. The console is then independent of which audience ran first. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `record-is-the-source`.
