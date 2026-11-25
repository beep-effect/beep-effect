---
title: "P4: the pinned-vocabularies Turtle check accepts owl:FunctionalProperty"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Drop the type from the accepted set and curate only np:Nanopublication."
---

nschema.ttl types its three has* properties as owl:FunctionalProperty, which the pinned-vocabularies target did not recognise as a declaration type, so the np pin could not curate them. The target now accepts owl:FunctionalProperty, with a fixture test.
