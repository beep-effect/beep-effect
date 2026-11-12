---
title: "PERIH-01 slice 1 merged in #3116; required names proven on a code head"
date: 2026-11-12
kind: checkpoint
lane: "docs/heavy-pool-diet-perih-01-proof"
pullRequest: 3116
reversal: "Revert the #3116 squash commit aec8dbf57bd; this checkpoint then records history only."
---

#3116 merged as aec8dbf57bd on 2026-11-12. Before the merge, Check run 42775621719 on code head fcbedcaa604 reported Heavy / Test Integration (success) and Heavy / Coverage Regression under their exact required names, and neither Test Integration Partitions nor Coverage Artifact Migration appeared. Coverage Regression was red on nine ratchet rows, all inherited from #3068 (87837893fd7) and identical on main at b757bd0400f and 2cadc8caa0d; the PR merged over that red under S11. A docs head only runs the new check.yml once it is on main, so no docs-head proof existed at merge time; the documentation-only PR that adds this checkpoint is that docs head, and its run is the docs-head reading. The Publish Beep CI Binary run on aec8dbf57bd failed on an HTTP 403 from gh release create after compile and smoke passed, so release beep-ci-aec8dbf57bde does not exist; later main commits published normally.
