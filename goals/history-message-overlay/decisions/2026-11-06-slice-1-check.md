---
title: "Slice 1 landed in the lane: map tracked, history notes --check"
date: 2026-11-06
kind: checkpoint
lane: "docs/git-history-rewrite-exploration"
pullRequest: 2785
reversal: "Revert the slice-1 commits on the branch"
---

docs/history/commit-message-map.json (940 rows) tracked; @beep/git gains notesList and hashObject; beep history notes --check decodes the map, proves every key reachable from origin/main and compares published notes by blob id. Real-repo run: 940/940 reachable, ref not yet published. Next: slice 2 (--write, sync, bootstrap hooks).
