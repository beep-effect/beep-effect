# OpenLink ai-agent-skills — mining synthesis

**Date:** 2026-08-10 · **Method:** 7 parallel Codex lanes (gpt-5.6-sol, reasoning=high), each
producing one report in this directory, plus a prior Fable pass over `agent-rdf-memory/` and
the AI Barrister Flight Simulator paper. Mined clone:
`~/YeeBois/research/daily/08-10-2026/ai-agent-skills/` (upstream:
https://github.com/OpenLinkSoftware/ai-agent-skills, MIT).

## Verdict / packet thesis

The corpus is **contract-rich and enforcement-poor**. Every lane found the same shape:
extraordinarily detailed behavioral contracts (a 65-gate infographic delivery contract, a
105-step RDF preferences graph, 15-point report gates, five-gate RDF-View deployment) enforced
by regex/substring validators that cannot validate them — and generator code that violates its
own contract, with drift *between prose copies* as the dominant failure mode. Kingsley's crew
has spent a year discovering, in production, **what the contract for agent work should say**;
they lack the type system to make any of it executable.

That's the packet: **port the contract shapes into Effect Schema, where the contract and the
gate are the same object.** beep-effect's schema-first stack (decode-or-die, LiteralKit
domains, derived guards, lint-enforced artifacts) is precisely the missing enforcement layer.
The parked `md-render-as-encode` idea completes it: one canonical typed model, human-readable
projections rendered as `S.encode`, gates as re-extraction + comparison.

## Cross-lane convergences (the five load-bearing patterns)

1. **Acceptance ≠ semantic success — the evidence ladder.** ActivityPub persisted a Like while
   returning HTTP 405, accepted an Undo (201) without reversing state; WebDAV skills separate
   "deployable" from "deployed"; A2A requires terminal task state, not a 200. Port: a typed
   proof ladder — `Accepted → Persisted → Delivered → SemanticallyApplied` and terminal
   `LiveVerified | DeployableBlocked | FailedWithPartialEffects` — as the completion algebra
   for every fleet operation. (protocols.md, ops-publishing.md)

2. **Discovery before invocation, as a state machine.** Agent Card before A2A tasks;
   host-meta → WebFinger → Actor before ActivityPub writes; capability probes before S3 query
   planning; live-config reads before OSDI/broker mutation. The lesson from their QA logs:
   *guessed endpoints fail; discovered endpoints are part of correctness.* Port: phase-typed
   workflows where undiscovered/unauthenticated states are uncallable by construction.
   (protocols.md, query-skills.md, ops-publishing.md)

3. **Authoritative-artifact re-extraction.** YouID's best gate re-extracts the public key from
   the deployable PKCS#12 and compares it against every projection (Turtle, JSON-LD, RDFa,
   HTML) rather than trusting intermediate template data. Generalizes to: canonical typed
   model → N rendered projections → gate = re-extract each and prove equality. This is the
   enforcement mechanism `md-render-as-encode` needs. (identity-commerce.md)

4. **Bounded recovery with audit receipts.** uriburner's KG loop names its budgets as data
   (query count, per-query timeout, retry count, total time) and aborts into a structured
   no-result receipt (every query, endpoint, timestamp, status, reason) instead of
   synthesizing unbacked text. data-twingler bounds recovery at three semantic variants then
   pivots. Port: typed retry/fallback algebra + serializable receipts — anti-hallucination
   epistemics as data, feeding the epistemic/evidence stack. (meta-authoring.md,
   query-skills.md)

5. **Provenance is claimed, never proven.** The corpus demands "no fabrication, preserve exact
   wording" everywhere, but stores no source spans — provenance stops at document-level
   `prov:wasGeneratedBy`. The kg-output corpus shows the result: parseable graphs with literal
   `rdfs:subClassOf` strings, drifted authority IRIs, self-reported PASS. This is exactly the
   gap the citation-verified-span substrate fills; the AI Barrister paper supplies the
   evaluation layer (gold reasoning paths, path-alignment/node-coverage metrics).
   (kg-pipeline.md, sources/ai-barrister-flight-simulator.md)

## Top ten ports (ranked across lanes)

1. **SkillContract + Gate registry + Evidence receipt** — `SkillContract`, `Gate` (id,
   severity, applicability, typed evidence, remediation owner), `FailureReceipt` as Effect
   Schemas; `Complete` unreachable without blocking-gate evidence. Seeds: the 65-gate map
   (rdf-infographic.md), anti-drift triad in AGENTS.md (meta-authoring.md).
2. **Evidence-ladder completion algebra** — the pattern-1 ADT, applied to yeet-style ops,
   browser QA, and fleet handoffs. Seeds: protocols.md §fediverse, ops-publishing.md §gates.
3. **Typed ingestion pipeline for source→KG** — `IngestionManifest` (frozen inputs),
   phase-typed state machine with compensations, canonical-IRI policy service returning
   evidence-bearing decisions, claim-level source-span ledger emitting PROV-O. Seeds:
   kg-pipeline.md ports 1–4; direct feed into legal/patent KG.
