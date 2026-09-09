# scheduler-admission-attempt-origin

Pre-R30 native P2 source/design refresh for scheduler staging ownership,
interruption cleanup and orphan collection. Both existing 4/3 domains, complete
payloads and the ordered Tier 1E shared-outcome batch remain intact. Product
citations bind immutable main `3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee` and
merged HEAD `1c07c15495aaa42f521b887b01e943e68804606c`; their reviewed source/test
bytes equal the working files. The exact pre-edit designs and rows are retained in the R29 integration
archive. This native P2 refresh supplies no independent P3 approval or
implementation credit.

# Instance

- id: `scheduler-admission-attempt-origin`
- exact incoming source SHA: `3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`
- previous incoming main SHA: `5fc065daff16300b8435eca3f32d55564664f57c`
- file:line: `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:1735`
- symbol: `AdmissionAttempt`
- members: `originBusy`, `admitted`
- evidence: E1 at `QualityScheduler.ts:1751-1773` — failure to acquire the
  origin gate is busy/None, an overshoot rollback is not-busy/None, and a
  staged lease is not-busy/Some; busy/Some is unreachable.

R28 native P2 refresh compared the owner, producer and reader with
`8f266b878445ca8a7f751f9248da428a4dde39a1`. Their outcome behavior is unchanged;
the new journal lifecycle below is the preservation baseline. This is not
independent P3 approval. Prior exact design bytes remain under
`history/designs/2026-09-09-pre-main-d1b4d7/`.

# Current shape

`tryAdmitSelf` returns an internal generic interface containing an origin-busy
bit and an optional admitted-state payload. It uses the pair for three distinct
control outcomes while ownership of the opaque caller-supplied origin lease is
transferred only by the admitted case.

# Cardinality gap

Four boolean/presence combinations are representable and three admission
outcomes are legal: `origin-busy`, `rejected`, and
`admitted({ admittedState })`.

The complete pair is `(originBusy, admitted presence)`: `(true, None)` is
origin-busy, `(false, None)` is rejected, and `(false, Some(payload))` is
admitted. `(true, Some(payload))` has no producer. `Some` preserves every
`AdmittedState` value and opaque origin capability; it is a presence projection
for cardinality, not a narrowing of that payload to a singleton. Errors and
interruption stay in their existing Effect channels, not a fourth data case.

# Target schema

Create one private canonical generic `AdmissionOriginOutcome<OriginLease>`
tagged union beside `AdmittedState`. Own its three tags with an
`AdmissionOriginDisposition` LiteralKit (`origin-busy`, `rejected`,
`admitted`); only the admitted member carries
`AdmittedState<OriginLease>`. Because the gate lease is an opaque in-process
capability with no codec, retain a private declared capability boundary for
that generic payload and never decode or encode the union. Reuse this exact owner for
`PromotionTick`; do not introduce a second three-way scheduler type or require
`AdmissionOriginGate` callers to supply a runtime lease codec.

The exact local Effect v4 reference distinguishes a non-parametric guarded
`S.declare` (`.repos/effect/packages/effect/src/Schema.ts:523-562`) from a
schema-parameterized `S.declareConstructor` (`:435-509`), as documented in
`.repos/effect/packages/effect/SCHEMA.md:2190-2394`. Neither automatically
validates an arbitrary `OriginLease`. The implementation must retain the typed
capability supplied by the gate without introducing an always-true unknown
validator, serializing it, or requiring a new caller codec. The union models
control flow; it must not advertise unknown-input validation of the capability.
Use the existing LiteralKit member construction and schema-derived match
helpers (`Schema.ts:6066-6150`) for the finite control cases. P3 must check the
concrete generic schema construction against this limitation.

# Migration inventory

- `QualityScheduler.ts:1598-1603` — retain the generic admitted payload and
  place the private opaque-payload declaration and shared outcome owner beside
  it. Add only the existing package's `LiteralKit`/tuple helper imports needed
  by the schema-first construction; no barrel export is required.
- `QualityScheduler.ts:1735-1774` — delete `AdmissionAttempt`; return
  `origin-busy` when `gate.tryAcquire` is None, `rejected` after an overshoot,
  and `admitted` with the exact four-field `AdmittedState` on success.
- `QualityScheduler.ts:1757-1763` — preserve both ownership guards: an error
  during staging releases the acquired origin lease via `Effect.onError`, and
  an overshoot success path releases it explicitly before returning rejected.
- `QualityScheduler.ts:1915-1923` — consume the shared outcome exhaustively in
  promotion; retain promotion-transition processing and its error-path release
  only for admitted.
- `QualityScheduler.ts:1993-2030,2053-2098,2248-2259` — the downstream wait,
  admitted-use and ticket-finalizer chain receives the same four-field payload.
  Preserve `lease`, `leasePath`, `originLease` and `promotionPath` exactly.
- `QualityScheduler.ts:2078-2095,2100-2127,2237-2245` — preserve the new v3
  released/enqueued/withdrawn writers. Withdrawal is emitted only when the
  finalizer removes a still-queued ticket and no durable lease exists; a lease
  existence-read failure conservatively suppresses withdrawal.
