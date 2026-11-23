---
title: "P3: OfficeActionReview.flow.test.ts runs the real langextract service over a stubbed model on its own synthetic fixture"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Build the handoff by hand in the flow test instead of running the service, by a decision file"
---

`packages/law-practice/use-cases/test/OfficeActionReview.flow.test.ts` composes: the file-processing test engine from `@beep/file-processing/test`, returning a new synthetic office-action text kept under the use-cases test fixtures (not a copy of the server-local fixture, which the use-cases tests cannot import); the real LangExtract layer over a stubbed `LanguageModel` wrapped in `Model.make` (`effect/ai/Model`), which supplies the provider and model names of the run's pin; the real `IrToLaw`; `makeClaimGate` over a conforming stub `ShaclValidationService` (the epistemic use-cases test pattern) and `makeClaimTransition`; `Digest.layerWebCrypto`.

It asserts that the handoff passes the checked decode after an encode; that every anchor receipt names the fixture capture; that the distinction anchor re-slices the text; that the candidate indices are lossless; that `IrToLaw` maps the five entities; that the loop ends at `shape_valid`; that a missing label fails typed; and that an unaligned label fails with `required-extraction-unaligned`. It asserts no confidence, so P4 adds `OfficeActionReview.signals.test.ts` without rewriting it.
