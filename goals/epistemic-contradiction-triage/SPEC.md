# Epistemic Contradiction Triage Spec

## Objective

Deliver evidence-backed, confidence-bearing, reviewable `CONTRADICTS`
candidates over the bitemporal edge authority core, plus an approval path that
may resolve a candidate as an atomic `SUPERSEDES` — with detection never
mutating authority. A contradiction candidate is a queryable, durable proposal
with provenance and confidence; only a recorded, scoped human disposition can
convert it into an authority-changing supersession, executed through the
core's existing atomic close-and-insert path.

## Non-Goals

- No automatic supersession from detection — the core's constraint stands
  (`goals/epistemic-bitemporal-edge-core/SPEC.md`); detection output is data,
  never an authority write.
- No preferred-view selection, belief repair, or working-view recovery — that
  is `explorations/epistemic-belief-view-revision` (first composition, align
  2026-07-25).
- No retention/tier/decay policy — deferred to
  `epistemic-memory-retention-projections` (master align Q3 stays open here).
- No semantic-graph or NLP contradiction *detection engine* in this packet:
  candidates arrive from callers (agents, pipelines); this packet owns their
  storage, lifecycle, matching identity, and approval transition — not
  natural-language inference.
- No changes to shared `ClaimLifecycle`; no IP-law vocabulary.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

Provenance (back-links, not copies):
`explorations/agent-memory-tiers-bitemporal-edges` (MAP order 2; Deferred
spike B in `DECISIONS.md`), and the unconsumed dispatch note
`goals/epistemic-bitemporal-edge-core/research/2026-07-25-academia-corpus-mining-note.md`
(seven boundary-fixture candidates + master align Q1 context).

## Target Surfaces

- `packages/epistemic/domain` — contradiction-candidate value objects/entities
  (candidate identity, match basis, confidence, evidence refs).
- `packages/epistemic/tables` + shared migration folder — candidate table(s);
  additive only.
- `packages/epistemic/use-cases` — candidate ports/commands; approval
  transition command composing the existing `SupersedeEdgeFact` path.
  Contradiction review uses a slice-local `ContradictionDispositionStatus`;
  `ClaimDispositionStatus` remains unchanged.
- `packages/epistemic/server` — repository + layer wiring.
- `packages/_internal/db-admin` — migration target registration (follow the
  `CREATE EXTENSION` consumer-sweep checklist in that package's `AGENTS.md` if
  any new extension is needed; none is expected).

## Constraints

- Detection alone never changes authoritative validity (Deferred spike B
  acceptance sentence — the P0 fixtures must demonstrate this).
- Approval is a recorded scoped human disposition, not truth manufacture
  (academia align decision 2); the approval record and the resulting
  supersession are distinct records with distinct identities.
- An unresolved contradiction is represented by the absence of a contradiction
  disposition. `ContradictionDispositionStatus` contains only `rejected` and
  `superseded`; it does not overload claim-admission disposition.
- Symmetric relations (`CONTRADICTS`) reuse the core's symmetric-endpoint
  ordering in `LogicalEdgeIdentity`; no second symmetric-encoding scheme.
- Duplicate suppression is identity-based (logical key + match basis), not
  string-similarity-based.
- Typed verdict families stay separate (master align Q1): a candidate's
  semantic stance never doubles as anchor fidelity, source authority, or
  disposition; this packet names its own family without claiming the others.
- Head disambiguation over supersession gets the named fixture the core's
  reflection called for (`history/reflections/2026-07-25-claude.md`).
- Additive migrations only; the core's tables and constraints are not altered.

## P0 Fixture-Spike Gate (hard gate, from Deferred spike B)

No implementation phase runs before a fixture spike proves, with concrete
fixtures over the real core (PGlite lane at minimum):

1. Identity/anchor matching — when two candidates address the same logical
   lineage vs. distinct ones.
2. Symmetric-edge representation — both orderings of a `CONTRADICTS` pair
   collapse to one candidate.
3. Duplicate suppression — resubmission of the same candidate basis is a
   no-op with visible provenance.
4. Unresolved-conflict visibility — open candidates are queryable at
   `asOf(validAt, knownAt)` without touching authority reads.
5. Candidate-to-approved transition — approval resolves as one atomic
   `SUPERSEDES` through the core's existing conflict-safe path; rejection
   records a durable disposition; the losing lineage stays historically
   queryable.

The seven boundary-fixture candidates from the 2026-07-25 dispatch note fold
into this spike where they bear on triage: competing lineages (coexistence
without cross-lineage closure), revision ordering (deterministic replay,
duplicate/late-arrival behavior), and the restart boundary (all fixtures
re-queried identically across restart + generated migration). The
interpretation/adoption, qualifier-complete-assessment, correction/
invalidation, and policy/model-trust fixtures are recorded as evidence inputs;
they graduate onward with the packets that own those records.

## Acceptance Criteria

- [x] P0 spike NOTES with pass/fail per gate assertion, archived under
      `history/p0/`.
- [ ] Candidate storage is bitemporal, immutable, and additive; detection
      writes never appear in the core's authority tables.
- [ ] Approval transition executes candidate → atomic supersession + durable
      disposition in one transaction, reusing the core's typed-conflict
      mapping; claim-admission disposition remains unchanged.
- [ ] Unresolved candidates and resolved outcomes are queryable two-axis;
      restart/migration proof repeats the P0 queries identically.
- [ ] Reflection passes `bun run beep lint reflection-artifacts`; packet state
      flips in the same PR as the final work.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/epistemic-contradiction-triage/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/epistemic-contradiction-triage/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/epistemic-contradiction-triage` | Passes |
| Focused suites | epistemic domain/use-cases/server vitest lanes | Green |
| Full proof | `bun run beep yeet verify` | SUCCESS |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (especially: any pressure to
  add detection heuristics/NLP — stop and re-scope).
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Raw-SQL constraint ownership (inherited from core) | Any new candidate-table constraints beyond persist-descriptor vocabulary | @beep-team | Same as core packet's ledger row | When the persist-descriptor vocabulary (or drizzle) can express the needed constraints and migrations regenerate from metadata |
