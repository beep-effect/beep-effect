---
title: "Swapped synchronous exports throw the owner's typed error; no new error channels"
date: 2026-11-13
lane: "refactor/canonical-digest-owner-swaps"
reversal: "Add JsoncCanonicalizeError to the error channel of a digest helper and call canonicalizeResult there, or add a well-formedness check at the boundary that feeds it; the exports themselves can keep throwing."
---

The four exports stay synchronous and return a string, as SPEC.md requires under Exports stay, so a refusal is thrown: each body is Result.getOrThrowWith over JsoncFingerprint.canonicalizeResult with identity, and the thrown value is the owner's JsoncCanonicalizeError with its code and JSON pointer, never a wrapped or plain Error. The digest helpers built on them (contradiction proposal and candidate digests, detection proposal id, evidence manifestation key, grant-set digest, PacketCore event and plan digests, the lab content ids) keep their Result or Effect signatures and SchemaError channels. The throw escapes Result.map, and inside an Effect generator it becomes a defect. Only the md render entry points turn it into a typed failure, because Md.render already captures adapter throws as RenderError. Rejected for this slice: widening those channels with JsoncCanonicalizeError, which changes every signature from the encoders up to the services, and adding schema checks on free-text fields, which the orchestrator decides after reading the surfacing list in PLAN.md. No stored event, seal or fixture carries a refused value, so nothing that verifies today stops verifying.
