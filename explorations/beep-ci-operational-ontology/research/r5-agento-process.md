# R5 — The AgentO Derivation Process (personal read, Fable)

- **Read:** 2026-08-27, full chapter, PDF pages 321–343 of
  `~/YeeBois/research/The Semantic Web.pdf` (printed pp. 298–320).
- **Citation:** Ekelhart, A., Kurniawan, K., Ekaputra, F.J., Kiesling, E.:
  *AgentO: An Ontology for Modeling Agentic AI Systems.* In: Acosta, M. et al. (eds.)
  The Semantic Web (ESWC 2026), LNCS 16550, pp. 298–320. Springer, 2026.
  https://doi.org/10.1007/978-3-032-25159-6_16
- **Resource:** ontology + KG at https://w3id.org/agentic-ai/onto — **CC BY 4.0
  International**, DOI 10.5281/zenodo.18342624; extraction pipeline at
  https://agentic-patterns.github.io/; public SPARQL endpoint
  http://w3id.org/agentic-ai/sparql. (The *paper* is Springer-copyrighted; the
  *ontology resource* is CC BY.)
- **Charge:** the operator's instruction was explicit — the *derivation process* is the
  target, not the ontology. This report distills the process, judges it against our
  locked decisions, and extracts the mechanics worth stealing for S4–S7.

## 1. What they built (one paragraph, for orientation only)

