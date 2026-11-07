---
title: "Compare public court and reporter identities with sealed evidence"
date: 2026-11-07
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Remove the additional identity assertions while retaining original source/mapping artifacts and unfinished vocabulary obligations."
---

The public extraction corpus and private semantic replay independently compare case reporter ids, publication/court artifact versions and known/unmapped court objects against the sealed vocabulary mapping. All eighty original projection models and explicit unknown/empty/null controls are covered. Seven public/projection tests pass; the factored projection replay passes five tests. Prior head 50a493cef5 now passes hosted Labs and Fallow envelopes. See history/evidence/2026-11-07-public-vocabulary-identities.md. All full-goal proof rows remain open.
