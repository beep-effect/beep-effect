---
title: "Sweep the CI binary closure files in wave 5 behind a map-sources and comment-only proof"
date: 2026-11-23
lane: "goals/jsdoc-lead-single-source-w5"
reversal: "Revert the wave 5 PR; the binary re-records its closure digest back and no Lambda code hash moves"
---

The CI goals driver ruled that the 64 closure files wave 3 reverted ride wave 5 with identity `Term.ts`, at the ordinary gate, under two proofs attached to the PR before it opens:

- **Map-sources exclusion.** Every runner handler entry (the seven alchemy-github-runners Lambdas and the ci-runners reaper; 8 bundles, 11 functions) is built with `HandlerBundles.test.ts`'s Alchemy options at the wave 5 tree, and each map's `sources` is resolved to repo paths. A wave 5 file found there would leave for a deploy-worded wave. The intersection is empty; the handler graphs load five identity sources (the five `HandlerBundles.test.ts` pins), four `@beep/schema` modules, and the runner packages, and no `@beep/utils` or `@beep/data` module.
- **Comment-only proof.** Each of the 65 changed files is transpiled before and after with `bun build --no-bundle --minify`; all 65 outputs are byte-identical. A file that differed would leave as a code change.

All 65 files are listed in the latest release's `beep-linux-x64.closure.json` (`beep-ci-0b8fef917164`) and in the current `beep ci binary-closure --list`. After the merge the driver reads the Beep CI Binary run (expected: closure changed, binary identical, re-record, no release) and a plan_only on the merge head (expected: 0 code rows). Wave 5 merges only after the pin PR #3500 and never while another binary cycle is open.
