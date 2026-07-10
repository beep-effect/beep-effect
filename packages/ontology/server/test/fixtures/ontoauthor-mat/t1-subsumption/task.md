# Task T1 — Steel Alloy Classification (Subsumption)

## Domain

You are building a materials-science ontology for steel alloys.

## Instructions

Using Ontosphere's MCP tools, create an OWL 2 DL ontology that models a steel alloy
classification hierarchy with the following requirements:

1. Define a top-level class `mat:Material`.
2. Define `mat:Metal` as a subclass of `mat:Material`.
3. Define `mat:Steel` as a subclass of `mat:Metal`.
4. Define `mat:StainlessSteel` as a subclass of `mat:Steel`.
5. Define `mat:AusteniticSteel` as a subclass of `mat:StainlessSteel`.
6. Create an individual `mat:AISI304` of type `mat:AusteniticSteel`.

After running reasoning, the reasoner should infer that `mat:AISI304` is also a
`mat:Metal` and a `mat:Material` (transitive subsumption).

## Namespace

Use `http://example.org/materials#` with prefix `mat:`.
