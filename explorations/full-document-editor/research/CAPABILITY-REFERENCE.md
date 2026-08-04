# Lexical Playground Capability Reference

This is the human-readable parity index for the Full Document Editor initiative.
It reconciles the [live Chrome audit](./LEXICAL-PLAYGROUND-LIVE-AUDIT.md) with
the [pinned source audit](./LEXICAL-PLAYGROUND-SOURCE-AUDIT.md). It is not yet
the machine-validated Goal A atlas.

## Snapshot identity

| Field | Value |
| --- | --- |
| Live target | <https://playground.lexical.dev/> |
| Live audit | 2026-08-04 |
| Runtime | `Playground`, `0.49.0+dev.esm` |
| Source | `/home/elpresidank/YeeBois/dev/text_editor_ui/lexical/packages/lexical-playground/` |
| Package | `0.49.0` |
| Commit | `a933222c489e7025d87b9217c2489d309fc8a3cf` |
| License | MIT, verified from the pinned checkout |
| Visual evidence | [17 screenshots](../assets/) |

Evidence terms are strict: **observed** appeared in live UI/accessible DOM;
**exercised** was interacted with; **source-verified** is grounded in the pinned
registration graph; **unverified** is a named follow-up, not assumed behavior.

## Completeness rule

A capability is not accounted for merely because its toolbar button is listed.
Parity must reconcile all applicable activation paths:

1. canonical semantic and read-only fallback;
2. Lexical node and extension registration;
3. toolbar and floating/contextual UI;
4. slash/component picker and draggable-block picker;
5. keyboard command and generated shortcut help;
6. Markdown typing/import/export;
7. HTML, JSON, paste/drop, and programmatic import/export;
8. nested-editor, page-layout, collaboration, and diagnostic dependencies;
9. accessibility, responsive/touch alternative, and network behavior.

## Surface inventory

| Family | Live/source surface | Initiative disposition |
| --- | --- | --- |
| Core editing | paragraphs, H1-H6 source support, quotes, undo/redo, selection, clipboard, drag/drop/paste, read-only, click-after-last-block | implement/generalize in Goal B |
| Lists | ordered, unordered, checklists, strict-indent option, tab indentation to depth 7 | implement/generalize in Goal B |
| Typography | six fonts, 10-20 px typed/step size, bold, italic, underline, strike, inline code, sub/superscript, casing, clear formatting | portable typed style work in Goal B |
| Highlighting | semantic highlight, arbitrary text/background color, comments, bracket special text, find matches, collaboration selections, retained selection | keep seven meanings distinct |
| Links | manual links, auto-links, URL/email validation, optional safe new-tab attributes, clickable read-only links | implement in Goal B |
| Code | block/inline code, Prism or Shiki highlighting, language/theme selection, copy, Prettier, boundary escape | implement/generalize; formatter policy injected |
| Tables | insertion, headers, merge, background, alignment, resize, sorting, row/column operations, drag reorder, nested/fit/scroll axes | implement as several dependent capabilities |
| Pages | pageless/fixed pages, 11 sizes, portrait/landscape, four margin presets, automatic pagination, explicit breaks | implement with canonical presentation metadata |
| Media | images, files, GIF fixture, paste/drop, resize, caption nested editor, alt text, Excalidraw | artifact-reference-first; no ambient egress |
| Embeds | X, YouTube, Figma, URL recognition/dialogs | sanitized reference; inert until authorized |
| Structured blocks | Card, Review, Pull Quote, Poll, Sticky, Collapsible, Columns, Date/Time, Equation, Ruby | generic document structure/authoring in Goal B; identity-bearing sidecars stay slice-owned |
| Assistive entry | slash picker, mentions, hashtags, emoji, keywords, autocomplete, visible non-printing, speech-to-text | generalize providers/policies; typed unavailable states |
| Find/replace | literal/regex, case, next/previous, replace current/all, focus trap | implement in Goal B |
| Interchange | Markdown/HTML source mode, JSON import/export, terse DOM export, compressed share URL | non-destructive projections; raw Lexical/debug URL model rejected for production |
| Comments | MarkNode ranges, threads, replies, panel, collaboration-v1 comment doc | revision-anchored sidecar model; later owning-slice work |
| Collaboration | Yjs v1, remote selections, shared comments; experimental v2 versions without comments | separately deferred goal |
| Diagnostics | tree/state view, time travel, nested tree, typing perf, TOC, custom context menu, test recorder, paste log, split screen | tracked; development-reference profile only |

