# Lexical Playground live-behavior audit

- Target: <https://playground.lexical.dev/>
- Audited: 2026-08-04 in the user's Chrome
- Runtime reported by the debug view: `editor (v0.49.0+dev.esm)`, namespace `Playground`
- Evidence: 17 PNG captures in [`../assets/`](../assets/), plus accessible-DOM
  and debug-tree observations made during the same session
- Scope: live UI/behavior only. No repository or Notion content was changed.

## Evidence language

- **Observed** means the control/state appeared visually, in the accessible DOM, or in the live debug tree.
- **Exercised** means the audit performed the interaction and verified the resulting state.
- **Inferred** is an interpretation from labels or state, not an exercised behavior.
- **Unverified** calls out deliberate gaps; these should not be treated as parity requirements without follow-up.

## 1. Baseline editor surface

**Observed:** a centered Lexical header; a white, pageless editor canvas; a single horizontally scrollable toolbar; an editable surface exposed as a `textbox`; a black live debug/tree panel below the document; an unlabeled settings gear at bottom-left; a comments button at top-right; a floating document-actions cluster at the lower-right of the editor; and a link to the playground source.

The initial document proves these live node/format families in the debug tree:

- root, heading, quote, paragraph, text
- list and list item
- link
- hashtag token (`#hashtags`)
- emoji token (`🙂`, token mode)
- text formats: code, bold, italic

The editor is initially editable. Undo is enabled because initialization/focus produces undo state; Redo is disabled. After an edit, a `Time Travel` control appears beside `Export DOM`.

Evidence: [`01-overview-full.png`](../assets/01-overview-full.png).

## 2. Main toolbar inventory

Left to right, the live toolbar exposes:

1. Undo; Redo.
2. Block/text style menu.
3. Font-family menu.
4. Decrease font size; numeric font-size spinbox (initially `16`); increase font size.
5. Bold; italic; underline.
6. Insert code block.
7. Insert link.
8. Insert ruby annotation.
9. Text color.
10. Background color.
11. Additional text styles.
12. Page setup (size, orientation, layout).
13. Insert specialized editor node.
14. Text alignment/indentation.
15. Keyboard-shortcuts help (`?`).

The toolbar uses the ARIA label `Editor toolbar`. At the observed desktop viewport (mostly `1383x669`), it still had a horizontal scrollbar; rightmost controls may require horizontal scrolling.

### Block/text style menu

**Observed:**

| Block | Shortcut |
|---|---|
| Normal | Ctrl+Alt+0 |
| Heading 1 | Ctrl+Alt+1 |
| Heading 2 | Ctrl+Alt+2 |
| Heading 3 | Ctrl+Alt+3 |
| Numbered List | Ctrl+Shift+7 |
| Bullet List | Ctrl+Shift+8 |
| Check List | Ctrl+Shift+9 |
| Quote | Ctrl+Shift+Q |
| Code Block | Ctrl+Alt+C |

Evidence: [`02-block-type-menu.png`](../assets/02-block-type-menu.png).

### Font family and font size

**Observed font families:** Arial, Courier New, Georgia, Times New Roman, Trebuchet MS, Verdana.

**Observed font-size model:** decrement button, directly editable number spinbox, increment button. Keyboard help lists Ctrl+Shift+`,` to decrease and Ctrl+Shift+`.` to increase.

Evidence: [`03-font-family-menu.png`](../assets/03-font-family-menu.png).

### Inline text styles

**Observed primary controls:** bold, italic, underline, code, link, and ruby annotation.

**Observed additional-styles menu:** Lowercase, Uppercase, Capitalize, Strikethrough, Subscript, Superscript, Highlight, Clear Formatting.

Evidence: [`06-additional-text-styles.png`](../assets/06-additional-text-styles.png).

## 3. Color, background, and highlight behavior

### Text and background color pickers

Both pickers expose:

- a `Hex` field accepting an arbitrary color value;
- a saturation/value area;
- a hue rail;
- a result/preview rail;
- 15 preset swatches.

The preset swatches observed in live DOM styles are:

`rgb(208, 2, 27)`, `rgb(245, 166, 35)`, `rgb(248, 231, 28)`, `rgb(139, 87, 42)`, `rgb(126, 211, 33)`, `rgb(65, 117, 5)`, `rgb(189, 16, 224)`, `rgb(144, 19, 254)`, `rgb(74, 144, 226)`, `rgb(80, 227, 194)`, `rgb(184, 233, 134)`, `rgb(0, 0, 0)`, `rgb(74, 74, 74)`, `rgb(155, 155, 155)`, and `rgb(255, 255, 255)`.

