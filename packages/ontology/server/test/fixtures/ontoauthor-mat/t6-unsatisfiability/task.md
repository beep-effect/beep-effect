# Task T6 — Contradictory Classification (Unsatisfiability)

## Domain

You are testing whether an ontology correctly detects contradictory material
classifications.

## Instructions

Using Ontosphere's MCP tools, create an OWL 2 DL ontology that:

1. Define classes `mat:Material`, `mat:Metal`, `mat:Ceramic`.
2. Define both as subclasses of `mat:Material`.
3. Declare `mat:Metal owl:disjointWith mat:Ceramic`.
4. Create an individual `mat:Cermet` and assert it as BOTH `mat:Metal` AND `mat:Ceramic`.

After running reasoning, the reasoner should detect an inconsistency because `mat:Cermet`
is classified under two disjoint classes. The ontology should report `isConsistent: false`.

This task tests the model's ability to deliberately construct an inconsistent ontology
for testing purposes.

## Namespace

Use `http://example.org/materials#` with prefix `mat:`.
