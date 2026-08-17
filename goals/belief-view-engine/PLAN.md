# PLAN — Belief View Engine

Mutable execution plan. `SPEC.md` is normative.

## P0 — Research (COMPLETE at graduation, 2026-08-17)

Inherited whole from `explorations/epistemic-belief-view-revision`: BRIEF (ratified with
amendments), all align decisions, the MAP ratified with adversarial
amendments, and the 8-lane adversarial review reports. See
`research/SOURCES.md`.

## P1 — First vertical slice

Schema first: contention key + policy revision + revision/digest v1 +
delta — then the scope-read repository contract (index + cap + typed
overflow), then the engine service. Proof fixtures: golden replay across a
live supersession, the evidenceScope two-lineage set, the knownAt shift,
cap overflow, and the same-policy delta trio.

## P2 — Yeet: PR to mergeable

`bun run beep yeet repair → verify → publish --pr → monitor` until
`merge-ready: yes`.

## P3 — Close

`/reflect` closeout; flip lifecycle in the same PR as final work. Fired MAP
gates reopen the parent exploration at decompose — they never extend this
goal.

## Current blockers

Paused at scaffold (queue goal): resume when a lane slot frees or the
roadmap pulls it.
