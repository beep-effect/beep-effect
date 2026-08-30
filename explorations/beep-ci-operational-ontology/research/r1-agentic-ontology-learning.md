# Agentic ontology learning practice, 2020-2026

**Date:** 2026-08-27

## Scope and finding

LLM-driven ontology engineering is now a recognizable practice, but the evidence does not
support autonomous ontology construction as the default. The strongest systems constrain the
model with a schema, retrieve from trusted ontologies or corpora, emit reviewable candidates,
and keep formal validation and expert acceptance outside the model. Recent benchmarks are
better at measuring isolated learning tasks than the fitness of a deployed ontology.

For this packet, the useful lesson is not "let several models invent a taxonomy." It is to
make agents operate inside a typed, testable change process. Mechanical extraction should own
facts already expressed by the repository. LLMs should work on unresolved naming, missing
relations, scope disputes, and alternative models. Competency-question tests, rule-engine
checks, provenance, and human ratification should decide what survives.

This survey weights 2024-2026 work. The 2026 papers cited below were available by the report
date but are recent preprints unless a venue is stated.

## (a) Classic ontology learning from text: brief grounding

The classic lineage treated ontology learning as a pipeline of NLP and statistical tasks:
extract candidate terms from a corpus, identify concepts and synonyms, induce `is-a`
relations, discover non-taxonomic relations, and let an engineer curate the result. Its
end product was usually a lightweight taxonomy or a set of scored candidate changes, not a
trusted axiomatization produced without review.

