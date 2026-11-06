---
title: "repo-cli gains workspace dependencies on ontology, semantic-web, shacl, oxigraph and n3"
date: 2026-11-06
lane: "feat/research-library-ontology-core"
reversal: "Drop the five workspace dependencies together with the ontology render, SHACL verify and SPARQL view code"
---

The render, verify and SPARQL views need fold/toTurtle (@beep/ontology), the service contracts (@beep/semantic-web) and the three live drivers. They are workspace dependencies only: there are no new external packages, and the lockfile changes only for workspace links.
