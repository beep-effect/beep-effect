# Agent Memory Stack — Final Recommendation

Date: 2026-07-08. Synthesis of 13 research lanes: 12 codex clone/docs lanes at
`--effort xhigh` plus 1 GPT-5.5 Pro (extended thinking) oracle lane
([oracle-deep-research.md](oracle-deep-research.md)). Lane artifacts with full
citations live beside this file (see [README.md](README.md)). Load-bearing
claims were independently spot-checked against the local clones by the
synthesizing agent (licenses, temporal-edge fields, named provenance graphs,
compose resource limits, hosted-API defaults, release status).

## The answer in two lines

- **Role A (product-runtime memory for `goals/agentic-professional-runtime`):
  adopt NO external memory product as a runtime dependency or authority.**
  Durable truth stays repo-native (claim + evidence + provenance + lifecycle
  in Postgres). Port the verified donor-pattern portfolio below behind
  `drivers/*`. The Oracle lane independently converged on the same authority
  boundary and ranked **TrustGraph's model** as the right Role A *shape* —
  which the repo already implements as port-don't-deploy
  (`goals/trustgraph-port`, `docs/BEEPGRAPH_ARCHITECTURE.md`).
- **Role B (dev-tooling memory for Claude/Codex agents): Cognee survives as
  the single always-on memory incumbent; Graphiti is retired to donor status
  after its bitemporal primitives are ported.** File memory
  (CLAUDE.md / MEMORY.md) remains Layer 1. This flips the synthesizer's
  initial draft (which picked Graphiti); the reversal reasoning and dissent
  are recorded in full below — this was the one point where the Oracle lane
  and the codex lanes genuinely disagreed, and the Oracle's
  criteria-weighting argument, combined with a redundancy argument the Oracle
  did not even make, wins.

## Hard-gate scorecard (Role A)

| Product | Self-host / local-first | License (OSI, no copyleft trap) | TS-native or clean HTTP/MCP | Net |
|---|---|---|---|---|
| **Graphiti (Zep OSS)** | PASS w/ ops caveats (Python + graph DB + LLM/embedder) | PASS — Apache-2.0 (verified `LICENSE`); **FLAG: FalkorDB backend is SSPLv1** | Python sidecar: FastAPI REST + MCP (upstream labels it experimental) | PASS as donor/cache |
| **Cognee** | PASS (all-Postgres/pgvector option; embedded SQLite+LanceDB local stack; full compose reserves 4CPU/8GB + 2CPU/4GB) | PASS — Apache-2.0 (verified) | Sidecar + `@cognee/cognee-ts`; MCP tools deliberately narrow (remember/recall/forget) | PASS as donor/cache |
| **TrustGraph** | PASS but heavyweight (12GB+/8CPU compose; Cassandra/Qdrant/Garage/Pulsar or NATS/FalkorDB/Qdrant TS stack) | PASS — Apache-2.0 (verified) | REST/WebSocket + real TS client + MCP (maturity page says production-ready; the MCP guide itself says it needs a rewrite) | PASS as donor; too heavy to deploy by default |
| **Mem0** | PASS w/ caveats (self-host FastAPI + pgvector default, verified; local MCP [OpenMemory] sunset) | PASS — Apache-2.0 root + TS pkg (verified) | **TS-native OSS SDK (`mem0ai/oss`)** + REST; hosted MCP is Platform-only | PASS as donor/cache |
| **Supermemory** | **FAIL as auditable self-host** — a local binary exists per docs, but the engine is not source-buildable from the OSS repo; the repo's own dev path points at `https://api.supermemory.ai` (verified) | PASS — MIT for what is in the repo (verified) | TS clients/schemas + hosted MCP (managed MCP is platform-only) | FAIL for product role |
| **OriginTrail DKG** | PASS w/ chain caveat (tokenless local WM/SWM/query works; VM finality needs TRAC/gas) | PASS — Apache-2.0 root LICENSE (verified in clone; see Oracle-conflict note) | **Only TS-native candidate** (Node 22+ monorepo, HTTP daemon, 29-tool MCP) | PASS as donor; **release-candidate, README says avoid production** (verified) |

