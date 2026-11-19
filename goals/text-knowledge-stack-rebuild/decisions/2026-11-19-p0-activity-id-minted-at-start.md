---
title: "P0: ActivityId is minted from what is known when a run starts, and withActivity takes the used ids before the run"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
pullRequest: 3420
reversal: "Mint ActivityId from the finished run instead, by a decision file before P1 opens (or before P6 for the withActivity order), with output ids kept free of the activity id; the L0 and L5 design files are edited in the same change."
---

ActivityId is the hash of what is known when a run starts: (activity/v1, operation term, agent or engine pin, prompt digest when there is one, the sorted ids it used, start time). What it generated and when it ended are fields of the activity record, outside the id, because an output id that contained the activity id could not also be inside it. withActivity in @beep/nlp-processing computes the used ids before the operation runs, so the id can be minted at start; L5-3 then checks that generated is never earlier than used and that every output is attributed.
