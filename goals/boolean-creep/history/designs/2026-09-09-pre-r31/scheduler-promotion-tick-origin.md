# scheduler-promotion-tick-origin

Pre-R30 native P2 source/design refresh for scheduler staging ownership,
interruption cleanup and orphan collection. Both existing 4/3 domains, complete
payloads and the ordered Tier 1E shared-outcome batch remain intact. Product
citations bind immutable main `3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee` and
merged HEAD `1c07c15495aaa42f521b887b01e943e68804606c`; their reviewed source/test
bytes equal the working files. The exact pre-edit designs and rows are retained in the R29 integration
archive. This native P2 refresh supplies no independent P3 approval or
implementation credit.

# Instance

- id: `scheduler-promotion-tick-origin`
- exact incoming source SHA: `3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`
- previous incoming main SHA: `5fc065daff16300b8435eca3f32d55564664f57c`
- file:line: `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:1886`
- symbol: `PromotionTick`
- members: `originBusy`, `admitted`
- evidence: E1 at `QualityScheduler.ts:1912-1923` and E2 at
  `QualityScheduler.ts:2016-2028` — a tick returns origin-busy/None,
  rejected/None, or not-busy/Some; only the busy case stamps the ticket and
  only the admitted case exits the wait.

R28 native P2 refresh: the complete tick producer and wait loop are unchanged
from `8f266b878445ca8a7f751f9248da428a4dde39a1`; the journal dependencies have
advanced and are described below. Independent P3 remains pending. The prior
design is preserved under `history/designs/2026-09-09-pre-main-d1b4d7/`.

# Current shape

`PromotionTick` repeats the admission pair beside independent measurement
information. A non-attempting ticket may be origin-busy because a legacy
same-origin owner is active; an attempted admission forwards the corresponding
three-way result. The wait loop separately reads admitted, info, and
originBusy.

# Cardinality gap

Four boolean/presence combinations are representable and three tick outcomes
are legal: `origin-busy`, `rejected`, and
`admitted({ admittedState })`.

The complete pair is `(originBusy, admitted presence)`: `(true, None)` is
origin-busy, `(false, None)` is rejected, and `(false, Some(payload))` is
admitted. `(true, Some(payload))` has no producer. `Some` preserves every
`AdmittedState` value and opaque origin capability; it is a presence projection
for cardinality, not a narrowing of that payload to a singleton. Errors and
interruption stay in their existing Effect channels, not a fourth data case.

# Target schema

Replace the pair with the canonical private generic
`AdmissionOriginOutcome<OriginLease>` defined by
`scheduler-admission-attempt-origin`. Keep `PromotionTickInfo` as an
independent field and define the tick as `{ outcome, info }`; capacity,
available memory, scan state, and the start-of-attempt clock are observations,
not variants of admission disposition. Match outcome exhaustively in the wait
loop: admitted returns its payload, origin-busy continues and stamps
`blockedOnOriginAtMillis`, and rejected continues without stamping.

`AdmissionOriginOutcome` has the same private capability/schema limitations
and exact local Effect v4 references as its defining admission-attempt design.
Do not introduce a second schema, an unknown-input capability validator or a
second outcome-to-Boolean compatibility bag.

# Migration inventory

- `QualityScheduler.ts:1879-1890` — retain `PromotionTickInfo` unchanged and
  replace the duplicated pair in `PromotionTick` with the shared generic
  outcome.
- `QualityScheduler.ts:1903-1913` — preserve the clock read before durable
  recovery/scan work and construct exactly one info snapshot. When
  `selfMayAttempt` is false, map `hasLegacySameOriginOwner` to origin-busy or
  rejected without changing queue selection.
- `QualityScheduler.ts:1915-1923` — forward the shared outcome from
  `tryAdmitSelf`; process the promotion transition only for admitted and retain
  `gate.release(admitted.originLease)` on transition error.
- `QualityScheduler.ts:1931-1970` — no semantic edit to `noteAdmissionWait`;
  it continues consuming the independent info snapshot for position,
  escalation, and elapsed time.
- `QualityScheduler.ts:1989-2030` — keep interruption masked around promotion,
  restored only for sleep, keep the first report back-dated, return on admitted,
  sleep before refreshing the clock, and stamp blocked-on-origin only for the
  origin-busy tag before persisting the heartbeat.
