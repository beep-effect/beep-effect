---
title: "P3: L2-3 lands in two halves, its decode and assemble half in commit 4 and its merge and restrict half in commit 5"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Move every L2-3 case into commit 5 and keep Generation.laws.test.ts out of commit 4, by a decision file"
---

Section 10 of the P3 design lists `L2-3` in commit 4, but the restated row (decision `p3-ledger-rows-restated`) also asks that `merge` and `restrict` keep every annotation attributed with one generation per pair, and those two functions arrive in commit 5. Commit 4 therefore ships `packages/foundation/modeling/annotation/test/Generation.laws.test.ts` with the cases its code can carry: the checked decode refuses an unattributed annotation and a second generation for one (content, activity) pair; `assemble` gives every annotation exactly one generation of its activity; every generated run is the `generation/v1` hash of its pair, with the golden; and a generation with no stated time encodes without the `at` key. Commit 5 adds the merge and restrict cases to the same file under the same ledger title, so the row turns green in commit 10 with both halves.
