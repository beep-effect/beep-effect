# Cluster synthesis — Agent security, governance & multi-agent orchestration

- **Date:** 2026-07-25  **Synthesist:** codex gpt-5.6-sol (max)
- **Cluster:** agent-security-orchestration — 25 papers (ids listed at the end)
- **Feeds:** agent governance/control plane and professional runtime; ingestion secret scrub; citation authorization; bitemporal audit; legal-action policy

## Verdict paragraph

This cluster supports one architectural conclusion: agent security is a typed, externally enforced property of the whole execution trajectory, not a property of a model response. The repo is directionally right about exact-record authority, rebuildable semantic projections, candidate-only agent writes, deterministic grounding, and fail-closed secret admission. The required refinement is to keep five decisions distinct: content may enter a prompt; evidence is verified; a proposition or decision is accepted; an action is authorized; an output is released. None implies the next. Multi-agent designs add principals, delegation, performatives, causal ancestry, and lifecycle state—but no new source of authority. The literature justifies deterministic default-deny capabilities, versioned commitments, independent certification, budgeted execution, meaningful human approval, and complete trace evidence. It does not justify importing any paper’s claimed security percentage or release threshold.

## Design challenges

1. **Grounding and scrubbing do not confer action safety.**

   - **Papers:** caefce8b35a2 (LLM Agents can Autonomously Exploit One-day Vulnerabilities), faeed21c6fc9 (Towards trustworthy agentic AI), 05d0a27d8629 (Secure-by-Default Guardrails for MCP-Based Tool Use).
   - **Strength:** Moderate-to-strong. The small but implemented vulnerability benchmark reports a sharp exploitation increase when disclosures are supplied; the broader control recommendations are survey or design synthesis.
   - **Re-examine:** `safeForPrompt` must remain a narrowly typed confidentiality/coverage result, never a general safety token. Likewise, a verified citation proves the emitted span, not the legitimacy of an action derived from it. Add a separate intent-, principal-, capability-, and budget-aware authorization boundary after retrieval and before every side effect. This does not justify widening the current scrub goal into its explicit injection non-goal.

2. **Human acceptance authorizes a runtime decision; it does not make the accepted proposition true.**

   - **Papers:** 2a33e80446ab (Decision as the Ontological Imperative), 01b2258ed130 (The Devil in the Detail), 5ea186e9fffe (OTIP as a Commitment-Integrity Layer).
   - **Strength:** Strong doctrinal and conceptual support, but no direct approval-UX experiment.
   - **Re-examine:** The professional runtime’s phrase “authoritative runtime truth” risks collapsing an authoritative acceptance event into epistemic truth. Preserve the accepted proposition’s evidence, uncertainty, interpretive status, and contestability separately from the attorney’s authoritative decision. Approval should expose alternatives and consequences and capture rationale; a confirm click after one recommendation is vulnerable to rubber-stamping.

3. **Read-only is not intrinsically low risk.**

   - **Papers:** 05d0a27d8629 (Secure-by-Default Guardrails for MCP-Based Tool Use), faeed21c6fc9 (Towards trustworthy agentic AI), 2ad7451c2819 (AGENT-FENCE).
   - **Strength:** Moderate architectural support; the MCP paper does not test an end-to-end read-plus-egress attack, and AGENT-FENCE omits a dedicated confidentiality predicate.
   - **Re-examine:** Future unattended reads in the professional runtime must be gated by matter, resource classification, principal, purpose, and available sinks. An allowed privileged read plus an allowed network or remote-MCP call is an exfiltration capability. “No write” is not an adequate confidentiality policy.

4. **Append-only logs and hashes do not prove truth, completeness, or durable retention.**

   - **Papers:** b9ac605c406e (OTIP: A Falsifiable Anti-Goodhart Protocol), 2dc05086235c (AILab), d2fb8e91a6a9 (Metacognitive Multi-Agent Systems), 93e36f54c4ed (A Dialogue Game Protocol).
   - **Strength:** Logically strong; deployed tamper-resistance evidence is absent.
   - **Re-examine:** Preserve the complete permissible event payload, sequence, actor, policy version, and trusted chain head. Test deletion, truncation, replay, and alternate histories. A hash proves correspondence to some payload, not that the payload is true or that no events were removed. A derived `decision.json`, mutable tuple centre, semantic graph, or SAT result cannot replace exact events. The claims in d2fb8e91a6a9 that graph execution supplies ground truth and SAT yields a verified fact explicitly contradict the binding No-Escape doctrine and must be rejected.

