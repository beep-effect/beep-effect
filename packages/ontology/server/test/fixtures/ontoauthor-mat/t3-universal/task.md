# Task T3 — Certified Suppliers (Universal Restriction)

## Domain

You are modelling material suppliers and certification requirements.

## Instructions

Using Ontosphere's MCP tools, create an OWL 2 DL ontology that:

1. Define classes `mat:Supplier`, `mat:Material`, `mat:CertifiedMaterial`.
2. Define `mat:CertifiedMaterial` as a subclass of `mat:Material`.
3. Define an object property `mat:supplies`.
4. Define `mat:CertifiedSupplier` as the class of suppliers that supply
   ONLY certified materials:
   `mat:CertifiedSupplier ≡ mat:Supplier ⊓ ∀mat:supplies.mat:CertifiedMaterial`
5. Create individuals:
   - `mat:ISO9001Steel` of type `mat:CertifiedMaterial`
   - `mat:AcmeMetals` of type `mat:Supplier` with `mat:supplies mat:ISO9001Steel`
   (Note: for the reasoner to infer CertifiedSupplier, the open-world assumption
   requires a closure axiom or explicit ∀-typing on the individual.)

## Namespace

Use `http://example.org/materials#` with prefix `mat:`.
