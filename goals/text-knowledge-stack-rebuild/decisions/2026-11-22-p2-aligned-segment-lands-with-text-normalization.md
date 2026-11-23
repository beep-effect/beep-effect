---
title: "P2: AlignedSegment lands in commit 5 with TextNormalization; the rest of LocatorMap stays in commit 6"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Move AlignedSegment into TextNormalization.ts and re-export it from LocatorMap.ts in commit 6, or land all of LocatorMap.ts in commit 5."
---

Section 1.4 types NormalizedText.segments as S.Array(AlignedSegment) and section 1.2 places AlignedSegment in src/LocatorMap.ts, while section 10 lists TextNormalization in commit 5 and LocatorMap in commit 6. Commit 5 therefore adds src/LocatorMap.ts holding only the AlignedSegment schema and type, exported from the barrel, so the module list of section 1.2 holds at every commit and no schema moves file later. Commit 6 adds the LocatorMap class with its check, the identity and compose statics and CaptureMismatch to the same file. Every byte and identifier is the one the design names; only the commit that first carries the schema changes.
