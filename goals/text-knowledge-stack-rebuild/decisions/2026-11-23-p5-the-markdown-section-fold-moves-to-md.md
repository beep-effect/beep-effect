---
title: "P5: the Markdown section fold and MdNodeId move to @beep/md; DocumentAnnotation's node selector carries the plain fragment string"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p5-taxonomy"
reversal: "Keep a copy of the md-v1 path grammar in rdf by a decision file that names its single owner"
---

Map question S11 and the exit grep. `rdf/src/Adapters/MdSections.ts` (280 lines), `MdNodeId` and `mdNodeId` included, moves to `@beep/md` as a new leaf with its tests. It reads the DoCO namespace through `@beep/identity/Registry` `namespace("doco").iri` (`identity/src/Registry.ts:526`). `@beep/md` already depends on `@beep/identity` (`md/package.json`), so no `md -> rdf` edge appears. `rdf/src/Adapters/DocumentAnnotation.ts` uses `MdNodeId` only as the value schema of its fragment selector (`:21`, `:140`). That value becomes the OA fragment string the selector already carries. The md-v1 block-path grammar is owned by `@beep/md` and checked where a selector is resolved to an Md node. Keeping a copy of the grammar in rdf would give one wire grammar two owners. `DocumentAnnotation` has no consumer outside rdf. Its test splits: fold cases move to `md/test`, and annotation cases stay in `rdf/test`, built from a literal path string. rdf drops the `@beep/md` dependency (`rdf/package.json:73`), the barrel export (`src/index.ts:19`) and the three tsconfig references. The coverage baseline row for `MdSections.ts` moves with the file (decision `2026-11-19-p1-s31-rows-move-with-the-file`). The transitive `@beep/md` edge that annotation reached through rdf disappears.