## Effective node ledger

`PlaygroundNodes.ts` root-registers 38 classes. Pages and Ruby add three more
in the rich-text extension graph. Core Lexical nodes are implicit runtime
substrate and are listed separately after the registered ledger.

| Stable research ID | Class | Kind and role | Primary activation | Disposition |
| --- | --- | --- | --- | --- |
| `node.heading` | `HeadingNode` | block; H1-H6 | block menu, slash, shortcuts, Markdown | implement |
| `node.list` | `ListNode` | block container; ordered, bullet, check | block menu, slash, shortcuts, Markdown | implement |
| `node.list-item` | `ListItemNode` | list item/check state | list editing, Markdown | implement |
| `node.quote` | `QuoteNode` | block quote | block menu, slash, shortcut, Markdown | implement |
| `node.code` | `CodeNode` | fenced/code block | block menu, toolbar, slash, shortcut, Markdown | implement |
| `node.table` | `TableNode` | table block | insert, slash `/RxC`, Markdown/HTML import | implement as bundle root |
| `node.table-cell` | `TableCellNode` | table cell/header state | table actions/import | implement |
| `node.table-row` | `TableRowNode` | table row | table actions/import | implement |
| `node.hashtag` | `HashtagNode` | inline recognized entity | typing transform | implement/generalize |
| `node.code-highlight` | `CodeHighlightNode` | token within highlighted code | code highlighter | projection-local |
| `node.auto-link` | `AutoLinkNode` | validated automatic link | URL/email transform | implement |
| `node.link` | `LinkNode` | authored link | toolbar, floating toolbar, shortcut, Markdown/HTML | implement |
| `node.overflow` | `OverflowNode` | inline marker for limit overflow | character-limit policies | generalize policy |
| `node.poll` | `PollNode` | question/options block plus upstream per-user votes | insert, slash | Goal B may own question/options projection; responses/voter identity require an owning product slice |
| `node.sticky` | `StickyNode` | positioned nested-editor note | insert menu | implement; responsive alternative required |
| `node.image` | `ImageNode` | image plus optional nested caption | insert, slash, paste/drop, HTML | artifact-reference generalization |
| `node.mention` | `MentionNode` | inline selected entity | `@` typeahead/import | implement with injected source |
| `node.emoji` | `EmojiNode` | inline emoji token | alias transform/picker | implement |
| `node.excalidraw` | `ExcalidrawNode` | embedded drawing state/preview | insert, slash | implement with artifact policy |
| `node.equation` | `EquationNode` | inline/block math | insert, slash, `$`/`$$` Markdown | implement |
| `node.keyword` | `KeywordNode` | recognized inline keyword entity | typing transform | generalize or explicit waiver |
| `node.horizontal-rule` | `HorizontalRuleNode` | thematic divider | insert, slash, Markdown | implement |
| `node.tweet` | `TweetNode` | X/Tweet reference embed | insert, slash, auto-embed, Markdown element | inert reference generalization |
| `node.youtube` | `YouTubeNode` | YouTube reference embed | insert, slash, auto-embed | reuse/generalize `@beep/md` YouTube |
| `node.figma` | `FigmaNode` | Figma reference embed | insert, slash, auto-embed | inert reference generalization |
| `node.mark` | `MarkNode` | inline range carrier for comments | selection toolbar, shortcut | projection of sidecar annotations |
| `node.collapsible-container` | `CollapsibleContainerNode` | `<details>` block container | insert, slash | implement |
| `node.collapsible-content` | `CollapsibleContentNode` | rich collapsible body | collapsible editing/import | implement |
| `node.collapsible-title` | `CollapsibleTitleNode` | `<summary>` title | collapsible editing/import | implement |
| `node.page-break` | `PageBreakNode` | explicit pagination boundary | insert, slash | implement with canonical metadata |
| `node.layout-container` | `LayoutContainerNode` | column-grid container | insert, slash | implement with portable layout domain |
| `node.layout-item` | `LayoutItemNode` | one column content region | layout editing | implement |
| `node.special-text` | `SpecialTextNode` | bracket-triggered highlighted entity | optional `[text]` transform | generalize or waiver; not semantic highlight |
| `node.date-time` | `DateTimeNode` | editable date/time/timezone pill | insert, slash relative dates | implement with typed value |
| `node.card` | `CardNode` | named title/body slot block | slash picker | implement/generalize |
| `node.slot-container` | `SlotContainerNode` | named slot substrate for structured blocks | Card/Review/Pull Quote internals | projection/runtime substrate |
| `node.review` | `ReviewNode` | rating/author label/rich body demo block | slash picker | Goal B may own generic authored structure; system authorship/review lifecycle stay slice-owned; not tracked changes |
| `node.pull-quote` | `PullQuoteNode` | quote plus attribution slots | slash picker | implement/generalize |
| `node.page` | `PageNode` | fixed-page wrapper | page setup/pagination extension | implement as projection of presentation metadata |
| `node.page-content` | `PageContentNode` | page content container | automatic pagination | projection/runtime substrate |
| `node.ruby` | `RubyNode` | base text plus pronunciation annotation | toolbar selection and floating editor | implement with HTML `<ruby><rt>` mapping |

