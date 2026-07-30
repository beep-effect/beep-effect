# Cluster synthesis — Agent metacognition, self-reflection & neuro-symbolic architecture

- **Date:** 2026-07-25  **Synthesist:** codex gpt-5.6-sol (max)
- **Cluster:** agent-metacognition-neurosymbolic — 23 papers (ids listed at the end)
- **Feeds:** `goals/agentic-professional-runtime`, `apps/professional-desktop` agent control plane, agent governance, `goals/epistemic-bitemporal-edge-core`, `goals/citation-verified-span-substrate`, `goals/semantic-foundation`, `goals/identity-iri-fold`, and `goals/ingestion-secret-scrub`

## Verdict paragraph

Metacognition should be implemented as a governed, typed, event-sourced control protocol—not as an extra reflection prompt and never as a new source of truth. Across the cluster, the most portable architecture is: an object-level process acts through typed capabilities; monitors emit non-authoritative cues; a controller chooses verification, retry, fallback, abstention, help, or stopping; every consequential proposal remains evidence-bound and approval-gated; and later observations determine whether an intervention actually worked. This substantially corroborates the repo’s candidate-only writes, exact-span authority, graph-as-projection doctrine, immutable correction history, and attorney boundary. The important new work is to separate human disposition from factual verification, add post-action outcome contracts, evaluate metacognition end to end, and keep the external-supervisor versus unified-planner topology open. No paper supplies grounds for semantic memory, reflection text, symbolic traces, learned rules, embeddings, or ontologies to escape the No-Escape doctrine.

## Design challenges

1. **Human acceptance must not stand in for epistemic verification.** More than 70% of one embodied-agent response set was unusable in `3072c5297dbc` (Exploiting Language Models as a Source of Knowledge); `aff0b53d4126` (AlignedCoT) contains correct answers reached through faulty reasoning; `d7c64f6843f5` (THINK BEYOND SIZE) “corrects” an example by inventing an unstated rounding assumption; and `8031a91d7e5b` (Lari) mistakes deterministic trace integrity for correctness. **Strength:** high for the architectural separation, although none is a legal-workflow study. **Re-examine:** `goals/agentic-professional-runtime/docs/approval-and-autonomy-policy.md` currently says acceptance makes an item authoritative runtime truth. Split this into an attorney disposition—approved for a purpose—and an independent evidence-verification state. Approval may authorize strategy or use; it cannot retroactively make a source claim true.

2. **Structural, logical, or ontological conformance is not factual admission.** `c24c203fdd49` (Neural-Symbolic Large Language Model (LLM) Multi-Agent Systems) calls knowledge graphs ground truth while also conceding faulty rules and symbolic brittleness; `9e55e391080a` (SYMBOLIC AI) shows that semantic trajectory similarity misses logical correctness; `1ce62d3842ef` (Knowledge representation and acquisition) restricts tractability to selected solver fragments; and `86d65f8219b2` (The Grand Challenges and Myths of Neural-Symbolic Computation) presents model checking as an agenda, not a proven guarantee. **Strength:** high as a formal and systems-design constraint. **Re-examine:** a successful Schema, SHACL, ontology-consistency, or solver check should advance a named validation state, not confer source truth. This directly qualifies the June-29 synthesis’s description of `ClaimGate` conformance as a constitutive admission event.

3. **A permanently separate metacognitive supervisor is not automatically safer or more capable.** `576ee59aaf2b` (Two Approaches to Implementing Metacognition) demonstrates external-monitor blindness and repeated interventions when snapshots omit process state; `c83ef6c0788e` (Metareasoning as an Integral Part of Commonsense and) instead argues for one continual planner. Those findings conflict with the external supervisors proposed by `9f1484f54bef` (Integrating Metacognition into Artificial Agents) and `37c958e24d62` (Architecture for a General Purpose Metacognitive Agent). **Strength:** medium; the strongest evidence is a narrow implemented dialog trace, while the broader architectures are unevaluated. **Re-examine:** keep object, monitoring, and control contracts logically distinct, but do not freeze their deployment topology before repository-local tests compare shared-event-log supervision with an interleaved scheduler.

