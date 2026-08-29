# P1 capability contract — `@beep/editor` descriptors, resolver, projections

Status: design ratified for P1 implementation on 2026-08-25. `SPEC.md` stays
normative; this file records the concrete contract derived from the reconciled
atlas so implementation and review share one shape. Repo law
(`AGENTS.md`, `.patterns/jsdoc-documentation.md`, Effect v4 in
`.repos/effect`) outranks this file.

## 1. Scope decisions (derived, not new product policy)

1. **Catalog = what `@beep/editor` can register today.** Every descriptor maps
   onto a Lexical node, plugin, transformer, or command that already ships in
   `packages/foundation/ui-system/editor` (`src/nodes.ts`, `src/composer.tsx`,
   `@lexical/*` packages already in `package.json`). No new dependency.
2. **Readable baseline is catalog-wide (D3).** Node registration never depends
   on the profile: every catalog node is registered for every resolved profile
   so supported content stays readable. Profiles only choose *authoring*:
   extensions (plugins), transformers, commands, keybindings, projections.
3. **Canonical loss is data (D1).** Each descriptor carries
   `canonicalCompatibility` (`lossless | lossy | unsupported | not-applicable`),
   the atlas vocabulary, taken from the live codec
   `packages/foundation/modeling/lexical/src/Lexical.codec.ts`
   (`strong/em/del/code` ↔ bits 1/2/4/16 at lines 245-248 and 479-481; every
   other bit is dropped, proven by `Lexical.codec.test.ts:347`). A style the
   canonical model cannot retain is `unsupported` (the atlas term for
   underline and friends), not `lossy`. The `document-proof` reference profile
   enables only `lossless` formats; the compatibility profile keeps today's
   behavior even where the canonical model drops a bit.
4. **Atlas corrections carried by this PR.** The live codec contradicts five
   atlas rows: `format.strikethrough` is `lossless` for `beep-md`
   (`Md.Del`), `lexical-wire-strict` (bit 4), and `markdown` (`~~`);
   `format.lowercase`, `format.uppercase`, `format.capitalize`, and
   `transformer.highlight` are `unsupported` for `beep-md` (bits 256/512/1024/
   128 are dropped). Those rows are corrected with the codec citation.
5. **No `minimal` eligibility rows exist in the atlas** (0 of 178 entries). The
   `minimal` reference profile is therefore an app-chosen subset of
   `document-proof`-eligible capabilities; eligibility is a ceiling, not a
   floor.
6. **Profiles are app-owned (D4).** `@beep/editor` ships one *compatibility*
   profile (used internally by `EditorComposer` so consumer behavior is
   unchanged) and two *reference* proof profiles (`minimal`, `document-proof`)
   so Storybook and the desktop panel share one definition. They are documented
   as proof fixtures, not product modes.
7. **Keybinding ownership.** The resolved keybinding plugin mounts only when
   `extension.shortcut-help` is enabled. Without it, Lexical-native chords
   (bold/italic/underline/undo/redo) behave exactly as today, which is what
   the compatibility profile relies on. With it, the plugin owns every resolved
   chord at `KEY_DOWN_COMMAND` priority and **swallows** catalog chords whose
   capability is not enabled (the "disabled chord guard"), so a profile that
   omits `format.underline` never produces bit 8 — that is the D1/D3 proof.
8. **Remount transaction (D5).** Changing the profile is a host-side remount
   keyed by profile id over the canonical document:
   `editorStateToDocument(latest) → documentToEditorState(doc)`. No in-place
   reconfiguration API exists.

## 2. File layout (`packages/foundation/ui-system/editor`)

```
src/capability/
  schemas.ts        ids, literal domains, Keybinding/KeyChord, CapabilityDescriptor,
                    CapabilityCatalog, EditorProfile, ResolvedEditorProfile
  errors.ts         S.TaggedError classes + ProfileResolutionError union
  resolver.ts       resolveEditorProfile (Result) + resolveEditorProfileEffect
  projection.ts     projectCommands, projectShortcutHelp, projectSlashItems, formatChord
  catalog.ts        editorCapabilityCatalog (P1 descriptors, atlas ids)
  profiles.ts       compatibilityProfile, referenceProfiles { minimal, documentProof }
  runtime.tsx       node/extension/transformer/command runtime bindings,
                    KeybindingPlugin, chordFromKeyboardEvent, detectPlatform
  toolbar.tsx       CapabilityToolbar (projects `toolbar` surface)
  shortcut-help.tsx ShortcutHelp (projects generated help)
  composer.tsx      CapabilityComposer (resolve → typed error notice | mount)
  index.ts          barrel (dedicated subpaths stay the preferred import)
stories/capability-profiles.stories.tsx
stories/fixtures.ts               + capabilityProofDocument (canonical @beep/md)
test/capability-schemas.test.ts   encode/decode round trips, invariants
test/capability-resolver.test.ts  every typed failure + deterministic success
test/capability-projection.test.ts commands/help/slash derive from one registry
test/capability-catalog.test.ts   atlas reconciliation + editorNodes parity
test/capability-runtime.test.tsx  KeybindingPlugin guard, remount transaction
```

