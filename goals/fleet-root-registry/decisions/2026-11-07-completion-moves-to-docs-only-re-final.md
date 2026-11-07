---
title: "Completion moves to a docs-only re-final PR because #2859 merged under S11"
date: 2026-11-07
lane: "docs/fleet-root-registry-refinal"
pullRequest: 2859
reversal: "Point proposedCloseout.finalPullRequest back at #2859 once the completion gate accepts attributed S11 reds at the accepted head."
---

#2859 merged at 7d78dae90e through yeet merge-gate --relaxed (S11) with only inherited required reds: Test Unit and Heavy / Test Integration (@beep/law-practice-server citation suites from #2737), Repo Sanity (root-package projection drift, fixed by #2881). goals completion refresh --readiness-job 9d460031 returned unsatisfied: the hosted-required-checks sub-claim needs green required checks at the accepted head, and readiness recovery refused the yeet-verdict because its head (b73215a6, the yeet open run) was not the accepted head. Following the research-library-ontology-core precedent (#2771 then re-final #2787), a docs-only re-final PR carries the closeout pointer; docs-only CI skips the inherited unit suites, so its required checks can be green once #2881 lands. Rejected: waiting for main's citation suites to go green and re-running a code PR (blocks on another lane's fix for no change in content).
