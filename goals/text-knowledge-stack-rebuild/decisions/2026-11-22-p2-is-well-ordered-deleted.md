---
title: "P2: isWellOrdered is deleted; every L1 range is non-empty"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Restore the static and its export from git."
---

TextAnchor.isWellOrdered and its alias accept start == end, against TextAnchor, Position and every other L1 range, which require start < end. The map found no consumer outside the owner's tests. P2 deletes both with their tests instead of keeping a predicate that disagrees with the schema beside it. isInternallyConsistent, isUtf16Boundary and the rest of the 21 exports keep their names and behaviour.
