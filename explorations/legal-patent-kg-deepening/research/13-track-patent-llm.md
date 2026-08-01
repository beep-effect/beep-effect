---
track: 4
name: patent-llm-multiagent
generated: 2026-08-01
distillateCount: 12
---

# Track 4 — Patent LLM Authoring + Multi-Agent IP Workflows

Synthesis over the track-4 distillates: description-conditioned claim generation,
outline-guided long-form drafting, PatentWriter, PatentGPT, PatExpert, AgentODRL,
ODRL policy generation, organizational policy modeling, contract compilation, and
Symboleo. Ten merged claims entered adversarial verification across source-fidelity,
beep-fit, and novelty-vs-wave-1 lenses; eight survived 2-of-3 or better and two were
rejected. Source-fidelity dissents are preserved inline rather than laundered into
stronger conclusions.

## Verified findings

### F1 — Every generated claim limitation needs current-disclosure support (imp. 5)

Description-conditioned Llama-3 materially outperformed abstract-conditioned
generation in P027: BLEU rose from 21.98 to 34.32, with corresponding gains in
ROUGE and BERTScore. That is expected because claims are ordered
independent/dependent structures and descriptions contain far more feature detail
than abstracts. PatExpert likewise feeds broader disclosure sections to its claim
expert rather than using only the abstract (P027, P084).

The improvement is not an acceptance result. P027's experts still found incomplete
feature coverage, null or unsupported features, ambiguous references, terminology
problems, and incorrect feature linkage; P084 does not establish written-description
support or absence of new matter. A draft claim therefore needs an ordered
limitation graph in which every limitation resolves to exact spans in the current
description, with independent and dependent claims evaluated separately (P027,
P084).

- Evidence: P027 and P084.
- Routing: `goals/agentic-professional-runtime` — the IP-attorney drafting workflow and its strict human-promotion boundary (P027, P084).
- Changes: upgrades “cited drafting context” into limitation-level support records; unsupported, ambiguous, or candidate-new-matter limitations cannot be promoted without attorney disposition (P027, P084).

### F2 — Long-form drafting is a hierarchy of auditable work artifacts (imp. 5)

PAP2PAT references average about 18,000 tokens, while single-call Mixtral and Qwen
outputs reached only 17.7% and 15.6% of reference length. COPGEN instead chunks a
hierarchical outline, retrieves paper paragraphs for each chunk, carries prior
outline context, and concatenates the results. More detailed outlines improved
coverage, factuality, and BERTScore without merely increasing output length
(P066).

Length matching is not quality matching. The length-calibrated run raised coverage
but lowered both factuality measures, and fine-tuning improved patent style while
factuality fell and repetition rose. P027 independently shows that even much
shorter claim sets can look plausible while omitting dependent-claim detail
(P066, P027).

The source-fidelity verifier rejected the stronger causal wording that per-section
budgets and chunking each independently improved coverage. The supported design
increment is narrower: outline nodes, section budgets, retrieval spans, generated
chunks, and assembly lineage are explicit controls and audit artifacts, not proven
quality causes in isolation (P066, P027).

- Evidence: P066 and P027.
- Routing: `goals/agentic-professional-runtime` — staged description drafting and attorney review at section boundaries (P066, P027).
- Changes: replaces one opaque “generate specification” call with a replayable outline-to-retrieval-to-chunk derivation whose coverage and factuality can fail independently (P066).

### F3 — Reference overlap cannot accept a patent draft (imp. 5)

P027's strongest expert-rated model was GPT-4 even though its BLEU was only 15.73.
P066 found the inverse failure: patent-style fine-tuning increased similarity while
factuality fell, and ordinary overlap metrics rewarded repeated text. These are
direct demonstrations that imitation and expert-assessed drafting quality can move
in different directions (P027, P066).

The additional track evidence does not repair that gap. PatentWriter evaluates
abstract generation with overlap, perturbation robustness, subclass classification,
retrieval-neighborhood preservation, and style; these are useful proxies but not
claim sufficiency. PatExpert reports high BLEU/ROUGE and model-judged workflow
scores without independent legal-expert validation of support, novelty,
enablement, claim scope, or new matter (P069, P084).

Acceptance should therefore expose separate gates for evidence support or
entailment, completeness, clarity, terminology consistency, claim dependency,
feature linkage, repetition, and attorney adjudication. No aggregate similarity
score may stand in for those decisions (P027, P066, P069, P084).

- Evidence: P027, P066, P069, and P084.
- Routing: `goals/agentic-professional-runtime` — candidate-draft evaluation and attorney acceptance policy (P027, P084).
- Changes: turns “quality” from one score into a provenance-bearing assessment matrix, with blinded attorney comparison as the benchmark design target rather than a capability already demonstrated by these papers (P027, P066).

### F4 — Specialist orchestration needs governed route state (imp. 5)

