---
title: "Canonical note body is the message with exactly one trailing newline"
date: 2026-11-06
lane: "docs/git-history-rewrite-exploration"
pullRequest: 2785
reversal: "Change historyNoteBody in commands/History/History.schemas.ts and rebuild refs/notes/history with --write"
---

historyNoteBody strips trailing newlines from the map value and appends one \n, which is what git notes add -m stores (a real-git integration test asserts hashObject(body) equals the -m note blob). Map rows all end with \n; the message schema also rejects trailing whitespace and doubled blank lines because git's cleanup would rewrite them, so --check compares blob ids exactly. Map keys decode with onExcessProperty error so a short SHA fails instead of being dropped.
