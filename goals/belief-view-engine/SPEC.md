# SPEC — Belief View Engine

Normative contract, seeded 2026-08-17 from the ratified
[`MAP`](../../explorations/epistemic-belief-view-revision/MAP.md) (candidate
1) **including its four adversarial amendments** — back-links, not copies.

## Mission

Deliver the ratified on-demand belief-view contract over the shipped
epistemic core: group open authority into contention sets, select or abstain
under an immutable policy revision, and emit a replayable content-addressed
revision.

## The contract (ratified; amendments binding)

1. **`BeliefContentionKey` v1** — versioned digest over authority identity
   with only `evidenceScope` excluded (qualifiers stay in). Candidates retain
   full `LogicalEdgeKey`, `EdgeVersionId`, and evidence scope.
2. **Total policy** — immutable `BeliefSelectionPolicyRevision`; per set
   `SelectedBelief { edgeVersionId, reasons }` or
   `BeliefAbstention { candidateIds, reason }`; abstention kit v1:
   `unresolved-contradiction | insufficient-evidence | policy-tie |
   scope-conflict`. Vocabulary changes require a new policy revision.
3. **Digest-encoding v1 (amendment A)** — version prefix; exact field set;
   epoch-millis times; sort keys for cut, sets, candidate ids, reasons. The
   authority cut is digested over rows projected through the triage
   `projectEdgeVersionAtKnownAt` pattern so the mutable `expiredAt` never
   enters the digest. `ClaimProjection` is the sorted-fold precedent only.
4. **Scope-wide read (amendment B)** — all open lineages for an org/matter at
   (`validAt`, `knownAt`), shipped WITH its supporting index (the org index
   was dropped in migration `20260813143745`) and a hard result cap returning
   a typed view-too-large error. No pagination. Matter request selects
   `matterScope ∈ {None, Some(matter)}`.
5. **Delta (amendment C)** — defined only between two revisions sharing a
   policy revision (`selected | replaced | abstained | resumed`); differing
   policies yield a typed error. Cross-policy diff is a reopened-decompose
   candidate.
6. **On demand only (ratified A3)** — no storage, no lineage records;
   materialization is the MAP's gated second candidate.

## Constraints

- No authority writes, no `SUPERSEDES`, no contradiction resolution.
- Every policy input must be as-of queryable or excluded from v1 policies —
  enforced at the policy-input type level, not prose.
- Repo laws: schema-first; LiteralKit; Effect v4 against the reference
  checkout; `HashMap`/`HashSet` only.

## Acceptance (the ratified first slice, as amended)

- [ ] Byte-identical replay: same request + policy revision + authority cut
      → identical revision key and object, proven against a live supersession
      having occurred in between (the `expiredAt` poison case).
- [ ] Two lineages differing only by `evidenceScope` group under one
      contention key and select/abstain deterministically.
- [ ] A `knownAt` shift produces a different revision.
- [ ] The scope read uses its new index (explain-verified) and the cap
      returns the typed overflow error.
- [ ] Same-policy delta over the three fixtures; differing-policy request
      yields the typed error.
- [ ] Verdict-family ownership law visible on its owning surfaces (propagated
      at graduation, not by this goal).
- [ ] Shipped as a PR driven to mergeable via /yeet.

## Stop conditions

- The digest cannot be made replay-stable without storing state (would
  contradict ratified A3) — stop and reopen the exploration.
- The scope read cannot meet the cap contract under the new index.
- The same blocker repeats after reasonable investigation.
