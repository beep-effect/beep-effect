---
title: "PERIH-01 sets both legacy admission outputs or removes their consumers in the same PR"
date: 2026-11-09
reversal: "Restore the coverage-rollout probe step and both admission outputs from the reverted check.yml."
---

`check.yml` derives both `legacy_coverage` and `legacy_integration` from the Heavy Admission coverage-rollout probe step. The slice that deletes the probe sets both outputs explicitly or removes their consumers in the same PR, under one rule shared with route-soundness-repair: COVE-08 (route-soundness-repair) owns making the Coverage Regression job name in `.github/workflows/check.yml` a literal. PERIH-01's probe-deletion slice owns the probe step, the `legacy_integration` output, the Test Integration name conditional and the LEGACY_COVERAGE env line and assertion. The `legacy_coverage` output has one consumer on each side, so whichever of the two lands second deletes it in that PR: if the probe deletion lands first it sets `legacy_coverage` to 'false' and COVE-08 then deletes the output together with its last consumer; if COVE-08 lands first, the probe deletion removes the output outright. Whichever lands second merges `main` first. Each updates `packages/tooling/tool/cli/test/ci-runner-security.test.ts` for the lines it changes. Hard-coding the coverage job name alone leaves `legacy_coverage` empty and fails that assertion on every non-docs run. Rejected: deleting the probe and its step output alone (turns Coverage Regression red), and deleting only the coverage half.

Source: exploration `explorations/ten-minute-certainty/MAP.md` (Reviewer constraints, CodeRabbit on #3017, 2026-11-09).