4. **An approval or action attempt needs a post-action outcome contract.** `7ea169e822e0` (Toward Domain-Neutral Human-Level Metacognition), `9f1484f54bef` (Integrating Metacognition into Artificial Agents), `37c958e24d62` (Architecture for a General Purpose Metacognitive Agent), and `77fde20a861d` (General-Purpose Metacognition Engine) all distinguish recommending a response, attempting it, and observing whether it achieved the intended effect. **Strength:** medium as convergent architecture, weak as comparative evidence. **Re-examine:** the current approval gate records a decision but no required expected effect, deadline, success predicate, failure predicate, attempt record, or later disposition. Without these, the runtime can audit authorization but not intervention efficacy.

5. **Complete observability and confidentiality pull in opposite directions.** `576ee59aaf2b` (Two Approaches to Implementing Metacognition) shows that omitted observations make failures structurally undetectable; `9f1484f54bef` (Integrating Metacognition into Artificial Agents) and `37c958e24d62` (Architecture for a General Purpose Metacognitive Agent) assume broad asynchronous telemetry. Publishing that telemetry wholesale would conflict with matter walls, local-first confidentiality, and the raw-secret prohibitions in `goals/ingestion-secret-scrub`. **Strength:** medium for the coverage failure, low for security efficacy because the papers do not test attacks. **Re-examine:** governance needs a tested coverage contract over scrubbed event metadata and capability-checked references—not unrestricted replication of prompts, documents, or tool payloads.

6. **Reflection quality cannot be inferred from critic accuracy, final-answer accuracy, or aggregate similarity.** `6682c2d0729f` (Toward Artificial Metacognition) separates cues from successful correction; `29044694a09c` (Meta-reasoning in autonomous agents) reports large gains but leaves thresholds, memory reset, and the supposedly inert Monitor-Only lift unexplained; `d7c64f6843f5` (THINK BEYOND SIZE) is unreproducible and internally inconsistent; and `aff0b53d4126` (AlignedCoT) shows answer scoring concealing invalid steps. **Strength:** medium-high as an evaluation warning, low for accepting any reported effect size. **Re-examine:** agent governance metrics must include errors introduced by correction, exact task success, forced/oracle transitions, attorney workload, escalation rate, latency, tokens, and cost.

7. **Adaptive baselines and compressed metacognitive memory can conceal persistent failure.** In `77fde20a861d` (General-Purpose Metacognition Engine), a moving anomaly bandwidth can catch up to an unresolved condition and abort the anomaly; `8031a91d7e5b` (Lari) equates compressibility with introspection without validating either; and the adjacent-thought similarity used by `29044694a09c` (Meta-reasoning in autonomous agents) can reward repetitive failure loops. **Strength:** low-to-medium but mechanistically credible. **Re-examine:** No-Escape compression remains acceptable only for derived semantic layers. “Baseline adapted,” “alarm stopped,” and “problem resolved” must be separate states, with exact observations retained beneath every summary or centroid.

8. **Budget exhaustion must not collapse into “unknown,” “false,” or “not known.”** `c83ef6c0788e` (Metareasoning as an Integral Part of Commonsense and) defines knowing by success within a bounded recursive query; `1ce62d3842ef` (Knowledge representation and acquisition) warns that reasoning guarantees inherit the limits of the underlying fragment. **Strength:** medium conceptual and formal support. **Re-examine:** the epistemic model needs distinct outcomes for verified, refuted, unknown, inconsistent, unsupported-fragment, and budget-exhausted, each with consumed cost and proof context.

