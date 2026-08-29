## 1. Instance

- id: `thread-transcript-load-state`
- file:line: `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:228`
- symbol: `ThreadTranscriptView`
- members: `empty`, `failed`, `loading`
- evidence classes:
  - E1 at `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:300` — All three flags are projected in one write from the single timeline AsyncResult (isFailure/isInitial/success emptiness).

## 2. Current shape

Live declaration at `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:227`:

```ts
interface ThreadTranscriptView {
  readonly empty: boolean;
  readonly failed: boolean;
  readonly loading: boolean;
  readonly siblingTurnIds: HashSet.HashSet<WorkspaceIdentity.TurnId>;
  readonly streaming: O.Option<StreamingTurn>;
  readonly turns: ReadonlyArray<ThreadUseCases.TimelineTurn>;
  readonly unreconciled: ReadonlyArray<StreamingTurn>;
}
```

The current projection at `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:295` is:

```ts
return {
  turns,
  unreconciled: displayedUnreconciled,
  streaming,
  siblingTurnIds,
  failed: AsyncResult.isFailure(timeline),
  loading: AsyncResult.isInitial(timeline) && timeline.waiting,
  empty:
    A.isReadonlyArrayEmpty(turns) &&
    A.isReadonlyArrayEmpty(displayedUnreconciled) &&
    AsyncResult.isSuccess(timeline) &&
    O.isNone(streaming),
};
```

## 3. Cardinality gap

Three booleans represent eight combinations, but only four are legal:

- `loading`: the timeline is initial and waiting.
- `failed`: the timeline is failed.
- `empty`: the timeline succeeded and there are no persisted, unreconciled, or streaming turns.
- `ready`: every other renderable transcript state, including a non-empty successful timeline and retained content during refresh/failure behavior.

No pair among `loading`, `failed`, and `empty` may be true together.

## 4. Target schema

This is the shared literal design for this instance and `thread-load-state-props`. Add the local identity composer and `LiteralKit` imports to `Thread.atoms.ts`, then export both the kit and its derived type for `Thread.tsx`:

```ts
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $ProfessionalDesktopId.create("chat/ui/Thread.atoms");

export const ThreadTranscriptLoadState = LiteralKit(["loading", "failed", "empty", "ready"]).pipe(
  $I.annoteSchema("ThreadTranscriptLoadState", {
    description: "Exclusive loading and content state of the rendered thread transcript.",
  })
);

export type ThreadTranscriptLoadState = typeof ThreadTranscriptLoadState.Type;

interface ThreadTranscriptView {
  readonly loadState: ThreadTranscriptLoadState;
  readonly siblingTurnIds: HashSet.HashSet<WorkspaceIdentity.TurnId>;
  readonly streaming: O.Option<StreamingTurn>;
  readonly turns: ReadonlyArray<ThreadUseCases.TimelineTurn>;
  readonly unreconciled: ReadonlyArray<StreamingTurn>;
}
```

Keep the state derived from `timeline` and the already-derived visible content:

```ts
const loadState = AsyncResult.isFailure(timeline)
  ? ThreadTranscriptLoadState.Enum.failed
  : AsyncResult.isInitial(timeline) && timeline.waiting
    ? ThreadTranscriptLoadState.Enum.loading
    : AsyncResult.isSuccess(timeline) &&
        A.isReadonlyArrayEmpty(turns) &&
        A.isReadonlyArrayEmpty(displayedUnreconciled) &&
        O.isNone(streaming)
      ? ThreadTranscriptLoadState.Enum.empty
      : ThreadTranscriptLoadState.Enum.ready;

return {
  turns,
  unreconciled: displayedUnreconciled,
  streaming,
  siblingTurnIds,
  loadState,
};
```

The ordering preserves current behavior: failure wins over retained/empty content, loading is only initial-and-waiting, and empty requires success.

## 5. Migration inventory

- `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:219` — change “timeline load flags” to the single transcript load state.
- `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:228` — replace the three boolean members with `loadState: ThreadTranscriptLoadState`.
- `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:300` — replace all three writes with one ordered `loadState` projection.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:250` — pass `view.loadState` to `ThreadLoadState` instead of passing `view.failed` and `view.loading` separately.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:251` — derive `EmptyThread.visible` with `ThreadTranscriptLoadState.is.empty(view.loadState)`; do not move empty rendering into `ThreadLoadState`.
- `apps/professional-desktop/test/thread-transcript-view.test.ts:60` — replace `view.empty` with an assertion that `view.loadState` is `ready` for the populated success fixture.
- `apps/professional-desktop/test/thread-transcript-view.test.ts:61` — remove the redundant independent `view.failed` assertion; the same `ready` equality proves it is neither failed nor loading.

No other repository site reads or writes these `ThreadTranscriptView` members.

## 6. Guard-deletion accounting

- `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:300` — delete the three independent flag assignments and their implicit mutual-exclusion contract; one ordered literal projection owns the classification.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:250` — delete the downstream two-boolean prop pairing that could render loading and failure together.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:251` — delete the independent `empty` flag read and derive it from the same literal.
- `apps/professional-desktop/test/thread-transcript-view.test.ts:60` — delete test-by-test coherence checks across separate booleans; assert one legal state instead.

There is no legacy normalizer or explicit mutual-exclusion error.

## 7. Encoded-side impact

none (internal)

The view is recomputed by an atom and consumed in-process by React; it is not a codec, wire payload, or persisted record.

## 8. Test impact

- `apps/professional-desktop/test/thread-transcript-view.test.ts:55` — update existing view assertions to `loadState` and add cases for initial-waiting, failure, and successful emptiness so all four literals are covered.
- `apps/professional-desktop/test/optimistic-user-turn.test.tsx:443` — the retained-content-on-failure scenario must continue to render `thread-error`; it guards the failure-first ordering in the projection.

## 9. Risk & sequencing

Land this design in the same change as `thread-load-state-props`: `Thread.tsx` consumes the atom view directly, and both must use the one exported `ThreadTranscriptLoadState` kit. Define the kit in `Thread.atoms.ts`; do not create a second UI-only load-phase literal in `Thread.tsx`.
