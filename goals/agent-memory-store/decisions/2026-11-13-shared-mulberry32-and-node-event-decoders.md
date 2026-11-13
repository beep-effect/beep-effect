---
title: "One mulberry32 generator and one set of node event decoders"
date: 2026-11-13
lane: "agent-memory-store-p2"
reversal: "Inline the generator back into seededNodeIdMinter and the test seededRandom, delete src/internal/Mulberry32.ts, and redeclare the four node event decoders in AdmissionLog.ts and MarkdownProjection.ts."
---

The fallow audit flagged three introduced clones: the mulberry32 body in seededNodeIdMinter and in two test helpers, and the four node event payload decoders declared in both AdmissionLog and MarkdownProjection. The generator now lives once in src/internal/Mulberry32.ts (seededNodeIdMinter and the test seededRandom both draw from it, so every seeded id and every seeded edit is unchanged), the duplicate test seededRandom in OperationCapture.support.ts is gone, and MarkdownProjection exports nodeEventDecoders, which AdmissionLog reads. The decoders are exported as one object rather than four functions because the Effect diagnostics require a pipeable overload on every exported function.
