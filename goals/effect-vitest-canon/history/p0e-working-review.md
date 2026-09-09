# P0e working design review

These observations concern in-progress source. They do not establish a final
failure or acceptance result; close them against the actual final implementation
and meaningful runtime evidence.

## Defer watchdog error construction until expiration

The first instrumentation draft passes Exit.fail(TestHang.make(...)) to
Effect.as. That argument eagerly reads MutableRef.get(lastLogLine) while the
watchdog is constructed, before the body has emitted its later log events.
A watchdog error must capture the last log at expiration. Defer the read and
error construction until after the live sleep. Add a runtime case whose body
emits a distinctive log, suspends, and is stopped by the watchdog; assert the
named TestHang contains that log and that concurrent cases cannot swap logs.

## Put diagnostic lifecycle messages under the configured logger

The draft provides its logger layer only around self. The start/end Effect.log
calls run outside it, so the trace logger configuration does not govern those
lifecycle messages. Apply the intended Logger layer to start/body/end while
preserving existing loggers and TestEnv. Prove trace-off, explicit trace-on,
CI-on, failure and watchdog outcomes. Do not let lifecycle messages overwrite
the last body log used to explain a hang.

## Preserve the caller's scope and timeout contract

The draft provideLoggerLayer wraps the entire test body in a new Effect.scoped
while building the logger layer. D7 requires preserving the upstream per-test
Scope and finalizer ownership. Reuse the existing test scope where possible;
prove any required internal scope does not replace the Scope seen by the body
or alter finalizer behavior. Do not add an unnecessary whole-body scope merely
to make a generic signature easier.

The draft budget uses max(1, timeout - margin). For a positive timeout at or
below 1ms, this is not strictly below the task timeout. Preserve disabled
0/Infinity semantics and make the finite-positive budget contract precise.
Do not change the user's timeout to hide this edge.

## Current-test lookup is public but not intrinsically isolated

The public TestRunner.getCurrentTest export is verified through installed
Vitest 4.1.11. Its @vitest/runner implementation is a module-level _test,
set by setCurrentTest and returned directly by getCurrentTest
(chunk-artifact.js lines 574-579). Public availability alone does not prove
per-execution isolation when setup/body execution yields or cases run concurrently.

Prefer the actual callback TestContext where it exists and establish a
supported public seam for case-only each callbacks and layer variants.
Pinned rc.112 internal.ts 120-125 implements tester each through the public
Vitest for(cases) API, whose registration callback receives (args, ctx), while
the user Effect callback receives only args. This is source evidence for seam
analysis, not permission to copy private runner code.

Prove actual names/timeouts against each concurrent callback's context and
include delayed layer setup, each/property variants and distinct last logs.
If relying on a current-test lookup at a particular boundary, explain and test
why the capture occurs before any competing execution can replace it. Do not
declare a concurrency bug fixed from a sequential mocked lookup alone.

## Package ownership request

The lane correctly noted that @effect/vitest is currently a devDependency but
the new exported subpath imports it at runtime. Keep the manifest unchanged
until the orchestrator resolves the narrow dependency ownership extension.
The root barrel stays unchanged; the existing wildcard export already exposes
the requested public Vitest subpath.

Dependency disposition: the orchestrator approves moving the existing pinned
@effect/vitest declaration from development to runtime dependencies for the new
explicit Vitest subpath. The orchestrator will apply the manifest change and
regenerate/review the lockfile after source handoff. This does not authorize a
version change, root-barrel re-export or any lane-owned manifest edit, and it
does not block independent implementation/tests.

## Property watchdogs must respect the whole test budget

Pinned rc.112 effect-property registration calls run(ctx, ..., self) inside
FastCheck's property callback, so the instrumented Effect callback runs once
per generated trial. A fresh full task.timeout watchdog on every trial does
not protect the complete Vitest property test from cumulative elapsed time.
Many individually short trials can exceed the outer timeout without producing
the intended TestHang. This needs a real integration regression, not only a
single hanging trial.

Preserve the resolved per-test deadline across trials and shrinking, with
correct concrete task identity, last log and failure outcome. Ensure lifecycle
start/end diagnostics describe the test run rather than silently becoming an
unbounded per-trial stream. Keep fcRuns floors, seed/shrinking behavior and
concurrent task isolation intact. Establish the supported public registration
seam needed for this contract; do not edit upstream internals or reset the
whole timeout on each property callback.

## Single-case delegation must preserve original each titles

The correction draft delegates every original each case through a separate
single-case each registration. This changes the index seen by Vitest's title
formatter: each new array begins at zero. Preserve the complete original title
semantics, including %#, %$, escaped percent forms, tuples, object interpolation
and duplicate case values. Compare original versus instrumented collected task
names/options and then run the cases; do not validate only distinct literal
alpha/beta labels that hide index drift. Keep user callback arity and original
case data unchanged, and do not copy private runner code.