AgentODRL separates rewriting, splitting, generation, syntactic validation, and
semantic checking. Its forced specialist paths outperform generator-only handling
on parallel and recursive cases, but automatic routing scores 80.22 overall versus
88.07 for the best forced path. The route selector is therefore itself a fallible
model decision, not invisible control flow (P016).

PatExpert contributes typed expert protocols, dependency-aware plans, parameter
requirements, and input/output schemas. It reports strong planning and tool-use
scores, but supplies no controlled monolith-versus-specialist comparison for legal
quality. The source-fidelity verifier therefore rejected the broad claim that
specialist patent orchestration is universally “best” (P084).

The surviving increment is governance: persist the selected plan, candidate routes,
routing rationale, stage inputs and outputs, validator results, retry count, and
final override. Deterministic validation and bounded retries must surround every
model stage, with human or fixed fallback routes available when the selector is
uncertain or wrong (P016, P084).

- Evidence: P016 and P084.
- Routing: `goals/agentic-professional-runtime` — typed orchestration state and promotion policy for specialist IP workflows (P016, P084).
- Changes: makes routing reviewable and replayable instead of treating an orchestrator's choice as an unrecorded implementation detail (P016).

### F5 — Document, norm, derivation, and execution are different identities (imp. 5)

P058 distinguishes a policy-bearing artifact from the organizational policy it
refers to, the authorized activation and effectuation events that make the policy
operative, and a decision rule or DMN table that may implement it. Deleting or
changing the document does not itself erase the normative positions (P058).

P053 proposes a natural-language-to-term-to-workflow-to-code pipeline, but reports
no implementation, correctness result, formal verification, or legal-equivalence
proof. Symboleo likewise separates a requirements-level contract specification
from immutable runtime events and the lifecycle states derived from those events
(P053, P079).

Each layer therefore needs its own stable identity and version: source artifact,
normative position or policy, interpretation/derivation, executable rule, and
runtime event. Links among them are authority- and evidence-bearing derivation
claims with valid and known times, never identity shortcuts (P058, P053, P079).

- Evidence: P058, P053, and P079.
- Routing: `goals/epistemic-bitemporal-edge-core` only as the existing lineage and time substrate; legal/policy layer identities belong in a consumer domain. The beep-fit verifier explicitly rejected widening the completed generic core with IP-law or policy vocabulary (P058, P079).
- Changes: establishes a consumer-side identity boundary without reopening the edge core: `refersTo`, `derivedFrom`, `implements`, and `observedBy` cannot be collapsed into “same policy” (P058, P053, P079).

### F6 — Agent authority needs Party–Role and event-reified position lifecycles (imp. 5)

Symboleo separates a persistent Party from the contract-specific Role through which
that party holds an obligation or power. Obligations and powers move through named
states by immutable events, so a review trace can explain why a position was
created, activated, fulfilled, violated, expired, suspended, resumed, discharged,
exerted, or terminated (P079).

The verified payload overattributed assignment and remedies to Symboleo's 41
lifecycle axioms. More precisely, assignment is a separate runtime operation and
remedies appear as contrary-to-duty dependencies; both remain useful workflow
concepts but are not evidence that the axiom set itself covers every claimed legal
transition (P079).

P058 adds a necessary enforcement distinction: a norm may prohibit an action that
software can technically perform, while software may prevent conduct without that
prevention establishing legal invalidity. Formal verification likewise proves only
properties of the formalized specification, not the legal validity of the contract
or authority of the actor (P058, P079).

- Evidence: P079 and P058.
- Routing: `explorations/agent-governance-control-plane` — reviewable authority, role, delegation, obligation/power, and event-trace contracts; patent docket vocabulary remains downstream (P079, P058).
- Changes: adds explicit authority-state transitions and verifier counterexamples while preserving the rule that technical success is never a legal verdict (P079).

### F7 — Patent-drafting memory is a replayable episode ledger (imp. 4)

The four drafting systems expose complementary episode parts. PAP2PAT supplies the
outline, retrieved paragraphs, chunk configuration, and generated section; PatExpert
adds the plan, expert/tool calls, critique loop, and conversational context; P027
adds limitation-level defects and attorney judgments (P066, P084, P027).

PatentGPT demonstrates the anti-pattern: extracted triples are verbalized and
absorbed into model weights without stable identifiers, edge-level evidence spans,
or an inspectable inference-time graph. Accepted and rejected drafting feedback in
weights may shape behavior, but cannot justify a limitation in the matter currently
being drafted (P068).

The durable unit should be a replayable drafting episode containing matter and
document versions, outline node, retrieval query and spans, model and configuration,
generated chunk, plan and tool calls, critique, validator results, and accepted or
rejected attorney feedback. Current-matter evidence remains authoritative; memory
offers precedents and candidate choices, not disclosure support (P066, P084, P068,
P027).

