# Lane A research — view composition, revision, and retention

Date: 2026-08-13

## External frame

Event Sourcing's transferable claims are narrow but useful: derived state can
be completely rebuilt, temporal queries can reconstruct past states, and event
replay can account for retroactive or out-of-order changes
([Martin Fowler, “Event Sourcing”](https://www.martinfowler.com/eaaDev/EventSourcing.html)).
Datomic similarly distinguishes an `as-of` database value from the history
view rather than overwriting history
([Datomic, “See Historic Data”](https://docs.datomic.com/peer-tutorial/see-historic-data.html)).
AGM belief revision studies rational change to belief sets, but its abstract
operators do not supply this repo's principal, evidence, bitemporal, retention,
or audit contracts
([Huber, “Belief Revision I”](https://doi.org/10.1111/phc3.12048)).
Accordingly, AGM is vocabulary/background only, not a donor implementation.

## Proposed deterministic composition contract

Research proposes the following fat-marker contract for align:

1. A request names `principal`, organization/matter scope, `validAt`,
   `knownAt`, and an immutable `BeliefSelectionPolicyRevision`.
2. The engine reads authority only through the core's two-axis contract.
3. It groups eligible open versions by a versioned `BeliefContentionKey`, while
   preserving every candidate's `LogicalEdgeKey`, `EdgeVersionId`, evidence
   scope, and typed assessments.
4. A total policy returns either
   `SelectedBelief { edgeVersionId, reasons }` or
   `BeliefAbstention { candidateIds, reason }` per contention set.
5. Candidates and results are canonically sorted. The view revision key is a
   digest of the schema version, request, policy revision, authority-cut digest,
   and ordered selections/abstentions.

No wall-clock materialization timestamp belongs in that digest. Otherwise
dropping and replaying a projection cannot produce byte-identical output.

## Revision semantics

A new content-addressed `BeliefViewRevision` is produced when any semantic
input changes: the authority cut, a typed assessment/disposition visible at
`knownAt`, the selection-policy revision, principal/scope, or requested time
pair. It carries `parentRevisionKey` when a previous revision exists for the
same view series. The parent records causal comparison; it does not authorize
copy-forward of a prior winner.

Every candidate is re-evaluated under the named policy revision. A prior
selection may remain selected, change to another lineage, or become an
abstention. The revision should expose a typed delta (`selected`, `replaced`,
`abstained`, `resumed`) derived from the two complete revisions. It must not
mutate evidence, create a `SUPERSEDES` edge, or resolve a contradiction.

Late-arriving authority is handled by the existing `knownAt` axis. Rebuilding
an old revision uses its original `knownAt`; asking at a later `knownAt` creates
a different revision. This composes directly with the live half-open predicate
([`EdgeAuthority.repo.ts:132-145`](../../../packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts#L132)).

## Triage integration

Triage may expose unresolved candidates and later dispositions. A view policy
may use their typed presence as an abstention/ranking input, but must not call
triage review or core supersession. Once triage records a resolution and the
core changes authority, the next view revision naturally consumes that new
cut. This preserves the program law: triage resolves lineages; views rank or
select among open ones.

## Retention classes

- **Retention-bearing authority:** edge versions, evidence, human
  dispositions, contradiction dispositions, policy definitions/revisions,
  and any human override. Never reconstructed from the view.
- **Expirable operational evidence:** evaluation-run telemetry and caches,
  subject to a separately named policy.
- **Prunable projection:** materialized belief-view revisions, indexes, and
  deltas, because the content-addressed result can be replayed byte-identically
  from retained authority and policy revisions.
- **Prohibited secret-bearing inputs:** raw credentials or secret prompt
  material must never enter a view or its digest.

The view's causal ancestry is therefore deterministic projection data, not a
second authority ledger. If product requirements later demand a human-signed
adoption of a view, that adoption is a separate retention-bearing disposition
referencing the view revision key.

## Align decisions still required

- Ratify the shared verdict-family names and owners.
- Ratify the exact `BeliefContentionKey` dimensions.
- Decide the minimal policy vocabulary and abstention reasons.
- Decide whether view materialization is stored at all or initially computed
  on demand; both must obey the same replay contract.

