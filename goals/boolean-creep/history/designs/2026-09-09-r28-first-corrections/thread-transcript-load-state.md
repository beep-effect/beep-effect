# Instance

- id: `thread-transcript-load-state`
- file:line: `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:253`
- symbol: `ThreadTranscriptView`
- correlated members: `empty`, `failed`, `loading`, and presence of
  `streaming`, `turns`, and `unreconciled`
- evidence:
  - E1 at `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:326-332` — the sole view writer projects all three booleans together.
  - E4 at `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:292-295,326-332`
    — `empty` explicitly requires all three content carriers absent, while
    `loading` requires Initial and therefore cannot obtain timeline turns from
    `AsyncResult.value`.

Reviewed against checkout `7440cb8c4302ce64b87860069a464bafbf65f576`
and the identical apps/packages corpus on main
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`. This is design preparation;
replacement independent P3 review remains pending.

# Current shape

`ThreadTranscriptView` is a private hot-path render model with three boolean
members, an `Option<StreamingTurn>`, persisted timeline turns, displayed
unreconciled turns, and sibling ids. Its sole writer first filters the global
streaming turn to this thread, filters unreconciled turns according to timeline
success, applies edit truncation, and then writes:

```ts
failed: AsyncResult.isFailure(timeline),
loading: AsyncResult.isInitial(timeline) && timeline.waiting,
empty:
  A.isReadonlyArrayEmpty(turns) &&
  A.isReadonlyArrayEmpty(displayedUnreconciled) &&
  AsyncResult.isSuccess(timeline) &&
  O.isNone(streaming),
```

`Thread.tsx:252-265` reads every member: it renders the load message, empty
state, retained timeline and unreconciled turns, and the active streaming turn.
No other repository source constructs or consumes `ThreadTranscriptView`.

# Cardinality gap

Across the three booleans and presence of the three content carriers, 64
coarse tuples are representable and 21 are legal:

| state | legal content-presence tuples | count |
| --- | --- | ---: |
| `empty` | turns absent, unreconciled absent, stream absent | 1 |
| `failed` | every turns/unreconciled/stream presence tuple | 8 |
| `loading` | turns absent; unreconciled and stream independently absent/present | 4 |
| `ready` | every turns/unreconciled/stream presence tuple | 8 |

`empty`, `failed`, and `loading` are mutually exclusive. `empty` additionally
requires a successful timeline and all three content carriers absent. Loading
is Initial with `waiting=true`; `AsyncResult.value(Initial)` is `None`, so its
projected `turns` must be empty. Its displayed unreconciled array and
thread-filtered stream remain independent. Failure can recover previous
timeline turns, and failed/ready admit every coarse content tuple.

The `ready` case deliberately permits all three content carriers to be empty.
An initial timeline that is not waiting is ready, rather than empty. A success
marked waiting can be empty when all content carriers are empty. A failure can
retain turns through `AsyncResult.value`; failure still wins while preserving
those turns.

# Target schema

Define the discriminator with a named, annotated `LiteralKit`, then make the
private hot-path view a discriminated union. The existing comment against an
`S.Class` remains valid: this atom rederives already-validated payload on every
stream block, and class construction would add hot-path work. LiteralKit owns
the finite vocabulary and supplies all guards.

```ts
export const ThreadTranscriptLoadState = LiteralKit(["loading", "failed", "empty", "ready"]).pipe(
  $I.annoteSchema("ThreadTranscriptLoadState", {
    description: "Load and content state of the rendered thread transcript.",
  })
);
export type ThreadTranscriptLoadState = typeof ThreadTranscriptLoadState.Type;

interface ThreadTranscriptViewBase {
  readonly siblingTurnIds: HashSet.HashSet<WorkspaceIdentity.TurnId>;
}

interface EmptyThreadTranscriptView extends ThreadTranscriptViewBase {
  readonly loadState: typeof ThreadTranscriptLoadState.Enum.empty;
  readonly streaming: O.None<StreamingTurn>;
  readonly turns: readonly [];
  readonly unreconciled: readonly [];
}

interface LoadingThreadTranscriptView extends ThreadTranscriptViewBase {
  readonly loadState: typeof ThreadTranscriptLoadState.Enum.loading;
  readonly streaming: O.Option<StreamingTurn>;
  readonly turns: readonly [];
  readonly unreconciled: ReadonlyArray<StreamingTurn>;
}

interface RenderableThreadTranscriptView extends ThreadTranscriptViewBase {
  readonly loadState: Exclude<
    ThreadTranscriptLoadState,
    typeof ThreadTranscriptLoadState.Enum.empty | typeof ThreadTranscriptLoadState.Enum.loading
  >;
  readonly streaming: O.Option<StreamingTurn>;
  readonly turns: ReadonlyArray<ThreadUseCases.TimelineTurn>;
  readonly unreconciled: ReadonlyArray<StreamingTurn>;
}

