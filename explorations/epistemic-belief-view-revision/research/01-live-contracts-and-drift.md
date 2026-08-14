# Lane A research — live contracts and boundary drift

Date: 2026-08-13

## Authority surface inherited from the shipped core

The shipped authority is not a generic graph snapshot. `LogicalEdgeIdentity`
defines one lineage by endpoints, relation, organization, optional matter,
optional evidence scope, and qualifiers; time is deliberately excluded
([`LogicalEdgeIdentity.model.ts:249-294`](../../../packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts#L249)).
Each `EdgeVersion` then carries the immutable fact, its `logicalKey`, both
half-open temporal axes, and `supersedesId`
([`EdgeVersion.model.ts:119-166`](../../../packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts#L119)).

The repository implements the canonical query as
`validFrom <= validAt < validTo` and
`recordedAt <= knownAt < expiredAt`
([`EdgeAuthority.repo.ts:132-145`](../../../packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts#L132)).
Supersession locks the current transaction-time head, closes it, and inserts a
replacement whose `supersedesId` points to that head
([`EdgeAuthority.repo.ts:336-378`](../../../packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts#L336)).
Those are the view engine's authority inputs; a view must not write through or
reinterpret them.

The live repo already contains a smaller projection precedent:
`ClaimProjection` is a pure read-only fold with no write capability
([`ClaimProjection.ts:24-50`](../../../packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts#L24)),
and its implementation sorts admitted keys so the same authority rebuilds to a
structurally equal value
([`ClaimProjection.ts:71-104`](../../../packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts#L71)).
This transfers as a determinism pattern, not as the belief-view schema: the
existing projection counts lifecycle states and does not rank competing edges.

## The contention-key gap

The capture says a view selects one working assertion per logical lineage, or
abstains. The live identity contract reveals an ambiguity: `evidenceScope` is
part of `LogicalEdgeIdentity`
([`LogicalEdgeIdentity.model.ts:277-290`](../../../packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts#L277)).
Therefore two assertions that differ only by evidence scope are two authority
lineages. Grouping solely by `logicalKey` cannot select *among* them.

Research proposes a net-new, projection-owned `BeliefContentionKey`: a
versioned digest over the policy-declared comparison dimensions, normally the
authority identity with evidence scope excluded but never discarded from the
candidate record. This key groups immutable `LogicalEdgeKey` values for
selection; it does not redefine authority identity or authorize cross-lineage
supersession. The exact dimensions are an align decision because some policies
may also need qualifier-specific partitions.

## Coordination with contradiction triage

The triage SPEC is explicit: no preferred-view selection or working-view
recovery; detection does not mutate authority; an approved resolution composes
the core supersession path
([`SPEC.md:10-25`](../../../goals/epistemic-contradiction-triage/SPEC.md#L10),
[`SPEC.md:62-81`](../../../goals/epistemic-contradiction-triage/SPEC.md#L62)).
Its RPC does use the name `ContradictionBeliefView`, but the type preserves the
two canonical sides and explicitly marks neither preferred nor authoritative
([`ContradictionTriage.rpc.ts:207-241`](../../../packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.rpc.ts#L207));
the composed detail says it is a read model "without ranking"
([`ContradictionTriage.rpc.ts:254-274`](../../../packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.rpc.ts#L254)).

That name is a vocabulary collision, not a hidden view mechanism. This packet
must not reuse it as proof of preferred-view infrastructure. Triage owns
candidate lifecycle and lineage resolution. Belief views consume the resulting
open authority plus visible unresolved candidates and rank/select without
closing either lineage.

## Capture-to-live drift ledger

- **No authority drift:** the shipped core still has immutable versions,
  two-axis reads, and atomic supersession exactly as captured.
- **Capability growth:** the repo now has the deterministic `ClaimProjection`
  precedent and live contradiction read models; neither existed in the
  capture's composition map.
- **Naming drift:** triage now exports `ContradictionBeliefView`, but its own
  contract proves that this means one unranked side of a contradiction, not a
  preferred belief view.
- **Newly explicit gap:** because evidence scope participates in authority
  identity, a projection-level contention key is required before the capture's
  “one per lineage” phrase can become executable.

