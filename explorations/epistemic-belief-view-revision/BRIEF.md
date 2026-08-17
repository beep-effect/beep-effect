# Brief — Epistemic Belief View Revision

Status: DRAFT FOR OPERATOR BRIEF REVIEW 2026-08-17 (align closed same day).

## Problem

The shipped epistemic core answers "what authority is open at
(`validAt`, `knownAt`)" and triage resolves contradictory lineages — but
nothing selects **one working belief per contention set** for a principal and
scope. Consumers that need a working view today would each invent their own
ranking, off-contract and non-replayable. Meanwhile `evidenceScope` sits
inside `LogicalEdgeIdentity`, so two assertions differing only by scope are
two lineages and "one per lineage" is not even expressible without a
projection-level grouping key.

## Appetite

One bounded machinery cycle: the contention-key value, the selection-policy
contract, and an on-demand deterministic view engine over the live two-axis
authority read — no storage, no UI, no triage changes.

## Solution Sketch (fat-marker)

1. **`BeliefContentionKey` v1 (ratified).** Versioned digest over authority
   identity minus `evidenceScope` (qualifiers stay in). Groups open
   candidates for selection; never redefines authority identity.
2. **Total policy contract (ratified).** Immutable
   `BeliefSelectionPolicyRevision`; per contention set the policy returns
   `SelectedBelief { edgeVersionId, reasons }` or
   `BeliefAbstention { candidateIds, reason }` with the minimal four-reason
   abstention kit. Vocabulary changes require a new policy revision.
3. **Deterministic revision key (ratified frame).** Digest of request
   (principal, org/matter scope, `validAt`, `knownAt`), policy revision,
   authority-cut digest, and canonically ordered selections/abstentions. No
   wall-clock, no materialization parentage.
4. **On demand only (ratified).** Compute revisions behind the replay
   contract; typed delta (`selected`/`replaced`/`abstained`/`resumed`)
   derives from two recomputed revisions. Materialization is a later cache.
5. **Verdict-family law (ratified).** The view consumes `SemanticStance`,
   `AnchorVerificationResult`, `SourceAuthorityAssessment`, dispositions —
   and owns none of their semantics.

## Rabbit Holes

- Contention-key scope creep: qualifier partitions belong to a future
  `keyVersion`, not v1.
- Policy DSLs: v1 policies are code implementing the total contract, not a
  rules language.
- Delta storage: deltas derive from revisions; storing them invites a second
  ledger.
- Triage entanglement: unresolved candidates are a typed abstention input,
  never a review call or supersession path.

## No-Gos

- No authority writes, no `SUPERSEDES` edges, no contradiction resolution
  from the view path.
- No wall-clock or materialization-dependent data in the revision digest.
- No preferred-view reuse of triage's `ContradictionBeliefView` (naming
  collision only; it is an unranked read model).
- No centralized verdict vocabulary across domains (ownership law).
- No secret-bearing inputs in a view or its digest.
