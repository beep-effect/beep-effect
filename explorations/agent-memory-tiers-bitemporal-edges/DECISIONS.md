# Agent Memory Tiers & Bitemporal Edges — Decisions

All entries below were closed on 2026-07-14. `LOCKED` means the answer is
binding input to shape and decomposition. `DEFERRED` means the question moves
to the named goal's P0 rather than remaining an exploration fork.

## Scope determination — product memory, with the bitemporal port as its core

**Date / Status:** 2026-07-14 — **LOCKED**

**Question:** Is this packet about Claude/Codex developer memory, the named
`@beep/epistemic-tables` port, or the professional product runtime's broader
memory program?

**Answer:** This packet owns **product memory for the professional runtime**.
It does not own Claude/Codex developer memory, which is operator-level Cognee
under [`standards/memory-architecture/04-decision-log.md`](../../standards/memory-architecture/04-decision-log.md).
The packet is a superset of the named `@beep/epistemic-tables` bitemporal port;
that port is the first-goal core. Landing the core is the doctrine milestone
that triggers retirement of the write-frozen operator-level Graphiti
deployment. Product tables must never become an operator-memory backend.

**Rationale:** Product authority and operator assistance have different
lifecycles, owners, and trust boundaries. The doctrine deliberately keeps
Cognee/Graphiti in operator configuration while the product owns accepted
claims and relations in repo-native storage.

**Rejected options:** Treating this as a Claude/Codex memory redesign; limiting
the packet to a table-only port with no product program; wiring product tables
behind Cognee or Graphiti; reusing product tables as the operator-memory store.

## Decision 1 — sourcing and donor discipline

**Date / Status:** 2026-07-14 — **LOCKED**

**Question:** What may this program borrow, under what attribution discipline,
and may any donor enter the runtime?

**Answer:** Graphiti is the primary attributed port donor under Apache-2.0 for
temporal field semantics, episode lineage shape, and invalidate-don't-delete.
The exact mined locations are recorded in
[`docs/agent-memory-infra/00-recommendation.md`](../../docs/agent-memory-infra/00-recommendation.md):
`graphiti_core/edges.py:263-285`, `graphiti_core/nodes.py:318-351`, and
`graphiti_core/utils/maintenance/edge_operations.py:538-847`.
Agentmemory attribution is deferred until a retention goal actually adopts its
algorithm. Mike is AGPL and will not be clean-roomed because Beep already owns
the relevant gate and lineage concepts. Harvest-mcp and screenpipe are
concept-only. Doc-haus implementation detail is unusable until its license is
verified live. Every implementation goal starts with a pre-code
provenance/license inventory. No donor becomes a runtime dependency.

**Rationale:** This preserves the strongest attributed temporal donor while
keeping license obligations explicit and the product runtime repo-native.
Provenance is checked at implementation time because upstream licenses and
source locations can change.

**Rejected options:** Runtime dependencies on donors; unattributed translation;
clean-rooming Mike; borrowing doc-haus detail before live license verification;
landing agentmemory attribution before its algorithm is adopted; copying code
from concept-only sources.

## Decision 2 — program ownership

**Date / Status:** 2026-07-14 — **LOCKED**

**Question:** What does this exploration own, consume, and defer?

**Answer:** It owns a program comprising product-runtime bitemporal edge
authority, durable claim/edge disposition, a separately sequenced
contradiction-triage capability, and optional later retention/tier projections.
It consumes `CandidateClaim`, `Evidence`, `EvidenceSpan`, `ClaimGate`, the
shared `ClaimLifecycle` unchanged, PROV-O, identity, Drizzle/Postgres,
db-admin migrations, and the future RRF contract from
`rag-retrieval-projection`. It defers RRF arithmetic to that packet as the
single owner; external graph projections as rebuildable, driver-isolated,
non-authoritative consumers; Cognee/Graphiti operator tooling; and
IP-law-specific records. FalkorDB is SSPL and is not silently authorized.

