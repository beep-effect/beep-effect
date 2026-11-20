---
title: "A file is scanned when one of its own timestamps falls inside the window"
date: 2026-11-19
lane: "goals/agent-output-census-library"
reversal: "Count every file whose modification time is at or after the window start, and accept a count that grows as old files are touched."
---

This amends the selection rule in reproduction-window. The reference run counted 342 Claude files: every file whose modification time was inside the window when it ran. That set cannot be rebuilt later. The harness appends untimestamped records to old transcripts, so a file can be modified without gaining a record in the window; on 2026-11-19, 870 files had a modification time at or after the window start and 780 also started before its end. The census counts a file as scanned when one of its own record timestamps falls inside the window: 226 files on the reproduction run. Active contexts, the count the audit's tables rest on, match exactly (223: 127 sessions, 96 subagents). The modification time is still the walk's pre-filter, and a file with no timestamp in the window contributes nothing.
