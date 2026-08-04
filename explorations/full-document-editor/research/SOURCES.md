# Full Document Editor — Sources & Provenance

- **Cluster / origin:** user Notion initiative, live Lexical Playground audit,
  pinned upstream source audit, and beep-effect10 repo capability inventory.
- **Provenance:** [`RESEARCH.md`](../RESEARCH.md),
  [`DECISIONS.md`](../DECISIONS.md), and the two detailed audit reports in this
  directory.

## 1. Mined source corpus

| Source | Title | Upstream | Location | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| `lexical-live-2026-08-04` | Lexical Playground live audit | `playground.lexical.dev` | [`LEXICAL-PLAYGROUND-LIVE-AUDIT.md`](./LEXICAL-PLAYGROUND-LIVE-AUDIT.md) | visible behavior, keybindings, screenshots, accessibility | behavioral reference |
| `lexical-source-a933222` | Lexical Playground source audit | `facebook/lexical` | [`LEXICAL-PLAYGROUND-SOURCE-AUDIT.md`](./LEXICAL-PLAYGROUND-SOURCE-AUDIT.md) | node/plugin/settings/transformer completeness | port with attribution |
| `lexical-capability-reference` | Reconciled human-readable capability index | derived from the two pinned audits | [`CAPABILITY-REFERENCE.md`](./CAPABILITY-REFERENCE.md) | nodes, surfaces, activation paths, dispositions, named gaps | Goal A normalization input |
| `beep-editor-context` | Full Doc Editor context audit | beep-effect10 | [`RESEARCH.md`](../RESEARCH.md#2026-08-04--in-repo-capability-inventory) | ownership and collision map | compose existing bricks |

The live audit defines what users can observe. The pinned source audit closes
hidden/conditional feature coverage and cites exact upstream files. The repo
inventory decides lawful ownership and existing capability reuse.

### Pinned source anchors

Every Lexical anchor below is against `facebook/lexical` commit
`a933222c489e7025d87b9217c2489d309fc8a3cf`.

| Source | Repo @ revision | File:line | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/package.json:1-54` | package identity and direct dependencies | retain license/dependency provenance only |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/App.tsx:210-255` | rich-text extension graph | port behavior with attribution |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/App.tsx:257-307` | always-wired extension graph and root nodes | split into owned capabilities |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/App.tsx:309-350` | editor rebuild boundary | adapt as profile immutability rule |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/appSettings.ts:9-44` | complete 29-axis settings domain and defaults | normalize into capability/option atlas entries |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/Settings.tsx:53-236` | visible and development-only settings surfaces | classify by host and activation path |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/setupEnv.ts:14-27` | query-parameter overrides | classify as Playground-only activation plumbing |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/hooks/useSynchronizeSettings.ts:83-126` | live extension-signal settings | adapt as live option projection |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/nodes/PlaygroundNodes.ts:45-84` | 38-class root node registration | reconcile with extension-local nodes |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/PagesExtension/PagesExtension.ts:64-72`; `src/plugins/RubyExtension/index.ts:228-231` | Page, PageContent, and Ruby registrations | reconcile 41 unique effective node classes |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/Editor.tsx:94-183` | rendered and conditional authoring surfaces | normalize activation paths and host gates |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/ComponentPickerPlugin/index.tsx:117-144`; `:149-420` | slash commands, blocks, and dynamic tables | normalize commands and block insertions |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/ToolbarPlugin/index.tsx:957-1498` | toolbar, formatting, page setup, inserts, and shortcut help | normalize commands and affordances |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/ShortcutsPlugin/shortcuts.ts:15-53` | platform-specific shortcut labels | normalize bindings and generated help |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/MarkdownTransformers/index.ts:56-216`; `:360-372` | Playground transformers and composition | reconcile with canonical Markdown projection |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-markdown/src/MarkdownTransformers.ts:933-960` | standard transformer families | reconcile with canonical Markdown projection |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/ActionsPlugin/index.tsx:94-180`; `:286-407` | source conversion and document actions | classify interchange versus demo actions |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/themes/PlaygroundEditorTheme.css:50-52`; `:621-636`; `:676-679` | highlight, comment, and special-text visuals | preserve distinct semantics |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/TableActionMenuPlugin/index.tsx:468-646` | table editing surface | normalize table commands and capability gates |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/LayoutExtension/InsertLayoutDialog.tsx:18-24` | column presets | record layout options |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/plugins/PagesExtension/constants.ts:10-36`; `src/plugins/PagesReactExtension/PageSetupDropdown.tsx:23-58`; `:104-199` | page sizes, defaults, margins, orientation, and UI | record page-layout options |
| `lexical-source-a933222` | `facebook/lexical@a933222` | `packages/lexical-playground/src/App.tsx:383-397`; `:421-445`; `src/Editor.tsx:120-124` | collaboration v1/v2 and comment constraints | defer to collaboration-owned later goal |

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What we take |
| --- | --- | --- | --- |
| [facebook/lexical](https://github.com/facebook/lexical) at `a933222c489e7025d87b9217c2489d309fc8a3cf` | MIT, verified from local `LICENSE` | port with attribution or clean reimplementation | behavior, node/plugin patterns, transformers, commands, accessibility patterns; never vendor the Playground monolith |

## 3. External research sources

- [Lexical Playground](https://playground.lexical.dev/) — live behavior reference.
- [facebook/lexical](https://github.com/facebook/lexical) — pinned upstream source.
- [Full Doc Editor Notion initiative](https://app.notion.com/p/3b269573788d8096b876ed2ad31d151d) — product intent and resolved decisions.

## 4. In-repo capability references

| Capability | Path | Disposition |
| --- | --- | --- |
| `@beep/md` | `packages/foundation/modeling/md` | reuse and later extend as canonical document model |
| `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | inventory in Goal A; extend in Goal B batches |
| `@beep/editor` | `packages/foundation/ui-system/editor` | extend with capability/profile contract and proof |
| `@beep/ui` | `packages/foundation/ui-system/ui` | reuse theme and editor primitives |
| `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | reuse in later DOCX goal |
| `@beep/provenance` | `packages/foundation/modeling/provenance` | reuse anchor substrate |
| Professional Desktop dock | `apps/professional-desktop/src/workspace` | extend with registry-keyed synthetic proof panel |
| Prose-to-Proof | `docs/product/prose-to-proof.md` | later Portal consumer |
| Workspace substrate | `docs/product/workspace-substrate.md` | governing panel and serializable-state constraints |

## 5. Cross-links and provenance

- Goal A: `goals/lexical-playground-capability-atlas`
- Goal A inherits this ledger as
  `goals/lexical-playground-capability-atlas/research/SOURCES.md`.
- The Notion initiative remains the product/evidence hub; repository goal
  packets are normative execution contracts.
