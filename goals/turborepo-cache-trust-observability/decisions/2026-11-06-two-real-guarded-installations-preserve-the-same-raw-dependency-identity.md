---
title: "Two real guarded installations preserve the same raw dependency identity"
date: 2026-11-06
kind: checkpoint
lane: "codex/cache-guarded-evidence-20261106"
reversal: "Remove the checkpoint projection while retaining both immutable successful observations and the earlier failed comparisons."
---

After merged PR #2782, serial runs 42269287143 and 42270163848 both execute only source inspection at df3ccd1b77aba565a72abd63c910ef3edde23929, including the same resolved Heavy source. Their source reports are byte-identical and their raw canonical dependency SHA is 165cc66fc16d1983c5148490b5b7cb9c5227045057d85690d2a19232e37c7499. All 2266 groups and 330 node-gyp files match; no Python bytecode files are present. Both internal two-pass/source/declared-digest checks pass. Diagnostics take 49.343 and 42.107 seconds, each with 3479551 report bytes inside the original four-MiB cap.

Retain source-bound run/job/artifact identities and hashes in research/guarded-dependency-repeatability-2026-11-06.json and its narrative. No digest normalization, exclusions or cleanup occurred. Earlier failed comparisons remain failed, and the historical bytecode-generation mechanism is not proven. This removes the observed source-only repeatability prerequisite at this revision/profile; independent producer approval, protected execution/publication/import and every whole-goal acceptance gate remain required. No signing, credentials, task qualification, production setting or representative window changed. No local quality suites ran.
