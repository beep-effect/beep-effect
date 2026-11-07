---
title: "Preserve original annotation style-span expansion"
date: 2026-11-06
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert the style helper and shared native search/slice migration together; restore the prior assembly normalizer and retain all open annotation obligations."
---

The original i/em/b proximity helper now preserves initial-span membership, first/last literal searches, raw signed arithmetic and Python slice bounds on native text. Shared Unicode range/search primitives avoid whole candidate copies and arrays; exact final slice allocation uses the captured parent budget. All 685 original source observations compare, and sixteen tests across style, annotation, native Unicode and literal composition pass. XML balance checking, wrap substitution, full skip/wrap dispatch and general host/numeric behavior remain open. See history/evidence/2026-11-06-annotation-style.md.
