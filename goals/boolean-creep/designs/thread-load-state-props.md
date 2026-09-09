# Instance

- id: `thread-load-state-props`
- file:line: `apps/professional-desktop/src/chat/ui/Thread.tsx:144`
- symbol: `ThreadLoadState`
- members: `failed`, `loading`
- evidence: E1 at `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:326-327`
  — both props come from the sole transcript writer, where failure and
  initial-waiting are disjoint AsyncResult cases.

Reviewed against checkout `7440cb8c4302ce64b87860069a464bafbf65f576`
and the identical apps/packages corpus on main
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`. This is design preparation;
replacement independent P3 review remains pending.

# Current shape

`ThreadLoadState` accepts independent `failed` and `loading` booleans. It has
two independent JSX conditionals, so the structurally allowed combined-true
input renders contradictory messages. The sole call at `Thread.tsx:252` passes
the paired values from `ThreadTranscriptView`.

# Cardinality gap

Four prop pairs are representable and three are legal: loading, failed, and no
load message. Upstream `empty` and `ready` both map to no load message. Combined
loading and failed is unreachable from the atom writer.

# Target schema

Reuse the exact `ThreadTranscriptLoadState` LiteralKit exported by
`Thread.atoms.ts`; do not create a second UI-only vocabulary. The paired
transcript design now uses that literal as the discriminator of a payload-aware
view union, but its four literal values remain `loading | failed | empty |
ready`.

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

The call remains adjacent to empty rendering:

```tsx
<ThreadLoadState loadState={view.loadState} />
<EmptyThread visible={ThreadTranscriptLoadState.is.empty(view.loadState)} />
```

This component consumes only the phase discriminator. Transcript arrays and
streaming payload remain owned and rendered by `Thread`; no payload narrowing
is introduced here.

# Migration inventory

- `apps/professional-desktop/src/chat/ui/Thread.tsx:144-157` — replace the two
  boolean props and conditionals with one exhaustive kit match.
- `apps/professional-desktop/src/chat/ui/Thread.tsx:252-253` — pass the one
  discriminator and derive the existing `EmptyThread` visibility from it.
- `apps/professional-desktop/src/chat/ui/Thread.atoms.ts:241-334` — the paired
  `thread-transcript-load-state` migration defines and writes the shared
  discriminator; its payload-aware union must land in the same change.
- `apps/professional-desktop/test/optimistic-user-turn.test.tsx:444-490` — keep
  failure rendering with retained content.
- `apps/professional-desktop/test/thread-transcript-view.test.ts:55-116` —
  update the producer assertions as specified by the paired design.

No source or test constructs `ThreadLoadState` props directly.

# Guard-deletion accounting

- Delete both independent JSX conditionals at `Thread.tsx:146-155`; exhaustive
  matching renders at most one message.
- Delete the call-site obligation to keep `failed` and `loading` coherent at
  `Thread.tsx:252`.
- Delete duplicate flag assertions in favor of the one discriminator produced
  by the atom.

# Encoded-side impact

None. These private React props are backed by an in-process atom view.

# Test impact

Cover the loading arm, failure arm, and no-message behavior for both empty and
ready. Retain the existing failure-with-content assertion at
`optimistic-user-turn.test.tsx:461`. The atom-level tests in the paired design
cover the larger seven-tuple transcript contract.

The recorded portless transcript QA required by the paired design also proves
the loading/error component behavior; do not create a second recording for
this prop-only instance.

# Risk and sequencing

Land with `thread-transcript-load-state`. The shared kit belongs in
`Thread.atoms.ts`. Empty-state UI remains in `EmptyThread`; this migration does
not rearrange rendering, messages, content retention, scrolling, or streaming.
