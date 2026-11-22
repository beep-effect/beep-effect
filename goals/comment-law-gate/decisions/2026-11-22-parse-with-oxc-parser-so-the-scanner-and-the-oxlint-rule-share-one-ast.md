---
title: "Parse with oxc-parser so the scanner and the oxlint rule share one AST"
date: 2026-11-22
lane: "goals/comment-law-gate"
reversal: "Drop oxc-parser from the catalog and rebuild the scanner on ts-morph, keeping the grammar module."
---

oxc-parser 0.148.0 was already in the lockfile through @shadcn/lint; it is now a catalog entry and a @beep/repo-cli dependency. It gives the scanner the same ESTree shape the oxlint plugin sees, so one grammar and one attachment index serve both hosts. Measured on the whole tree: the oxlint rule and the scanner agree on all 57,854 findings in 4,511 files, zero differences. Rejected: ts-morph (2.5 to 3 times the CPU and a second attachment visitor), running oxlint on base blobs (honours disable comments, no AST-checked strip).
