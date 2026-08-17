# Map — Epistemic Belief View Revision

Status: RATIFIED BY OPERATOR 2026-08-17 with the four adversarial-review
amendments below (8-lane grok+codex review; reports in
`research/2026-08-17-adversarial/`).

## Ratification amendments (2026-08-17)

- **A. Digest encoding v1 is part of the slice.** The revision digest
  specifies: a version prefix, the exact field set, epoch-millis time
  encoding, and sort keys for cuts, contention sets, candidate ids, and
  reasons. The authority cut is digested over rows **projected through the
  triage `projectEdgeVersionAtKnownAt` pattern**, so the mutable `expiredAt`
  column (rewritten in place by live supersession) never enters the digest —
  this is the replay-poison fix; extending `asOfWhere` alone copies the leak.
  `ClaimProjection` is cited only as the sorted-fold precedent, not as the
  byte-equality proof standard.
- **B. The scope-wide read ships WITH its supporting index and a hard result
  cap** returning a typed view-too-large error. No pagination — a paged view
  digests a different object and breaks cut consistency. Matter semantics:
  a matter request selects `matterScope ∈ {None, Some(matter)}`; an org
  request selects all. (The org index was dropped in migration
  `20260813143745`; the new index is part of the slice's change tree.)
- **C. The v1 typed delta is defined only between two revisions sharing a
  selection-policy revision**; differing policies yield a typed error.
  Cross-policy diffing is deferred to a reopened decompose — resolving the
  DECISIONS-vs-research ambiguity by removing it from v1.
- **D. Verdict-family ownership-law propagation happens at graduation (this
  ceremony), to the owning surfaces** — per the operator's BRIEF amendment;
  the earlier "at scaffold, inside the packet" wording was a drafting error.

Per the prospective-path rule, gated candidates stay slug-only until their
gate fires. Candidate 1 was ratified and scaffolded in the graduation PR.

## Candidate Goal Packets

| Order | Proposed slug | Mission | Dependencies | Live capability composition |
| --- | --- | --- | --- | --- |
| 1 | [`belief-view-engine`](../../goals/belief-view-engine/README.md) (scaffolded paused 2026-08-17) | Deliver the ratified on-demand belief-view contract (as amended above): `BeliefContentionKey` v1 (authority identity minus `evidenceScope`, qualifiers in, versioned), the total selection-policy contract (`SelectedBelief` \| `BeliefAbstention` with the four-reason kit), the content-addressed `BeliefViewRevision` key, the typed delta, and the one server-side addition — a scope-wide EdgeAuthority read: every lineage whose version interval contains the `(validAt, knownAt)` cut under the half-open `asOfWhere` predicate (never the live-head "open" predicate), with amendment B's supporting index and hard cap. The verdict-family ownership law was propagated to its owning surface (`standards/architecture/GLOSSARY.md`) at graduation, per amendment D — not by this goal. | Epistemic slice only; no external gates. Consumes triage read models untouched. | Reuse `LogicalEdgeIdentity`/`EdgeVersion` (identity + bitemporal axes), the `EdgeAuthority` repo's half-open predicate (`asOfWhere`) extended with the NET-NEW scope-wide read, `ClaimProjection` as the sorted-fold precedent only (amendment A: not the byte-equality proof standard), `ContradictionTriage` read models as abstention inputs, `LiteralKit` for reasons. NET-NEW: contention-key value, policy revision schema, revision-key digest, delta derivation, engine service. |
| 2 | `belief-view-materialization` (not yet created; **gated**) | Materialized revision cache + `BeliefViewMaterializationLineage`, obeying the same replay contract. | `belief-view-engine`. **Gate (ratified A3):** a real consumer needs revision listing without replay cost. | Reuse the engine's revision key and the prunable-projection retention class from research. |

## Dependency Edges

```text
belief-view-engine
  -> belief-view-materialization   (gated: listing-without-replay consumer)
KSA / triage / core: consumed read-only; no edges modified
```

## Chosen First Vertical Slice

The scope-wide EdgeAuthority read + contention grouping + one total policy
(`sole-candidate` selection, `unresolved-contradiction`/`policy-tie`
abstentions) + the revision key, proven three ways:

- byte-identical replay: same request, policy revision, and authority cut
  produce an identical revision key and object;
- a two-lineage contention set (differing only by `evidenceScope`) groups
  under one key and selects or abstains deterministically;
- a `knownAt` shift produces a **different** revision (late-arriving
  authority handled by the axis, never by mutation).

Not in the slice: materialization, lineage records, the full policy
vocabulary, any UI, any triage change.

## Inherited Constraints (binding)

- No authority writes, no `SUPERSEDES`, no contradiction resolution.
- No wall-clock or materialization-dependent data in the revision digest.
- Every policy input must be as-of queryable or excluded from v1 policies.
- Vocabulary extends only through a new immutable policy revision.
- Verdict-family ownership law: the view owns none of the consumed semantics.

## Re-entry Gates

- Materialization gate above reopens this packet at decompose.
- A qualifier-partition policy need mints `keyVersion` 2 through the same
  reopened decompose, never an in-place redefinition.