9. **Readable post-hoc rules are not necessarily faithful explanations.** `d5c6e70169d4` (Neural-Symbolic Cognitive Agents: Architecture and Theory) and `f8ddc3b5ac43` (A Neural-Symbolic Cognitive Agent for Online Learning and Reasoning) extract stochastic temporal rules that still require expert validation. `665cd63780b0` (A Neural-Based Architecture for Bridging the Gap Between) obtains stronger interpretability by constraining rule shape and parameter ranges before training. **Strength:** medium for the distinction, with narrow empirical support. **Re-examine:** use post-hoc extracted rules only as review candidates; for control policy, prefer human-approved executable envelopes whose actual firing path is traceable.

## Direct patterns

- **Typed intervention lifecycle.** Model `Observation → Expectation → Violation → FailureHypothesis → ResponseProposal → Approval → ActionAttempt → OutcomeObservation → Disposition`, retaining alternatives and causal links. Sources: `7ea169e822e0` (Toward Domain-Neutral Human-Level Metacognition), `576ee59aaf2b` (Two Approaches to Implementing Metacognition), and `37c958e24d62` (Architecture for a General Purpose Metacognitive Agent). **Target:** agentic runtime and epistemic history. **First step:** extend one deterministic runtime fixture with a failed tool call, proposed recovery, attorney decision, attempted recovery, deadline, and observed outcome.

- **Typed capability records with deterministic ownership.** Let the language layer propose a Schema-decoded invocation; let calculators, retrieval engines, databases, rule engines, and solvers own execution. Each capability declares inputs, outputs, preconditions, effects, approval class, evidence obligation, supported logic fragment, cost, and failure semantics. Sources: `1a3665b7d2ae` (A modular, neuro-symbolic architecture), `9e55e391080a` (SYMBOLIC AI), `c83ef6c0788e` (Metareasoning as an Integral Part of Commonsense and), and `1ce62d3842ef` (Knowledge representation and acquisition). **Target:** `apps/professional-desktop`. **First step:** specify one citation-verification capability and prove that unresolved entities or spans cannot cross its typed boundary.

- **Selective meta-control FSM.** Separate execution telemetry from control decisions and switch among bounded strategies only when stagnation, repeated tool errors, constraint failures, or budget degradation justify it. Sources: `6682c2d0729f` (Toward Artificial Metacognition), `234b0f19cde5` (Metacognitive AI), and `29044694a09c` (Meta-reasoning in autonomous agents). **Target:** agent governance. **First step:** define a deterministic `normal | careful | exploratory | reflective | escalate | stop` fixture policy, with external actions prohibited from entering exploratory mode.

- **Knowledge-gap acquisition and LM usage model.** Represent a need as a tagged gap, select a model and prompt strategy from versioned task-specific history, parse the answer into a candidate, ground and validate it, then either reject, repair, approve, or retain it with complete lineage. Sources: `3072c5297dbc` (Exploiting Language Models as a Source of Knowledge) and `c2e659c0cf0d` (Language Models as a Knowledge Source for Cognitive). **Target:** agentic runtime. **First step:** add a usage-model record keyed by provider/model snapshot and knowledge class, recording prompts, parameters, verification outcomes, latency, and cost without granting the model authority.

- **Episodes as views; cases as caches.** Preserve one immutable observation stream; represent overlapping or nested episodes through interval and membership edges; represent centroids, learned cases, and expectations as versioned derivations carrying source episode IDs. Source: `77fde20a861d` (General-Purpose Metacognition Engine), corroborated by `9f1484f54bef` (Integrating Metacognition into Artificial Agents). **Target:** bitemporal memory. **First step:** add fixtures in which two anomaly episodes share observations and a later reclassification changes episode membership without modifying the original events.

