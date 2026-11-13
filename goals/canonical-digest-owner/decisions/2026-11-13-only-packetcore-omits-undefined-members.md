---
title: "Only PacketCore passes omitUndefinedMembers; the other swaps are strict"
date: 2026-11-13
lane: "refactor/canonical-digest-owner-swaps"
reversal: "Pass JsoncCanonicalizeOptions with omitUndefinedMembers in the encoder that needs it; stored digests are unaffected because no stored preimage carries an undefined member."
---

Slice C call, made per encoder from what the legacy encoder did and what its callers rely on. PacketCore canonicalJsonText passes omitUndefinedMembers: Goals/Completion.ts builds the completion declaration with packetId and proposedCloseout left undefined when absent, and 443 probe calls depended on the member being dropped. The epistemics encoder (behind canonicalDetectionJson and the two domain aliases) and the semantica lab encoder also dropped undefined members, but no caller relies on it: their seal and digest inputs are schema wire forms, no schema in those domains declares a member that encodes as undefined (no S.optional, only exact optional keys), and the probe's one undefined-member call for each came from the slice A table test. The md frontmatter encoder already threw on an undefined member, since its input is S.JsonObject. Strict is preferred wherever nothing relies on the relaxation, so a member left undefined by mistake is a typed refusal rather than a silently different preimage. Rejected: the option everywhere for symmetry, which would hide such mistakes in the seal domains that SPEC.md wants refused.
