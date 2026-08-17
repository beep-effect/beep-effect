# PLAN — Model Arrangement Admission Core

Mutable execution plan. `SPEC.md` is normative.

## P0 — Research (COMPLETE at graduation, 2026-08-17)

Inherited whole from `explorations/model-artifact-admission`: BRIEF (ratified with
amendments), all align decisions, the MAP ratified with adversarial
amendments, and the 8-lane adversarial review reports. See
`research/SOURCES.md`.

## P1 — First vertical slice

Schema first: the four kits, identity envelope, revision digest,
qualification envelope, disposition — then the server-side digest builder
(driver values injected), then the fixture admission end to end with the
four proofs (digest stability, no-inheritance, restricted+as-of flip,
referential integrity).

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
