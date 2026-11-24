---
title: "The P5 registration commit clears its own lint debt and re-records the inherited cache drift"
date: 2026-11-24
lane: "p5"
reversal: "Revert the row 16 commit; the coverage rows, cache re-record and test rewrites return together, and escapeIri can be restored from 34c34d8bdba."
---

Row 16 found P5-introduced findings the design did not foresee and fixed them in place rather than growing an inventory (S31). Rdf.ts coverage had fallen in row 2 (lines 97.43 to 95, branches 100 to 87.5): Literal.fromParts gains refusal tests and the escapeIri helper is deleted, because RFC 3987 IRIs cannot contain a character it escapes and the encoded-quad order only ever sees encoded valid IRIs or input that fails decoding. Twenty-four effect-vitest findings in P5 tests become @effect/vitest/utils assertions, an Exit in the parity property, an explicit layer timeout and realPath resolution of committed fixtures. Six plain-data S.Class schemas in Canonical.ts and Rdfc10.ts become S.Opaque over annotated structs. MappingSet.profile and DocumentAnnotation (whose property moved to md in row 6) gain schema-derived properties. Three terse-effect advisories in rdf and ontology are rewritten. The cache re-record names all seven drifted subjects because the tool refuses a partial set; root, epistemics and party-server drifted in P4 (2ced3e0a632, 97b2de8a43b) and the review report says so. Full docgen is not run locally: docgen:local demands it because global inputs differ from origin/main on this stale stack base, and every edited package passed its own docgen through package-verify.
