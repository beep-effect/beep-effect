---
title: "Slices A and B merged; slice A closed"
date: 2026-11-13
kind: checkpoint
lane: "chore/yeet-delete-legacy-merge"
reversal: "Checkpoint only; nothing to reverse."
---

Slice A's port merged on 2026-11-12 as #3099 and slice B merged the same day as #3130. Four relaxed merges that day (#3121, #3125, #3126, #3119) left gate comments naming merge-async, the gated head and the bypass sent; history/2026-11-13-slice-a-closed.md quotes them and says what was not observed (a strict merge leaves no trace on GitHub, and whether #3099 itself merged through the new path is not known). The legacy call is deleted in this PR, which closes slice A. Next: slice C, two-layer stacks, then the pilot.
