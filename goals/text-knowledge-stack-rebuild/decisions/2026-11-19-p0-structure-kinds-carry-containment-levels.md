---
title: "P0: containment is defined between structure kinds only, each with a declared containment level"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
pullRequest: 3420
reversal: "Define containment over every kind, or drop the levels for a kind order, by a decision file before P3 opens; the L2 design file and ledger row L2-5 are edited in the same change."
---

Containment is defined between structure kinds only. The generic structure and segmentation kinds (Section, Paragraph, Title, Figure, Sentence, Word) are declared in the annotation package with a containment level each, and L2-5 is tested over them: strict range inclusion orders two annotations, and on equal spans the lower level contains the higher (a one-sentence paragraph contains its sentence). Extraction kinds (Mention, Chunk, the candidates) declare no level and are never contained or containing.