**Rationale:** One authority owns durable meaning. Retrieval fusion, optional
graph projections, operator memory, and domain vocabularies remain separate
capabilities with explicit dependency directions.

**Rejected options:** A third RRF implementation; an authoritative graph
projection; bundling contradiction triage into the core transaction slice;
owning operator tooling; embedding IP-law vocabulary in epistemic memory;
widening the packet to every future retention policy.

## Decision 3 — first shippable slice

**Date / Status:** 2026-07-14 — **LOCKED**

**Question:** What is the first end-to-end product slice?

**Answer:** Ship the Postgres bitemporal edge-authority core. A gated claim or
relation is recorded with evidence and review state. A `REJECTED` verdict gains
a durable disposition, closing the current gap where
[`ClaimLifecycle.service.ts`](../../packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts)
returns the claim unchanged at lines 113-121. An approved replacement closes
the prior valid-time and transaction-time windows atomically without altering
the fact payload. `asOf(validAt, knownAt)` proves different correct answers
before and after a retroactive correction, followed by restart/migration proof.
The slice contains no RRF, decay, semantic extraction, external graph, or
IP-law vocabulary. Its P0 is spike-gated on Postgres/PGlite compatibility,
temporal-index strategy, exclusion-constraint support, and concurrent atomic
supersession.

**Rationale:** This is the smallest vertical closure of an observed loss of
durable truth while proving both time axes and recovery before optional
capabilities depend on them.

**Rejected options:** Starting with retention tiers, retrieval fusion,
contradiction automation, an external graph, semantic extraction, or a
domain-specific vocabulary; persisting only current state; treating rejection
as an unchanged return value.

## Decision 4 — durable truth authority

**Date / Status:** 2026-07-14 — **LOCKED** (settled doctrine)

**Question:** Where does durable truth live, and may a graph vendor enter the
authority path?

**Answer:** Durable truth lives in repo-native Postgres through epistemic
domain entities, `@beep/epistemic-tables`, server-owned transactional
repositories, and `@beep/db-admin` migrations. No external graph vendor enters
the authority path. Any future graph service is optional, rebuildable,
driver-isolated, fed only from accepted authority records, and prohibited from
direct authoritative writes.

**Rationale:** The binding authority-versus-projection doctrine requires
accepted product truth to survive vendor loss and projection rebuilds.

**Rejected options:** FalkorDB, Graphiti, Neo4j, Cognee, or another graph as
system of record; dual-write authority; graph-to-Postgres reconciliation as
the truth path; direct projection writes into authoritative records.

## Decision 5 — epistemic-local placement and orthogonal disposition

**Date / Status:** 2026-07-14 — **LOCKED** (settled doctrine)

**Question:** Which packages own the capability, and should disposition widen
the shared lifecycle?

**Answer:** Placement is epistemic-local. `@beep/epistemic-domain` owns the edge
entity, temporal fields, logical edge identity, disposition/review state,
lineage, and typed invariants. `@beep/epistemic-tables` owns projected table
metadata and indexes. `@beep/epistemic-use-cases` owns ports, commands, the
as-of query contract, and transitions. `@beep/epistemic-server` owns
repositories and atomic transactions. `@beep/db-admin` owns migrations. Add an
epistemic-local `ClaimDisposition` for durable truth outcome. Extraction review
state (`candidate`, `machine-extracted`, `human-reviewed`, `authoritative`)
remains orthogonal. Shared `ClaimLifecycle` remains unchanged; promotion is
reconsidered only after multiple real slices require identical semantics.

**Rationale:** Workflow progress, extraction review, and durable truth outcome
are distinct axes. Keeping evolving semantics local avoids breaking a shared
model and follows the prior review that rejected lifecycle widening.

**Rejected options:** Widening shared `ClaimLifecycle`; collapsing review and
disposition into one enum; placing repositories in domain or tables;
prematurely promoting edge semantics to shared-domain.

## Decision 6 — explicit, reviewable contradiction relations

**Date / Status:** 2026-07-14 — **LOCKED**