- **Agent-indexed epistemic context.** Keep world assertions, each agent’s beliefs, assumptions, proof context, and knowledge-time distinct; identical answer text from different evidence snapshots is not the same inference. Sources: `1ce62d3842ef` (Knowledge representation and acquisition), `86d65f8219b2` (The Grand Challenges and Myths of Neural-Symbolic Computation), and `c83ef6c0788e` (Metareasoning as an Integral Part of Commonsense and). **Target:** epistemic bitemporal and multi-agent governance. **First step:** define an agent-status envelope carrying evidence snapshot, unresolved conflicts, attempts, remaining budget, and requested help.

- **Trace integrity plus independent validators.** Preserve exact node inputs, outputs, dependencies, capability versions, approvals, retries, and costs; evaluate byte integrity, deterministic replay, authorization, logical validity, and evidence support as different predicates. Sources: `9e55e391080a` (SYMBOLIC AI) and `8031a91d7e5b` (Lari). **Target:** agent governance and citation verification. **First step:** add a regression fixture whose perfectly replayable trace reaches a false unsupported conclusion and therefore fails the span verifier.

- **Pre-constrained learnable rule envelopes.** For narrow measurable subcontrollers, let humans approve rule structure, feature directions, and parameter bounds while learning tunes only bounded values; record the actual rule firing trace. Source: `665cd63780b0` (A Neural-Based Architecture for Bridging the Gap Between). **Target:** agent governance. **First step:** prototype only on a reversible, non-legal-decision classifier with an explicit abstention path and baseline/OOD evaluation.

## Corroborations

- The candidate-only and attorney-gated runtime is independently supported by `3072c5297dbc` (Exploiting Language Models as a Source of Knowledge), `1a3665b7d2ae` (A modular, neuro-symbolic architecture), `7ea169e822e0` (Toward Domain-Neutral Human-Level Metacognition), and `234b0f19cde5` (Metacognitive AI).

- The No-Escape doctrine is reinforced: exact events, documents, spans, prompts, approvals, and outcomes remain authority; embeddings, summaries, neural weights, learned rules, episodes, and graph views remain rebuildable derivations. Support comes from `6682c2d0729f` (Toward Artificial Metacognition), `77fde20a861d` (General-Purpose Metacognition Engine), `d5c6e70169d4` (Neural-Symbolic Cognitive Agents), and `49635ef7257c` (Stochastic LLMs do not Understand Language).

- Exact span verification cannot be replaced by confidence, semantic similarity, a fluent rationale, or a graph path. `9e55e391080a` (SYMBOLIC AI), `f8ddc3b5ac43` (A Neural-Symbolic Cognitive Agent), `aff0b53d4126` (AlignedCoT), and `8031a91d7e5b` (Lari) all support this distinction.

- Stable identity must remain separate from similarity. `49635ef7257c` (Stochastic LLMs do not Understand Language), `1a3665b7d2ae` (A modular, neuro-symbolic architecture), and `9e55e391080a` (SYMBOLIC AI) support schema-valid IRI resolution before symbolic invocation or ontology persistence.

- Rejection, abstention, requesting help, deferral, and stopping are legitimate values rather than exceptional failures. This aligns with the repo’s typed fail-closed and rejection-as-history posture and is supported by `7ea169e822e0` (Toward Domain-Neutral Human-Level Metacognition), `234b0f19cde5` (Metacognitive AI), and `6682c2d0729f` (Toward Artificial Metacognition).

- Scrubbing and least privilege must precede semantic replay, external monitoring, or generated-code execution. `9e55e391080a` (SYMBOLIC AI) and `29044694a09c` (Meta-reasoning in autonomous agents) reinforce `goals/ingestion-secret-scrub`; neither supplies a complete security design.

## Delta vs the June-29 prior synthesis

**Genuinely new:** the June-29 synthesis concentrated on legal relations, ontology layering, identity, evidence spans, provenance, and qualification. This cluster adds the control protocol around those artifacts: typed cues versus decisions, strategy switching, knowledge-gap routing, observation-coverage contracts, intervention outcome monitoring, agent-indexed belief context, resource-aware stopping, and evaluation of the metacognitive layer itself. It also surfaces the unresolved external-supervisor versus unified-planner choice and supplies concrete negative fixtures—correct answer with invalid reasoning, deterministic false trace, oracle-assisted workflow, same-model “correction” that invents an assumption—that the prior synthesis did not address.

