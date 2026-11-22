---
title: "P1: the IRI schemas re-home under @beep/identity and are annotated with its own composer; the first term snapshot is taken after the move (amends design D4)"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Annotate the moved schemas with $RdfId.create(\"iri\") from ./packages.ts by a decision file, re-taking the term snapshot in the same change."
---

P1 ruling 15, amending D4 of the registry-first design (map M option 1). The RFC 3987 schemas IRI, IRIReference, RelativeIRIReference and AbsoluteIRI move by git mv from rdf/src/Iri.ts to identity/src/Iri.ts, with their 34 @beep/utils calls rewritten to effect modules, canonicalizeSchemaOrgIri moved to rdf/src/Vocab/SchemaOrg.ts, the @beep/rdf/Iri subpath removed, and every importer re-pointed in the same commit (no re-export is left). The moved schemas are annotated with the identity package composer ($IdentityId), not the rdf one. The 18 identities that change carry no IRI under the registry-first design, so the move publishes nothing, and the first term snapshot is taken after the move so it never records the rdf form. @beep/documents-domain drops its @beep/rdf dependency. Breaking: @beep/rdf loses the IRI schemas and the branded Curie (Rdf.ts:301); no changeset is written.