Corrections to prior repo assessments established by this run:
- `03-saas-landscape-assessment.md` calling FalkorDB "open-source" is wrong
  for shipping decisions — SSPLv1, non-OSI (atlas-21's flag confirmed by two
  lanes, including a live fetch of FalkorDB's LICENSE.txt). Any Graphiti
  deployment must choose a gate-passing backend or accept SSPL consciously.
- Supermemory "nothing to take" (03) is **refuted** — document/chunk/memory
  schema split, `updates`/`extends`/`derives` version relations, container-tag
  namespace isolation, and the profile/query/full retrieval-mode split are
  real, source-observed donor patterns. "IGNORE as foundation" is
  **confirmed** (engine opaque, hosted-API-backed).
- Mem0 "external benchmark/reference only" (05) is **too narrow now** — real
  TS OSS implementation, pgvector-default self-host server, and the strongest
  Claude/Codex plugin/lifecycle-hook story of the six; still nowhere near
  authority-grade (no evidence spans, no acceptance lifecycle).
- Graphiti "bi-temporal" wording should be narrowed to "valid-time fields plus
  system timestamps plus episode lineage" — not a transaction ledger with
  claim lifecycle.
- TrustGraph "trust/reputation scoring" (03) is **overstated** — clone shows
  authority-ranking language and `tg:score` retrieval metadata, not a
  claim-trust model. Its provenance shell (three named graphs, PROV-O,
  query-time explainability) remains the strongest of the six.
- **Oracle-conflict note (OriginTrail license):** the Oracle reported
  "no single clear top-level OSI license in the surfaced metadata" for the
  DKG Node repo. The local clone's root `LICENSE` is Apache License 2.0 and
  every package manifest read declares `Apache-2.0` (verified twice). Clone
  evidence wins for the code we actually hold; the Oracle's "no published
  releases" observation stands as an additional maturity caution alongside
  the README's own release-candidate warning.

## Role A — product-runtime memory

**Recommendation: composition of ported patterns; zero external memory
services in the product runtime's authority path or default deployment.**

All thirteen lanes — including the adversarial Oracle lane — converged on the
same boundary: every candidate stores LLM/embedding-derived content without
source-span evidence or acceptance lifecycle, so none is eligible as system of
record. The Oracle's Role A pick (TrustGraph) comes with its own explicit
instruction to "not treat TrustGraph itself as the final source-of-truth
store" but as a semantic/explainability layer over deterministic authority —
which is precisely the architecture the repo already specced as BeepGraph.
The delta between the Oracle ("deploy TrustGraph as that layer") and the repo
doctrine ("port its model into Effect-native packages") is an operational
judgment, and the repo's prior decision stands on footprint grounds the
Oracle itself acknowledged: the port path keeps the provenance model without
the Cassandra/Pulsar/20-container gravity.

The verified, file-level port list:

1. **Bitemporal edge contract — port from Graphiti.** `EntityEdge`
   (`graphiti_core/edges.py:263-285`: `valid_at`, `invalid_at`, `expired_at`,
   `reference_time`, `episodes[]`), `EpisodicNode`
   (`graphiti_core/nodes.py:318-351`), and the supersede-don't-delete
   invalidation mechanics
   (`graphiti_core/utils/maintenance/edge_operations.py:538-847`). Exactly the
   primitive set `explorations/agent-memory-tiers-bitemporal-edges` plans to
   borrow; its Postgres-native decision stands.
2. **Provenance/explainability shell — port from TrustGraph.**
   Three-named-graph split (default facts / `urn:graph:source` /
   `urn:graph:retrieval` — verified `provenance/namespaces.py:142-146`),
   PROV-O trace builders, query-time explainability stages, bounded retrieval
   knobs (entity/triple/subgraph/path limits), Context-Core packaging. Feeds
   `goals/trustgraph-port` + BeepGraph unchanged; the Oracle's Role A verdict
   is best read as independent validation of this exact design.
3. **Projection/cache ergonomics — port from Cognee.** DataPoint metadata +
   embeddable-field annotations, pipeline provenance stamping with a
   relational **rollback ledger** (rebuildable projections with an undo path),
   node-set scoping for case/client/work-product boundaries, and the
   all-Postgres (pgvector + SQL cache + Postgres graph) deployment shape —
   the best Postgres-alignment story of the six.
4. **Extraction discipline — port from Mem0.** ADD-only automatic extraction
   (no LLM-decided UPDATE/DELETE), UUID→integer masking before LLM calls,
   hash-dedup before insert, entity-sidecar linking, semantic+keyword+
   entity-boost fusion over pgvector.
5. **Minor donors.** Supermemory: document/chunk/memory separation, typed
   version relations, container-tag isolation, retrieval-mode split.
   OriginTrail: knowledge-asset lifecycle envelopes
   (create→finalize→share→publish), Merkle commitments over public/private
   partitions, author attestations, fail-closed private-graph gates, explicit
   WM/SWM/VM trust-tier labels — the strongest *verifiable-provenance
   packaging* ideas found and the only TS-native codebase; watchlist for the
   legal verifiability story once V10 exits release-candidate.

If the runtime later wants a **running semantic-governance/projection
service** rather than ported code, the ranked shortlist (updated with the
Oracle's input): (1) **TrustGraph** — best provenance/explainability/ontology
match for the legal domain, accepted-weight decision required; (2) **Cognee**
in all-Postgres mode behind `drivers/*` — best storage alignment, lighter;
(3) **Mem0** self-host with pgvector — lightest, weakest ontology.

## Role B — dev-tooling memory: Cognee survives, Graphiti retires to donor

**This is a reversal of the synthesizer's initial draft, made after the
Oracle lane's dissent.** Recorded honestly:

**Where the lanes stood.** The graphiti-clone lane called Graphiti "credible
but high-maintenance — keep only if temporal graph recall is decisive,
otherwise demote to donor." The zep-docs lane said Graphiti "should not
survive as the primary dev-tooling incumbent" by default. The cognee lanes
said "do not keep Cognee as primary without a live bakeoff" (clone) and "FAIL
as surviving incumbent" (docs). No lane crowned anyone. The initial draft
picked Graphiti on temporal fit, incumbency, and a live weak-recall signal
from the session's Cognee hooks. The Oracle picked **Cognee**, arguing the
brief's actual Role B weights (recall quality, MCP reliability, local
footprint, maintenance burden, TS fit) favor Cognee's MCP packaging, TS SDK,
session-to-permanent bridge, and lighter posture.

**Why the reversal holds up:**

1. **The redundancy argument (decisive, and not one the Oracle made):**
   Graphiti's sole decisive Role B differentiator is its temporal edge model —
   and that is *exactly* what the repo is porting natively into
   `@beep/epistemic-tables` per the exploration packet. Once the port lands,
   keeping a Python+graph-DB+LLM sidecar running for a capability the repo
   owns natively is pure operational overhead. Choosing Graphiti as the
   survivor would mean betting the always-on dev service on its own
   obsolescence.
2. **First-party history:** the repo's own doctrine records that unbounded
   Graphiti use degraded in practice
   (`03-saas-landscape-assessment.md`: "degrades at scale (confirmed by user
   experience)"). The incumbent already failed once in this environment.
3. **Direction of travel:** the environment has already invested in Cognee
   operationally (session-start policy hook, per-prompt recall/save hooks,
   `beepintir` MCP server, cognee plugin skills). Retiring Graphiti is less
   churn than unwinding the Cognee wiring, and resolves the
   CLAUDE.md-vs-hooks drift in favor of what is actually running.
4. **Ontology alignment:** the repo carries substantial ontology tooling and
   an active IP-law ontology program; Cognee's RDF/OWL resolver and
   ontology-guided extraction are the only Role B-viable ontology surface
   among the six.
5. **Where the Oracle was factually off (and it does not change the
   verdict):** its "lighter local posture" claim for Cognee is contradicted by
   Cognee's own compose reservations (4CPU/8GB API + 2CPU/4GB MCP) — but the
   clone lane verified an embedded local stack (SQLite + LanceDB + local graph
   store) and a standalone MCP mode, so a light deployment is real if the
   full stack is avoided. Survival is conditional on running that lighter
   configuration.

**Conditions attached to Cognee's survival (all doctrine-required):**
- Run the embedded/local or all-Postgres profile, not the full compose stack.
- Bound the semantic cache per `standards/memory-architecture/01`:
  TTL/pruning, consolidation (its memify/improve loop is the mechanism),
  node-set scoping per project.
- **A 2-4 week recall bakeoff checkpoint**: today's live signal is poor — the
  Cognee auto-recall hook injected zero relevant memories for prompts *about
  agent memory stacks* in this very session. If recall quality does not beat
  file-memory-only after tuning, the honest fallback is Layer-1 file memory
  alone, not a return to Graphiti.
- Graphiti is decommissioned only **after** the bitemporal primitives port
  lands; until then it stays read-available but stops being written to.
  *(2026-07-25: the port landed via `goals/epistemic-bitemporal-edge-core`;
  the retirement trigger fired — see the 2026-07-25 entry in
  `standards/memory-architecture/04-decision-log.md`. The cleanup list below
  is now actionable at the operator level.)*

**Drafted cleanup (NOT applied):**
1. `CLAUDE.md`: replace the "Graphiti Memory" primary-knowledge-base section
   with Cognee as the single durable dev-memory (bounded-usage guidance
   carried over); move `graphiti:proxy` helpers to a deprecation note.
2. `.mcp.json`: keep the Cognee (`beepintir`) MCP server; remove
   `graphiti-memory` from default-enabled servers after the port milestone.
3. Hooks: keep the Cognee SessionStart policy + recall/save hooks; add the
   bakeoff metric (relevant-recall rate per session) to judge them.
4. Plugin surface: keep `cognee-memory` skills; mark `mcp-graphiti-memory`
   skill deprecated.
5. Adopt Mem0's lifecycle-hook *pattern* (recall-before-prompt,
   store-on-stop, pre-compact summary) as the shape for tuning Cognee's hooks
   — the pattern is the donor idea, not the hosted service.

