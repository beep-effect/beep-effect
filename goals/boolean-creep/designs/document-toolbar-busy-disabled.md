# Instance

- id: `document-toolbar-busy-disabled`
- file:line: `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:74`
- symbol: `documentToolbarState`
- members: `openBusy`, `openDisabled`, `saveBusy`, `saveDisabled`, `previewBusy`, `previewDisabled`
- evidence classes:
  - E4 — `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:84`: `saveBusy` is `input.saving` while `saveDisabled` at line 86 is `!sessionOpen || saving`, so busy implies disabled; preview repeats the implication at lines 87 and 89.
  - E4 — `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:81`: `openBusy` and `openDisabled` at line 83 are both assigned `input.opening`, so busy-without-disabled is never constructed.

# Current shape

Live declaration at `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:74`:

```ts
export const documentToolbarState = (input: {
  readonly opening: boolean;
  readonly saving: boolean;
  readonly previewing: boolean;
  readonly sessionOpen: boolean;
  readonly dirty: boolean;
}) => ({
  openBusy: input.opening,
  openLabel: input.opening ? "Opening…" : "Open",
  openDisabled: input.opening,
  saveBusy: input.saving,
  saveLabel: input.saving ? "Saving…" : "Save",
  saveDisabled: !input.sessionOpen || input.saving,
  previewBusy: input.previewing,
  previewLabel: input.previewing ? "Previewing…" : "Preview",
  previewDisabled: !input.sessionOpen || input.previewing,
  badge: documentBadge(input.sessionOpen, input.dirty),
  sessionHint: input.sessionOpen ? undefined : "Open a document first",
});
```

# Cardinality gap

The six output booleans represent 64 combinations. The three actions are independent of one another, but each action has a smaller legal phase domain:

- open: `enabled` or `busy` (two states); it has no session prerequisite.
- save: `enabled`, `disabled`, or `busy` (three states).
- preview: `enabled`, `disabled`, or `busy` (three states).

The save and preview phases share the same `sessionOpen` prerequisite, so the
nominal 2 × 3 × 3 product overcounts unreachable mixtures: save cannot be
`enabled` while preview is merely `disabled`, and preview cannot be `enabled`
while save is merely `disabled`. When both are `busy`, the two values of
`sessionOpen` also project to the same output. The live four input booleans
therefore produce 14 distinct toolbar phase triples. In every action, `busy`
means disabled against re-entry; save and preview use `disabled` only when no
session is open and the action is not already busy.

# Target schema

No matching action-phase literal exists nearby. Add one payload-free `LiteralKit` and return one phase per action. The current input booleans are upstream `AsyncResult`/session observations and remain function inputs; the refactor must not invent new stored state.

```ts
import { $OntologyUiId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema"

const $I = $OntologyUiId.create("aggregates/Session/Session.document")

export const DocumentToolbarActionState = LiteralKit(["enabled", "disabled", "busy"]).pipe(
  $I.annoteSchema("DocumentToolbarActionState", {
    description: "Presentation state of one ontology document toolbar action.",
  })
)
export type DocumentToolbarActionState = typeof DocumentToolbarActionState.Type

const sessionActionState = (busy: boolean, sessionOpen: boolean): DocumentToolbarActionState =>
  busy
    ? DocumentToolbarActionState.Enum.busy
    : sessionOpen
      ? DocumentToolbarActionState.Enum.enabled
      : DocumentToolbarActionState.Enum.disabled

export const documentToolbarState = (input: {
  readonly opening: boolean
  readonly saving: boolean
  readonly previewing: boolean
  readonly sessionOpen: boolean
  readonly dirty: boolean
}) => ({
  open: input.opening ? DocumentToolbarActionState.Enum.busy : DocumentToolbarActionState.Enum.enabled,
  save: sessionActionState(input.saving, input.sessionOpen),
  preview: sessionActionState(input.previewing, input.sessionOpen),
  badge: documentBadge(input.sessionOpen, input.dirty),
  sessionHint: input.sessionOpen ? undefined : "Open a document first",
})
```

Derive presentation directly from the kit at the JSX boundary:

