---
title: "P4: nanopub decode reads only the exact profile encoding"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Relax a rule in a new profile version and keep the old one decodable."
---

Decode accepts the core literal and the publication metadata only when they equal their re-encoded form byte for byte (otherwise invalid-core or invalid-publication-metadata). Publication time is dcterms:created as a UTC xsd:dateTime and the publisher is dcterms:publisher. A profile predicate in the wrong graph is graph-mixing; foreign predicates inside profile graphs and all quads outside them are residual; a blank graph name anywhere is refused. Instance IRIs reuse instanceIri and instanceHash from @beep/annotation/rdf/OaCodec.
