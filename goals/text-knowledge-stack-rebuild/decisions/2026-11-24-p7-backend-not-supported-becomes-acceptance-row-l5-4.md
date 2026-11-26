---
title: "P7: the typed BackendNotSupported failure becomes acceptance row L5-4, falsified by the wink backend test; only the functor framing of THEORY section 7 is withdrawn"
date: 2026-11-24
lane: "p7"
reversal: "Delete the L5-4 row and its title prefix, drop the README sentence and list the backend claim among the withdrawn ones"
---

the retired `@beep/nlp` package's `THEORY.md` §7 calls backends a category of functors. The framing predicts no law and is withdrawn. Its still-true structural claim, that an operation a backend does not support fails with the typed `BackendNotSupported` and never throws, is kept. The first draft moved it to the nlp-processing README with no ledger id, arguing that no bug could be named. That was wrong on both counts. Chapter 16 section 13 requires a README or chapter stating a structural property to cite the ledger id (`standards/architecture/16-knowledge-stack.md:756-758`), and the vision ruling keeps each still-true claim tied to one (`standards/architecture/DECISIONS.md:3171-3174`). The bug is nameable: a backend that throws a defect, or returns an empty or partial result, for an operation it does not support.

Row 2 adds `L5-4` to `research/law-test-plan.md`: layer L5, kind acceptance, statement "an unsupported backend operation fails with `BackendNotSupported`, never a defect or a partial result", package `@beep/nlp-processing` (the contract, `packages/foundation/capability/nlp-processing/src/Backend/NLPBackend.ts:300-310`), status green. The test is the production one, `packages/drivers/wink/test/Backend/WinkBackend.test.ts:102-120`: it runs `Effect.flip` over `parseDependencies` and `extractRelations` on the real wink layer, so a success or a defect fails it. The constructor test at `nlp-processing/test/Backend/NLPBackend.test.ts:71-77` only checks a value built by `notSupported` and is not the falsifier. The wink titles gain the `L5-4 ` prefix. The chapter's L5 **Laws** paragraph and the section 14 kept table list `L5-4`, and the nlp-processing README sentence cites it.

This amends the "no new ledger row" clause of decision `theory-claims-the-chapter-did-not-name-are-withdrawn`.
