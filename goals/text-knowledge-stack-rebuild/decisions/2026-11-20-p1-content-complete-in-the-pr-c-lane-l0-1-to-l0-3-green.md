---
title: "P1 content-complete in the PR C lane; L0-1 to L0-3 green"
date: 2026-11-20
kind: checkpoint
lane: "goals/text-knowledge-stack-rebuild-p1c-bindings"
reversal: "Delete this checkpoint file and rerun goals decisions write; P1 status reads in-progress from the phase table either way"
---

P1 is content-complete in the lane stack and stays `in-progress` until PR C merges. PR A (foundation) is merged as #3429; PR B (registry, codec, pins) is #3439; PR C (bindings, re-publication, the term-stability gate and this doctrine) is #3449, the PR C bindings lane, stacked on B. All three L0 ledger rows are green by id: `L0-1` in `identity/test/Curie.laws.test.ts`, `L0-2` in `jsonc/test/ContentHash.laws.test.ts`, `L0-3` in `identity/test/TermStability.test.ts` and in the cli `lint-identity-registry` end-to-end tests. The module-rename test passes, `bun run beep lint identity-registry` passes against the merge base, and the test-runner IRIs resolve from the registry. One exit-criterion caveat: the composer IRI surface is not deleted in PR C, against the earlier execution note; the `$I` composers keep deriving an IRI and the registry binds published IRIs at build time (decision `2026-11-20-p1-composer-stays-registry-free`), because the CI runner handlers bundle `Id.ts`. Left for a later decision: deleting that surface with one accepted handler redeploy, `binding-dangling`, `term-local-multi-segment`, `registry-since-mismatch` and the `delete-package` guard (decision `2026-11-20-p1-term-stability-gate-live-tree-calls`). P2 opens after PR C merges and the chapter-11 amendment is effective.
