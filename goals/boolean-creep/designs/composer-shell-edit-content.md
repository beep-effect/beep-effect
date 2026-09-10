# Instance

- id: `composer-shell-edit-content`
- file:line: `apps/professional-desktop/src/chat/ui/Composer.atoms.ts:372`
- symbol: `ComposerShellView.editPayload`
- members: `isEditing`, presence of `contentToLoad`
- evidence: E4 at `apps/professional-desktop/src/chat/ui/Composer.atoms.ts:362-365,398-408`
  — after filtering the global edit target to this thread, the sole shell
  writer always supplies that target's document when `isEditing` is true.

Reviewed against checkout `7440cb8c4302ce64b87860069a464bafbf65f576`
and the identical apps/packages corpus on main
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`. This is design preparation;
replacement independent P3 review remains pending.

# Current shape

`contentToLoadFor` gives an edit target precedence over a per-thread draft. The
shell filters `editTargetAtom` by `threadId`, reads the revision-keyed draft
seed once, writes `contentToLoad` from the helper, and independently writes
`isEditing` from edit-target presence. `Composer.tsx:113-144` uses the option
to seed the editor and the boolean for the Rewrite label and edit banner.

The remaining shell members are orthogonal. `composerKey` controls editor
remounts, `streaming` selects the foundation Stop control, `safetyRefusal`
renders its own banner, and `cancelEdit`/`stop` are stable registry-backed
handlers. Editing while streaming is supported and renders the edit banner,
Rewrite label, edited content, and Stop together.

# Cardinality gap

The boolean and content presence represent four coarse combinations and three
are legal:

- `empty` — no edit target for this thread and no saved draft;
- `draft(content)` — no edit target for this thread and a saved draft;
- `editing(content)` — a matching edit target, whose content always wins.

Editing without content is impossible. A document with zero children remains
a valid editing payload because it comes from the schema-valid `EditTarget`;
do not reinterpret document structure as absence.

# Target schema

Add an annotated `ComposerShellContentKind` LiteralKit and three named schema
classes. Combine them through `mapMembers` and `S.toTaggedUnion("kind")`, using
the Professional Desktop identity composer. This follows the repo's tagged
payload pattern and keeps `Md.Document` as the existing payload schema.

```ts
export const ComposerShellContentKind = LiteralKit(["empty", "draft", "editing"]).pipe(
  $I.annoteSchema("ComposerShellContentKind", {
    description: "Content source currently mounted in the thread composer.",
  })
);
export type ComposerShellContentKind = typeof ComposerShellContentKind.Type;

class EmptyComposerShellContent extends S.Class<EmptyComposerShellContent>($I`EmptyComposerShellContent`)(
  { kind: S.tag("empty") },
  $I.annote("EmptyComposerShellContent", { description: "Composer with no persisted seed." })
) {
  static readonly thunkThis = () => EmptyComposerShellContent;
}

class DraftComposerShellContent extends S.Class<DraftComposerShellContent>($I`DraftComposerShellContent`)(
  { kind: S.tag("draft"), content: Md.Document },
  $I.annote("DraftComposerShellContent", { description: "Composer seeded from its thread draft." })
) {
  static readonly thunkThis = () => DraftComposerShellContent;
}

class EditingComposerShellContent extends S.Class<EditingComposerShellContent>($I`EditingComposerShellContent`)(
  { kind: S.tag("editing"), content: Md.Document },
  $I.annote("EditingComposerShellContent", { description: "Composer seeded from the matching edit target." })
) {
  static readonly thunkThis = () => EditingComposerShellContent;
}

