---
title: "Final #2963 merged over four queued Heavy checks"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Delete this file; goals completion refresh reports #2963 unsatisfied again."
redAttribution:
  finalPullRequest: 2963
  reds:
    - { context: "Heavy / Check", attribution: introduced, fixPullRequest: 2985 }
    - { context: "Heavy / Docgen", attribution: introduced, fixPullRequest: 2975 }
    - { context: "Heavy / Doctest", attribution: introduced, fixPullRequest: 2985 }
    - { context: "Heavy / Test Integration", attribution: introduced, fixPullRequest: 2985 }
---

Final #2963 (goals-only, head `ea2ac3a42b`, merge `de54b37982b`) merged at 2026-11-08T11:42:52Z through a ruleset bypass while Heavy / Check, Heavy / Test Integration, Heavy / Docgen and Heavy / Doctest of its run 42475668100 were still queued. All four were cancelled at 12:00:25Z, in the same second as the queued Heavy jobs of #2974, #2969 and #2973. Each cause follows the bypass-merge rule (decision `2026-11-13-red-attribution` of goal-closeout-hosted-verification, DN-24).

All four are introduced. Main was green for them at the merge: #2972 (head `8fca415877`, which lacks `de54b37982b`) passed all four between 11:02Z and 11:17Z, and the goals-only #2961 and #2962 passed all four at 11:15Z-11:18Z. No run on a head without the merge commit failed them in that window.

The fix PR is the first PR merged after #2963 whose head contains `de54b37982b` and whose same context passed. #2977, #2968, #2983, #2978, #2982 and #2986 had all four cancelled at their merges.

- Heavy / Docgen: #2975 (head `de3a204c13`) passed it at 17:51Z; its other three were cancelled.
- Heavy / Check, Heavy / Test Integration, Heavy / Doctest: #2985 (head `d838de23b1`, goals-only like #2963) passed them at 19:42Z.
