---
title: "P5: the three Literal cases are a form union under one termType Literal member; language tags lowercase on decode; dirLangString is refused"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Flatten the cases into the term unions under a new discriminator by a decision file that also rewrites every Term, Subject and ObjectTerm match site"
---

Map questions I6 and I13. `Effect.Schema.toTaggedUnion` walks nested unions and throws on a repeated discriminant (`effect/Schema.ts:6498-6530`). So the three literal cases cannot be three `termType: "Literal"` members of `Term`, `ObjectTerm` or `Subject`. Those unions keep `toTaggedUnion("termType")` and their `.match` sites: ten outside rdf, in `Shacl.validation.ts`, `Oxigraph.sparql.ts`, `N3.service.ts`, `canonicalization.ts` and the ontology slice.

`Literal` stays one term member: `{ termType: "Literal", value, form }`. `form` is a `_tag` union: `Simple {}` (datatype xsd:string), `Typed { datatype }`, whose filter refuses xsd:string and rdf:langString as the L6 sketch does, and `LangTagged { language }` (datatype rdf:langString). Each literal term has exactly one decoded and encoded form. `Literal.datatypeOf` and `Literal.languageOf` derive the RDF/JS accessors for the drivers. `Literal.fromParts({ value, datatype, language })` is the one normalizing constructor for engine output: xsd:string with no tag gives Simple; rdf:langString with a tag gives LangTagged; any other datatype with no tag gives Typed. A tag on another datatype, or rdf:langString with no tag, is a typed `LiteralFormRefused`. The four pass-through decoders (n3, oxigraph, rdf-canonize, shacl) return it as their existing decode failure.

`LanguageTag` lowercases on decode. RDF 1.1 Concepts puts language tags in a lowercase value space, so `"x"@EN` and `"x"@en` become one literal. `serializeTerm` already assumes this (`Rdf.ts:1172`). The RDF 1.2 `rdf:dirLangString` that `n3@2.13.12` produces (`node_modules/n3/src/N3DataFactory.js:147-148`) is refused by the n3 decoder: the SPEC names three cases, and a fourth needs its own decision.