`package.json` gains `./capability` and `./capability/*` export entries
(both `exports` and `publishConfig.exports`). `src/index.ts` re-exports the
barrel with the same deprecation posture as the other root aliases
(`test/facade-deprecation.test.ts` keeps passing).

Identity: `const $I = $EditorId.create("capability/<file>")`; every schema,
class, and error uses `$I\`Name\`` + `$I.annote(...)`; no bare string
identifiers.

## 3. Schemas (`schemas.ts`)

All literal domains use `LiteralKit` from `@beep/schema`. Names below are the
exported symbols.

| Symbol | Shape | Notes |
| --- | --- | --- |
| `CapabilityId` | `S.NonEmptyString` refined to `/^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/` and branded `CapabilityId` | atlas ids (`node.heading`) plus beep-native (`beep.artifact-ref`) |
| `CommandId` | same pattern, brand `CommandId` | atlas command ids (`block.heading-1`, `format.bold`, `history.undo`) |
| `ProfileId` | `S.NonEmptyString` brand `ProfileId` | |
| `CapabilityCategory` | `LiteralKit(["core-node","node","extension","transformer","authoring","interchange"])` | P1 subset of the atlas taxonomy |
| `CapabilityDisposition` | `LiteralKit(["implement","generalize","development-only"])` | P1 subset; `development-only` exists so the resolver rule is testable |
| `CanonicalCompatibility` | `LiteralKit(["lossless","lossy","unsupported","not-applicable"])` | `@beep/md` status per §1.3 |
| `ReadOnlyFallback` | `LiteralKit(["render-canonical","hide-controls","inert-reference"])` | the three fallbacks observed in the atlas |
| `ActivationSurface` | `LiteralKit(["toolbar","slash-menu","floating-toolbar","context-menu"])` | user-visible affordance surfaces a command projects to; `keyboard` is derived from keybindings, `markdown-shortcut` from transformers |
| `Platform` | `LiteralKit(["windows-linux","apple"])` | no `all`: every binding is authored per platform |
| `Modifier` | `LiteralKit(["control","meta","alt","shift"])` | |
| `KeyChord` | `S.Class { modifiers: S.Array(Modifier) (unique, sorted in `Modifier.Options` order), key: S.NonEmptyString (lowercase) }` | canonical parsed form; equality = platform + modifiers + key |
| `KeyChordFromString` | codec `S.String ⇄ KeyChord` | parses `"Ctrl+Alt+1"`, `"Cmd+Option+1"`, `"Control+Shift+Q"`; tokens: `ctrl`/`control` → `control`, `cmd`/`meta`/`win` → `meta`, `alt`/`option` → `alt`, `shift` → `shift`; last token is the key; malformed input is a decode issue |
| `Keybinding` | `S.Class { platform: Platform, chord: KeyChordFromString }` | authored as strings, decoded to `KeyChord` |
| `NodeRegistrationKey` | `LiteralKit([...])` | `TextNode, TabNode, LineBreakNode, ParagraphNode, HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode, TableNode, TableRowNode, TableCellNode, YouTubeNode, ArtifactRefNode` |
| `ExtensionKey` | `LiteralKit([...])` | `HistoryPlugin, ListPlugin, CheckListPlugin, LinkPlugin, MarkdownShortcutPlugin, ToolbarProjection, SlashPickerProjection, ShortcutHelpProjection` |
| `TransformerKey` | `LiteralKit([...])` | `HEADING, QUOTE, CODE, UNORDERED_LIST, ORDERED_LIST, CHECK_LIST, INLINE_CODE, BOLD_STAR, BOLD_UNDERSCORE, BOLD_ITALIC_STAR, BOLD_ITALIC_UNDERSCORE, ITALIC_STAR, ITALIC_UNDERSCORE, HIGHLIGHT, STRIKETHROUGH, LINK` |
| `CapabilityRegistrations` | `S.Class { nodes: Array<NodeRegistrationKey>, extensions: Array<ExtensionKey>, transformers: Array<TransformerKey> }` | each array unique |
| `CommandDefinition` | `S.Class { id: CommandId, label, helpText, surfaces: Array<ActivationSurface>, keybindings: Array<Keybinding> }` | at most one keybinding per platform |
| `CapabilityClassification` | `S.Class { category, disposition }` | |
| `CapabilityDescriptor` | `S.Class { id, title, summary, classification, dependencies: Array<CapabilityId>, conflicts: Array<CapabilityId>, registrations, commands: Array<CommandDefinition>, readOnlyFallback, canonicalCompatibility, evidence: S.NonEmptyString }` | `evidence` is a locator such as `editor-capability-atlas/v1#node.heading` or a repo path for beep-native entries; no self-dependency, no self-conflict |
| `CapabilityCatalog` | `S.Array(CapabilityDescriptor)` with `S.makeFilter` checks: unique ids, unique command ids across the catalog, unique registration keys across the catalog | the catalog is the single registration source: a node/extension/transformer key belongs to exactly one descriptor |
| `ProfileKind` | `LiteralKit(["production","development-reference"])` | D9 |
| `KeybindingOverride` | `S.Class { commandId: CommandId, keybindings: Array<Keybinding> }` | replaces (not merges) the command's default bindings; empty array unbinds |
| `EditorProfile` | `S.Class { id: ProfileId, kind: ProfileKind, capabilities: Array<CapabilityId> (unique), keybindingOverrides: Array<KeybindingOverride> (unique commandId) }` | app-owned value; `make` applies `kind` default `production` and `keybindingOverrides` default `[]` |
| `CapabilityMode` | `LiteralKit(["authoring","read-only"])` | |
| `ResolvedCapability` | `S.Class { id, mode: CapabilityMode, readOnlyFallback }` | one row per catalog entry, catalog order |
| `ResolvedCommand` | `S.Class { id, capabilityId, label, helpText, surfaces, keybindings: Array<Keybinding> }` | after overrides |
| `ResolvedEditorProfile` | `S.Class { profileId, kind, capabilities: Array<ResolvedCapability>, registrations: CapabilityRegistrations, commands: Array<ResolvedCommand>, guardedChords: Array<Keybinding> }` | `registrations.nodes` = catalog-wide baseline; `extensions`/`transformers` = enabled capabilities only; `commands` = enabled capabilities only, catalog order then declaration order; `guardedChords` = default chords of disabled catalog commands (the disabled chord guard input) |