An OWL/RDF vocabulary for agentic AI systems (Team, Agent/LLMAgent/HumanAgent, Task,
Goal, Objective, Tool, Resource, WorkflowPattern/WorkflowStep, Prompt, Config, ...)
plus a knowledge graph instantiating 66 real agentic workflows harvested from four
frameworks (AutoGen 6, CrewAI 16, LangGraph 9, Mastra 35). Reuse spine: `LLMAgent ⊑
prov:Agent`, `WorkflowPattern ⊑ pplan:Plan`, `WorkflowStep ⊑ pplan:Step`, `Team =
beam:System`, `Resource` aligned to `beam:Resource`/`pplan:Variable` (BEAM is
Ekaputra's boxology-notation ontology, KG-STAR @ ESWC 2025). Workflow shapes are a
small recursive algebra: Sequential / Parallel / Nested patterns via
`hasWorkflowStep`, `nextStep`, `hasSubPattern`, `nextPattern`.

## 2. The process as they actually ran it

**Phase A — conceptualization (bottom-up, four systematic stages):**

1. *Component identification* — extract components that recur across the four
   frameworks' code (Agent with title/description/role, Task, Tool, ...). The
   admission signal is cross-framework recurrence, not armchair completeness.
2. *Relationship modeling* — name the edges (`responsibleAgent`, `performedBy`,
   `contributeToGoal`, ...) from observed framework behavior.
3. *Pattern identification* — lift recurring coordination shapes into first-class
   classes (Sequential/Parallel/Nested workflow patterns).
4. *Ontology mapping* — only now formalize: classes, data properties, object
   properties in RDF/OWL, subclassed into PROV-O/P-Plan/BEAM.

**Phase B — KG construction & refinement (the LLM-in-the-loop part):**

1. *Source pattern collection* — 66 hardcoded Python/JS workflow configurations
   pulled from the frameworks' own example repositories.
2. *Prompt-guided extraction against a FIXED schema* — gpt-5-mini translates each
   source file into Turtle instances. The appendix prompt is the load-bearing
   artifact (quoted nearly verbatim because it matters):
   - "Treat [the ontology] as a fixed schema with all classes and properties already
     defined. Do NOT add, modify, or remove any classes or properties in the schema!"
   - "If some aspects of the solution cannot be modeled with the current ontology:
     Do NOT invent new classes or properties ... list any missing concepts,
     limitations, or necessary extensions in an 'Issues / Assumptions' comment block
     at the top of the Turtle output. Do not put it into the ontology."
   - "Fidelity is important, do not change or condense information." Prompts,
     parameters, and logic the schema can't hold are preserved as literals.
   - Every output carries telemetry in its header: execution time, model used,
     issues/assumptions — *the extraction result self-documents its own provenance
     and its own gaps.*
3. *Human-in-the-loop verification* — manually review a stratified sample (6 per
   framework, 24/66 ≈ 36%); cluster what the Issues ledgers + review surfaced into
   **27 common issues**; rule on each one explicitly. Accepted: a `Prompt` class,
   a `Config` class with a runtime/design-time distinction. Explicitly REJECTED with
   recorded rationale: agent runtime datatype flags ("we will not model these
   implementation details"), function calls/loops/invocation semantics (same).
   Ruled: `Tool` is a superclass of `LLMAgent` — a taxonomy decision *produced by
   extraction friction* (reviewers kept confusing Agent and Tool).
4. *Re-run and diff* — after extending the ontology, re-run the FULL automated
   extraction with the updated schema and compare against the first round.
5. *Publish* — triple store + public SPARQL endpoint.

**Cost telemetry (their numbers):** 47.72–166.60 s per pattern; ~2.8M input +
570K output tokens for all 66; **$2.72 total** API cost. Extraction is effectively
free. The scarce resource was reviewer time — they could only afford to review 36%.

**Phase C — validation:** three post-hoc use cases run as SPARQL against the KG:
declarative reconstruction of a workflow subgraph (CONSTRUCT), cross-context
discovery/reuse of components (SELECT by objective), and implementation auditing
(ordered workflow steps + responsible agents + tools for a named pattern). These are
competency questions in everything but name — but written *after* the ontology.

## 3. Judgment: what this confirms for our packet

1. **Model-as-translator, never model-as-inventor — now confirmed from a second
   independent direction.** R1 found the strongest LLM-ontology systems constrain the
   model with a schema and keep acceptance outside it; AgentO is a live ESWC-published
   instance of exactly that: the LLM populates individuals against a frozen T-Box and
   is *forbidden* from minting terms. Missing expressivity surfaces as a typed ledger
   a human rules on. This is our Decision 4 (formal-first) + Decision 5 (CQ gate)
   running in production.
2. **Extraction friction is the best taxonomy critic.** Their two most interesting
   modeling rulings (Tool ⊒ LLMAgent; Config runtime/design-time split) came from
   extraction failures and reviewer confusion, not from a priori design. For S5 this
   means: the adversarial loop's primary input queue should be the *Issues ledgers
   emitted by S4/S6 extraction lanes*, not free-form critique prompts.
3. **Rejections recorded with rationale are half the ontology.** Their Table 1
   "Resolution" column repeatedly says "We will not model these implementation
   details" — the Won't-Have discipline our CQ suite already encodes (3 Won'ts).
   Same posture, independently converged.
4. **Thin subclass alignment into reuse spines works.** They subclass into
   PROV-O/P-Plan/BEAM and stop — no deep import, no attempt to satisfy the parent
   ontology's full semantics. Matches R2's layered-reuse verdict, and gives us a live
   precedent of P-Plan used as an alignment spine in a CC BY-published resource
   (R2's P-Plan license check remains open, but the precedent lowers the risk).
5. **Cheap rerunnable extraction changes the economics of schema evolution.** Because
   translating 66 workflows costs $2.72, "extend schema → re-run everything → diff"
   is a viable inner loop. Our veins are *local files* (attempts.ndjson, turbo.json,
   topo output) — even cheaper. A-Box extraction in S6 must be built as a rerunnable
   pipeline from day one, never a one-shot migration.
6. **Reviewer latency is the real bottleneck — R1's hazard, quantified.** They
   reviewed 36% and stratified by framework. Our S6 must budget review time inside
   the KPI accounting (R1 already demanded this) and stratify samples by vein.

## 4. Judgment: what this warns us about

1. **No CQ gate → vocabulary bloat.** AgentO has no ORSD/CQ stage; validation is
   three post-hoc use cases. The consequence is visible in their Table 4: classes
   like `Environment`, `Context`, `Instance`, `KnowledgeBase` with near-tautological
   descriptions ("a conceptual frame containing relevant situational data") that no
   query in the paper ever touches. That is precisely what our admission law
   ("decision-relevance or death") exists to kill. AgentO is an *interoperability
   vocabulary* — success for it is coverage. Ours is an *operational decision
   engine* — success is a projection that changes a schedule. Adopt their extraction
   mechanics; reject their admission laxity.
2. **Use-case validation ≠ acceptance suite.** Their three use cases were written
   after the ontology and cannot fail it in any controlled way. Our 19-CQ suite with
   generated SPARQL tests and zero-rows constraints is the materially stronger
   discipline. Keep it; do not let S5 degrade toward "demonstrations."
3. **AgentO stops exactly where we begin.** It models *design-time structure*;
   dynamic execution traces and runtime behavior are explicitly future work (BILAI
   project horizon, autumn 2029). Our packet is mostly runtime facts — episodes,
   proofs, epochs, grants, contention. So the novelty verdict survives contact with
   the closest-adjacent ESWC resource: nothing here covers cache epochs,
   proof-validity worlds, or backpressure. Triangulation (R2/R4×3) now has a fourth
   corroborating angle.
4. **Boundary discipline transfers.** Their refusal to model framework SDK details,
   UI components, and control-flow mechanics is the same cut we made with CQ-019:
   model the *typed outcomes* (FailOpenOutcome), never the plumbing (git internals,
   turbo mechanics).

## 5. Steal list (concrete, stage-mapped)

| # | Mechanic | Where it lands |
|---|----------|----------------|
| 1 | **Fixed-schema extraction prompt contract**: frozen T-Box, no minting, fidelity-over-condensation, literals for what the schema can't hold | S4 + S6 codex lane prompts, near-verbatim |
| 2 | **Issues/Assumptions ledger at the top of every extraction output** (typed missing-concept records, never improvised terms) | S4/S6 lane output contract; ledger entries queue into S5 |
| 3 | **Extraction telemetry in the artifact header** (execution time, model, issue count) | S4/S6 outputs; feeds the packet's own KPI accounting |
| 4 | **Stratified sample review + issue clustering + explicit accept/reject table** (their Table 1 format) | S6 A-Box ratification protocol; strata = veins |
| 5 | **Extend-schema → re-run-all → diff** as the schema-evolution inner loop | S5/S6; requires S6 extraction to be rerunnable by construction |
| 6 | **Taxonomy rulings driven by extraction friction** (let the Issues ledgers nominate the S5 agenda) | S5 adversarial loop input queue |
| 7 | **Thin subclass alignment into PROV-O/P-Plan** (their exact pattern: `⊑ prov:Agent`, `⊑ pplan:Plan/Step`) | S8 formalization, per R2's layered-reuse plan |
| 8 | **Workflow algebra as first-class individuals** (pattern/step/nextStep/subPattern) — their audit use case queries step order + responsible agent per pattern | S7 amendment candidate, below |

**S7 amendment candidate (proposal, not doctrine — needs a grill ruling):** AgentO's
auditing use case works because the *workflow itself* is A-Box. Our analog: the
projection function's OUTPUT — the computed WorkUnit schedule — should be written
back as A-Box individuals (a `ScheduleProposal` with ordered WorkUnits, the
AffectedComputation that scoped it per CQ-019, and the grants it assumed). The
reasoner never *computes* the schedule (that stays in the deterministic projection,
per Decision 3 and the estimatedFailureProbability precedent) — but representing the
result makes "why did the scheduler admit X before Y" a CQ instead of a log-dive,
and gives S9's dogfood proof a queryable artifact. Cost: a handful of terms; they
must pass the admission law like everything else.

## 6. Adoption verdict

The chapter earns its place in the pipeline not as ontology prior art (its domain
barely overlaps ours) but as the closest published dry run of our S4–S6 mechanics:
formal-first schema, LLM as constrained translator, friction-driven taxonomy
refinement, rerunnable extraction, sampled human ratification. Every one of its
process choices that worked corresponds to a decision we already locked; its one
structural weakness (no CQ gate) is the discipline we added. Proceed to S4 with the
steal list wired into the lane contracts.