**Question:** Is contradiction only implicit invalidation, or a persisted
relation with an independent review path?

**Answer:** Persist explicit `CONTRADICTS` as an evidence-backed,
confidence-bearing, reviewable relation. Detection creates a candidate or
machine-extracted relation and never changes authoritative validity. Human or
policy approval may resolve the conflict as `SUPERSEDES`, atomically closing
the prior interval. Unresolved conflicts remain visible, and a contradiction
may stand without supersession. The identity/anchor/symmetry/deduplication
fixture spike is deferred to the triage goal's P0.

**Rationale:** Contradiction is evidence about a relationship; supersession is
an authoritative temporal transition. Separating them preserves reviewability
and prevents automated detection from rewriting accepted history.

**Rejected options:** Auto-supersession; contradiction as a transient alert;
implicit invalidation only; requiring every contradiction to resolve as
supersession; hiding unresolved conflicts.

## Decision 7 — bitemporal invariants contract

**Date / Status:** 2026-07-14 — **LOCKED**

**Question:** What temporal semantics and enforcement layers are binding?

**Answer:** Both axes use half-open intervals: `[validFrom, validTo)` and
`[recordedAt, expiredAt)`. Open ends are SQL `NULL`, modeled through Effect
Schema `Option`; magic dates are forbidden. All reads use canonical as-of
predicates. Fact payloads are immutable: supersession atomically closes
metadata intervals and adds a lineage link, never editing or deleting the
fact. “Latest” is derived from open intervals; no persisted `isLatest` exists
unless profiling later demands it. Enforcement combines schema/service typed
errors with DB backstops: ordered-interval checks, unique logical-version
identity, lineage foreign keys, and no-overlap exclusion where supported.
Close-and-insert occurs in one repository transaction with concurrency tests.
Cycle prevention remains application-side unless the spike finds a simple DB
mechanism.

**Rationale:** Two-axis correctness requires one interval convention and one
query contract across domain, repository, and database. Layered enforcement
keeps errors typed while protecting against bypass and races.

**Rejected options:** Closed intervals; sentinel dates; mutable fact rows;
delete-on-correction; a persisted `isLatest` flag by default; service-only or
DB-only enforcement; multi-transaction supersession; unproven DB cycle logic.

## Deferred spike A — core storage and concurrency feasibility

**Date / Status:** 2026-07-14 — **DEFERRED to
`epistemic-bitemporal-edge-core` P0**

**Question:** Which portable constraint/index/locking design satisfies the
locked invariants in both production Postgres and the repo's PGlite proof lane?

**Answer:** The goal's pre-code P0 must define the logical edge identity and
its no-overlap partition key; define the bounded endpoint model (claims,
evidence, domain entities, observations); test Postgres/PGlite parity,
temporal indexes, and exclusion-constraint availability; and prove the chosen
isolation/locking strategy against concurrent supersession. Unsupported DB
features require an explicit portable backstop, not weakened semantics.

**Rationale:** These are implementation-feasibility questions beneath locked
product semantics. They need executable migration and concurrency evidence.

**Rejected options:** Resolving portability by intuition; leaving logical
identity implicit; accepting last-writer-wins; postponing concurrency proof
until after schema commitment.

## Deferred spike B — contradiction-triage fixtures

**Date / Status:** 2026-07-14 — **DEFERRED to
`epistemic-contradiction-triage` P0**

**Question:** What matching and transition rules make contradiction candidates
repeatable without mutating authority?

**Answer:** The triage goal's P0 fixture must cover identity/anchor matching,
symmetric-edge representation, duplicate suppression, unresolved-conflict
visibility, and candidate-to-approved transition. It must demonstrate that
detection alone never changes authoritative validity.

**Rationale:** These rules depend on the core's finalized identity, endpoint,
and repository contracts and should be shaped against concrete fixtures.

**Rejected options:** Guessing the rules in the core goal; auto-approving
detection; hiding duplicates only at presentation time; coupling contradiction
existence to supersession.