4. **Bounded KG retrieval loop with receipts** — pattern 4 as a `Context.Service`; budgets in
   schema, strict/permissive epistemic modes. Seed: meta-authoring.md port 2.
5. **A2A/ActivityPub typed protocol contracts** — AgentCard/JSON-RPC/task schemas; tagged
   Activity union with permissive inbound codecs, canonical outbound encoders; shared OAuth
   service (PKCE, state, secret refs). Seeds: protocols.md ports 1–4.
6. **Query-plan state machine + result codecs** — intent → endpoint/capability → compile →
   validate → execute → decode → evidence envelope; SPARQL structural gates as parsers in CI.
   Seeds: query-skills.md ports 1–9.
7. **Credential-chain + delegation state machine** — `Generated → Published → Presented →
   Dereferenced → KeyMatched → ACLAuthorized`; bilateral delegation as signed scoped grants.
   Agent identity for the fleet. Seeds: identity-commerce.md ports 1–3.
8. **Fresh-ref leases + capability-scoped browser automation** — pinchtab's ref epochs,
   `--snap-diff` postconditions, tab locks with fencing, human-handoff as protocol state,
   default-off capability set. Direct upgrades to the beep qa/browser loop. Seed:
   ops-publishing.md ports 2, 9, 11.
9. **Gold-reasoning-path evaluation for legal KG** — LKG scenario subgraphs + gold paths;
   CVR/HAR/PA/NC as schema-checkable CI gates over agent reasoning. Seed: the AI Barrister
   paper + kg-pipeline.md provenance leads.
10. **Intent→context routing manifest as data** — the agent-rdf-memory PromptIntent idea
    (routesToTopic / requiresHowTo / retrievalPolicy) as a schema-validated manifest shared by
    the Claude/Codex/Grok fleet; plus the transcript-audit gate proving memory reads preceded
    first response. Seed: prior agent-rdf-memory pass.

## Proposed exploration packet

- **Working name:** `typed-agent-skill-contracts` (alt: `openlink-corpus-ports`)
- **Thesis:** Agent skills, protocol clients, and KG pipelines should be typed contracts with
  executable gates and evidence receipts — not prose plus regex. Mine the OpenLink corpus's
  battle-tested contract *shapes*, port them Effect-native, and wire the evidence layer into
  the existing epistemic/citation-span/QA stacks.
- **Tracks for the research phase:**
  a. Contract kernel: SkillContract/Gate/Evidence/FailureReceipt schemas + evidence-ladder ADT
     (ports 1–2).
  b. KG ingestion + eval: typed pipeline, IRI policy, span ledger, Barrister-style gold-path
     gates (ports 3, 9).
  c. Fleet protocol surface: A2A/ActivityPub/OAuth typed clients + credential chain
     (ports 5, 7).
  d. Query/browser operations: query-plan machine, ref leases, capability set (ports 6, 8).
  e. Memory routing: intent→context manifest + transcript-audit gate (port 10).
- **Dead ends (don't re-litigate):** porting any of their validators/implementations verbatim;
  Virtuoso-specific DET/VSP internals without a real RDFImport source; dual-language parity
  stacks; regex mutation of structured formats; kg-output as gold fixtures; the acp-client
  "protocol" (it's commerce REST); OWL-as-documentation without a reasoner or schema.

## Report index

| report | lane | headline steals (score ≥4) |
|---|---|---|
| [protocols.md](protocols.md) | a2a, acp, fediverse, osdi, opml/rss | a2a-client (5), fediverse-crud (4), osdi gate (4) |
| [kg-pipeline.md](kg-pipeline.md) | kg-generator, document-to-kg, DET×2, describer, outputs | kg-generator (4), document-to-kg (4) |
| [rdf-infographic.md](rdf-infographic.md) | the 534-file flagship | the 65-gate contract (4); validators are the anti-pattern |
| [query-skills.md](query-skills.md) | twingler, dbpedia/wikidata/s3, linked-data, virtuoso | linked-data-skills (5), data-twingler (4), s3-query (4) |
| [identity-commerce.md](identity-commerce.md) | youid, mtls, licenses, offers, stripe | youid (5), mtls-curl (4), offers SHACL (4) |
| [ops-publishing.md](ops-publishing.md) | dsn, broker, screencast, pinchtab, webdav publishing | pinchtab (5), weblog-from-webdav (5), website (4), screencast (4) |
| [meta-authoring.md](meta-authoring.md) | AGENTS.md, assembler, uriburner, templates, WC2026 | authoring contract (4), uriburner loop (4), WC2026 pair (4) |
| [ai-barrister-flight-simulator.md](ai-barrister-flight-simulator.md) | ICLR'26 workshop paper | gold-path metrics as CI gates |

Prior pass (Fable, this session): `agent-rdf-memory` — hub-and-spoke sparse manifest,
PromptIntent routing ontology, MemoryWriteTrigger vocabulary, transcript-audit gate, symbolic
log offloading. Files cached in session scratchpad; skill lives at
`../ai-agent-skills/agent-rdf-memory/`.
