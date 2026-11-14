---
title: "Keep fixed-pattern authentication at the installed call site, once per engine"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Carry fingerprints on the owned value through a fingerprinted pattern codec and compare them at each stage, if a later design wants it."
---

Owner ruling, round 2: a reshape of design section 2.1's fingerprint rule. Ownership is carried by the type (`CitationOwned`); authentication stays with the stage that knows its expected constant and runs at that installed call site, once per engine. Authenticating a stage's patterns against its own constant is a safety guard, and moving it into the generic boundary or changing the exported configuration schemas' decoded types to carry fingerprints would weaken that for no gain. This covers the fixed-pattern fingerprints (`copyCitationMetadataPatterns`, `prepareCitationPublicationMetadata`), the court-table authentication in CaseMetadata and PostCaseMetadata, and the vocabulary that SemanticProjection rebuilds at install.

Final state for the reference patterns (rounds 2 and 4). The base re-checked the fixed-pattern fingerprints and recomputed the rejection pattern's fingerprint on every request. Now `verifyCitationReferencePatternConfiguration` authenticates the fixed patterns once per installed call site (pincited and markup), as the stage call's verify step. `installCitationReferencePatterns` takes the verified configuration and computes only the rejection fingerprint, once, captured with `Effect.exit`; each request's `make` replays that outcome where the rejection descriptor is built. No authentication runs per request. The builder itself stays per request because it reserves its fixed fragments on the request budget (the A3 decision on generated references). The authentication used an unaccounted pattern input, so `producedTextUtf16` and refusal order are unchanged. Because the fingerprint prepares the pattern under the limits, the builder takes its limits at install; production already passed the installed limits on every request.

Install relies on its input having been verified. That holds for every production caller: both GeneratedReferences call sites go through `ownCitationStageCall`, whose verify step is `verifyCitationReferencePatternConfiguration`. The type does not enforce it; a verified marker would have to travel through the generic stage-call helper, which is more machinery than this guarantee is worth.

The install-time `CitationRegexOperation` and Clock match the request-time ones in the annotate path: reference patterns exist only in the extraction tree, installed under SourceDocument's `"extract"` operation, and the base's per-request check ran with the same install-captured dependency context.
