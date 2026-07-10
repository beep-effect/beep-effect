# Task T2 — Composite Materials (Existential Restriction)

## Domain

You are modelling composite materials and their constituents.

## Instructions

Using Ontosphere's MCP tools, create an OWL 2 DL ontology that:

1. Define classes `mat:Material`, `mat:Composite`, `mat:Fiber`, `mat:Matrix`.
2. Define `mat:Composite` as a subclass of `mat:Material`.
3. Define an object property `mat:hasConstituent`.
4. Define `mat:FiberReinforced` as a subclass of `mat:Composite` AND as the class of
   things that have some fiber constituent:
   `mat:FiberReinforced ≡ mat:Composite ⊓ ∃mat:hasConstituent.mat:Fiber`
5. Create individuals:
   - `mat:CarbonFiber` of type `mat:Fiber`
   - `mat:CFRP` of type `mat:Composite` with `mat:hasConstituent mat:CarbonFiber`

After reasoning, `mat:CFRP` should be inferred as `mat:FiberReinforced`.

## Namespace

Use `http://example.org/materials#` with prefix `mat:`.
