# @beep/shared-use-cases

Contract-only use-cases package for the `shared` slice.

## Promotion record: PromotionGate

- **Date promoted:** 2026-08-13.
- **Shared product semantics:** any candidate-output boundary may ask whether an
  opaque product subject is clear or blocked before promotion, without learning
  the vertical policy that produced the verdict.
- **Current consumers:** `@beep/agents-use-cases` consults the port before
  accepting fixture-proof candidate outputs; `@beep/law-practice-server`
  adapts the derived candor predicate to it. No production acceptance
  composition root exists yet, so this record does not claim live protection.
- **Why a command, event, query, or facade is insufficient:** candidate
  acceptance needs a synchronous, fail-closed answer immediately before it
  returns the accepted output. An event would be too late, while a shared
  command/query/facade would either own a cross-slice workflow or expose the
  law-practice operation instead of the minimal product decision.
- **Rejected homes:** agents cannot own a port implemented by law-practice;
  law-practice cannot be imported by agents; `foundation/capability` cannot own
  product semantics under `standards/ARCHITECTURE.md`.
- **Surface:** client-safe schemas at `@beep/shared-use-cases/PromotionGate`;
  server-only `PromotionGate` service tag at `@beep/shared-use-cases/server`.
- **Runtime limits:** contract and service tag only; no workflow, live Layer,
  driver, or vertical vocabulary.
- **Coupling acceptors:** repository owner `@kriegcloud` owns both consuming
  slices under `.github/CODEOWNERS` and accepted their coupling by requesting
  completion of this successor; review sign-off is recorded in
  [PR #699](https://github.com/beep-effect/beep-effect/pull/699).
- **Removal trigger:** retire when candidate promotion is replaced by a shared
  command/event contract that no longer needs synchronous refusal.
