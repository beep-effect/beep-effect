---
title: "Claim-event union cases are private annotated structs"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Export each case as a branded Opaque class and widen the ClaimHistory SideRecord constraints to match."
---

The non-core cases of the v2 Holds and Kb claim-event unions (Evidence, Review, Signals, Succession) are private annotated S.Struct schemas rather than exported Opaque classes. The public surface stays the union plus its .cases accessor, and the decoded case types stay structural, which the ClaimHistory generic constraints (Native extends NativeFacts, CoreEventFacts) rely on. The v1 row codecs HoldProbeRunV1Row and KbAssertionV1Row became branded S.Opaque classes over unchanged structs, so the frozen v1 fixtures and their digests are untouched.