5. **Safety qualification cannot be inherited across model, prompt, adapter, or modality changes.**

   - **Papers:** 93ee78a5076c (Learning To See But Forgetting To Follow), 32499919f05e (LMSanitator), 0d06c1a2189a (Prompt Engineering a Prompt Engineer), e77ec0588486 (Securing With Dual-LLM Architecture).
   - **Strength:** Moderate empirical support across mismatched domains: three VLM/backbone pairs, older prompt-tuned encoders, broad prompt-optimization benchmarks, and one leaky replay case study.
   - **Re-examine:** Bind admission to the exact artifact digest, provider/version, adapter, prompt, tool wrapper, decoding configuration, and modality. Requalify whenever one changes. Two calls to the same model are role separation, not independent trust roots; an optimized prompt is a model-specific candidate, not a portable policy asset.

6. **Scalar metrics, prose criteria, and LLM judges can certify false success.**

   - **Papers:** 0d06c1a2189a (Prompt Engineering a Prompt Engineer), b9ac605c406e (OTIP: A Falsifiable Anti-Goodhart Protocol), e6b81c79c7ba (Designing Scalable Agentic AI Platforms), 2ad7451c2819 (AGENT-FENCE).
   - **Strength:** Moderate. PE2 demonstrates a higher-scoring false shortcut; OTIP contains a sign error and missing required tests; the other two supply weaker or internally inconsistent evidence.
   - **Re-examine:** Encode metric polarity, thresholds, required phases, comparator identities, evidence completeness, and verdict logic as executable schemas. Hard rules need deterministic checkers. LLM judges may triage soft qualities but cannot certify authorization, citation grounding, policy compliance, or release readiness.

7. **An injection-and-secrets safety program is not a complete safety case.**

   - **Papers:** 5c1484ac513f (Laissez-Faire Harms), 93ee78a5076c (Learning To See But Forgetting To Follow), caefce8b35a2 (LLM Agents can Autonomously Exploit One-day Vulnerabilities), 32499919f05e (LMSanitator).
   - **Strength:** Strong within bounded settings: a 500,000-generation bias audit, matched multimodal comparisons, a 15-vulnerability benchmark, and a broad older-encoder backdoor study.
   - **Re-examine:** Governance evaluation needs mundane-prompt role-allocation tests, modality controls, public-but-dangerous evidence, supply-chain attacks, adaptive holdouts, and cross-tool exfiltration. These belong in follow-on assurance work, not in the current two-week secret-scrub slice.

8. **Persistent shared state and multi-agent consensus can propagate error rather than correct it.**

   - **Papers:** 2ad7451c2819 (AGENT-FENCE), d2fb8e91a6a9 (Metacognitive Multi-Agent Systems), 93e36f54c4ed (A Dialogue Game Protocol), 732f32dcebe0 (Improving Language Model Prompting).
   - **Strength:** Weak-to-moderate. AGENT-FENCE’s memory ablations are unreproducible, the context experiment is small, and both multi-agent protocols lack empirical evaluation.
   - **Re-examine:** Shared graphs, commitment stores, and tuple centres must be rebuildable projections of exact message and decision events. Preserve rejected moves and conflict evidence. Participant unanimity must not substitute for attorney authority, and larger context or persistent writes should earn admission through ablation rather than assumption.

## Direct patterns