Every schema gets `identifier`/`title`/`description` annotations via `$I`;
struct keys get `annotateKey({ description })`. Encode/decode round trips are
tested for `CapabilityDescriptor`, `EditorProfile`, and
`ResolvedEditorProfile`; `toArbitrary` is only needed where a property test
is actually written.

## 4. Errors (`errors.ts`)

`S.TaggedError` classes, each with a `message` derived in a static `make`-style
helper if needed, and all annotated through `$I.annoteError`:

| Class | Fields |
| --- | --- |
| `UnknownCapabilityError` | `profileId, capabilityId` |
| `MissingDependencyError` | `profileId, capabilityId, dependencyId` |
| `DependencyCycleError` | `profileId, cycle: NonEmptyArray<CapabilityId>` |
| `CapabilityConflictError` | `profileId, capabilityId, conflictsWith` |
| `DevelopmentOnlyCapabilityError` | `profileId, capabilityId` |
| `IncompatibleRegistrationError` | `profileId, capabilityId, registration: NonEmptyString, reason: NonEmptyString` |
| `UnknownCommandError` | `profileId, commandId` (override targets a command that is not resolved) |
| `KeybindingConflictError` | `profileId, platform, chord: KeyChord, commandIds: NonEmptyArray<CommandId>` |
| `ProfileResolutionError` | `S.Union([...all of the above])` + type |

`packages/foundation/ui-system/editor/test/TaggedErrors.equivalence.test.ts`
already sweeps the package; new errors must satisfy it (declare struct
equivalence via `annoteError`, see memory `tagged-error-equivalence-is-unstable`).

## 5. Resolver (`resolver.ts`)

```ts
export const resolveEditorProfile: (
  catalog: CapabilityCatalog,
  profile: EditorProfile
) => Result.Result<ResolvedEditorProfile, ProfileResolutionError>
export const resolveEditorProfileEffect: (...) => Effect.Effect<ResolvedEditorProfile, ProfileResolutionError>
```

Deterministic order of checks (first failure wins, stable across runs):

1. **Unknown ids** — every `profile.capabilities` id exists in the catalog
   (`UnknownCapabilityError`, first offender in profile order).
2. **Development-only** — a descriptor with disposition `development-only`
   requires `profile.kind === "development-reference"`
   (`DevelopmentOnlyCapabilityError`).
3. **Missing dependencies** — dependencies are explicit: every dependency of an
   enabled capability must itself be enabled (`MissingDependencyError`). The
   resolver never auto-enables.
