# Technology ADR: Research-Intelligence Authority and Projections

- **Gate:** G2 Technology ADR
- **Date:** 2026-07-11
- **Status:** Proposed accepted
- **Decision:** Use a repo-native relational authority with rebuildable
  projections for the deterministic first proof. Do not adopt a graph or memory
  vendor as authority or as a required runtime dependency.

## Context

The first proof must ingest deterministic fixtures into immutable snapshots,
ground claims in stable evidence spans, preserve provenance and lifecycle, and
render a reproducible brief. Unchanged inputs must preserve IDs, counts, hashes,
ordering, and projection output; deleting a projection must not delete authority.
These requirements come from `goals/project-intelligence/SPEC.md`, especially
the epistemic-authority and deterministic-first constraints.

The authority boundary is therefore the decision's hard gate, not retrieval
quality in isolation. Claims, evidence, provenance, and lifecycle are durable
truth. Search indexes, embeddings, graphs, summaries, Markdown, and MCP results
are disposable views. The SPEC also makes vendor adoption a Non-Goal until this
domain contract has been proven.

This ADR distinguishes two concerns that are easy to conflate:

1. `standards/memory-architecture/04-decision-log.md` selects Cognee as bounded,
   operator-level memory for development-agent sessions.
2. This ADR selects storage for the product's research-intelligence records.

The first concern may supply operational evidence, but it does not authorize
Cognee—or any other agent-memory system—to own product claims. The same decision
log explicitly keeps product-runtime authority repo-native and relational.

## Evidence and confidence convention

Repo claims below were checked against the cited source files. External claims
carry a confidence and source-kind marker. Claims first drafted with an
unresolved-verification marker were checked in a dedicated web-verification
pass on 2026-07-11 (licenses read from upstream license metadata and license
files; behavior claims from current vendor documentation); the resolved
results are folded in below and no unresolved marker remains.

Verification record (2026-07-11), so G2 evidence is reproducible rather than
asserted:

- Licenses of the four candidate upstreams: GitHub machine-readable license
  metadata (`spdx_id`) for `topoteretes/cognee`, `getzep/graphiti`,
  `trustgraph-ai/trustgraph`, and `mem0ai/mem0`.
- FalkorDB backend license: the upstream `FalkorDB/FalkorDB` license file,
  read directly (Server Side Public License v1 text, including its Section 13
  service-source-code clause).
- Cognee add/deduplication behavior: the Cognee documentation
  "main operations: add" page at `docs.cognee.ai` (content stored by
  byte-content hash; incremental loading default).
- Graphiti backends and deployment shape: the `getzep/graphiti` upstream
  documentation (Neo4j default; FalkorDB including an embedded variant;
  Amazon Neptune; Kuzu deprecated; self-hosting requires a Python service
  plus a graph backend).
