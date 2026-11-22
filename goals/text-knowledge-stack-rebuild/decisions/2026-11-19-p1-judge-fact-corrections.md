---
title: "P1: the base design facts the judges flagged are corrected before implementation"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Restore a corrected figure by a decision file that cites a new measurement of it."
---

P1 ruling 16. Before implementation the registry-first design carries a Rulings applied section with these corrections, and the implementation follows them. (1) The research-library fold publishes 87 distinct owned property IRIs, not 90: the 90 counted field keys, including the borrowed dcterms:created and dcterms:title (Library.schemas.ts, 7 .key( uses); measured by running assembleLibraryOntology(). (2) Class locals are the ones the live fold prints, Source to Manifest, not LibrarySource as in the section 4.1 shard example. (3) The design-module handoff covers every importer of ./L0.*: L0.digest.ts:28, L1.text.ts:21, L2.annotation.ts:34-35, L3.taxonomy.ts:23-24, L4.claims.ts:40, L5.operations.ts:18-20, L6.interchange.ts:25, generators.ts:53-54 and index.ts:44,46 (grep -rn on ops/design); the base design omitted L1, L4 and L6. (4) The IdentityAuthority importer outside identity is public-site/test/PublicSite.test.ts. (5) The citations of the deleted decision slugs 2026-11-19-p0-design-module-rulings and 2026-11-19-p0-review-round-one-rulings in the three designs and three maps now cite the split files that hold each ruling.
