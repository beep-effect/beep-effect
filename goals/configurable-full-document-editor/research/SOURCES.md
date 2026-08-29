# Configurable Full Document Editor: Sources and Provenance

- **Source exploration:**
  [`explorations/full-document-editor`](../../../explorations/full-document-editor/README.md)
- **Primary ledger:**
  [`explorations/full-document-editor/research/SOURCES.md`](../../../explorations/full-document-editor/research/SOURCES.md)
- **Decision authority:**
  [`explorations/full-document-editor/DECISIONS.md`](../../../explorations/full-document-editor/DECISIONS.md)
- **Prerequisite contract:**
  [`goals/lexical-playground-capability-atlas`](../../lexical-playground-capability-atlas/README.md)
- **Carry-forward date:** 2026-08-24

The exploration ledger remains primary. This copy carries its source corpus
forward so Goal B can plan semantic batches without treating exploration prose
as a second implementation contract. Goal A's delivered atlas/profile contract
will become the direct P0 input after its completion gate is satisfied.

## 1. Mined source corpus

| Source | Title | Upstream | Location | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| `lexical-live-2026-08-04` | Lexical Playground live audit | `playground.lexical.dev` | [`LEXICAL-PLAYGROUND-LIVE-AUDIT.md`](../../../explorations/full-document-editor/research/LEXICAL-PLAYGROUND-LIVE-AUDIT.md) | visible behavior, keybindings, screenshots, accessibility | behavioral reference |
| `lexical-source-a933222` | Lexical Playground source audit | `facebook/lexical` | [`LEXICAL-PLAYGROUND-SOURCE-AUDIT.md`](../../../explorations/full-document-editor/research/LEXICAL-PLAYGROUND-SOURCE-AUDIT.md) | node/plugin/settings/transformer completeness | port with attribution |
| `lexical-capability-reference` | Reconciled human-readable capability index | derived from the two pinned audits | [`CAPABILITY-REFERENCE.md`](../../../explorations/full-document-editor/research/CAPABILITY-REFERENCE.md) | nodes, surfaces, activation paths, dispositions, named gaps | Goal A normalization input |
| `beep-editor-context` | Full Doc Editor context audit | beep-effect10 | [`RESEARCH.md`](../../../explorations/full-document-editor/RESEARCH.md#2026-08-04--in-repo-capability-inventory) | ownership and collision map | compose existing bricks |

The live audit defines observable behavior. The pinned source audit closes
hidden and conditional feature coverage. The repo inventory decides ownership
and reuse. Goal B consumes the ratified Goal A atlas rather than reinterpreting
these sources independently.

### Pinned source anchors

Every Lexical anchor below is against `facebook/lexical` commit
`a933222c489e7025d87b9217c2489d309fc8a3cf`.

| Source | Repo at revision | File:line | Evidence | Goal B use |
| --- | --- | --- | --- | --- |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/package.json:1-54` | package identity and direct dependencies | retain license and dependency provenance |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/App.tsx:210-255` | rich-text extension graph | consume ratified capability ownership |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/App.tsx:257-307` | always-wired extension graph and root nodes | implement ratified production semantics in batches |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/App.tsx:309-350` | editor rebuild boundary | preserve profile mount immutability |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/appSettings.ts:9-44` | complete 29-axis settings domain and defaults | separate reusable capability options from demo settings |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/Settings.tsx:53-236` | visible and development-only settings | implement only ratified production dispositions |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/setupEnv.ts:14-27` | query-parameter overrides | reject private document URL state and demo plumbing |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/hooks/useSynchronizeSettings.ts:83-126` | live extension-signal settings | project allowed options through the resolved profile |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/nodes/PlaygroundNodes.ts:45-84` | 38-class root node registration | reconcile every production-eligible node batch |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/PagesExtension/PagesExtension.ts:64-72`; `src/plugins/RubyExtension/index.ts:228-231` | Page, PageContent, and Ruby registrations | include extension-local nodes in batch identity |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/Editor.tsx:94-183` | rendered and conditional authoring surfaces | prove all activation and read-only paths |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/ComponentPickerPlugin/index.tsx:117-144`; `:149-420` | slash commands, blocks, and dynamic tables | project inserts from the ratified registry |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx:957-1498` | toolbar, formatting, page setup, inserts, and shortcut help | keep controls and command state consistent |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/ShortcutsPlugin/shortcuts.ts:15-53` | platform-specific shortcut labels | derive bindings and help from one command source |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts:56-216`; `:360-372` | Playground transformers and composition | reconcile canonical Markdown projection by batch |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-markdown/src/MarkdownTransformers.ts:933-960` | standard transformer families | prove supported and lossy transformations explicitly |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/ActionsPlugin/index.tsx:94-180`; `:286-407` | source conversion and document actions | separate lawful interchange from demo actions |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/themes/PlaygroundEditorTheme.css:50-52`; `:621-636`; `:676-679` | highlight, comment, and special-text visuals | preserve distinct schema meanings |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/TableActionMenuPlugin/index.tsx:468-646` | table editing surface | implement complete table mechanics when ratified |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/LayoutExtension/InsertLayoutDialog.tsx:18-24` | column presets | model portable layout options |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/PagesExtension/constants.ts:10-36`; `src/plugins/PagesReactExtension/PageSetupDropdown.tsx:23-58`; `:104-199` | page sizes, defaults, margins, orientation, and UI | implement page semantics and print-preview proof, not authoritative PDF |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/App.tsx:383-397`; `:421-445`; `src/Editor.tsx:120-124` | collaboration v1/v2 and comment constraints | preserve later-goal boundaries |

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What Goal B may take |
| --- | --- | --- | --- |
| [facebook/lexical](https://github.com/facebook/lexical) at `a933222c489e7025d87b9217c2489d309fc8a3cf` | MIT, verified from local `LICENSE` | port with attribution or clean reimplementation | behavior, node/plugin patterns, transformers, commands, and accessibility patterns; never the Playground monolith |

Preserve attribution for ported code or distinctive implementation patterns.
Behavioral reimplementation still cites the ratified atlas and pinned upstream
evidence.

## 3. External research sources

- [Lexical Playground](https://playground.lexical.dev/) - live behavior reference.
- [facebook/lexical](https://github.com/facebook/lexical) - pinned upstream source.
- [Full Doc Editor Notion initiative](https://app.notion.com/p/3b269573788d8096b876ed2ad31d151d)
  - product intent and resolved decisions.

## 4. In-repo capability references

| Capability | Path | Goal B disposition |
| --- | --- | --- |
| `@beep/md` | `packages/foundation/modeling/md` | extend as the sole canonical document model in ratified semantic batches |
| `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | extend wire schemas, codecs, normalization, and projections by batch |
| `@beep/editor` | `packages/foundation/ui-system/editor` | consume Goal A's registry/resolver and implement authoring mechanics |
| `@beep/ui` | `packages/foundation/ui-system/ui` | reuse shared theme and content-editable primitives |
| `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | compatibility target only; executable driver stays in `pandoc-docx-driver` |
| `@beep/provenance` | `packages/foundation/modeling/provenance` | later annotation and Portal composition; do not collapse into highlights |
| Professional Desktop dock | `apps/professional-desktop/src/workspace` and `apps/professional-desktop/src/App.tsx` | registry-keyed proof without product persistence |
| Storybook | `apps/storybook` and `packages/foundation/ui-system/editor/stories` | isolated profile, interaction, and compatibility proof |
| Rich-text precedent | `goals/rich-text-foundation` | canonical AST and projection contract |
| Pandoc precedent | `goals/pandoc-ast-foundation` | future projection boundary, not an executable driver |
| Workspace product contract | `docs/product/workspace-substrate.md` | panel registry and serializable workspace boundaries |
| Portal product contract | `docs/product/prose-to-proof.md` | later evidence/approval consumer, not editor semantics |

## 5. Cross-links and provenance

- Primary exploration ledger:
  [`explorations/full-document-editor/research/SOURCES.md`](../../../explorations/full-document-editor/research/SOURCES.md).
- Binding decisions:
  [`explorations/full-document-editor/DECISIONS.md`](../../../explorations/full-document-editor/DECISIONS.md).
- Goal A prerequisite:
  [`goals/lexical-playground-capability-atlas`](../../lexical-playground-capability-atlas/README.md).
- Goal B decision log:
  [`SPEC.md`](../SPEC.md#decision-log).
- The Notion initiative remains a product/evidence hub. Repository goal packets
  remain the normative execution contracts.
