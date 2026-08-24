# Lexical Playground Capability Atlas — Sources & Provenance

- **Source exploration:**
  [`explorations/full-document-editor`](../../../explorations/full-document-editor/README.md)
- **Inherited ledger:**
  [`explorations/full-document-editor/research/SOURCES.md`](../../../explorations/full-document-editor/research/SOURCES.md)
- **Decision authority:**
  [`explorations/full-document-editor/DECISIONS.md`](../../../explorations/full-document-editor/DECISIONS.md)
- **Freshness date:** 2026-08-04

## Mined source corpus

| Source | Pinned identity | Goal-local use | Disposition |
| --- | --- | --- | --- |
| [Live Playground audit](../../../explorations/full-document-editor/research/LEXICAL-PLAYGROUND-LIVE-AUDIT.md) | `playground.lexical.dev`, observed 2026-08-04, runtime `0.49.0+dev.esm` | visible behavior, 17 screenshots, shortcuts, menus, settings, accessibility, explicit gaps | behavioral reference; re-audit on upstream drift |
| [Local source audit](../../../explorations/full-document-editor/research/LEXICAL-PLAYGROUND-SOURCE-AUDIT.md) | `facebook/lexical` commit `a933222c489e7025d87b9217c2489d309fc8a3cf`, package `0.49.0` | registration graph, nodes, extensions, settings, transformers, nested editors, diagnostics | source completeness reference; port only with attribution |
| [Repo research](../../../explorations/full-document-editor/RESEARCH.md) | beep-effect10 at graduation on 2026-08-04 | lawful ownership, current codecs/editor/dock/product constraints | compose existing bricks |

The live audit proves what a user could observe and exercise. The pinned source
audit closes hidden and conditional registration coverage. The repo inventory
decides ownership and prevents upstream demo architecture from becoming local
architecture by accident.

## Upstream license

[facebook/lexical](https://github.com/facebook/lexical) is MIT-licensed; the
license was verified from the pinned local checkout. Preserve attribution for
ported code or distinctive implementation patterns. Behavioral
reimplementation still cites the pinned upstream evidence in atlas entries.

## External references

- [Lexical Playground](https://playground.lexical.dev/)
- [facebook/lexical](https://github.com/facebook/lexical)
- [Full Doc Editor Notion initiative](https://app.notion.com/p/3b269573788d8096b876ed2ad31d151d)

## In-repo authorities and bricks

| Surface | Location | Use in this goal |
| --- | --- | --- |
| Architecture doctrine | `standards/ARCHITECTURE.md`, `standards/architecture/{02,03,06,07}-*.md` | ownership, configuration, shared-kernel and driver boundaries |
| Canonical document model | `packages/foundation/modeling/md` (`@beep/md`) | read/reuse; sole document authority; no new semantics |
| Lexical wire model | `packages/foundation/modeling/lexical` (`@beep/lexical-schema`) | read/reuse; compatibility inventory only |
| Editor projection | `packages/foundation/ui-system/editor` (`@beep/editor`) | capability descriptors, resolver, command/help projection |
| Shared UI | `packages/foundation/ui-system/ui` (`@beep/ui`) | theme and content-editable primitives |
| Dock workspace | `apps/professional-desktop/src/workspace` | synthetic registry-keyed panel proof |
| Isolated proof surface | `apps/storybook` | profile fixtures and interaction proof |
| Rich-text precedent | `goals/rich-text-foundation` | canonical AST and projection contract |
| Pandoc precedent | `goals/pandoc-ast-foundation` | future projection boundary; not an executable driver |
| Workspace product contract | `docs/product/workspace-substrate.md` | panel registry and serializable workspace constraints |
| Portal product contract | `docs/product/prose-to-proof.md` | later evidence/approval consumer, not editor semantics |

## Provenance rule

Each atlas entry must cite exact evidence from the live audit, source audit, or
both. A count without stable IDs is not sufficient. Upstream screenshots are
reference evidence; local implementation acceptance evidence is captured later
under this goal's `history/` with `bun run beep qa`.

## 2026-08-24 — Upstream drift observation and baseline decision

**Observation:** the local checkout at `~/YeeBois/dev/text_editor_ui/lexical`
advanced 43 commits from `a933222` to `fd13a3ca` while remaining on version
`0.49.0`. Four post-pin commits touch Playground behavior:

- `9d907005c` - date-time import;
- `e7fd56e61` - collapsible export;
- `47a3ef26` - mention creation;
- `610cfd95` - Excalidraw cloning.

**Decision:** the v1 evidence baseline remains `a933222`. The four deltas are
known post-pin changes and are excluded from the v1 evidence set. A future
evidence set may deliberately re-pin when the repo bumps Lexical.
