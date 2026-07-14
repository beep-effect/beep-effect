# Agent Memory Tiers & Bitemporal Edges — Brief

## Controlling Scope

This is **product memory for the professional runtime**, not Claude/Codex
developer memory. Operator memory remains operator-level Cognee under
[`standards/memory-architecture/04-decision-log.md`](../../standards/memory-architecture/04-decision-log.md).

The program is a superset of the named `@beep/epistemic-tables` bitemporal
port. That port is the first-goal core and, when it lands, fires the doctrine
milestone for retiring the write-frozen operator-level Graphiti deployment.
The product tables do not become an operator-memory backend.

## Problem

Agents and the professional runtime need an auditable,
retroactively-correctable memory of accepted claims and relations. Today the
epistemic spine can gate a claim and ground it in evidence, but a rejected
verdict disappears as durable truth: the transition in
[`ClaimLifecycle.service.ts`](../../packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts)
returns the claim unchanged. Corrections also need two independent answers:
what was valid in the world at a time, and what the system knew at a time.
Without a bitemporal authority, an overwrite destroys that distinction and an
external graph projection can accidentally become the de facto source of
truth.

The immediate job is therefore not “build all agent memory.” It is to give
accepted and rejected claims/relations a durable, evidence-backed disposition;
preserve every corrected fact version; and make two-axis history queryable and
transactionally safe. Contradiction triage and retention projections can then
compose over that authority without owning it.

## Appetite

**Proposed — ratify at shape sign-off:** one bounded implementation goal for
the bitemporal authority core, including a pre-code P0 spike, domain/table/use-
case/server/migration wiring, focused concurrency and as-of fixtures, and
restart/migration proof. If the spike cannot preserve the locked invariants
across production Postgres and the repo's PGlite proof lane, stop and reshape
the storage backstop rather than absorbing retrieval, extraction, graph, or
retention work.

Contradiction triage is a separately shaped follow-on. Retention/tier
projections are optional and must be shaped independently after real product
usage supplies calibration evidence.

## Fat-Marker Solution Sketch

### First lane — bitemporal edge authority core

1. A caller submits a gated claim or relation with evidence, endpoint refs,
   logical identity, predicate qualifiers, organization/matter scope, and
   extraction review state.
2. The epistemic use-case validates bounded endpoints and typed temporal/
   lineage invariants. A rejected gate verdict records a durable
   `ClaimDisposition`; it no longer vanishes as an unchanged claim.
3. The server repository records the immutable fact payload plus evidence,
   review state, and half-open valid/transaction intervals in Postgres.
4. An approved replacement closes the prior row's `validTo` at the new fact's
   effective time and `expiredAt` at transaction time, then inserts the new
   version and lineage link in the same transaction.
5. `asOf(validAt, knownAt)` applies the canonical two-axis predicates. A
   retroactive correction therefore yields the old answer at an earlier
   `knownAt` and the corrected answer at a later `knownAt` for the same
   `validAt`.
6. Restart and migration fixtures prove that history, dispositions, lineage,
   and query behavior survive process boundaries.

Open interval ends are SQL `NULL` represented with Effect Schema `Option`.
“Latest” is derived, facts are never edited or deleted, and DB constraints
backstop typed service errors. There is no persisted `isLatest` unless later
profiling justifies it.

### Core goal P0 checklist

- Complete the pre-code provenance/license inventory. Graphiti is the primary
  Apache-2.0 attributed donor; no donor becomes a runtime dependency.
- Define **logical edge identity** across source, target, relation,
  organization/matter scope, predicate qualifiers, and evidence scope. This
  is the no-overlap partition key.
- Define the **bounded endpoint model** for claims, evidence, domain entities,
  and observations; reject arbitrary or dangling endpoint kinds.
- Prove Postgres/PGlite compatibility, temporal-index strategy, and whether
  no-overlap exclusion constraints are available in each proof lane.
- Choose and test the concurrent-supersession isolation/locking strategy.
  Close-and-insert must be atomic and deterministic under races.
- Confirm ordered-interval checks, unique logical-version identity, lineage
  foreign keys, portable no-overlap backstops, canonical as-of predicates, and
  application-side cycle prevention unless a simple DB mechanism wins the
  spike.

### Program lanes after the core

- **Contradiction triage:** persist evidence-backed, confidence-bearing,
  reviewable `CONTRADICTS` candidates. Detection never changes authority.
  Human/policy approval may resolve a conflict as `SUPERSEDES`; unresolved
  contradictions remain visible and may stand indefinitely.
- **Retention/tier projections:** optional, rebuildable views over accepted
  authority records. This lane owns any later adoption and attribution of an
  agentmemory retention algorithm; it does not mutate authoritative facts.
- **Retrieval and graph consumers:** consume the future RRF contract from
  `rag-retrieval-projection`. External graph projections remain optional,
  rebuildable, driver-isolated, and read only from accepted authority records.

## Rabbit Holes

- **Exclusion-constraint portability:** Postgres may support a stronger
  no-overlap backstop than PGlite. The spike must preserve semantics even when
  the same constraint mechanism is unavailable.
- **PGlite parity:** migration and restart proof can diverge from production
  Postgres around extensions, index operators, isolation, and locks.
- **Concurrency races:** two replacements can both observe an open interval.
  The repository needs an evidenced isolation/locking rule, not optimistic
  last-writer-wins.
- **Identity partition subtleties:** qualifiers, scope, evidence scope,
  symmetric relations, and endpoint normalization can accidentally merge
  distinct facts or permit overlapping duplicates.
- **Donor attribution hygiene:** each goal rechecks provenance and licenses
  before code. Doc-haus requires live license verification; mike is not
  clean-roomed; harvest-mcp and screenpipe remain concept-only.
- **Retention calibration later:** decay and tier thresholds need observed
  product behavior. Do not import agentmemory constants before an independent
  retention shape pass.

## No-Gos

- No external graph or memory vendor in the authority path; no dual-write
  authority and no direct authoritative projection writes.
- No widening shared `ClaimLifecycle`; `ClaimDisposition` is epistemic-local,
  and extraction review state remains orthogonal.
- No RRF arithmetic; `rag-retrieval-projection` is the single owner.
- No automatic supersession from contradiction detection.
- No coupling product memory to Cognee/Graphiti operator memory, and no use of
  product tables as the operator-memory backend.
- No RRF, decay, semantic extraction, external graph, or IP-law vocabulary in
  the first slice.
- No magic dates, mutable fact payloads, delete-on-correction, or default
  persisted `isLatest` flag.
