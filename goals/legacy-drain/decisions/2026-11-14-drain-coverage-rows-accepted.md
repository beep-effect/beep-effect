---
title: "Record the drain modules' new-file coverage rows after branch tests"
date: 2026-11-14
lane: "goals/legacy-drain"
pullRequest: 3307
reversal: "Delete the ResidueReapDrain.ts and ResidueReapDrainLive.ts rows from standards/coverage.regression-baseline.jsonc and add tests until the ratchet passes without them"
---

The coverage ratchet flags any uncovered unit in a file with no baseline identity. Hosted job 132317218141 on 3f463c9 measured ResidueReapDrain.ts at 96.35 / 92.99 / 82.02 / 91.83 and ResidueReapDrainLive.ts at 87.32 / 87.01 / 100 / 71.42 (lines / statements / branches / functions). The next push adds tests for every reachable remaining branch: dirty tree, live process cwd, unreadable alternates, unreachable origin, a detached HEAD with an unreadable PR list, a refusal before preservation, a missing registered legacy clone, a missing HOME, and the read-only systemd defaults. Local measurement after them: ResidueReapDrain.ts 97.19 / 94.44 / 88.76 / 92.51, above the repo-cli package tier (92.3 / 92.01 / 86.93 / 90.13) on every metric. ResidueReapDrainLive.ts reaches 92.95 / 92.2 / 100 / 82.85: above the tier on lines, statements and branches, and below it on functions only through the GitHub REST default source (four closures that need the network), the HOME config-error fallback and one session-ledger mapper. What remains uncovered in ResidueReapDrain.ts is git-command failure paths, which no hermetic fixture can provoke.

The ratchet's remediation allows recording reviewer-accepted rows, as #3283 and #3296 did. The rows are the hosted values from job 132317218141. They are floors at or below the new head's measurement, and later regressions are judged against them.
