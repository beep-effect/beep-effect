# Resolver probe 001

Dev replay of all 538 selected claims on `c0c05364a7d` plus the restated-preamble commit. These are
not gate measurements. The probe is an uncommitted patch, kept as
`resolver-probe-001.script.py.txt`. It feeds gold trees through the real pipeline, by claim text, and
is never part of production code.

## What the probe does and does not measure

The probe injects gold elements, terms, and part-of, functional and depends-on-element edges. Only
antecedent edges, and the dependencies derived from them, are recomputed. Figures for the injected
layers say nothing about those layers. Strict counts are upper bounds with structure handed in.

| Input | Strict | Retained lost |
| --- | --- | --- |
| Current trees | 48/538 | n/a |
| Gold root trees only | 59/538 | 0 |
| Gold trees on every claim | 99/538 | 17 |

With gold trees, 383 of 439 failures carry a single defect type, antecedent or depends-on-element.
The current route is also far from gold on structure (part-of 641/1437, functional 408/1230), so
neither layer reaches 270 alone.

## Missed antecedent classes with gold trees

| Count | Class |
| --- | --- |
| 644 | definite reference, no predicted edge |
| 345 | predicted definite edge, no gold edge (mostly `the X` to an earlier `the X`) |
| 141 | bare reference, no predicted edge |
| 130 | definite reference bound to an earlier mention, not the gold introducer |
| 88 | `said` reference, no predicted edge |
| 50 | predicted edge from an indefinite dependent preamble |

## Variants measured

| Variant | Real strict | Lost | Gold-tree strict | Lost |
| --- | --- | --- | --- | --- |
| Nearest local introducer | 49 | 0 | 102 | 0 |
| In-order modified head, any length | 48 | 0 | 109 | 2 |
| Both, multi-word heads only (adopted) | 49 | 0 | 110 | 0 |
| Also matching when the introducer is the shorter head | 48 | 0 | 105 (with nearest local) | 10 |
| Drop all definite-to-definite links | 47 | 1 | 139 (with both rules) | 9 |
| Drop local definite-to-definite links | 48 | 0 | 116 (with both rules) | 7 |
| Drop subject-derived depends-on-element | 41 | 13 | not meaningful, edges are injected | n/a |

The gold-tree figure of 202 for dropping subject-derived dependencies is an injection artefact. Gold
dependencies stay in the input, so nothing can be lost there. Only the real replay counts for it.

## Adopted rules: cost and alerts

Real replay, main to candidate: strict 48 to 49 with 0 lost, gaining `14262251-root-1/4`; matched
edges 2559 to 2617; predicted edges 6093 to 6359. That is 266 new predicted edges with 58 matching,
so edge precision falls.

Finding counts over the 538 corpus are identical before and after. All 538 claims still abstain as
policy-uncovered, so no alert reaches a user on this corpus today. That leaves alert precision itself
untested: the precision cost could surface once abstention lifts.

| Finding | Before | After |
| --- | --- | --- |
| chain-work-limit | 4174 | 4174 |
| definite-without-introduction | 2687 | 2687 |
| unsupported-determiner | 2575 | 2575 |
| source-role-unresolved | 567 | 567 |
| outside-chain | 363 | 363 |
| multiple-introductions | 254 | 254 |
| source-index-incomplete | 229 | 229 |
| determiner-number-mismatch | 65 | 65 |
| ordinal-variants | 38 | 38 |

## Next open lever: definite-to-definite links

Gold-tree strict reaches 139 without these links, the largest resolver gain measured, but removing
them loses retained claims. Counting definite repeats within a claim whose earlier mentions are all
definite, 37 of 52 families never link them (229 repeats), 4 always do (8), and 11 are mixed (48
linked, 64 not). No source-level discriminator is known yet. A family habit is not one: rules may
not look at fixtures.
