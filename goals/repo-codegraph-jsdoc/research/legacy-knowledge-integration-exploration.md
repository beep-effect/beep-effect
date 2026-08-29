# OVERVIEW Legacy Knowledge Integration Exploration

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

## 1. Purpose and Reading Guide
- **Intent**: exploratory synthesis of legacy `knowledge/_docs` ideas/patterns/systems and their possible integration value for the current repo-codegraph-jsdoc direction in [SPEC.md](../SPEC.md).
- **Outcome type**: opportunities and recommended exploratory lanes, not implementation commitments.
- **Claim labeling contract**:
  - `Implemented (Legacy Verified)`
  - `Specified (Legacy Planned)`
  - `Conceptual Opportunity (Current System)`
- **How to read**:
  1. Sections 3-7 reconstruct legacy reality.
  2. Sections 8-14 map and prioritize opportunities.
  3. Sections 15-20 seed next-spec drafting.

---

## 2. Corpus and Verification Scope
### 2.1 In-Scope Sources
| Cluster | Coverage | Claim Tag | Evidence |
|---|---|---|---|
| Top-level `_docs` | architecture intent, functional spec, production spec, persistence, control, streaming | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/INDEX.md`, `.repos/beep-effect/packages/knowledge/_docs/functional_spec.md`, `.repos/beep-effect/packages/knowledge/_docs/PRODUCTION_SPEC.md`, `.repos/beep-effect/packages/knowledge/_docs/README.md` |
| `architecture/` | system architecture, effect patterns, workflow state, embedding architecture | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/architecture/system-architecture.md`, `.repos/beep-effect/packages/knowledge/_docs/architecture/effect-patterns-guide.md`, `.repos/beep-effect/packages/knowledge/_docs/architecture/workflow-state-patterns.md`, `.repos/beep-effect/packages/knowledge/_docs/architecture/embedding-architecture.md` |
| `plans/` | unified extraction, SHACL activity, workflow/storage plans | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/plans/2025-12-19-unified-extraction-pipeline.md`, `.repos/beep-effect/packages/knowledge/_docs/plans/shacl-activity-implementation-plan.md` |
| `ontology_research/` | reasoning/validation/retrieval/entity-resolution recommendations | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md`, `.repos/beep-effect/packages/knowledge/_docs/ontology_research/rdf_shacl_reasoning_research.md`, `.repos/beep-effect/packages/knowledge/_docs/ontology_research/sota_review.md` |
| `audits/` | blocker findings and action plans | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/audits/AUDIT_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md`, `.repos/beep-effect/packages/knowledge/_docs/audits/ACTION_ITEMS.md` |
| `mvp/` | UX/temporal/provenance and case-study-driven requirements | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/mvp/mvp_discussion_research_case_study.md`, `.repos/beep-effect/packages/knowledge/_docs/mvp/UI_UX_RESEARCH_KNOWLEDGE_GRAPH_VIS.md`, `.repos/beep-effect/packages/knowledge/_docs/mvp/ARCHITECTURAL_DECISIONS_MVP.md` |
| `archive/` | historical failure modes and remediation patterns | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/archive/trace-analysis-2025-11-26.md`, `.repos/beep-effect/packages/knowledge/_docs/archive/llm-control-strategy.md`, `.repos/beep-effect/packages/knowledge/_docs/archive/progress-streaming-contract.md` |

### 2.2 Code Verification Pass
| Area | Verification Result | Claim Tag | Evidence |
|---|---|---|---|
| Legacy server runtime | orchestration, pipeline, progress stream, LLM control, persistence present | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/server/src/Workflow/BatchOrchestrator.ts`, `.repos/beep-effect/packages/knowledge/server/src/Extraction/ExtractionPipeline.ts`, `.repos/beep-effect/packages/knowledge/server/src/Workflow/ProgressStream.ts`, `.repos/beep-effect/packages/knowledge/server/src/LlmControl/LlmResilience.ts`, `.repos/beep-effect/packages/knowledge/server/src/Workflow/WorkflowPersistence.ts` |
| Legacy domain/tables | ontology, extraction, mention/relation evidence, SHACL policy types present | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/domain/src/entities/Ontology/Ontology.model.ts`, `.repos/beep-effect/packages/knowledge/domain/src/entities/Extraction/Extraction.model.ts`, `.repos/beep-effect/packages/knowledge/domain/src/values/ShaclPolicy.value.ts`, `.repos/beep-effect/packages/knowledge/tables/src/tables/mention.table.ts`, `.repos/beep-effect/packages/knowledge/tables/src/tables/relation-evidence.table.ts` |
| Legacy client/ui | mostly placeholders; no concrete streaming UX implementation | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/client/src/index.ts`, `.repos/beep-effect/packages/knowledge/ui/src/index.ts` |

### 2.3 Integration Anchor
- Current target architecture: [SPEC.md](../SPEC.md)
- Mapping surface includes `OVERVIEW.md` sections 5-16 and phase model P0-P7.

---