**Re-confirmed:** deterministic quote-to-span alignment; confidence as metadata rather than proof; immutable evidence and revision history; stable identity before ontology assertion; human promotion of candidate work; and graph/search/semantic structures as projections. The cluster adds no material new evidence for Hohfeldian relators, legal deontic taxonomy, or IP-specific ontology design.

**Contradictions and current-state corrections:** the prior synthesis’s §7 treatment of structural `ClaimGate` conformance as institutional admission is too strong for factual claims. The cluster requires separate shape-valid, logically consistent, source-verified, and attorney-disposed states. Its desired verified-publication gate is also not current repo behavior: the 2026-07-25 audit found no implemented provenance-aware publication gate. Likewise, §9’s description of Oxigraph/OWL as a source of truth conflicts with the current `goals/semantic-foundation` graph-as-projection contract and with this cluster’s evidence that symbolic stores can contain false, stale, or misparsed premises. The prior synthesis’s `@beep/ontology` roadmap and code examples are historical only: the audit establishes that the package now exists, the shown `Ontology.create` API is retired, and 36 of 56 TypeScript fences contain verified defects. None of those snippets should seed implementation.

## Tensions & contradictions

- **External supervisor versus unified planner.** `9f1484f54bef` (Integrating Metacognition into Artificial Agents), `37c958e24d62` (Architecture for a General Purpose Metacognitive Agent), and `77fde20a861d` (General-Purpose Metacognition Engine) favor separable asynchronous supervision; `576ee59aaf2b` (Two Approaches to Implementing Metacognition) and `c83ef6c0788e` (Metareasoning as an Integral Part of Commonsense and) expose its blindness or reject the fixed split. Adjudicate with one typed event/control protocol and compare deployments under identical partial-observation, latency, privacy, and recovery fixtures.

- **Reflection gains versus reflection-induced error.** `29044694a09c` (Meta-reasoning in autonomous agents) reports large completion and recovery gains, while `6682c2d0729f` (Toward Artificial Metacognition), `d7c64f6843f5` (THINK BEYOND SIZE), and `aff0b53d4126` (AlignedCoT) show that cues or extra reasoning can fail to correct—and can introduce errors. Adjudicate through no-oracle end-to-end tests with external deterministic validators and quality-versus-cost reporting.

- **Explicit symbolic knowledge versus implicit learning-to-reason.** `1ce62d3842ef` (Knowledge representation and acquisition) argues that explicit hypothesis construction can be intractable, while `c24c203fdd49` (Neural-Symbolic Large Language Model (LLM) Multi-Agent Systems) and `86d65f8219b2` (The Grand Challenges and Myths of Neural-Symbolic Computation) emphasize explicit artifacts and semantics. Keep authoritative rules explicit; permit implicit reasoners only as versioned caches over declared solver fragments and exact observations.

- **Post-hoc extraction versus semantics built into execution.** `d5c6e70169d4` (Neural-Symbolic Cognitive Agents) and `f8ddc3b5ac43` (A Neural-Symbolic Cognitive Agent) extract candidate rules from a neural model; `665cd63780b0` (A Neural-Based Architecture for Bridging the Gap Between) constrains the executable rule form before training. Prefer pre-constrained envelopes for governed actions; route post-hoc rules to review and conformance testing only.

- **Broad telemetry versus least privilege.** The MCL family needs sufficient observations to detect anomalies, but full episodic publication expands the secret and privilege surface. Adjudicate with scrub-before-publication, metadata-first events, opaque capability-checked payload references, explicit coverage/freshness metrics, and matter-scoped authorization.