1. **Typed trajectory envelope and security-break predicates**

   - **What:** Record role-tagged messages; principal; objective and policy revision; tool name and arguments or protected redacted projection; authorization source; capability scope; resource; memory reads/writes; delegation; retries; budgets; result; and causal parent. Derive unauthorized invocation, unsafe argument, wrong-principal action, state-integrity violation, confidentiality breach, and attack-linked deviation as typed outcomes.
   - **Sources:** 2ad7451c2819 (AGENT-FENCE), faeed21c6fc9 (Towards trustworthy agentic AI), 05d0a27d8629 (Secure-by-Default Guardrails for MCP-Based Tool Use).
   - **Target stream:** `explorations/agent-governance-control-plane` and `goals/agentic-professional-runtime`.
   - **Concrete first step:** Specify one `ExecutionAttempt → AuthorizationDecision → ExecutionResult | SecurityBreak` fixture and replay it with allow, deny, escalation, budget-exceeded, and secret-egress outcomes.

2. **Versioned commitment artifact**

   - **What:** Freeze each run’s objective, constraints, permitted side paths, success criteria, and governing evidence. Valid changes append a revision; every action identifies the revision it followed. Classify outcomes as legitimate success, competence failure, update failure, integrity failure, or justified abstention.
   - **Sources:** 5ea186e9fffe (OTIP as a Commitment-Integrity Layer), 2f8e3f5ed7c2 (OTIP-for-LLMs Pilot), 93e36f54c4ed (A Dialogue Game Protocol).
   - **Target stream:** agent governance/control plane.
   - **Concrete first step:** Add a synthetic policy-update sequence in which secret-scrub rules change mid-run, then test correct revision, stale-rule execution, attempted waiver, and evidence-grounded abstention.

3. **Two-sided secret and capability pipeline**

   - **What:** Scrub and classify before prompt construction; carry only sanitized content and a non-authorizing admission result; scan outgoing tool arguments and messages; resolve credentials through opaque, task-scoped handles; then authorize the requested action independently.
   - **Sources:** faeed21c6fc9 (Towards trustworthy agentic AI), 07e39802c9b6 (LLMGuard), 05d0a27d8629 (Secure-by-Default Guardrails for MCP-Based Tool Use), e77ec0588486 (Securing With Dual-LLM Architecture).
   - **Target stream:** `goals/ingestion-secret-scrub` for the one-way seam; agent governance for egress and credential authority.
   - **Concrete first step:** In the current goal, prove that `safeForPrompt` cannot satisfy an action-authorization type. In a follow-on fixture, combine a classified read with an outbound tool and require an explicit confidentiality verdict before transmission.

4. **Independent certification and explicit release states**

   - **What:** Separate acting runtime from verification authority. The generator cannot alter source bytes, verified spans, evaluator configuration, audit history, or success markers. Model `drafted → verified → approved → released`; asynchronous evaluation is retrospective unless release waits.
   - **Sources:** 5ea186e9fffe (OTIP as a Commitment-Integrity Layer), b9ac605c406e (OTIP: A Falsifiable Anti-Goodhart Protocol), e6b81c79c7ba (Designing Scalable Agentic AI Platforms), 2dc05086235c (AILab).
   - **Target stream:** agent governance and citation-verified spans.
   - **Concrete first step:** Make the verifier consume frozen evidence read-only and compute its verdict through a pure function whose schema requires every gate and comparator.

5. **Decision-complete attorney approval packet**

   - **What:** Present authority context, initial facts, proposed actions and ordering, evidence, alternatives, uncertainty, expected consequences, proposed diff, commitment revision, policy basis, unresolved questions, and waivers. Capture reviewer rationale and distinguish attorney-final authority from advisory agent assent.
   - **Sources:** 93e36f54c4ed (A Dialogue Game Protocol), 2a33e80446ab (Decision as the Ontological Imperative), a0240f0f8138 (When Should Language Models Remain Silent?).
   - **Target stream:** `goals/agentic-professional-runtime`.
   - **Concrete first step:** Extend one existing approval fixture with alternatives, side effects, uncertainty, reviewer rationale, and a comprehension-sensitive reject/revise path.

6. **Risk-bounded execution graph and staged release**

   - **What:** Represent retries, fallbacks, parallel branches, and delegation as an unfolded graph with causal parents, idempotency keys, and side-effect classes. Enforce token, tool-call, retry, elapsed-time, and spend ceilings. Release through incident replay, sandbox/OOD stress, read-only shadow, limited canary, and rollback.
   - **Sources:** faeed21c6fc9 (Towards trustworthy agentic AI), 2ad7451c2819 (AGENT-FENCE), caefce8b35a2 (LLM Agents can Autonomously Exploit One-day Vulnerabilities), 8f4dd599bd01 (Eyla).
   - **Target stream:** agent governance.
   - **Concrete first step:** Create one long-horizon browser-to-terminal red-team fixture with per-capability grants and a budget-exceeded break. Do not import the papers’ unvalidated numerical thresholds.