4. **Cycles** — build the enabled dependency graph with `effect/Graph`
   (`Graph.directed`, `Graph.mutate`, `Graph.addNode/addEdge`); if
   `Graph.isAcyclic` is false, extract one cycle by DFS over
   `MutableHashMap`/`MutableHashSet` and return `DependencyCycleError`
   (verify the Graph API against `.repos/effect/packages/effect/src/Graph.ts`).
5. **Conflicts** — for enabled `a` with `conflicts ∋ b`, `b` enabled ⇒
   `CapabilityConflictError` (checked symmetrically).
6. **Registrations** — enabled extensions/transformers are unioned in catalog
   order; the catalog check already forbids double ownership, so
   `IncompatibleRegistrationError` covers: a transformer enabled while
   `MarkdownShortcutPlugin` is not (`reason: "transformer requires interchange.markdown"`),
   and `CheckListPlugin` without `ListPlugin`. Nodes are the full catalog
   baseline in catalog order.
7. **Commands** — collect enabled commands (catalog order, then declaration
   order); apply overrides (`UnknownCommandError` when the target is not an
   enabled command); then detect conflicts: two active bindings with equal
   `(platform, KeyChord)` ⇒ `KeybindingConflictError` listing every colliding
   command id in resolved order.
8. **Guarded chords** — default bindings of catalog commands that are *not*
   enabled (the runtime swallows them when the keybinding plugin is mounted).

Resolution is pure and synchronous; no `S.*Sync` inside Effects; `Result`
combinators (`Result.flatMap`, `Result.all`) or an explicit early-return loop
over `A.*` helpers. No native `Map`/`Set`/array mutation methods.

## 6. Projections (`projection.ts`)

All pure over `ResolvedEditorProfile`:

- `projectCommands(resolved, surface): Array<ResolvedCommand>` — filter by
  `surfaces` membership, order preserved.
- `projectShortcutHelp(resolved, platform): Array<ShortcutHelpEntry>` where
  `ShortcutHelpEntry = S.Class { commandId, label, helpText, chord: S.Option(KeyChord) }`
  — one entry per resolved command (commands without a binding still appear;
  help must match the resolved command set exactly).
- `formatChord(platform, chord): string` — `windows-linux`: `Ctrl`/`Win`/
  `Alt`/`Shift`; `apple`: `Control`/`Cmd`/`Option`/`Shift`; joined with `+`,
  key upper-cased when a single letter.
- `projectSlashItems(resolved, run: (commandId) => EditorEffect): SlashItems` —
  builds `SlashItem.make` rows for `slash-menu` commands so the existing
  `SlashPlugin` (`@beep/editor/chat/typeahead`) is the typeahead projection.

## 7. Runtime bindings (`runtime.tsx`)

Typed records keyed by the literal kits (no `Map`):

- `nodeRegistrations: Record<NodeRegistrationKey, Klass<LexicalNode>>`;
  `resolvedNodes(resolved): ReadonlyArray<Klass<LexicalNode>>` in
  `registrations.nodes` order. **`src/nodes.ts` `editorNodes` becomes
  `resolvedNodes` over the catalog baseline** and a test asserts the array is
  identical (same classes, same order) to the pre-P1 list.
- `transformerRegistrations: Record<TransformerKey, Transformer>` from
  `@lexical/markdown` named exports; `resolvedTransformers(resolved)`.
- `commandHandlers: Record<CommandId, (editor: LexicalEditor) => void>`:
  `format.*` → `FORMAT_TEXT_COMMAND`; `format.clear` → clear every text format
  on the selection; `format.link` → `TOGGLE_LINK_COMMAND` (toggle with a
  placeholder `https://` when none; keep it minimal); `block.paragraph/quote/
  code/heading-N` → `$setBlocksType`; `block.*-list` → `INSERT_*_LIST_COMMAND`
  / `REMOVE_LIST_COMMAND` toggle; `history.undo/redo` → `UNDO_COMMAND`/
  `REDO_COMMAND`. `runCommand(editor, commandId)`.
- `<ResolvedExtensions resolved />` mounts `HistoryPlugin`, `ListPlugin`,
  `CheckListPlugin`, `LinkPlugin`, `MarkdownShortcutPlugin transformers={resolvedTransformers}`
  when their keys are present.
- `<KeybindingPlugin resolved platform />` registers `KEY_DOWN_COMMAND` at
  `COMMAND_PRIORITY_HIGH`: parse the event (`chordFromKeyboardEvent(event, platform): O.Option<KeyChord>`;
  digits resolve through `event.code` `DigitN` so `Ctrl+Shift+7` works on US
  layouts), match against resolved bindings ⇒ `preventDefault`, run handler,
  return `true`; match against `guardedChords` ⇒ `preventDefault`, return
  `true` (swallow); otherwise `false`. Mounted only when
  `ShortcutHelpProjection` is in `registrations.extensions`.
