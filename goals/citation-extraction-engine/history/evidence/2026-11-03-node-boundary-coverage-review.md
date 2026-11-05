# Preserve the Node-only boundary test in hosted coverage planning

On head c08ab4a0d8, Check run 41629595891 job 125896072665 failed when the
Bun coverage invocation included PartyContactSource.boundary.test.ts. Its
TsNativeApi sync transport requires Node stdio handles. The Test Unit aggregate
job 125911229573 reports that shard failure rather than a separate test defect.

The package's ordinary unit command already excludes that file under Bun and
runs it separately under Node. Apply that same test-file exclusion to the Bun
coverage command. The canonical CI planner retains the disjoint Node unit-only
continuation. The boundary suite inspects repository imports/manifests through
the Node compiler API; it does not execute server production modules. All four
boundary tests pass under the unchanged Node command locally.

This changes only test runtime routing. Every production coverage include,
exclusion and floor remains unchanged. No workflow, test assertion, source
coverage scope, mixed-provider policy or acceptance gate is weakened. The Node
continuation still has to pass in hosted CI, and full coverage remains pending.

Review scope for the canonical cache baseline writer is exactly
@beep/law-practice-server. Record its changed coverage-command fingerprint;
preserve all other subjects, reviewed scope, profile, epoch, cache-enable flags
and qualification ledger. This grants no new cache qualification or reuse right.
