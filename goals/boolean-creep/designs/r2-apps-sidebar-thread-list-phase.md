## 1. Instance

- id: `r2-apps-sidebar-thread-list-phase`
- file:line: `apps/professional-desktop/src/chat/ui/Sidebar.tsx:89`
- symbol: `Sidebar`
- members: `loadFailed`, `isEmpty`
- evidence classes:
  - E3 at `apps/professional-desktop/src/chat/ui/Sidebar.tsx:93` — isEmpty is defined as !isInitial && !loadFailed && no threads, so combined-true is unrepresentable.
  - E2 at `apps/professional-desktop/src/chat/ui/Sidebar.tsx:117` — Render branches if loadFailed then if isEmpty; there is no combined-true arm.

## 2. Current shape

Live sibling-state declaration at `apps/professional-desktop/src/chat/ui/Sidebar.tsx:88`:

```ts
const sorted = AsyncResult.isSuccess(threads) ? A.sort(threads.value, byUpdatedDesc) : [];
const loadFailed = AsyncResult.isFailure(threads);
// Once the load settles with nothing to show, present a calm empty state;
// a failed load names the problem instead of masquerading as "no threads".
// `Initial` (still loading) renders nothing.
const isEmpty = !AsyncResult.isInitial(threads) && !loadFailed && sorted.length === 0;
```

The two reads are independent JSX conditionals at `apps/professional-desktop/src/chat/ui/Sidebar.tsx:117` and `:127`.

## 3. Cardinality gap

The two booleans represent four combinations, but only three flag combinations are legal; moreover, their both-false combination conflates two upstream states. The honest legal states are:

- `loading`: the thread-list `AsyncResult` is initial.
- `failed`: the thread-list load failed.
- `empty`: the load succeeded with no threads.
- `ready`: the load succeeded with at least one thread.

`loadFailed && isEmpty` is illegal. `loading` and `ready` currently share `false/false`.

## 4. Target schema

Add the professional-desktop identity composer and `LiteralKit` imports. Name the kit and type `ThreadListLoadPhase`:

```ts
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $ProfessionalDesktopId.create("chat/ui/Sidebar");

const ThreadListLoadPhase = LiteralKit(["loading", "failed", "empty", "ready"]).pipe(
  $I.annoteSchema("ThreadListLoadPhase", {
    description: "Exclusive load and content phase of the professional-desktop thread list.",
  })
);

type ThreadListLoadPhase = typeof ThreadListLoadPhase.Type;
```

Derive it from the existing upstream `AsyncResult`; do not store it:

```ts
const threadListLoadPhase: ThreadListLoadPhase = AsyncResult.match(threads, {
  onInitial: () => ThreadListLoadPhase.Enum.loading,
  onFailure: () => ThreadListLoadPhase.Enum.failed,
  onSuccess: ({ value }) =>
    A.isReadonlyArrayEmpty(value) ? ThreadListLoadPhase.Enum.empty : ThreadListLoadPhase.Enum.ready,
});
```

Replace the render guards with `ThreadListLoadPhase.is.failed(threadListLoadPhase)` and `ThreadListLoadPhase.is.empty(threadListLoadPhase)`. `sorted` remains the success-only sorted array used by the ready list.

## 5. Migration inventory

- `apps/professional-desktop/src/chat/ui/Sidebar.tsx:89` — remove the `loadFailed` write and derive `threadListLoadPhase` from `threads`.
- `apps/professional-desktop/src/chat/ui/Sidebar.tsx:90` — replace the comment-only flag ordering with the four named phases.
- `apps/professional-desktop/src/chat/ui/Sidebar.tsx:93` — remove the `isEmpty` coherence formula; emptiness is the successful empty phase.
- `apps/professional-desktop/src/chat/ui/Sidebar.tsx:117` — use the kit-derived `failed` guard.
- `apps/professional-desktop/src/chat/ui/Sidebar.tsx:127` — use the kit-derived `empty` guard.

No other source or test reads or writes `loadFailed` or `isEmpty` from this component.

## 6. Guard-deletion accounting

- `apps/professional-desktop/src/chat/ui/Sidebar.tsx:93` — delete `!isInitial && !loadFailed && sorted.length === 0`, the runtime coherence check that prevents the illegal combined-true state.
- `apps/professional-desktop/src/chat/ui/Sidebar.tsx:90` — delete the comment-only invariant that failure must not masquerade as empty and initial means neither flag; the literal names all cases.
- `apps/professional-desktop/src/chat/ui/Sidebar.tsx:117` and `:127` — delete the two independent boolean reads in favor of guards over one value.

There is no legacy normalizer or mutual-exclusion error.

## 7. Encoded-side impact

none (internal)

The phase is a render-local projection and is neither stored nor passed over a boundary.

## 8. Test impact

No test references either member or the `sidebar-load-failed`/`sidebar-empty` test ids. `apps/professional-desktop/test/App.test.tsx:13` only proves the sidebar mounts in an empty/loading environment. Add focused sidebar render cases for initial, failure, successful empty, and successful non-empty values; preserve the current “failure is not empty” assertion as one literal equality rather than two booleans.

## 9. Risk & sequencing

This is local to `Sidebar.tsx`. It shares the chat UI area with both thread-state designs but no symbols or files, so it can land in the same professional-desktop batch in any order. Preserve success sorting separately from phase derivation to avoid changing list order.
