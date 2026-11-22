---
title: "Count a leading JSDoc block above an import as the module header"
date: 2026-11-22
lane: "goals/comment-law-gate"
reversal: "Require @packageDocumentation for jsdoc-module again in comment-grammar.ts."
---

The SPEC counts module headers as public. A file-header block before the first import, re-export or directive is a module header whether or not it carries @packageDocumentation; a leading block directly above a declaration still documents that declaration. Found by spot-checking local-JSDoc findings in the 100-commit replay: every miss was a header above an import.
