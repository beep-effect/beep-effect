# OntoAuthor-Mat Benchmark

Six ontology-authoring tasks for materials science covering OWL 2 DL patterns.
Accompanies the [ISWC 2026 demo paper](https://thhanke.github.io/ontosphere/paper/).

## Task overview

| ID | OWL 2 DL pattern | Domain scenario |
|----|-------------------|-----------------|
| T1 | Subsumption (`rdfs:subClassOf`) | Steel alloy classification hierarchy |
| T2 | Existential restriction (`owl:someValuesFrom`) | Composite materials and constituents |
| T3 | Universal restriction (`owl:allValuesFrom`) | Certified-only material suppliers |
| T4 | Disjointness (`owl:disjointWith`) | Metallic vs. ceramic material categories |
| T5 | Identity (`owl:sameAs`) | Merging duplicate material entries |
| T6 | Unsatisfiability detection | Contradictory material classification |

## Task structure

Each task directory contains:

- **task.md** — natural-language brief shown to the model
- **reference.ttl** — gold-standard OWL 2 DL solution
- **shapes.ttl** — SHACL shapes for automated scoring
- **cq.sparql** — competency questions (SPARQL ASK/SELECT)

## Running

```sh
node scripts/bench-ontoauthor-mat.mjs          # all tasks, default model
node scripts/bench-ontoauthor-mat.mjs --task t1 # single task
```

Results print as a markdown table to stdout. Pipe to `logs/` to keep a copy:

```sh
node scripts/bench-ontoauthor-mat.mjs 2>&1 | tee logs/bench-ontoauthor-mat.log
```

## Scoring

Each task is scored on three axes:

1. **SHACL conformance** — shapes.ttl validates the model's output graph
2. **Competency questions** — SPARQL ASK queries over the output graph
3. **Reasoning correctness** — Konclude classification produces expected inferences

The final per-task score is the fraction of passed checks (SHACL targets + CQ queries).
