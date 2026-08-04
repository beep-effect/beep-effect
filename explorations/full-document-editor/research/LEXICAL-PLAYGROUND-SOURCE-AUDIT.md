# Lexical Playground source audit

- Source: `/home/elpresidank/YeeBois/dev/text_editor_ui/lexical/packages/lexical-playground/`
- Package version: `0.49.0`
- Revision: `a933222c489e7025d87b9217c2489d309fc8a3cf`
- Revision date: `2026-08-02T21:12:23+02:00`
- Audit date: `2026-08-04`
- Mode: read-only; the Lexical checkout and beep-effect10 worktree were not changed

This report inventories the full top-level feature-registration graph of the local
Lexical Playground source. It complements
[`LEXICAL-PLAYGROUND-LIVE-AUDIT.md`](./LEXICAL-PLAYGROUND-LIVE-AUDIT.md).

## Executive summary

The audited Playground is an official upstream `main` revision, not a local feature
fork. Its source graph contains 38 root-registered node classes and at least 41 unique
rich-text node classes after page and ruby extensions are included. No unexplained
top-level feature registration remained after the audit.

The feature surface is not representable as a flat boolean bag. A complete capability
model must separately account for node registration, runtime extensions, authoring UI,
commands, keybindings, Markdown/HTML/JSON interchange, read-only behavior,
collaboration constraints, nested editors, page/layout metadata, and development tools.

## Root composition

Primary evidence:

- `src/App.tsx`
- `src/Editor.tsx`
- `src/appSettings.ts`
- `src/setupEnv.ts`
- `src/Settings.tsx`
- `src/hooks/useSynchronizeSettings.ts`
- `src/nodes/PlaygroundNodes.ts`

Only three settings rebuild the editor and may discard editor-local content, selection,
and history: `isCollab`, `emptyEditor`, and `isRichText`. Other settings are wired as
live extension signals.

The always-wired application extension includes autofocus; clear/editable state;
history and announcements; keywords, hashtags, dates, emoji, mentions, validated links,
and auto-links; maximum length; bracket special text; drag/drop/paste; selection
retention and block selection; HTML import/render/export; click-after-last-block;
autocomplete; visible non-printing characters; focus trapping; roving tab index; and
focus management.

The rich-text extension graph adds tables, images, horizontal rules, page breaks,
X/YouTube/Figma embeds, collapsibles, code highlighting, lists/checklists, Markdown
shortcuts, paginated pages, polls, equations, columns, Excalidraw, cards, reviews,
find/replace, pull quotes, ruby annotations, and bounded tab indentation. Plain-text mode
replaces this graph with `PlainTextExtension`.

## Settings matrix

| Setting | Default | Meaning |
| --- | ---: | --- |
| `emptyEditor` | host-dependent | Empty locally; welcome document on official host |
| `hasFitNestedTables` | false | Fit behavior for nested tables |
| `hasLinkAttributes` | false | Add safe new-tab link attributes |
| `hasNestedTables` | false | Permit tables inside table cells |
| `isAutocomplete` | false | Ghost-text autocomplete |
| `isCharLimit` | false | Five-character UTF-16 demo limiter |
| `isCharLimitUtf8` | false | Five-character UTF-8 demo limiter |
| `isCodeHighlighted` | true | Syntax highlighting |
| `isCodeShiki` | false | Shiki instead of Prism |
| `isCollab` | false | Yjs collaboration |
| `isMaxLength` | false | Thirty-character demo limiter |
| `isRichText` | true | Rich-text versus plain-text runtime |
| `isShadowDOM` | false | Render the editor shell in Shadow DOM |
| `isVisibleNonPrinting` | false | Render non-printing characters |
| `listStrictIndent` | false | Strict list indentation |
| `measureTypingPerf` | false | Typing performance logger |
| `selectBlock` | true | Cascading block selection |
| `selectionAlwaysOnDisplay` | false | Retain visual selection |
| `shouldAllowHighlightingWithBrackets` | false | `[text]` special highlight syntax |
| `shouldDisableFocusOnClickChecklist` | false | Checklist click-focus behavior |
| `shouldPreserveNewLinesInMarkdown` | false | Markdown newline policy |
| `shouldUseLexicalContextMenu` | false | Custom editor context menu |
| `showNestedEditorTreeView` | false | Image-caption nested debug tree |
| `showTableOfContents` | false | Table of contents |
| `showTreeView` | true | Debug tree and time travel |
| `tableCellBackgroundColor` | true | Cell backgrounds |
| `tableCellMerge` | true | Cell merging |
| `tableHorizontalScroll` | true | Horizontal table scroll |
| `useCollabV2` | false | Experimental collaboration v2 |

