## TL;DR

Cognee passes the three admission gates for a candidate memory stack: it is
self-hostable/local-first, Apache-2.0 licensed, and has usable TypeScript,
HTTP, and MCP surfaces
([API](https://docs.cognee.ai/api-reference/introduction),
[license](https://docs.cognee.ai/getting-started/introduction),
[TypeScript](https://docs.cognee.ai/typescript/getting-started),
[MCP](https://docs.cognee.ai/cognee-mcp/mcp-overview)). It should not become
the product runtime's authority layer. In this repo's doctrine, semantic memory
systems may be caches, projections, donors, and candidate producers; accepted
professional truth remains repo-native, schema-first, evidence-backed, and
provenance-tracked (`standards/memory-architecture/README.md`,
`standards/memory-architecture/01-memory-layer-taxonomy.md`,
`goals/agentic-professional-runtime/README.md`).

Verdict for the two requested roles:

- **Role A, product-runtime memory:** **conditional LEARN/PARTIAL PASS as a
  donor/cache/projection only**. Cognee's useful portable ideas are its
  three-store shape, `DataPoint` modeling, memory verbs, ontology upload/use
  flow, deletion ownership records, and clean HTTP/TS/MCP adapter surface
  ([architecture](https://docs.cognee.ai/core-concepts/architecture),
  [DataPoints](https://docs.cognee.ai/core-concepts/building-blocks/datapoints),
  [API](https://docs.cognee.ai/api-reference/introduction)). It fails as a
  runtime source of truth because graph construction is primarily LLM/embedding
  mediated, temporal support is not the repo's required bitemporal authority
  model, and provenance is ingestion/dataset lineage rather than accepted
  claim/evidence/provenance lifecycle.
- **Role B, dev-tooling memory for Claude/Codex agents:** **do not keep as the
  surviving incumbent**. Cognee MCP has a better memory-control-plane UX than a
  raw API, but its local footprint is heavy, its MCP auth path has operational
  sharp edges, and its recall semantics are less directly aligned with the
  repo's existing Graphiti temporal-memory reason for being
  ([MCP local setup](https://docs.cognee.ai/cognee-mcp/mcp-local-setup),
  [MCP tools](https://docs.cognee.ai/cognee-mcp/mcp-tools),
  [time awareness](https://docs.cognee.ai/guides/time-awareness)).

Official docs now consistently describe the managed product as **Cognee Cloud**;
I did not find a current official "Cogwit" surface in the fetched docs index or
the Cloud pages
([llms.txt](https://docs.cognee.ai/llms.txt),
[Cognee Cloud](https://docs.cognee.ai/cognee-cloud/overview)).

## Hard-gate verdicts

| Gate | Verdict | Evidence |
| --- | --- | --- |
| 1. Self-hostable / local-first | **PASS** | Cognee documents local Docker and Docker Compose self-hosting at `localhost:8000`, with optional local authentication and no local rate limits; it also documents file-based local defaults for relational, vector, and graph stores ([API](https://docs.cognee.ai/api-reference/introduction), [setup](https://docs.cognee.ai/setup-configuration/overview)). MCP can run standalone with the full Cognee pipeline bundled, or in API mode against a shared backend ([MCP overview](https://docs.cognee.ai/cognee-mcp/mcp-overview)). |
| 2. OSI license without copyleft trap | **PASS for Cognee core** | The official introduction says Cognee is open source under Apache License 2.0 and may be used, modified, and distributed in personal and commercial projects ([introduction](https://docs.cognee.ai/getting-started/introduction)). Caveat: optional external backends/adapters still carry their own licenses; for example, choosing FalkorDB would require a separate SSPL review outside Cognee's own license. |
| 3. TS-native or clean HTTP/MCP API | **PASS, with integration caveat** | Cognee provides a REST API under `/api/v1`, an MCP server with standalone/API modes, and a TypeScript SDK published as `@cognee/cognee-ts` using Node bindings over `cognee-rs` ([API](https://docs.cognee.ai/api-reference/introduction), [MCP overview](https://docs.cognee.ai/cognee-mcp/mcp-overview), [TypeScript](https://docs.cognee.ai/typescript/getting-started)). It is still not Effect-native; repo integration should stay behind a driver/adapter boundary. |

## Architecture & storage

Cognee's core architecture is explicitly poly-store: relational storage tracks
documents, chunks, metadata, and provenance; vector storage holds embeddings for
semantic similarity; graph storage captures entities and relationships
([architecture](https://docs.cognee.ai/core-concepts/architecture)). This maps
well to a projection/cache layer, not to accepted runtime truth.

With plain installation, Cognee documents local file-backed defaults: SQLite for
relational metadata, LanceDB for vectors, and Ladybug/Kuzu-compatible graph
storage, all created lazily under the configured system root
([setup](https://docs.cognee.ai/setup-configuration/overview)). For production,
Cognee supports Postgres for relational metadata and PGVector for vector storage;
Postgres is recommended for production, multi-process concurrency, external
hosting, and co-location with pgvector
([relational DBs](https://docs.cognee.ai/setup-configuration/relational-databases),
[vector stores](https://docs.cognee.ai/setup-configuration/vector-stores)).

Supported graph stores include Kuzu, Kuzu-remote, Neo4j, Neo4j Desktop, Neo4j
Aura, Neptune, Neptune Analytics, and Memgraph as a community adapter
([graph stores](https://docs.cognee.ai/setup-configuration/graph-stores)).
Supported vector stores include LanceDB, PGVector, Neptune Analytics, ChromaDB,
and community adapters such as Qdrant, Redis, FalkorDB, Pinecone, Turbopuffer,
Milvus, and Weaviate
([vector stores](https://docs.cognee.ai/setup-configuration/vector-stores)).

The Postgres/pgvector story is credible but not frictionless: PGVector requires
Postgres extras, a running Postgres instance, `VECTOR_DB_PROVIDER=pgvector`, and
`VECTOR_DATASET_DATABASE_HANDLER=pgvector` in access-control mode; per-dataset
PGVector engines use smaller connection pools by default because active datasets
multiply connections
([PGVector handler](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/existing-dataset-database-handlers/pgvector),
[permissions setup](https://docs.cognee.ai/setup-configuration/permissions),
[vector stores](https://docs.cognee.ai/setup-configuration/vector-stores)).

Multi-user isolation is provider-dependent. Dataset database handlers can map
datasets to per-dataset graph/vector backends and resolve credentials at runtime,
but Cognee does not manage the operational lifecycle of those provisioned
databases
([dataset database handlers](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/dataset-database-handlers-what-are-they)).
Self-hosted Neo4j is explicitly not supported for multi-user mode with backend
access control; Neo4j multi-user support goes through the Aura dataset handler
([permissions setup](https://docs.cognee.ai/setup-configuration/permissions)).

## Retrieval

Cognee v1.0 centers the memory lifecycle around `remember`, `recall`,
`improve`, and `forget`; lower-level `add`, `cognify`, `search`, and `memify`
remain available for staged control
([introduction](https://docs.cognee.ai/getting-started/introduction),
[remember](https://docs.cognee.ai/core-concepts/main-operations/remember),
[recall](https://docs.cognee.ai/core-concepts/main-operations/recall)).

The HTTP API documents retrieval modes including `GRAPH_COMPLETION`,
`RAG_COMPLETION`, `CHUNKS`, `SUMMARIES`, `TRIPLET_COMPLETION`,
`CHUNKS_LEXICAL`, `CODING_RULES`, `TEMPORAL`, graph-completion variants,
`CYPHER`, `NATURAL_LANGUAGE`, and `FEELING_LUCKY`
([API](https://docs.cognee.ai/api-reference/introduction)). The TypeScript SDK
documents all 15 search types as supported from Node
([TypeScript](https://docs.cognee.ai/typescript/getting-started)).

Retrieval is not just vector search: `GRAPH_COMPLETION` combines vector seeds
with graph expansion, while `TRIPLET_COMPLETION` uses precomputed triplet text
without graph expansion
([llms-full export](https://docs.cognee.ai/llms-full.txt)). `recall()` adds
session-aware behavior and source tagging, while direct `search()` exposes more
advanced retrieval parameters
([recall](https://docs.cognee.ai/core-concepts/main-operations/recall)).

Important limitation for adapters: the HTTP `POST /api/v1/search` endpoint does
not accept every advanced Python SDK search parameter, and HTTP `remember`
cannot send live Python objects such as a custom chunker instance or a Python
`graph_model` class; those remain SDK-only or JSON-schema-only over HTTP
([API](https://docs.cognee.ai/api-reference/introduction)). That is acceptable
for a driver boundary, but it argues against treating HTTP as feature-complete
parity with Python.

## Provenance/temporal/ontology

Cognee has useful provenance plumbing, but it is not the same as the repo's
required professional-runtime authority model. `DataPoint` objects carry
timestamps, version, indexing hints, and contextual fields; `add_data_points`
writes provenance records to the relational store when run inside a pipeline
context
([DataPoints](https://docs.cognee.ai/core-concepts/building-blocks/datapoints)).
The architecture page also assigns document/chunk provenance to the relational
store
([architecture](https://docs.cognee.ai/core-concepts/architecture)).

Cognee deletion semantics show better-than-basic source ownership: when a
single data item is forgotten, Cognee uses per-document ownership records to
delete graph/vector memory owned only by that source while preserving shared
nodes still referenced elsewhere
([forget](https://docs.cognee.ai/core-concepts/main-operations/forget),
[llms-full export](https://docs.cognee.ai/llms-full.txt)). This is a good
portable pattern for cache/projection cleanup.

The temporal story is mixed. Native temporal mode extracts events and timestamps
into Cognee's graph and can be queried with `SearchType.TEMPORAL`; Graphiti mode
stores documents as timestamped episodes and lets Graphiti derive changing
facts, but it requires the `graphiti` extra and Neo4j/AuraDB
([time awareness](https://docs.cognee.ai/guides/time-awareness)). This is useful
for time-aware retrieval, but it does not replace the repo's desired event-log,
accepted-claim lifecycle, or bitemporal professional truth model
(`standards/memory-architecture/01-memory-layer-taxonomy.md`,
`goals/agentic-professional-runtime/README.md`).

Ontology support is a real Cognee strength. The docs describe OWL ontology
upload/delete/list endpoints for Cognee Cloud, `ontology_key` usage in cognify
and remember flows, and using ontologies to constrain which entity types and
relationships extraction should look for
([configuration and ontologies](https://docs.cognee.ai/cognee-cloud/functionality/configuration-and-ontologies),
[API](https://docs.cognee.ai/api-reference/introduction),
[ontologies](https://docs.cognee.ai/core-concepts/further-concepts/ontologies)).
This confirms Cognee as an ontology-UX donor, not as the authority owner of the
ontology itself.

## Integration surface

Python is still the deepest surface. The Python API reference covers the main
memory operations, configuration, datasets, sessions, update, push/sync, and
maintenance surfaces
([Python API](https://docs.cognee.ai/python-api)). Several advanced behaviors
remain Python-only or richer in Python than HTTP, including custom chunker
instances, Python graph-model classes, and some advanced search parameters
([API](https://docs.cognee.ai/api-reference/introduction)).

TypeScript is now materially better than prior repo notes implied. The official
docs publish `@cognee/cognee-ts`, a Node.js SDK over `cognee-rs`/Neon with
`remember`, `recall`, `improve`, `forget`, dataset/session managers, lower-level
`add`/`cognify`/`search`, all 15 search types, and `serve`/`disconnect`
([TypeScript](https://docs.cognee.ai/typescript/getting-started)). It is still a
native binding/Rust-backed SDK, not an Effect package, so the repo should wrap it
behind a TypeScript driver instead of importing it into domain code.

HTTP is clean enough for service integration. The REST API uses `/api/v1`,
supports add/cognify/search/dataset/agent/remember/recall/improve/forget
endpoints, and can run locally without authentication or in Cloud with an
`X-Api-Key` header
([API](https://docs.cognee.ai/api-reference/introduction)).

MCP is the strongest dev-tooling surface but also the noisiest operationally.
Cognee MCP exposes 14 tools, supports standalone and API modes, and can be
reached over stdio, Streamable HTTP `/mcp`, or SSE `/sse`
([MCP overview](https://docs.cognee.ai/cognee-mcp/mcp-overview),
[MCP local setup](https://docs.cognee.ai/cognee-mcp/mcp-local-setup),
[MCP tools](https://docs.cognee.ai/cognee-mcp/mcp-tools)). The docs call out
that the MCP Docker image is several GB because it bundles document-processing
dependencies, has no published slim/CPU-only image yet, and does not
automatically refresh backend JWTs when running against an authenticated API
backend
([MCP local setup](https://docs.cognee.ai/cognee-mcp/mcp-local-setup)).

Cognee Cloud and MCP are separate systems with different authentication schemes:
MCP's `API_URL`/`API_TOKEN` mode is for self-hosted backends, while Cloud uses
`--serve-url`/`COGNEE_BASE_URL` plus `--serve-api-key`/`COGNEE_API_KEY`
([MCP cloud connection](https://docs.cognee.ai/cognee-mcp/mcp-cloud-connection)).

## License, pricing & maturity

Cognee core is Apache-2.0 according to the official introduction, which clears
the repo's OSI/no-copyleft gate for the project itself
([introduction](https://docs.cognee.ai/getting-started/introduction)). Backend
selection still matters: using SSPL or other non-OSI external stores would need
a separate dependency decision, even if Cognee itself is permissive.

Cognee Cloud pricing is usage-based: the docs say token usage is $2.50 per 1M
tokens, the first workspace is free, each additional workspace is $5/month, the
free workspace includes unlimited users and unlimited API calls, and credits are
managed through prepaid Stripe top-ups
([account and billing](https://docs.cognee.ai/cognee-cloud/functionality/account-and-billing)).
The API docs also claim 99.9% uptime SLA for the managed tenant endpoint
([API](https://docs.cognee.ai/api-reference/introduction)).

Maturity is active but still moving quickly. The docs' changelog export shows
v1.0.0 introduced the high-level memory lifecycle, v1.0.3 added session
lifecycle APIs and dashboard support, and v1.1.1 added agent-management APIs,
custom graph-model support in REST `remember`, graph visualization improvements,
and multiple PGVector/remember/session stability fixes
([llms-full export](https://docs.cognee.ai/llms-full.txt)). That pace is good
for a donor and risky for a core professional runtime dependency.

Operational caveats in the docs are not hypothetical: local file-backed stores
need idle/stop-the-world backup discipline, Kuzu has file-locking limitations
for concurrent multi-process use, PGVector can fan out connections per active
dataset, and MCP's image/auth details add maintenance burden
([setup](https://docs.cognee.ai/setup-configuration/overview),
[graph stores](https://docs.cognee.ai/setup-configuration/graph-stores),
[PGVector handler](https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/existing-dataset-database-handlers/pgvector),
[MCP local setup](https://docs.cognee.ai/cognee-mcp/mcp-local-setup)).

## Role A assessment

Role A is "product-runtime memory": donor/cache/projection behind `drivers/*`,
never system of record. Cognee fits that role only if kept behind a strict
adapter and treated as rebuildable or disposable derived state. Its best donor
patterns are:

- the relational/vector/graph split for a projection shell
  ([architecture](https://docs.cognee.ai/core-concepts/architecture));
- `DataPoint` as a typed, versioned, embeddable graph unit with deterministic
  identity support through dedup fields
  ([DataPoints](https://docs.cognee.ai/core-concepts/building-blocks/datapoints));
- `remember`/`recall`/`improve`/`forget` as a compact memory-control-plane UX
  ([remember](https://docs.cognee.ai/core-concepts/main-operations/remember),
  [recall](https://docs.cognee.ai/core-concepts/main-operations/recall),
  [improve](https://docs.cognee.ai/core-concepts/main-operations/improve),
  [forget](https://docs.cognee.ai/core-concepts/main-operations/forget));
- ontology upload/use and graph-model prompting as UX references for
  domain-specific extraction
  ([ontologies](https://docs.cognee.ai/core-concepts/further-concepts/ontologies),
  [configuration and ontologies](https://docs.cognee.ai/cognee-cloud/functionality/configuration-and-ontologies));
- Postgres/PGVector/Neo4j/Kuzu/Falkor-style backend lessons for projection
  storage choices
  ([relational DBs](https://docs.cognee.ai/setup-configuration/relational-databases),
  [vector stores](https://docs.cognee.ai/setup-configuration/vector-stores),
  [graph stores](https://docs.cognee.ai/setup-configuration/graph-stores)).

Role A should **not** use Cognee to own accepted claims, human approvals,
professional judgment, legal facts, client records, or source spans. Cognee's
graph is built from LLM extraction, embeddings, enrichment, and optional
session promotion
([remember](https://docs.cognee.ai/core-concepts/main-operations/remember),
[improve](https://docs.cognee.ai/core-concepts/main-operations/improve)); the
repo's runtime requires accepted candidate writes to promote into authoritative
state only after policy/human review
(`goals/agentic-professional-runtime/README.md`).

Role A verdict: **conditional PASS as a donor/cache/projection, FAIL as a
foundation**. If used, put Cognee behind a driver with explicit import/export,
source-span back-pointers, TTL/prune policy, and rebuild semantics. Do not put
it in the core domain model.

## Role B assessment

Role B is "dev-tooling memory for Claude/Codex agents." Cognee has appealing
tooling: MCP exposes `remember`, `recall`, `forget`, `improve`, lower-level
`cognify`/`search`, dataset operations, status checks, document/chunk retrieval,
and session-aware recall
([MCP overview](https://docs.cognee.ai/cognee-mcp/mcp-overview),
[MCP tools](https://docs.cognee.ai/cognee-mcp/mcp-tools)). Cloud adds UI
surfaces for workspace search, skills, API keys, billing, and agent-run
visibility
([Cognee Cloud](https://docs.cognee.ai/cognee-cloud/overview),
[skills UI](https://docs.cognee.ai/cognee-cloud/ui/skills)).

The operational burden is too high for this repo's one-survivor dev-tooling
slot. MCP's Docker image is large, there is no published slim/CPU-only image
yet, API-mode JWTs do not auto-refresh, default container data disappears unless
you bind a volume, and some MCP dataset scoping is name-based where REST/Python
can use `dataset_ids`
([MCP quickstart](https://docs.cognee.ai/cognee-mcp/mcp-quickstart),
[MCP local setup](https://docs.cognee.ai/cognee-mcp/mcp-local-setup),
[MCP tools](https://docs.cognee.ai/cognee-mcp/mcp-tools)).

Recall quality is likely good for ontology-shaped graph recall and UX-driven
agent memory, but Cognee's official temporal story either uses native extracted
events or delegates episode/fact evolution to Graphiti mode with Neo4j
([time awareness](https://docs.cognee.ai/guides/time-awareness)). That means
Cognee does not beat Graphiti on the one capability this repo already valued
Graphiti for: temporal/session memory shape
(`standards/memory-architecture/01-memory-layer-taxonomy.md`,
`standards/memory-architecture/03-saas-landscape-assessment.md`).

Role B verdict: **FAIL as the surviving dev-tooling incumbent**. Keep Cognee as
a reference or occasional lab when ontology UX, Cloud UI, or MCP memory-control
experiments matter. Do not keep it as the second always-on agent-memory system
beside Graphiti.

## Contradictions with prior repo assessments

- `standards/memory-architecture/05-context-graph-capability-assessment.md`:
  **confirmed with caveats**. The prior claim that Cognee leads memory UX and
  ontology ergonomics is supported by official docs for Cloud UI, Skills, MCP
  tools, `remember`/`recall`/`improve`/`forget`, ontology uploads,
  and graph-model/schema flows
  ([MCP tools](https://docs.cognee.ai/cognee-mcp/mcp-tools),
  [configuration and ontologies](https://docs.cognee.ai/cognee-cloud/functionality/configuration-and-ontologies),
  [DataPoints](https://docs.cognee.ai/core-concepts/building-blocks/datapoints)).
  The caveat is that "leads" is a UX/donor conclusion, not evidence that Cognee
  should own durable memory truth.
- `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md`:
  **mostly confirmed, but one point is stale**. The donor doc correctly frames
  Cognee as a memory-UX/ontology-ergonomics donor with poly-store architecture,
  `DataPoint` modeling, and Apache-2.0 licensing
  ([architecture](https://docs.cognee.ai/core-concepts/architecture),
  [DataPoints](https://docs.cognee.ai/core-concepts/building-blocks/datapoints),
  [introduction](https://docs.cognee.ai/getting-started/introduction)). Its
  "TS fit is REST/MCP, not native" claim is now only partly true because the
  official docs publish `@cognee/cognee-ts`; the better current statement is
  "TS SDK exists, but it is Rust/Neon-backed and not Effect-native"
  ([TypeScript](https://docs.cognee.ai/typescript/getting-started)).
- `standards/memory-architecture/03-saas-landscape-assessment.md`: **not
  contradicted, but incomplete for this decision**. That document has no Cognee
  entry, so it cannot decide the Cognee-vs-Graphiti incumbent question. Its
  Graphiti conclusion still matters: Graphiti's temporal validity/session
  pattern remains the stronger reason to keep Graphiti if only one dev-tooling
  memory system survives (`standards/memory-architecture/03-saas-landscape-assessment.md`,
  [time awareness](https://docs.cognee.ai/guides/time-awareness)).

Net cross-check: prior repo doctrine remains intact. Cognee should influence UX,
ontology workflows, and adapter design. It should not survive as an always-on
second incumbent dev-tooling memory system, and it should not become the product
runtime's memory authority.

## References

Fetched and cited official Cognee URLs:

- https://docs.cognee.ai/llms.txt — official docs index fetched live.
- https://docs.cognee.ai/llms-full.txt — full-site export fetched live for
  release-note and page-source cross-checks.
- https://docs.cognee.ai/getting-started/introduction — license and core memory
  lifecycle framing.
- https://docs.cognee.ai/api-reference/introduction — REST API, self-hosting,
  Cloud/local split, search types, and HTTP limitations.
- https://docs.cognee.ai/core-concepts/architecture — relational/vector/graph
  architecture.
- https://docs.cognee.ai/core-concepts/building-blocks/datapoints — DataPoint
  model, indexing, provenance, versioning, and dedup semantics.
- https://docs.cognee.ai/core-concepts/main-operations/remember — permanent vs
  session memory ingestion.
- https://docs.cognee.ai/core-concepts/main-operations/recall — session-aware
  and graph-backed retrieval.
- https://docs.cognee.ai/core-concepts/main-operations/improve — enrichment,
  feedback weighting, and session-to-graph bridge.
- https://docs.cognee.ai/core-concepts/main-operations/forget — deletion and
  memory cleanup semantics.
- https://docs.cognee.ai/core-concepts/further-concepts/ontologies — ontology
  support.
- https://docs.cognee.ai/guides/time-awareness — native temporal mode vs
  Graphiti mode.
- https://docs.cognee.ai/cognee-cloud/overview — managed Cloud positioning.
- https://docs.cognee.ai/cognee-cloud/functionality/account-and-billing —
  pricing and billing.
- https://docs.cognee.ai/cognee-cloud/functionality/configuration-and-ontologies
  — Cloud ontology upload and graph-model helpers.
- https://docs.cognee.ai/cognee-cloud/ui/skills — skills UI.
- https://docs.cognee.ai/cognee-mcp/mcp-overview — MCP role and architecture
  modes.
- https://docs.cognee.ai/cognee-mcp/mcp-quickstart — MCP Docker startup and
  persistence note.
- https://docs.cognee.ai/cognee-mcp/mcp-local-setup — MCP transports, auth,
  image-size caveats, and deployment settings.
- https://docs.cognee.ai/cognee-mcp/mcp-tools — MCP tool surface and parameter
  limitations.
- https://docs.cognee.ai/cognee-mcp/mcp-cloud-connection — Cloud vs self-hosted
  MCP connection modes.
- https://docs.cognee.ai/python-api — Python SDK surface.
- https://docs.cognee.ai/typescript/getting-started — TypeScript SDK surface.
- https://docs.cognee.ai/setup-configuration/overview — local defaults,
  storage, backups, and configuration.
- https://docs.cognee.ai/setup-configuration/relational-databases — SQLite and
  Postgres relational storage.
- https://docs.cognee.ai/setup-configuration/vector-stores — vector providers
  including PGVector and community adapters.
- https://docs.cognee.ai/setup-configuration/graph-stores — graph providers
  and Kuzu/Neo4j caveats.
- https://docs.cognee.ai/setup-configuration/permissions — access control and
  provider/handler constraints.
- https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/dataset-database-handlers-what-are-they
  — per-dataset backend mapping.
- https://docs.cognee.ai/core-concepts/multi-user-mode/dataset-database-handlers/existing-dataset-database-handlers/pgvector
  — PGVector handler.

Official linked pages attempted but not followed as primary sources:

- https://docs.cognee.ai/llms-core.md — initial direct web open returned no
  useful body, and terminal `curl` failed with DNS resolution blocked in the
  execution sandbox; replaced by live `llms-full.txt` and targeted page fetches.
- https://docs.cognee.ai/llms-cognee-cloud.md — initial direct web open returned
  no useful body; replaced by targeted Cloud page fetches.
- https://docs.cognee.ai/llms-mcp.md — initial direct web open returned no
  useful body; replaced by targeted MCP page fetches.
- https://docs.cognee.ai/llms-api.md — initial direct web open returned no
  useful body; replaced by targeted API, Python, and TypeScript page fetches.
- https://docs.cognee.ai/cognee-cloud/ui/sessions — direct fetch returned an
  internal error, so it is not used as evidence in the assessment.

Repo files read for doctrine and cross-checking:

- `standards/memory-architecture/README.md`
- `standards/memory-architecture/01-memory-layer-taxonomy.md`
- `goals/agentic-professional-runtime/README.md`
- `standards/memory-architecture/05-context-graph-capability-assessment.md`
- `explorations/atlas-synthesis/synthesis/21-external-memory-kg-donors.md`
- `standards/memory-architecture/03-saas-landscape-assessment.md`
