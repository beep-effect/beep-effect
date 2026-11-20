---
title: "P1: PR C's term snapshot is release 2.0.0 after PR B's 1.0.0, and the gate refuses an understated release"
date: 2026-11-20
lane: "goals/text-knowledge-stack-rebuild-p1c-bindings"
reversal: "Delete ReleaseUnderstated from snapshotViolations and its lint mapping, and regenerate PR C's snapshot from the empty base at 1.0.0 with since 1.0.0 rows, by a decision file that also rules PR B and PR C merge as one."
---

This reverses point 1 of `2026-11-20-p1-merging-pr-b-into-pr-c-keeps-the-first-snapshot-at-1-0-0-only-a-retired-namespace-iri-is-succeeded-by-a-namespace-iri`. Points 2 to 4 of that decision stand.

PR B (#3439) merges to `main` before PR C, and it publishes the first term snapshot at release 1.0.0: 374 terms, no bindings and no deprecations. Point 1 regenerated PR C's snapshot from the empty base, which also produced 1.0.0, but with 545 terms, 23 bindings and 113 deprecations. Two different term sets would then have shipped under one release number.

1. **Release.** PR C's snapshot is regenerated against PR B's published 1.0.0 snapshot with `bun run beep identity registry --write`. It adds deprecations, so the generator gives the major bump, 2.0.0. The 136 `since` values in the research-library and vitest shards (23 bindings, 113 deprecations) say `2.0.0`. `RegistryData.test.ts` asserts release 2.0.0 and that every row records since 2.0.0.
2. **Gate.** The term-stability gate refused a release below its base but accepted a changed term set at the base's own release, so `lint identity-registry --base <PR B head>` passed the 1.0.0 snapshot. `snapshotViolations` now reports `ReleaseUnderstated`: the rows changed, and the release is lower than the one the change calls for (the release the generator computes from the base). That is a minor bump for additions, a major bump for a new deprecation, and 1.0.0 after the empty snapshot. A head can still be above that release, because a branch may cross several regenerations before it merges. The lint maps the new violation to `release-regressed`, and the remedy is to merge the base and regenerate.
   - Proof: against PR B's head snapshot, the pre-fix 1.0.0 snapshot reports `ReleaseUnderstated` (base 1.0.0, expected 2.0.0, release 1.0.0). The regenerated 2.0.0 snapshot reports nothing.
   - Tests: `Term.test.ts` (an addition, a new deprecation, an unchanged set, the empty base) and `TermStability.test.ts` (L0-3: a change to the committed shards at the committed release).
