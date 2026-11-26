---
title: "P7 checkpoint: the cut-over is content-complete in the lane; the cache re-stamp closes it"
date: 2026-11-25
kind: checkpoint
lane: "p7"
reversal: "Reopen P7 by reverting the #3562 squash on main; both deleted packages recover from 6265d739bb6 (the #3558 squash on main, which still holds them), and their retired-name rows are removed with the revert"
---

P7 rows 2 to 6 are committed on the P7 lane, on top of the P6 merge 8bdd55d39f4: row 2 (9f64252ca95) absorbs the remaining THEORY.md claims into section 14 of the knowledge-stack chapter, row 4 (dd4cd61ad12) corrects the vision document and its companions, row 1 (cb2ac027907) deletes @beep/schema-org, row 3 (66a3513e3d6) deletes @beep/nlp after the port-history notes and categorical JSDoc of the successor packages are rewritten, and row 5 (e30dc86f3c0) adds the landing entry to standards/architecture/DECISIONS.md and amends the split ruling. Both deletions ran through delete-package, and both names are reserved in standards/changesets.retired-packages.json. research/consumer-census.md records every group b, c and f disposition, the S31 counts per package and the scoped nlp exit; the cli Kb Selector text-quote case is kept by decision. lint schema-first, identity-registry and package-scripts pass on the lane. Row 7 re-stamps the cache baselines and re-measures S31. The one red the lane carries, laws-retired-effect-paths on two P6 packet lines, is inherited from P6 and is fixed in that layer. The PR is opened only by the parent.
