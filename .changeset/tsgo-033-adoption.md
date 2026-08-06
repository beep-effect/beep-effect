---
{}
---

No release: adopt `@effect/tsgo` 0.33.0 and make the diagnostic surface explicit.

The wrapper (0.19.0) and the seven platform binaries (0.24.3) had drifted apart
because only the wrapper was in syncpack's held-back group. The binaries are the
half that decides behaviour: `effect-tsgo patch` copies one over
`@typescript/typescript-<platform>/lib/tsc`, so the platform pin *is* the
compiler `bun run check` runs. Both now move together at 0.33.0 and the
hold-back covers all eight.

`diagnosticSeverity` in `tsconfig.base.json` is not a list of opt-ins — rules
omitted from it run at their upstream default. All 95 rules the compiler ships
are now listed, so silence in that file means a decision rather than an
inherited default. `floatingEffectInVitest` is enabled at `"error"`; the other
eleven new rules are parked at `"off"` and ratchet to `"error"` one per PR.

Enabling `floatingEffectInVitest` fixed 80 tests that never ran:
`it("...", () => Effect.gen(...))` returns an Effect Vitest does not execute, so
those bodies and their assertions were skipped while reporting as passing.
Running them surfaced a stale upstream error string, a docgen fixture that could
not exercise its own premise, and two secure-header defects that are pinned to
actual behaviour with comments pending their own change.
