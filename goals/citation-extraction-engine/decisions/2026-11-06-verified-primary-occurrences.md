---
title: "Verified primary occurrence adaptation"
date: 2026-11-06
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert the occurrence adaptation and converter optimization while retaining the public prerequisite contracts and raw/semantic pipeline."
---

Builtin semantic results now produce primary mentions only against genuine source capabilities for the exact tokenizer text. Existing canonical offset conversion, provenance verification and cm1 production are reused. Shortcut, invalid spans and native/JavaScript point-layout differences retain explicit unverified semantic data. Shared code-point conversion now scans cooperatively without whole-source arrays or prefix joins, with unchanged public contract. Forty prerequisite tests and both-runtime source/mention regression pass. Full-span/component evidence, warning translation, canonical source production for cleaning and the public service/Layer remain open. See history/evidence/2026-11-06-occurrence-projection.md.
