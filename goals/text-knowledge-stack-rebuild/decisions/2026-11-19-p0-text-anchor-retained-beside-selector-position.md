---
title: "P0: TextAnchor is retained with its stored shape; Selector.Position is added beside it, not a rename"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
pullRequest: 3420
reversal: "Make TextAnchor the Position case of Selector by a decision file before P2 opens, with its stored columns read through a declared read-time transform; the census TextAnchor row is edited in the same change."
---

TextAnchor is retained in @beep/text with its stored shape, and the four persisted anchor columns keep their bytes. Selector.Position is added beside it as the position case of the one selector union and is not a rename of TextAnchor; the census TextAnchor row records the move to @beep/text with the shape kept.
