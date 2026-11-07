---
title: "The write mode builds one parentless, fixed-identity notes commit via fast-import"
date: 2026-11-06
lane: "docs/git-history-rewrite-exploration"
pullRequest: 2785
reversal: "Switch Git.replaceNotes to git notes add per row and drop the determinism guarantee"
---

Git.replaceNotes streams git fast-import one parentless commit with a fixed identity (beep history notes, noreply@beep-effect.com), fixed time 1793923200 and a fixed message, one inline note per sorted row. The commit id depends only on the map: two writes and a write from a different prior ref state all gave b40fd076d8 on this clone, and the check with require-published then matched 940/940. Consequence for slice 3: each changed overlay replaces the ref with an unrelated commit, so publication force-pushes refs/notes/history (a notes ref, never a branch) and the sync fetch refspec carries the + prefix.
