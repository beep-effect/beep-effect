---
title: "Map legacy free-text sync reasons onto the closed kits losslessly at genesis"
date: 2026-11-07
lane: "goals/vs-cutover-2"
reversal: "Restore free-text reason fields (S.String) on the domain events and state, and write idempotency_key on every projected operation event again"
---

PR 3a closed the vault sync reason fields (`MirrorOperation`, `SupersedeReason`,
`SyncRule`) and narrowed `OperationInput.idempotencyKey` to `OperationId`. The legacy
tables hold free text in those places: cursor and operation `last_error` (vendor
diagnostics such as a `DmsMirrorUnavailable.reason`, or `superseded: ...`) and
`{provider}:{workspace}:...` idempotency keys.

**The mapping is lossless; the projection does not reconstruct legacy text.**
Every genesis event already stores its complete legacy row (`row`), and the legacy
projection writes that row verbatim for `*GenesisImported`. The closed literals
exist only in aggregate state, so replay-and-diff stays at zero difference without
a literal-to-text table.

| Legacy column | Aggregate state after genesis | Projected column |
| --- | --- | --- |
| cursor `last_error`, non-null | `DestinationState.cursorError = "pollEvents"` (the legacy writer set it only when polling Box failed) | legacy text, verbatim |
| cursor `last_error`, null | `cursorError = null` | null |
| operation `last_error` | not in `OperationRecord`; no state mapping needed | legacy text, verbatim |
| operation `idempotency_key` | `input.idempotencyKey = public_id` (the only key `QueueOperation` accepts) | legacy text, verbatim, and kept on later live events |

Later live events write closed literals into `last_error` (for example
`kind-replaced`, `uploadFile`, `pollEvents`). `idempotency_key` is now an
insert-only projection column, like the creation audit columns: a live event on an
imported operation keeps its legacy key text, and a live operation keeps the id it
was queued under.

Evidence: `SyncGenesis.pglite.test.ts` imports a selected error cursor with free
vendor text, asserts the state's `cursorError` is `pollEvents`, keeps the
all-column zero diff, and supersedes an imported queued operation live, asserting
`idempotency_key` stays `stored-key-107` while `last_error` becomes `kind-replaced`.
