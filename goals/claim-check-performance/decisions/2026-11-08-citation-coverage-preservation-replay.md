---
title: "Preserve measured runtime through citation coverage repair"
date: 2026-11-08
kind: checkpoint
lane: "feat/claim-check-census-composition"
pullRequest: 2980
reversal: "Revert the scoped CI repair while retaining every test, failed check, archived source and replay result."
---

The hosted coverage job at PR head 74c1f259bc2 identified uncovered citation dump/repr paths and package coverage below unchanged floors. Add focused public-surface tests and replace only the unreachable finite-integer encoder error mapper with Effect.orDie before parts.literal. The raw Input decoder validates and owns S.Int fields; malformed raw input retains invalid-input, and literal budget failures retain their error channel. Independent source review qualified this invariant. The initially proposed synchronous encoder failed TS377130 before commit and its failed check remains retained; the final form uses encodeEffect.

This is a CI behavior-preservation repair, not a numerical performance candidate. Before publication, commit the exact reviewed source/tests, capture a fresh runtime closure against the retained 48/538 freeze, require exactly the intended Dump.ts source change with unchanged inputs/assets/Bun/caps, run decoder rejection controls and the unchanged full538 replay in exclusive directories, require all48 identities and all60 canonical report payloads unchanged, then retain/seal every result. Do not change any reference, scorer, historical result, coverage floor, baseline, suppression or dependency. Package/full hosted coverage is still required; local coverage overlay is a projection only. No local audit/full-root queue, fresh source QA or new acquisition is authorized.
