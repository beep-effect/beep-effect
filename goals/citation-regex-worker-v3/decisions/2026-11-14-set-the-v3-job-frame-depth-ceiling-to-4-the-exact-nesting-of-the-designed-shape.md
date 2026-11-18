---
title: "Set the v3 job frame depth ceiling to 4, the exact nesting of the designed shape"
date: 2026-11-14
lane: "feat/citation-regex-session"
reversal: "Return to depth 3 only together with a flattened descriptor wire codec designed and reviewed first."
---

Owner ruling on the B2 stop. Design section 2.4 embeds `CitationRegexPatternDescriptor` in the job and also says depth 3. Under the shared guard's root-inclusive count (`NativeJson.ts`, where flat v2 messages are depth 1) the designed shape is job 1, descriptor 2, profile 3, names 4. The 3 is a counting slip in the design: its intent, stated in the same paragraph and in review finding 6, is that the ceiling grows by exactly what the per-job descriptor forces and that the exact preflight measures it. The ceiling is therefore 4, the tightest value that admits the designed shape; nothing deeper is admitted. The shared guard's semantics do not change and v2 stays at depth 1. Required with it: a regression that accepts a job with a names object and one that refuses depth 5 before any payload allocation; the finite property ceiling (flat fields plus descriptor fields plus the capture-name bound); the name-length bound at job encoding against `processMessageBytes`; strict schema decoding after the preflight. Rejected: flattening the descriptor on the wire (a second codec for the same value, with its own identity validation, for no added bound) and a v3-only depth convention (two meanings of depth in one guard).
