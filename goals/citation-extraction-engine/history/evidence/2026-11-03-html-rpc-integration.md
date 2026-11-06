# Effect RPC integration for the owned HTML child

Apply the upstream reuse audit to the actual parent and child, using installed
Effect 4.1.1 `Rpc`, `RpcGroup`, `RpcClient.makeNoSerialization` and
`RpcServer.makeNoSerialization`. A shared Clean procedure derives payload,
success and error types from the existing closed schemas. RPC owns pending
calls, typed exits, handler registration and scoped handler fibers.

The existing strict byte transport performs serialization before RPC receives
decoded messages. This deliberately uses Effect's public already-decoded channel
constructors instead of adding a second envelope/codec pass. It preserves exact
frame sizing, JSON surrogate escaping, pre-allocation checks and the established
Ready/Started/terminal conversation. The encoded request is still prepared
before spawning; each child receives one request through one stdin sink lifetime.
No retry, reconnect, ping, pre-run RPC message array or pool is introduced.

The child registers its native kernel as the shared RPC handler with concurrency
one. Expected failures use typed RPC exits and the existing redacted wire union.
Unexpected handler defects become interruption before RPC can report their
original causes; a terminal exit without a typed failure becomes invalid-frame.

The parent validates all three frames and EOF before delivering a typed exit.
Delivery also waits for successful request-write completion. This ensures an
early complete reply cannot race pending-call registration or cause RPC to
cancel an unfinished write. Removing this guard makes the deterministic stalled
sink control fail; receipt `.beep/pr2511-html-rpc-early-negative.log`.

The enclosing process owner retains deadlines, forced stop, quarantine and
independent retirement acknowledgement. An RPC exit remains a candidate; it
does not release the native lease or publish the public result.

Verification:

- Server test compilation passes.
- Seventeen tests across HTML worker, framing and new RPC controls pass. These
  retain real busy-WASM cancellation/deadline, queued capacity, quarantine, late
  acknowledgement, owner closure, failed spawn, source isolation and malformed,
  partial, trailing and oversize output controls.
- The new controls exercise actual Effect RPC over immediate Effect streams and
  a stalled sink, including an isolated surrogate, and prove a source-bearing
  stdin error becomes channel-failed with exactly one write attempt.
- The selected actual HTML entrypoint smoke passes for parser failure and
  successful text, with zero remaining shared native reservations afterward.
- Scoped lint and package laws pass. The new-only Fallow audit reports zero
  dead-code, complexity or clone findings. The schema-first scan found one
  pre-existing moved PriorFulls assertion anchor (77 to 79); only that location
  was corrected, retaining its reviewed golden-fixture reason and policy.
- Logs: `.beep/pr2511-html-rpc-types.log`,
  `.beep/pr2511-html-rpc-final-tests.log`,
  `.beep/pr2511-html-rpc-final-smoke.log`.

This is the HTML integration slice. A reusable shared regex/HTML backend,
optional binary serialization, actual regex execution and exhaustive hosted
parity remain required work. The exhaustive native corpus is not run locally.
No source fixture, resource threshold or semantic waiver changed.
