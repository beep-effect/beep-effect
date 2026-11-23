---
title: "P3: the request names its capture, the service verifies the text against it, and every target is a receipt of the aligner's own anchor"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Take a caller-held VerifiedSourceText in the request instead of verifying inside the service, by a decision file"
---

`LangExtractRequest` drops `documentId` (the `@beep/nlp/Core` `DocumentId`) and gains `source: SourceTextIdentity`; with the Handoff subpath gone and `UnitInterval` read from `@beep/schema`, langextract has no `@beep/nlp` import. Before any model call, the service calls `verifySourceTextIdentity` with the request's identity as both the expected and the supplied identity, so a text whose digest is not the capture's fails the run with a new `LangExtractError` reason `source-text-mismatch`: an input error, not a value.

Each aligned candidate's `TextAnchor` is verified against that `VerifiedSourceText` with `verifyTextAnchorAgainstVerifiedSource`, projected to its receipt and stored as `Anchored`. The anchor is the aligner's own range. It is not re-located through `VerifiedSpan.locateGroundedExtractions`, which ignores the span, searches for the model text and can pick another range for the lesser, minimal-fold and fuzzy tiers. A refused verification is a residual candidate with reason `verification-refused`, a value as the SPEC error boundaries require.

Scope: the capture's `scopeRef` is the scope; a cross-scope refusal belongs to a caller that compares an expected identity, as `OfficeActionStructure` does. `LangExtractService.layer` gains `Digest.Digest` in its requirement beside Effect's two model names (decision `p3-handoff-activity`); the composition sites are listed in section 2 of `research/2026-11-22-p3-design.md`. A `PreimageMintError` while minting over verified text cannot happen (every quote is a slice of well-formed text) and dies in the service as an internal error.