- Evidence: P066, P084, P068, and P027.
- Routing: `explorations/agent-memory-tiers-bitemporal-edges` — raw drafting episodes as audit records, with summaries and learned preferences treated as lossy projections (P066, P068).
- Changes: specializes wave-1's provenance-backed memory doctrine into a concrete patent-drafting episode and attorney-disposition ledger (P084, P027).

### F8 — Model correction must append a reviewable delta (imp. 5)

AgentODRL's Rewriter resolves clause references by inlining dependencies before
splitting policies. That can improve generation, but may erase the legal significance
of the original reference, amendment, exception scope, or incorporated version if
the source clauses and rewrite decisions are not retained (P016).

P037's self-correction model rewrites an ODRL graph against human-readable rules and
SHACL evaluation. It reports better structural completeness but no test that a
correction avoided semantic regression. P058 and P079 independently show why
replacement is unsafe: artifacts, normative positions, formal specifications, and
runtime events can change on different timelines (P037, P058, P079).

Every correction should therefore add, rather than overwrite: original clauses,
initial graph, validator report, semantic checkpoints, explicit delta, correction
rule, revised candidate, model/configuration, and reviewer action. Unresolved
permission, prohibition, duty, party, asset, or constraint differences become
contradiction candidates rather than silently harmonized text (P016, P037).

- Evidence: P016, P037, P058, and P079.
- Routing: `goals/epistemic-contradiction-triage` through its existing additive candidate and human-supersession mechanics; ODRL clauses and validator records remain caller-owned domain inputs. The beep-fit dissent rejects duplicating that machinery or adding ODRL vocabulary to the generic goal (P016, P037).
- Changes: defines the caller emission contract for correction provenance and pre/post comparison; it does not reopen the already-standing non-destructive triage decision (P037, P079).

## Contradictions & challenges to standing decisions

None found. The limitation-support, drafting-artifact, assessment-matrix,
orchestration, authority, and episode-ledger findings extend wave-1 rather than
conflict with it (P027, P066, P016, P079, P068). F5 and F8 initially point at
completed epistemic goals, but verification narrows them to consumer schemas over
existing bitemporal and additive-triage capabilities; that is a routing correction,
not a challenge to `goals/semantic-foundation` or wave-1 conclusions (P058, P037).

## Rejected in verification

- **ODRL translation as one combined SKOS-guided/SHACL-repaired winning profile** — killed by source-fidelity, beep-fit, and novelty-vs-wave-1: P037 and P016 test different guidance/repair stacks, the proposed owner was wrong, and the core structural-conformance boundary already stood (P037, P016).
- **LLM-extracted patent KGs require a new admission contract in the completed kernel** — killed by beep-fit and novelty-vs-wave-1: its provenance warning is real, but stable IDs, spans, confidence, model provenance, validation, and gated admission already belong to the epistemic owner rather than a new kernel rule (P045, P068, P084).

## Open questions for the /adhd integration pass

1. What is the smallest limitation-support schema that covers ordered claims, dependency references, exact current-description spans, terminology identity, and attorney disposition without pretending to decide written-description law automatically (P027, P084)?
2. Which drafting artifacts are durable domain entities versus transient execution records: outline node, section budget, retrieval set, chunk, assembly boundary, and coverage/factuality assessment (P066, P027)?
3. What benchmark matrix separates support, completeness, clarity, terminology, dependency, feature linkage, repetition, enablement review, and blinded attorney preference while avoiding one composite “quality” score (P027, P066, P069, P084)?
4. When should orchestration use a learned route, a fixed specialist path, a human override, or a cheaper fallback, and what evidence is sufficient to justify that choice per matter (P016, P084)?
5. Which package owns policy artifact, normative position, executable rule, and runtime-event identities while consuming rather than widening the generic bitemporal edge core (P058, P053, P079)?
6. What subset of Symboleo's obligation/power states and Party–Role relations belongs in the agent-governance control plane, and which assignment, remedy, deadline, and docket concepts remain application-specific (P079, P058)?
7. How should raw drafting episodes, lossy summaries, accepted/rejected attorney feedback, and model-weight preferences relate without allowing memory to become current-disclosure evidence (P066, P084, P068, P027)?
8. What generic correction-delta schema can represent source rewrite, SHACL report, semantic checkpoint, revised graph, and reviewer action while leaving ODRL terms in the caller domain (P016, P037, P058, P079)?
9. Which attorney gates are mandatory before a generated description, claim set, policy graph, or workflow becomes operational, and how should abstention and unresolved new matter appear in the UI and audit record (P027, P066, P084, P016)?
10. What independent, leakage-aware evaluation corpus can compare single-call, outline-guided, specialist-agent, and memory-assisted drafting without using overlap, model judges, or granted text as proxies for legal sufficiency (P027, P066, P069, P084, P068)?
