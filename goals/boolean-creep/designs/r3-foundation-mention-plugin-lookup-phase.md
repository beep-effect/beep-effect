# Instance

- id: `r3-foundation-mention-plugin-lookup-phase`
- file:line: `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:540`
- symbol: `MentionPlugin`
- members: `pending`, `settled`, `failed`
- evidence classes:
  - E2 at `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:540-546,574-601` — `settled = !pending` gates both failure and success-options derivation before the render chain.

Reviewed against merged checkout `7440cb8c4302ce64b87860069a464bafbf65f576`
and main corpus `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`;
the owned editor source is unchanged from the earlier
`05405bf322da0ca7eb88b8bb402145081e8fded6` /
`be8995e66aeefedf0dabf131deaeaaf25c8e6fc8` review.

# Current shape

Live sibling declarations at `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:540`:

```ts
const pending = AsyncResult.isWaiting(lookupState);
const settled = !pending;
const options =
  settled && AsyncResult.isSuccess(lookupState)
    ? A.map(lookupState.value, (option) => new MentionMenuOption(option))
    : [];
const failed = settled && AsyncResult.isFailure(lookupState) && !AsyncResult.isInterrupted(lookupState);
```

# Cardinality gap

The full three-local cluster represents eight combinations. `settled` is the
complement of `pending`; `failed` implies `settled`. Only three tuples are
legal: waiting `(true,false,false)`, ready `(false,true,false)`, and failure
`(false,true,true)`. These are the same three display phases:

- `waiting`: `AsyncResult.isWaiting(lookupState)`.
- `failure`: a non-interrupted failure.
- `ready`: success, initial/empty, or interrupted state; options are present only when the upstream result is success.

`pending=true, failed=true` is illegal. The phase is a projection of `lookupState`, not new stored state.

# Target schema

Add a local `LiteralKit` and derive one phase on every render. The new kit/type is `MentionLookupPhase`.

```ts
import { LiteralKit } from "@beep/schema";

const MentionLookupPhase = LiteralKit(["waiting", "failure", "ready"]).pipe(
  $I.annoteSchema("MentionLookupPhase", {
    description: "Display phase projected from the mention lookup AsyncResult.",
  })
);
type MentionLookupPhase = typeof MentionLookupPhase.Type;

const lookupPhase: MentionLookupPhase = AsyncResult.isWaiting(lookupState)
  ? MentionLookupPhase.Enum.waiting
  : AsyncResult.isFailure(lookupState) && !AsyncResult.isInterrupted(lookupState)
    ? MentionLookupPhase.Enum.failure
    : MentionLookupPhase.Enum.ready;
const options = MentionLookupPhase.is.ready(lookupPhase) && AsyncResult.isSuccess(lookupState)
  ? A.map(lookupState.value, (option) => new MentionMenuOption(option))
  : [];
```

Keep the derivation inline so the existing `lookupState` supplies the precise `AsyncResult` parameters; do not use `any` or add stored phase state. Rendering uses `MentionLookupPhase.is.waiting(lookupPhase)` and `.is.failure(...)`.

The ready-phase guard on `options` is required for behavior preservation.
Effect's live `AsyncResult` model explicitly allows a `Success` value with
`waiting: true` during refresh
(`node_modules/effect/src/unstable/reactivity/AsyncResult.ts:49-54,230-258`).
The current `settled && AsyncResult.isSuccess` expression hides those stale
options while the new query is waiting. Testing `isSuccess` alone would show
the previous query's candidates under the new query and is therefore not an
equivalent simplification.

Keep `mentionLookupFn` at lines 130-166 as the sole async owner.
`Atom.fn` remains latest-write-wins, so a newer query interrupts its
predecessor. Keep `Atom.Reset` on a null query and on menu close at lines
548-553 and 609-612. Interrupted failures remain ready-with-no-notice; ordinary
source and decode failures remain the failure phase and retain their typed
`MentionLookupError` logging.

# Migration inventory

- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:21-22` — add `LiteralKit` to the schema imports; reuse the existing `$I = $EditorId.create("chat/typeahead")` at line 50 for annotation.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:540-546` — replace `pending`, `settled`, and `failed` with one derived `lookupPhase`; expose success options only in the ready phase so a waiting success does not reveal stale candidates.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:574-601` — branch on `lookupPhase` literal guards for waiting/failure notices, then render the option list for ready.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:377` and `:575-577` — update the notice and render-chain comments from parallel pending/failed booleans to the named lookup phases.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:130-166,548-554,609-612`
  — no semantic edit: preserve latest-write-wins interruption, source/decode
  errors, null-query reset, and close reset.

# Guard-deletion accounting

- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:540-546` — delete the `settled = !pending` coherence bridge and both `settled && ...` guards that prevent pending/failure or pending/success overlap.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:578-581` — delete the pending-then-failed boolean if-chain; literal guards identify the one projected phase.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:575-577` — delete the comment-only invariant that describes “pending and failed lookups” as parallel conditions.

# Encoded-side impact

none (internal)

# Test impact

No file under `packages/foundation/ui-system/editor/test/` reads `pending`,
`failed`, `settled`, or `lookupState` from `MentionPlugin`; existing
typeahead tests cover positioning and IDs. Add focused rendering coverage for:

- initial/reset ready with no options or notice;
- initial waiting and waiting-over-previous-success, both showing only the
  loading notice and never stale options;
- ordinary rejected and invalid-result lookups showing the failure notice;
- successful empty and nonempty results;
- query A superseded by query B, with A resolving or rejecting last: A never
  repaints candidates or failure;
- null query, Escape/menu close, and unmount interrupt/reset without rendering
  a failure notice.

For recorded browser QA, use the portless editor surface with a controllable
mention source. Drive real keyboard input: type `@a` and hold the source
pending; type the next character before resolving the first request; resolve
the old request then the new request and prove only the new candidates appear;
reject a subsequent request and verify the failure notice; retry successfully;
then press Escape and remove the trigger, proving the menu and notice clear
without a late failure flash. Record listbox/combobox ARIA ownership, keyboard
selection, inserted `@label` text, source call order, and zero unexpected
console errors. Complete record -> extract -> judge with `requiredCount: 0`.

# Risk & sequencing

The interrupted failure classification must remain `ready`, matching the
current `failed` predicate. A waiting success must remain visually waiting
with hidden previous options. The literal is derived each render from the
existing `AsyncResult`; never store it in another atom. This shares
`typeahead.tsx` with the menus-open option migration, so land the import and
callback edits together while keeping the two domains independent.
