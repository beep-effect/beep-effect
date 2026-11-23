---
title: "P1 registry boundary and projection choices survive comment absorption"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p1b-registry"
reversal: "Replace local parity models and curated projection scope only with dependency-safe equivalents and update their tests"
---

Identity keeps its local release-version pattern and S.Literals domains because it cannot depend on schema. Parity tests live in schema, where schema to identity is legal. Reject importing schema into identity because it creates a dependency cycle. External dcat, dcterms, owl, rdf, rdfs, schema, sh and void remain unpinned until the P5 exit test requires every external namespace pin, retaining P1 ruling 3. Reject expanding P1 acquisition scope ahead of that phase. nif, gufo and as remain registry-only until a consumer needs named nodes; reject generating unused RDF modules. ActivityStreams uses the HTTP namespace bound by Web Annotation anno.jsonld even though its AS2 acquisition artifact writes HTTPS; reject changing identity bytes to match that artifact.