```ts
const actionBusy = DocumentToolbarActionState.is.busy
const actionDisabled = (state: DocumentToolbarActionState): boolean =>
  !DocumentToolbarActionState.is.enabled(state)

aria-busy={actionBusy(toolbar.open)}
disabled={actionDisabled(toolbar.open)}
{DocumentToolbarActionState.$match(toolbar.open, {
  enabled: () => "Open",
  disabled: () => "Open",
  busy: () => "Opening…",
})}
```

Use the same exhaustive match for save/preview labels (their disabled labels equal their enabled labels). These are derived UI answers, not members of the returned state object.

# Migration inventory

- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:27-43` — import `LiteralKit` and `$OntologyUiId`, then create the file-local `$I` composer so the exported kit has the repository-standard annotation.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:45-92` — update JSDoc to show `state.save === "disabled"`; add `DocumentToolbarActionState`, the `sessionActionState` derivation, and replace six booleans plus three labels with `open`, `save`, and `preview`, while preserving the current `badge` and `sessionHint` outputs.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:142-148` — keep passing the five upstream facts directly from `AsyncResult`, `O.Option`, and the dirty atom; the function remains purely derived.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:191-214` — bind each button's busy/disabled presentation to its one literal state and derive labels exhaustively; keep the session hint unchanged.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:287` — keep rendering `toolbar.badge` byte-for-byte; the independent dirty/saved/no-document domain is not part of this instance.
- `packages/ontology/ui/src/aggregates/Session/index.ts:17` — continue exporting `documentToolbarState` and additionally export `DocumentToolbarActionState` so the existing package-alias test can inspect the literal domain without reaching into source.

Whole-repository search found no other source write or read of the six output members.

# Guard-deletion accounting

- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:81-83` — delete the duplicate `opening` projections into `openBusy` and `openDisabled`; one `open` phase makes busy-with-enabled unrepresentable.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:84-86` — delete the `saveBusy` plus `!sessionOpen || saving` coherence pair; `sessionActionState` selects one case.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:87-89` — delete the identical preview coherence pair.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:82`, `:85`, and `:88` — delete three boolean label ternaries from the state constructor; labels exhaustively match the same literal that controls presentation.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:139-141` — revise the comment-only invariant from “say so and refuse re-entry” being maintained by two output members to one explicit `busy` case.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:191-214` — delete six independent member reads whose coherence depended on the constructor; each button reads one phase.

# Encoded-side impact

none (internal)

# Test impact

- `packages/ontology/ui/test/Session.workbench.test.ts:42-60` — assert `{ open: "enabled", save: "disabled", preview: "disabled" }` and the existing session hint rather than the current boolean/label fields.
- `packages/ontology/ui/test/Session.workbench.test.ts:75-88` — assert save and preview are `enabled` when a session is open.
- `packages/ontology/ui/test/Session.workbench.test.ts:104-116` — assert open is `busy`; derive busy and disabled expectations through `DocumentToolbarActionState.is` if retaining presentation-level assertions.
- `packages/ontology/ui/test/Session.workbench.test.ts:118-132` — assert only save is `busy` while open and preview are `enabled`.
- `packages/ontology/ui/test/Session.workbench.test.ts:134-146` — assert only preview is `busy`.
- Add a compact table over all 14 reachable output combinations, including the no-session-plus-busy save and preview cases, to prove busy takes precedence over disabled and the shared session prerequisite is preserved.
- No other test under `packages/**/test/**` or app `test/` directories touches these members.
- Open, Save, and Preview are gesture-bearing controls whose labels, `aria-busy`, and disabled state change. Run the `browser-qa-loop` through the portless ontology UI script and retain successful record -> extract -> judge evidence with `requiredCount: 0` for enabled, disabled, and busy transitions.

# Risk & sequencing

This is a Tier 1, single-package derived-view refactor and can land independently. The main behavior risk is precedence: for save/preview, `busy` must win over `disabled` when no session is open, preserving `aria-busy: true` while still disabling re-entry. Keep the five function inputs as upstream observations; do not replace them with atoms or persisted toolbar state. Preserve the newer dirty/saved/no-document badge without folding it into this action-state domain. Export the new kit through the existing Session barrel in the same change as the focused test update.
