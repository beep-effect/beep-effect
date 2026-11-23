---
title: "P2: one PR, stacked on PR C, thirteen commits, opened once PR C is merged or on the orchestrator's word"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Split the commits at the boundary after the rename (commit 2) into two PRs by a decision file; the commit order already makes that cut clean."
---

P2 ships as one PR from goals/text-knowledge-stack-rebuild-p2-text, a stack layer on PR C (#3449). With B (#3439) and C open that is three open PRs, the packet limit, so no second P2 PR opens. Chapter 11 rule 3 (retire in the PR that migrates the consumers, no alias) makes the package move indivisible; the L1 additions, the citation step, the rdf, party, md and memory changes are separate commits on top of it. The 2026-11-20 P1 checkpoint says P2 opens after PR C merges and the chapter-11 amendment is effective. The amendment is on origin/main (DECISIONS.md, 2026-11-19 scoped amendment). The lane may be built and proved while C is open; the PR itself opens after C merges, or earlier as a stack layer only when the orchestrator and the CI goals driver say so. The commit order is in research/2026-11-20-p2-design.md section 10. Two small PRs off main come first and are not packet PRs: the delete-package doctor and the langextract NFKC cluster rule, both defects found while designing in files P2 does not otherwise own. Every step before the rename only adds fixtures that today's code already satisfies, so byte-stability is proved by tests that are older than the change.
