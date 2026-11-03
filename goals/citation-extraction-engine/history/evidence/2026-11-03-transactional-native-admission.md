# Transactional native admission

Apply the first implementation slice from the independent Effect upstream reuse
audit using the installed Effect 4.1.1 transaction API. Native admission now uses
TxRef state and Effect.tx/txRetry instead of a semaphore lock, a generation
Deferred, and a manual wake/recheck loop.

A claim reads closed/quarantine state and both capacity ceilings in one
transaction, then commits aggregate counters and its private lease flag together.
A blocked claim retries against the actual transactional read set. Queue entry
and cancellation are bounded reservations; one captured queue timeout surrounds
the complete retry transaction. No process spawn or external allocation ticket
is issued inside a retrying transaction.

Release and quarantine atomically update private lease flags and aggregate
state. They retain their uninterruptible, R=never runtime authority, including
after the admission owner's Scope closes. Scope closure marks state closed and
wakes affected transactions, but does not acknowledge an active child. Snapshot
reads still return an independent schema value.

Verification:

- All eight prior native-admission controls pass, including same-lease races,
  32 cancellation handoffs for each acquisition kind, quarantine, captured Clock,
  owner closure and regex waiting without holding spare total capacity.
- Two added controls cover closure with three blocked mixed-kind claimants and
  an older queue deadline surviving a newer queue entry and cancellation.
- Native and operation admission together pass 17 tests.
- The real HTML entrypoint smoke now receives this shared native owner. Both a
  real parser failure and successful native clean retire before returning, with
  zero active/queued/quarantined reservations afterward. The selected smoke
  passes; the exhaustive native corpus remains hosted verification.
- Server test type checking, scoped lint and package laws pass. The new-only
  Fallow audit still passes with zero dead-code, complexity or clone findings.

This changes the coordination mechanism, not policy or execution authority.
The shared direct stdio RPC backend and optional binary transport remain subsequent
migration slices. No source-observation expectation or semantic waiver changed.

## Public ownership boundaries and caller transactions

Three added controls initially failed: an outer failed transaction could roll
back an issued claim, quarantine/exit acknowledgement, or admission closure even
though those external ownership events could not be rolled back. The negative
receipt is `.beep/pr2511-native-tx-ambient-negative.log`.

Public owner operations now omit only the caller's `Effect.Transaction` from
their execution context. They commit independently while preserving other
ambient services and the captured Clock. Internal claim and retry steps still
join the owner's transaction. A caller-owned TxRef marker still rolls back when
the caller fails, while quarantine persists; isolation does not alter the
caller's transaction. This does not make arbitrary external operations safe to
replay inside caller transactions.

All 20 native/operation admission tests and the selected real HTML worker smoke
pass after this correction. Server test compilation also passes. Receipts:
`.beep/pr2511-native-tx-isolated-{types,tests,smoke}.log`.
