---
"@beep/repo-cli": patch
---

Measure workspace dependents in pull-request coverage scope. `CoverageScopeOwner` carries the
workspace-internal dependency edges read from every `package.json` bucket, and
`planCoverageAffectedScope` selects the transitive coverage-bearing dependents of each changed
owner whose non-test files changed (`test/`-only changes stay scoped to their owner; labs,
coverage-less packages, and the repository root are never selected). The selected scope
records `dependentPackageNames`, and selections heavier than the single-invocation budget run
through the weighted shard executor with a prebuild filtered to the selection and no empty
shards. Records ship-velocity B10.
