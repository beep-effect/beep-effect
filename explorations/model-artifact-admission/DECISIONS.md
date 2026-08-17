# Decisions

## 2026-08-17 — Align closed: assurance floor, requal matrix, disposition

All three align questions ratified by the operator in one grilled round,
accepting the research recommendations as drafted.

**A1 — Identity-assurance floor per role and data class (ratified).**
Ladder: `provider-pinned` > `provider-resolved-alias` > `alias-only` >
`opaque-deployment`. Matter/client-data roles: minimum
`provider-resolved-alias`, `provider-pinned` preferred; `alias-only`
forbidden — this is a reproducibility requirement (know which model touched a
matter), not a provider restriction. Non-matter internal tooling: minimum
`provider-resolved-alias`; `alias-only` admissible only as `restricted` with
short expiry. Lab/experimental: any strength including `opaque-deployment`,
always `restricted`, never eligible for matter data.

**A2 — Requalification matrix (ratified, conservative as drafted).**
FULL suite when: hosted identity changes or assurance downgrades; base
artifact, tokenizer, adapter/PEFT payload, or enabled modality set changes;
tool-wrapper execution semantics, capability/permission boundary, system
policy, output parser, or safety guardrail changes; evaluator/verdict logic
or hazard-altering corpus changes; or a multi-component delta cannot be
isolated. BOUNDED delta only when the unchanged parent is exactly identified,
the component diff is machine-computable, an impact model names the affected
tests, and the invariant sentinel suite over all previously qualified hazard
classes passes. Any unexpected sentinel regression escalates to the full
suite. Evidence may be reused; dispositions are never inherited.

**A3 — `ModelArrangementDisposition` semantics (ratified).**
Statuses: `admitted | restricted | rejected | expired | superseded`.
`restricted` carries explicit eligible roles, modalities, data classes, and
operational constraints. No scalar trust score. The disposition is a distinct
immutable record referencing a completed qualification;
`supersedesDispositionId` closes a prior scoped admission only via an
explicit human disposition; `expired` is recorded by a maintenance
disposition when the recheck trigger fires — a new record, never silent
mutation; expired/superseded dispositions remain queryable; rollback is a new
adoption event referencing the exact prior admitted arrangement; as-of
queries use the epistemic core's two-axis half-open semantics. Admission
grants scope eligibility only — it is never an `ExecutionVerdict` and never a
release.
