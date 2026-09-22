# @beep/box-provisioning — P1 source audit digest

Root-reviewed P1 inventory; P2 remains gated.

Reviewed all 8 assigned census files, with 32 human rows: 7 review proposals and 25 coverage rows. Lens counts: resource 8, flake 8, property 8, observability 8. Severity: 25 info, 5 minor, 2 major. 28 mechanical candidates remain open and unchanged.

Top files (four rows each; source-order tie, maximum ten):

- `packages/drivers/box-provisioning/test/BoxProvisioning.test.ts`: four lens rows, 1 review proposals; test, full lines 1–372.
- `packages/drivers/box-provisioning/test/BoxProvisioningApplier.test.ts`: four lens rows, 2 review proposals; test, full lines 1–374.
- `packages/drivers/box-provisioning/test/BoxProvisioningApplyJournal.test.ts`: four lens rows, 0 review proposals; test, full lines 1–167.
- `packages/drivers/box-provisioning/test/BoxProvisioningArtifactPrivacy.test.ts`: four lens rows, 1 review proposals; test, full lines 1–59.
- `packages/drivers/box-provisioning/test/BoxProvisioningIntent.test.ts`: four lens rows, 1 review proposals; test, full lines 1–100.
- `packages/drivers/box-provisioning/test/BoxProvisioningInventory.test.ts`: four lens rows, 0 review proposals; test, full lines 1–230.
- `packages/drivers/box-provisioning/test/BoxProvisioningPlanner.test.ts`: four lens rows, 2 review proposals; test, full lines 1–525.
- `packages/drivers/box-provisioning/test/fixtures.ts`: four lens rows, 0 review proposals; support, full lines 1–154.

Orchestration builds pure injected service doubles with test-local Refs. Inventory and journal clients are factory-local, while applier module counters are shared across four asynchronous cases under concurrent defaults. Box.makeLayerFromClient is Layer.succeed; scoped rebuilding cannot reset its captured object. Keep zero-mutation, failure journal and dry-run semantics. No cloud/provider acquisition or MemoryFS subject exists. Rebuild costs are not measured independently; no speedup is claimed.

Review proposals:

- `L-OBS-01` `BoxProvisioning.test.ts:54`: The generic six-schema helper matches only Passed; a returned-false round-trip loses the falsified input/replay fields. The direct native property runner does not use the adapter normalization and formatCheckFailure boundary. Preserve the complete law, operands and fcRuns(5) while using the pinned property registration to retain counterexample and replay diagnostics. This adds failure-evidence reasoning beyond the EV007 syntax candidate.
- `L-RES-03` `BoxProvisioningApplier.test.ts:16`: mutationCounts and mutationClient are module-owned, and rebuilding ApplierTestLayer does not recreate their counters. Allocate the client and counters per test before providing the applier, retaining all exact zero/one mutation assertions. Box.makeLayerFromClient is Layer.succeed, not external acquisition; a shared suite layer alone does not isolate these closures.
- `L-FLAKE-05` `BoxProvisioningApplier.test.ts:102`: The normal shared configuration enables concurrent cases. Four tests reset the same module counters, then yield through asynchronous SDK doubles before checking totals. Overlapping reset/increment can contaminate the expected zero versus one counts. Prove per-test recorder ownership under overlap; do not add retries or weaken counts. This is the flake view of the same resource defect, not a reproduced failure.
- `L-OBS-01` `BoxProvisioningArtifactPrivacy.test.ts:27`: rejectsEverySentinel collapses all four sensitive forms to one Boolean; the second test also combines three blocker domains. A failure identifies neither carrier nor sentinel category. Use named, synthetic-category cases or an equivalent property diagnostic while preserving every negative predicate. Report category/schema names, not arbitrary sensitive payloads; the fixture strings are synthetic.
- `L-OBS-01` `BoxProvisioningIntent.test.ts:37`: The adoption/entitlement helper reduces returned-false equivalence to a Passed tag match. The direct native property runner does not use the adapter normalization and formatCheckFailure boundary. Preserve the complete law, operands and fcRuns(5) while using the pinned property registration to retain counterexample and replay diagnostics. This adds failure-evidence reasoning beyond the EV007 syntax candidate.
- `L-PROP-04` `BoxProvisioningPlanner.test.ts:473`: The permission-discovery test asserts only Some before conditionally checking action._tag === Blocked. A Some(Create/Noop) metadata action would skip the entitlement assertions and pass this case. Assert the Blocked/BlockedByEntitlement/metadata shape unconditionally before narrowing, retaining Some and all existing payload checks. Production blockedCapabilityAction explicitly selects this entitlement reason for unavailable + permission-blocked discovery. Do not manufacture unrelated Cause or error payloads.
- `L-OBS-01` `BoxProvisioningPlanner.test.ts:45`: The observed-folder callback throws expect before returning true; manual checkEffect then exposes only Passed. The direct native property runner does not use the adapter normalization and formatCheckFailure boundary. Preserve the complete law, operands and fcRuns(10) while using the pinned property registration to retain counterexample and replay diagnostics. This adds failure-evidence reasoning beyond the EV007 syntax candidate.

Completed Root baseline: 53 passed, zero failed in the retained attempt; whole command 4.471336239 seconds, reporter span 4142.100342 ms (different boundaries). All assigned test files are represented; the Box support fixture has no registration. Runtime Node v22.22.3, Bun 1.4.2, Vitest 4.1.11. The inherited normal concurrency is enabled. No command or history collection was rerun. The single passing baseline does not prove coverage, package acceptance, absence of rare races or successful execution of conditional platform branches.

Hosted evidence: 0 mapped production coverage-ratchet observations across 0 jobs. Zero mapped observations does not establish no failures. These are not unique flakes or causal introduced/inherited attribution. Campaign evidence covers 527 failed runs, with 21 unavailable logs and one unresolved cause. Timings are complete: 139 first attempts, 132 full-file-representation baselines, four configured subsets and three failures. Known failed cohorts elsewhere remain failures.

Proposed internal P2 order: scope → assertions → property → flake → observability. First preserve native subjects and test-local state; then retain all matcher operands/polarity, strengthen only the evidenced oracles, validate scheduling risks, and add precise failure context. All existing floors and hostile-input bounds remain. This lane authorizes no P2 work or waiver, and leaves the 90 inherited-main ratchet additions untouched.

Exact Effect/adapter rc113 pin d3b837aee836f35d625d55205f7d6e61305fc198; the adopted graph has 100 entries. Vitest 4.1.11 is the accepted timing runtime, not a claim that it satisfies rc113’s Vitest 5 peer declaration. Read receipts, source excerpts, complete rows, strict decoder results and input/output hashes are retained privately. Root has accepted these package rows.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
