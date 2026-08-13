# @beep/shared-use-cases

Contract-only use-cases package for the `shared` slice.

## Promotion record: PromotionGate

- **Date promoted:** 2026-08-13.
- **Shared product semantics:** any candidate-output boundary may ask whether an
  opaque product subject is clear or blocked before promotion, without learning
  the vertical policy that produced the verdict.
- **Current consumers:** `@beep/agents-use-cases` consults the port before
  accepting candidate outputs; `@beep/law-practice-server` adapts the derived
  candor predicate to it.
- **Rejected homes:** agents cannot own a port implemented by law-practice;
  law-practice cannot be imported by agents; `foundation/capability` cannot own
  product semantics under `standards/ARCHITECTURE.md`.
- **Surface:** `@beep/shared-use-cases/PromotionGate`.
- **Runtime limits:** contract and service tag only; no workflow, live Layer,
  driver, or vertical vocabulary.
- **Coupling acceptors:** successor packet owner sign-off and PR review.
- **Removal trigger:** retire when candidate promotion is replaced by a shared
  command/event contract that no longer needs synchronous refusal.
