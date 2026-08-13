# Research — Epistemic Belief View Revision

> Stage-1 synthesis authored 2026-08-13. The lane reports carry the detailed
> file:line evidence; this file synthesizes the research and routes the align
> frontier. Candidate verdict-family names are proposals, not decisions.

## Lane artifacts

1. [`research/01-live-contracts-and-drift.md`](./research/01-live-contracts-and-drift.md) — shipped core, projection precedent, contention-key gap, and triage boundary.
2. [`research/02-verdict-family-candidates.md`](./research/02-verdict-family-candidates.md) — proposed canonical names and ownership law.
3. [`research/03-view-composition-and-revision.md`](./research/03-view-composition-and-revision.md) — deterministic composition, revision, and retention semantics.

Provenance ledger: [`research/SOURCES.md`](./research/SOURCES.md).

## What the research says

The core already provides the exact authority seam a view needs: immutable
versions, time-independent logical identity, two half-open temporal axes, and
atomic supersession. A view should be a pure consumer of an authority cut at
`(validAt, knownAt)`, never another way to close or mutate a lineage.

The important newly grounded gap is grouping. `LogicalEdgeIdentity` includes
`evidenceScope`, so competing evidence-scoped assertions are distinct authority
lineages. Selecting only within a `LogicalEdgeKey` cannot answer the product
question. Research therefore proposes a projection-owned, versioned
`BeliefContentionKey` that groups complete authority identities without
redefining them. Its dimensions remain an align decision.

The proposed shared verdict-family names are:

- `ShapeValidationResult`
- `AnchorVerificationResult`
- `SemanticStance`
- `SourceAuthorityAssessment`
- `HumanDisposition` as the family stem, with domain-qualified concrete types
- the already-live `ExecutionVerdict`
- `ReleaseDisposition`

This vocabulary intentionally does not force every concern under a `Verdict`
suffix. Validation results, semantic classifications, scoped assessments,
human dispositions, action authorization, and release decisions have different
owners and consequences.

## Proposed view/revision contract

A view request names principal, scope, `(validAt, knownAt)`, and a policy
revision. The deterministic engine groups candidates, then emits one selected
edge version or a typed abstention per contention set. A revision key is a
content digest over the request, policy revision, authority cut, and canonically
ordered results; a parent key supplies causal ancestry. Any semantic input
change creates a new revision. Old revisions rebuild at their original
`knownAt`; later knowledge creates a new revision rather than rewriting one.

Materialized revisions are prunable projections. Edge/evidence authority,
human dispositions, contradiction resolutions, policy revisions, and human
overrides remain retention-bearing authority. A future human adoption of a
view must be a separate durable disposition referencing the view key.

## Triage boundary

The active contradiction-triage lane must not grow a view mechanism. Its live
`ContradictionBeliefView` is only an unranked DTO for each exact side, and the
RPC explicitly says neither side is preferred. Triage resolves lineages through
recorded disposition plus core supersession; views rank/select among the open
authority visible after those operations. Research coordinates with those
contracts and duplicates none of them.

## Contradictions and drift

- The capture's “one per logical lineage” is under-specified against live code
  because evidence scope partitions authority lineages.
- The live triage DTO uses “BeliefView” naming despite the goal's no-view
  boundary; source proves it is presentation-only and unranked.
- The deterministic `ClaimProjection` precedent and triage read models are
  useful live capabilities absent from the original capture.

## Open questions carried to align

1. Which proposed verdict-family names and owners should the epistemic goal
   family ratify?
2. Which fields define `BeliefContentionKey`, and which qualifiers are always
   comparison partitions?
3. What is the minimal selection-policy and abstention vocabulary?
4. Should first delivery materialize prunable revisions or compute them on
   demand behind the same content-addressed replay contract?

