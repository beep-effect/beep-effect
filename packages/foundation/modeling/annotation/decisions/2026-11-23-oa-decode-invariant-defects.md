---
title: The OA decoder treats anchor verification, assembly and merge failures as defects
date: 2026-11-23
reversal: Widen `decodeOa`'s error channel with the verification and assembly errors and propagate them instead of `Effect.orDie`.
governs:
  - src/rdf/OaCodec.ts#readProfile
  - src/rdf/OaCodec.ts#decodeOa
enforcedBy: []
---

Three steps of the OA decoder cannot refuse by construction, so their failures die rather than widen the public error channel.
Verifying a read target cannot fail: the adapter's anchor is the slice of the verified text over two well-formed boundaries, so verification against that same text holds.
Assembling one (activity, time) group and merging the groups cannot fail either: every anchor is verified, no OA kind carries body references, and the shared rule already rejected every annotation whose (content, activity) pair the input times twice.
Rejected: a typed error variant for each step, which no input can produce and every caller would have to handle.
