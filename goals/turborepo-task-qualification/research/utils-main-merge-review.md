# Preserve dependency exclusions across the utils runner merge

Main adds the reviewed @beep/test-runner dependency to @beep/utils.
Preserve the upstream dependency edges and the branch exclusions for
@beep/fc-runs#lint and @beep/test-runner#lint. The three-way baseline
comparison found two branch node changes and nine upstream utils node
changes, with no overlap and no global configuration change.

Regenerate the merged projection through cache baseline. Keep the four-task
pilot scope, local-linux-x64-bun1.4.2 profile and qualification-v2 epoch.
No tuple is promoted, no cache flag is enabled, and no ledger entry changes.
The upstream basis is goals/effect-vitest-canon/research/wave-b-cache-review.md;
the branch basis remains dependency-lint-exclusion-review.md.