## Doctrine stress-test (Oracle lane) — verdict: doctrine holds, phrasing sharpened

The GPT-5.5 Pro adversarial pass **upheld** deterministic-first for the
legal/professional domain: "the legal risk of allowing an LLM-generated
proposition to become authoritative without a replayable source chain is too
high." No product or 2026 research result surfaced that undermines "semantic
memory is a managed cache, never source of truth" — consistent with all 12
codex lanes, where every candidate's own architecture (LLM-extracted content,
no evidence spans, no acceptance lifecycle) reads as *confirmation* of the
theorem rather than a counterexample.

Its one substantive amendment is a phrasing upgrade the repo should adopt:
the operative rule is not "no LLMs in memory" but

> **"No uncited LLM output may cross the authority boundary."** LLMs may
> produce provisional semantic artifacts (candidate entities, issue tags,
> contradiction suggestions, relationship proposals) if explicitly marked,
> reversible, and provenance-bound; only deterministic derivation, human
> approval, or quoted source evidence promotes them.

The repo's existing candidate→acceptance gates already implement this; the
Oracle's contribution is the sharper formulation plus two concrete
requirements worth codifying: explicit review states
(`candidate` / `machine-extracted` / `human-reviewed` / `authoritative`) and
a four-class memory layering (authoritative facts+quoted sources / derived
semantic graph / operational agent state / opinions+work product) governed
separately rather than by one slogan. Both slot directly into the
`agent-memory-tiers-bitemporal-edges` schema work.

