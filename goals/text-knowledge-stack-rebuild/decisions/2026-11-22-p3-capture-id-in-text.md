---
title: "P3: @beep/text gains CaptureId, the capture/v1 hash of the whole SourceTextIdentity, as the id an extraction run used"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Use the capture's textDigest as the used id, accepting a scope-free provenance join, by a decision file before P3 merges"
---

An activity's `used` set holds the ids of what it read. The handoff reads one capture, and a capture has no id. Its `textDigest` is scope-free: two matters holding the same bytes share it, so a `used` set built from it would join activities across a matter wall in a provenance traversal.

`@beep/text/Capture` adds `CaptureId`, the hash of (`capture/v1`, `scopeRef`, `sourceRef`, `locator`, `sourceDigest`, `textDigest`, extractor name, extractor version, `normalizationVersion`), the first eight elements of `occurrence/v1` in the same order, declared through `definePreimage` with a golden. Golden: `["matter:example","source:example","documents/source.txt","sha256:aaaa…(64)","sha256:8de1c1a5…515f","utf8","1","1"]` gives `sha256:c7f8616c75be6548d508e2e6a071d3400673dd915454e7e90d97f26bb967eed6`, checked on this base through `Preimage.verifyGolden` with `Digest.layerWebCrypto` and by an independent SHA-256 over the RFC 8785 JSON. `mintCaptureId` is `Effect.fn("Capture.mint")`. P5's `prov:Entity` projection of `SourceTextIdentity` uses this id or amends this decision.
