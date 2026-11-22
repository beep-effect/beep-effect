---
title: "P1 delivers ContentHash, the versioned domain-tagged minting function with definePreimage and golden vectors in @beep/jsonc, and the ActivityId brand"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Defer the minting function and ActivityId to their first consumers (P2 OccurrenceId, P3 import activity) by a decision file; ContentHash stays in @beep/schema."
---

P1 ruling 9. P1 delivers three L0 objects. (1) ContentHash and DomainTag in @beep/schema/ContentHash, a brand over the existing Sha256PrefixedDigest (Sha256.ts:132), as at L0.digest.ts:49-78, per decision 2026-11-19-p0-l0-homes-iri-in-identity-canonical-json-stays-in-jsonc. (2) The minting function in @beep/jsonc: mintContentHash (Effect.fn, over JsoncFingerprint.hash, needs Digest.Digest) and mintContentHashResult (pure, over hashResult), whose preimage is the RFC 8785 form of [domainTag, ...preimage]; definePreimage declares a versioned domain tag with its preimage fields, and committed golden vectors pin the bytes, so a changed preimage must bump its domain tag in the same PR (SPEC Constraints, PLAN P1 preimage versioning). Duplicate domain tags and a preimage with no golden are refused. (3) The ActivityId brand with its start-time preimage (activity/v1, operation term, agent or engine pin, prompt digest when present, the sorted used ids, start time), per decision 2026-11-19-p0-activity-id-minted-at-start. The L0-2 law test proves that equivalent records hash alike under key order and set order.
