---
title: "register convert moves a unit in two appends; scheduled-task is a unit kind"
date: 2026-11-06
lane: "feat/orchestrator-handoff-p2"
reversal: "Delete session register convert and the scheduled-task kind; units are retired and re-added by hand."
---

`session register convert --kind --address --to-kind --to-address [--brief]` retires the source row (note: converted to the target) and registers the target active with the source's name, owns, waiting ask and orphan plan, last contact now and a note naming the source and brief. It refuses an unregistered or retired source, an in-process-agent target (it would still die with the session), the same unit, and a target with a live row. The orchestrate skill already told successors to re-arm `scheduled-task` rows (T3 `schedule_task`), but the kind did not exist, so such tasks had been registered under other kinds; `scheduled-task` is added. A T3 thread stays a `desktop-session` or `codex-lane` row addressed by its thread link.