- `AdmissionJournal.ts:395-613,1551-1629,1665-1754` — migration dependencies,
  not target schemas: retain all v1/v2/v3 event variants, full identity and
  timestamp payloads, schema-derived multi-version guards, opaque-byte
  retention, the 200-admission ring and 2,400-known-row cap.
- `src/internal/repo-run/index.ts` and `src/test/RepoRun.test-kit.ts:8` expose
  the scheduler/journal public APIs. Neither exports the private interface;
  the generic gate and `withQualityAdmission` signatures remain unchanged.
  Graft's exhaustive source search found only `tryPromoteTicket` directly
  consuming the attempt; missing Effect.fn graph edges were not treated as
  proof of no consumers.
- `test/quality-scheduler.test.ts:3294-3341,5052-5123` — retain busy
  waiting and every release-on-success/failure assertion; add focused outcome
  assertions through observable scheduler behavior for the overshoot-rejected
  and admitted paths.

Preserve `QualityScheduler.ts:224-225,980-989`: recovery settlement now
polls `fs.exists` until false at 25 ms intervals with a five-second timeout.
Read failures conservatively produce true and continue polling; timeout also
produces true. False means the durable record disappeared. Both existing lock-
contention readers remain: `processReapClaim` at `:1032-1039` and
`processPromotionTransition` at `:1310-1317` keep their distinct typed pending
errors when the result is true. Do not restore the single 25 ms sleep, take over
a live owner's sinks, release its lock, or erase the pending record from the
observer path. Recovery still precedes selection through `scanAdmissionState`;
the pre-scan clock and existing ownership/error-finalizer order remain intact.

The main-3657 preservation baseline also includes the complete staging lifecycle:

- `QualityScheduler.ts:528-565` — retain `<target>.tmp-<pid>[-<hex-start>]-<uuid>`,
  the exact anchored filename grammar, optional non-empty identity encoding,
  and legacy no-identity fallback. A missing or undecodable identity segment
  uses the empty identity and conservative PID-only classification; an
  unmatched filename is not selected. `StagingFileOwner` at `:541-544` carries
  only `pid: number` and `procStart: string`; it is not another Boolean owner.
- `QualityScheduler.ts:569-644` — retain open/write-all/sync in its scoped file
  lifetime, atomic rename for replacement, exclusive hard-link publication,
  and the typed AlreadyExists-false versus other-error split. The temporary
  path is allocated before staging, and `Effect.ensuring(removeStagingFile)`
  encloses both staging and publication. Its finalizer attempts forced cleanup
  after success, failure, or interruption, including interruption inside a
  write, rename, or link. Do not move it to a success-only continuation.
  A consumed rename target makes the forced removal a no-op. A genuine remove
  refusal logs the exact diagnostic at `:575` and is then ignored; this is a
  cleanup attempt guarantee, not a guarantee that the filesystem obeys it.
- `QualityScheduler.ts:693-717` — orphan collection inspects precisely claims,
  leases, promotions, and queue, in that order, through the existing filesystem
  and path services. Preserve directory-list typed errors and full paths.
  `ProcessIdentity.ts:299-322,347-377` proves only a dead PID or a same-source
  start mismatch dead. A live legacy PID, matching start, unavailable probe,
  or cross-source identity remains alive/unknown and is neither listed nor
  removed. Retain source-specific proc/ps/win probing and normalization;
  do not replace this with PID-only or filename-age heuristics.
- `QualityScheduler.ts:1387-1430` — repair recovers promotion transitions
  first, collects staging orphans, attempts staging removals, then collects
  leases/tickets and repairs dead admission state. Preview collects the same
  candidate class without removal or promotion recovery. The dead-path array
  appends staging paths after dead lease and ticket paths; it is an observation
  and must still contain a candidate whose removal was refused. Staging paths
  do not become dead-lease/dead-ticket records or generate eviction events.
- `QualityScheduler.ts:924-932,1104-1111,1216-1224,1662-1667,1825-1860,1873,2028,2231`
  — retain all existing atomic/exclusive users: reap-claim persistence and
  creation, promotion transitions, lease publication and heartbeat, queued
  ticket publication and heartbeat. `runAdmitted` interrupts the heartbeat
  at `:2071` before journal/release finalization; this must continue to trigger
  temporary-file cleanup without moving the origin-lease ownership boundary.
- `QualityScheduler.ts:2356-2375,2476-2488` — retain the snapshot's `dead`
  payload and reap's preview/repair split, including the preliminary read-only
  scan and run-scope stop plan in apply mode. Do not reinterpret these paths
  as a new admission outcome, new permission to stop a live scope, or a
  successful-removal count.
- `QualityScheduler.ts:665,686`, `src/internal/repo-run/index.ts:16`, and
  `src/test/RepoRun.test-kit.ts:8` — retain the new
  `writeFileAtomicForTesting` alias and existing `tryCreateExclusiveForTesting`
  alias, their exact parameters/results and existing wildcard export route.
  The outcome owners themselves stay private.

