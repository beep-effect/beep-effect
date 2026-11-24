---
title: "P7: the cli knowledge-base Selector keeps its TextQuote case, and its stored v1 and v2 rows read unchanged"
date: 2026-11-24
lane: "p7"
reversal: "Adapt instead: decode the stored TextQuote and MediaFragment cases into the @beep/text Selector at read time, drop the local union, keep the stored bytes and project oa: terms through the WebAnnotation adapter"
---

Chapter 16 section 5 kept the cli knowledge-base `Selector` (`packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts:113-120`) "because it is repo tooling with no consumer in the stack; P7 re-checks it" (`standards/architecture/16-knowledge-stack.md:562-564`, census `research/consumer-census.md:345`). Re-checked at f30c183f20a, the case is kept:

- It has stored rows in two declared formats: the `kb-assertion/v2` `Assertion.selector` (`Kb.schemas.ts:144-163`) and the frozen v1 row `KbAssertionV1Row.selector` (`Kb/internal/KbStore.ts:60-65`), written to `assertions.jsonl` under the caller's `--root`. `@beep/repo-cli` is not a package named in the scoped chapter-11 amendment (`standards/architecture/DECISIONS.md:3211-3219`), so rule 5 and the stored-format law apply unchanged. Deleting the case would make every stored text assertion undecodable.
- It mints no identity. Assertions are keyed by `RegistryId`, and nothing derives an id from the selector, so "`OccurrenceId` is the only text-occurrence identity" (`16-knowledge-stack.md:552-554`) is not contested.
- It already validates through L1: `TextAnchor.isInternallyConsistent` and `isUtf16Boundary` from `@beep/text/TextAnchor` (`Kb.service.ts:9`, `:73-80`), so no second offset semantics exists.
- No stack package imports the module; it imports the stack (`@beep/text`, `@beep/epistemics`, `@beep/rdf`, `@beep/jsonc`; `Kb.schemas.ts:6-11`, `Kb.projection.ts:7-8`). The chapter sentence is restated as "no stack package consumes it".

The projection emits local `urn:beep:kb:` predicates (`Kb.projection.ts:69-83`) instead of `oa:` terms through `rdf/src/Adapters/WebAnnotation.ts`. That is accepted: the kb graph is a local projection with no interchange consumer, and section 1 of the chapter already treats graphs as disposable projections.

The alternative under "best core over compatibility" is the reversal: decode the stored cases into the `@beep/text` `Selector` at read time. It is not taken because it changes only the in-memory shape of a tooling module outside the stack's layers, while the stored bytes, the identity rule and the L1 validation stay exactly as they are now.

A free prose comment at `Kb.projection.ts:33` (also on `origin/main`, from #2724) breaks the comment law. The P7 PR does not otherwise touch that file, so it is removed in a small PR off `origin/main` (P7 design section 13), not in the stack.
