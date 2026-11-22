---
title: "Exempt member JSDoc and live-tag blocks; ban local blocks that carry only since or category"
date: 2026-11-22
lane: "goals/comment-law-gate"
reversal: "Classify tag-only local blocks as jsdoc-tagged in comment-grammar.ts."
---

Member JSDoc stays exempt until the exported-JSDoc law is ruled in jsdoc-lead-single-source. A local block carrying @internal, @public, @expected-unused, @ignore or @deprecated, or an import.meta.vitest fence, is a live suppression and exempt. A truly local block carrying only @since or @category feeds no tool once exports resolve through specifiers, so a new one is banned; the strip still never deletes a block carrying any tag tools read.
