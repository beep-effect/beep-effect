# Experimental adapter PR review

Reviewed 2026-09-15 against the working-tree diff. Scope is shipping experimental
scratchpad repairs and their evidence, not approving a canonical runner migration.
No tests, benchmarks, or adapter edits were performed for this review.

## Title-formatting repair and narrowed control

**Previously identified introduced collection failure, now repaired in source.** The replacement
at `internal/internal.ts:219–225` sends every active case through `formatEachName`
(`54–61`), which previously served the skipped-case fallback. Object formatting
calls `JSON.stringify`. A case such as `{ value: 1n }` with title `%s`, or a cyclic
object with `%o`, throws during test collection. This widens a pre-existing
formatter weakness into all ordinary/Effect/live `.each` cases. The previous
native registrar handled title formatting. It also changes `%d/%i/%f` into plain
string coercion and leaves unsupported placeholders unchanged.

Root replaced JSON serialization with installed
`Inspectable.toStringUnknown(current, 0)`. The BigInt-only shared control now
asserts exactly one completed callback and the intact `1n` amount. It still needs
a fresh paired execution receipt; no success is inferred from static inspection.

The original mixed BigInt/cyclic-array fixture is preserved byte-for-byte at
ignored `.beep/bun-test-review/each-title-values-control-08-original.test.ts`.
Historical control-08 failures remain untouched. Installed Vitest's array display
recurses without the object formatter's circular tracking
(`node_modules/@vitest/utils/dist/display.js:163–177,337–352`), consistent with its
recorded collection stack overflow. Its BigInt formatter is separate (`276–281`).
Therefore the cyclic-array case is unsuitable as a shared passing control; its
failure must not be attributed to the candidate or erased. Full placeholder/text
parity remains unqualified, including numeric placeholders and `$property` names.

## Completion aggregation: improvement with explicit limits

`flush` now deletes state once, validates callbacks sequentially, and retains
cleanup failures (`111–120`). `finish` keeps both body and cleanup failures
(`123–128`). This addresses duplicate flushing, swallowed hook failures and
abandoned cleanup. The two new completion-failure fixtures distinguish intended
failure from an additional cleanup-count failure; retain their exact receipts.

Callback order is **inherited**, not introduced by these repairs: the old adapter
also ran failure callbacks before completion callbacks and completion callbacks
in registration order. Installed Vitest runs completion hooks in reverse order,
then failure hooks (`node_modules/@vitest/runner/dist/chunk-artifact.js:2574–2577,
2984–2988`). The README now discloses this; correcting all ordering is not a
prerequisite for an explicitly experimental PR.

One newly visible consequence should be documented: if a body passes but its
completion hook fails, `flush(ctx, false)` never dispatches registered failure
callbacks. Previously that completion error was swallowed. This is not a false
green now, but failure observers may not run. If claiming full lifecycle repair,
dispatch failure observers after collecting completion outcomes and preserve all
failures; otherwise document the narrower repaired guarantee. Hook-specific
timeouts and registration during cleanup remain unqualified inherited behavior.

## Pure property contexts

The new inner `makeTestContext` at `439–453` gives pure properties their own abort
timer and avoids sharing the externally flushed context. An empty outer context
still exists through `defaultApi`, but it is not exposed to the property callback;
inspection found no new duplicate-user-hook execution path. The pure property
once fixture remains the useful regression proof.

This does not make an event-loop-blocking synchronous property preemptible, nor
should it claim to. The managed timeout only takes effect when execution yields.
Suite-inherited timeout remains unsupported, as explicitly exposed by the new
inherited-suite control. Do not turn that control into an expected success in a
general acceptance manifest until fixed.

## Unnamed layers

The anonymous `describe` wrapper at `536–540` is an **introduced semantic change**:
it adds a suite boundary and relocates hooks. It fixes the demonstrated sibling
resource lifetime problem, but does not reproduce upstream unnamed-layer task
tracking. Names/hierarchy, selected tests, parent-hook ordering and concurrent
scheduling can differ. The existing lifetime fixture validates the intended
sequential improvement only.

The README explicitly discloses this limitation. For this scratchpad PR, retain
that boundary and avoid any claim of drop-in layer parity; canonical promotion
requires fuller qualification or an alternative implementation. Schema's layer
usage inspected is named (`CsvParser.test.ts:8`), so this change does not explain
the schema pilot's timeout/module-reset failures.

## Minimum reviewable PR boundaries

1. Retain the inspected-value formatter repair and execute the narrowed BigInt
   control independently on both arms; preserve the tuple control and historical
   cyclic-array failure evidence. No benchmark success follows from qualification.
2. Keep the README's experimental status, inherited timeout/module-reset limits,
   callback-order caveat and anonymous-suite caveat. The `index.ts:4–6` module
   comment has now been corrected to experimental status and points to known
   unsupported contracts; the previous no-rewrite portability claim is gone.
3. Include qualification source plus expected-result documentation. Intentionally
   red controls must remain explicitly selected subprocess controls, not be
   presented as an ordinary all-green test suite. Include actual root-owned
   execution receipts separately from this read-only assessment.
4. Preserve existing production runner and coverage obligations. Native exported
   `vi`/`expectTypeOf` and Chai `deepInclude` are experimental compatibility work;
   they do not imply module-reset support or canonical dependency ownership.
5. Describe the PR as bounded repairs and measurement evidence. Carry unresolved
   parity work into follow-ups rather than requiring a full migration in this PR.

Final cleanup added no fixture: it preserved the old title control and narrowed
the shared case as above. Inspection found no further introduced correctness
blocker within the documented experimental scope. The introduced anonymous-suite
boundary and managed-default behavior remain disclosed limitations, not canonical
parity guarantees. Changing defaults after registration is unsupported: the
backstop is captured at registration while the timer default is read at execution.
Set defaults once in preload before collection. All runtime work remains with the
root harness and its aggregate execution budget.
