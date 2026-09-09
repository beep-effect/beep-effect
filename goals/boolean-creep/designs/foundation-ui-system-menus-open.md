# Instance

- id: `foundation-ui-system-menus-open`
- file:line: `packages/foundation/ui-system/editor/src/chat/atoms.ts:91`
- symbol: `menusOpenAtom`
- members: `slash`, `mention`
- evidence classes:
  - E1 at `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:491-498,608-612` — each open callback writes the exact inverse pair and each close callback clears only its own member.

Reviewed against merged checkout `7440cb8c4302ce64b87860069a464bafbf65f576`
and main corpus `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`;
the owned editor source is unchanged from the earlier
`05405bf322da0ca7eb88b8bb402145081e8fded6` /
`be8995e66aeefedf0dabf131deaeaaf25c8e6fc8` review.

# Current shape

Live declaration at `packages/foundation/ui-system/editor/src/chat/atoms.ts:91`:

```ts
export const menusOpenAtom = Atom.family((_editor: LexicalEditor) =>
  Atom.make<{ readonly slash: boolean; readonly mention: boolean }>({ slash: false, mention: false })
);
```

# Cardinality gap

The two booleans represent four combinations. Three states are legal:

- `none`: neither typeahead owns the combobox.
- `some("slash")`: the slash typeahead owns it.
- `some("mention")`: the mention typeahead owns it.

Both menus open is illegal. Absence is legal, so the honest type is `O.Option<TypeaheadMenu>` rather than a third sentinel literal.

# Target schema

In `atoms.ts`, add the package identity composer and `LiteralKit`, then make the atom hold an option of the literal. The new kit/type is `TypeaheadMenu`.

```ts
import { $EditorId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A, O } from "@beep/utils";

const $I = $EditorId.create("chat/atoms");

export const TypeaheadMenu = LiteralKit(["slash", "mention"]).pipe(
  $I.annoteSchema("TypeaheadMenu", {
    description: "The one typeahead menu that currently owns an editor's combobox.",
  })
);
export type TypeaheadMenu = typeof TypeaheadMenu.Type;

export const menusOpenAtom = Atom.family((_editor: LexicalEditor) =>
  Atom.make<O.Option<TypeaheadMenu>>(O.none())
);

export const anyMenuOpenAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => O.isSome(get(menusOpenAtom(editor))))
);
```

Open writes use `O.some(TypeaheadMenu.Enum.slash)` / `.mention`. A close callback clears only if the closing plugin still owns the current option, so a stale `onClose` cannot erase the other plugin's newer ownership.

```ts
onOpen={() => setMenus(O.some(TypeaheadMenu.Enum.slash))}
onClose={() => setMenus((current) => O.filter(current, (menu) => !TypeaheadMenu.is.slash(menu)))}
```

`useAtomSet` already accepts the functional updates used by both current
close callbacks, so the ownership check remains one atomic registry update.
Do not replace it with a render-captured read followed by an unconditional
write. Open remains last-writer-wins and idempotent; close remains
owner-conditional. Slash close still clears its query after the ownership
update, and mention close still resets `mentionLookupFn`, regardless of
whether a newer owner prevented the shared option from clearing.

# Migration inventory

