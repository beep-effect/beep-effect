---
"@beep/rdf": minor
---

Harden the PROV/RDF boundary against silent semantic loss. Relation wire
inputs now require their `provType` discriminator, while `.make(...)`
constructors continue to supply it. Generic IRI codecs preserve exact RDF IRI
identity, and the PROV codec now rejects malformed or contradictory RDF terms
instead of dropping or normalizing them.
