# Independent population reconciliation

The inventory command now accepts a separate observation snapshot:

```text
bun run beep ai-metrics inventory coverage --input <coverage.json> [--json]
```

The input retains the declared host/root/route inventory and its independent known
launch and expected-event populations. It binds observations to the same boundary
evidence and exact half-open event window, rejects undeclared/duplicate routes,
and rejects observations taken before the window closes. Each route has separate
launch, locally accepted-event and backend-visible-event snapshots. Each snapshot
has an evidence reference and explicitly declares whether its query was exhaustive.
All identifiers are hashes. The reader bounds bytes before parsing, rejects excess
fields and masks input-bearing diagnostics. Total observation membership is capped
at 16384 entries, separately from the inventory's own population bound.

A missing route or unknown snapshot is unassessed, not zero. An observed population
with an unknown denominator retains its observed count without a capture percentage.
Enumerated expectations are compared by exact ID: expected, observed, matched,
not-observed and outside-expected counts remain separate. Not-observed means absent
from this snapshot, not lost. Partial queries retain that qualification even when
every expected ID was positively found. A zero expected population with arrivals
reports those arrivals as outside the expected set instead of hiding them. IDs
observed on one route cannot satisfy another route's expectations.

The command does not prove the provenance of a supplied evidence reference or
create a launch denominator from trace arrivals. It does not infer visibility from
local acceptance, require all visible events to survive local retention, infer
task success, or aggregate route overlap into a fleet-wide capture percentage.
Capability and heartbeat remain independent inventory evidence. Historical window
reports are not current-health reports.

## Actual retained-backend evidence

`ops/prepare-native-coverage-proof.py` derives the three expected native event IDs
from the fixed synthetic request identity contract and synthetic salt. It checks
the retained disposable collector/Phoenix receipt and its source fingerprints,
then uses its exact positive read-back results as separate observation evidence.
The expected IDs are not copied from the returned IDs. The actual CLI produced
`ops/native-coverage-report.json`: all three expected events matched both local
acceptance and backend visibility. Launch populations remain unknown; all queries
are marked partial because this adapter checks specific IDs, not an exhaustive
route/window query. No new backend deployment or producer enrollment occurred.

The fixture inventory uses a worker surface and a synthetic claude-code harness
marker; this is not evidence that the Claude Code application launched. Its three
usage-convention scenarios do not qualify three real harnesses. Reconstructed
observations are intentionally outside this proof's declared native-only boundary.
The collector's earlier nine-span result remains unchanged.

## Remaining integration

Managed launch receipts, source-root identity reconciliation, actual route query
adapters, periodic current coverage snapshots and freshness alerts must populate
this contract before enrollment can claim known launches or assessed coverage.
This implementation closes comparison semantics; it does not close the full
inventory/identity acceptance criterion or CLI/desktop live-canary criterion.
The old forwarder remains masked, and historical data remains untouched.

## Refreshed integration source pointers

The live managed driver source is now
`packages/drivers/ai-provider-cli/src/AiProviderCliSession.profile.service.ts`,
not the older audit's `profile.service.ts` path. Its validation permits HOME/PATH
(and CODEX_HOME for Codex), rejecting unknown environment keys before spawn.
Adding ambient OTEL variables is therefore not an enrollment mechanism.
`AiProviderCliSession.models.ts` exposes verified `ManagedSessionIdentity` and
provider-specific terminal evidence, while the Claude adapter verifies the
initialization/session identity before accepting a terminal result. This is an
existing boundary for explicit launch/result receipt integration; it does not
currently provide this inventory's independent denominator or durable launch log.

The existing `hook-pulse.ts` has session-start-owned harness metadata and separately
hashed session references. A hook pulse proves an observed hook, not every launch
or an exhaustive population. Reconcile identity namespaces and exact ownership
before joining these records; do not copy its count into a known-launch denominator.
No private hook ledger, real transcript or runtime credential was read for this
source inspection. The global Codex source still must not inherit the collector's
checkout identity.

## Final verification

Full ai-metrics package verification passed: audit 107.5s, docgen 11.4s,
120.472s service runtime, 5.4 GiB peak and zero additional swap. The preceding
full suite ran 741 tests in 65 files; its export-order-only lint finding was
repaired before the final passing gate. Final lint separately checked 157
files. Final CLI source typecheck and all seven inventory/coverage command
tests passed (15.770s, 6.5 GiB peak, zero additional swap). The initial
comparison type inference and synchronous-test diagnostic findings were
repaired; no failed run is counted as a passing package gate.

The actual human and JSON report commands passed against the independently
prepared native fixture evidence. Final source and report fingerprints are in
ops/coverage-reconciliation-verification.json. No OOM exercise was run.


## Managed-owner progress boundary

The later managed-owner work adds independent launch claims, local Started and
SessionBound observations, collector receipts and explicit non-launch recovery;
see MANAGED-OWNER-ENROLLMENT.md. Those records now exist for enrolled managed
owners, but no current adapter yet publishes their independently scoped population
into this coverage contract. A claim is intention, Started is observed process
launch, and a collector receipt is local acceptance; these remain separate sets.
Do not infer four expected events per claim or treat unsupported desktop harnesses
as having zero activity. This population adapter and actual enrollment ownership
are the next integration boundary before live-canary coverage assertions.


## Independent population adapter qualification

The previous adapter gap is now closed for explicitly enrolled managed-owner
claim-creation cohorts. See CLAIM-POPULATION-PUBLICATION.md: the command retains
intentions, local starts and historical receipts as distinct evidence, preserves
unknown denominators for unresolved starts, and leaves event/backend populations
unknown. It does not establish all-harness coverage. The actual registered command
proof covers both human and JSON output before acknowledgments and after recovery.
Operational independent-store recovery and real enrollment/canaries remain open.