## 3. Legacy System High-Level Reconstruction
| Claim | Claim Tag | Evidence |
|---|---|---|
| Legacy system centered on ontology-constrained extraction pipeline with chunking -> retrieval/context -> entity/relation extraction -> merge/reduction. | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/functional_spec.md`, `.repos/beep-effect/packages/knowledge/_docs/architecture/system-architecture.md` |
| Production direction targeted durable job execution, API + streaming transport, idempotency, persistence, observability, and bounded LLM spend. | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/PRODUCTION_SPEC.md` |
| The docs repeatedly position a deterministic constraints-first system with LLM stages controlled by schema and policy. | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/functional_spec.md`, `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md` |
| Runtime implementation in old server already materialized a large part of the orchestration/pipeline/control stack. | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/server/src/Extraction/ExtractionPipeline.ts`, `.repos/beep-effect/packages/knowledge/server/src/Workflow/BatchOrchestrator.ts`, `.repos/beep-effect/packages/knowledge/server/src/LlmControl/*.ts` |

---

## 4. What Was Actually Built (Verified)
### 4.1 Capability Ledger
| Capability | Legacy Intent | Legacy Runtime Status | Claim Tag | Source Evidence | Transferability | Risk |
|---|---|---|---|---|---|---|
| Workflow orchestration | durable extraction orchestration with retry/failure semantics | implemented | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/server/src/Workflow/BatchOrchestrator.ts`, `.repos/beep-effect/packages/knowledge/server/src/Workflow/ExtractionWorkflow.ts` | high | medium |
| Streaming extraction pipeline | multi-stage extraction and assembly | implemented | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/server/src/Extraction/ExtractionPipeline.ts` | high | low |
| Progress stream primitive | pub/sub progress channel for extraction events | implemented (service primitive) | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/server/src/Workflow/ProgressStream.ts` | high | low |
| LLM resilience wrapper | stage timeout + rate/token controls + retries/fallback behavior | implemented | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/server/src/LlmControl/LlmResilience.ts`, `.repos/beep-effect/packages/knowledge/server/src/LlmControl/RateLimiter.ts`, `.repos/beep-effect/packages/knowledge/server/src/LlmControl/StageTimeout.ts`, `.repos/beep-effect/packages/knowledge/server/src/LlmControl/TokenBudget.ts` | very high | low |
| Workflow persistence | run state persistence and lookup/cancel support | implemented | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/server/src/Workflow/WorkflowPersistence.ts` | medium | medium |
| Ontology metadata model | ontology version/hash/status/namespace model | implemented | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/domain/src/entities/Ontology/Ontology.model.ts`, `.repos/beep-effect/packages/knowledge/tables/src/tables/ontology.table.ts` | high | low |
| Extraction provenance fields | extraction status/timestamps/counters + mention/relation evidence spans | implemented | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/domain/src/entities/Extraction/Extraction.model.ts`, `.repos/beep-effect/packages/knowledge/tables/src/tables/mention.table.ts`, `.repos/beep-effect/packages/knowledge/tables/src/tables/relation-evidence.table.ts` | high | medium |
| SHACL policy type layer | policy + validation report type surfaces | partially implemented | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/domain/src/values/ShaclPolicy.value.ts`, `.repos/beep-effect/packages/knowledge/domain/src/values/ValidationReport.value.ts` | high | medium |
| Workflow idempotency hooks | workflow-level idempotency keys for engine payloads | implemented (workflow-level, not full end-to-end design) | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/server/src/Workflow/ExtractionWorkflow.ts`, `.repos/beep-effect/packages/knowledge/server/src/Workflow/BatchOrchestrator.ts` | medium | medium |

---

## 5. What Was Planned but Not Fully Landed
| Capability Gap | Why It Matters | Claim Tag | Evidence |
|---|---|---|---|
| Unified idempotency fingerprint propagated across all layers with ontology-version invalidation | removes cache bypass and duplicate costly runs | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/README-IDEMPOTENCY.md`, `.repos/beep-effect/packages/knowledge/_docs/archive/idempotency-design.md` |
| First-class claim/assertion model with full bitemporal lifecycle fields | supports timeline and “what did we know when” semantics | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md`, `.repos/beep-effect/packages/knowledge/_docs/mvp/mvp_discussion_research_case_study.md` |
| Hard-wired SHACL validation in workflow (`validateWithPolicy` fail behavior) | turns quality checks from stubs into enforcement | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md`, `.repos/beep-effect/packages/knowledge/_docs/plans/shacl-activity-implementation-plan.md` |
| Full cross-layer progress streaming contract implemented through API/client/UI | needed for usable long-running extraction UX and observability | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/_docs/archive/progress-streaming-contract.md`, `.repos/beep-effect/packages/knowledge/client/src/index.ts`, `.repos/beep-effect/packages/knowledge/ui/src/index.ts` |
| Timeline/feed/cancel/retry UI and client SDK surfaces | necessary to operationalize stream semantics for users | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/mvp/UI_UX_RESEARCH_KNOWLEDGE_GRAPH_VIS.md`, `.repos/beep-effect/packages/knowledge/client/src/index.ts`, `.repos/beep-effect/packages/knowledge/ui/src/index.ts` |
| Reasoning + validation merge in batch workflow as first-class stage | improves consistency and contradiction detection | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md`, `.repos/beep-effect/packages/knowledge/_docs/ontology_research/owl_reasoning_validation_production.md` |

---

## 6. Legacy Pattern Library
### 6.1 Pattern Cards
| Pattern | Problem Solved | How It Worked in Legacy | Prerequisites | Failure Modes | Why It Matters Now | Claim Tag | Evidence |
|---|---|---|---|---|---|---|---|
| Deterministic-constraint extraction pipeline | reduce free-form LLM drift | staged extraction with ontology-scoped constraints | ontology context + stage services | schema drift if constraints skipped | aligns with deterministic-first codegraph approach | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/functional_spec.md`, `.repos/beep-effect/packages/knowledge/server/src/Extraction/ExtractionPipeline.ts` |
| Stage-specific LLM controls | runaway latency/tokens/cost | per-stage timeout + token budgets + rate limiting + retries | policy config + resilience services | mis-tuned budgets can degrade quality | direct fit for `OVERVIEW` sections 11/14 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/server/src/LlmControl/*.ts` |
| Progress streaming contract | visibility for long-running workflows | typed event stream + backpressure policies | stream transport + consumer contracts | slow clients, dropped detail events | maps to MCP/status/reporting layers | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/server/src/Workflow/ProgressStream.ts` |
| Unified idempotency fingerprint | duplicate executions/cache bypass | hash(text, ontology, version, params) propagated across layers | deterministic normalization + storage | key mismatch across boundaries | critical for expensive enrichment + reasoning runs | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/README-IDEMPOTENCY.md`, `.repos/beep-effect/packages/knowledge/_docs/idempotency-implementation.ts` |
| Reason->Validate sequencing | validation over incomplete context | lightweight reasoning before SHACL validation | reasoning profiles + shapes | over-inference, sameAs blowups | directly supports reasoning integration in `OVERVIEW` | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md` |
| Temporal + provenance-first claim model | timeline and correction tracking | bitemporal fields + provenance metadata | schema support + RDF generation | incomplete time dimensions block timeline queries | valuable for claim-level auditability in de-hallucinator loops | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md`, `.repos/beep-effect/packages/knowledge/_docs/mvp/mvp_discussion_research_case_study.md` |
| Workflow state-return discipline | race conditions/state drift | state returned by workflow then synchronized | strict workflow boundary conventions | side-effect writes can race | useful for reliable multi-phase graph updates | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/architecture/workflow-state-patterns.md` |
| Hybrid retrieval refinement (RRF + NLP normalization) | weak retrieval precision/recall | combine lexical+semantic and improve query normalization | embedding + lexical index | complexity overhead | boosts retrieval in `OVERVIEW` section 12 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/sota_review.md`, `.repos/beep-effect/packages/knowledge/_docs/ontology_research/advanced_retrieval_nlp_research.md` |

---

## 7. Anti-Patterns and Failure Modes
| Anti-Pattern / Failure Mode | Consequence | Legacy Signal | Current Relevance | Claim Tag | Evidence |
|---|---|---|---|---|---|
| Missing bitemporal timestamps | timeline and derived-fact queries fail | flagged as MVP blocker | applies to claim-level validation/audit plans | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/audits/AUDIT_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md` |
| Incorrect temporal ontology pattern usage | interoperability/query inconsistency | medium-severity modeling issue | informs contract design for temporal provenance | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md` |
| Over-trusting `owl:sameAs` for entity resolution | inference explosion and incorrect links | explicit warning in reasoning recommendations | relevant to symbol aliasing and canonicalization | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md` |
| Coarse global timeouts/budgets | poor failure attribution and hard tuning | motivation for stage-level control strategy | directly relevant to de-hallucinator and enrichment loops | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/_docs/archive/llm-control-strategy.md` |
| Client/UI streaming not concretized | architecture promise without end-user observability | client/ui placeholders + docs aspirational | avoid repeating this gap in current specing | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/client/src/index.ts`, `.repos/beep-effect/packages/knowledge/ui/src/index.ts`, `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md` |
| Idempotency split across layers | duplicate costly work, inconsistent caching | described as core architecture flaw | high relevance for expensive enrichment/reasoning runs | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/README-IDEMPOTENCY.md`, `.repos/beep-effect/packages/knowledge/_docs/archive/idempotency-architecture.md` |

---

## 8. Integration Surface Against Current `OVERVIEW.md`
| Legacy Pattern | `OVERVIEW.md` Target Section(s) | Integration Surface | Dependency Notes | Claim Tag | Evidence |
|---|---|---|---|---|---|
| Reason->Validate sequencing | 10, 11, 14 | reasoning adapter execution order + validation gate | requires reasoning profiles + conflict model | `Conceptual Opportunity (Current System)` | `./OVERVIEW.md`, `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md` |
| Stage LLM controls | 11, 14, 15 | policy wrapper around claim decomposition/enrichment | needs per-stage metrics + config | `Conceptual Opportunity (Current System)` | `./OVERVIEW.md`, `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md` |
| Progress stream contract | 9, 14, 15 | workflow->transport->client observability envelope | needs transport and consumer contract ownership | `Conceptual Opportunity (Current System)` | `./OVERVIEW.md`, `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md` |
| Unified idempotency | 9, 14, 16 | dedup + cache + ontology-version invalidation | requires normalized fingerprint schema | `Conceptual Opportunity (Current System)` | `./OVERVIEW.md`, `.repos/beep-effect/packages/knowledge/_docs/README-IDEMPOTENCY.md` |
| Temporal/provenance claim model | 11, 13, 15 | claim/evidence/conflict lifecycle for audits | requires claim-record types and migration path | `Conceptual Opportunity (Current System)` | `./OVERVIEW.md`, `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md` |
| Hybrid retrieval refinements | 12, 15 | improved ranking and query normalization | depends on lexical index + embeddings pipeline | `Conceptual Opportunity (Current System)` | `./OVERVIEW.md`, `.repos/beep-effect/packages/knowledge/_docs/ontology_research/sota_review.md` |

---

## 9. Phase-by-Phase Opportunity Map (P0-P7)
| Phase | Opportunity Focus | Opportunity IDs | Claim Tag | Evidence |
|---|---|---|---|---|
| P0 | lock exploratory boundaries and scoring rubric | O26, O27 | `Conceptual Opportunity (Current System)` | `./OVERVIEW.md`, `.repos/beep-effect/packages/knowledge/_docs/INDEX.md` |
| P1 | candidate contracts/types (temporal, claim, idempotency, lifecycle) | O03, O04, O05, O12, O23 | `Conceptual Opportunity (Current System)` | `./OVERVIEW.md`, `.repos/beep-effect/packages/knowledge/_docs/audits/ACTION_ITEMS.md`, `.repos/beep-effect/packages/knowledge/_docs/README-IDEMPOTENCY.md` |
| P2 | deterministic evidence/provenance fidelity and extraction-stage controls | O06, O10, O21, O28 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/server/src/Extraction/ExtractionPipeline.ts`, `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md` |
| P3 | persistence/idempotency/cache and workflow state discipline | O05, O12, O17, O24 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/server/src/Workflow/WorkflowPersistence.ts`, `.repos/beep-effect/packages/knowledge/_docs/architecture/workflow-state-patterns.md` |
| P4 | reasoning+validation and partial-result semantics for enrichment | O01, O02, O09, O14 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md`, `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md` |
| P5 | retrieval/context intelligence and progress/event envelope | O07, O08, O13, O18, O20 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/_docs/ontology_research/sota_review.md` |
| P6 | contradiction/drift and validation-hardening | O11, O15, O16 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/owl_reasoning_validation_production.md`, `.repos/beep-effect/packages/knowledge/_docs/audits/AUDIT_SUMMARY.md` |
| P7 | production policy profiles, observability, scale thresholds | O19, O22, O25 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/_docs/PRODUCTION_SPEC.md` |

---

## 10. Definitive Benefits
The following benefits are treated as **definitive** because they are strongly supported by both legacy docs and verified runtime patterns.

| Benefit | Why Definitive | Related Opportunities | Claim Tag | Evidence |
|---|---|---|---|---|
| Better bounded reliability for LLM-heavy phases | legacy implemented concrete timeout/rate/token services and wrappers | O06, O09, O19 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/server/src/LlmControl/*.ts`, `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md` |
| Stronger validation integrity with pre-validation reasoning | explicit legacy recommendation + direct fit with current reasoning integration goals | O01, O02 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md`, `./OVERVIEW.md` |
| Improved run deduplication/cost control via idempotency fingerprint | legacy identified concrete bypass failure and provided reusable scheme | O05, O24 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/README-IDEMPOTENCY.md`, `.repos/beep-effect/packages/knowledge/_docs/idempotency-implementation.ts` |
| Better provenance/debuggability from structured evidence + audit events | legacy data/tables + audit designs concretely encode this pattern | O03, O10, O12, O21 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/domain/src/entities/Extraction/Extraction.model.ts`, `.repos/beep-effect/packages/knowledge/tables/src/tables/relation-evidence.table.ts`, `.repos/beep-effect/packages/knowledge/_docs/README.md` |
| More robust long-running workflow transparency with progress contract | legacy established full event taxonomy and backpressure semantics | O07, O08 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/server/src/Workflow/ProgressStream.ts` |

---

## 11. Potential Benefits
These remain **potential** (plausible but context-dependent for current system fit/priority).

| Potential Benefit | Why Potential | Related Opportunities | Claim Tag | Evidence |
|---|---|---|---|---|
| Claim/Assertion-first storage could improve contradiction explainability | requires additional model/storage complexity and migration decisions | O04, O11, O23 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md`, `./OVERVIEW.md` |
| Hybrid retrieval refinements could improve query quality | depends on corpus/profile/latency tradeoffs in current architecture | O13, O18, O20 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/sota_review.md`, `.repos/beep-effect/packages/knowledge/_docs/ontology_research/advanced_retrieval_nlp_research.md` |
| TBox/ABox separation might increase portability and test clarity | may add operational overhead if current monorepo requirements differ | O16 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md` |
| External reasoner thresholds could support future scale | unclear near-term necessity and operational burden for current target scope | O25 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md` |
| Full timeline UI patterns could improve analyst UX | current scope is architecture/spec exploration, not product UI roadmap | O22 | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/mvp/UI_UX_RESEARCH_KNOWLEDGE_GRAPH_VIS.md`, `.repos/beep-effect/packages/knowledge/ui/src/index.ts` |

---

## 12. Opportunity Catalog (Exhaustive)
### 12.1 Opportunity IDs
| ID | Opportunity | Benefit Type | Claim Tag |
|---|---|---|---|
| O01 | Reason->Validate pipeline insertion (`materialize -> reason -> validate -> publish`) | definitive | `Conceptual Opportunity (Current System)` |
| O02 | SHACL hard-validation gating in workflow | definitive | `Conceptual Opportunity (Current System)` |
| O03 | Temporal provenance model (`publishedAt`, `ingestedAt`, `assertedAt`, `derivedAt`, `eventTime`) | definitive | `Conceptual Opportunity (Current System)` |
| O04 | ClaimRecord / AssertionRecord first-class model | potential | `Conceptual Opportunity (Current System)` |
| O05 | Unified idempotency fingerprint + ontology-version invalidation | definitive | `Conceptual Opportunity (Current System)` |
| O06 | LLM stage timeout/budget/rate policy transfer | definitive | `Conceptual Opportunity (Current System)` |
| O07 | ProgressEventEnvelope (orchestrator -> transport -> client) | definitive | `Conceptual Opportunity (Current System)` |
| O08 | Backpressure and event sampling policy | definitive | `Conceptual Opportunity (Current System)` |
| O09 | Partial-result semantics for degraded runs | definitive | `Conceptual Opportunity (Current System)` |
| O10 | Mention/relation evidence span provenance normalization | definitive | `Conceptual Opportunity (Current System)` |
| O11 | Conflict lifecycle model (accepted/deprecated/superseded) | potential | `Conceptual Opportunity (Current System)` |
| O12 | FileSystem-style audit trail for deterministic run debugging | definitive | `Conceptual Opportunity (Current System)` |
| O13 | RRF hybrid retrieval fusion | potential | `Conceptual Opportunity (Current System)` |
| O14 | RDFS profile presets for targeted reasoning | definitive | `Conceptual Opportunity (Current System)` |
| O15 | Incremental validation strategy (Re-SHACL style) | potential | `Conceptual Opportunity (Current System)` |
| O16 | TBox/ABox separation pattern for portability | potential | `Conceptual Opportunity (Current System)` |
| O17 | Workflow state-return discipline to reduce race conditions | definitive | `Conceptual Opportunity (Current System)` |
| O18 | Lemmatization/query expansion for retrieval quality | potential | `Conceptual Opportunity (Current System)` |
| O19 | LLM control operational profiles (conservative/balanced/aggressive) | definitive | `Conceptual Opportunity (Current System)` |
| O20 | Provider-agnostic embedding/retrieval request abstraction | potential | `Conceptual Opportunity (Current System)` |
| O21 | Entity-resolution canonical link pattern (`sameAs` caution) | definitive | `Conceptual Opportunity (Current System)` |
| O22 | Timeline/feed UX instrumentation lane (future UI) | potential | `Conceptual Opportunity (Current System)` |
| O23 | Bitemporal + provenance shape and schema alignment audits | potential | `Conceptual Opportunity (Current System)` |
| O24 | Execution deduplicator service for concurrent submits | definitive | `Conceptual Opportunity (Current System)` |
| O25 | External reasoner threshold policy for high-scale batches | potential | `Conceptual Opportunity (Current System)` |
| O26 | Opportunity scoring contract for repeatable prioritization | definitive | `Conceptual Opportunity (Current System)` |
| O27 | Constraint integrity checker against canonical lock defaults | definitive | `Conceptual Opportunity (Current System)` |
| O28 | Unified 6-phase extraction observability mapping | potential | `Conceptual Opportunity (Current System)` |

### 12.2 Evidence-Mapped Opportunities
| ID | Core Evidence |
|---|---|
| O01/O02/O14/O21/O25 | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md` |
| O03/O04/O23 | `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md`, `.repos/beep-effect/packages/knowledge/_docs/audits/ACTION_ITEMS.md` |
| O05/O24 | `.repos/beep-effect/packages/knowledge/_docs/README-IDEMPOTENCY.md`, `.repos/beep-effect/packages/knowledge/_docs/idempotency-implementation.ts` |
| O06/O09/O19 | `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/server/src/LlmControl/LlmResilience.ts` |
| O07/O08 | `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/server/src/Workflow/ProgressStream.ts` |
| O10 | `.repos/beep-effect/packages/knowledge/tables/src/tables/mention.table.ts`, `.repos/beep-effect/packages/knowledge/tables/src/tables/relation-evidence.table.ts` |
| O12 | `.repos/beep-effect/packages/knowledge/_docs/README.md`, `.repos/beep-effect/packages/knowledge/_docs/PERSISTENCE_SUMMARY.md` |
| O13/O18/O20 | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/sota_review.md`, `.repos/beep-effect/packages/knowledge/_docs/architecture/embedding-architecture.md` |
| O16 | `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md` |
| O17 | `.repos/beep-effect/packages/knowledge/_docs/architecture/workflow-state-patterns.md` |
| O22 | `.repos/beep-effect/packages/knowledge/_docs/mvp/UI_UX_RESEARCH_KNOWLEDGE_GRAPH_VIS.md`, `.repos/beep-effect/packages/knowledge/ui/src/index.ts` |
| O26/O27 | `./OVERVIEW.md`, `.repos/beep-effect/packages/knowledge/_docs/INDEX.md` |
| O28 | `.repos/beep-effect/packages/knowledge/_docs/architecture/system-architecture.md`, `.repos/beep-effect/packages/knowledge/_docs/plans/2025-12-19-unified-extraction-pipeline.md` |

---

## 13. Ranked Opportunities (Scored Table)
Score formula (fixed):
`Score = 0.35*Impact + 0.25*Confidence + 0.2*EffortInverse + 0.1*RiskInverse + 0.1*PhaseReadiness`

| Rank | ID | Opportunity | Impact | Confidence | EffortInverse | RiskInverse | PhaseReadiness | Score | Benefit Type | `OVERVIEW` Section(s) | Phase |
|---:|---|---|---:|---:|---:|---:|---:|---:|---|---|---|
| 1 | O01 | Reason->Validate pipeline insertion | 5 | 5 | 4 | 4 | 4 | 4.60 | definitive | 10,11,14 | P4-P6 |
| 2 | O02 | SHACL hard-validation gating | 5 | 5 | 4 | 4 | 4 | 4.60 | definitive | 11,14 | P4-P6 |
| 3 | O06 | LLM stage timeout/budget/rate policy transfer | 5 | 4 | 4 | 4 | 5 | 4.45 | definitive | 11,14,15 | P4-P7 |
| 4 | O21 | Entity-resolution canonical link pattern (`sameAs` caution) | 4 | 4 | 5 | 5 | 4 | 4.30 | definitive | 10,11,13 | P4-P6 |
| 5 | O14 | RDFS profile presets for targeted reasoning | 4 | 4 | 5 | 4 | 4 | 4.20 | definitive | 8,10,11,13 | P4-P5 |
| 6 | O05 | Unified idempotency fingerprint | 5 | 4 | 3 | 4 | 4 | 4.15 | definitive | 9,14,16 | P3-P5 |
| 7 | O17 | Workflow state-return discipline | 4 | 4 | 4 | 5 | 4 | 4.10 | definitive | 9,14 | P3-P5 |
| 8 | O03 | Temporal provenance model | 4 | 5 | 3 | 4 | 4 | 4.05 | definitive | 11,13,15 | P1-P6 |
| 9 | O07 | ProgressEventEnvelope | 4 | 4 | 4 | 4 | 4 | 4.00 | definitive | 9,14,15 | P5-P7 |
| 10 | O08 | Backpressure and sampling policy | 4 | 4 | 4 | 4 | 4 | 4.00 | definitive | 14,15 | P5-P7 |
| 11 | O09 | Partial-result semantics | 4 | 4 | 4 | 4 | 4 | 4.00 | definitive | 11,14,16 | P4-P7 |
| 12 | O10 | Evidence span provenance normalization | 4 | 4 | 4 | 4 | 4 | 4.00 | definitive | 11,15 | P2-P6 |
| 13 | O24 | Execution deduplicator for concurrent submits | 4 | 4 | 4 | 4 | 4 | 4.00 | definitive | 14,16 | P3-P5 |
| 14 | O12 | FS-style deterministic audit trail | 3 | 4 | 5 | 5 | 4 | 3.95 | definitive | 9,14,15 | P3-P6 |
| 15 | O19 | LLM control operational profiles | 3 | 4 | 5 | 5 | 4 | 3.95 | definitive | 14,15 | P6-P7 |
| 16 | O04 | ClaimRecord / AssertionRecord model | 5 | 3 | 3 | 3 | 3 | 3.70 | potential | 11,13,15 | P1-P6 |
| 17 | O16 | TBox/ABox separation | 3 | 4 | 4 | 5 | 3 | 3.65 | potential | 10,16 | P1-P3 |
| 18 | O28 | Unified 6-phase extraction observability mapping | 3 | 4 | 4 | 4 | 4 | 3.65 | potential | 9,14,15 | P2-P6 |
| 19 | O13 | RRF hybrid retrieval fusion | 4 | 4 | 3 | 3 | 3 | 3.60 | potential | 12,15 | P5-P6 |
| 20 | O18 | Lemmatization/query expansion | 3 | 4 | 4 | 4 | 3 | 3.55 | potential | 12 | P5-P6 |
| 21 | O11 | Conflict lifecycle model | 4 | 3 | 3 | 3 | 3 | 3.35 | potential | 11,13,16 | P1-P6 |
| 22 | O15 | Incremental validation strategy | 4 | 3 | 2 | 2 | 2 | 2.95 | potential | 11,14 | P6-P7 |
| 23 | O25 | External reasoner threshold policy | 2 | 3 | 1 | 2 | 1 | 1.95 | potential | 8,14 | P7+ |
| 24 | O20 | Provider-agnostic embedding request abstraction | 3 | 4 | 3 | 3 | 3 | 3.40 | potential | 12,15 | P5-P6 |
| 25 | O22 | Timeline/feed UX instrumentation lane | 3 | 3 | 2 | 3 | 1 | 2.60 | potential | 9,15 | P7+ |
| 26 | O23 | Bitemporal/provenance schema alignment audits | 4 | 3 | 3 | 3 | 3 | 3.35 | potential | 13,15,16 | P1-P6 |
| 27 | O26 | Opportunity scoring contract | 3 | 5 | 5 | 5 | 5 | 4.10 | definitive | 18,20 | P0-P1 |
| 28 | O27 | Constraint integrity checker vs canonical locks | 4 | 4 | 4 | 5 | 4 | 4.10 | definitive | 5,16,18 | P0-P2 |

---

## 14. Recommended Exploratory Lanes
### Lane A: Deterministic Guardrails First
- Intent: increase reliability and reduce silent drift before adding more sophistication.
- Opportunity set: O01, O02, O06, O14, O27.
- Expected value: definitive quality gains in validation rigor and bounded execution.
- Claim Tag: `Conceptual Opportunity (Current System)`.
- Evidence: `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md`, `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md`, `./OVERVIEW.md`.

### Lane B: Reasoning + Validation Tightening
- Intent: move from conceptual reasoning integration to auditable reasoning semantics.
- Opportunity set: O03, O04, O11, O15, O23.
- Expected value: stronger contradiction handling and temporal/provenance explainability.
- Claim Tag: `Conceptual Opportunity (Current System)`.
- Evidence: `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md`, `.repos/beep-effect/packages/knowledge/_docs/ontology_research/owl_reasoning_validation_production.md`.

### Lane C: Retrieval / Context Intelligence
- Intent: improve retrieval quality and context serialization effectiveness.
- Opportunity set: O13, O18, O20, O21.
- Expected value: likely recall/precision gains for explanation and query surfaces.
- Claim Tag: `Conceptual Opportunity (Current System)`.
- Evidence: `.repos/beep-effect/packages/knowledge/_docs/ontology_research/sota_review.md`, `.repos/beep-effect/packages/knowledge/_docs/architecture/embedding-architecture.md`.

### Lane D: Operational Control Plane
- Intent: operationalize long-running workflows with transparent runtime behavior.
- Opportunity set: O05, O07, O08, O09, O12, O19, O24.
- Expected value: definitive resilience and observability improvements.
- Claim Tag: `Conceptual Opportunity (Current System)`.
- Evidence: `.repos/beep-effect/packages/knowledge/_docs/README-IDEMPOTENCY.md`, `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md`.

---

## 15. Candidate Public Contracts and Type Additions
All contracts below are exploratory candidates for future initiative drafting.

### 15.1 Candidate Contract Surface
| Contract | Purpose | Candidate API/Shape | Claim Tag | Evidence |
|---|---|---|---|---|
| `ReasoningValidationPipeline` | explicit ordering from inferred facts to validation and publication | `materializeInferences -> validateShapes -> publishFacts` | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md` |
| `TemporalProvenance` | normalize bitemporal/provenance fields | `{publishedAt, ingestedAt, assertedAt, derivedAt, eventTime?}` | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/audits/ACTION_ITEMS.md` |
| `ClaimRecord` / `AssertionRecord` | represent claim-level lifecycle separate from edge-only storage | claim + evidence + status + provenance refs | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/mvp/ARCHITECTURAL_DECISIONS_MVP.md`, `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md` |
| `IdempotencyFingerprint` | unify dedup and invalidation keys across layers | hash(normalizedInput, ontologyId, ontologyVersion, paramsHash) | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/README-IDEMPOTENCY.md` |
| `ProgressEventEnvelope` | cross-layer event compatibility | typed envelope with eventId/runId/timestamp/progress + payload | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/server/src/Workflow/ProgressStream.ts` |
| `LlmControlPolicy` | single policy object for stage timeouts/budgets/retries | stage policies + concurrency + breaker thresholds | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/server/src/LlmControl/*.ts` |
| `ConflictLifecycle` | track contradiction/supersession without deleting evidence | `accepted | deprecated | superseded | contested` | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/temporal_conflicting_claims_research.md` |
| `OpportunityScore` | reproducible exploratory prioritization | `{impact, confidence, effortInverse, riskInverse, phaseReadiness, score}` | `Conceptual Opportunity (Current System)` | this document section 13 rubric |

### 15.2 Existing Related Surfaces (Current `OVERVIEW`)
| Existing Candidate in `OVERVIEW.md` | Relationship |
|---|---|
| `ReasoningAdapter` | upstream dependency for `ReasoningValidationPipeline` |
| `InferenceFact` / `InferenceProvenance` | feed input to `ConflictLifecycle` |
| `Claim`, `VerificationEvidence`, `ConflictReport` | may evolve into richer `ClaimRecord` / lifecycle model |

---

## 16. Risks, Dependencies, and Preconditions
| Risk/Dependency | Condition | Mitigation | Claim Tag | Evidence |
|---|---|---|---|---|
| Over-extension of reasoning scope | full OWL applied indiscriminately | profile-gate reasoning (`rdfs-*` first) + scale thresholds | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md` |
| Conflict between new opportunities and canonical lock defaults | introducing patterns that alter locked assumptions | use explicit ADR flags before altering lock surfaces | `Conceptual Opportunity (Current System)` | `./OVERVIEW.md`, `.repos/beep-effect/packages/knowledge/_docs/INDEX.md` |
| Event-stream design without consumer surfaces | server emits events but client/ui cannot consume meaningfully | keep envelope design, defer UX commitments; model as operational telemetry first | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/client/src/index.ts`, `.repos/beep-effect/packages/knowledge/ui/src/index.ts`, `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md` |
| Ambiguous claim model migration path | edge-only storage and claim-lifecycle storage divergence | keep migration as optional lane with bounded pilot scope | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/tables/src/tables/relation.table.ts`, `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md` |
| Policy complexity in LLM controls | tuning overhead across stages/models | start with balanced profile and observe metrics before optimization | `Conceptual Opportunity (Current System)` | `.repos/beep-effect/packages/knowledge/_docs/LLM_CONTROL_STRATEGY_SUMMARY.md` |

---

## 17. Non-Goals and Boundaries
- This document does **not** prescribe immediate code implementation.
- This document does **not** rewrite canonical lock defaults in `repo-codegraph-canonical`.
- This document does **not** commit to adopting all top-ranked opportunities.
- This document does **not** settle final data-model migrations (claim lifecycle, external reasoners, UI roadmap).

Each statement above is `Conceptual Opportunity (Current System)` bounded by exploratory intent.
Evidence: `./OVERVIEW.md` and user-scoped objective for exploratory synthesis.

---

## 18. Spec Seeding Prompts (for next greenfield spec)
### 18.1 Top-Ranked Opportunity Prompts
| Opportunity | Next Spec Prompt | Claim Tag |
|---|---|---|
| O01/O02 | "Define the minimal Reason->Validate pipeline contract and failure semantics such that deterministic facts remain authoritative and validation failures are observable and actionable." | `Conceptual Opportunity (Current System)` |
| O06 | "Define stage-level LLM control policy interfaces with defaults, override points, and required metrics for each stage in claim decomposition and enrichment." | `Conceptual Opportunity (Current System)` |
| O05/O24 | "Define end-to-end idempotency propagation from request input through enrichment/reasoning, including ontology-version invalidation and concurrent dedup behavior." | `Conceptual Opportunity (Current System)` |
| O03 | "Define the temporal/provenance core schema and explain how it maps onto claim/evidence/conflict records without contradicting canonical certainty tiers." | `Conceptual Opportunity (Current System)` |
| O07/O08 | "Define the cross-layer progress event contract and backpressure semantics for long-running enrichment/reasoning jobs." | `Conceptual Opportunity (Current System)` |

### 18.2 ADR Candidate Prompts
1. ADR: reasoning profiles allowed in production by phase.
2. ADR: deterministic precedence vs inferred fact lifecycle semantics.
3. ADR: idempotency fingerprint canonicalization rules.
4. ADR: claim lifecycle model (edge-only vs claim-first hybrid).
5. ADR: progress stream contract scope (internal telemetry vs user-facing UX contract).

All ADR prompts: `Conceptual Opportunity (Current System)`.

---

## 19. Traceability Matrix
| Theme | Major Claim | Claim Tag | Primary Evidence |
|---|---|---|---|
| Architecture | legacy defined unified multi-stage extraction and workflow model | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/architecture/system-architecture.md`, `.repos/beep-effect/packages/knowledge/_docs/functional_spec.md` |
| Runtime reality | server pipeline/orchestrator/control stack implemented | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/server/src/Extraction/ExtractionPipeline.ts`, `.repos/beep-effect/packages/knowledge/server/src/Workflow/BatchOrchestrator.ts`, `.repos/beep-effect/packages/knowledge/server/src/LlmControl/*.ts` |
| Persistence/provenance | extraction/mention/relation evidence storage modeled | `Implemented (Legacy Verified)` | `.repos/beep-effect/packages/knowledge/domain/src/entities/Extraction/Extraction.model.ts`, `.repos/beep-effect/packages/knowledge/tables/src/tables/mention.table.ts`, `.repos/beep-effect/packages/knowledge/tables/src/tables/relation-evidence.table.ts` |
| Idempotency | end-to-end unified scheme designed and documented | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/README-IDEMPOTENCY.md`, `.repos/beep-effect/packages/knowledge/_docs/idempotency-implementation.ts` |
| Reasoning/validation | lightweight reasoning + SHACL-first recommendations | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/ontology_research/REASONING_RECOMMENDATIONS.md` |
| Temporal/provenance quality | bitemporal gaps identified as blockers | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/audits/AUDIT_SUMMARY.md`, `.repos/beep-effect/packages/knowledge/_docs/audits/2025-12-18-medium-severity-modeling-audit.md` |
| Progress transport | detailed event and backpressure contract specified | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/_docs/PROGRESS_STREAMING_SUMMARY.md` |
| Client/UI | streaming UX surfaces largely unimplemented | `Specified (Legacy Planned)` | `.repos/beep-effect/packages/knowledge/client/src/index.ts`, `.repos/beep-effect/packages/knowledge/ui/src/index.ts` |
| Current target mapping | opportunities mapped to `OVERVIEW.md` sections and P0-P7 | `Conceptual Opportunity (Current System)` | `./OVERVIEW.md`, this document sections 8, 9, 13 |

---

## 20. Appendix (Source Index + Scoring Rubric)
### 20.1 Source Index by Cluster
- `architecture`: `.repos/beep-effect/packages/knowledge/_docs/architecture/*.md`
- `plans`: `.repos/beep-effect/packages/knowledge/_docs/plans/*.md`
- `ontology_research`: `.repos/beep-effect/packages/knowledge/_docs/ontology_research/*.md`
- `audits`: `.repos/beep-effect/packages/knowledge/_docs/audits/*.md`
- `mvp`: `.repos/beep-effect/packages/knowledge/_docs/mvp/*.md`
- `archive`: `.repos/beep-effect/packages/knowledge/_docs/archive/*.md`
- `top-level`: `.repos/beep-effect/packages/knowledge/_docs/*.md`
- `verified code`: `.repos/beep-effect/packages/knowledge/{server,domain,tables,client,ui}/**`

### 20.2 Scoring Rubric
| Dimension | Definition | Scale |
|---|---|---|
| Impact | expected architecture value if explored further | 1-5 |
| Confidence | evidence-backed confidence from legacy docs + code reality | 1-5 |
| EffortInverse | lower implementation effort -> higher score | 1-5 |
| RiskInverse | lower systemic risk -> higher score | 1-5 |
| PhaseReadiness | fit with current phase readiness and dependencies | 1-5 |

Formula:
`Score = 0.35*Impact + 0.25*Confidence + 0.2*EffortInverse + 0.1*RiskInverse + 0.1*PhaseReadiness`

### 20.3 Quality Test Checklist (Applied)
- [x] Coverage test: all `_docs` clusters represented.
- [x] Verification test: verified claims mapped to old code paths.
- [x] Distinction test: built vs planned explicitly separated.
- [x] Mapping test: top-ranked opportunities mapped to `OVERVIEW.md` + phase.
- [x] Benefit clarity test: definitive vs potential labels included.
- [x] Scoring reproducibility test: formula and dimensions published.
- [x] Constraint integrity test: no canonical lock rewrite proposed.
- [x] Exploratory-boundary test: recommendations remain non-committal.
