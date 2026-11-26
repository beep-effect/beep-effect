---
title: "P6: nlp Operations and Algebra are replaced, not moved; ActivityLogReducer is the only surviving instance"
date: 2026-11-24
lane: "p6"
reversal: "Restore nlp/src/Operations and nlp/src/Algebra from the P5 head, git mv them into nlp-processing, and add law rows for each moved instance"
---

PLAN P6 says nlp-processing absorbs nlp/Operations and nlp/Algebra after a Combiner/Reducer census. The census (research/2026-11-24-p6-map-operations.md section 3) found zero consumers outside nlp for either module: the 25 Monoid.ts instances, the 26 NLPMonoid.ts exports and the Composable operation builder are imported only by their own tests. StringDelimited is unlawful (nlp/src/Algebra/Monoid.ts:223-243), several numeric instances are lawful only on restricted domains, and Composable.compose unions the error and requirement channels (nlp/src/Operations/Composable.ts:528-545), so its hom-sets do not form a category. Upstream effect 4.1.5 covers 14 of the instances through effect/Combiner and effect/Reducer and has no HashSet reducer. P6 therefore reads absorbs as replaced by: both modules and their tests are deleted, the one arrow is rewritten at fixed channels in np/src/Operation.ts, and the only instance P6 needs, the activity-log union, is written as ActivityLogReducer = Reducer.make(HashSet.union, HashSet.empty()) beside withActivity (effect Reducer.ts:120, HashSet.ts:132,363). It gets no law test and no ledger row because its laws are upstream behaviour with no named bug (SPEC Constraints, laws need a named bug). This answers O3, O13 and F2.