The lane's actual concurrent fixture has now reproduced the earlier metadata
risk: an alpha case inherited beta metadata and reached the Vitest timeout.
That observation upgrades the old concurrency concern to an introduced,
reproduced failure; retain its receipt and prove the final public seam closes it.

## Final-source comparison: each full identity and repeated properties

The p0e-property-budget lane exited successfully. Root then ran two independent
Node/Vitest comparisons against that final source; both exposed introduced
behavior differences despite the lane's passing suites.

- Indexed identity: original and instrumented each arrays have equal name
  fields, but the second instrumented task retains index=0/ordinal=1 in both
  fullName and fullTestName. The original has index=1/ordinal=2. The wrapper
  reads fullTestName for its watchdog, so this is an incorrect diagnostic
  identity as well as a collected-task mismatch. The private identity probe
  produced 1 failed / 4 passed tests. Retain the failed receipt.
- The fixture's supposed complete options comparison reads task.options,
  which is undefined on the actual collected Test. Compare real timeout,
  concurrent, retry, repeats, mode, fails, meta and tags fields where relevant.
- Whole-array provisional collection followed by task-array truncation and
  single-case recollection does not meet the one-original-collection contract.
  Remove that workaround instead of copying more fields onto replacement
  tasks. Use a supported public registration/context seam and prove complete
  identity, options, callback execution, duplicate values and concurrency.
- Repeated property: an original property with repeats=1, timeout=100ms and
  a 200ms afterEach hook passes both independent executions. The instrumented
  counterpart fails its second execution immediately with a 5e-324ms TestHang.
  The registration-local deadline survives the first completed execution.
  The private repeat probe produced 1 failed / 1 passed tests. Reset the
  per-execution state between repeats/retries while retaining one deadline
  across every trial and shrink within each execution. Verify lifecycle and
  last-log reset too. Report the meaningful configured watchdog budget when
  a property has exhausted its remaining time, not Number.MIN_VALUE.
- The silent task===undefined return-self path remains an acceptance concern:
  no supported public tester method may silently lose instrumentation. Prove
  the context seam covers each supported method instead of accepting fallback.
- Lifecycle/watchdog diagnostics must not replace the last body log. A no-body-
  log hang should retain None even with trace enabled; property shrink attempts
  must not overwrite an earlier body diagnostic with wrapper-generated logs.

Private receipts and unchanged source probes are p0e-independent-identity.*
and p0e-independent-repeat.* under ~/.cache/beep/effect-vitest-canon.
The original failing probes remain available under the ignored .beep review
folder and must not be weakened or edited by the source lane.

The public TestRunner.setTestFn in installed Vitest 4.1.11 is typed as getFn
and its implementation is assigned getFn; it is not a usable setter. Do not
infer behavior from that misleading export name. Public aroundEach supplies
an actual TestContext; public makeMethods accepts a TestAPI, though upstream
layer/fails have independent delegation. These are source-backed seam inputs,
not a prescribed implementation. If required for an isolated public context
boundary, the orchestrator authorizes the standard node:async_hooks API in
this Node/Bun testing package, with both runtimes and delayed concurrent Effect
fiber execution proven. No additional third-party dependency is authorized.

## Plain callable compatibility: optional-handler function titles

After the execution-context corrections passed, root compared another public
plain Vitest overload on the same final source. originalIt(function namedTitle()
{}) registers one todo task named namedTitle. The instrumented facade registers
nothing because its invented callback-first data-last branch intercepts every
single function argument. The unchanged private callable probe reports one
failed assertion and one original todo task under Node/Vitest.

The public declaration explicitly allows a string or Function title and an
optional handler. Preserve that original data-first overload. Added pipeable
forms must be unambiguous and their declarations must match their behavior;
they cannot consume an already-valid original call. Keep the existing explicit-
timeout callback-first and options-first examples where they are unambiguous.
No task surgery, fake todo registration or diagnostic/config suppression is
allowed to reconcile the overloads. The final plain callable must still satisfy
the existing Effect compiler and docgen. This is limited to the facade callable
adapter and its meaningful type/registration regression; the now-proven async-
local Effect runtime and instrumentation stay frozen for this correction.

Evidence: p0e-independent-callable.json/log and the unchanged private source
copy under ~/.cache/beep/effect-vitest-canon. The runnable probe lives under
.beep/p0e-independent-review with callable.config.mjs. The source lane may read
and run it, but must not edit it. The current aggregate package verifier must
finish before any source correction resumes, preserving its source-hash proof.

## Root completion of omitted-argument dispatch

The callable handoff fixes original Function titles but the retained compiler-
required signatures also admit omitted callback/options values. A preserved
independent Node probe fails both it(undefined, 100) and it(undefined, handler):
the runtime returns undefined instead of their declared registration function.
After the lane and fresh package audit exited, root completed the two existing
predicates with P.isUndefined and added registration tests for these forms and
the equivalent default/empty curry cases. This is a small integration correction,
not a new API or helper. The final affected-package proof must cover these edits.