- `QualityScheduler.ts:1987` — preserve the public test alias
  `noteAdmissionWaitForTesting`, its six arguments and unchanged info/progress
  shapes. The alias predates this merge; its line moved. Measurement arrays,
  counts and timestamps are payload values, not independent Boolean axes.
- `QualityScheduler.ts:2053-2098,2100-2127,2237-2259` — preserve admitted use,
  v3 release, enqueue and conditional withdrawal, including suppressed
  withdrawal when a durable lease survives failed promotion cleanup.
- `AdmissionJournal.ts:395-613,638-674,1551-1629` — preserve mixed v1/v2/v3
  decoding, reader injection for older-fleet preservation, the 200-admission
  ring, the 2,400-known-row bound and unknown raw-byte preservation.
- No public/test barrel exports `PromotionTick`; the repo-run facade and
  `src/test/RepoRun.test-kit.ts:8` expose the unchanged public scheduler and
  journal APIs. Exhaustive source search found the definition, producer and
  sole `waitForAdmission` reader even though Effect.fn edges were incomplete.
- `test/quality-scheduler.test.ts:2971-3187,3294-3341,4954-4990` — preserve
  legacy same-origin blocking, gate-busy stamping, and head-ticket skip tests.
  Retain admission/promotion journal and release tests at
  `quality-scheduler.test.ts:3888-4173,5052-5123`.

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

Delete `PromotionTick.originBusy`, its writes, its admitted `Option`, the
impossible busy/Some state,
`O.isSome(tick.admitted)`, and the final `tick.originBusy` ternary. Tagged
matching replaces these correlation guards. Keep `selfMayAttempt`, legacy
same-origin detection, sleep/clock ordering, and every journal/finalizer guard.

The recovery-record polling predicate and its two pending-result guards are
independent lock/settlement boundaries. Retain them unchanged; neither receives
Boolean-cluster deletion credit. A timeout must not become a fourth admission
outcome or collapse pending recovery into successful settlement.

The staging-file identity/liveness, AlreadyExists, forced-cleanup diagnostic,
preview/repair and finalizer guards are separate resource boundaries. Delete
none of them and claim no guard-deletion credit for them.

# Encoded-side impact

None. Promotion ticks and the shared outcome are private in-memory control
values. Ticket encoding, including the existing sticky
`blockedOnOriginAtMillis` value when a later tick is merely rejected, remains
unchanged. Lease, promotion-transition, and admission-journal wire formats and
messages are untouched relative to the current pin. The baseline now includes
v3 enqueue/withdrawal/release and eviction attribution, protocol v2, and exact
omission of optional attribution/telemetry. Do not revert those merge changes.

The incoming temporary-filename protocol and the new staging entries on the
snapshot `dead` surface are part of the current compatibility baseline. Keep
those exact names/values and all cleanup diagnostics. The outcome migration
adds no encoded field, no filesystem format, and no new public exposure.

# Test impact

Exercise all three outcomes through the scheduler: an external/legacy origin
holder stamps the blocked clock; a capacity/ordering rejection waits without a
new stamp; admission returns and completes the promotion transition. Retain
the first-progress report timing, heartbeat sleep cadence, restored
interruption, journal recovery/error, and exact origin-release tests. Run the
focused quality-scheduler suite and package verification when implemented.

The new source fixtures at `quality-scheduler.test.ts:1102-1241,1243-1424`
cover lifecycle rows and mixed-reader retention; `:2619-2718` covers the protocol
fence; `:3343-3386,5081-5123` covers interruption versus surviving durable
promotion. Preserve these alongside the existing progress seam fixture at
`:930`. The overlapping attempt-admitted Option branch at
`QualityScheduler.ts:1916` is counted once in the admission-attempt design,
not again as a second deletion here. No product tests ran during this refresh.

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

Land atomically with the admission-attempt design. The high-risk regression is
treating every non-admission as origin busy, which changes durable ticket
metadata and fairness behavior. Keep promotion info orthogonal and preserve
the current clock and I/O order exactly.

Apply both owner migrations in the same ordered Tier 1E subsystem batch, with
serial edits to `QualityScheduler.ts` and its tests. Do not expand this update
into a staging-protocol redesign. A stage-finalizer or PID-fence regression can
strand partial files or delete an active publisher's temporary; retaining only
the three admission outcomes would not by itself protect those lifetimes.
The existing opaque generic capability/schema construction remains a concrete
independent-review obligation; this source refresh does not resolve it through
an always-true validator, a new lease codec, or an unsafe type assertion.