7. **Model-and-prompt admission ledger**

   - **What:** Qualify the exact model artifact, digest, adapter, modality, prompt lineage, evaluation corpus, configuration, scanner evidence, clean utility, adaptive attacks, and release decision. Preserve prompt candidates and rollback targets rather than overwriting deployment state.
   - **Sources:** 93ee78a5076c (Learning To See But Forgetting To Follow), 32499919f05e (LMSanitator), 0d06c1a2189a (Prompt Engineering a Prompt Engineer), e77ec0588486 (Securing With Dual-LLM Architecture).
   - **Target stream:** model admission and agent assurance.
   - **Concrete first step:** Run a matched base-versus-adapted matrix over ordinary prompts, jailbreaks, relevant attachments, modality-null controls, hard-negative grounding cases, and held-out attacks; bind qualification to the artifact digest.

8. **Typed multi-agent message envelope**

   - **What:** Separate semantic content and epistemic metadata, communicative intent, and delivery/lifecycle state. Each message carries a principal, typed performative, conversation and causal-parent IDs, evidence IDs, commitment revision, authority scope, cost, and outcome. Exact message attempts are authoritative; semantic graphs and current commitment stores are projections.
   - **Sources:** d2fb8e91a6a9 (Metacognitive Multi-Agent Systems), 93e36f54c4ed (A Dialogue Game Protocol).
   - **Target stream:** `explorations/agent-governance-control-plane`.
   - **Concrete first step:** Define `Inform | Request | Propose | Challenge | Approve | Reject | Retract` with stage and role guards, then test invalid, unauthorized, conflicting, timed-out, and rejected locutions as recorded outcomes.

## Corroborations

- The exact-record/rebuildable-semantics split is independently reinforced by faeed21c6fc9 (Towards trustworthy agentic AI), 2ad7451c2819 (AGENT-FENCE), the OTIP papers, 0d06c1a2189a (Prompt Engineering a Prompt Engineer), and 5c1484ac513f (Laissez-Faire Harms). Labels, graphs, scores, extracted identities, prompts, and verdicts remain versioned derivations.
- The ingestion scrub SPEC’s canonical pattern bank, raw-secret non-persistence, canary scanning, residue/coverage status, and fail-closed prompt gate are stronger than the generic classifier prototypes in 07e39802c9b6 (LLMGuard) and e77ec0588486 (Securing With Dual-LLM Architecture).
- Candidate-only agent writes and strict professional review are supported by 5ea186e9fffe (OTIP as a Commitment-Integrity Layer), 01b2258ed130 (The Devil in the Detail), and cd46cb0bd639 (Authorized and Unauthorized Practices of Law), subject to the distinction between an authoritative decision and factual truth.
- Deterministic verified spans and preserved source versions are corroborated by 0d06c1a2189a (Prompt Engineering a Prompt Engineer), 01b2258ed130 (The Devil in the Detail), and e77ec0588486 (Securing With Dual-LLM Architecture). The cluster adds that grounding is not authorization.
- Bitemporal, append-only rule, belief, and decision revisions are supported by the OTIP lifecycle, AGENT-FENCE attack links, model-trust changes in 32499919f05e (LMSanitator), and later human adjudication in e77ec0588486 (Securing With Dual-LLM Architecture).
- Schema-first tagged outcomes and deterministic policy checks are repeatedly favored over free-form rationales and scalar trust scores.

## Delta vs the June-29 prior synthesis

**Genuinely new:**

