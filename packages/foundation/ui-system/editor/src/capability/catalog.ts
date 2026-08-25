/**
 * Ratified P1 editor capability catalog reconciled to the atlas artifact.
 *
 * @packageDocumentation \@beep/editor/capability/catalog
 * @since 0.0.0
 */

import { Result } from "effect";
import * as S from "effect/Schema";
import { CapabilityCatalog } from "./schemas.ts";

const registrations = (
  nodes: ReadonlyArray<string>,
  extensions: ReadonlyArray<string>,
  transformers: ReadonlyArray<string>
) => ({ nodes, extensions, transformers });

const command = (
  id: string,
  label: string,
  helpText: string,
  surfaces: ReadonlyArray<string>,
  windowsLinux: string,
  apple: string
) => ({
  id,
  label,
  helpText,
  surfaces,
  keybindings: [
    { platform: "windows-linux", chord: windowsLinux },
    { platform: "apple", chord: apple },
  ],
});

const descriptor = (
  id: string,
  title: string,
  summary: string,
  category: string,
  disposition: string,
  dependencies: ReadonlyArray<string>,
  conflicts: ReadonlyArray<string>,
  ownedRegistrations: unknown,
  commands: ReadonlyArray<unknown>,
  readOnlyFallback: string,
  canonicalCompatibility: string,
  evidence: string
) => ({
  id,
  title,
  summary,
  classification: { category, disposition },
  dependencies,
  conflicts,
  registrations: ownedRegistrations,
  commands,
  readOnlyFallback,
  canonicalCompatibility,
  evidence,
});

const atlasEvidence = (id: string): string => `editor-capability-atlas/v1#${id}`;
const none = registrations([], [], []);

const decodeCatalog = S.decodeUnknownResult(CapabilityCatalog);

