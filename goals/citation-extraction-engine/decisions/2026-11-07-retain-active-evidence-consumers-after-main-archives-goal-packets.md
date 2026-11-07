---
title: "Retain active evidence consumers after main archives goal packets"
date: 2026-11-07
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Restore the original consumer paths only together with an executable retained source for those archived inputs; preserve source bytes and metrics."
---

Hosted Labs and Fallow dead-code failed after main archived goal inputs still read by active packages. Retain the three claim JSON inputs, live replay evidence and KPI artifacts with their active consumers. Exact original hashes are retained; regenerated KPI outputs differ only in adoption-table path. All 106 lab and eleven claim tests pass. Four unresolved imports are gone; the unrelated existing foldkit unused dependency is still reported locally. See history/evidence/2026-11-07-archive-consumer-ci-repair.md.