export const ComposerShellContent = ComposerShellContentKind.mapMembers(
  Tuple.evolve([
    EmptyComposerShellContent.thunkThis,
    DraftComposerShellContent.thunkThis,
    EditingComposerShellContent.thunkThis,
  ])
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ComposerShellContent", {
    description: "Empty, draft-seeded, or edit-seeded composer content.",
  })
);
export type ComposerShellContent = typeof ComposerShellContent.Type;
```

Replace `contentToLoadFor` with a direct two-level `O.match`: a matching edit
target constructs `editing`; otherwise draft `Some` constructs `draft` and
draft `None` constructs `empty`. The shell exposes one
`content: ComposerShellContent` member instead of `contentToLoad` and
`isEditing`.

`Composer.tsx` passes the tagged value through `ThreadComposerProps`.
`ThreadComposer` matches it to the existing `Option<Document>` only at the
editor-seed boundary: empty becomes `None`, while draft and editing become
`Some(content)`. The Rewrite label and edit banner use
`ComposerShellContent.guards.editing`; no boolean is stored or passed.

# Migration inventory

- `apps/professional-desktop/src/chat/ui/Composer.atoms.ts:8-39` — add
  `$ProfessionalDesktopId`, `LiteralKit`, `Tuple`, and `effect/Schema`; make
  `Md` a value import so the existing document schema is reused.
- `apps/professional-desktop/src/chat/ui/Composer.atoms.ts:360-376` — replace
  `contentToLoadFor` and the paired members with the three schema cases, tagged
  union, one projection helper, and `content: ComposerShellContent`.
- `apps/professional-desktop/src/chat/ui/Composer.atoms.ts:393-413` — preserve
  edit-target thread filtering, draft revision and once-per-revision seed,
  exact composer keys, safety refusal, stable handlers, and streaming; change
  only the paired projection to the tagged value.
- `apps/professional-desktop/src/chat/ui/Composer.tsx:43-45,102-145` — import
  the schema value/type, pass the tagged member, use the editing guard for the
  exact Rewrite label and banner, and retain the same Cancel callback.
- `apps/professional-desktop/src/chat/ui/Composer.tsx:149-215` — replace the
  `content` Option prop with the tagged content prop, match it back to the same
  seed Option, and leave safety seed/codec resolution, editor props, Stop,
  streaming, send policy, attachments, slash commands, and mentions intact.
- Add a focused `composer-shell-view.test.ts` beside the existing Professional
  Desktop tests; no current test reads `composerShellAtoms` or asserts the edit
  banner/Rewrite path.

The edit-target writers remain `Thread.atoms.ts:54-57`, successful submit at
`Composer.atoms.ts:154-172`, explicit cancel at `Composer.atoms.ts:267-270`,
and thread switch at `Sidebar.tsx:41-45`. None changes shape or behavior.

# Guard-deletion accounting

- Delete `contentToLoadFor` and its implicit rule that edit-target presence
  must agree with the separately written `isEditing` flag.
- Delete `ComposerShellView.isEditing` and
  `ComposerShellView.contentToLoad`; one tagged member owns the case and
  case-specific document.
- Delete the duplicate boolean derivation at `Composer.atoms.ts:408`.
- Delete the independent `shell.isEditing` reads for the label and banner;
  both use the schema-derived editing guard over the same tagged value.

# Encoded-side impact

None. The tagged value is a private-app, derived atom view consumed in-process.
It is not persisted or sent over RPC. Draft and edit-target storage schemas,
document encoding, and editor serialized state remain unchanged.

# Test impact

Add an atom table for empty, draft, and editing, including an empty-document
edit target. Prove a target for another thread is ignored; editing wins over an
existing draft; cancel returns to the same thread/revision draft; a draft
revision change produces the existing `thread:<id>:<revision>` remount key;
switching edit targets produces `edit:<turnId>`; and submit/cancel/thread switch
still clear the global edit target at their current sites.

Cross each content case with `turnActiveAtom` false and true. Assert the tagged
content and `composerKey` change while `cancelEdit` and `stop` handler identity
remain stable. Keep `composer-dispatch-confirm.test.ts:79-110` as the draft
revision/restore regression.

Record required portless browser QA with real gestures: create a draft, enter
Edit from a user turn, verify the exact edited content, Rewrite label, banner,
and editor remount; cancel back to the prior draft; switch threads during edit;
and exercise editing while streaming so Stop remains available. Complete
record, extract, and judge with `requiredCount: 0`, checking console health and
that neither draft nor edit content flashes or migrates across threads.

# Risk and sequencing

Land the atom schema, view writer, React reader, and tests atomically in the
Professional Desktop Tier 1 batch. Preserve edit-target thread filtering and
editor remount keys exactly. Streaming remains an independent axis, and the
registry-backed cancel/stop handlers retain their stable closure behavior.
