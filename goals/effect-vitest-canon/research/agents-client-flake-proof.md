# Agents Client completion and storage proof

Provider atom tests now await public `AtomRegistry.getResult` with
`suspendOnWaiting: true` instead of four `yieldNow` calls. The probe case awaits
the mutation and then the invalidated list. The unauthenticated case captures
the failed effect and retains every original AsyncResult, Cause, typed-error and
exact-guidance assertion. The actual RpcTest transport and serial shared-state
ownership remain.

The interrupted-turn refresh test still waits for stream start, interrupts the
actual run atom, and observes the original refresh-attempt acknowledgement.
It now subscribes through the existing cancellation-safe `waitForAtom` until
the actual unreconciled reply exists. Product source confirms this fallback is
created by the failed-refresh handler. All original stopped-block, user-content
and draft assertions remain; the 25 ms assumption is removed. Receipt attempt
counts and the 2 ms poll configuration remain unchanged.

Each defect scenario captures its storage object, saves and removes only its
`draft:1` value, and restores those exact bytes after registry teardown. The
existing helper scope guarantees restoration on failure. In runtimes without
localStorage, the original storage-absent behavior remains. No global clear,
production key change, fake production service, or assertion removal is used.

Control receipts:

- Delaying actual RPC handlers by 40 ms: all three revised tests pass; all three
  old fixed-yield tests fail. Fixture decoding stays unchanged.
- Delaying the scripted refresh failure by 80 ms: the subscription test passes;
  the original 25 ms observation fails.
- Supplying a temporary storage capability with a pre-existing draft key and an
  unrelated key, then running not-persisted before persisted: the new test
  passes, restores the original draft bytes after each case and preserves the
  unrelated key. The old test fails. This tests storage ownership and ordering;
  it is not a browser-storage conformance claim.

All temporary mutations were restored. Full package verification passes audit
(10.1 s) and docgen (6.1 s). Runner review, final Node/Bun timing and saved
inventory reconciliation remain before the Agents Client batch is complete.