- The June-29 synthesis focused on legal relations, norms, identity, provenance, verified spans, and temporal legal state. This cluster adds a trajectory-level security model: principal, authority source, commitment revision, tool scope, memory mutation, delegation, retries, budgets, release state, and attack lineage.
- Verified evidence is newly shown to be a capability amplifier. caefce8b35a2 (LLM Agents can Autonomously Exploit One-day Vulnerabilities) makes the separation between evidence verification and action authorization load-bearing.
- Commitment/update/integrity failure is a distinct control-plane taxonomy, not another claim-lifecycle state.
- Model, adapter, modality, and prompt artifacts require independent admission and temporal trust state.
- Meaningful approval requires alternatives, uncertainty, consequences, and rationale; candidate acceptance alone is insufficient evidence of deliberative control.
- Confidentiality must cover classified reads, cross-tool flows, outgoing arguments, traces, and credential handles—not just stored input text.
- The assurance corpus must include mundane role-allocation bias, model-supply-chain attacks, multimodal regressions, and public-but-dangerous content in addition to prompt injection and secret leakage.
- Multi-agent orchestration needs typed performatives, per-principal capabilities, causal ancestry, rejected-attempt logging, and explicit deadlock/attorney-final rules.

**Re-confirmed:**

- Derived legal semantics, graphs, scores, and model explanations are not authority.
- Exact sources and events, deterministic grounding, provenance, lifecycle history, temporal qualification, and explicit contestability remain essential.
- A single monolithic legal ontology is inappropriate; legal function, jurisdiction, authority, role, time, and interpretive stance remain separate.
- Closed schema validation and deterministic verification should guard hard boundaries; open-textured legal reasoning stays outside static types.

**Contradictions and corrections:**

- The prior synthesis’s phrase “OWL source of truth” conflicts with the binding No-Escape doctrine if read as epistemic authority. RDF/OWL and graph state must be rebuildable semantic projections over exact sources and events. “Schema is truth” may govern type and shape contracts; it cannot make a derived legal assertion factually true.
- A verified source span authorizes the exact quotation, not the inferred proposition, tool action, or release. This narrows the prior synthesis’s “publish verified graph nodes” formulation.
- The current repo audit contradicts the prior synthesis’s claim that a verified publication gate already exists; that gate remains prospective.
- d2fb8e91a6a9 (Metacognitive Multi-Agent Systems) explicitly contradicts repo doctrine by treating graph execution as ground truth and SAT as factual verification. SAT proves consistency only relative to encoded premises.
- 2dc05086235c (AILab) contradicts No-Escape when it makes derived `decision.json` sole authority, and 93e36f54c4ed (A Dialogue Game Protocol) conflicts with it when mutable tuple state and silent rejection replace an exact attempt log.

## Tensions & contradictions

- **Exact audit versus secret minimization:** Full trajectories aid reconstruction, while raw secrets must never persist. Adjudicate with storage classes: protected exact legal/source records subject to retention and holds; exact non-secret execution events; expirable semantic caches; and transient secret-bearing content prohibited from durable storage. Store only masked evidence or keyed digests for secret events.
- **Fail-closed controls versus approval fatigue:** 07e39802c9b6 (LLMGuard) favors any-detector veto, while 05d0a27d8629 (Secure-by-Default Guardrails for MCP-Based Tool Use) reports friction from approving reads. Use deterministic vetoes for hard prohibitions, calibrated advisory detectors for soft risk, and resource/sink-aware approval rather than a blanket read/write split.
- **Abstention versus deadline safety:** a0240f0f8138 (When Should Language Models Remain Silent?) favors restraint under ambiguity, but legal silence can hide a deadline. Every delay or abstention needs a visible state, reason code, deadline check, timeout, and escalation route.
- **Automation versus authorship:** bounded low-risk administration may be autonomous, while 2a33e80446ab (Decision as the Ontological Imperative) argues consequential choices require genuine commitment. Use revocable, expiring authority leases and preserve attorney-final decisions for legal advice, filings, client communications, and obligation/deadline assertions.
- **Persistent memory versus contamination:** AGENT-FENCE reports reductions from disabling writes, whereas orchestration papers seek shared semantic state. Admit memory writes through provenance- and trust-aware promotion, preserve attack lineage, and test enabled versus disabled persistence.
- **More context versus better context:** 732f32dcebe0 (Improving Language Model Prompting) reports selective context outperforming full state in a small ablation. Keep evidence-bounded context packets and qualify selection policies rather than treating context volume as monotonic capability.
- **Multi-agent consensus versus legal authority:** 93e36f54c4ed (A Dialogue Game Protocol) terminates on unanimous acceptance, while the repo requires a licensed professional’s decision. Agents may advise, challenge, or veto unsafe execution; they do not collectively manufacture attorney authority.
- **Reported security results versus reproducibility:** AGENT-FENCE’s rankings, the MCP validator’s 100%, and ChatTEDU’s perfect replay detection are not comparable or decision-grade. Adjudicate with repo-owned fixtures, held-out adaptive attacks, benign controls, explicit denominators, and frozen configurations.

