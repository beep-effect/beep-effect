# Instance

- id: `document-toolbar-busy-disabled`
- file:line: `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:68`
- symbol: `documentToolbarState`
- members: `openBusy`, `openDisabled`, `saveBusy`, `saveDisabled`, `previewBusy`, `previewDisabled`
- evidence classes:
  - E4 — `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:73`: `saveBusy` is `input.saving` while `saveDisabled` is `!sessionOpen || saving`, so busy implies disabled; preview has the same implication at lines 74-76.
  - E4 — `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:68`: `openBusy` and `openDisabled` are both assigned `input.opening`, so busy-without-disabled is never constructed.
  - E2 — `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:175`: each button reads its pair as `aria-busy` and `disabled`; no branch handles busy-but-enabled.

# Current shape

Live declaration at `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:62`:

```ts
export const documentToolbarState = (input: {
  readonly opening: boolean;
  readonly saving: boolean;
  readonly previewing: boolean;
  readonly sessionOpen: boolean;
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
  sessionHint: input.sessionOpen ? undefined : "Open a document first",
});
```

# Cardinality gap

The six output booleans represent 64 combinations. The three actions are independent of one another, but each action has a smaller legal phase domain:

- open: `enabled` or `busy` (two states); it has no session prerequisite.
- save: `enabled`, `disabled`, or `busy` (three states).
- preview: `enabled`, `disabled`, or `busy` (three states).

That yields 2 × 3 × 3 = 18 legal toolbar combinations. In every action, `busy` means disabled against re-entry; save and preview use `disabled` only when no session is open and the action is not already busy.

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
}) => ({
  open: input.opening ? DocumentToolbarActionState.Enum.busy : DocumentToolbarActionState.Enum.enabled,
  save: sessionActionState(input.saving, input.sessionOpen),
  preview: sessionActionState(input.previewing, input.sessionOpen),
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
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:45-78` — update JSDoc to show `state.save === "disabled"`; add `DocumentToolbarActionState`, the `sessionActionState` derivation, and replace six booleans plus three labels with `open`, `save`, `preview`, and the existing hint.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:124-132` — keep passing the four upstream facts directly from `AsyncResult` and `O.Option`; the function remains purely derived.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:175-176` — bind open busy/disabled to kit-derived answers for `toolbar.open` and derive the label with an exhaustive match.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:182-187` — do the same for `toolbar.save`; keep `sessionHint` unchanged.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:193-198` — do the same for `toolbar.preview`; keep `sessionHint` unchanged.
- `packages/ontology/ui/src/aggregates/Session/index.ts:17` — continue exporting `documentToolbarState` and additionally export `DocumentToolbarActionState` so the existing package-alias test can inspect the literal domain without reaching into source.

Whole-repository search found no other source write or read of the six output members.

# Guard-deletion accounting

- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:68-70` — delete the duplicate `opening` projections into `openBusy` and `openDisabled`; one `open` phase makes busy-with-enabled unrepresentable.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:71-73` — delete the `saveBusy` plus `!sessionOpen || saving` coherence pair; `sessionActionState` selects one case.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:74-76` — delete the identical preview coherence pair.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:69`, `:72`, and `:75` — delete three boolean label ternaries from the state constructor; labels exhaustively match the same literal that controls presentation.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:124-126` — revise the comment-only invariant from “say so and refuse re-entry” being maintained by two output members to one explicit `busy` case.
- `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:175`, `:182-183`, and `:193-194` — delete six independent member reads whose coherence depended on the constructor; each button reads one phase.

# Encoded-side impact

none (internal)

# Test impact

- `packages/ontology/ui/test/Session.workbench.test.ts:42-54` — assert `{ open: "enabled", save: "disabled", preview: "disabled" }` and the existing session hint rather than five boolean/label fields.
- `packages/ontology/ui/test/Session.workbench.test.ts:56-62` — assert save and preview are `enabled` when a session is open.
- `packages/ontology/ui/test/Session.workbench.test.ts:64-70` — assert open is `busy`; derive busy and disabled expectations through `DocumentToolbarActionState.is` if retaining presentation-level assertions.
- `packages/ontology/ui/test/Session.workbench.test.ts:72-80` — assert only save is `busy` while open and preview are `enabled`.
- `packages/ontology/ui/test/Session.workbench.test.ts:82-88` — assert only preview is `busy`.
- Add a compact table over all 18 legal output combinations or, at minimum, the missing no-session-plus-busy save/preview cases to prove busy takes precedence over disabled.
- No other test under `packages/**/test/**` or app `test/` directories touches these members.

# Risk & sequencing

This is a Tier 1, single-package derived-view refactor and can land independently. The main behavior risk is precedence: for save/preview, `busy` must win over `disabled` when no session is open, preserving `aria-busy: true` while still disabling re-entry. Keep the four function inputs as upstream observations; do not replace them with atoms or persisted toolbar state. Export the new kit through the existing Session barrel in the same change as the focused test update.
