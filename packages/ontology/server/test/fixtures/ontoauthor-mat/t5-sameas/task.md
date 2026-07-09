# Task T5 — Duplicate Material Entries (owl:sameAs)

## Domain

You are merging material databases where the same physical material appears under
different identifiers.

## Instructions

Using Ontosphere's MCP tools, create an OWL 2 DL ontology that:

1. Define classes `mat:Material`, `mat:Metal`, `mat:Steel`.
2. Define `mat:Steel` as a subclass of `mat:Metal`, `mat:Metal` as subclass of `mat:Material`.
3. Define a datatype property `mat:yieldStrength` (in MPa).
4. Create two individuals representing the same steel:
   - `mat:S355_EN` of type `mat:Steel` with `mat:yieldStrength "355"^^xsd:integer`
   - `mat:S355_ASTM` of type `mat:Steel` with `mat:yieldStrength "355"^^xsd:integer`
5. Assert `mat:S355_EN owl:sameAs mat:S355_ASTM`.

After reasoning, both IRIs should share all properties and type memberships.

## Namespace

Use `http://example.org/materials#` with prefix `mat:`.