Settings may also be overridden from URL query parameters. Development-host-only
settings include collaboration and split-screen controls. Some axes are query-only and
do not appear as visible switches.

## Node inventory

`src/nodes/PlaygroundNodes.ts` registers 38 classes:

1. HeadingNode
2. ListNode
3. ListItemNode
4. QuoteNode
5. CodeNode
6. TableNode
7. TableCellNode
8. TableRowNode
9. HashtagNode
10. CodeHighlightNode
11. AutoLinkNode
12. LinkNode
13. OverflowNode
14. PollNode
15. StickyNode
16. ImageNode
17. MentionNode
18. EmojiNode
19. ExcalidrawNode
20. EquationNode
21. KeywordNode
22. HorizontalRuleNode
23. TweetNode
24. YouTubeNode
25. FigmaNode
26. MarkNode
27. CollapsibleContainerNode
28. CollapsibleContentNode
29. CollapsibleTitleNode
30. PageBreakNode
31. LayoutContainerNode
32. LayoutItemNode
33. SpecialTextNode
34. DateTimeNode
35. CardNode
36. SlotContainerNode
37. ReviewNode
38. PullQuoteNode

Rich-text extensions additionally register `PageNode`, `PageContentNode`, and `RubyNode`,
for at least 41 unique effective node classes. Repeated extension-local registration is
intentional ownership, not an additional node type. `Card`, `Review`, `PullQuote`, and
`SlotContainer` are real upstream features at this revision.

## Authoring surfaces

The toolbar exposes undo/redo; paragraph and heading/list/quote/code block formats; six
font families; typed and stepped 10–20 px sizes; bold, italic, underline, inline code,
link, ruby, text color, background color, casing, strikethrough, subscript,
superscript, semantic highlight, clear formatting, page setup, inserts, alignment,
indentation, and shortcut help.

The insert menu exposes horizontal rules, page breaks, images/GIFs, Excalidraw, tables,
polls, columns, equations, sticky notes, collapsibles, dates, X, YouTube, and Figma.

The slash/component picker additionally exposes ordinary block transforms, relative date
commands, Card, Pull Quote, Review, and alignment commands. Dynamic `/RxC` table syntax
accepts 1–99 rows and columns. Desktop draggable-block insertion uses the same picker and
supports insert-above modifiers.

The desktop floating-selection toolbar exposes text formatting, casing, links, and
comments. Code selections replace general block controls with language/theme and code
actions. Image-caption nested editors suppress inapplicable controls.

## Keyboard shortcuts

Canonical evidence: `src/plugins/ShortcutsPlugin/shortcuts.ts`.

The source defines this platform-specific table:

