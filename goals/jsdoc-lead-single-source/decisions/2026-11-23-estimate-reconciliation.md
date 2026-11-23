---
title: "The 25,000 estimate counts all tautological exported prose; 8,726 single-source restating leads is the addressable backlog"
date: 2026-11-23
lane: "goals/jsdoc-lead-single-source-p0"
pullRequest: 3496
reversal: "Widen leadRestates or derivedLead sources in @beep/repo-utils/JSDoc/LeadSource and rewrite the jsdoc ratchet baseline"
---

The measured backlog (8,726 restating leads in the JSDoc ratchet) is about a third of the
exploration's 25,000. Running the detector over the same 1,046 sampled public blocks, at the
ledger's commit, shows the gap comes from the estimate's denominator, not from a narrow detector.

| Sampled block | Sampled tautological (628) | Sampled other (418) |
| --- | --- | --- |
| Detected: annotated export or companion | 186 | 45 |
| Detected: barrel | 30 | 0 |
| Annotated, lead judged informative | 76 | 66 |
| Barrel, lead judged informative | 36 | 6 |
| No annotation (functions, layers, constants, commands) | 171 | 209 |
| Module headers (`@packageDocumentation`) | 60 | 58 |
| Test and tooling-root files | 28 | 31 |
| Empty lead (prose is in Details) | 24 | 0 |
| Namespace members, other | 17 | 3 |

- The detector agrees with the sample on 216 blocks and misses 412.
- 283 of the misses have no single source to derive a lead from, or the scope decision excludes them:
  - 171 unannotated exports;
  - 60 module headers;
  - 28 test and tooling-root blocks;
  - 24 leadless blocks.

  Deleting an unannotated lead turns a restating lead into a missing summary, which is a different
  law change from this goal's.
- The 45 detected blocks the sample did not call tautological repeat their annotation nearly word
  for word. The sampler coded the prose by what it says, not by whether it repeats; docgen derives
  the same text, so removing them loses nothing.
- Of the remaining 129 misses, 17 are namespace members or blocks with no declaration.
  The other 112 (76 annotated, 36 barrel) are paraphrases and barrel content summaries. Widening the predicate does not pay: allowing up to two or three new words, or new
  words up to half the lead, flags the extra blocks at about 60% precision against the sample,
  and the sample's own labels agree 76% under a blind relabel. Those leads stay with their
  authors.

Re-extrapolated, the detected share is 261 of 1,046 (25%), or about 10,500 of 42,134 exported
blocks. That denominator counts module headers, test files and blocks outside docgen packages,
which the inventory does not, so 8,726 measured is consistent with it. The goal keeps reporting
removed leads against the 8,726 baseline, with 25,000 as the exploration's upper bound for all
tautological exported prose.