type ThreadTranscriptView =
  | EmptyThreadTranscriptView
  | LoadingThreadTranscriptView
  | RenderableThreadTranscriptView;
```

`RenderableThreadTranscriptView` does not mean nonempty. It intentionally
admits empty arrays and `None` for initial-not-waiting ready state. The empty
case narrows all three carriers; loading narrows only timeline turns. Derive
the member once, in the current behavioral order:

```ts
const transcript = {
  turns,
  unreconciled: displayedUnreconciled,
  streaming,
  siblingTurnIds,
};

if (AsyncResult.isFailure(timeline)) {
  return { ...transcript, loadState: ThreadTranscriptLoadState.Enum.failed };
}
if (AsyncResult.isInitial(timeline) && timeline.waiting) {
  return {
    ...transcript,
    turns: A.empty<ThreadUseCases.TimelineTurn>(),
    loadState: ThreadTranscriptLoadState.Enum.loading,
  };
}
if (
  A.isReadonlyArrayEmpty(turns) &&
  A.isReadonlyArrayEmpty(displayedUnreconciled) &&
  AsyncResult.isSuccess(timeline) &&
  O.isNone(streaming)
) {
  return { ...transcript, loadState: ThreadTranscriptLoadState.Enum.empty };
}
return { ...transcript, loadState: ThreadTranscriptLoadState.Enum.ready };
```

The Effect array and Option guards narrow the empty branch to the exact payload
types. The loading branch supplies an empty timeline array because the live
`AsyncResult.value(Initial)` projection already produced no turns; it does not
discard content. Do not coerce, discard, or require nonempty payload elsewhere.

# Migration inventory

- `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:8-39` — add the
  existing Professional Desktop identity composer and the narrow
  `@beep/schema/LiteralKit` import.
- `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:241-261` — replace the
  flag-oriented prose and interface with the kit, common fields, and the three
  payload-aware union members above.
- `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:280-334` — keep thread
  filtering, reconciliation filtering, active-branch truncation, sibling ids,
  and arrays unchanged; replace the three writes with the ordered union
  construction.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:41-48` — import the exported
  kit for schema-derived guards and matching.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:252-265` — pass
  `view.loadState` to `ThreadLoadState`, derive `EmptyThread.visible` from the
  kit's empty guard, and continue rendering every payload field exactly where
  it is currently rendered.
- `apps/professional-desktop/test/thread-transcript-view.test.ts:55-116` —
  replace boolean assertions and add the full phase/content matrix below.
- `apps/professional-desktop/test/optimistic-user-turn.test.tsx:444-490` — keep
  the failure-with-retained-content and edited-fallback reconciliation
  assertions; they prove payload is not narrowed outside empty.

# Guard-deletion accounting

- Delete the three independent boolean members and writes at
  `Thread.atoms.ts:254-256,326-332`.
- Delete the implicit cross-field obligations that `empty` must agree with all
  three content carriers and loading must agree with absent timeline turns;
  the union members carry those exact payload constraints.
- Delete the separate `view.empty`, `view.failed`, and `view.loading` reads at
  `Thread.tsx:252-253`; one discriminator supplies both load-message and empty
  rendering.
- Delete tests that prove coherence by comparing individual booleans. Assert
  the exact union member and its payload instead.

# Encoded-side impact

None. This private view is recomputed in-process by an atom and consumed by
React. It is not persisted, encoded, or sent over RPC.

# Test impact

Add a table covering all 21 coarse tuples: the one empty tuple; all eight
failed payload-presence tuples; all four loading tuples with turns absent; and
all eight ready tuples. Construct representative AsyncResults and independent
unreconciled/stream atoms rather than manufacturing view values. Explicitly
cover initial-not-waiting ready with all carriers absent, success-while-waiting
empty, failure with previous turns, a stream for another thread, and edit
truncation. Assert tag and payload preservation separately.

Keep the existing component regression at
`optimistic-user-turn.test.tsx:444-490`: a refresh failure still renders
retained content and `thread-error`, without Stop. Add focused component
assertions for `thread-loading`, `thread-empty`, ready-with-no-empty-message,
and active streaming content.

Because the thread is gesture-bearing, record the portless load, failure,
empty, populated, and streaming transitions with real navigation. Complete
record, extract, and judge with `requiredCount: 0`; include console health and
verify retained content does not blink away during refresh/failure.

# Risk and sequencing

Land atom and React consumers atomically with `thread-load-state-props`. The
material risk is over-narrowing content. Empty owns three absent carriers;
loading owns absent timeline turns while retaining arbitrary unreconciled and
stream payload; failed and ready retain every current payload combination.
