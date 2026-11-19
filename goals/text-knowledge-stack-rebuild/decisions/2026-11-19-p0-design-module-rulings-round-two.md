---
title: "P0 design module rulings, round two: supersession stays in its partition, unknown valid time, structure kinds carry containment levels"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
reversal: "Reverse any one by a decision file before P3 (kinds) or P4 (log checker) opens; the design module is edited in the same change."
---

(1) A record may supersede only a record of its own partition (scope, logicalKey); the log checker reports a cross-partition supersession as a violation, because a superseder that changed the key would end a knowledge interval in a partition it does not belong to. (2) A record whose valid time is Unknown asserts no interval and is left out of the valid-time disjointness clause; it still takes part in supersession. (3) Containment is defined between structure kinds only. The generic structure and segmentation kinds (Section, Paragraph, Title, Figure, Sentence, Word) are declared in the annotation package with a containment level each, and L2-5 is tested over them: strict range inclusion orders two annotations, and on equal spans the lower level contains the higher (a one-sentence paragraph contains its sentence). Extraction kinds (Mention, Chunk, the candidates) declare no level and are never contained or containing.