OntoLearn is representative. It combined domain terminology extraction, sense
disambiguation, and taxonomy induction. The later graph-based OntoLearn Reloaded framed
taxonomy induction as selecting a structure over candidate concepts rather than asking a
language model to write OWL directly. See Velardi, Faralli, and Navigli,
[_OntoLearn Reloaded_](https://aclanthology.org/J13-3007/),
doi:10.1162/COLI_a_00146.

Text2Onto made two ideas especially relevant here. First, learned knowledge was represented
at a meta-level instead of being committed immediately to one ontology language. Second,
changes in the source corpus could produce scored ontology-change candidates. That separation
between evidence, candidate assertion, and accepted ontology anticipated today's safer LLM
workflows. See Cimiano and Volker,
[_Text2Onto_](https://doi.org/10.1007/11428817_21),
doi:10.1007/11428817_21.

The continuity with the LLM era matters more than the change in model family. Both generations
need corpus selection, normalization, confidence or evidence tracking, and curator decisions.
LLMs broaden the range of text and relations that can be proposed. They do not remove the
distinction between a plausible statement and an admitted axiom.

## (b) LLM-era systems and workflows

### SPIRES and OntoGPT

SPIRES is a schema-constrained knowledge-extraction method implemented in OntoGPT. It takes a
schema, an entry class, and text; constructs a prompt; parses a structured completion;
recurses over nested structures; grounds extracted entities against ontologies; and can
optionally translate the result to OWL. The published method is therefore closer to populating
a specified knowledge model than discovering an unconstrained ontology. See Caufield et al.,
[_SPIRES_](https://pmc.ncbi.nlm.nih.gov/articles/PMC10924283/),
doi:10.1093/bioinformatics/btae104, and the
[_OntoGPT repository_](https://github.com/monarch-initiative/ontogpt).

Its evaluation also warns against reading structured output as correctness. On the BC5CDR
chemical-disease relation task, SPIRES reported F1 41.16 with chunking, precision 0.43, and
recall 0.39. Without chunking, the reported runs traded higher precision for lower recall.
Grounding improved some ontology-identifier tasks sharply, but performance varied by ontology
and model. The transferable practice is constrained extraction plus grounding, not automatic
admission.

For beep CI semantics, a LinkML-like extraction template maps well to typed source mining when
the input is prose or logs. It is a poor substitute for parsing `turbo.json`, schemas,
`LiteralKit` domains, topology output, or yeet verdicts directly. Those artifacts already have
formal structure. Sending them through a generative extractor would add an avoidable error
channel.

### OBO-adjacent curation practice

The clearest operational pattern in the OBO ecosystem is assisted curation. CurateGPT indexes
ontologies, structured records, and issue trackers, retrieves related examples, and proposes
curation operations. DRAGON-AI, implemented in that tool family, uses retrieval-augmented
generation to propose relationships, textual definitions, and simple logical definitions.
Its study covered ten ontologies and used 24 ontology editors and curators, with at least two
evaluators per ontology. Generated relationships had high precision but moderate recall;
generated definitions were useful but rated below human-authored definitions. The authors
explicitly position the system as curator assistance. See Toro et al.,
[_DRAGON-AI_](https://doi.org/10.1186/s13326-024-00320-3),
doi:10.1186/s13326-024-00320-3, and the
[_CurateGPT repository_](https://github.com/monarch-initiative/curategpt).

This is OBO-community-adjacent practice, not an OBO Foundry policy endorsing LLM-generated
axioms. The Foundry's normative practice still emphasizes scope, shared identifiers, relation
reuse, textual definitions, collaboration, a locus of authority, versioning, and maintenance.
Its dashboard automates conformance and ROBOT-report checks, but its
[_about page_](https://dashboard.obofoundry.org/dashboard/about.html) warns that the results
do not establish content quality. See the
[_OBO Foundry principles_](https://obofoundry.org/principles/fp-000-summary.html) and
[_OBO Dashboard_](https://dashboard.obofoundry.org/).

That combination is a good model for this packet: agents may prepare changes, while named
authority, formal checks, and review govern acceptance.

### LLM taxonomy induction and end-to-end drafting

LLMs4OL turned ontology learning into benchmarkable subtasks: term typing, type-taxonomy
discovery, and non-taxonomic relation extraction. The 2024 challenge supplied multiple
domains and zero-shot and few-shot settings. Taxonomy discovery was commonly evaluated with
pairwise F1. See Babaei Giglou et al.,
[_LLMs4OL 2024 overview_](https://arxiv.org/abs/2409.10146).

This benchmarking is useful but narrower than ontology engineering. Pairwise F1 can reward
reproduction of a reference hierarchy without showing that the ontology answers its CQs,
stays within OWL 2 RL, compiles to the intended rules, or improves an operational decision.
A 2025 task survey similarly maps LLM work onto established ontology-engineering lifecycles
and identifies missing reference benchmarks across requirements, implementation, and
evaluation. See Garijo et al.,
[_LLMs for Ontology Engineering_](https://ceur-ws.org/Vol-3953/364.pdf).

More recent end-to-end work moves requirements back into the prompt. Lippolis et al. evaluate
ontology drafts generated from user stories and CQs on ten ontologies, 100 CQs, and 29 user
stories. Their Memoryless CQbyCQ and Ontogenia methods combine requirements with structural
and expert evaluation. They report substantial gains over earlier prompting, alongside common
mistakes and run-to-run variability. See
[_Ontology Generation using Large Language Models_](https://arxiv.org/abs/2503.05388)
[preprint]. The important design choice is CQ-conditioned drafting, not the claim that one
model configuration generalizes to this repository.

### Multi-agent debate and critic loops

General multi-agent debate evidence shows that multiple model instances can improve some
reasoning and factuality tasks. Du et al. use repeated proposals and cross-agent debate, then
derive a final answer. See
[_Improving Factuality and Reasoning through
Multiagent Debate_](https://proceedings.mlr.press/v235/du24e.html),
ICML 2024.

Ontology-specific evidence arrived later and is thinner. A 2026 preprint decomposes ontology
generation into Domain Expert, Manager, Coder, and Quality Assurer roles. On insurance
contracts, it reports better structural quality and modestly better CQ queryability than a
single-agent baseline. The authors attribute much of the gain to front-loaded planning and
artifact-oriented role separation, not debate alone. See Talukder, Mridul, and Seneviratne,
[_Towards Automated Ontology Generation from Unstructured Text_](https://arxiv.org/abs/2604.23090)
[preprint].

Debate also has known failure modes. LLM judges show position, order, and lexical bias. A 2025
study found that multi-agent judging could amplify position, verbosity, chain-of-thought, and
bandwagon biases after the first debate round. Another found sycophancy, where agents reinforce
one another rather than test the argument, increasing both cost and unreliability. See Liu et
al., [_Debate Evaluation_](https://aclanthology.org/2024.acl-short.44/),
doi:10.18653/v1/2024.acl-short.44; Ma et al.,
[_Judging with Many Minds_](https://aclanthology.org/2025.findings-emnlp.941/),
doi:10.18653/v1/2025.findings-emnlp.941; and Pitre et al.,
[_CONSENSAGENT_](https://aclanthology.org/2025.findings-acl.1141/),
doi:10.18653/v1/2025.findings-acl.1141.

The packet should therefore use heterogeneous agents to produce explicit alternatives and
counterexamples. It should not treat consensus, eloquence, or repeated agreement as evidence.

## (c) Evaluation practice

### Competency-question acceptance

CQs are both functional requirements and test candidates. A 2020 dataset links 234 natural-
language CQs to 131 SPARQL-OWL queries across several ontologies, demonstrating that CQ
formalization can be a concrete engineering artifact rather than review prose. See
Wiśniewski et al.,
[_Dataset of ontology competency questions to SPARQL-OWL
translations_](https://pubmed.ncbi.nlm.nih.gov/31989008/).

CQ success is necessary but not sufficient. A query may pass because of accidental A-Box
fixtures, overbroad classes, or a rule that produces the expected answer for the wrong reason.
Acceptance should combine CQ tests with consistency, profile compliance, SHACL constraints,
provenance checks, mutation tests, and expert review of modeling intent.

### Hallucinated-axiom rates

No standardized "hallucinated-axiom rate" was located across the surveyed ontology-learning
work. Papers more often report precision, recall, F1, structural criteria, comparison with
held-out asserted relations, or blinded expert ratings. DRAGON-AI also shows why a simple
false-positive count is awkward: a generated relation absent from the reference ontology may
be a valid alternative or a missing assertion. Training-data contamination is another threat
because public ontologies may occur in model pretraining.

This packet should define its own auditable rate. A candidate axiom is unsupported when it has
no typed-source derivation, cited corpus span, accepted reuse mapping, or ratified expert
rationale. Report unsupported candidates divided by all generated candidates before review,
then separately report the rejection rate and post-admission defect escapes. This is a packet
recommendation, not an established metric [UNVERIFIED].

### Human-in-the-loop gates

The strongest practice uses humans at semantic boundaries, not for syntax cleanup. Experts
approve scope, distinguish alternative valid models, review definitions and relation choices,
and decide whether evidence warrants change. Machines should handle parsing, identifier
validation, OWL-profile checks, reasoning, SHACL, CQ execution, diff generation, and repeated
regression.

KGCL fits that division. It represents ontology and knowledge-graph changes as a standard data
model with controlled natural-language forms that can describe requested or completed edits.
It supports reviewable patch and diff workflows rather than opaque regeneration. See Hegde et
al., [_A Change Language for Ontologies and Knowledge Graphs_](https://arxiv.org/abs/2409.13906).

## (d) Mapping to this packet's pipeline

### S0 baseline KPI ETL

Evaluation begins with an explicit task and held-out evidence. Most ontology papers optimize
ontology-task scores, not fleet P50/P95 time-to-certainty. The packet must retain its
operational KPI.

### S1 capture and hygiene

Corpus selection and provenance precede extraction. Do not mix source authority tiers or let
model recall count as corpus evidence.

### S2 ORSD/CQs

CQ-driven authoring and SPARQL acceptance are established practice. A class serving one CQ is
not automatically well modeled. Add negative and mutation tests.

### S3 research and reuse

OntoGPT, CurateGPT, and OBO practice ground candidates in existing resources. Reuse should
precede minting; an embedding match still needs semantic review.

### S4 formal-first T-Box bootstrap

Schema-constrained extraction supports structured candidate generation. Direct parsers must
outrank LLM extraction for typed repository artifacts. "Zero-hallucination" extraction still
needs parser tests and provenance.

### S5 adversarial taxonomy

Multi-agent roles and critics can expose alternatives and missing distinctions. Debate
consensus is not truth. Randomize order, preserve independent first passes, require evidence,
and measure novelty and defects.

### S6 A-Box ratification

SPIRES-style schema filling and grounding fit prose and log evidence. Generated individuals
and relations remain candidates until source spans and identifiers validate.

### S7 projection function

Functional evaluation should test what the ontology enables. CQ coverage alone does not prove
schedule quality. Compare projected schedules against the KPI baseline and counterfactuals.

### S8 OWL 2 RL, SHACL, and rules

Formal validation outside the LLM matches mature practice. Keep deterministic validators
authoritative. Do not ask an LLM judge to waive profile, consistency, or rule failures.

### S9 dogfood and evolution

KGCL, versioning, diffs, and regression tests fit governed evolution. A passing change still
needs semantic ownership, rollback, and KPI monitoring for regressions.

## Contradictions & risks for this packet

1. **Dry-2 has no located ontology-engineering validation.** Two rounds with no new terms may
   measure shared blind spots, prompt convergence, or sycophancy. Keep the token bound, but
   require independent initial proposals, evidence-linked deltas, a CQ-coverage threshold,
   and an unresolved-objection register. Treat dry-2 as a cost stop, not proof of completeness
   [UNVERIFIED].

2. **"Decision-relevance or death" can overfit the present CQ suite.** CQs are a sound scope
   gate, but current questions may omit future maintenance, explanation, provenance, and
   negative cases. Track deferred concepts and rejected evidence so a new CQ can reopen them
   without repeating the mining work.

3. **"Zero-hallucination extraction cost" is too strong.** Typed inputs reduce semantic
   invention, but parsers can misread defaults, aliases, generated configuration, conditional
   tasks, or versioned behavior. Every mechanically derived assertion needs a source pointer,
   extractor version, and reproducible test.

4. **LLM diversity may be cosmetic.** Different branded models can share training data,
   ontology memorization, prompt-induced biases, and the same mistaken framing. Heterogeneity
   should include roles, evidence partitions, and attack criteria, not only model vendors.

5. **CQ green is not operational value.** The packet's real KPI is fleet P50/P95 time-to-
   certainty. An internally elegant ontology that answers all CQs but produces no faster or
   fairer verification schedule has failed the packet.

6. **OWL/open-world and CI/closed-world semantics remain in tension.** OWL 2 RL compilation is
   practical, but absence-based CI decisions need explicit closed-world boundaries, complete
   instance snapshots, and rules whose semantics are tested outside generic OWL entailment.

7. **Human review can become the new bottleneck.** DRAGON-AI shifts work toward auditing.
   Measure reviewer time, candidate rejection rate, defect escapes, and time from proposal to
   ratification. Otherwise the agentic pipeline may lower generation cost while increasing
   time-to-certainty.

8. **Model and benchmark results will drift.** Prompt sensitivity, model updates, data leakage,
   and ontology-specific style make published scores poor permanent priors. Pin model and
   prompt versions, retain candidate artifacts, and rerun a small packet-owned benchmark after
   changes.
