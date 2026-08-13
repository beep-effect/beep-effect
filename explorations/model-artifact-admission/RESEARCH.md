# Research — Model Artifact Admission

> Full stage-1 synthesis authored 2026-08-13. The lane reports contain the
> detailed source and file:line grounding; this file states the proposed answer
> to all three capture questions and routes the remaining align decisions.

## Lane artifacts

1. [`research/01-hosted-identity-boundary.md`](./research/01-hosted-identity-boundary.md) — substrate-independent hosted identity answer and live provider/runtime grounding.
2. [`research/02-admission-evidence-and-change-policy.md`](./research/02-admission-evidence-and-change-policy.md) — four-paper synthesis, evidence shape, and full/delta policy.
3. [`research/03-epistemic-lineage-and-drift.md`](./research/03-epistemic-lineage-and-drift.md) — disposition/lineage composition and capture drift.

Provenance ledger: [`research/SOURCES.md`](./research/SOURCES.md).

## Identity-boundary answer

Do not identify a hosted model with an unavailable weight digest. Identify the
whole executable arrangement with a content-addressed revision whose controlled
components are digest-bound and whose hosted component is the strongest
stable provider-attested identity envelope available: provider, service, and
deployment identity; requested and resolved pinned model IDs; alias-resolution
class; and explicit assurance level.

The arrangement key digests only that stable identity envelope plus the
controlled-component digests. Provider backend fingerprints/revisions,
observation timestamps, and request/response receipt identifiers are
non-identity execution observations: evidence records them by reference to the
arrangement identity, never inside its digest. `provider-pinned` is strongest;
resolved aliases can bind to the resolved ID; alias-only and opaque deployments
require narrower, expiring admission and cannot promise exact-model replay.
Alias movement to a different resolved identity creates a new arrangement
revision. Fingerprint churn does not force requalification, and per-request
fields do not mint revisions.

## Admission evidence answer

Qualification evidence should preserve the arrangement manifest and diff,
hosted identity attestation, frozen evaluation plan/corpus, per-case typed
results, clean utility, safety failures, scanners, adaptive holdouts, cost,
latency, deterministic invariants, evaluator versions, residual risks,
expiry/recheck trigger, and rollback target. Measures remain separate with
denominators; there is no scalar trust score.

Research proposes a scoped `ModelArrangementDisposition` with `admitted`,
`restricted`, `rejected`, `expired`, or `superseded`, plus principal, time,
rationale, evidence refs, and explicit restrictions. It is eligibility for a
role/scope, not action authorization or output release.

Every component change creates a new revision and disposition. Hosted model,
base/adapter/tokenizer/modality, tool/permission semantics, safety policy,
verdict logic, hazard-coverage, or interacting changes require full
requalification. A bounded delta suite is eligible only for an exact,
machine-computable controlled diff with a named impact set and a cross-hazard
sentinel suite; any surprise escalates to full. The corpus supports this
conservative structure but does not validate a complete invalidation algorithm.

## Disposition and lineage answer

Model admission owns its domain records; the epistemic core supplies immutable
lineage and two-axis history. Arrangement revisions, qualification evidence,
and human dispositions remain separate. Parentage never transfers admission.
Test results never mutate eligibility. Human supersession/expiry is recorded,
and historical dispositions remain queryable. Rollback references an exact
previously admitted arrangement through a new adoption event.

The core's closed `supports | refutes | contradicts` relation vocabulary must
not be widened ad hoc with “qualifies.” Model-specific lifecycle belongs in
model-admission-local schemas that can reference/core-compose without making
the epistemic core own model vocabulary.

## Capture contradictions and drift

- The Anthropic default is now a full pinned `claude-opus-4-6` ID, stronger
  than the capture's generic provider-ID description, though runtime overrides
  still require materialized identity capture.
- `ProviderInstance` remains token-safe as captured.
- Professional runtime provider/model strings are usage attribution, not a
  qualified arrangement identity; its approval gate remains downstream
  candidate review.
- “Exact artifact or provider version” must be conditional on provider
  attestation. Alias-only hosting cannot honestly satisfy artifact-exact replay.
- No live admission manifest, assurance vocabulary, qualification evidence,
  disposition, or validated delta algorithm was found.

## Open questions carried to align

1. Ratify the hosted identity-assurance vocabulary and minimum assurance per
   role/data class.
2. Ratify the full-versus-delta matrix and mandatory sentinel suite.
3. Ratify `ModelArrangementDisposition` names, restrictions, expiry, and
   supersession semantics without conflating admission, authorization, or
   release.
