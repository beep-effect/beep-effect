---
title: "P4: annotated core ingredients and stateless claim arrows"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Restore a service only when a stateful owner or second implementation needs it; retain encoded preimages."
---

L4 stays in @beep/epistemics with ClaimCore.schema.ts, ClaimCore.ts, ClaimLog.schema.ts, ClaimLog.ts, Assessments.ts, Admission.ts, Confidence.ts and rdf/NanopubCodec.ts. makeClaimCore takes one options object with caller identity composer, proposition and id codecs, including logicalKey. It returns annotated schema ingredients; callers wrap product records in branded S.Opaque classes. Tagged unions remain annotated schema unions; never extend Opaque over a whole union, which tsrs rejects. makeSignal, AbsenceReason and Measurement move to @beep/schema/Signal with no old aliases; Confidence moves to @beep/epistemics/Confidence. Foundation defines no Context.Service: pure functions and Digest effects use explicit resolver and token-verifier ports. The owning use-case service supplies authority and current-source access. Stance is a view over core and separate records; admitted is never a writable model flag.
