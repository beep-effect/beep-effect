---
title: "Gate table is yeet gate-table, not merge-gate --table"
date: 2026-11-06
lane: "feat/orchestrator-handoff-p2"
reversal: "Fold the table into merge-gate behind optional pr/sha arguments and delete the gate-table subcommand."
---

PLAN P2 named `yeet merge-gate --table`. The gate takes two required positional arguments (the PR and the pinned head) and the pin is its safety contract; making them optional to host a read-only table would weaken it. The port is a sibling subcommand, `yeet gate-table [--json]`, that only reads and never merges. `gate.sh` stays as a one-line wrapper so pollers armed before the port keep working.