/**
 * Complete P1 registration and authoring catalog for `@beep/editor`.
 *
 * **Details**
 *
 * Every non-beep row copies its title, summary, category, disposition,
 * dependencies, conflicts, command metadata, and authored chords from the
 * ratified atlas. Node-owning rows are ordered to preserve the pre-P1
 * `editorNodes` registration sequence.
 *
 * **Example** (Inspect the catalog)
 *
 * ```ts
 * import { editorCapabilityCatalog } from "@beep/editor/capability/catalog"
 * import { Array as A } from "effect"
 *
 * console.log(A.length(editorCapabilityCatalog) > 0) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const editorCapabilityCatalog: CapabilityCatalog = Result.getOrThrow(
  decodeCatalog([
    descriptor(
      "node.root",
      "Editor root",
      "Core editor root and runtime substrate.",
      "core-node",
      "implement",
      [],
      [],
      none,
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("node.root")
    ),
    descriptor(
      "node.text",
      "Text",
      "Inline text carrying core format bits and portable style projection.",
      "core-node",
      "implement",
      [],
      [],
      registrations(["TextNode"], [], []),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("node.text")
    ),
    descriptor(
      "node.tab",
      "Tab",
      "Inline tab distinct from block indentation.",
      "core-node",
      "implement",
      [],
      [],
      registrations(["TabNode"], [], []),
      [],
      "render-canonical",
      "unsupported",
      atlasEvidence("node.tab")
    ),
    descriptor(
      "node.line-break",
      "Line break",
      "Explicit line break preserved by core import/export behavior.",
      "core-node",
      "implement",
      [],
      [],
      registrations(["LineBreakNode"], [], []),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("node.line-break")
    ),
    descriptor(
      "node.paragraph",
      "Paragraph",
      "Ordinary paragraph block and default slash/block-menu choice.",
      "core-node",
      "implement",
      [],
      [],
      registrations(["ParagraphNode"], [], []),
      [
        command(
          "block.paragraph",
          "Normal",
          "Format the current block as a paragraph.",
          ["toolbar", "slash-menu"],
          "Ctrl+Alt+0",
          "Cmd+Option+0"
        ),
      ],
      "render-canonical",
      "lossless",
      atlasEvidence("node.paragraph")
    ),
    descriptor(
      "node.heading",
      "Heading",
      "Block headings H1-H6; the live menu exposes H1-H3 while Markdown supports H1-H6.",
      "node",
      "implement",
      [],
      [],
      registrations(["HeadingNode"], [], []),
      [
        command(
          "block.heading-1",
          "Heading 1",
          "Format the current block as heading level 1.",
          ["toolbar", "slash-menu"],
          "Ctrl+Alt+1",
          "Cmd+Option+1"
        ),
        command(
          "block.heading-2",
          "Heading 2",
          "Format the current block as heading level 2.",
          ["toolbar", "slash-menu"],
          "Ctrl+Alt+2",
          "Cmd+Option+2"
        ),
        command(
          "block.heading-3",
          "Heading 3",
          "Format the current block as heading level 3.",
          ["toolbar", "slash-menu"],
          "Ctrl+Alt+3",
          "Cmd+Option+3"
        ),
      ],
      "render-canonical",
      "lossless",
      atlasEvidence("node.heading")
    ),
    descriptor(
      "node.quote",
      "Block quote",
      "Semantic block quote exposed in block, slash, keyboard, and Markdown paths.",
      "node",
      "implement",
      [],
      [],
      registrations(["QuoteNode"], [], []),
      [
        command(
          "block.quote",
          "Quote",
          "Format the current block as a quote.",
          ["toolbar", "slash-menu"],
          "Ctrl+Shift+Q",
          "Control+Shift+Q"
        ),
      ],
      "render-canonical",
      "lossless",
      atlasEvidence("node.quote")
    ),
    descriptor(
      "node.list",
      "Lists",
      "Ordered, unordered, and checklist containers with block, slash, keyboard, and Markdown activation.",
      "node",
      "implement",
      [],
      [],
      registrations(["ListNode"], ["ListPlugin", "CheckListPlugin"], []),
      [
        command(
          "block.numbered-list",
          "Numbered list",
          "Format the current block as a numbered list.",
          ["toolbar", "slash-menu"],
          "Ctrl+Shift+7",
          "Cmd+Shift+7"
        ),
        command(
          "block.bullet-list",
          "Bullet list",
          "Format the current block as a bulleted list.",
          ["toolbar", "slash-menu"],
          "Ctrl+Shift+8",
          "Cmd+Shift+8"
        ),
        command(
          "block.check-list",
          "Check list",
          "Format the current block as a checklist.",
          ["toolbar", "slash-menu"],
          "Ctrl+Shift+9",
          "Cmd+Shift+9"
        ),
      ],
      "render-canonical",
      "lossless",
      atlasEvidence("node.list")
    ),
    descriptor(
      "node.list-item",
      "List item",
      "List item and checklist state edited through list commands and Markdown.",
      "node",
      "implement",
      ["node.list"],
      [],
      registrations(["ListItemNode"], [], []),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("node.list-item")
    ),
    descriptor(
      "node.link",
      "Authored link",
      "Authored link exposed through toolbars, Ctrl/Cmd+K, Markdown, HTML, and read-only clicks.",
      "node",
      "implement",
      [],
      [],
      registrations(["LinkNode"], ["LinkPlugin"], []),
      [
        command(
          "format.link",
          "Insert link",
          "Create or edit a link for the selection.",
          ["toolbar"],
          "Ctrl+K",
          "Cmd+K"
        ),
      ],
      "render-canonical",
      "lossless",
      atlasEvidence("node.link")
    ),
    descriptor(
      "node.code",
      "Code block",
      "Fenced code block with language/theme actions, formatting, and Markdown interchange.",
      "node",
      "implement",
      [],
      [],
      registrations(["CodeNode"], [], []),
      [
        command(
          "block.code",
          "Code block",
          "Format the current block as code.",
          ["toolbar", "slash-menu"],
          "Ctrl+Alt+C",
          "Cmd+Option+C"
        ),
      ],
      "render-canonical",
      "lossless",
      atlasEvidence("node.code")
    ),
    descriptor(
      "node.table",
      "Table",
      "Table bundle root for insertion, structure, editing actions, Markdown, HTML, and nested-table policy.",
      "node",
      "implement",
      [],
      [],
      registrations(["TableNode"], [], []),
      [],
      "render-canonical",
      "unsupported",
      atlasEvidence("node.table")
    ),
    descriptor(
      "node.table-row",
      "Table row",
      "Row structure, striping, freezing, insertion, deletion, and table action targets.",
      "node",
      "implement",
      ["node.table"],
      [],
      registrations(["TableRowNode"], [], []),
      [],
      "render-canonical",
      "unsupported",
      atlasEvidence("node.table-row")
    ),
    descriptor(
      "node.table-cell",
      "Table cell",
      "Cell/header state, background, vertical alignment, merge, and table action targets.",
      "node",
      "implement",
      ["node.table"],
      [],
      registrations(["TableCellNode"], [], []),
      [],
      "render-canonical",
      "unsupported",
      atlasEvidence("node.table-cell")
    ),
    descriptor(
      "node.youtube",
      "YouTube reference",
      "Network-inert YouTube reference, aligned with the existing canonical YouTube semantic.",
      "node",
      "generalize",
      [],
      [],
      registrations(["YouTubeNode"], [], []),
      [],
      "inert-reference",
      "unsupported",
      atlasEvidence("node.youtube")
    ),
    descriptor(
      "beep.artifact-ref",
      "Artifact reference",
      "Canonical artifact reference rendered as a read-only editor chip.",
      "node",
      "implement",
      [],
      [],
      registrations(["ArtifactRefNode"], [], []),
      [],
      "render-canonical",
      "lossless",
      "packages/foundation/modeling/lexical/src/Lexical.model.ts"
    ),
    descriptor(
      "format.bold",
      "Bold",
      "Portable strong emphasis.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [command("format.bold", "Bold", "Toggle bold formatting on the selection.", ["toolbar"], "Ctrl+B", "Cmd+B")],
      "render-canonical",
      "lossless",
      atlasEvidence("format.bold")
    ),
    descriptor(
      "format.italic",
      "Italic",
      "Portable emphasis.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [
        command(
          "format.italic",
          "Italic",
          "Toggle italic formatting on the selection.",
          ["toolbar"],
          "Ctrl+I",
          "Cmd+I"
        ),
      ],
      "render-canonical",
      "lossless",
      atlasEvidence("format.italic")
    ),
    descriptor(
      "format.strikethrough",
      "Strikethrough",
      "Authored strikethrough formatting.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [
        command(
          "format.strikethrough",
          "Strikethrough",
          "Toggle strikethrough formatting on the selection.",
          ["toolbar"],
          "Ctrl+Shift+X",
          "Cmd+Shift+X"
        ),
      ],
      "render-canonical",
      "lossless",
      atlasEvidence("format.strikethrough")
    ),
    descriptor(
      "format.inline-code",
      "Inline code",
      "Portable inline code formatting.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [
        command(
          "format.inline-code",
          "Inline code",
          "Toggle inline code formatting on the selection.",
          ["toolbar"],
          "Ctrl+Shift+C",
          "Cmd+Shift+C"
        ),
      ],
      "render-canonical",
      "lossless",
      atlasEvidence("format.inline-code")
    ),
    descriptor(
      "format.underline",
      "Underline",
      "Authored underline style, currently dropped by canonical conversion.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [
        command(
          "format.underline",
          "Underline",
          "Toggle underline formatting on the selection.",
          ["toolbar"],
          "Ctrl+U",
          "Cmd+U"
        ),
      ],
      "render-canonical",
      "unsupported",
      atlasEvidence("format.underline")
    ),
    descriptor(
      "format.subscript",
      "Subscript",
      "Authored subscript style.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [
        command(
          "format.subscript",
          "Subscript",
          "Toggle subscript formatting on the selection.",
          ["toolbar"],
          "Ctrl+,",
          "Cmd+,"
        ),
      ],
      "render-canonical",
      "unsupported",
      atlasEvidence("format.subscript")
    ),
    descriptor(
      "format.superscript",
      "Superscript",
      "Authored superscript style.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [
        command(
          "format.superscript",
          "Superscript",
          "Toggle superscript formatting on the selection.",
          ["toolbar"],
          "Ctrl+.",
          "Cmd+."
        ),
      ],
      "render-canonical",
      "unsupported",
      atlasEvidence("format.superscript")
    ),
    descriptor(
      "format.lowercase",
      "Lowercase",
      "Transform selected text to lowercase.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [
        command(
          "format.lowercase",
          "Lowercase",
          "Convert the selected text to lowercase.",
          ["toolbar"],
          "Ctrl+Shift+1",
          "Control+Shift+1"
        ),
      ],
      "render-canonical",
      "unsupported",
      atlasEvidence("format.lowercase")
    ),
    descriptor(
      "format.uppercase",
      "Uppercase",
      "Transform selected text to uppercase.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [
        command(
          "format.uppercase",
          "Uppercase",
          "Convert the selected text to uppercase.",
          ["toolbar"],
          "Ctrl+Shift+2",
          "Control+Shift+2"
        ),
      ],
      "render-canonical",
      "unsupported",
      atlasEvidence("format.uppercase")
    ),
    descriptor(
      "format.capitalize",
      "Capitalize",
      "Capitalize selected text.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [
        command(
          "format.capitalize",
          "Capitalize",
          "Capitalize the selected text.",
          ["toolbar"],
          "Ctrl+Shift+3",
          "Control+Shift+3"
        ),
      ],
      "render-canonical",
      "unsupported",
      atlasEvidence("format.capitalize")
    ),
    descriptor(
      "format.semantic-highlight",
      "Semantic highlight",
      "Distinct authored Highlight format mapped from ==text==, not arbitrary background color.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [],
      "render-canonical",
      "unsupported",
      atlasEvidence("format.semantic-highlight")
    ),
    descriptor(
      "format.clear",
      "Clear formatting",
      "Remove applicable inline formats and projection-local styles.",
      "authoring",
      "implement",
      [],
      [],
      none,
      [
        command(
          "format.clear",
          "Clear formatting",
          "Clear formatting from the selection.",
          ["toolbar"],
          "Ctrl+\\",
          "Cmd+\\"
        ),
      ],
      "hide-controls",
      "not-applicable",
      atlasEvidence("format.clear")
    ),
    descriptor(
      "extension.history",
      "History and announcements",
      "Editor-local history, availability state, and accessibility announcements.",
      "extension",
      "implement",
      [],
      [],
      registrations([], ["HistoryPlugin"], []),
      [],
      "hide-controls",
      "not-applicable",
      atlasEvidence("extension.history")
    ),
    descriptor(
      "authoring.undo",
      "Undo",
      "Editor-local undo command, distinct from product revisions.",
      "authoring",
      "implement",
      ["extension.history"],
      [],
      none,
      [command("history.undo", "Undo", "Undo the latest editor-local change.", ["toolbar"], "Ctrl+Z", "Cmd+Z")],
      "hide-controls",
      "not-applicable",
      atlasEvidence("authoring.undo")
    ),
    descriptor(
      "authoring.redo",
      "Redo",
      "Editor-local redo command, distinct from product revisions.",
      "authoring",
      "implement",
      ["extension.history"],
      [],
      none,
      [
        command(
          "history.redo",
          "Redo",
          "Redo the latest undone editor-local change.",
          ["toolbar"],
          "Ctrl+Y",
          "Cmd+Shift+Z"
        ),
      ],
      "hide-controls",
      "not-applicable",
      atlasEvidence("authoring.redo")
    ),
    descriptor(
      "extension.toolbar",
      "Main toolbar",
      "Primary horizontally scrollable command projection.",
      "extension",
      "generalize",
      [],
      [],
      registrations([], ["ToolbarProjection"], []),
      [],
      "hide-controls",
      "not-applicable",
      atlasEvidence("extension.toolbar")
    ),
    descriptor(
      "extension.slash-picker",
      "Slash/component picker",
      "Listbox command projection, including dynamic /RxC tables.",
      "extension",
      "generalize",
      [],
      [],
      registrations([], ["SlashPickerProjection"], []),
      [],
      "hide-controls",
      "not-applicable",
      atlasEvidence("extension.slash-picker")
    ),
    descriptor(
      "extension.shortcut-help",
      "Generated shortcut help",
      "Semantic dialog generated from the resolved command registry.",
      "extension",
      "generalize",
      [],
      [],
      registrations([], ["ShortcutHelpProjection"], []),
      [],
      "hide-controls",
      "not-applicable",
      atlasEvidence("extension.shortcut-help")
    ),
    descriptor(
      "interchange.markdown",
      "Markdown projection",
      "Non-destructive Markdown import/export with explicit loss reporting.",
      "interchange",
      "generalize",
      [],
      [],
      registrations([], ["MarkdownShortcutPlugin"], []),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("interchange.markdown")
    ),
    descriptor(
      "interchange.canonical-json",
      "Canonical @beep/md JSON",
      "Versioned @beep/md envelope and sole document authority.",
      "interchange",
      "implement",
      [],
      [],
      none,
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("interchange.canonical-json")
    ),
    descriptor(
      "transformer.heading",
      "Heading Markdown transformer",
      "Pinned Markdown typing/import/export support for HEADING.",
      "transformer",
      "implement",
      ["node.heading", "interchange.markdown"],
      [],
      registrations([], [], ["HEADING"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.heading")
    ),
    descriptor(
      "transformer.quote",
      "Quote Markdown transformer",
      "Pinned Markdown typing/import/export support for QUOTE.",
      "transformer",
      "implement",
      ["node.quote", "interchange.markdown"],
      [],
      registrations([], [], ["QUOTE"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.quote")
    ),
    descriptor(
      "transformer.code-block",
      "Fenced-code Markdown transformer",
      "Pinned Markdown typing/import/export support for CODE.",
      "transformer",
      "implement",
      ["node.code", "interchange.markdown"],
      [],
      registrations([], [], ["CODE"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.code-block")
    ),
    descriptor(
      "transformer.unordered-list",
      "Unordered-list Markdown transformer",
      "Pinned Markdown typing/import/export support for UNORDERED_LIST.",
      "transformer",
      "implement",
      ["node.list", "interchange.markdown"],
      [],
      registrations([], [], ["UNORDERED_LIST"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.unordered-list")
    ),
    descriptor(
      "transformer.ordered-list",
      "Ordered-list Markdown transformer",
      "Pinned Markdown typing/import/export support for ORDERED_LIST.",
      "transformer",
      "implement",
      ["node.list", "interchange.markdown"],
      [],
      registrations([], [], ["ORDERED_LIST"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.ordered-list")
    ),
    descriptor(
      "transformer.check-list",
      "Checklist Markdown transformer",
      "Pinned Markdown typing/import/export support for CHECK_LIST.",
      "transformer",
      "implement",
      ["node.list", "interchange.markdown"],
      [],
      registrations([], [], ["CHECK_LIST"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.check-list")
    ),
    descriptor(
      "transformer.inline-code",
      "Inline-code Markdown transformer",
      "Pinned Markdown typing/import/export support for INLINE_CODE.",
      "transformer",
      "implement",
      ["format.inline-code", "interchange.markdown"],
      [],
      registrations([], [], ["INLINE_CODE"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.inline-code")
    ),
    descriptor(
      "transformer.strong",
      "Strong Markdown transformers",
      "Pinned Markdown typing/import/export support for BOLD_STAR, BOLD_UNDERSCORE.",
      "transformer",
      "implement",
      ["format.bold", "interchange.markdown"],
      [],
      registrations([], [], ["BOLD_STAR", "BOLD_UNDERSCORE"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.strong")
    ),
    descriptor(
      "transformer.emphasis",
      "Emphasis Markdown transformers",
      "Pinned Markdown typing/import/export support for ITALIC_STAR, ITALIC_UNDERSCORE.",
      "transformer",
      "implement",
      ["format.italic", "interchange.markdown"],
      [],
      registrations([], [], ["ITALIC_STAR", "ITALIC_UNDERSCORE"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.emphasis")
    ),
    descriptor(
      "transformer.strong-emphasis",
      "Combined strong/emphasis Markdown transformers",
      "Pinned Markdown typing/import/export support for BOLD_ITALIC_STAR, BOLD_ITALIC_UNDERSCORE.",
      "transformer",
      "implement",
      ["format.bold", "format.italic", "interchange.markdown"],
      [],
      registrations([], [], ["BOLD_ITALIC_STAR", "BOLD_ITALIC_UNDERSCORE"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.strong-emphasis")
    ),
    descriptor(
      "transformer.strikethrough",
      "Strikethrough Markdown transformer",
      "Pinned Markdown typing/import/export support for STRIKETHROUGH.",
      "transformer",
      "implement",
      ["format.strikethrough", "interchange.markdown"],
      [],
      registrations([], [], ["STRIKETHROUGH"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.strikethrough")
    ),
    descriptor(
      "transformer.highlight",
      "Semantic-highlight Markdown transformer",
      "Pinned Markdown typing/import/export support for HIGHLIGHT.",
      "transformer",
      "implement",
      ["format.semantic-highlight", "interchange.markdown"],
      [],
      registrations([], [], ["HIGHLIGHT"]),
      [],
      "render-canonical",
      "unsupported",
      atlasEvidence("transformer.highlight")
    ),
    descriptor(
      "transformer.link",
      "Link Markdown transformer",
      "Pinned Markdown typing/import/export support for LINK.",
      "transformer",
      "implement",
      ["node.link", "interchange.markdown"],
      [],
      registrations([], [], ["LINK"]),
      [],
      "render-canonical",
      "lossless",
      atlasEvidence("transformer.link")
    ),
  ])
);
