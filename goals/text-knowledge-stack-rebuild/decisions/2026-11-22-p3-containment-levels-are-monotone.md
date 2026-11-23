---
title: "P3: containment needs a non-decreasing level under strict inclusion and a lower level on equal spans"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Return to levels as an equal-span tie-break only, by a decision file with the L2-5 row"
---

Amends decision `p0-structure-kinds-carry-containment-levels`. Under the design rule a `Word` whose range strictly includes a `Sentence` contained it, because levels were consulted only on equal spans. Now `outer` contains `inner` when `outer`'s range covers `inner`'s and `outer.level <= inner.level`, with `outer.level < inner.level` on equal spans. Extraction kinds and multi-target annotations still take no part. The relation stays a strict order: over 200,000 random triples of ranges and levels it was irreflexive, asymmetric and transitive with no counterexample. Ledger row `L2-5` reads "containment is a strict order: range inclusion with a non-decreasing level, and the lower level on equal spans".