## Proposed durable records (drafted, NOT applied)

**A. `standards/memory-architecture/04-decision-log.md` — new entry (draft):**

> ### 2026-07-08 — External memory stack: donor portfolio confirmed; Cognee
> is the sole dev-memory incumbent; doctrine phrasing sharpened
> Six products (OriginTrail, TrustGraph, Graphiti, Cognee, Supermemory, Mem0)
> were evaluated at clone+docs depth plus a GPT-5.5 Pro adversarial pass
> (`docs/agent-memory-infra/`). Decisions: (A) no external memory service
> enters the product runtime; donor portfolio refreshed (see 05 deltas);
> bitemporal/provenance/projection patterns are ported repo-native. (B)
> Cognee (bounded, embedded/all-Postgres profile) is the sole always-on
> dev-tooling memory; graphiti-memory is decommissioned after the
> `@beep/epistemic-tables` bitemporal port lands; a recall bakeoff gate
> applies, with Layer-1 file memory as the fallback. (C) Deterministic-first
> survives adversarial review; adopt the sharper rule "no uncited LLM output
> may cross the authority boundary" plus explicit review states.

**B. `05-context-graph-capability-assessment.md` — refresh deltas (draft):**
- FalkorDB: annotate SSPLv1 explicitly wherever it appears as "the projection
  engine"; Graphiti-with-FalkorDB bundles inherit the flag.
