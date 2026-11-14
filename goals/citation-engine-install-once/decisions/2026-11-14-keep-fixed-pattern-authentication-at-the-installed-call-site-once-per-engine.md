---
title: "Keep fixed-pattern authentication at the installed call site, once per engine"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Carry fingerprints on the owned value through a fingerprinted pattern codec and compare them at each stage, if a later design wants it."
---

Owner ruling, round 2: a reshape of design section 2.1's fingerprint rule. Ownership is carried by the type (`CitationOwned`); authentication stays with the stage that knows its expected constant and runs at that installed call site, once per engine. Authenticating a stage's patterns against its own constant is a safety guard, and moving it into the generic boundary or changing the exported configuration schemas' decoded types to carry fingerprints would weaken that for no gain. This covers the fixed-pattern fingerprints (`copyCitationMetadataPatterns`, `prepareCitationPublicationMetadata`), the court-table authentication in CaseMetadata and PostCaseMetadata, and the vocabulary that SemanticProjection rebuilds at install.

The one per-request repeat is fixed in this slice: the reference-pattern builder re-checked its fixed-pattern fingerprints and recomputed the rejection pattern's fingerprint on every request. `installCitationReferencePatterns` now runs both once per installed call site, captures each outcome with `Effect.exit`, and each request's `make` replays the authentication outcome right after the budget-ceiling check, where the check ran before, and the rejection fingerprint where the rejection descriptor is built. The builder itself stays per request because it reserves its fixed fragments on the request budget (the A3 decision on generated references). The authentication used an unaccounted pattern input, so `producedTextUtf16` and refusal order are unchanged. Because the authentication prepares patterns under the limits, the builder now takes its limits at install; production already passed the installed limits on every request.
