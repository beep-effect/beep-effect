---
title: "Record quarantine overlap and coverage review follow-through"
date: 2026-11-14
kind: checkpoint
lane: "feat/citation-native-lane"
pullRequest: 3336
reversal: "Repeat these bounded proofs after changes; keep unchanged parent-runtime tests and all typed guards intact."
---

B1 remains in review as PR #3336, with this local wave based on b749cd91e7e.
Remove only Markup reap's aggregate quarantine reset; exact-record callbacks own
settlement. A/B real-child regressions fail with the old reset and pass for Bun
and Node children. The two-request composition proof forces both first children
to exist before either request proceeds; its exact peak-two assertion remains.

The owner-expanded coverage wave covers every reported reachable branch in six
regressed sources plus new NativeLane. Single-file reports merged with hosted
artifacts clear all reported floors; six typed invariant guards stay and are
reported with source/line arguments and measured values. No coverage baseline
edit, guard weakening, typed-refusal conversion or ignore directive.

Current proof: 79 green Node consumer/coverage files / 369 tests; 55 touched cases
also pass with a Bun parent. The three unchanged parent-runtime tests reproduce
six passes / 26 failures under Node and pass 32/32 under Bun. Census passes 4/4.
CanonicalFullSpan ran last: 12/12, 65.22 s, launch load 10.12 / 12.81 / 13.97;
291 regex children / ten lane claims per ten calls, construction unchanged.

Server check, quick verification, laws, scoped root oxlint, Biome, fallow,
Effect Vitest, schema-first, docgen and decision projections pass. Evidence lists
every file and coverage-path test. One EV003 per-request fixture exception is
reviewed under the standing invocation policy; unrelated inventory rows match
HEAD exactly. The owner publishes this local commit; no push, PR mutation,
rebase or stash operation.
