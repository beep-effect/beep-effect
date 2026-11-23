---
title: "P5: the fold emits a Dataset as its only RDF arrow, maps authoring literals to the three cases and refuses ill-formed ones; toTurtle, toJsonLd and toContext are deleted"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Restore a fold-owned Turtle writer over the Dataset by a decision file naming the consumer that cannot use the n3 driver"
---

Map questions I5, I14 and S10. The fold gets one RDF arrow, `toDataset(assembled): Rdf.Dataset`, which is pure and ground. Its assembled fact literal is `Rdf.Literal`, so the fold-local `FactLiteral` (`ontology/src/Fold.models.ts:411`) is deleted. The authoring `TypedLiteral` maps once, at assembly:

- a string with no datatype and no language becomes Simple;
- a language with no datatype, or with rdf:langString, becomes LangTagged;
- a finite number with `Number.isInteger(n)` and no exponent in `String(n)` becomes Typed xsd:integer (amended after review: `2**53` prints as `9007199254740992`, a Turtle integer, which the earlier safe-integer rule would have made xsd:decimal);
- any other finite number with no datatype becomes Typed xsd:decimal when `String(n)` has no exponent, and xsd:double otherwise. This is exactly the datatype Turtle gave the bare number `toTurtle` printed (`Fold.projections.ts:470-485`), so no fact changes meaning, and `2**53` is a fold test case;
- a boolean becomes Typed xsd:boolean;
- an explicit datatype applies to the lexical form, and xsd:string yields Simple.

A language on any other datatype, an invalid language tag, and a non-finite number are refused with a new `OntologyAssemblyErrorReason` case, `invalidLiteral`. Today `toTurtle` silently drops the datatype when a tag is present (`:481`), and assembly silently drops an invalid tag (`Fold.assembly.ts:323`).

`toTurtle`, `toJsonLd` and `toContext` are deleted. Their only consumers are the cli research library (`Library.ontology.ts:8,405`) and the package's own tests. The cli writes Turtle from `toDataset(assembled)` through `@beep/n3`'s `N3SerializeTurtleRequest` with the fold's prefix map. That path already exists for the SHACL shapes (`Library.ontology.ts:370-385`). The library test (`research-library-ontology.test.ts:345`) asserts that two serializations are byte-identical and that the reparse is `Equal` to the fold dataset. `research-library.ttl` is untracked and the writer is its only reader. `toMarkdown` stays: it is documentation, not an RDF serialization. The schema-first inventory row for `JsonLdDocument` leaves with `toJsonLd`, and the `TypedLiteral` row keeps its exemption (S31: no growth).