- mem0: upgrade from "external benchmark/reference only" to "donor for
  ADD-only extraction, entity linking, hybrid scoring, pgvector self-host;
  real TS OSS SDK; hosted MCP/plugin lifecycle-hook ergonomics reference".
- Supermemory: add entry (absent from 05; 03's IGNORE is stale) — "LEARN
  (schemas, version relations, container tags, retrieval modes); engine
  opaque; never foundation".
- Cognee: add "sole dev-tooling incumbent (bounded); MCP public surface is
  narrow by design; heavy full-compose defaults — use embedded/all-Postgres
  profile; strongest ontology + Postgres-alignment reference".
- OriginTrail DKG: add entry — "TS-native RDF/SPARQL projection + KA
  lifecycle / Merkle-commitment provenance packaging donor; Apache-2.0;
  release-candidate; tokenless local mode covers WM/SWM/query; watchlist".
- Graphiti: narrow "bi-temporal" wording; add MCP-experimental caveat; mark
  as "primary bitemporal port donor, deployment retiring post-port".

**C. `explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md` — fork
answers (draft):**
- Sourcing/licensing → borrow shapes from Apache-2.0 Graphiti only (files
  cited in [graphiti-clone.md](graphiti-clone.md)); no SSPL code paths.
- Durable truth location → re-affirmed: Postgres repo-native via
  `@beep/epistemic-tables` + `@beep/drizzle` (all thirteen lanes concur).
- Ownership vs consume/defer → unchanged; FalkorDB/GraphRAG stay deferred to
  `goals/trustgraph-port`; add Cognee's rollback-ledger pattern as a new
  consume-idea for projection rebuild/undo.
- CONTRADICTS edge + supersededBy lineage → adopt Graphiti's
  invalidate-don't-delete semantics as the reference shape; add the Oracle's
  review-state enum (`candidate`/`machine-extracted`/`human-reviewed`/
  `authoritative`) to the edge lifecycle schema.

**D. CLAUDE.md / hooks / MCP cleanup** — as listed under Role B above.

## Method + provenance

- 12 codex lanes (xhigh), each with per-claim citations — file paths with
  line ranges for clone lanes, URLs for docs lanes. One lane
  (origintrail-docs) had DNS-blocked fetches and correctly reported itself
  non-decisive; the origintrail-clone lane supplied the missing evidence.
- Oracle lane: bundle rendered from the approved 10-file set; submitted
  manually by the user to GPT-5.5 Pro (extended thinking); transcript in
  [oracle-deep-research.md](oracle-deep-research.md). Its citations are
  ChatGPT-internal markers, so its factual claims were treated as
  lane-verified only where the codex lanes or synthesizer spot-checks agree;
  two claims were rejected on clone evidence (OriginTrail root license;
  Cognee "lighter posture" as stated).
- Synthesizer spot-checks: re-read the cited LICENSE files, `edges.py`,
  `namespaces.py`, compose files, `server/main.py`,
  `CONTRIBUTING.md`/`.env.example`, and the DKG README/MCP search — all
  matched the lanes' claims exactly.
- Residual uncertainty: Graphiti "degrades at scale" remains a first-party
  observation; Cognee-vs-Graphiti recall quality has no head-to-head local
  bakeoff yet — which is why the Role B decision carries an explicit bakeoff
  gate with a file-memory fallback rather than a return path to Graphiti.
