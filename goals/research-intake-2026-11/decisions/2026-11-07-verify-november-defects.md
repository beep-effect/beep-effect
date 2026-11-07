---
title: "verify failures on November data are fixed at their causes, not exempted"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
pullRequest: 2892
reversal: "Revert the Derivation sourceId flexibility, the cited-only census and the rdf-validation patch; re-import nothing, the dispositions and captures stay valid"
---

The first full research library verify after mining failed on November data: 3,339 SHACL violations on hop-1 derivations, 12 on spans, 126 integrity lines and missing=108. Causes and fixes:

- Hop-1 derivations name their hop-0 report as parent, but the shapes typed Derivation.sourceId as a Source. The shape now leaves that class open, as for derivedId, and the projection links whichever record the id names.
- rdf-validation 0.1.1 tests xsd:string with a non-unicode regex, so every astral-plane character (emoji, mathematical letters) failed. A bun patch matches code points and still rejects lone surrogates and U+FFFE/U+FFFF.
- The citation census re-extracted reports against every catalogued identity, including hop-2 identities scanned from capture text after inventory. It now uses cited identities only, which reproduces the inventory census.
- 97 admitted hop-2 sources had failed receipts but no reviewed disposition; each now carries one. Six private repository identities with no citation edge were never acquired, and one paper cited at v2 had only a v3 capture; all seven were acquired.

The rerun conforms (0 SHACL violations) and its 8 integrity lines and 4 missing sources all belong to the 2026-10-06 intakes, which the verify baseline-scope decision reports without repair.
