# Instance

- id: `scheduler-promotion-tick-origin`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:1723`
- symbol: `PromotionTick`
- members: `originBusy`, `admitted`
- evidence: E1 at `QualityScheduler.ts:1745-1757` and E2 at
  `QualityScheduler.ts:1851-1862` — a tick returns origin-busy/None,
  rejected/None, or not-busy/Some; only the busy case stamps the ticket and
  only the admitted case exits the wait.

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

# Migration inventory

- `QualityScheduler.ts:1711-1724` — retain `PromotionTickInfo` unchanged and
  replace the duplicated pair in `PromotionTick` with the shared generic
  outcome.
- `QualityScheduler.ts:1737-1747` — preserve the clock read before durable
  recovery/scan work and construct exactly one info snapshot. When
  `selfMayAttempt` is false, map `hasLegacySameOriginOwner` to origin-busy or
  rejected without changing queue selection.
- `QualityScheduler.ts:1749-1757` — forward the shared outcome from
  `tryAdmitSelf`; process the promotion transition only for admitted and retain
  `gate.release(admitted.originLease)` on transition error.
- `QualityScheduler.ts:1765-1804` — no semantic edit to `noteAdmissionWait`;
  it continues consuming the independent info snapshot for position,
  escalation, and elapsed time.
- `QualityScheduler.ts:1823-1862` — keep interruption masked around promotion,
  restored only for sleep, keep the first report back-dated, return on admitted,
  sleep before refreshing the clock, and stamp blocked-on-origin only for the
  origin-busy tag before persisting the heartbeat.
- No public/test barrel exports `PromotionTick`; whole-source search found no
  reader beyond `waitForAdmission`.
- `test/quality-scheduler.test.ts:2470-2599,2721-2746,4265-4295` — preserve
  legacy same-origin blocking, gate-busy stamping, and head-ticket skip tests.
  Retain admission/promotion journal and release tests at lines 3241-3451 and
  4361-4451.

# Guard-deletion accounting

Delete `PromotionTick.originBusy`, its writes, its admitted `Option`, the
impossible busy/Some state, `O.isNone(attempt.admitted)`,
`O.isSome(tick.admitted)`, and the final `tick.originBusy` ternary. Tagged
matching replaces these correlation guards. Keep `selfMayAttempt`, legacy
same-origin detection, sleep/clock ordering, and every journal/finalizer guard.

# Encoded-side impact

None. Promotion ticks and the shared outcome are private in-memory control
values. Ticket encoding, including the existing sticky
`blockedOnOriginAtMillis` value when a later tick is merely rejected, remains
unchanged. Lease, promotion-transition, and admission-journal wire formats and
messages are untouched.

# Test impact

Exercise all three outcomes through the scheduler: an external/legacy origin
holder stamps the blocked clock; a capacity/ordering rejection waits without a
new stamp; admission returns and completes the promotion transition. Retain
the first-progress report timing, heartbeat sleep cadence, restored
interruption, journal recovery/error, and exact origin-release tests. Run the
focused quality-scheduler suite and package verification when implemented.

# Risk and sequencing

Land atomically with the admission-attempt design. The high-risk regression is
treating every non-admission as origin busy, which changes durable ticket
metadata and fairness behavior. Keep promotion info orthogonal and preserve
the current clock and I/O order exactly.
