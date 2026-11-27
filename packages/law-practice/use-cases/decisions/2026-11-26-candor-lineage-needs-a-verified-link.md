---
title: Candor lineage moves only on a verified supersession link, and ambiguity blocks the group
date: 2026-11-26
reversal: Honour every declared supersedes link in supersededEventIds and let evaluateGroup pick a head when the group has several.
governs:
  - src/CandorPolicy/CandorPolicy.service.ts#supersededEventIds
  - src/CandorPolicy/CandorPolicy.service.ts#evaluateGroup
enforcedBy: []
---

A supersession link is honoured only when the named event is in the group, its observation carries the named digest, and both events have equal parsed patent references whose head carries a publication number. Empty references, dangling links and mismatches leave the head where it was.
A group with exactly one head is answered by that head's coverage, and every event in the group shares the answer: superseding an observation never releases the gate, and disposing the newer observation releases the whole group. Zero or several heads is `ambiguous-lineage`, which blocks.
Discovery provenance records how an event entered the system and does not decide whether it gates: an examiner-observed event gates in its own right and clears only by a human disposition bound to the current observation.
Reason: an unverified link or a guessed head would release a disclosure obligation on lineage nobody recorded.
Rejected: trusting any declared supersedes link, choosing the newest of several heads, and gating only applicant-discovered events.