## Routing suggestions

Following the packet’s exploration-routing convention, existing active packets are preferred. These are suggestions only; no route is executed here.

| insight | route | rationale |
|---|---|---|
| Trajectory envelope, commitment revisions, authority scopes, break predicates, budgets, and independent certification | extend `explorations/agent-governance-control-plane` | The active capture already owns role authority and gated lifecycle; this cluster supplies the missing research and concrete control artifacts. |
| Decision-complete approval packets and authoritative-decision-versus-truth distinction | attach-to `goals/agentic-professional-runtime` | Tightens the existing approval policy and fixtures without changing candidate-only writes or attorney-final authority. |
| `safeForPrompt` is non-transitive and cannot satisfy action authorization | attach-to `goals/ingestion-secret-scrub` | Record and test the one-way boundary while preserving injection, vault, and egress enforcement as follow-ons. |
| Verified evidence can amplify harmful capability | attach-to `goals/citation-verified-span-substrate` | The span substrate should expose a non-authorizing verification result and preserve security-sensitive provenance for downstream policy. |
| Attack-link lineage, commitment knowledge-time, policy revisions, and model-trust revisions | attach-to `goals/epistemic-bitemporal-edge-core` | These are concrete bitemporal edge/event cases over immutable evidence. |
| Model, adapter, prompt, and modality admission with digest-bound qualification | new-exploration `model-artifact-admission` | The requirement spans supply chain, prompt promotion, multimodal regression, scanner evidence, and rollback beyond any current goal’s scope. |
| Typed multi-agent performatives, conversation lifecycle, rejected attempts, and deadlock rules | extend `explorations/agent-governance-control-plane` | Multi-agent protocol belongs beside role authority and certification separation, not in semantic memory. |
| Function-, audience-, jurisdiction-, practitioner-, and matter-specific legal-action policy | attach-to `goals/semantic-foundation` | cd46cb0bd639 (Authorized and Unauthorized Practices of Law) supports modeling these as separate contextual relations rather than autonomy levels. |
| Held-out adaptive assurance suite covering injection, leakage, bias, modalities, false shortcuts, and cross-tool chains | new-exploration `agent-assurance-regression` | Evaluation design is broad enough to deserve its own shaping pass and can feed governance release gates later. |

## Quality notes

