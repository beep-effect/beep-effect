---
title: "P1: S31 counts an inventory row that moves from the rdf column to the identity column with its file as a rename"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Count moved rows as new identity rows by a decision file, and burn them down before the move merges."
---

P1 ruling 12. The S31 no-inventory-growth rule applies to P1 as follows: an exception-inventory, coverage, fallow or catalog row that moves from @beep/rdf to @beep/identity together with the file it names (the RFC 3987 IRI schemas, rdf/src/Iri.ts to identity/src/Iri.ts, and their tests) is a rename, not an addition. The sum of rows over the two packages may not grow, and no row is added for a file that did not move. The same holds for the RetiredIriAuthorities allowlist entry that moves to the generated test-runner projection: its count stays 1.
