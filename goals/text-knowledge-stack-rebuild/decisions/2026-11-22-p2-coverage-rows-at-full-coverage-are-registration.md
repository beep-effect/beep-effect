---
title: "P2: coverage rows written at 100 percent for new files count as registration under S31"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Re-run bun run coverage -- --filter=@beep/text --filter=@beep/rdf --filter=@beep/md --write-baseline from the P2 base rows and drop the added file rows, leaving the hosted ratchet to judge the files as new."
---

Commit 13 re-records the coverage rows of @beep/text, @beep/rdf and @beep/md with the scoped writer (bun run coverage -- --filter=... --write-baseline). The writer drops the row of the deleted rdf/src/Evidence.ts and adds one row per file the old rows did not name: the ten new @beep/text modules, md/src/Md.anchors.ts and eleven rdf files that had no row (NamespacePin.ts, the generated NamespacePins.data.ts, the Dcat, Shacl and Void vocabularies and the generated term modules of Dcat, Oa, Prov, Shacl, Void and Xsd; all but the two Dcat files are new since the P0 base). Every added row records 100 percent on lines, statements, branches and functions with zero uncovered units, so it records no debt: it is the same bar the hosted ratchet applies to a file without a row. Under S31 those rows are registration, as S31a treats a re-stamped cache-baseline review for a new package, and the per-file line count of research/consumer-census.md grows by them (provenance and text 4 to 14, rdf 38 to 47, md 17 to 18). Rows below 100 percent are existing rows that the write raised (rdf/src/Rdf.ts, several md modules); no row was lowered.