- `detectPlatform(): Platform` from `navigator.platform`/`userAgent`
  (`Mac|iPhone|iPad` ⇒ `apple`), SSR-safe default `windows-linux`.
- Selection mirroring for toolbar pressed state: reuse
  `toolbarSelectionAtom` from `src/chat/toolbar.tsx` if it is exported cleanly;
  otherwise pressed state is out of P1 scope (buttons remain plain, labeled).

## 8. React surfaces

- `CapabilityComposer` (`composer.tsx`) props:
  `{ profile: EditorProfile, catalog?: CapabilityCatalog (default editorCapabilityCatalog), initialState?: SerializedEditorState, onSerializedChange?, platform?: Platform, placeholder?, className? }`.
  Resolves at render (pure); on failure renders `<ProfileResolutionNotice error />`
  (`role="alert"`, the tagged error `_tag` + fields as text — development
  visibility, never a mount); on success mounts `LexicalComposer` with
  `namespace: "beep-editor-capability"`, `nodes: resolvedNodes`, the theme,
  `RichTextPlugin`, `ResolvedExtensions`, `KeybindingPlugin`,
  `CapabilityToolbar` (when `ToolbarProjection` enabled), `SlashPlugin` with
  `projectSlashItems` (when `SlashPickerProjection` enabled), `ShortcutHelp`
  (when `ShortcutHelpProjection` enabled), and the same `OnChangePlugin`
  decode-or-log behavior as `EditorComposer`. Profile and initial state are
  mount-only; hosts change `key` to remount (D5).
- `CapabilityToolbar` (`toolbar.tsx`): `<div role="toolbar" aria-label="Editing commands">`
  of `@beep/ui` `Button`s for `projectCommands(resolved, "toolbar")`; each
  button has visible text (`label`), `aria-keyshortcuts` from the platform
  chord, and `title` = `helpText`. No icon-only or color-only controls.
- `ShortcutHelp` (`shortcut-help.tsx`): `<section aria-labelledby>` with a
  `<dl>` of `projectShortcutHelp` rows (label → formatted chord or "No shortcut").
- `EditorComposer` (`src/composer.tsx`) keeps its props and DOM; internally it
  resolves `compatibilityProfile` once at module level (decode in module
  scope is allowed) and uses `resolvedNodes`/`resolvedTransformers`/
  `ResolvedExtensions`. Its plugin output must be byte-for-byte the same set
  as before: `HistoryPlugin, ListPlugin, CheckListPlugin, LinkPlugin,
  MarkdownShortcutPlugin(TRANSFORMERS)` — and `TRANSFORMERS` from
  `@lexical/markdown` **does not include `CHECK_LIST`**, so the compatibility
  profile enables every transformer except `transformer.check-list`.
  `markdownTransformers` stays exported with the same value.
- `ChatComposer` is untouched except that `editorNodes` now derives from the
  catalog; `ComposerFeatures` stays exactly as is (the desktop property test
  encodes/decodes it).

## 9. Catalog (`catalog.ts`) — P1 descriptors

Ids, dependencies, commands, and keybindings are copied from
`research/capability-atlas.json` verbatim (the reconciliation test enforces
it). Category/disposition come from the atlas entry. `evidence` =
`"editor-capability-atlas/v1#<id>"` (beep-native: the model source path).

