---
title: Annotation law generators mint every dependent id while building, so nothing is filtered
date: 2026-11-23
reversal: Generate annotations and documents from free arbitraries and filter samples through the schema checks and the checked decode.
governs:
  - test/support/generators.ts#documentCase
  - test/support/generators.ts#mergeTripleCase
  - test/support/generators.ts#isForeign
enforcedBy: []
---

Package mirror of goal decisions `p3-text-arbitraries-in-src` and `p3-target-annotation-vocabulary`. Text, scalar ranges, captures and anchors rows come from `@beep/text/Arbitrary`; the annotation generators build annotations and documents over them.
Every dependent value (occurrence, annotation and run ids) is minted through the preimages' synchronous twins, over the platform SHA-256, while the value is built, so a generated document passes the schema checks and the checked decode by construction; nothing is filtered.
A relation's one target is its own evidence occurrence, drawn independently of its endpoints' occurrences, and a coreference cluster targets the union of its members' targets.
Time is drawn once per activity, so each (content, activity) pair has one time.
The foreign-capture window of a merge triple is four values in the middle of 0..99: the integer arbitrary favours its bounds, so a window at either end would be drawn far more often than four times in a hundred.
Rejected: filtered arbitrary documents, whose ids almost never match their content, so nearly every sample would be discarded.
