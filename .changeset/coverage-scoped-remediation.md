---
"@beep/repo-cli": patch
---

Close the coverage-baseline regeneration treadmill. The ratchet now ends a failure with a
remediation block naming the exact scoped command for the regressed packages
(`bun run coverage -- --filter=<package> … --write-baseline`, via
`coverageScopedBaselineWriteCommand` / `renderCoverageRemediation`), and the baseline header
advertises that form ahead of the whole-document regeneration. The pull-request planner diffs
the baseline against the comparison base (`coverageBaselineRowDelta`,
`coverageBaselineRowDeltaFromBase`, `planCoverageAffectedScopeWithBaseline`): a row-only edit
selects and measures the packages those rows name instead of forcing the full workspace run,
while any change to `epsilon`, `minimum`, `exemptions`, or `follow_ups` keeps the baseline a
global input. `standards/**/*.md` is now coverage-inert like `docs/`. Records ship-velocity B11.
