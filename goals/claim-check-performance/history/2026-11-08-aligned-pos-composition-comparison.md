# Accepted POS fallback and closed-composition integration

The ordinary merge of accepted main `aa2e0f4eb1f` retained the separate component
census and POS fallback repair from PR #2975. The generated decision histories
and research projection were combined without changing goal gates. Accepted
main also brought the citation tests from PR #2982 and their newly tracked
coverage floors; this lane did not lower any existing floor.

Source review caught a composition compatibility bug before predictions. The
closed-composition guard compared the grammar object with the original
inspection grammar. The POS variant creates a spread copy, so that identity
check excluded it. Commit `1fbb06f96237e9ccc4a4e7944e53958a7cca1323` replaces
only that condition with an internal inspection capability: false in the
strict grammar, true in inspection, inherited by the POS variant. The exact
three-term, anchor, determiner, predicate, coordinator and closed-tail guards
remain unchanged. No claim-specific exception or public schema was added.

The public synthetic regression exercises aligned POS evidence on an actual
fallback route and checks the three source mentions, limitation classification
and absence of a functional edge. The existing strict control remains. Both
focused test files passed 20 tests, Biome passed, and the package source and
compiler-only test checks passed. The test compiler check finished before a
later instruction to narrow verification; no corpus/provider run occurred in
that check.

The fresh runtime closure is
`884932c5920dd9e54f55a6fc8ead3a1137dbc461cb199f59f111338226e76c6a`.
It preserves all 1,845 file paths, 1,544 runtime input paths, 94 lexical asset
pins, Bun identity and work caps. Relative to the retained runtime, changed
pins are the implementation, two accepted-main test assertion files and the
accepted-main schema inventory. The metafile hash reflects changed source
bytes. The earlier integration freeze remains retained and unexecuted because
source review found the identity bug before its prediction admission.

| Unchanged scorer measurement | Retained baseline | Combined repair |
| --- | ---: | ---: |
| Selected claims / families | 538 / 60 | 538 / 60 |
| Complete strict structures | 48 | 49 |
| Previous 48 strict identities retained | 48 | 48 |
| Scorer-matched elements | 755 | 870 |
| Scorer-matched edges | 2,162 | 2,351 |
| Parsed | 537 | 537 |
| Abstained | 538 | 538 |

The additional strict claim is `14659462-root-1:6`. There are no mandatory
losses. The scorer reports 327 changed selected rows; partial component counts
are neither strict accuracy nor legal alert precision/recall. All 60 complete
source collections and all 1,219 full-context qualification records match the
retained baseline. Same-run service and prediction reports agree in all 60
families. The 121 new outputs are sealed separately and every later candidate
must preserve all **49** passing identities.

Original preservation verifies all 1,213 bindings unchanged. Historical
preservation verifies 2,382 recorded artifact files in 26 anchored groups,
with zero changed or unknown files. The original 0/538 result, every later
measurement and the failed private method-step candidate remain intact.

The full private measurement is retained in
`~/.cache/beep/claim-check-performance/product-accepted-pos-integration-002/`,
with receipts in `accepted-pos-integration-evaluation-002/` and the future
retention manifest `accepted-pos-integration-strict-identities-002.json`.
Aggregate metadata is published in
[aligned-pos-composition-measurement-001.json](../research/aligned-pos-composition-measurement-001.json).

This is development progress, not goal completion. Strict recovery is about
9.1%, all 538 selected claims still abstain, and the separate final cohort and
substantive-alert usefulness gates remain unproved. Hosted exact-head CI and
PR readiness are separate delivery requirements.