| id | category | registrations | commands (chord win-linux / apple) | deps | fallback | canonical |
| --- | --- | --- | --- | --- | --- | --- |
| node.root | core-node | — (RootNode is implicit in Lexical) | — | — | render-canonical | lossless |
| node.paragraph | core-node | ParagraphNode | block.paragraph (Ctrl+Alt+0 / Cmd+Option+0) `toolbar, slash-menu` | — | render-canonical | lossless |
| node.text | core-node | TextNode | — | — | render-canonical | lossless |
| node.line-break | core-node | LineBreakNode | — | — | render-canonical | lossless |
| node.tab | core-node | TabNode | — | — | render-canonical | unsupported (the codec degrades a tab to literal `"\t"` text, `Lexical.codec.ts:498,646`) |
| node.heading | node | HeadingNode | block.heading-1/2/3 (Ctrl+Alt+1..3 / Cmd+Option+1..3) `toolbar, slash-menu` | — | render-canonical | lossless |
| node.quote | node | QuoteNode | block.quote (Ctrl+Shift+Q / Control+Shift+Q) `toolbar, slash-menu` | — | render-canonical | lossless |
| node.code | node | CodeNode | block.code (Ctrl+Alt+C / Cmd+Option+C) `toolbar, slash-menu` | — | render-canonical | lossless |
| node.list | node | ListNode; ext ListPlugin, CheckListPlugin | block.bullet-list (Ctrl+Shift+8 / Cmd+Shift+8), block.numbered-list (Ctrl+Shift+7 / Cmd+Shift+7), block.check-list (Ctrl+Shift+9 / Cmd+Shift+9) `toolbar, slash-menu` | — | render-canonical | lossless |
| node.list-item | node | ListItemNode | — | node.list | render-canonical | lossless |
| node.link | node | LinkNode; ext LinkPlugin | format.link (Ctrl+K / Cmd+K) `toolbar` | — | render-canonical | lossless |
| node.table | node | TableNode | — | — | render-canonical | unsupported (atlas: no `@beep/md` table authoring; the Md `Table` kind round-trips read-only) |
| node.table-row | node | TableRowNode | — | node.table | render-canonical | unsupported |
| node.table-cell | node | TableCellNode | — | node.table | render-canonical | unsupported |
| node.youtube | node | YouTubeNode | — | — | inert-reference | unsupported |
| beep.artifact-ref | node | ArtifactRefNode | — | — | render-canonical | lossless (evidence: `packages/foundation/modeling/lexical/src/Lexical.model.ts`) |
| format.bold | authoring | — | format.bold (Ctrl+B / Cmd+B) `toolbar` | — | render-canonical | lossless |
| format.italic | authoring | — | format.italic (Ctrl+I / Cmd+I) `toolbar` | — | render-canonical | lossless |
| format.strikethrough | authoring | — | format.strikethrough (Ctrl+Shift+X / Cmd+Shift+X) `toolbar` | — | render-canonical | lossless |
| format.inline-code | authoring | — | format.inline-code (Ctrl+Shift+C / Cmd+Shift+C) `toolbar` | — | render-canonical | lossless |
| format.underline | authoring | — | format.underline (Ctrl+U / Cmd+U) `toolbar` | — | render-canonical | unsupported |
| format.subscript | authoring | — | format.subscript (Ctrl+, / Cmd+,) `toolbar` | — | render-canonical | unsupported |
| format.superscript | authoring | — | format.superscript (Ctrl+. / Cmd+.) `toolbar` | — | render-canonical | unsupported |
| format.lowercase | authoring | — | format.lowercase (Ctrl+Shift+1 / Control+Shift+1) `toolbar` | — | render-canonical | unsupported |
| format.uppercase | authoring | — | format.uppercase (Ctrl+Shift+2 / Control+Shift+2) `toolbar` | — | render-canonical | unsupported |
| format.capitalize | authoring | — | format.capitalize (Ctrl+Shift+3 / Control+Shift+3) `toolbar` | — | render-canonical | unsupported |
| format.semantic-highlight | authoring | — | — (no command in the atlas) | — | render-canonical | unsupported |
| format.clear | authoring | — | format.clear (Ctrl+\ / Cmd+\) `toolbar` | — | hide-controls | not-applicable |
| extension.history | extension | ext HistoryPlugin | — | — | hide-controls | not-applicable |
| authoring.undo | authoring | — | history.undo (Ctrl+Z / Cmd+Z) `toolbar` | extension.history | hide-controls | not-applicable |
| authoring.redo | authoring | — | history.redo (Ctrl+Y / Cmd+Shift+Z) `toolbar` | extension.history | hide-controls | not-applicable |
| extension.toolbar | extension | ext ToolbarProjection | — | — | hide-controls | not-applicable |
| extension.slash-picker | extension | ext SlashPickerProjection | — | — | hide-controls | not-applicable |
| extension.shortcut-help | extension | ext ShortcutHelpProjection | — | — | hide-controls | not-applicable |
| interchange.markdown | interchange | ext MarkdownShortcutPlugin | — | — | render-canonical | lossless |
| interchange.canonical-json | interchange | — | — | — | render-canonical | lossless |
| transformer.heading | transformer | tx HEADING | — | node.heading, interchange.markdown | render-canonical | lossless |
| transformer.quote | transformer | tx QUOTE | — | node.quote, interchange.markdown | render-canonical | lossless |
| transformer.code-block | transformer | tx CODE | — | node.code, interchange.markdown | render-canonical | lossless |
| transformer.unordered-list | transformer | tx UNORDERED_LIST | — | node.list, interchange.markdown | render-canonical | lossless |
| transformer.ordered-list | transformer | tx ORDERED_LIST | — | node.list, interchange.markdown | render-canonical | lossless |
| transformer.check-list | transformer | tx CHECK_LIST | — | node.list, interchange.markdown | render-canonical | lossless |
| transformer.inline-code | transformer | tx INLINE_CODE | — | format.inline-code, interchange.markdown | render-canonical | lossless |
| transformer.strong | transformer | tx BOLD_STAR, BOLD_UNDERSCORE | — | format.bold, interchange.markdown | render-canonical | lossless |
| transformer.emphasis | transformer | tx ITALIC_STAR, ITALIC_UNDERSCORE | — | format.italic, interchange.markdown | render-canonical | lossless |
| transformer.strong-emphasis | transformer | tx BOLD_ITALIC_STAR, BOLD_ITALIC_UNDERSCORE | — | format.bold, format.italic, interchange.markdown | render-canonical | lossless |
| transformer.strikethrough | transformer | tx STRIKETHROUGH | — | format.strikethrough, interchange.markdown | render-canonical | lossless |
| transformer.highlight | transformer | tx HIGHLIGHT | — | format.semantic-highlight, interchange.markdown | render-canonical | unsupported |
| transformer.link | transformer | tx LINK | — | node.link, interchange.markdown | render-canonical | lossless |

