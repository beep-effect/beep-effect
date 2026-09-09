# Instance

- id: `scheduler-admission-attempt-origin`
- exact source SHA: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- corpus source SHA: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
- file:line: `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:1600`
- symbol: `AdmissionAttempt`
- members: `originBusy`, `admitted`
- evidence: E1 at `QualityScheduler.ts:1616-1638` — failure to acquire the
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

- `QualityScheduler.ts:1463-1468` — retain the generic admitted payload and
  place the private opaque-payload declaration and shared outcome owner beside
  it. Add only the existing package's `LiteralKit`/tuple helper imports needed
  by the schema-first construction; no barrel export is required.
- `QualityScheduler.ts:1600-1639` — delete `AdmissionAttempt`; return
  `origin-busy` when `gate.tryAcquire` is None, `rejected` after an overshoot,
  and `admitted` with the exact four-field `AdmittedState` on success.
- `QualityScheduler.ts:1622-1628` — preserve both ownership guards: an error
  during staging releases the acquired origin lease via `Effect.onError`, and
  an overshoot success path releases it explicitly before returning rejected.
- `QualityScheduler.ts:1780-1788` — consume the shared outcome exhaustively in
  promotion; retain promotion-transition processing and its error-path release
  only for admitted.
- `QualityScheduler.ts:1858-1895,1918-1963,2113-2124` — the downstream wait,
  admitted-use and ticket-finalizer chain receives the same four-field payload.
  Preserve `lease`, `leasePath`, `originLease` and `promotionPath` exactly.
- `QualityScheduler.ts:1943-1960,1965-1992,2102-2110` — preserve the new v3
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
- `test/quality-scheduler.test.ts:3107-3154,4789-4860` — retain busy
  waiting and every release-on-success/failure assertion; add focused outcome
  assertions through observable scheduler behavior for the overshoot-rejected
  and admitted paths.

# Guard-deletion accounting

Delete `AdmissionAttempt.originBusy`, its three literal writes, the admitted `Option`,
the impossible busy/Some representation, and the `O.isNone(attempt.admitted)`
coordination branch in promotion. Exhaustive tagged matching selects the three
paths. Keep the independent `Option` returned by `gate.tryAcquire` and
`stageSelfLease`; those are boundary results used to construct the outcome.

# Encoded-side impact

None. `AdmissionAttempt` is private, transient, and never encoded. Durable
ticket, lease, promotion-transition, admission-journal, and termination-
journal schemas and bytes remain unchanged relative to the new source pin.
That includes v3 release attribution (`checkoutRoot`, `branch`), enqueue and
withdrawal identities, optional attempt attribution and telemetry omission,
v3 eviction heartbeat attribution, and the protocol-v2 eviction fence. Do not
restore the pre-merge v1 release writer or protocol-v1 marker. The generic origin lease remains
an opaque in-process capability and is never admitted to a persistence codec.

# Test impact

Retain tests for a busy gate, same-origin legacy ownership, ordinary rejection
from overshoot, admission, staging errors after acquisition, promotion
transition failure, successful use, failed use, fallback admission, and exact
release counts. Add a schema-derived constructor/match test only if the private
owner is exposed through an existing test hook; do not export it solely for a
test. Run the focused quality-scheduler suite and package verification when
implemented.

Retain the newly changed tests at `quality-scheduler.test.ts:981-1120` for
enqueue/admit/release and full attribution, `:1122-1303` for mixed-version
round trips, older-reader byte preservation and bounded queue churn,
`:2497-2596` for protocol fencing, `:3156-3196` for interrupted withdrawal,
and `:4818-4860` for durable-promotion recovery without false withdrawal.
These are source-inspected fixtures, not executed proof in this P2 refresh.

# Risk

Land with `scheduler-promotion-tick-origin` because both use the same outcome
owner and promotion reader. The critical risk is moving a release across the
ownership handoff: before admitted is returned, every error or rejection must
release; after handoff, the promotion/use finalizers remain responsible.