### Implicit core runtime nodes

| Class | Role | Evidence/status |
| --- | --- | --- |
| `RootNode` | editor root | observed in debug tree; runtime substrate |
| `ParagraphNode` | ordinary block | live toolbar/slash default and Markdown conversion |
| `TextNode` | inline text with format bits/style | observed; carries core marks and styles |
| `LineBreakNode` | explicit line break | core Lexical behavior/import/export |
| `TabNode` | inline tab | core Lexical behavior; separate from block indentation |

## Toolbar and contextual authoring

The primary toolbar contains undo/redo; block type; font family; decrease,
typed, and increase font size; bold/italic/underline; inline code; link; Ruby;
text color; background color; additional styles; page setup; insert; alignment
and indentation; shortcut help. It is horizontally scrollable at the audited
desktop width, so parity must improve discoverability and narrow layouts.

Additional text styles are lowercase, uppercase, capitalize, strikethrough,
subscript, superscript, semantic Highlight, and clear formatting. The floating
range-selection toolbar adds the most common styles plus comment insertion.
Inside code, ordinary block controls switch to language/theme and code actions.

The insert menu exposes 15 choices: horizontal rule, page break, image, GIF,
Excalidraw, table, poll, columns, equation, sticky note, collapsible, date,
X/Tweet, YouTube, and Figma.

The slash picker exposes 33 captured choices: four paragraph/heading choices;
table; three lists; quote; code; divider; page break; Excalidraw; poll; three
embeds; four date choices; equation; GIF; image; collapsible; Card; Pull Quote;
Review; columns; and four alignments. It also supports dynamic `/RxC` tables.

## Keyboard contract

