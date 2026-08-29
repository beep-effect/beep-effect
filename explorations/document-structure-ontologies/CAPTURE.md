# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-11

Found links to two SPAR ontologies in the machine-local ontology downloads:

- DOCO (Document Components Ontology): https://sparontologies.github.io/doco/current/doco.html
- PO (Pattern Ontology): https://sparontologies.github.io/po/current/po.html

"Is it just me or does this seem highly relevant to @beep/md, @beep/pandoc,
@beep/lexical? I'm not sure in what way such a thing is useful but the
taxonomy is so similar I'm curious what your take is."

Cloned the DOCO repo locally into the machine-local ontology downloads (`ontologies/doco`)
(https://github.com/SPAROntologies/doco) — has doco.ttl / doco.jsonld /
doco.nt / doco.owl / doco.graphml under "docs/current/". PO and DEO are NOT
vendored (owl:imports of purl.org IRIs only).

Also worth looking at: metadata ontologies, and potentially better ontologies
for our use case generally. Wants a Grok 4.5 (high effort) research sweep
across x.com, github, blog posts, articles, specification websites & the
broader internet for relevant ontologies.

Use case that motivated this: let agents generating responses / future patent
applications in @beep/professional-desktop (apps/professional-desktop) have
access to this — useful for retrieval, and for "providing information relevant
to the AST itself and what the idioms / rules are (don't really know what I'm
talking about)". FOLIO seems to do this in a way:

- https://folio.openlegalstandard.org/explore
- https://openlegalstandard.org/resources/folio-mcp/
- https://openlegalstandard.org/resources/folio-mcp-tools/