- Tier distribution is **4 gold / 17 silver / 3 bronze / 1 dross**. Tiers reflect repository usefulness, not necessarily original evidentiary strength.
- The strongest empirical contributions are 5c1484ac513f (Laissez-Faire Harms), 0d06c1a2189a (Prompt Engineering a Prompt Engineer), 32499919f05e (LMSanitator), 93ee78a5076c (Learning To See But Forgetting To Follow), and caefce8b35a2 (LLM Agents can Autonomously Exploit One-day Vulnerabilities). Each still has domain, model, or evaluation limitations.
- Agent-security and multi-agent-orchestration evidence is much weaker than the architectural convergence suggests. Most papers are position papers, architecture sketches, protocols without runs, or self-authored demonstrations.
- 2ad7451c2819 (AGENT-FENCE) under-delivered most materially against its triage promise: unreleased artifacts, missing experimental detail, placeholder citations, and contradictory exposure reporting make its numerical rankings provisional.
- The OTIP/AILab family supplies useful commitment and evaluation schemas but little validated efficacy. b9ac605c406e (OTIP: A Falsifiable Anti-Goodhart Protocol) contains missing phases and a threshold-direction contradiction; 2f8e3f5ed7c2 (OTIP-for-LLMs Pilot) and 2dc05086235c (AILab) report no runs.
- e6b81c79c7ba (Designing Scalable Agentic AI Platforms), a0240f0f8138 (When Should Language Models Remain Silent?), d2fb8e91a6a9 (Metacognitive Multi-Agent Systems), and ed46b9ff6084 (Negentropic Over-Conditioning) make production, governance, or safety claims unsupported by their reported evaluations.
- e77ec0588486 (Securing With Dual-LLM Architecture) suffers evaluation leakage and selection circularity; 07e39802c9b6 (LLMGuard) reports disconnected component metrics, not end-to-end safety.
- 32499919f05e (LMSanitator) is valuable supply-chain evidence, but its mitigation headline uses attacker-known attractors and its encoder/soft-prompt setting does not establish protection for modern generative agents.
- 6818397a33f8 (The Dangers of Deploying DeepSeek R1 in Enterprise) is dross: its DeepSeek-specific claims are unsupported and add no repo-grade pattern beyond already established controls.
- No paper evaluates the complete target setting: privileged IP-law documents, deterministic verified spans, matter walls, secret scrubbing, typed tool authorization, attorney approval, and multi-agent execution together.
- Accordingly, this synthesis adopts control structures and test hypotheses, not claimed universal effectiveness, architecture rankings, detector percentages, or release thresholds.

## Papers in this cluster

faeed21c6fc9 — Towards trustworthy agentic AI: a comprehensive survey of — gold  
2ad7451c2819 — AGENT-FENCE: MAPPING SECURITY VULNERABILITIES ACROSS DEEP RESEARCH AGENTS — silver  
5ea186e9fffe — OTIP as a Commitment-Integrity Layer for Agentic AI — silver  
05d0a27d8629 — Secure-by-Default Guardrails for MCP-Based Tool Use in Multi-Modal — silver  
b9ac605c406e — OTIP: A Falsifiable Anti-Goodhart Protocol for Testing Ontological — silver  
e6b81c79c7ba — Designing Scalable Agentic AI Platforms for Enterprise LLM — bronze  
93ee78a5076c — Learning To See But Forgetting To Follow: Visual — silver  
caefce8b35a2 — LLM Agents can Autonomously Exploit One-day Vulnerabilities — silver  
2f8e3f5ed7c2 — OTIP-for-LLMs Pilot A Preregistered Specification for Commitment Integrity — silver  
a0240f0f8138 — When Should Language Models Remain Silent? Governing LLM — silver  
01b2258ed130 — The Devil in the Detail: Mitigating the Constitutional — gold  
07e39802c9b6 — LLMGuard: Guarding against Unsafe LLM Behavior — bronze  
d2fb8e91a6a9 — Metacognitive Multi-Agent Systems (MMAS) with Symbolic Semantic Graphs — silver  
8f4dd599bd01 — Eyla: Toward an Identity-Anchored LLM Architecture with Integrated — silver  
e77ec0588486 — Securing With Dual-LLM Architecture: ChatTEDU an Open Access — silver  
93e36f54c4ed — A Dialogue Game Protocol for Co-operative Plan Proposals — silver  
2dc05086235c — AILab: A Falsifiable, Anti-Goodhart Protocol for Testing Functional/Autonomous — silver  
32499919f05e — LMSanitator: Defending Prompt-Tuning Against Task-Agnostic Backdoors — silver  
0d06c1a2189a — Prompt Engineering a Prompt Engineer — gold  
6818397a33f8 — The Dangers of Deploying DeepSeek R1 in Enterprise — dross  
732f32dcebe0 — Improving Language Model Prompting in Support of Semi-autonomous — silver  
5c1484ac513f — Laissez-Faire Harms: Algorithmic Biases in Generative Language Models — gold  
ed46b9ff6084 — Negentropic Over-Conditioning in LLM-based Governance: A Reproducible Protocol — bronze  
cd46cb0bd639 — Authorized and Unauthorized Practices of Law: The Role — silver  
2a33e80446ab — Decision as the Ontological Imperative: Why We Must — silver
