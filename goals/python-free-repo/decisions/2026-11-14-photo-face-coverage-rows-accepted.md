---
title: "Accept the photo-face new-file coverage rows instead of chasing unreachable units"
date: 2026-11-14
lane: "feat/python-free-photo-face"
pullRequest: 3283
reversal: "Delete the two MatchPerson.inference.ts and MatchPerson.onnx.ts rows from standards/coverage.regression-baseline.jsonc and add tests until the ratchet passes without them"
---

The coverage ratchet flags any uncovered unit in a file with no baseline identity. After the model-free wave-4 tests, the two new files measure on hosted CI (job 132280047144): MatchPerson.onnx.ts 100 / 99.56 / 93.44 / 100 and MatchPerson.inference.ts 97.42 / 97.36 / 98.3 / 91.07 (lines/statements/branches/functions). Both are above the repo-cli tier. The leftover units are fallback thunks and error paths that need native-runtime races; beep-reviewer scored that state 5/5. The ratchet's remediation allows recording reviewer-accepted rows, so the hosted rows are recorded verbatim. Later regressions are still judged against these floors.
