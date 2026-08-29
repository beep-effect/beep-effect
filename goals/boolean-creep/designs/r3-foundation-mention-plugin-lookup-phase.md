# Instance

- id: `r3-foundation-mention-plugin-lookup-phase`
- file:line: `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:521`
- symbol: `MentionPlugin`
- members: `pending`, `failed`
- evidence classes:
  - E2 at `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:559` — menuRenderFn branches pending then failed then the success list; failed is defined as settled && isFailure so both-true is unrepresentable in the if-chain.

# Current shape

Live sibling declarations at `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:521`:

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

The two exposed booleans represent four combinations. Three display phases are legal:

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
const options = AsyncResult.isSuccess(lookupState)
  ? A.map(lookupState.value, (option) => new MentionMenuOption(option))
  : [];
```

Keep the derivation inline so the existing `lookupState` supplies the precise `AsyncResult` parameters; do not use `any` or add stored phase state. Rendering uses `MentionLookupPhase.is.waiting(lookupPhase)` and `.is.failure(...)`.

# Migration inventory

- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:21-22` — add `LiteralKit` to the schema imports; reuse the existing `$I = $EditorId.create("chat/typeahead")` at line 50 for annotation.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:521-527` — replace `pending`, `settled`, and `failed` with one derived `lookupPhase`; derive `options` directly from `AsyncResult.isSuccess(lookupState)`.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:555-562` — branch on `lookupPhase` literal guards for waiting/failure notices, then render the option list for ready.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:358` and `:556-558` — update comments from parallel pending/failed booleans to the named lookup phases.

# Guard-deletion accounting

- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:521-527` — delete the `settled = !pending` coherence bridge and both `settled && ...` guards that prevent pending/failure or pending/success overlap.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:559-562` — delete the pending-then-failed boolean if-chain; literal guards identify the one projected phase.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:556-558` — delete the comment-only invariant that describes “pending and failed lookups” as parallel conditions.

# Encoded-side impact

none (internal)

# Test impact

No file under `packages/foundation/ui-system/editor/test/` reads `pending`, `failed`, `settled`, or `lookupState` from `MentionPlugin`; existing typeahead tests cover only positioning and IDs. Add focused rendering coverage for waiting notice, non-interrupted failure notice, success options, and interrupted/initial ready-with-empty-options behavior.

# Risk & sequencing

The interrupted failure classification must remain `ready`, matching the current `failed` predicate. The literal is derived each render from the existing `AsyncResult`; never store it in another atom. This shares `typeahead.tsx` with the menus-open option migration, so sequence or combine the edits to avoid import and callback conflicts while keeping the two schemas independent.
