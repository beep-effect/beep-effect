---
title: "P3: the OA codec is @beep/annotation/rdf/OaCodec, held rdf-free at the base by an import-boundary test, with registry vocabulary"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Move the adapter to its own package depending on @beep/annotation and @beep/rdf, by a decision file"
---

The codec lives in `packages/foundation/modeling/annotation/src/rdf/OaCodec.ts`, served as `@beep/annotation/rdf/OaCodec` by the `./*` export; `src/index.ts` does not re-export it. `test/Annotation.import-boundary.test.ts`, following `@beep/md`'s `Md.import-boundary.test.ts`, asserts that no module outside `src/rdf` reaches `@beep/rdf` in its import closure. The adapter's transitive `@beep/md` edge through `@beep/rdf` is accepted until P5 removes `rdf -> md`.

OA, PROV, dcterms, AS, NIF and rdf terms are read through `@beep/identity/Registry`; every profile term and `nif:Context` is declared, so no `Vocab/Nif.ts` or `Vocab/As.ts` is added to `@beep/rdf`. Each target's selectors go through P2's `textAnchorToWebAnnotationTarget` and `webAnnotationTargetToTextAnchor`. Chapter 16's "bound to DoCO terms" for the structure kinds becomes an SSSOM mapping in P5 (L3 `MappingSet`); P3 writes no DoCO triple and binds no DoCO term.