The text-color picker initially showed `#000000`; the background picker initially showed `#ffffff`.

Evidence: [`04-text-color-picker.png`](../assets/04-text-color-picker.png),
[`05-background-highlight-color-picker.png`](../assets/05-background-highlight-color-picker.png).

### Distinct semantic Highlight format

The `Highlight` action in Additional Text Styles is separate from background-color styling.

**Exercised:** selected the word `sample`, invoked Additional Text Styles → Highlight, and verified the debug tree split the text node and marked the selected node `{ format: highlight }`. The resulting DOM used `MARK` plus a `SPAN.PlaygroundEditorTheme__textHighlight`; its computed highlight color was `rgba(255, 212, 0, 0.14)`.

Selection was preserved across opening and clicking the toolbar menu. The selection debug record retained exact anchor/focus offsets and reported `FORMAT_TEXT_COMMAND` with payload `highlight`.

Evidence: [`14-applied-text-highlight.png`](../assets/14-applied-text-highlight.png),
[`15-highlight-result.png`](../assets/15-highlight-result.png).

### Selection-triggered floating toolbar

**Exercised:** selecting a word caused a floating toolbar with:

- bold, italic, underline, strikethrough;
- subscript, superscript;
- uppercase, lowercase, capitalize;
- code block, link, comment.

The surface is exposed as `Floating text format toolbar`. A margin-side comment affordance also appears while a range is selected.

Evidence: [`13-text-selection-floating-toolbar.png`](../assets/13-text-selection-floating-toolbar.png).

## 4. Keyboard shortcuts

**Observed in the semantic `Keyboard shortcuts` dialog:**

| Action | Shortcut |
|---|---|
| Normal | Ctrl+Alt+0 |
| Heading 1 / 2 / 3 | Ctrl+Alt+1 / 2 / 3 |
| Numbered / Bullet / Check list | Ctrl+Shift+7 / 8 / 9 |
| Code block | Ctrl+Alt+C |
| Quote | Ctrl+Shift+Q |
| Add comment | Ctrl+Alt+M |
| Increase / decrease font size | Ctrl+Shift+`.` / Ctrl+Shift+`,` |
| Insert code block | Ctrl+Shift+C |
| Strikethrough | Ctrl+Shift+X |
| Lowercase / Uppercase / Capitalize | Ctrl+Shift+1 / 2 / 3 |
| Center / Justify / Left / Right align | Ctrl+Shift+E / J / L / R |
| Subscript / Superscript | Ctrl+`,` / Ctrl+`.` |
| Indent / Outdent | Ctrl+`]` / Ctrl+`[` |
| Clear formatting | Ctrl+`\\` |
| Redo / Undo | Ctrl+Y / Ctrl+Z |
| Bold / Italic / Underline | Ctrl+B / Ctrl+I / Ctrl+U |
| Insert link | Ctrl+K |

The dialog is a real ARIA `dialog`, has a level-2 heading, a `Close modal` button, and a semantic table with Action/Shortcut headers. At `1383x669`, the list is vertically scrollable and the bottom rows are below the initial viewport.

Evidence: [`11-keyboard-shortcuts-dialog.png`](../assets/11-keyboard-shortcuts-dialog.png).

## 5. Alignment and indentation

**Observed:** Left Align (active), Center Align, Right Align, Justify Align, Start Align, End Align, Outdent, Indent.

Shortcuts are shown for Left/Center/Right/Justify and Outdent/Indent. Start and End are logical-direction controls without displayed shortcuts, which is useful for bidirectional-writing support.

Evidence: [`10-alignment-menu.png`](../assets/10-alignment-menu.png).

## 6. Page setup

**Observed page sizes:** Pageless, A4 (`8.27 x 11.69`), Letter (`8.5 x 11`), Legal (`8.5 x 14`), Tabloid (`11 x 17`), A3 (`11.69 x 16.54`), A5 (`5.83 x 8.27`), B4 (`9.84 x 13.90`), B5 (`6.93 x 9.84`), Statement (`5.5 x 8.5`), Executive (`7.25 x 10.5`), Folio (`8.5 x 13`).

`Orientation` and `Margins` are separately expandable sections. Orientation was expanded live, but its value controls were below/clipped from the accessible snapshot and were not captured reliably. Exact orientation and margin presets therefore remain **unverified**.

