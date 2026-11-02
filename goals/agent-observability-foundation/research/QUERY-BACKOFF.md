# Durable read-back query pacing

Repeated missing Phoenix results previously triggered another query on every
scheduler visit once the initial reconciliation delay elapsed. Synthetic tests
reproduced both Missing and failed-query cases without sending more events.

The scheduler now reserves each query before network I/O. One checksummed row
per enrolled delivery event records the latest transport attempt, a saturating
query ordinal (1 through 31), and reservation time. Reopening the scheduler,
failed requests and interruption preserve the delay. The checksum binds the
policy, host, namespace, target, event and transport attempt. Corrupt rows refuse
work. Wall-clock rollback holds work rather than accelerating requests.

The first reconciliation remains due after `reconcileDelayMillis` from the send
reservation. After a query, the delay is that value multiplied by two for each
prior query, capped at the greater of `maxRetryDelayMillis` and
`reconcileDelayMillis`. The first post-query interval is the base delay. A new
transport attempt restarts the query ordinal. No additional policy field or
configuration digest change is needed. This is an intentional behavioral change
for an existing scheduling profile.

A bounded worker remains fair across events; this change limits requests per
event, not aggregate fleet QPS. Visibility can be recognized up to the capped
interval plus scheduler traversal and backend latency later. Defaults must be
chosen against that visibility objective. A query reservation records attempted
work, not a backend response or delivery state. Missing, Mismatch and query
failure remain distinct, and only a fresh Missing plus target qualification,
send backoff and remaining attempt capacity permits replay.

Storage is bounded by the existing enrolled-event ceiling and physical database
ceiling. Query rows are included in the journal ownership boundary and physical
backup, and logical retirement snapshots preserve them before clearing them
atomically with their event epoch. Logical restore restores those reservations.
No timer, background process or additional producer enrollment is introduced.

Compatibility: existing journals acquire an initially empty auxiliary table;
existing acceptance, send and visibility facts are unchanged. Earlier binaries
reject that new table through their ownership allowlist. Rollback therefore
means stopping the owned new worker and retaining its journal/backup, not opening
it with an older binary or deleting the auxiliary table. The held legacy DuckDB
forwarder uses a separate store and remains masked and inactive.

Verification: red regression run retained at
`/tmp/foundation-review-query-backoff-red.log` (20 pass, two expected failures).
The intermediate corrected scheduler suite passed all 22 cases. The final full package audit and docgen pass, including additional corruption
and byte-preserving retirement/restore coverage. Receipt:
`ops/history/query-backoff-package-verification.json`. The logical recovery fixture
proves exact reservation preservation and release, not execution after restore:
payloads are already disposed before a seal is allowed. No new live
backend or production rollout claim follows from this local delta.


The refreshed installed proof passes at `ops/history/query-backoff-live-verification.json`
with `sourceStableDuringRun: true`: two explicitly synthetic CLI/desktop records
in project `foundation-canary-303222edde9d`, both confirmed locally visible;
owned services and collector removed after proof. Independent health and private
maintenance checks also pass. This establishes installed wiring and normal
visibility, not a deliberate missing-backend or hard-crash query-backoff test.
All 24 retained proof files were copied, hashed and fsynced to the private
same-host archive (ops/history/query-backoff-proof-archive.json). Archived bundles are
not executable recovery candidates: the integrity test deliberately tampers with
the bundle after stopping the worker. No production enrollment is inferred.