- **Temporal expressiveness versus tractability.** `d5c6e70169d4` (Neural-Symbolic Cognitive Agents) and `86d65f8219b2` (The Grand Challenges and Myths of Neural-Symbolic Computation) motivate temporal logic representations; `1ce62d3842ef` (Knowledge representation and acquisition) warns that polynomial results may fail for temporal logics. Keep bitemporality as explicit storage/query semantics; declare and benchmark any narrower temporal-logic fragment separately.

- **Ontology as truth versus ontology as constrained projection.** `c24c203fdd49` (Neural-Symbolic Large Language Model (LLM) Multi-Agent Systems) promotes KGs as truth, while `3072c5297dbc` (Exploiting Language Models as a Source of Knowledge), `c2e659c0cf0d` (Language Models as a Knowledge Source for Cognitive), and `49635ef7257c` (Stochastic LLMs do not Understand Language) stress provenance and interpretation failure. The repo’s exact-record authority and graph-as-projection doctrine adjudicate this tension.

## Routing suggestions

| insight | route | rationale |
| --- | --- | --- |
| Typed intervention lifecycle and post-action outcome contract | extend `goals/agentic-professional-runtime` | The current gate records authorization but not attempted execution, expected effect, deadline, or observed success. |
| Capability records, selective meta-control FSM, and LM usage model | extend `goals/agentic-professional-runtime` | These are control-plane contracts over the existing candidate-write and approval boundary. |
| End-to-end metacognition benchmark with no-oracle reporting | new-exploration `agent-metacognition-evaluation` | No current goal owns cue quality, correction harm, recovery, attorney workload, latency, and cost as one evaluation contract. |
| External-supervisor versus unified-planner comparison | attach-to `explorations/academia-corpus-mining` | Record the unresolved topology as a research decision input; do not freeze implementation from design-only papers. |
| Expectation, hypothesis, episode-membership, and outcome events | attach-to `explorations/agent-memory-tiers-bitemporal-edges` | These are natural follow-ons over immutable bitemporal authority, but they must not widen the current core goal’s explicit non-goals. |
| Agent-indexed beliefs and distinct budget-exhausted outcomes | new-exploration `agent-indexed-epistemic-state` | The requirement crosses orchestration, epistemic semantics, proof context, and multi-agent handoffs and needs an explicit owner. |
| Deterministic false-trace regression and per-node evidence validators | attach-to `goals/citation-verified-span-substrate` | It directly proves that replay, confidence, and semantic similarity cannot satisfy exact grounding. |
| Logic-fragment and symbolic-capability selection matrix | attach-to `goals/semantic-foundation` | Preserve as future M4/reasoner input; current M1 should remain a taxonomy/registry milestone without reasoning expansion. |
| Capability-denied sandbox for model-generated code and tools | new-exploration `agent-execution-sandbox` | Secret scrub is necessary but not sufficient; sandbox authority, resource limits, network denial, and immutable execution records need a separate threat model. |
| Model-specific validated exemplars and semantic-pitfall fixtures | attach-to `goals/law-doc-structure-oa-slice` | Use only as future labeled evaluation material; the current deterministic, no-LLM-first office-action slice remains unchanged. |

## Quality notes

There are no gold papers in this cluster: 21 are silver and two are bronze. Most are architectures, position papers, surveys, or small demonstrations, so the cluster supports contracts and test hypotheses more strongly than performance claims.

- The MCL/GPME papers—`9f1484f54bef`, `37c958e24d62`, `576ee59aaf2b`, `77fde20a861d`, and `7ea169e822e0`—share an intellectual and system lineage. Their agreement is not five independent replications.

- `d5c6e70169d4` and `f8ddc3b5ac43` are closely related RTRBM architecture/evaluation papers; `c2e659c0cf0d` and `3072c5297dbc` similarly share the language-model-as-knowledge-source program. Downweight apparent corroboration within each pair.

