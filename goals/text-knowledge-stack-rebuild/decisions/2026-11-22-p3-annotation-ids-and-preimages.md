---
title: "P3: annotation/v1 and generation/v1 are declared preimages with goldens; one preimage serves every kind through its JSON body"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Declare one preimage per kind by a decision file that bumps annotation/v1"
---

`AnnotationPreimage` is `definePreimage` under `annotation/v1` over `Tuple[CanonicalHashSet(OccurrenceId) (non-empty), TermIri, S.Unknown]`, whose third element is the body encoded by `S.toCodecJson(kind.body)`. One preimage serves every kind, because the kind IRI already separates the body schemas. `GenerationPreimage` is `definePreimage` under `generation/v1` over `Tuple[AnnotationId, ActivityId]`. The design module's hand sort goes: the set codec sorts.

Goldens: `[["sha256:68270708…4a48"], "https://beep-effect.com/ns/annotation/Mention", {"class": "https://beep-effect.com/ns/office-action/distinction"}]` gives `sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9`; `[that id, "sha256:2a2b259a…7388"]` gives `sha256:e1303854ed5d9fddcba55d0d0ae4e4dd5d9ca20c4e4738e0ba643f5696575acd`. Both were checked on this base through `Preimage.verifyGolden` with `Digest.layerWebCrypto` and by an independent SHA-256 over the RFC 8785 JSON, and one `PreimageRegistry` accepted both. `test/Preimages.test.ts` registers them with the two import preimages. An unregistered tag cannot reach the mint, because the document schema's annotation union is closed over the registry; the mint dies on one as a construction defect.
