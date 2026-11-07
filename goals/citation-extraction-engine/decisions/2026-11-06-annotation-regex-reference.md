---
title: "Use upstream Context.Reference for the captured regex operation"
date: 2026-11-06
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert the default context reference and its consumers together while preserving captured operation timing and original source corpora."
---

Effect Context.Reference supplies the extraction default directly; the optional service lookup and custom fallback are removed. The selected schema-owned operation is still captured at installation, leaving returned methods R=never. Six actual Bun/Node wrap and Clock tests pass in 23.16s after this simplification; server lint/types, declarations, blocking laws and scoped Fallow pass with zero introduced findings. Full hosted source replay, custom annotators, final engine/boundary integration and every open law/fidelity/proof obligation remain required. See history/evidence/2026-11-06-annotation-wrap.md.
