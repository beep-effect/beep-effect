---
title: "Final #2966 merged over four cancelled Heavy checks"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Delete this file; goals completion refresh reports #2966 unsatisfied again."
redAttribution:
  finalPullRequest: 2966
  reds:
    - { context: "Heavy / Check", attribution: introduced, fixPullRequest: 2984 }
    - { context: "Heavy / Docgen", attribution: introduced, fixPullRequest: 2984 }
    - { context: "Heavy / Doctest", attribution: introduced, fixPullRequest: 2984 }
    - { context: "Heavy / Test Integration", attribution: inherited, fixPullRequest: 2994 }
---

Final #2966 (head `f84f5e8850`, merge `9f44753a8c1`) merged at 2026-11-09T02:51:48Z through a ruleset bypass. Its workflow run 42502211325 had cancelled Heavy / Check, Heavy / Test Integration, Heavy / Docgen and Heavy / Doctest at 2026-11-08T18:22:47Z-18:22:54Z, so the head never reported another conclusion for them. Each cause follows the bypass-merge rule (decision `2026-11-13-red-attribution` of goal-closeout-hosted-verification, DN-24).

- Heavy / Check, Heavy / Docgen, Heavy / Doctest: introduced. Main was green for them at the merge: #2989 (run 42538972891) and #2980 (run 42540530043), whose heads lack `9f44753a8c1`, passed all three between 01:04Z and 02:39Z. The first later PR whose head contains the merge commit and passed them is #2984 (head `a7f168d9e0`, run 42553533938: Doctest 04:03Z, Check 04:50Z, Docgen 05:08Z). #2980 and #2989 merged earlier, but their heads lack the merge commit.
- Heavy / Test Integration: inherited. Main was red for it: #2989 (job 128909814046) and #2980 (job 128914628185), heads without #2966, failed law-practice-server integration (#2989 on the `CitationDiffWorker` watchdog at 03:03Z), and #2984 (job 128954472947) failed `CitationCanonicalExtractionNode` on `extractDeadline`, a test that predates #2966. The episode's `unblocks-main` PR is #2994 (labelled `unblocks-main`; episode ep70 in `decisions/2026-11-09-keep-pr-2994-effect-vitest-exceptions-as-debt.md`). Its head `25305d8ecd` contains `9f44753a8c1`, and its Heavy / Test Integration passed in run 42583580600 (08:09Z-09:56Z), the first full law-practice-server integration pass after the merge.
