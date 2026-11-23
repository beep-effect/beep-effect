---
title: "P3: IrToLaw maps a checked handoff, picks each label's Mention by text position and reads the model text from its reading"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Pick by candidate order instead of text position, by a decision file; the reading's candidate index carries the order"
---

`toLaw(handoff: ExtractionHandoff)` returns `Effect<LawEntities, IrToLawExtractionError>`, stays pure and needs no `Digest`: the handoff comes from the service in process, built through the checked constructor, and a handoff from outside the process goes through the checked decode first. For each label, the candidates are the `Mention` annotations whose class is the label's `office-action` term, and the one with the least (start, end, `AnnotationId`) is taken. That is a function of the document alone; today the first in model order is taken, and the fixtures hold one of each. Its text is its first reading's model text, as today, which keeps the lower-case limitation the server test asserts. The distinction anchor is the anchors row's receipt anchor.

When a label has no annotation, a residual candidate with that label gives `required-extraction-unaligned` with its tier as `alignmentStatus`; otherwise the error is `required-extraction-missing`. The error's encoded shape does not change (`SchemaParity.test.ts:148-178`). The stale port comment (`IrToLaw.ports.ts:6-14`) goes.
