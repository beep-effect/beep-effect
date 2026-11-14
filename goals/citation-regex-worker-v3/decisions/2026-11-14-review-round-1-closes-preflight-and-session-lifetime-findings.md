---
title: "Review round 1 closes preflight and session lifetime findings"
date: 2026-11-14
kind: checkpoint
reversal: "Reopen B2 implementation if a regression disproves the allocation, interruption or handover ordering; preserve the owner protocol rulings and repeat the affected files with FullSpan last."
---

Review round 1 fixes all four accepted findings in local commits 4c11b6b65b5 and 8c8f819ed1f. Descriptor selection precedes exact full-frame preflight, receiving allocation and compilation; immutable captured fingerprints are rechecked. Preparation and dispatch share the lane handover transaction, with trusted already-locked capabilities across timer fibers. Every interrupted session fails closed, confirms child retirement and returns its lease exactly once, including preparation before spawn. The strengthened depth witness proves JSON parsing was not reached. Session tests pass 48/48 on both child runtimes, protocol 4/4, descriptors 8/8 and retained v2 worker/protocol 19/19 and 14/14. All 195 affected files and the final FullSpan gate ran serially, with 75 final-implementation reruns: 196 unique files, 808 passing tests and the same 23 fixture-authority failures across nine untouched files awaiting B1 alignment. FullSpan passes 12/12: 10 regex children for 291 evaluations, every other column unchanged, 38.18 seconds wall time. All required checks pass, Fallow introduces zero findings, and no safety guard was weakened. Evidence: history/evidence/2026-11-14-b2-regex-session.md, Review round 1. B2 stays in review. No push, merge, rebase or subagent.
