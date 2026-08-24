# Instance

- id: `foundation-ui-system-menus-open`
- file:line: `packages/foundation/ui-system/editor/src/chat/atoms.ts:92`
- symbol: `menusOpenAtom`
- members: `slash`, `mention`
- evidence classes:
  - E1 at `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:475` — onOpen writes {slash:true, mention:false}; MentionPlugin line 589 writes the inverse. Comment at 472-474: only one typeahead may hold the combobox.

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

# Migration inventory

- `packages/foundation/ui-system/editor/src/chat/atoms.ts:69-85` — update the atom JSDoc/example from idempotent booleans and `{ slash:false, mention:false }` to `O.Option<TypeaheadMenu>` and `O.none()`.
- `packages/foundation/ui-system/editor/src/chat/atoms.ts:91-93` — replace the boolean object atom with `O.Option<TypeaheadMenu>` initialized to none.
- `packages/foundation/ui-system/editor/src/chat/atoms.ts:116-120` — derive `anyMenuOpenAtom` with `O.isSome` instead of OR-ing members.
- `packages/foundation/ui-system/editor/src/chat/atoms.ts:226-230` — update the stale-state prose from a stale `true` flag to a stale `some(menu)` report; the DOM confirmation requirement remains.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:475` — slash `onOpen` writes `O.some(TypeaheadMenu.Enum.slash)`.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:477` — slash `onClose` writes none only when the current option is slash; preserve a newer mention owner.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:589` — mention `onOpen` writes `O.some(TypeaheadMenu.Enum.mention)`.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:591` — mention `onClose` writes none only when the current option is mention.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:23` and `:37-39` — add `O` to the `@beep/utils` import and import `TypeaheadMenu` with the existing atoms.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:15`, `:414`, and `:494` — update comments/JSDoc that describe boolean menu-open storage.
- `packages/foundation/ui-system/editor/src/chat/index.ts:20-23` and `:70-73` — no edit: the existing deprecated re-exports of `anyMenuOpenAtom` and `menusOpenAtom` remain source-compatible by symbol name. `TypeaheadMenu` is exported from the canonical `@beep/editor/chat/atoms` module that owns the atom.

# Guard-deletion accounting

- `packages/foundation/ui-system/editor/src/chat/atoms.ts:118-120` — delete the `menus.slash || menus.mention` combined-state read.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:472-475` and `:589` — delete paired true/false exclusive writes; one option constructor owns exclusivity.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:477` and `:591` — delete partial object-spread writes that could preserve or manufacture a correlated pair; owner-aware option clearing replaces them.
- `packages/foundation/ui-system/editor/src/chat/typeahead.tsx:472-474` — delete the comment-only “only one typeahead” boolean invariant as a write-site obligation; the option type encodes it.
- `packages/foundation/ui-system/editor/src/chat/atoms.ts:69-72` — delete the “idempotent booleans” storage explanation.

# Encoded-side impact

none (internal)

# Test impact

No file under `packages/foundation/ui-system/editor/test/` reads `menusOpenAtom`, `slash`, or `mention` in this state shape; the `slash: true` at `chat-schema-parity.test.ts:56` belongs to independent `ComposerFeatures`. Add atom-level tests for none/slash/mention, `anyMenuOpenAtom`, and the stale-close race (slash close after mention open must leave mention active).

# Risk & sequencing

The exported atom's runtime value type changes, so land `atoms.ts`, both Lexical plugin callbacks, and any barrel export together. The stale `onClose` ordering is the main behavioral risk: option migration is an opportunity to preserve newer ownership rather than unconditionally clear. This shares `typeahead.tsx` with the mention lookup-phase instance; sequence or combine those edits to avoid conflicts, but keep their state domains separate.
