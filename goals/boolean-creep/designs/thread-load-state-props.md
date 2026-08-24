## 1. Instance

- id: `thread-load-state-props`
- file:line: `apps/professional-desktop/src/chat/ui/Thread.tsx:142`
- symbol: `ThreadLoadState`
- members: `failed`, `loading`
- evidence classes:
  - E1 at `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:300` — Both flags are projected in one write from a single AsyncResult: failed=isFailure, loading=isInitial&&waiting — combined-true is unrepresentable.

## 2. Current shape

Live declaration and reads at `apps/professional-desktop/src/chat/ui/Thread.tsx:142`:

```tsx
const ThreadLoadState = ({ failed, loading }: { readonly failed: boolean; readonly loading: boolean }): JSX.Element => (
  <>
    {loading ? (
      <div className="text-sm text-muted-foreground" data-testid="thread-loading">
        Loading thread…
      </div>
    ) : null}
    {failed ? (
      <div className="text-sm text-destructive" data-testid="thread-error">
        Failed to load the thread — is the sidecar running?
      </div>
    ) : null}
  </>
);
```

The producer call at `apps/professional-desktop/src/chat/ui/Thread.tsx:250` is:

```tsx
<ThreadLoadState failed={view.failed} loading={view.loading} />
```

## 3. Cardinality gap

The two props represent four combinations, but the upstream load machine permits only three load-message states:

- `loading`: show the loading message.
- `failed`: show the failure message.
- `ready`: show no load message.

The paired atom design additionally has `empty`; for this component, `empty` intentionally behaves like `ready` because `EmptyThread` owns empty-transcript rendering. `loading && failed` is illegal.

## 4. Target schema

Reuse the exact `ThreadTranscriptLoadState` kit exported by `Thread.atoms.ts` for the paired `thread-transcript-load-state` design. Do not mint a second three-state kit:

```tsx
import { ThreadTranscriptLoadState } from "./Thread.atoms.ts";
import type { ThreadTranscriptLoadState as ThreadTranscriptLoadStateType } from "./Thread.atoms.ts";

const ThreadLoadState = ({
  loadState,
}: {
  readonly loadState: ThreadTranscriptLoadStateType;
}): JSX.Element | null =>
  ThreadTranscriptLoadState.$match(loadState, {
    loading: () => (
      <div className="text-sm text-muted-foreground" data-testid="thread-loading">
        Loading thread…
      </div>
    ),
    failed: () => (
      <div className="text-sm text-destructive" data-testid="thread-error">
        Failed to load the thread — is the sidecar running?
      </div>
    ),
    empty: thunkNull,
    ready: thunkNull,
  });
```

The call becomes:

```tsx
<ThreadLoadState loadState={view.loadState} />
<EmptyThread visible={ThreadTranscriptLoadState.is.empty(view.loadState)} />
```

`ThreadTranscriptLoadState` is the new literal kit and type named by the paired atom design: `loading | failed | empty | ready`.

## 5. Migration inventory

- `apps/professional-desktop/src/chat/ui/Thread.tsx:142` — replace the `failed`/`loading` prop type with one `loadState: ThreadTranscriptLoadState` prop.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:144` — replace the independent loading conditional with the `loading` match arm.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:149` — replace the independent failure conditional with the `failed` match arm.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:250` — pass `view.loadState` once.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:251` — keep empty rendering in `EmptyThread`, guarded from the same shared state.
- `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:228` and `:300` — paired producer migration supplies `loadState`; these changes are specified fully in `thread-transcript-load-state.md` but are repeated here because this document must land independently intelligibly.

No other source or test constructs `ThreadLoadState` props directly.

## 6. Guard-deletion accounting

- `apps/professional-desktop/src/chat/ui/Thread.tsx:144` and `:149` — delete two independent JSX conditionals whose combined-true behavior would render contradictory loading and failure messages; an exhaustive literal match renders at most one.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:250` — delete the call-site obligation to keep `failed` and `loading` coherent.

There is no legacy normalizer, explicit mutual-exclusion error, or comment-only invariant local to this component.

## 7. Encoded-side impact

none (internal)

These are private React props backed by an in-process atom view.

## 8. Test impact

- `apps/professional-desktop/test/optimistic-user-turn.test.tsx:443` — continue asserting that a failed timeline renders `thread-error`; this exercises the `failed` arm.
- `apps/professional-desktop/test/thread-transcript-view.test.ts:55` — add atom-state coverage for `loading`, `failed`, `empty`, and `ready`; the React component consumes exactly that state.
- No current test asserts `thread-loading`. Add a focused rendering assertion for the loading arm and a no-load-message assertion for both `empty` and `ready`.

## 9. Risk & sequencing

This must land with `thread-transcript-load-state`; otherwise either the call site or atom view will not typecheck. The shared kit belongs in `Thread.atoms.ts`, and `Thread.tsx` must import it rather than define a duplicate. Empty-state ownership stays with `EmptyThread`, preventing an unrelated UI reshuffle.