The complete Windows/Linux and Apple table is in the
[source audit](./LEXICAL-PLAYGROUND-SOURCE-AUDIT.md#keyboard-shortcuts); the
live help dialog is captured in
[`11-keyboard-shortcuts-dialog.png`](../assets/11-keyboard-shortcuts-dialog.png).
It covers paragraph/H1-H3, three list modes, code block, quote, comment,
font-size steps, inline code, strike/case, four alignments, sub/superscript,
indent/outdent, clear formatting, undo/redo, bold/italic/underline, and link.
Find/replace adds open, next, previous, close, and focus-trap behavior.

Future help UI must be generated from the resolved command registry; the list
above is reference evidence, not a second hand-maintained runtime registry.

## Seven highlighting systems

| System | Persistence meaning | Upstream implementation | Beep rule |
| --- | --- | --- | --- |
| Semantic authored highlight | authored document format | text-format bit, `==text==`, themed `MARK` | distinct typed `@beep/md` mark |
| Arbitrary background color | authored presentation | inline style/color picker | typed portable style, not raw CSS |
| Comments | durable discussion anchor | `MarkNode` plus thread store | revision-anchored sidecar; mark is projection |
| Bracket special text | optional authored/entity syntax | `[text]` to `SpecialTextNode` | distinct capability; never alias highlight |
| Find/replace matches | transient query result | DOM overlays/current-match state | ephemeral view state |
| Collaboration selections | transient remote presence | Yjs selection decoration | collaboration-only view state |
| Retained selection | transient local focus aid | optional selection rendering | per-user view state |

The live audit exercised semantic Highlight: the selected word became a
separate node with `format: highlight`, rendered through `MARK`, while the
selection offsets were preserved across the toolbar interaction. Text/background
color pickers instead offer arbitrary hex/HSV values plus 15 swatches.

## Page setup reference

Fixed page choices are A4, Letter, Legal, Tabloid, A3, A5, B4, B5, Statement,
Executive, and Folio. Orientations are portrait and landscape. Margins are
Narrow 0.25 in, Normal 0.4 in, Moderate 0.75 in, and Wide 1 in. The first fixed
page default is A4 portrait with 0.4 in margins; default document mode is
pageless. `PageNode`/`PageContentNode` perform automatic overflow/underflow
pagination around explicit page breaks.

## Settings and feature gates

Source defines 28 settings/config axes. The live panel visibly exposed 21 at
the audited host, including performance/debug controls, rich/plain text, nested
tables, limits, link attributes, autocomplete, non-printing characters, TOC,
context menu, Markdown newline policy, bracket highlighting, retained/block
selection, Prism/Shiki highlighting, and Shadow DOM.

Only `isCollab`, `emptyEditor`, and `isRichText` rebuild the editor. Other
settings are intended as live signals. This is evidence that capability
registration, mount-immutable profiles, and live options are different layers.
Query-only axes and development-host-only controls remain in the source audit.

## Interchange and document actions

Observed controls include JSON import/export, compressed share URL, clear with
confirmation, read-only lock, Markdown source, HTML source, DOM export, time
travel, comments, and browser-gated speech-to-text. Source mode replaces the
root with code, reimports on exit, and disables page behavior while active.

Playground-specific Markdown transformers cover tables, rules, images, emoji,
inline/block equations, Tweets, and checklists before standard transformers for
H1-H6, quotes, lists, fenced/inline code, strong/emphasis, highlight, strike,
and links. Not every custom structured block has Markdown support; unsupported
round trips are a named compatibility risk.

For Beep, canonical JSON is the versioned `@beep/md` envelope. Markdown, HTML,
Lexical JSON, Pandoc/DOCX, PDF, and sharing are projections with explicit loss
reporting. Raw Lexical state and document-in-URL sharing are development-only.

## Evidence and remaining proof

The live audit includes 17 linked screenshots and a list of deliberately
unverified interactions. Highest-risk follow-ups are every structured node's
create/edit/select/undo/copy/paste/delete lifecycle; table edge cases; exact
Markdown/HTML/JSON round trips; comments; page orientation/margins visuals;
all settings; mobile/touch alternatives; clipboard/speech permissions; screen
reader behavior; contrast; and focus traversal.

Those gaps are not omissions from the initiative. Goal A converts this research
index into a machine-validated atlas with stable IDs, exact evidence pointers,
compatibility rows, ownership, dependencies, fallbacks, and target goals.
