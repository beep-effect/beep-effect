# Instance

- id: `scheduler-promotion-tick-origin`
- exact source SHA: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- corpus source SHA: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
- file:line: `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:1751`
- symbol: `PromotionTick`
- members: `originBusy`, `admitted`
- evidence: E1 at `QualityScheduler.ts:1777-1788` and E2 at
  `QualityScheduler.ts:1881-1893` — a tick returns origin-busy/None,
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

- `QualityScheduler.ts:1744-1755` — retain `PromotionTickInfo` unchanged and
  replace the duplicated pair in `PromotionTick` with the shared generic
  outcome.
- `QualityScheduler.ts:1768-1778` — preserve the clock read before durable
  recovery/scan work and construct exactly one info snapshot. When
  `selfMayAttempt` is false, map `hasLegacySameOriginOwner` to origin-busy or
  rejected without changing queue selection.
- `QualityScheduler.ts:1780-1788` — forward the shared outcome from
  `tryAdmitSelf`; process the promotion transition only for admitted and retain
  `gate.release(admitted.originLease)` on transition error.
- `QualityScheduler.ts:1796-1835` — no semantic edit to `noteAdmissionWait`;
  it continues consuming the independent info snapshot for position,
  escalation, and elapsed time.
- `QualityScheduler.ts:1854-1895` — keep interruption masked around promotion,
  restored only for sleep, keep the first report back-dated, return on admitted,
  sleep before refreshing the clock, and stamp blocked-on-origin only for the
  origin-busy tag before persisting the heartbeat.
- `QualityScheduler.ts:1852` — preserve the public test alias
  `noteAdmissionWaitForTesting`, its six arguments and unchanged info/progress
  shapes. The alias predates this merge; its line moved. Measurement arrays,
  counts and timestamps are payload values, not independent Boolean axes.
- `QualityScheduler.ts:1918-1963,1965-1992,2102-2124` — preserve admitted use,
  v3 release, enqueue and conditional withdrawal, including suppressed
  withdrawal when a durable lease survives failed promotion cleanup.
- `AdmissionJournal.ts:395-613,638-674,1551-1629` — preserve mixed v1/v2/v3
  decoding, reader injection for older-fleet preservation, the 200-admission
  ring, the 2,400-known-row bound and unknown raw-byte preservation.
- No public/test barrel exports `PromotionTick`; the repo-run facade and
  `src/test/RepoRun.test-kit.ts:8` expose the unchanged public scheduler and
  journal APIs. Exhaustive source search found the definition, producer and
  sole `waitForAdmission` reader even though Effect.fn edges were incomplete.
- `test/quality-scheduler.test.ts:2790-3000,3107-3154,4691-4727` — preserve
  legacy same-origin blocking, gate-busy stamping, and head-ticket skip tests.
  Retain admission/promotion journal and release tests at lines 3625-3910 and
  4789-4860.

# Guard-deletion accounting

Delete `PromotionTick.originBusy`, its writes, its admitted `Option`, the
impossible busy/Some state,
`O.isSome(tick.admitted)`, and the final `tick.originBusy` ternary. Tagged
matching replaces these correlation guards. Keep `selfMayAttempt`, legacy
same-origin detection, sleep/clock ordering, and every journal/finalizer guard.

# Encoded-side impact

None. Promotion ticks and the shared outcome are private in-memory control
values. Ticket encoding, including the existing sticky
`blockedOnOriginAtMillis` value when a later tick is merely rejected, remains
unchanged. Lease, promotion-transition, and admission-journal wire formats and
messages are untouched relative to the current pin. The baseline now includes
v3 enqueue/withdrawal/release and eviction attribution, protocol v2, and exact
omission of optional attribution/telemetry. Do not revert those merge changes.

# Test impact

Exercise all three outcomes through the scheduler: an external/legacy origin
holder stamps the blocked clock; a capacity/ordering rejection waits without a
new stamp; admission returns and completes the promotion transition. Retain
the first-progress report timing, heartbeat sleep cadence, restored
interruption, journal recovery/error, and exact origin-release tests. Run the
focused quality-scheduler suite and package verification when implemented.

The new source fixtures at `quality-scheduler.test.ts:981-1120,1122-1303`
cover lifecycle rows and mixed-reader retention; `:2497-2596` covers the protocol
fence; `:3156-3196,4818-4860` covers interruption versus surviving durable
promotion. Preserve these alongside the existing progress seam fixture at
`:809`. The overlapping attempt-admitted Option branch at
`QualityScheduler.ts:1781` is counted once in the admission-attempt design,
not again as a second deletion here. No product tests ran during this refresh.

# Risk

Land atomically with the admission-attempt design. The high-risk regression is
treating every non-admission as origin busy, which changes durable ticket
metadata and fairness behavior. Keep promotion info orthogonal and preserve
the current clock and I/O order exactly.