- `packages/foundation/ui-system/editor/src/chat/atoms.ts:69-85` — update the atom JSDoc/example from idempotent booleans and `{ slash:false, mention:false }` to `O.Option<TypeaheadMenu>` and `O.none()`.
- `packages/foundation/ui-system/editor/src/chat/atoms.ts:91-93` — replace the boolean object atom with `O.Option<TypeaheadMenu>` initialized to none.
- `packages/foundation/ui-system/editor/src/chat/atoms.ts:116-120` — derive `anyMenuOpenAtom` with `O.isSome` instead of OR-ing members.
- `packages/foundation/ui-system/editor/src/chat/atoms.ts:226-230` — update the stale-state prose from a stale `true` flag to a stale `some(menu)` report; the DOM confirmation requirement remains.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:494` — slash `onOpen` writes `O.some(TypeaheadMenu.Enum.slash)`.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:495-498` — slash `onClose` writes none only when the current option is slash; preserve a newer mention owner.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:608` — mention `onOpen` writes `O.some(TypeaheadMenu.Enum.mention)`.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:609-612` — mention `onClose` writes none only when the current option is mention.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:23` and `:38-40` — add `O` to the `@beep/utils` import and import `TypeaheadMenu` with the existing atoms.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:15`, `:433`, and `:513` — update comments/JSDoc that describe boolean menu-open storage.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:669-738` — no
  control-flow edit: `comboboxAriaAtom` is the only live consumer of
  `anyMenuOpenAtom`; it must continue mounting and removing the DOM observer
  as the option changes between none and some.
- `packages/foundation/ui-system/editor/src/chat/atoms.ts:244-260,757-800` —
  no state-shape edit: Enter-to-send deliberately verifies the rendered DOM
  through `isTypeaheadMenuVisible`, rather than trusting
  `menusOpenAtom`; preserve that stale-report fallback.
- `packages/foundation/ui-system/editor/package.json:50` — no edit: the existing `./chat/atoms` export maps directly to the canonical owner; adding `TypeaheadMenu` to `atoms.ts` makes it package-alias accessible without a barrel change.

# Guard-deletion accounting

- `packages/foundation/ui-system/editor/src/chat/atoms.ts:118-120` — delete the `menus.slash || menus.mention` combined-state read.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:491-494` and `:608` — delete paired true/false exclusive writes; one option constructor owns exclusivity.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:495-498` and `:609-612` — delete partial object-spread writes that could preserve or manufacture a correlated pair; owner-aware option clearing replaces them.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:491-493` — delete the comment-only “only one typeahead” boolean invariant as a write-site obligation; the option type encodes it.
- `packages/foundation/ui-system/editor/src/chat/atoms.ts:69-72` — delete the “idempotent booleans” storage explanation.

# Encoded-side impact

none (internal)

# Test impact

No file under `packages/foundation/ui-system/editor/test/` reads
`menusOpenAtom`, `slash`, or `mention` in this state shape; the
`slash: true` at `chat-schema-parity.test.ts:56` belongs to independent
`ComposerFeatures`. Add:

- atom tests for none/slash/mention and the `anyMenuOpenAtom` projection;
- callback-level tests proving repeated opens are idempotent, closing the
  current owner clears to none, slash close after mention open preserves
  mention, and mention close after slash open preserves slash;
- component tests proving slash close still clears `slashQueryAtom`, mention
  close still sends `Atom.Reset`, and `comboboxAriaAtom` follows none/some
  transitions while Enter-to-send retains its DOM confirmation behavior.

For recorded browser QA, use the portless editor surface and real keyboard
input. Open slash with `/`, verify the editor root owns an expanded listbox,
navigate and select with Arrow keys/Enter, then open slash again and replace
the trigger with `@a` while the mention source is delayed. Prove the
slash-close callback cannot collapse the newer mention listbox; resolve the
mention, select it, and verify ownership closes. Reopen each menu and press
Escape, then remove a trigger so plugin-reported state can go stale and prove
Enter still sends when no listbox exists. Record `aria-expanded`,
`aria-controls`, `aria-activedescendant`, option selection, resulting editor
text/send count, and zero unexpected console errors. Complete record ->
extract -> judge with `requiredCount: 0`.

# Risk & sequencing

The exported atom's runtime value type changes, so land `atoms.ts`, both
Lexical plugin callbacks, and the mention phase edits together. No barrel or
package-manifest change is required. The principal risk is an out-of-order
close erasing the newer owner; functional option filtering is the required
atomic transition. Keep the DOM visibility fallback because the option can
still be stale when Lexical omits a close notification.
