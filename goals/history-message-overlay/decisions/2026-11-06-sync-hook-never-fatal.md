---
title: "worktree new and cloud bootstrap run sync, and never fail on it"
date: 2026-11-06
lane: "docs/git-history-rewrite-exploration"
pullRequest: 2785
reversal: "Remove syncHistoryNotesConfig from runWorktreeNew and step 4 from scripts/cloud/bootstrap.sh"
---

worktree new calls syncHistoryNotesConfig (config only, no fetch); scripts/cloud/bootstrap.sh step 4 runs bun run beep history notes sync. Both turn failures into warnings. sync adds the +refs/notes/history fetch refspec and the notes.displayRef only when absent.
