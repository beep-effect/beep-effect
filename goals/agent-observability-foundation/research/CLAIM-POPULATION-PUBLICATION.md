# Independent managed-launch population publication

## Meaning of this report

The existing `agent-message observation population` command now publishes a
bounded snapshot of an explicitly selected independent claim store. Its unit of
analysis is **claims created in the requested half-open window**, not all activity
on the workstation and not the timestamp of a later lifecycle event.

The report separates launch intentions, observed process starts, unresolved starts
and historical collector acknowledgments. A Prepared claim is only intention.
A missing Started fact keeps the launch denominator unknown, even when some starts
are positively observed. Empty selected cohorts can be enumerated as empty only
within their declared store, routes and window. Unselected routes remain unknown.

The input inventory must declare the same host and identity namespace and explicit
managed-launch routes. Claims in the cohort must match those declared routes,
harnesses, surfaces and root bindings. The request and original inventory remain
in the evidence; their previously supplied population counts are not reused as
independent proof. The report hashes its captured evidence and records the store
fence and capture interval.

## Operator path

Supply the existing private enrollment directory and a private request directory
containing schema-valid `population.json`:

```text
bun run beep agent-message observation population --observation-dir <private-enrollment> --request-dir <private-request>
bun run beep agent-message observation population --observation-dir <private-enrollment> --request-dir <private-request> --json
```

The human display labels intentions, starts, unresolved starts and historical
acknowledgments separately. JSON retains typed evidence for the coverage report.
This operation reads local existing state; it does not start a provider, provision
a replacement store, read a hash salt, contact the collector or change an epoch.
The enrollment adapter checks the entire retained Prepared claim and fence before
reading the population.

## Integrity and bounds

The existing store has at most 256 slots. A new `snapshotOutboxes` operation reads
two complete sequential snapshots and requires agreement within ten seconds.
Reading slots directly avoids locating each launch through a fresh full-store
scan. A descriptor-budget regression checks linear work for 16 occupied slots.
A copied valid claim in a second slot is rejected even though its checksum is valid.
Corrupt records, receipts and inconsistent or concurrently changing snapshots
refuse the report rather than publishing a partial denominator as complete.

This is an interval snapshot, not a cross-process transaction or an administrator
rollback detector. Lifecycle facts can postdate the cohort window. Store backup,
rollback and recovery ownership must still be qualified before live enrollment.

## What stays unknown

- Telemetry event totals are not inferred from lifecycle facts.
- Historical collector receipts do not establish current collector state.
- Phoenix visibility is not established by this local command.
- A Finished fact does not establish current process liveness.
- Missing acknowledgments do not prove loss.
- Unsupported or unenrolled harnesses are not assigned zero activity.

The coverage display uses “snapshot partial” instead of “query partial” because
these records may be retained local acknowledgments rather than query results.

## Verification

Five new library tests cover cohort boundaries and late lifecycle facts, uncertain
starts, empty selected cohorts, mismatched attribution, torn receipts, concurrent
mutation, duplicate claims and a linear descriptor budget. The full AI-metrics
package audit and documentation gate passed. The actual registered command proof
checks one independent start with zero receipts while intake is paused, then one
retained acknowledgment after recovery. Both human and JSON command paths pass.

The human-path proof initially revealed that `Flag.Boolean("json")` required an
explicit false default. JSON-only invocation had not exercised that failure.
The corrected command is verified without `--json` as well as with it. Test-only
error-channel, clock and diagnostic-style findings were repaired; failed runs are
not counted as successful verification. Dedicated source-bound receipts are
`ops/history/claim-population-verification.json` and
`ops/history/claim-population-worker-verification.json`.

## Remaining acceptance

This proves a synthetic enrolled managed-owner cohort only. Operational independent
claim-store recovery, broad CLI qualification, real CLI and desktop canaries,
production deployment, final review and repository delivery remain open. The
historical forwarder recovery hold and historical data are preserved. Full SPEC
acceptance and goal completion are not claimed.
