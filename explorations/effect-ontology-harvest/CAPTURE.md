# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-11

The [effect-ontology](https://github.com/mepuka/effect-ontology) repo
(local checkout: `~/YeeBois/dev/effect-ontology`), in particular
`packages/@core-v2`, has an enormous amount of patterns, valuable data types,
infrastructure & capabilities.

Figure out what would be easy to map to our infrastructure now that would
provide value for the upcoming goals and the product in general. Distinguish:

- what could go into a new or existing `packages/foundation` family — either
  `modeling` or `capability`;
- what models/structures would already fit nicely into an existing product
  slice.

The goal is NOT to port all capabilities & data models from effect-ontology to
beep-effect — take the valuable pieces for later use, potentially even
improving the design. effect-ontology serves as a nice baseline for reference.

Method: codex GPT-5.6-Sol sub-agents (ultra reasoning — the `~/.codex`
config default) explore both repos and collect `.md` inventories mapping
useful aspects to our architecture; then each item gets evaluated.

Raw shape of @core-v2 (first orientation pass): Effect v3, ~231 src modules,
106 test files. Clusters: LLM governance (CircuitBreaker,
RateLimitedLanguageModel, TokenBudget/RateLimiter/StageTimeout,
ExecutionDeduplicator, PromptCache, GenerateWithFeedback); content addressing
+ storage (Hash/IdempotencyKey, PathLayout via TemplateLiteralParser, GCS
storage with optimistic locking, Postgres migration harness, 10 migrations
incl. bitemporal + pgvector); durable pipelines (@effect/workflow +
@effect/cluster, progress-streaming contract); domain models (branded
RDF/Identity types, 1040-line Ontology model, entity resolution, 17 tagged
error modules); telemetry with LLM cost calculation; prompt/agent-kit and
schema factories that build extraction schemas from ontologies. Extensive
docs/ (architecture, audits, ERROR_HANDLING, PRODUCTION_SPEC).

Known beep overlap going in: @beep/rdf, @beep/ontology (foundation),
@beep/semantic-web, @beep/provenance, @beep/mcp-kit, ontology slice with
stateless fingerprint-CAS toolkit, epistemic slice. Gaps: no generic
foundation cache/CAS, no LLM-governance capability, no workflow-engine
substrate.

Grilling decisions from the planning session, locked: active-goals-first
scoring, full sweep with design-comparisons, by-source-area fan-out (7 src +
1 docs agents), codex verify gate before evaluation, end state =
align-complete. MIT license upstream ⇒ port-with-attribution.