The panel extends below the desktop viewport and requires internal/page scrolling.

Evidence: [`07-page-setup-dialog.png`](../assets/07-page-setup-dialog.png),
[`08-page-orientation.png`](../assets/08-page-orientation.png);
[`08a-page-setup-closed-after-margins-probe.png`](../assets/08a-page-setup-closed-after-margins-probe.png)
records the failed margins probe and is not evidence of margin choices.

## 7. Insertable blocks and nodes

### Toolbar Insert menu

**Observed:** Horizontal Rule, Page Break, Image, GIF, Excalidraw, Table, Poll, Columns Layout, Equation, Sticky Note, Collapsible container, Date, X(Tweet), Youtube Video, Figma Document.

Evidence: [`09-insert-node-menu.png`](../assets/09-insert-node-menu.png).

### Slash/typeahead menu

**Exercised:** inserted `/` in a fresh paragraph. A semantic `listbox` appeared with keyboard-selected first option (`Paragraph`). Live options were:

- Paragraph; Heading 1; Heading 2; Heading 3;
- Table; Numbered List; Bulleted List; Check List; Quote; Code;
- Divider; Page Break; Excalidraw; Poll;
- Embed X(Tweet); Embed Youtube Video; Embed Figma Document;
- Date; Today; Tomorrow; Yesterday;
- Equation; GIF; Image; Collapsible;
- Card; Pull Quote; Review; Columns Layout;
- Align left; Align center; Align right; Align justify.

This menu is broader than the toolbar Insert menu: it includes block formats, relative-date commands, Card/Pull Quote/Review, and alignment commands. Conversely, the toolbar Insert menu visibly includes Sticky Note, which was not present in the captured slash list.

Evidence: [`16-slash-command-menu.png`](../assets/16-slash-command-menu.png).

### Other live contextual controls

- The initial DOM exposes table-context controls: Drag to reorder column, Sort column, Add column, Add row. They were not exercised against an inserted table.
- A `Click to add below` affordance appeared at a block boundary after selecting text.
- The initial document demonstrates hashtag tokenization. The literal `@-mentions` text in the starter document was not a mention node in the debug tree.

## 8. Settings and feature gates

The settings gear opens a fixed left-side, vertically scrollable panel. The live switches and initial states were:

| Setting | Initial state |
|---|---|
| Measure Perf | Off |
| Debug View | On |
| Nested Editors Debug View | Off |
| Rich Text | On |
| Nested Tables | Off |
| Fit nested tables | Off |
| Char Limit | Off |
| Char Limit (UTF-8) | Off |
| Link Attributes | Off |
| Max Length | Off |
| Autocomplete | Off |
| Visible Non-Printing | Off |
| Table Of Contents | Off |
| Use Lexical Context Menu | Off |
| Preserve newlines in Markdown | Off |
| Use Brackets for Highlighting | Off |
| Retain selection | Off |
| Block selection | On |
| Enable Code Highlighting | On |
| Use Shiki for Code Highlighting | Off |
| Render in Shadow DOM | Off |

These are configuration-level capabilities in the playground, but this audit did not toggle each gate or establish which are suitable as public `@beep/editor` configuration versus demo-only diagnostics.

Evidence: [`12-settings-feature-gates.png`](../assets/12-settings-feature-gates.png)
(upper panel visible); the full list came from the same live accessible snapshot.

## 9. Document-level actions, import/export, and comments

**Observed buttons:**

- speech-to-text toggle (current accessible name `Disable speech to text`, implying the plugin/control is active);
- import editor state from JSON;
- export editor state to JSON;
- share a playground link containing the current editor state;
- clear editor contents;
- lock read-only mode;
- convert to Markdown;
- convert to HTML;
- Export DOM;
- Time Travel (appears after an edit);
- Show Comments.

**Unverified:** no file chooser, download, share URL, destructive clear flow, read-only toggle, Markdown/HTML conversion, DOM export, time-travel view, speech permission/state, or comments panel was exercised. Labels establish that the controls exist; they do not establish exact payload schemas, fidelity, dialogs, or failure behavior.

## 10. Accessibility and responsive observations

Positive observations:

- The main toolbar has a clear ARIA name.
- The editable region is exposed as a textbox; authored headings, blockquote, lists, links, strong/emphasis/code retain semantic accessibility.
- The keyboard-shortcuts surface is a semantic dialog and table.
- The slash surface is a semantic listbox with options and selected state.
- The selection toolbar is a named toolbar.
- Most icon-only controls have useful accessible names and/or titles; several include shortcuts in those labels.
- Active/checked/disabled states are exposed in the accessibility tree.