Notes: the atlas lists `transformer.strong-emphasis` with dependency
`format.bold` only; the descriptor adds `format.italic` because the resolver
needs the true requirement — the reconciliation test therefore checks
`atlas.dependencies ⊆ descriptor.dependencies`, not equality. `node.list-item`
gains `node.list` for the same reason. Every other dependency set is equal to
the atlas.

## 10. Profiles (`profiles.ts`)

- `compatibilityProfile` (`id: "beep-editor.compatibility"`, production):
  `extension.history`, `node.list`, `node.list-item`, `node.link`,
  `interchange.markdown`, every `transformer.*` **except** `transformer.check-list`,
  plus their format/node dependencies (`format.bold`, `format.italic`,
  `format.strikethrough`, `format.inline-code`, `format.semantic-highlight`,
  `node.heading`, `node.quote`, `node.code`). No toolbar/slash/help ⇒ the
  keybinding plugin is not mounted and Lexical-native chords keep working.
  Test: its resolved extensions are exactly
  `[HistoryPlugin, ListPlugin, CheckListPlugin, LinkPlugin, MarkdownShortcutPlugin]`
  and its transformers are exactly the set behind `TRANSFORMERS`.
- `referenceProfiles.minimal` (`id: "beep-editor.reference.minimal"`):
  `format.bold`, `format.italic`, `extension.history`, `authoring.undo`,
  `authoring.redo`, `extension.toolbar`, `extension.shortcut-help`.
- `referenceProfiles.documentProof` (`id: "beep-editor.reference.document-proof"`):
  minimal ∪ `format.strikethrough`, `format.inline-code`, `format.clear`,
  `node.paragraph`, `node.heading`, `node.quote`, `node.code`, `node.list`,
  `node.list-item`, `node.link`, `extension.slash-picker`,
  `interchange.markdown`, `interchange.canonical-json`, and every `lossless`
  `transformer.*` (not `transformer.highlight`).

Both reference profiles are `kind: "production"`: they carry no diagnostics
and must prove the production resolution path (a `development-reference`
kind would let a development-only capability into a proof unnoticed). Both
resolve without error (test), and the same canonical fixture stays readable
under both (Storybook + runtime test).

## 11. Storybook (`stories/capability-profiles.stories.tsx`)

`capabilityProofDocument` in `stories/fixtures.ts` — a canonical `@beep/md`
`Document` with: `Heading` (level 1), paragraph with `Strong`, `Em`, `Del`,
`Code`, and `A`; `Ul` with two items; `TaskList` with one checked item; a
`BlockQuote`; a `Pre` fenced block; a 2×2 `Table`. Projected once through
`documentToEditorState`.

Stories (title `Editor/CapabilityProfiles`, `@storybook/addon-a11y` on):

- `Minimal` — play: toolbar has exactly Bold/Italic/Undo/Redo buttons; help
  lists exactly those four; heading/list/table/link text is visible.
- `DocumentProof` — play: toolbar lists every `toolbar` command of the
  resolved profile; help count equals resolved command count; content visible.
- `SameDocumentBothProfiles` — both composers side by side over the same
  fixture.
- `InvalidProfile` — a profile with `authoring.undo` but no
  `extension.history` renders the `MissingDependencyError` notice and no
  contenteditable.
- `KeybindingConflict` — override `format.italic` to `Ctrl+B` renders the
  `KeybindingConflictError` notice.

Run: `bun run --cwd apps/storybook test:storybook:editor`.

## 12. Desktop panel (`apps/professional-desktop`)

- `src/workspace/dock.atoms.ts`: add
  `{ cluster: "shell", description: "Prove capability profiles over a sample document.", key: "editor-proof", label: "Editor proof", title: "Editor Capability Proof" }`
  to `DESKTOP_PANELS`; it starts **closed** (not in `defaultDesktopWorkspace`)
  and opens from the shell nav like the other shell panels. Update
  `test/dock-shell.test.tsx` (14 panels) and the `App.tsx` header comment.
