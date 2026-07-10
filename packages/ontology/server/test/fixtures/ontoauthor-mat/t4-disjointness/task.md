# Task T4 — Material Categories (Disjointness)

## Domain

You are classifying materials into mutually exclusive categories.

## Instructions

Using Ontosphere's MCP tools, create an OWL 2 DL ontology that:

1. Define a top-level class `mat:Material`.
2. Define `mat:Metal` and `mat:Ceramic` as subclasses of `mat:Material`.
3. Declare `mat:Metal` and `mat:Ceramic` as disjoint:
   `mat:Metal owl:disjointWith mat:Ceramic`
4. Define `mat:Polymer` as a subclass of `mat:Material`, also disjoint with both
   `mat:Metal` and `mat:Ceramic`.
5. Create individuals:
   - `mat:Aluminium` of type `mat:Metal`
   - `mat:Zirconia` of type `mat:Ceramic`

The ontology should be consistent. An attempt to classify any individual as both
Metal and Ceramic should trigger an inconsistency.

## Namespace

Use `http://example.org/materials#` with prefix `mat:`.