Observed gaps or risks:

- The settings gear is an unlabeled button in the accessible DOM.
- Color swatch buttons have no accessible name or title; the hex textbox also has no direct ARIA label (only nearby visible `Hex` text).
- Several popover menus appear as a generic `document` followed by buttons rather than a clearly named `menu`/`menuitem` structure.
- The toolbar needs horizontal scrolling even at the audited desktop size; the rightmost help control can be easy to miss.
- The Insert and Page Setup panels extend below the viewport. The settings panel and shortcuts dialog also require internal vertical scrolling.

**Unverified:** no mobile/narrow viewport override, touch gesture audit, high-contrast/theme audit, screen-reader run, focus-order traversal, reduced-motion test, or macOS shortcut-label comparison was completed.

## 11. Explicit remaining gaps

Highest-value follow-ups for true parity planning:

1. Exercise every Insert and slash node through its creation/configuration dialog, editable state, selection state, serialization, copy/paste, undo/redo, and deletion.
2. Exercise Markdown transformations (`#`, `##`, lists, quotes, fences, links, emphasis), import/export fidelity, and the `Preserve newlines in Markdown` gate. The slash menu is not a substitute for Markdown-shortcut coverage.
3. Exercise `@` mention, emoji, hashtag, autocomplete, and any other typeahead menu with keyboard navigation and escape/commit behavior.
4. Exercise custom text/background colors against selected and collapsed ranges, clear formatting, Highlight toggling, `Use Brackets for Highlighting`, and mixed-format selections.
5. Capture exact Orientation and Margins options and verify paged layout behavior.
6. Exercise comments, anchored comment selection, thread panel, resolve/delete behavior, and Ctrl+Alt+M.
7. Exercise table creation and all row/column/sort/reorder/nested-table controls.
8. Exercise every settings gate, especially Rich Text off, character limits, context menu, block selection, code-highlighting engines, Shadow DOM, and nested editor debug.
9. Verify responsive/mobile layouts, keyboard-only navigation, focus restoration, ARIA labeling, and contrast.
10. Verify JSON/HTML/Markdown/DOM/share schemas and round-trip lossiness before defining `@beep/editor` compatibility contracts.

## 12. Screenshot index

| File | Surface/state |
|---|---|
| [`01-overview-full.png`](../assets/01-overview-full.png) | Full baseline editor and debug view |
| [`02-block-type-menu.png`](../assets/02-block-type-menu.png) | Block styles and shortcuts |
| [`03-font-family-menu.png`](../assets/03-font-family-menu.png) | Font families |
| [`04-text-color-picker.png`](../assets/04-text-color-picker.png) | Text color picker |
| [`05-background-highlight-color-picker.png`](../assets/05-background-highlight-color-picker.png) | Background color picker |
| [`06-additional-text-styles.png`](../assets/06-additional-text-styles.png) | Case, script, strike, highlight, clear formatting |
| [`07-page-setup-dialog.png`](../assets/07-page-setup-dialog.png) | Page sizes and page setup sections |
| [`08-page-orientation.png`](../assets/08-page-orientation.png) | Orientation section expanded near viewport edge |
| [`08a-page-setup-closed-after-margins-probe.png`](../assets/08a-page-setup-closed-after-margins-probe.png) | Failed margins probe; gap evidence only |
| [`09-insert-node-menu.png`](../assets/09-insert-node-menu.png) | Toolbar insert-node inventory |
| [`10-alignment-menu.png`](../assets/10-alignment-menu.png) | Alignment and indent/outdent |
| [`11-keyboard-shortcuts-dialog.png`](../assets/11-keyboard-shortcuts-dialog.png) | Keyboard shortcut modal |
| [`12-settings-feature-gates.png`](../assets/12-settings-feature-gates.png) | Settings feature-gate panel |
| [`13-text-selection-floating-toolbar.png`](../assets/13-text-selection-floating-toolbar.png) | Range selection and floating toolbar |
| [`14-applied-text-highlight.png`](../assets/14-applied-text-highlight.png) | Highlight command while selected |
| [`15-highlight-result.png`](../assets/15-highlight-result.png) | Persisted semantic highlight after selection collapse |
| [`16-slash-command-menu.png`](../assets/16-slash-command-menu.png) | Slash/typeahead command menu |
