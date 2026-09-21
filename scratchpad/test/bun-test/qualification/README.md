# Runner qualification controls

These fixtures import `@effect/vitest` unchanged. The native candidate must
substitute its adapter through the pilot facade/preload, including transitive
imports. No fixture imports the scratch adapter directly.

Run each file as an independent process with an exact path and retain test/hook
results, exit status, and timeouts. Disable within-file concurrency for both
runners. The tuple and unnamed-layer controls deliberately inspect sequential
registration/lifetime behavior; they are not concurrent scheduling benchmarks.
Use no retries and do not enable bail or filter individual tests within a file.

| File | Qualified exit | Semantic requirement |
| --- | --- | --- |
| `finished-hook-throws.test.ts` | Nonzero | Passing body becomes a failure when its completion hook assertion throws. The failure must identify the intentional completion-hook mismatch, not collection/setup failure. |
| `finished-hook-continues-cleanup.test.ts` | Nonzero | The middle completion hook fails intentionally, but both surrounding cleanup callbacks still execute. Require the intentional mismatch and no `afterAll` cleanup-count failure. Works as a sentinel for either forward or reverse hook order. |
| `synchronous-throw-cleanup.test.ts` | Zero | Expected synchronous assertion failure still invokes its registered completion callback exactly once; `afterAll` enforces it. |
| `property-completion-once.test.ts` | Zero | One generated pure-property input and one completion callback invocation. No duplicate flush. |
| `default-timeout-finalizer.test.ts` | Zero | Expected timeout aborts the context signal and completes resource release before `afterAll`. |
| `inherited-suite-timeout.test.ts` | Zero | With a 100 ms file default, a nested live test sleeping 200 ms inherits its outer suite's 1,000 ms timeout and completes normally. Configure the file default before collection, exactly as for the default-timeout control. |
| `tuple-each.test.ts` | Zero | Two tuple cases reach Effect callbacks intact, rather than being spread and truncated to their first elements. |
| `each-title-values.test.ts` | Zero | A BigInt-containing object does not fail title interpolation during collection; exactly one body completes and observes amount `1n`. |
| `unnamed-layer-lifetime.test.ts` | Zero | Each unnamed layer acquires for its own block and releases before the subsequent test/block. |

For `default-timeout-finalizer.test.ts`, explicitly configure the **runner
default test timeout to 100 ms** and the hook timeout to at least 1,000 ms. Do not
inject a per-test timeout or wrap the Effect in `Effect.timeout`: either would
test a different cancellation path. The external process deadline should be at
least five seconds but remain bounded. An external kill is a qualification
failure, never the expected timeout outcome. The `.fails` registration accounts
for the intentional timeout; all three teardown assertions must still pass.

The two completion-hook fixtures are deliberately red on a correct implementation. The remaining
fixtures contain either ordinary assertions or expected failures with independent
teardown assertions. Never infer correctness from process exit alone: require the
expected collected test count, intended failure identity, and completed hooks.
Any unexpected skip, collection error, or zero-test result fails qualification.

The earlier mixed BigInt/cyclic-array version of `each-title-values.test.ts` is
preserved in ignored `.beep/bun-test-review/each-title-values-control-08-original.test.ts`.
The baseline's historical control-08 collection failure remains evidence; the
narrowed BigInt-only control needs its own new receipt. The self-referential array
triggered a separate upstream title-formatting limitation and is not a shared
passing parity requirement.

No fixture was executed during this cleanup. The root pilot harness owns execution
and the shared 60-minute execution ledger.