- `src/editor-proof/EditorProofPanel.tsx` + `EditorProof.atoms.ts` (atom-first,
  no React hooks): atoms for the selected reference profile id, the canonical
  `Md.Document` (seeded from a local copy of the proof fixture — the app owns
  its fixture, do not import from `stories/`), the canonical JSON text
  (`S.encode` of the document through `S.fromJsonString`), and the last
  import failure (`O.Option<string>`). Layout fills the dock box:
  `flex h-full min-h-0 flex-col`, controls row (profile radio group, "Import
  canonical JSON" button, "Reload from canonical" button), editor region
  `flex-1 min-h-0 overflow-auto`, and a collapsible canonical-JSON `textarea`
  (`aria-label`). Profile switch and reload both remount `CapabilityComposer`
  with `key={`${profileId}:${revision}`}` over
  `documentToEditorState(document)`; `onSerializedChange` updates the canonical
  document via `editorStateToDocument`. Import decodes the textarea through the
  `Md.Document` schema and surfaces a typed decode failure inline
  (`role="alert"`). No persistence, no network.
- `src/App.tsx`: `"editor-proof": () => wrap("Editor proof", <EditorProofPanel />)` —
  plain `wrap`, not `wrapDesktop`: the panel has no desktop-RPC dependency and
  `DesktopSessionGate` would otherwise hide a purely local surface whenever no
  authenticated sidecar session exists (browser dev, Storybook-like QA runs).
- Test `test/editor-proof-panel.test.tsx`: renders, switches profile (toolbar
  changes, content persists), imports invalid JSON (alert shown, editor stays).

## 13. Tests to write (all `@effect/vitest`, `Effect.fnUntraced` bodies)

- schemas: round-trip encode/decode for descriptor/profile/resolved;
  `KeyChordFromString` parses the atlas chord vocabulary and rejects `""`,
  `"Ctrl+"`, unknown modifiers; catalog check rejects duplicate ids, duplicate
  command ids, duplicate registration keys.
- resolver: unknown id; development-only in production; missing dependency;
  cycle (two synthetic descriptors); conflict; transformer without markdown;
  unknown override command; keybinding collision (override and authored);
  deterministic success (same input twice ⇒ `Equal.equals`/structural equality
  of encoded output; order independence of `profile.capabilities`).
- projection: toolbar/slash/help are filters of the same `commands` array
  (help length === commands length; every toolbar/slash item's id is a
  resolved command id).
- catalog: atlas reconciliation (read
  `../../../../../goals/lexical-playground-capability-atlas/research/capability-atlas.json`
  with `Bun.file` and decode a lenient slice schema): every non-`beep.` id
  exists; category/disposition equal the atlas entry; `atlas.dependencies ⊆
  descriptor.dependencies`; command ids and keybinding strings equal; the
  descriptor `canonicalCompatibility` equals the atlas `beep-md` row (after the
  §1.4 correction). `editorNodes` parity with the pre-P1 literal list.
- runtime (jsdom, `@lexical/headless` where possible): `chordFromKeyboardEvent`
  digit/letter/punctuation cases; the guard swallows `Ctrl+U` under
  `documentProof` (bit 8 never appears in `onSerializedChange` output) and
  applies bold; remount transaction keeps the canonical document.

## 14. Docs

`packages/foundation/ui-system/editor/README.md` gains a "Capability
profiles" section: ownership (descriptors/resolver in `@beep/editor`, product
profiles in apps), composition (`EditorProfile` → `resolveEditorProfile` →
`CapabilityComposer`), read-only fallback semantics, mount immutability and the
remount transaction, compatibility profile behavior, and how Goal B consumes
the atlas (add descriptors per atlas id, keep the reconciliation test green).

## 15. Laws checklist for implementers

- Effect v4 only; verify every API in `.repos/effect` before use.
- `LiteralKit` for every literal union; no `as` (only `as const`); no `null`;
  no native `Map`/`Set`/array mutation; `A.*`/`O.*`/`Str.*` helpers; `Match`
  over conditional chains where it reads better.
- `Effect.fn`/`Effect.fnUntraced` for generator functions; no `S.*Sync` inside
  Effects.
- JSDoc on every export: lead paragraph, `**Example** (Title)`, `@category`,
  `@since 0.0.0`; no `@example`/`@remarks`.
- Tests import through `@beep/editor/*` aliases.
- Run `bun run --cwd packages/foundation/ui-system/editor check`, `... test`,
  `... lint:fix`, and `bun run docgen:local`; attribute any failure before
  fixing.
