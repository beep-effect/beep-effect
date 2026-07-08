# JD-UI — `@beep/ui` JSDoc remediation to zero

Wave: `JD-UI`, package: `packages/foundation/ui-system/ui` (`@beep/ui`). Single
writer, no commits made. `standards/jsdoc-documentation.inventory.jsonc` was
read-only (via a one-time Python `json.load` extraction of the package's
`exports[]` slice); never opened for writing.

Before (from the inventory's `@beep/ui` `counts` block): `openExports: 54`,
`missingExportExamples: 33`, `missingExportCategories: 28`,
`missingExportSince: 28`, `missingExportSummaries: 28`,
`unsafeExampleFindings: 21` (54 distinct open export entries; the count
fields overlap since several entries carry more than one violation type).
After (self-verified against the same 54 repoPath:line coordinates read from
the inventory; driver still owns the authoritative regen): 0.

## Structural finding: compound-member assignments are unfixable by comment alone

`banner.tsx` (`Banner.Content = BannerContent;` etc.), `dialog.tsx`, and
`dropdown-menu.tsx` each attach shadcn-style compound sub-components via
top-level property assignment on the root function
(`Root.Part = PartComponent;`). The inventory flags every one of these
assignment lines individually, all under the *root* symbol's name (4 for
`Banner`, 9 for `Dialog`, 14 for `DropdownMenu` — 27 of the 54 findings).

Adding a JSDoc block directly above these assignment lines does **not**
clear the finding. Verified empirically with a throwaway ts-morph probe
script (not committed, deleted after use): `sourceFile.getExportedDeclarations()`
resolves each `Root.Part = Part;` assignment to a bare `Identifier` node (the
`Root` token on the assignment's LHS), not the enclosing statement.
`Node.isJSDocable` is `false` for a bare `Identifier`, so the analyzer's
`getJsDocText` always returns `""` for these declarations regardless of what
comment precedes the line — the finding is structurally permanent under the
expando-assignment code shape.

**Fix**: replace the assignment chain with
`const RootWithParts = Object.assign(Root, { Part: PartComponent, ... })`,
then `export { RootWithParts as Root, ... }`. `Object.assign` mutates and
returns the *same* function object, so this is runtime-identical (no
behavior change, `Root === RootWithParts`); it only changes which node
`getExportedDeclarations()` attributes to the exported name. Re-probed after
the edit: exactly one declaration remains, a `VariableDeclaration` whose
`getDocNode()` resolution (`getVariableStatement()`) *is* JSDocable, and the
JSDoc placed above the `const` is correctly read. Applied to `banner.tsx`
(4 findings), `dialog.tsx` (9 findings), `dropdown-menu.tsx` (14 findings) —
27 findings total, each with one consolidated compound-usage `@example`
(one example per namespace, not one per member).

## Unsafe-example findings (21) — `no-type-assertions-in-examples`

All 21 followed the same broken pattern: `const value = {} as X`. Fix
strategy varied by what `X` actually requires:

- **Plain data interfaces with concrete required fields** (`GraphNode`,
  `GraphLink`, `KnowledgeGraphHandle` in `knowledge-graph.tsx`; `Step`,
  `Tour` in `tour.tsx`) — replaced with a real conforming literal, typed via
  an explicit annotation instead of `as`.
- **LiteralKit/union string types** (`NotificationStatus`, `ActionType`,
  `ActionStyle` in `notification-card.tsx`; `AgentState` in `orb.tsx`;
  `ToastVariant` in `toast.tsx`; `ScribeStatus` in `use-scribe.ts`) —
  replaced with a small function taking the type as a parameter and an
  invocation with a real literal, e.g.
  `const describe = (state: AgentState): string => state ?? "idle"`.
- **React `ComponentProps<...>`-derived types with a required `children` or
  otherwise uncertain required shape** (`ConversationProps`,
  `ConversationContentProps`, `ConversationScrollButtonProps` in
  `conversation.tsx`; `ToastProps`, `ToastActionElement` in `toast.tsx`;
  `ThemeOptions`, `ThemeComponents` in `themes/types.ts`) — used a typed
  function parameter without invoking it (`const describe = (props: X):
  string => ...; console.log(typeof describe)`), sidestepping the need to
  construct a full props object for a third-party component type.
- **Trap hit and self-caught**: two of the function-parameter examples
  initially wrote `props.className ?? "unstyled"` and failed
  `turbo run docgen`'s typecheck — `ConversationScrollButtonProps`
  (`ComponentProps<typeof Button>`, a base-ui-backed component) and
  `ToastProps` (`ComponentProps<typeof Toast>`, same) both type `className`
  as `string | ((state) => string | undefined)` (base-ui's render-prop
  pattern), not `string | undefined`. Fixed with
  `typeof props.className === "string" ? props.className : "unstyled"`.
  Caught on the first `bun run docgen` run for the package, fixed before the
  final green run — no bad state landed.
- **Tagged-union type with Option-typed fields** (`NotificationAction`) —
  full literal construction would need `O.none()` imports and per-field
  fixture data; used a typed function parameter narrowed to the shared
  discriminant (`action.type`) instead, since the type export's job is to
  demonstrate the union shape, not exercise every member's Option-defaulted
  field.

## Missing-tag-only findings (remaining, not in the 21/27 above)

`CountryCode` (`country-select.tsx`) had no JSDoc at all above the const —
the existing rich doc block in the file was on the *type alias*
(`export type CountryCode = typeof CountryCode.Type`) two lines down, not the
schema const at the flagged line; added a matching doc + example
(`S.is(CountryCode)`) to the const itself. `CountryOptionContentProps`,
`NumberInputEventType`, `NumberInputError` (`useNumberInput.ts`), `ThemeMode`,
`ResolvedThemeMode` (`theme-provider.tsx`) already had `@category`/`@since`
and only needed `@example` added.

Verify: `bun run docgen` (run directly from the package, not via
`turbo run docgen --filter=@beep/ui` — the turbo task's `dependsOn: ["^docgen"]`
currently fails upstream on a pre-existing, out-of-lane `@beep/schema` finding
being worked by a different concurrent lane; the package's own docgen script
bypasses that cross-package gate) — 528 examples found and typechecked, zero
errors. `npx tsgo --noEmit -p tsconfig.json` clean (`npx tsgo -b`'s composite
build also fails only on the same pre-existing upstream `@beep/schema`
errors, confirmed by grep — zero matches for this package's own source
paths). `npx vitest run` — 32/32 passed. `bunx biome check
packages/foundation/ui-system/ui` — clean after biome's own `--write` fixed
export-list alphabetical ordering in the three restructured compound-export
files (safe, mechanical fix, no logic change).

Files touched (15 total, no commits): `src/components/banner.tsx`,
`src/components/conversation.tsx`, `src/components/country-select.tsx`,
`src/components/dialog.tsx`, `src/components/dropdown-menu.tsx`,
`src/components/knowledge-graph.tsx`, `src/components/live-waveform.tsx`,
`src/components/notification-card.tsx`, `src/components/orb.tsx`,
`src/components/toast.tsx`, `src/components/tour.tsx`,
`src/hooks/use-scribe.ts`, `src/hooks/useNumberInput.ts`,
`src/themes/theme-provider.tsx`, `src/themes/types.ts`.
