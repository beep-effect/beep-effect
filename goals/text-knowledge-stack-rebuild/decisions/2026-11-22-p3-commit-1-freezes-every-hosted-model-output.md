---
title: "P3: commit 1 freezes one hosted batch per model output of the Extractor test, through file snapshots"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Freeze only the first hosted batch, or move the fixtures to hand-written comparisons, by a decision file before commit 8"
---

Section 10 of `research/2026-11-22-p3-design.md` asks commit 1 for "today's `EvidenceBatch` over the `Extractor.test.ts` model output". That file holds six hosted model outputs that reach a batch: a coreference cluster, synthesized relation endpoints, reused relation endpoints, an unresolved relation, a malformed relation contract and fuzzy relation evidence. All six are frozen, in that order, as `apps/labs/semantica/test/fixtures/hosted-batch-v1.json`, an array of `{ name, batch }`. Commit 8 changes the relation grounding and every degradation path, so freezing only the cluster case would leave the relation lane and the three degradations unproved. The six cases move to module scope in `Extractor.test.ts`, where the behaviour tests and the frozen test share them, so commit 7 and commit 8 rewrite one constructor per case.

The two frozen tests (semantica `C0 hosted extractor frozen batch`, law-practice `IrToLaw keeps the bytes of the frozen v1 law entities for the server fixture`) compare with `toMatchFileSnapshot`, as `ValueSchemaIdentifiers.test.ts` does. A missing file is written only outside CI, so each fixture was written by the code at `525c61bb090` and is compared byte for byte afterwards; a changed byte fails. The law-practice fixture freezes the entities of the primary model output (`match_lesser`), the one the design names; the minimal-fold run gives the same anchor and is already asserted by its own test.

The relation-preview report was produced with `SEMANTICA_OFFLINE=true`, `SEMANTICA_CORPUS_ROOT` set to the W1 PDF root and `SEMANTICA_PROVIDER_CACHE_DIR` set to a directory holding the three committed cache entries (sha256 of the entry files `60f24303…`, `91d2370b…`, `daee2459…` for the cases in fixture order 1, 2 and 3 by key prefix `5737`, `6bbc`, `0ac6`). Two runs gave the same bytes, sha256 `296bcd0d919d49b4ad6b7ef9299b82c763a24fc0489e3245e81ea2691aaa9ae6`, and the counts equal the table in `goals/semantica-canary/history/p2-c0-evidence-quote-reentry.md` (16/0/16, 7/2/5, 9/8/1).
