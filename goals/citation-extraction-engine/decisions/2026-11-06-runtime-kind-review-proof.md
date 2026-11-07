---
title: "Prove installer runtime-kind mismatch refusal"
date: 2026-11-06
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert only the new regression test and receipt; keep the production guard and acceptance requirements."
---

Two review threads identified the untested runtime-kind refusal. A focused effect test passes Node build metadata with an actual Bun diff backend and asserts CitationEngineArtifactFailure plus zero native children. Six configuration/artifact tests pass in 9.97s, with package and scoped quality checks. Production behavior is unchanged. See history/evidence/2026-11-06-runtime-kind-review.md.
