---
title: "P5: xsd:decimal is declared in the pinned xsd shard so the fold's number mapping names only registry terms"
date: 2026-11-23
lane: "p5"
reversal: "Remove decimal from the xsd pin terms, re-run sync-data-to-ts pinned-vocabularies and identity registry --write, and map non-integer numbers to xsd:double"
---

Decision the-fold-emits-a-dataset-and-checks-its-literals maps a finite non-integer number without an exponent to xsd:decimal, but the xsd shard declared only anyURI, boolean, dateTime, double, integer and string. The fold resolves every datatype through Registry.iri, so decimal is added to the xsd pin's curated terms in PinnedVocabularies.ts; the sync proved it against the pinned RDF 1.1 Concepts section 5.1 bytes (digest unchanged), wrote the shard, and identity registry --write added the term to the snapshot under release 2.1.0. The fold also refuses a non-finite number as invalidLiteral at tuple validation, because the TypedLiteralValue schema keeps S.Finite (the schemaNumber law) and the validation error mapping names the reason.