- The empirically broadest paper, `29044694a09c` (Meta-reasoning in autonomous agents), under-delivers against its effect sizes: missing artifacts, unclear inferential units and memory resets, and an unexplained Monitor-Only gain prevent relying on its reported 31.2% completion improvement.

- `8031a91d7e5b` (Lari) and `d7c64f6843f5` (THINK BEYOND SIZE) under-delivered most sharply. Lari offers neither a credible verification benchmark nor evidence that XOR folding is useful; Adaptive Prompting lacks reproducible prompts and contradicts its own table and worked example.

- `c24c203fdd49` (Neural-Symbolic Large Language Model (LLM) Multi-Agent Systems), `234b0f19cde5` (Metacognitive AI), and the MCL3 designs provide useful vocabulary but no implementation evidence for their strongest claims. Discount “general-purpose,” “human-level,” “eliminates hallucination,” “safe fallback,” and “model-agnostic” language throughout the cluster.

- Narrow experiments do not transfer directly: MRKL uses synthetic arithmetic; the neural-symbolic agent uses five driving students; the constrained fuzzy controller uses 391 simulated examples; AlignedCoT is mostly arithmetic/table reasoning; and the language-knowledge agent uses household tasks. No paper evaluates privileged legal documents, exact legal citation authority, attorney approval, bitemporal revision, matter walls, or production adversarial conditions.

- Formal results establish representability or restricted-fragment tractability, not learnability, extraction fidelity, bitemporal correctness, or operational safety. Every adoption should begin as a deterministic repo-local fixture or exploration, not a production presumption.

## Papers in this cluster

- 3072c5297dbc — Exploiting Language Models as a Source of Knowledge — silver
- 9f1484f54bef — Integrating Metacognition into Artificial Agents — silver
- 9e55e391080a — SYMBOLIC AI: A FRAMEWORK FOR LOGIC-BASED APPROACHES COMBINING — silver
- f8ddc3b5ac43 — A Neural-Symbolic Cognitive Agent for Online Learning and Reasoning — silver
- 1a3665b7d2ae — A modular, neuro-symbolic architecture that combines large language models — silver
- 6682c2d0729f — Toward Artificial Metacognition — silver
- 576ee59aaf2b — Two Approaches to Implementing Metacognition — silver
- 37c958e24d62 — Architecture for a General Purpose Metacognitive Agent — silver
- 29044694a09c — Meta-reasoning in autonomous agents: performance gains across benchmarks — silver
- 77fde20a861d — General-Purpose Metacognition Engine — silver
- d5c6e70169d4 — Neural-Symbolic Cognitive Agents: Architecture and Theory — silver
- 86d65f8219b2 — The Grand Challenges and Myths of Neural-Symbolic Computation — silver
- 7ea169e822e0 — Toward Domain-Neutral Human-Level Metacognition — silver
- 1ce62d3842ef — Knowledge representation and acquisition: Reflections on implicitly learning — silver
- 8031a91d7e5b — Lari: A Recursive Symbolic Engine for Veriﬁable Cognition — bronze
- 234b0f19cde5 — Metacognitive AI: Framework and the Case for a — silver
- c24c203fdd49 — Neural-Symbolic Large Language Model (LLM) Multi-Agent Systems — silver
- 665cd63780b0 — A Neural-Based Architecture for Bridging the Gap Between — silver
- c83ef6c0788e — Metareasoning as an Integral Part of Commonsense and — silver
- 49635ef7257c — Stochastic LLMs do not Understand Language: Towards Symbolic — silver
- d7c64f6843f5 — THINK BEYOND SIZE: ADAPTIVE PROMPTING FOR MORE EFFECTIVE — bronze
- c2e659c0cf0d — Language Models as a Knowledge Source for Cognitive — silver
- aff0b53d4126 — AlignedCoT: Prompting Large Language Models via Native-Speaking Demonstrations — silver
