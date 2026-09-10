# Instance

- id: `scheduler-admission-attempt-origin`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts:1571`
- symbol: `AdmissionAttempt`
- members: `originBusy`, `admitted`
- evidence: E1 at `QualityScheduler.ts:1585-1608` — failure to acquire the
  origin gate is busy/None, an overshoot rollback is not-busy/None, and a
  staged lease is not-busy/Some; busy/Some is unreachable.

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
capability with no codec, use a private declared schema for that generic
payload and never decode or encode the union. Reuse this exact owner for
`PromotionTick`; do not introduce a second three-way scheduler type or require
`AdmissionOriginGate` callers to supply a runtime lease codec.

# Migration inventory

- `QualityScheduler.ts:1432-1437` — retain the generic admitted payload and
  place the private opaque-payload declaration and shared outcome owner beside
  it. Add only the existing package's `LiteralKit`/tuple helper imports needed
  by the schema-first construction; no barrel export is required.
- `QualityScheduler.ts:1569-1608` — delete `AdmissionAttempt`; return
  `origin-busy` when `gate.tryAcquire` is None, `rejected` after an overshoot,
  and `admitted` with the exact four-field `AdmittedState` on success.
- `QualityScheduler.ts:1589-1598` — preserve both ownership guards: an error
  during staging releases the acquired origin lease via `Effect.onError`, and
  an overshoot success path releases it explicitly before returning rejected.
- `QualityScheduler.ts:1749-1757` — consume the shared outcome exhaustively in
  promotion; retain promotion-transition processing and its error-path release
  only for admitted.
- No public or test barrel exports `AdmissionAttempt`, and whole-source search
  found no direct reader beyond `tryPromoteTicket`.
- `test/quality-scheduler.test.ts:2721-2746,4361-4384,4434-4451` — retain busy
  waiting and every release-on-success/failure assertion; add focused outcome
  assertions through observable scheduler behavior for the overshoot-rejected
  and admitted paths.

# Guard-deletion accounting

Delete `AdmissionAttempt.originBusy`, its two writes, the admitted `Option`,
the impossible busy/Some representation, and the `O.isNone(attempt.admitted)`
coordination branch in promotion. Exhaustive tagged matching selects the three
paths. Keep the independent `Option` returned by `gate.tryAcquire` and
`stageSelfLease`; those are boundary results used to construct the outcome.

# Encoded-side impact

None. `AdmissionAttempt` is private, transient, and never encoded. Durable
ticket, lease, promotion-transition, admission-journal, and termination-
journal schemas and bytes remain unchanged. The generic origin lease remains
an opaque in-process capability and is never admitted to a persistence codec.

# Test impact

Retain tests for a busy gate, same-origin legacy ownership, ordinary rejection
from overshoot, admission, staging errors after acquisition, promotion
transition failure, successful use, failed use, fallback admission, and exact
release counts. Add a schema-derived constructor/match test only if the private
owner is exposed through an existing test hook; do not export it solely for a
test. Run the focused quality-scheduler suite and package verification when
implemented.

# Risk and sequencing

Land with `scheduler-promotion-tick-origin` because both use the same outcome
owner and promotion reader. The critical risk is moving a release across the
ownership handoff: before admitted is returned, every error or rejection must
release; after handoff, the promotion/use finalizers remain responsible.