| Action | Windows/Linux | Apple |
| --- | --- | --- |
| Paragraph | Ctrl+Alt+0 | Cmd+Option+0 |
| Heading 1 | Ctrl+Alt+1 | Cmd+Option+1 |
| Heading 2 | Ctrl+Alt+2 | Cmd+Option+2 |
| Heading 3 | Ctrl+Alt+3 | Cmd+Option+3 |
| Numbered list | Ctrl+Shift+7 | Cmd+Shift+7 |
| Bullet list | Ctrl+Shift+8 | Cmd+Shift+8 |
| Check list | Ctrl+Shift+9 | Cmd+Shift+9 |
| Code block format | Ctrl+Alt+C | Cmd+Option+C |
| Quote | Ctrl+Shift+Q | Control+Shift+Q |
| Add comment | Ctrl+Alt+M | Cmd+Option+M |
| Increase font size | Ctrl+Shift+. | Cmd+Shift+. |
| Decrease font size | Ctrl+Shift+, | Cmd+Shift+, |
| Inline code format | Ctrl+Shift+C | Cmd+Shift+C |
| Strikethrough | Ctrl+Shift+X | Cmd+Shift+X |
| Lowercase | Ctrl+Shift+1 | Control+Shift+1 |
| Uppercase | Ctrl+Shift+2 | Control+Shift+2 |
| Capitalize | Ctrl+Shift+3 | Control+Shift+3 |
| Center align | Ctrl+Shift+E | Cmd+Shift+E |
| Justify align | Ctrl+Shift+J | Cmd+Shift+J |
| Left align | Ctrl+Shift+L | Cmd+Shift+L |
| Right align | Ctrl+Shift+R | Cmd+Shift+R |
| Subscript | Ctrl+, | Cmd+, |
| Superscript | Ctrl+. | Cmd+. |
| Indent | Ctrl+] | Cmd+] |
| Outdent | Ctrl+[ | Cmd+[ |
| Clear formatting | Ctrl+\\ | Cmd+\\ |
| Redo | Ctrl+Y | Cmd+Shift+Z |
| Undo | Ctrl+Z | Cmd+Z |
| Bold | Ctrl+B | Cmd+B |
| Italic | Ctrl+I | Cmd+I |
| Underline | Ctrl+U | Cmd+U |
| Link | Ctrl+K | Cmd+K |

Find/replace adds Ctrl/Cmd+F to open or focus, Cmd+Option+F as an additional
Apple open binding, Ctrl/Cmd+G for next, the Shift-modified binding for
previous, Enter/Shift+Enter for next/previous, Escape to close, and Tab focus
trapping. Autocomplete accepts by Tab, Right Arrow, or swipe-right.

The live audit independently records the Windows/Linux help dialog and visible
shortcut labels.

## Markdown and source conversion

Playground-specific transformers precede standard Lexical transformers:

- table pipe syntax
- horizontal rules
- images
- emoji aliases
- inline and block equations
- Tweet elements
- checklists

Standard transformers add H1–H6, quotes, bullet and ordered lists, fenced code, inline
code, bold/italic combinations, semantic `==highlight==`, strikethrough, and links. The
same transformer set drives typing shortcuts and WYSIWYG-to-Markdown conversion.

HTML source mode uses the DOM import/export pipeline and Prettier. JSON import/export and
a compressed share-URL format expose raw Playground editor state. Page behavior is
disabled while a source-mode code block replaces the root. Terse HTML export removes
theme classes and avoidable presentation noise. Arbitrary inline CSS import is
deliberately constrained.

## Highlighting systems

The source contains seven separate emphasis/annotation mechanisms:

1. semantic text-format highlight (`==text==` in Markdown)
2. arbitrary inline background color
3. MarkNode-backed comment ranges and threads
4. bracket-special `SpecialTextNode`
5. transient find/replace match highlights
6. collaboration selections
7. retained-selection display

These are independent features and cannot share one persistence or configuration flag.

## Structured blocks

- **Card:** named single-line title slot plus rich body slot, keyboard traversal, HTML
  import/export.
- **Review:** 0–5 star rating, author slot, rich body, accessible rating controls, HTML
  import/export.
- **Pull quote:** multi-block quote and attribution slots with explicit keyboard/delete
  behavior and HTML interchange.
- **Ruby:** selection wrapping, floating annotation editor, `<ruby><rt>` interchange,
  composition/boundary handling.
- **Collapsible:** `<details>/<summary>` title and rich content.
- **Columns:** five grid presets, post-insert layout changes, terminal-layout arrow
  handling.
- **Poll:** question, at least two editable options, per-user votes, results, HTML data
  attributes.
- **Sticky:** draggable positioned nested editor with color and delete controls.
- **Date/time:** absolute and relative insertion, inline editing, optional time/timezone,
  custom HTML and Google Docs import.
- **Equation:** inline/block KaTeX, accessible labels, dialogs, `$`/`$$` Markdown.
- **Excalidraw:** serialized drawing state, modal editing, selectable preview.
- **Images:** URL/file/sample/paste/drop inputs, alt text, dimensions, caption nested
  editor, resize, selection/deletion, figure/caption import.
- **Embeds:** X, YouTube, Figma, plus URL recognition and insertion dialogs.
- **Entities/assistive input:** mentions, hashtags, emoji, keywords, autocomplete, visible
  non-printing characters.

## Tables

Tables support insertion, merge/unmerge, background color, vertical alignment, row
striping, frozen row/column, insert/delete rows and columns, header toggles, resizing,
sticky scrollbars, horizontal scroll/shadow, desktop sorting and column drag/reorder,
nested tables, and fit-nested behavior. These are independent capability axes, not one
`tables` boolean.

The dialog accepts 1–500 rows and 1–50 columns; slash syntax is intentionally more
bounded. Fit-nested mode suppresses horizontal scrolling.

## Pages and pagination

Default mode is pageless. Fixed page mode registers Page/PageContent nodes and performs
automatic overflow/underflow pagination around explicit page breaks.

Page sizes: A4, Letter, Legal, Tabloid, A3, A5, B4, B5, Statement, Executive, Folio.

Orientations: portrait and landscape.

Margin presets: Narrow 0.25 in, Normal 0.4 in, Moderate 0.75 in, Wide 1 in. The first
fixed-page default is A4 portrait with 0.4 in margins.

## Collaboration, comments, and speech

Collaboration is rich-text only. V1 uses Yjs, websocket provider, remote selections, and
a separate collaborative comment document while disabling local history. Experimental
V2 uses a non-GC Yjs document and a version browser but explicitly excludes comments.

Speech-to-text is browser-capability-gated and uses continuous recognition. It inserts
finalized text, recognizes newline, undo, and redo commands, and contains duplicate/shrunk
interpretation guards.

## Accessibility

The source contains history/editor-mode announcements, focus management/trapping,
roving-tabindex support, named toolbars, shortcut-aware labels, modal dialog semantics,
content-editable placeholders, settings switches, listbox options, find/replace dialog
semantics, equation labels, accessible review ratings, image alt text, node action labels,
table controls, and alert/dialog flash messages.

The live audit identifies remaining gaps: unlabeled settings and color controls, some
generic popover semantics, horizontal toolbar overflow, and the need for mobile,
screen-reader, contrast, and focus-order proof.

## Development-only and demonstration-oriented surfaces

Development-host-only surfaces include collaboration toggle visibility, split screen,
DocsPlugin, PasteLogPlugin, and TestRecorderPlugin. Conditional diagnostics include typing
performance, nested editor tree views, table of contents, custom context menu, tree/state
view, and time travel. The official page also carries Vercel analytics and speed insights.

Demonstration-oriented features that should not automatically become production defaults
include tiny character limits, simulated dictionary autocomplete, speech recognition,
split screen, paste logs, test recorders, debug/time travel, typing performance,
experimental collaboration versions, analytics, and bundled sample media.

## Capability-model implications

A complete `@beep/editor` capability descriptor must be able to declare:

1. canonical semantic model support
2. Lexical node registration
3. runtime/plugin dependencies
4. toolbar and contextual authoring UI
5. slash/component picker exposure
6. commands and platform keybindings
7. Markdown typing/import/export behavior
8. HTML/JSON import/export behavior
9. read-only behavior
10. collaboration compatibility
11. nested-editor requirements
12. page/layout metadata
13. development-only classification

Completeness traps:

- hiding a toolbar button does not disable its shortcut, slash command, importer, or node;
- disabling insertion must not make existing supported content unreadable;
- semantic highlight, background color, comments, search, collaboration, and retained
  selection are distinct;
- nested editors occur in images and sticky notes while Card/Review/PullQuote use slots;
- collaboration v2 excludes comments;
- source-mode conversion may lose blocks that lack transformers;
- tables contain several independent capability axes;
- desktop-only dragging/floating/table affordances require mobile alternatives;
- official live defaults differ from local development defaults.

## Residual verification items

- actual screen-reader behavior and full keyboard focus traversal
- narrow/mobile/touch behavior for desktop-only affordances
- browser permission behavior for clipboard and speech recognition
- every structured node's edit/undo/copy/paste/delete lifecycle
- every custom node's Markdown/HTML/JSON round-trip fidelity
- merged/nested table sorting and column-drag edge cases
- runtime-filtered Prism/Shiki language and theme lists
