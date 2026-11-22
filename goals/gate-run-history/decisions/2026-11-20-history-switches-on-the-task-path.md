---
title: "Task-path history is automatic outside Vitest, with an off switch and a file override"
date: 2026-11-20
lane: "goals/gate-run-history-lane"
reversal: "Drop the VITEST check and the two BEEP_GATE_HISTORY variables and always resolve the store from git and XDG."
---

The SPEC says the store is never opened inside a Vitest process. The CLI's automatic history setting therefore resolves no store when VITEST is set; BEEP_GATE_HISTORY=off (or 0, false, no) turns history off anywhere, and BEEP_GATE_HISTORY_FILE names another store file. The Vitest rule comes first, so a named file does not turn the automatic setting on inside Vitest; only an explicit HistoryAt setting does. Tests pass an explicit HistoryAt setting with a file and scope instead of touching the environment. A detached checkout records under detached@<sha>, so it never joins a branch's series. Resolution never fails a gate run: outside a git checkout or without a state directory there is no history.
