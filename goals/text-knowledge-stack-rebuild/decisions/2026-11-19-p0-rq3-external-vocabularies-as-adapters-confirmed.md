---
title: "P0 confirms RQ3: external vocabularies enter as registry entries and adapters"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
reversal: "Adopt an external vocabulary as an internal kind by a decision file naming the kind and its consumer; nothing persisted depends on the choice until a kind ships."
---

Confirmed. The census found no nif: or gufo: term anywhere in code and prov:, oa: and xsd: only as hand-written constants outside the CURIE registry, so P1 adds six namespaces to the registry (prov, oa, nif, xsd, gufo and ActivityStreams as:, which the OA profile needs for as:generator), each with source pin, license and digest, adds source pin, license and digest to the existing skos and doco entries, and migrates the constants; nothing internal is renamed to an external vocabulary. The OntoLex lexicog question absorbed from attributed-multi-claim-span, LKIF and ELI are recorded as candidate registry entries with no commitment to adopt them.
