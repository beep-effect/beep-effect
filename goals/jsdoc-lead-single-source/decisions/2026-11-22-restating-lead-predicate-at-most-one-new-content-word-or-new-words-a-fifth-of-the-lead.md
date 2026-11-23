---
title: "Restating-lead predicate: at most one new content word, or new words a fifth of the lead"
date: 2026-11-22
lane: "goals/jsdoc-lead-single-source-p0"
reversal: "Change leadRestates in packages/tooling/library/repo-utils/src/JSDoc/LeadSource.ts and re-measure the restating-lead baseline."
---

A written lead on an annotated schema, its same-name type companion or a barrel restates when, after stop words and documentation boilerplate (schema, type, decoded, runtime, exports, ...) are dropped and plural or past-tense endings folded, at most one of its content words is absent from the annotation description and the export's names, or absent words are at most a fifth of its content words. Calibrated on a scratch census of 13,800 in-scope leads: the strict verbatim-only rule (4,600) left obvious boilerplate such as 'Runtime type for {@link X}.' unflagged, a one-third rule deleted real qualifiers such as 'never interleaved'. Implemented once in @beep/repo-utils/JSDoc/LeadSource and shared by docgen, the inventory and the sweep codemod.
