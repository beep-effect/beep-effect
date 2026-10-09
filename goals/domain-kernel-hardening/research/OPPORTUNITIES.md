# Tooling friction receipts

## 2026-10-09 — heavy admission environment

- Doing: P0 dependent typecheck through `beep-heavy`.
- Evidence: first invocation exited 1 before launch: `XDG_RUNTIME_DIR not defined`.
- Attribution: environment-only; this shell omitted the user-manager bus environment.
- Remedy: set `XDG_RUNTIME_DIR=/run/user/1000` and the matching user bus address on heavy invocations.
- Prevention: initialize these variables in the lane execution environment.

## 2026-10-09 — dependent check admission queue

- Doing: P0 blast-radius measurement before authoring the activation PR.
- Evidence: `beep-heavy` repeatedly reports `all 3 slots busy, waiting`;
  `lslocks` confirms all three machine-wide slot locks have live holders.
- Attribution: shared-capacity queue, not a compiler failure; no result yet.
- Prevention: expose queue position and wait duration in the shared wrapper.
  Preserve current slot count and memory caps; another lane's work is not interrupted.

## 2026-10-09 — variant default mapper inference

- Doing: compare FieldOption with constructor defaults during P0.
- Evidence: the curried fieldEvolve mapper widened model services to any;
  the dependent run produced cascading missing-context errors, starting at
  `Worker.model.ts:70`. EntityKit also had `effect(unnecessaryPipeChain)`.
- Attribution: introduced prototype defects, not a measured consumer requirement.
- Remedy: use data-first Model.fieldEvolve with contextually typed field mappers
  and a single pipe; rerun before treating the diagnostic count as blast radius.
- Prevention: demonstrate the concrete service-free type for variant combinators
  in a small compiler example before the dependent graph run.

## 2026-10-09 — admission slot configuration drift

- Doing: submit the corrected P0 comparison through the existing wrapper.
- Evidence: wrapper now reports `all 4 slots busy, waiting`; the brief described
  three, while live locks also showed a fourth slot.
- Attribution: external workstation configuration changed during the run.
- Action: keep using the canonical wrapper; this lane changes no slot or memory
  cap, and still runs at most two own heavy jobs.