- mem0 open-source algorithm and platform scoping: the mem0 documentation at
  `docs.mem0.ai` (single-pass ADD-only open-source algorithm; the "Graph
  Memory" feature scoped to the hosted platform).
- Managed Zep versus open-source Graphiti: the Zep help documentation page
  "zep-vs-graphiti" at `help.getzep.com`.

These external sources are mirrored into section 3 of
[`SOURCES.md`](./SOURCES.md); the upstream repositories and licenses are
mirrored into its section 2.

The scorecard is fit for this first proof, not a general product ranking:

- **5:** native fit or already-proven repo capability
- **4:** strong fit with bounded implementation work
- **3:** usable through an adapter or with material caveats
- **2:** weak fit or substantial translation/operations cost
- **1:** poor fit for the criterion
- **0:** disqualifying

For cost, complexity, and lock-in criteria, a higher score means lower cost,
lower complexity, or lower lock-in.

## Options

### 1. Cognee

Adopt Cognee as the product store, or use it as a subordinate projection/cache
behind an Effect driver.

### 2. Zep / Graphiti

Adopt managed Zep or self-hosted Graphiti as the temporal graph, or port only
its temporal-edge ideas into repo-owned schemas.

### 3. TrustGraph

Adopt the TrustGraph runtime and topology, or selectively port its provenance,
explainability, and ontology patterns.

### 4. mem0

Adopt the mem0 library or self-hosted server as the memory store, or port its
extraction and retrieval disciplines behind repo-owned authority.

### 5. Repo-native relational authority plus rebuildable projections

Use Effect schemas and repo-owned tables for authoritative records; use PGlite
for in-process local and deterministic test execution, Postgres for durable
deployment, and DuckDB for local analytics and Parquet export. Build graph or
semantic views only when useful, using the repo's Oxigraph, N3, SHACL, and RDF
canonicalization drivers as rebuildable projections.

### 6. Discovered alternative

None qualified. The 2026-07-08 clone-and-docs assessment in
`docs/agent-memory-infra/00-recommendation.md` also considered alternatives
beyond this ADR's named set and found no external product with both source-span
evidence and an acceptance lifecycle. [confidence: high; source: prior repo
experience]

## Criteria matrix

| Criterion | Cognee | Zep / Graphiti | TrustGraph | mem0 | Repo-native baseline |
| --- | ---: | ---: | ---: | ---: | ---: |
| Local-first operation | 4 | 3 | 3 | 4 | 5 |
| Evidence spans | 1 | 2 | 3 | 1 | 5 |
| Temporal modeling | 3 | 5 | 3 | 2 | 4 |
| Deterministic export | 2 | 2 | 3 | 2 | 5 |
| Ownership / portability | 3 | 3 | 3 | 4 | 5 |
| Effect fit / low integration cost | 2 | 2 | 2 | 3 | 5 |
| Operational simplicity / low complexity | 3 | 2 | 1 | 3 | 5 |
| Licensing | 5 | 4 | 5 | 5 | 5 |
| Lock-in resistance | 3 | 3 | 2 | 3 | 5 |
| Graph query | 4 | 5 | 5 | 3 | 4 |
| Incremental sync | 4 | 5 | 4 | 4 | 4 |
| Observability | 4 | 4 | 4 | 3 | 5 |
| Testability | 2 | 2 | 2 | 3 | 5 |
| Private-data suitability | 4 | 3 | 4 | 4 | 5 |
| **Total / 70** | **44** | **45** | **44** | **44** | **67** |

The external products score well at their intended projection concerns. They
lose primarily on exact source-span authority, deterministic fixture proof,
Effect-native composition, and operational surface. Graphiti's licensing score
is reduced because its selectable FalkorDB backend is SSPLv1 — confirmed in the
web-verification pass (2026-07-11) by reading the upstream license file, in
agreement with the repo's 2026-07-08 assessment; using a different backend
avoids that backend-specific issue. [confidence: high; source: upstream
license file + prior repo experience]

## Upstream registration and port discipline

No evaluation code is authorized by this ADR. Before any vendor evaluation code
is written, these rows must be mirrored into section 2 of
`goals/project-intelligence/research/SOURCES.md`, preserving the SPDX license and
port discipline required by that ledger.

| Candidate upstream | SPDX license | Port discipline |
| --- | --- | --- |
| [Cognee upstream](https://github.com/topoteretes/cognee) | Apache-2.0 [confidence: high; source: upstream license metadata, web-verified 2026-07-11] | Donor or rebuildable cache only; integrate through a product-neutral `drivers/*` wrapper; never own claims or lifecycle. |
| [Graphiti upstream](https://github.com/getzep/graphiti) | Apache-2.0 [confidence: high; source: upstream license metadata, web-verified 2026-07-11] | Port temporal contracts or use as a bounded projection only; backend licenses require separate review. |
| [TrustGraph upstream](https://github.com/trustgraph-ai/trustgraph) | Apache-2.0 [confidence: high; source: upstream license metadata, web-verified 2026-07-11] | Port provenance/explainability capabilities, not service topology or product authority. |
| [mem0 upstream](https://github.com/mem0ai/mem0) | Apache-2.0 [confidence: high; source: upstream license metadata, web-verified 2026-07-11] | Port extraction/retrieval discipline or use as a cache; keep mutation and approval semantics repo-owned. |

## Per-option evidence and tradeoffs

### Cognee

Cognee's upstream repository describes a self-hosted knowledge graph combining
vector and graph retrieval, local execution, ontology grounding, tenant
isolation, traceability, an OTEL collector, and audit traits. It also publishes
local Python, container, HTTP, and TypeScript client surfaces. [confidence:
high; source: upstream repository README]

The repo already has a narrow Effect HTTP integration in
`packages/tooling/tool/cli/src/commands/Research/internal/CogneeClient.ts`. It:

- logs in through `/api/v1/auth/login` and schema-decodes the bearer token;
- uploads Markdown as multipart data to `/api/v1/add` by dataset; and
- invokes `/api/v1/cognify` with dataset names and background policy.

That is stronger evidence than a hypothetical integration, but it is still a
tooling-internal ingestion client. It exposes no claim/evidence contract, query,
deterministic export, deletion, or lifecycle promotion surface. Its comments
assert content-hash deduplication, and current vendor documentation confirms
the upstream behavior: content is stored by byte-content hash, so re-adding
identical content is a no-op. The repo still has no local contract tests
against a live service. [confidence: high; source: vendor documentation,
web-verified 2026-07-11]

Cognee is attractive as a later semantic cache because the repo already has
deployment experience and the upstream offers local operation. The tradeoff is
that its graph is produced through model and embedding pipelines, and the repo's
2026-07-08 review found no stable source-span plus acceptance-lifecycle boundary.
Operating the bounded embedded or all-Postgres profile is materially simpler
than the full service composition, but it is still another runtime and schema
translation layer. [confidence: high; source: prior repo experience]

Verdict: reject as first-proof authority and required runtime; retain as a
possible later projection/cache and as the separate development-agent memory
incumbent.

### Zep / Graphiti

Graphiti's upstream README describes self-hosted temporal context graphs with
validity windows, raw episodes as provenance, incremental updates, historical
queries, and semantic, keyword, and graph traversal. It distinguishes Graphiti
as the self-managed open-source engine from managed Zep. [confidence: high;
source: upstream repository README]

The upstream README calls the model “bi-temporal,” but the repo's source-level
review narrows that claim: Graphiti has valid-time fields, system timestamps,
episode lineage, and invalidation, not a transaction ledger with this product's
claim lifecycle. [confidence: high; source: prior repo experience]

The actual repo integration in
`packages/tooling/tool/cli/src/commands/Research/internal/GraphitiEpisodes.ts`
is even narrower. It opens an MCP session, calls `add_memory`, and posts pipeline
event text. The five-second, catch-all path logs and continues if Graphiti is
unavailable; its own documentation says the vault and catalog remain truth. It
does not ingest source documents, retrieve graph results, or export authority.

Graphiti is the strongest temporal and incremental-sync donor in the set, but a
useful local deployment still introduces a Python service, a graph backend, and
model/embedding policy. Upstream supports Neo4j (default), FalkorDB
(including an embedded variant), and Amazon Neptune, with Kuzu explicitly
deprecated; local model endpoints are possible. [confidence: high; source:
vendor documentation, web-verified 2026-07-11] Backend selection changes
licensing and operations, so any backend actually selected later must have its
license and operational profile reviewed at selection time.

Verdict: reject Zep/Graphiti adoption for the first proof; port temporal-edge
semantics only when the domain model needs them, and treat any later running
Graphiti service as a bounded projection/cache.

### TrustGraph

TrustGraph's upstream repository describes an Apache-2.0, containerized platform
that can run locally with Docker, Podman, or Minikube. Its current product
surface includes graph retrieval, ontology tooling, inline provenance, and live
explainability views. [confidence: high; source: upstream repository README]

This repo contains more direct TrustGraph evidence than a paper comparison:

- `goals/trustgraph-port/SPEC.md` explicitly chooses a selective capability
  port, not TrustGraph deployment topology, and rejects Cassandra, object-store,
  vector-store, gateway, and flow-service assumptions for its first phase.
- `goals/trustgraph-doc-ontology/` contains generated ontology, RDF, provenance,
  evidence, SHACL, and verification artifacts, demonstrating useful
  interoperability patterns.

Neither packet proves TrustGraph is ready to own this product. Both manifest
statuses are paused. The port spec favors repo-native deterministic packets and
storage; the documentation-ontology packet is an artifact prototype, not a
running product store. TrustGraph's provenance and ontology surfaces are the
best donor fit here, but its full topology is the most operationally complex
option and would duplicate repo-native graph and storage bricks.

Verdict: adopt the provenance/explainability ideas as donors, not the runtime or
authority. Revisit a TrustGraph projection only if a later ontology-heavy proof
demonstrates that the repo-native semantic drivers are insufficient.

### mem0

The mem0 upstream repository currently offers a Python library, a self-hosted
server, a cloud platform, and a TypeScript surface. Its README says the
self-hosted server uses container composition with authentication, while the
default memory pipeline requires a model and embeddings. [confidence: high;
source: upstream repository README]

Current upstream documentation describes single-pass, ADD-only extraction (no
destructive model-driven update or delete), hybrid semantic/keyword/entity
retrieval, and entity linking in the newer open-source algorithm. [confidence:
high; source: vendor documentation, web-verified 2026-07-11] Feature parity is
not symmetric: the native knowledge-graph feature ("Graph Memory") is exclusive
to the hosted platform, while the open-source analog is entity-linking-boosted
retrieval rather than a graph store.

The repo's 2026-07-08 clone review found real TypeScript OSS and self-hosted
Postgres/pgvector paths, but no stable evidence spans, approval lifecycle, or
bitemporal authority. It identified useful donor ideas: ADD-only model
extraction, hash deduplication, identifier masking before model calls, and
hybrid retrieval. [confidence: high; source: prior repo experience]

Those disciplines reduce destructive model behavior but do not make generated
memory authoritative. mem0 is easier to embed than the larger graph stacks, yet
model-dependent mutation remains incompatible with the offline deterministic
test oracle unless captured behind fixtures.

Verdict: reject as authority; retain as an extraction and cache-ergonomics donor.

### Repo-native relational authority plus rebuildable projections

The baseline composes capabilities already shaped for this monorepo:

- `packages/epistemic/domain` defines schema-first `CandidateClaim`, `Evidence`,
  exact character-offset `EvidenceSpan`, and shared claim lifecycle vocabulary.
- `packages/epistemic/use-cases` provides the claim gate, lifecycle transition,
  and a pure `ClaimProjection` whose tests prove stable encoded output and
  structural equality across rebuilds.
- `packages/epistemic/server` composes the gate and transition as live Layers
  over the repo's bounded SHACL service.
- `packages/drivers/pglite` supplies an in-process, in-memory test Layer and a
  file-backed option while exposing compatible Postgres and generic SQL tags.
- `packages/drivers/postgres` and `packages/drivers/drizzle` provide Effect
  clients, Layers, migrations, transactions, typed errors, and PGlite-backed
  integration tests.
- `packages/drivers/duckdb` owns local analytical storage, transactions, and
  Parquet export while leaving domain schemas and retention to the product.
- `packages/drivers/oxigraph`, `n3`, `shacl`, and `rdf-canonize` provide SPARQL,
  Turtle, validation, canonical RDF text, and fingerprints without claiming
  product authority.

The baseline has a concrete gap: `packages/epistemic/tables` currently persists
only `UsageRecord`; it does not yet provide tables for `CandidateClaim` or
`Evidence`. Snapshot, observation, assessment, contradiction, and brief concepts
also remain to be designed by this packet. This is implementation work, not an
unknown authority model or a foreign-runtime dependency.

The baseline does not automatically earn deterministic export merely by using
SQL. P1 must specify canonical encodings, ordering, hashes, and the exact export
contract, and P2/P3 must prove them. It scores highest because the schemas,
clock, storage Layers, canonicalization tools, and tests are owned and can be
made part of the proof oracle.

Verdict: select for the first proof.

## Recommendation and confidence

Select **repo-native relational authority plus rebuildable projections**.

For the first proof:

1. Keep the authoritative records — source, snapshot, claim, evidence,
   provenance, and lifecycle — in repo-owned schemas and relational tables.
   Observations and assessments are rebuildable intermediates per the G1
   authority map: they may be persisted for inspection and replay, but they
   are never brief authority, and delete-and-rebuild must regenerate them.
2. Use PGlite for deterministic in-process tests and the smallest local proof;
   keep the SQL contract compatible with Postgres as the durable deployment
   lane.
3. Use DuckDB only for local analytical/export projections where its strengths
   are needed, not as a second authority.
4. Add an Oxigraph/RDF view only after a query requires graph semantics; derive
   it from authority and prove delete-and-rebuild equivalence.
5. Keep all model- or embedding-derived output in candidate/projection state
   until the evidence and lifecycle gate admits it.

Confidence is **high (0.90)** for the authority and no-vendor decision. It is
**medium (0.75)** for the exact Postgres/PGlite/DuckDB role split because P1 may
show the smallest proof needs fewer engines. That simplification would remain
consistent with this ADR; it must not weaken the authority or rebuildability
contract.

## Reversibility analysis

This choice is intentionally one-way only at the authority boundary and highly
reversible everywhere else.

- A later vendor can consume a typed snapshot/change feed or canonical export
  without receiving authority writes.
- A graph, vector index, DuckDB catalog, Markdown vault, or vendor cache can be
  deleted and rebuilt from relational records.
- Stable repo-owned IDs and evidence anchors let projections change vendors
  without changing citations in authoritative records.
- If a vendor projection is retired, drain no authority from it; delete the
  projection and rebuild its replacement.
- If a future gate promotes a vendor capability, the adapter remains in
  `drivers/*`, while product semantics stay in the owning slice.

The main sunk cost is implementing relational tables that the proof needs
regardless of later projections. Adopting a vendor first would add a harder
reverse migration: recover generated graph state, reconstruct missing evidence
spans and lifecycle, and prove that no vendor-only identifier became canonical.

## Change conditions

Revisit this ADR only when evidence satisfies at least one of these conditions:

1. The first proof has passed its determinism matrix and therefore proven the
   domain and authority contract required by the SPEC Non-Goal.
2. Measured graph queries cannot be expressed or served adequately by the
   relational model plus the repo's Oxigraph projection.
3. A candidate demonstrates stable evidence-span round trips, explicit review
   lifecycle, deterministic full export, and clean rebuild from repo authority.
4. A fixture benchmark shows a material quality or latency gain that exceeds
   the added service, model, migration, and observability cost.
5. Private-data review proves local processing, deletion, telemetry controls,
   backup/restore, and dependency licenses for the exact selected deployment.
6. An Effect driver can isolate transport failures and expose typed,
   driver-neutral ports without leaking vendor semantics into product domain.
7. A license or architecture change invalidates any score in this ADR.

No single retrieval-quality benchmark is sufficient to move authority. A vendor
may win projection status while still failing the authority gate.

## Relation to the SPEC Non-Goal

The recommendation directly implements “No graph/memory vendor adoption before
the domain contract is proven.” P1–P3 adopt no Cognee, Zep/Graphiti, TrustGraph,
or mem0 runtime. They may use the vendors' documented ideas as design evidence,
but the executable proof remains relational, fixture-driven, Effect-native, and
offline.

After the proof, this ADR permits a new gate to consider a vendor only as a
rebuildable projection or candidate producer first. Any proposal to make one
authoritative would require a new SPEC decision that replaces, rather than
silently weakens, the epistemic-authority constraint.

The operator-level Cognee deployment remains unaffected because development
agent session memory is outside this product authority and deployment boundary.

## Recon corrections

The read-through resolves and refines several reconnaissance statements:

1. The “exact Cognee/Graphiti client API surfaces” item is no longer unresolved.
   Cognee has three product-relevant calls in the current CLI client: login,
   multipart add, and cognify. Graphiti has one best-effort MCP write path:
   initialize a session and call `add_memory` for pipeline event episodes.
2. The Graphiti integration is not a content store or retrieval client. It is
   explicitly non-authoritative and failure-tolerant; the vault and catalog are
   named as truth in its own module documentation.
3. The epistemic kernel is stronger at the schema/use-case boundary than at the
   persistence boundary. `CandidateClaim`, `Evidence`, `EvidenceSpan`, lifecycle,
   gate, transition, and deterministic projection exist, but
   `packages/epistemic/tables` persists only `UsageRecord` today.
4. TrustGraph evidence exists but is not adoption evidence. Both TrustGraph goal
   manifests are paused, even though their README/SPEC status prose still says
   pending; manifest status is the current machine-readable state.

These corrections do not change recon's conclusion that there is no packaged
Cognee/Graphiti product driver, no mem0 integration, and no current vector-store
authority in this repo.

## Gate decision

**2026-07-11 — G2 accepted:** Select the repo-native relational model with
rebuildable projections for the deterministic first proof, as decided in
[`research/technology-adr.md`](./technology-adr.md). Cognee, Zep/Graphiti,
TrustGraph, and mem0 are rejected as authority and required P1–P3 runtime
dependencies; they remain eligible only as documented donors or later,
separately gated projections after the domain contract is proven. No superior
external alternative qualified under the same authority, determinism,
portability, and private-data criteria.
