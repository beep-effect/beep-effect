# Decisions

## 2026-08-17 — BRIEF ratified with amendments; advance to decompose

**Decision:** Operator signed off BRIEF.md with two amendments: (1) the
sketch names the one server-side addition — a scope-wide EdgeAuthority read
(all open lineages for org/matter at the two-axis cut), confirmed absent from
the live repository interface; (2) a new rabbit hole requires every policy
input to be as-of queryable or excluded from v1, and graduation must
propagate the verdict-family ownership law to its owning surfaces. Stage
advances to decompose; next gate is the MAP draft and operator MAP review.


## 2026-08-17 — Align closed: verdict family, contention key, on-demand views

All three align questions ratified by the operator in one grilled round,
recommendations accepted as drafted in `research/`.

**A1 — Verdict-family names and ownership law (ratified).**
`ShapeValidationResult`, `AnchorVerificationResult`, `SemanticStance`,
`SourceAuthorityAssessment`, `HumanDisposition` (family stem;
domain-qualified concretes such as `ClaimDisposition`), `ExecutionVerdict`
(live, unchanged), `ReleaseDisposition`. Ownership law: names may be shared,
vocabularies stay decentralized — structural verification lives with the
structure it verifies, human dispositions with the reviewed subject,
authorization at the enforcement boundary. A belief-view policy consumes
typed values from several families and owns none of their truth or
disposition semantics. Rejected: uniform `...Verdict`; the terser
`SourceAuthorityVerdict`/`ReleaseVerdict` hybrid.

**A2 — `BeliefContentionKey` v1 and minimal vocabularies (ratified).**
v1 key = versioned digest over authority identity with **only
`evidenceScope` excluded**: endpoints, relation, organization, optional
matter, qualifiers. Qualifiers stay in (the conservative default; collapsing
them risks grouping genuinely distinct assertions). The key carries
`keyVersion`; later policies may introduce qualifier partitions through a new
key version. Candidates always retain their full `LogicalEdgeKey`,
`EdgeVersionId`, and evidence scope. Policy result union:
`SelectedBelief { edgeVersionId, reasons }` |
`BeliefAbstention { candidateIds, reason }` — total over contention sets.
Minimal abstention reasons (LiteralKit): `unresolved-contradiction`,
`insufficient-evidence`, `policy-tie`, `scope-conflict`. Vocabulary extends
only through a new immutable policy revision, preserving determinism.

**A3 — First delivery computes on demand (ratified).**
No materialization in v1. The content-addressed `BeliefViewRevision` is
replayable byte-identically from retained authority plus the named policy
revision, so storage, pruning, and lineage records are deferred; the typed
delta recomputes the prior revision at its original `validAt`/`knownAt`/
policy inputs. Materialization is a cache, added only when a consumer needs
revision listing without replay cost, and must obey the same replay contract.
