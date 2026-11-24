---
title: "P3: one PR stacked on the P2 branch, opened under the three-PR limit and on the orchestrator's word"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Split the commits after the annotation package into two PRs by a decision file; the commit order makes the cut clean"
---

P3 ships as one PR from its lane, a stack layer on the P2 branch, in the commit order of section 10 of `research/2026-11-22-p3-design.md`. The handoff commit is indivisible: changing `LangExtractRequest`, `LangExtractResult` and the target breaks every caller, so chapter 11 rule 3 puts the consumer migration in the same commit. The registry terms, `@beep/text` additions, the annotation package, the OA adapter and the nlp deletions are separate commits around it. The PR opens only when the packet has fewer than three open PRs, after P2 is open, and on the orchestrator's word while P2 is unmerged. Before the final check the lane merges its parent once.
