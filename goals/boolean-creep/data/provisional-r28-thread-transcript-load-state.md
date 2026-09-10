# Provisional R28 transcript view correction

P2 draft for existing `thread-transcript-load-state`, source HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`, main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. The actual owner is
`ThreadTranscriptView` in `apps/professional-desktop/src/chat/ui/Thread.atoms.ts`.
Proposed members: `empty`, `failed`, `loading`, `streaming`; **16/7**;
derived/internal/tagged-union/Tier 1. This corrects the current design's count
while retaining its payload-aware intent. It is not canonical or independently
reviewed. Source adjudication and hashes are in
`data/design-refresh-2026-09-09-r28-apps-carriers.md`.

## Current shape

`Thread.atoms.ts:253-261` declares three Boolean flags, an actual
`Option<StreamingTurn>`, required timeline/unreconciled arrays, and a sibling-id
HashSet. The sole writer at `280-335` filters the global stream by thread,
keeps receipt fallbacks across successful timeline reads, obtains current or
previous-success timeline content, applies active-branch projection and local
edit truncation, and constructs all flags together at `326-332`.

`Thread.tsx:237,252-265` is the sole source reader. It renders the load message,
empty placeholder, complete timeline turns with sibling markers, unreconciled
turns and the optional streaming turn. It also reads independent global
activity for `StreamingTurnView`; that Option/Boolean pair is D1 and remains
unchanged. `ThreadLoadState` is a separate existing qualified 4/3 props owner,
which must migrate atomically with this view.

The comment at `Thread.atoms.ts:250-252` explicitly keeps the hot-path view
as an interface because payloads are already schema validated upstream.
Preserve that local representation constraint rather than revalidating all
documents/blocks through class constructors on every stream block.

## Cardinality gap

Count the three real Booleans and the two presence cases of the actual stream
Option: 16 representable tuples, seven supported tuples. Do not count the two
required arrays as invented empty/nonempty Boolean axes.

| Discriminator | Streaming Option | Number of finite tuples | Payload constraints retained |
| --- | --- | ---: | --- |
| `empty` | None | 1 | Both arrays empty; timeline Success. |
| `failed` | None or Some | 2 | Preserve previous-success turns and current local payloads. |
| `loading` | None or Some | 2 | Timeline turns empty; retain unreconciled array and stream. |
| `ready` | None or Some | 2 | Arrays may be empty or populated; no nonempty requirement. |

E1 is at `326-327`: Failure and Initial-waiting cannot coincide. E4 is at
`328-332`: Empty requires Success and stream None. The three flags are
exclusive. Required-array emptiness remains a payload refinement, although
it contributes no extra cardinality axis.

Ready includes Initial with waiting false and no content. Success while
waiting may still be Empty. Failure may retain previous Success content;
Loading cannot obtain timeline turns because local Effect v4
`AsyncResult.value(Initial)` is None (`AsyncResult.ts:416-422`). Stream and
unreconciled input atoms remain independent of timeline loading/failure.
The existing `64/21` matrix is invalid as a census count; the raw apps `8/4`
replacement is incomplete because it discards the real Option implication.

## Target schema

Retain one named, annotated LiteralKit for the discriminator, shared with
the app's load-message component. Use the existing Professional Desktop
identity composer and the existing `@beep/schema/LiteralKit` surface. The
literal vocabulary remains `loading`, `failed`, `empty`, `ready`; no second
UI-only enum or streaming-activity state is added.

```ts
export const ThreadTranscriptLoadState = LiteralKit([
  "loading", "failed", "empty", "ready",
]).pipe(
  $I.annoteSchema("ThreadTranscriptLoadState", {
    description: "Load and content state of the rendered thread transcript.",
  }),
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

The private structural union honors the existing hot-path exception. LiteralKit
owns its finite vocabulary and derived guards; upstream schema classes still
own every payload. Renderable does not mean populated. Do not require Some or
nonempty arrays on either failed or ready.

Replace the final object write within the existing return-typed atom with
ordered construction. The content computation before it remains exact:

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
  return { ...transcript, loadState: ThreadTranscriptLoadState.Enum.loading, turns: [] };
}
if (
  A.isReadonlyArrayEmpty(turns) &&
  A.isReadonlyArrayEmpty(displayedUnreconciled) &&
  AsyncResult.isSuccess(timeline) &&
  O.isNone(streaming)
) {
  return {
    loadState: ThreadTranscriptLoadState.Enum.empty,
    siblingTurnIds,
    turns,
    unreconciled: displayedUnreconciled,
    streaming,
  };
}
return { ...transcript, loadState: ThreadTranscriptLoadState.Enum.ready };
```

The Loading branch's contextual empty tuple expresses the already-proved
Initial payload constraint; no populated timeline is discarded. Do not assign
an unconstrained `A.empty<TimelineTurn>()` result to `readonly []` through a
cast. The Empty branch writes the directly narrowed variables after the
guards, rather than spreading a common object created before narrowing and
assuming its property types also narrowed. Effect's existing
`A.isReadonlyArrayEmpty` and `O.isNone` guards supply the required narrowing.
No new runtime throw, normalizer or codec is needed.

## Migration inventory

| Owner / consumer | Required change or preserved contract |
| --- | --- |
| `Thread.atoms.ts:8-28,241-261` | Add the existing identity/LiteralKit imports and app-local load kit; replace the flag interface with the payload-aware union. Keep upstream payload imports and hot-path rationale. |
| `Thread.atoms.ts:280-335` | Preserve thread filtering285, receipt filtering289-291, previous content292-295, active branch296, earliest edit truncation298-319 and sibling set320. Replace only the final three-flag construction with the ordered union. |
| `Thread.atoms.ts:164-179,226-239` | Preserve reconciliation side effects and the independent sibling scan. A stream block must not begin recomputing the quadratic sibling scan. |
| `Thread.tsx:41-48` | Import the app-local discriminator and derived type for consumers. No package/public barrel export. |
| `ThreadLoadState`, `Thread.tsx:144-157` | Replace failed/loading props with the shared loadState. Exhaustively match loading/error to their existing messages and empty/ready to null. This is the existing 4/3 qualified consumer, not an additional case. |
| `Thread.tsx:252-253` | Pass `view.loadState`; derive the unchanged `EmptyThread.visible` at the read with the kit's empty guard. The one-Boolean EmptyThread remains a migration companion. |
| `Thread.tsx:255-265` | Render every payload field exactly as before, including order, sibling lookup, unreconciled user/assistant content and full optional stream. Keep independent global turnActive and the existing StreamingTurnView D1 contract. |
| `test/thread-transcript-view.test.ts:55-124` | Replace old flag assertions with phase and payload assertions; add the seven finite phase/Option cases through input atoms, not fabricated output objects. |
| `test/optimistic-user-turn.test.tsx:299-342,386-490` | Keep user echo, one Stop control, receipt/fallback retention, failure with previous content and edit truncation fixtures. Add targeted phase rendering checks where absent. |

The only source view constructor/consumer and existing fixture consumers were
found by graft followed by an all-source targeted search. `@beep/agents-client`
exports the upstream atoms/schema (`src/index.ts:28`); those package exports
and constructors remain unchanged. The timeline RPC and `ThreadTimeline`
schema are upstream contracts, not migration targets.

## Guard-deletion accounting

Delete three independent Boolean members/writes at `Thread.atoms.ts:254-256`
and `326-332`, replacing them with one discriminator. Delete independent
`view.failed`, `view.loading` and `view.empty` reads at `Thread.tsx:252-253`.
Delete the two independent load-message JSX conditionals at `146-155` in
favor of one exhaustive match that can render at most one message.

The union removes the caller obligation to keep Empty consistent with None
and empty arrays, and Loading consistent with absent timeline turns. It does
not remove the classifier's actual Success/Initial/Failure, array-emptiness
or Option checks; those are necessary construction policy. Do not count them
as deleted runtime guards. There is no existing mutual-exclusion throw or
compatibility decoder to delete. Keep all reconciliation, parent-resolution,
truncation, item/value and streaming-block guards.

## Encoded-side impact

The view is an in-process derived atom result and private React contract.
No JSON, RPC, persistence schema, desktop command or public upstream atom
changes. Preserve the complete StreamingTurn schema payload: thread id,
optional request id, user document, optional truncate-from, both reconciliation
literals/default, and all assistant blocks. Preserve every TimelineTurn id,
parent, item, order and cost, plus the sibling HashSet and unreconciled order.

Visible messages, loading/error/empty test ids, user echo, local completed
fallbacks, Thinking versus completed-refresh text, canonical Stop placement,
scroll behavior and edit truncation remain exact. Failure may render retained
content beside its error message; a waiting Success may render Empty; an
Initial-not-waiting ready state may render no content and no Empty message.
Do not turn these into errors or new payload requirements.

## Test impact

This design-only task runs no product tests. At implementation, test the seven
actual finite cases using timeline AsyncResults plus independent stream and
unreconciled input atoms. Use full typed documents/turns and assert payload
identity/content preservation as appropriate. Do not describe an array
empty/nonempty test grid as additional census states.

Explicit regressions should cover Initial waiting and not waiting; Success
while waiting with no content; Failure with previous Success; own-thread and
other-thread streams; receipt fallbacks surviving Success; earliest edit
truncation; and populated versus empty arrays within legal failed/ready
payloads. Those array cases are required behavioral tests despite not being
finite census axes. Preserve the fixture at `optimistic-user-turn.test.tsx:444-461`
that shows retained completed content and error without a stuck Stop button.

The paired `ThreadLoadState` migration must cover loading, failed, and no load
message for both empty/ready. No duplicate rendering test suite is needed for
its smaller projection. The eventual package/app handoff and recorded
gesture-bearing thread QA follow the repo workflow; no browser/service or
package command is executed during this P2 draft.

## Risk

The main risk is mistaking “not counted as a Boolean axis” for permission to
discard payload invariants. Empty still requires None and empty arrays;
Loading still requires empty timeline turns. Conversely, failed/ready must
not lose previous content or gain nonempty requirements. Cross-thread stream
filtering and global activity deliberately remain independent.

The second risk is TypeScript narrowing in the illustrative constructor:
keep the contextual Loading empty tuple and direct narrowed Empty properties,
without casts or new runtime validation. No advanced codec APIs are proposed.
The existing hot-path interface decision remains binding for this local view.

Land the view and `thread-load-state-props` together after independent
correction/review. The downstream load props keep 4/3; no new streaming-view
union, no array-derived inventory members and no out-of-net display owner
is authorized by this design. All source hashes and constructor evidence are
recorded in the apps audit; this provisional file does not itself prove
canonical admission or implementation correctness.