# Guard-deletion accounting

Delete `AdmissionAttempt.originBusy`, its three literal writes, the admitted `Option`,
the impossible busy/Some representation, and the `O.isNone(attempt.admitted)`
coordination branch in promotion. Exhaustive tagged matching selects the three
paths. Keep the independent `Option` returned by `gate.tryAcquire` and
`stageSelfLease`; those are boundary results used to construct the outcome.

The recovery-record polling predicate and its two pending-result guards are
independent lock/settlement boundaries. Retain them unchanged; neither receives
Boolean-cluster deletion credit. A timeout must not become a fourth admission
outcome or collapse pending recovery into successful settlement.

The staging-file identity/liveness, AlreadyExists, forced-cleanup diagnostic,
preview/repair and finalizer guards are separate resource boundaries. Delete
none of them and claim no guard-deletion credit for them.

# Encoded-side impact

None. `AdmissionAttempt` is private, transient, and never encoded. Durable
ticket, lease, promotion-transition, admission-journal, and termination-
journal schemas and bytes remain unchanged relative to the new source pin.
That includes v3 release attribution (`checkoutRoot`, `branch`), enqueue and
withdrawal identities, optional attempt attribution and telemetry omission,
v3 eviction heartbeat attribution, and the protocol-v2 eviction fence. Do not
restore the pre-merge v1 release writer or protocol-v1 marker. The generic origin lease remains
an opaque in-process capability and is never admitted to a persistence codec.

The incoming temporary-filename protocol and the new staging entries on the
snapshot `dead` surface are part of the current compatibility baseline. Keep
those exact names/values and all cleanup diagnostics. The outcome migration
adds no encoded field, no filesystem format, and no new public exposure.

# Test impact

Retain tests for a busy gate, same-origin legacy ownership, ordinary rejection
from overshoot, admission, staging errors after acquisition, promotion
transition failure, successful use, failed use, fallback admission, and exact
release counts. Add a schema-derived constructor/match test only if the private
owner is exposed through an existing test hook; do not export it solely for a
test. Run the focused quality-scheduler suite and package verification when
implemented.

Retain the newly changed tests at `quality-scheduler.test.ts:1102-1241` for
enqueue/admit/release and full attribution, `:1243-1424` for mixed-version
round trips, older-reader byte preservation and bounded queue churn,
`:2619-2718` for protocol fencing, `:3343-3386` for interrupted withdrawal,
and `:5081-5123` for durable-promotion recovery without false withdrawal.
These are source-inspected fixtures, not executed proof in this P2 refresh.

Preserve the incoming live concurrency fixture at
`quality-scheduler.test.ts:3493-3646`. Its injected journal sink is held by a
Deferred while an observing FileSystem counts claim checks; after at least three
observations and another second, the observer must still be pending. Releasing
the sink allows both fibers to finish. Keep exactly one lease-evicted and one
ticket-evicted admission event, one attributed termination event per owner, and
empty lease/queue/claim directories. This is source-inspected fixture evidence,
not an executed test in this P2 companion. Earlier delayed-enqueue and blocked-
clock polling fixtures remain intact; all test citations above refer to the current
3657 source; the private line map proves the unchanged fixture spans exactly.

Preserve the new staging fixtures in `quality-scheduler.test.ts:711-742`
(deterministic stalled filesystem/file writers), `:767-785` (mid-write
interruption), `:787-805` (pre-rename interruption), `:807-826` (pre-link
interruption retaining the original destination), and `:828-851` (reported
cleanup refusal while the collision result remains false). The existing
exclusive-collision fixture at `:754-765` still proves the destination's bytes
are unchanged. These tests exercise actual effects through the public test kit;
do not replace them with an equation-only test of the proposed outcome.

Retain `quality-scheduler.test.ts:2874-2925`: a dead legacy PID and a reused
current PID with mismatching start are previewed and removed on apply, while
both a live legacy PID and an exact current-start identity remain. The fixture
places files in leases/queue; source proves claims/promotions use the same
collector. Do not claim explicit four-directory fixture coverage where it is
not present. `process-identity.test.ts:55-88` independently covers same-source
reuse, cross-source unknown, unavailable probe and legacy empty identity.
Preserving these contracts requires no new scope-wide test campaign in P2.

# Risk

Land with `scheduler-promotion-tick-origin` because both use the same outcome
owner and promotion reader. The critical risk is moving a release across the
ownership handoff: before admitted is returned, every error or rejection must
release; after handoff, the promotion/use finalizers remain responsible.

Apply both owner migrations in the same ordered Tier 1E subsystem batch, with
serial edits to `QualityScheduler.ts` and its tests. Do not expand this update
into a staging-protocol redesign. A stage-finalizer or PID-fence regression can
strand partial files or delete an active publisher's temporary; retaining only
the three admission outcomes would not by itself protect those lifetimes.
The existing opaque generic capability/schema construction remains a concrete
independent-review obligation; this source refresh does not resolve it through
an always-true validator, a new lease codec, or an unsafe type assertion.
