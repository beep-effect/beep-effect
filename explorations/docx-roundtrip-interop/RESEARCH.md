# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape

### 2026-06-15 - Pandoc as the interchange AST

Pandoc's architecture is explicitly reader -> AST -> writer. Its filters
documentation describes conversion as parsing source text into an intermediate
AST, optionally transforming that AST, and then writing the target format. It
also documents JSON filters that consume and produce the JSON representation of
that AST.

Source: <https://pandoc.org/filters.html>

Pandoc's API overview says the Pandoc AST is composed of metadata plus a list
of block elements. Blocks include paragraphs, headers, and block quotes; inline
elements are the contents of paragraph-like blocks. That Block/Inline split is
the structural reason Pandoc is a good first mirror for `@beep/md`.

Source: <https://pandoc.org/using-the-pandoc-api.html>

Pandoc's DOCX custom-style behavior is the key round-trip hook. For output,
Div, Span, and Table nodes carrying `custom-style` are emitted to DOCX styles.
For input, enabling the `docx+styles` extension adds `custom-style` attributes;
paragraph styles become Divs, character styles become Spans, and table styles
are applied to Table nodes.

Source: <https://pandoc.org/MANUAL.html#custom-styles>

The local machine does not currently have `pandoc` on PATH:
`pandoc --version` returned `zsh:1: command not found: pandoc`. That supports
the decision to make the first proof fixture-driven rather than binary-driven.

Source: local shell check, 2026-06-15.

Verified 2026-06-15: the official Pandoc releases page lists Pandoc `3.10`
as the latest release, dated 2026-06-03. Treat exact version pinning as
implementation research for the later binary driver, not this pure AST packet.

Source: <https://pandoc.org/releases.html>

## In-Repo Capability Inventory

Repo graph note, 2026-06-15: graph-based repo search was attempted for this
packet but was low-signal. It surfaced existing Lexical round-trip tests and
exploration manifest structure rather than a useful DOCX capability graph. The
inventory below is therefore grounded in live source/barrel searches plus
package READMEs and specs: `goals/rich-text-foundation/SPEC.md`,
`packages/foundation/modeling/lexical/README.md`,
`packages/foundation/modeling/md/README.md`,
and `goals/file-processing-capability/SPEC.md`.

### `@beep/md`

Path: `packages/foundation/modeling/md`

Existing role: Effect-native portable document AST and renderer. The rich-text
foundation packet established it as the canonical portable document model for
the current chat/editor spine.

Relevant nodes in the live source and public barrels include paragraph,
headings, inline text, emphasis, strong, delete, code, links, images, lists,
block quotes, preformatted code, horizontal rule, tables, raw markdown/html,
and the document envelope.

Live evidence: `@beep/md/Md.model` exports document, block, inline, paragraph,
heading, list, link, image, table, and text models; `@beep/md/Md.render`
exports the Markdown, HTML, and plain-text render adapters.

Gap for this exploration: current `@beep/md` is markdown-shaped, not a full
DOCX/Pandoc mirror. The compatibility matrix must decide which Pandoc nodes map
losslessly, which degrade, and which force a future AST decision.

### `@beep/lexical-schema`

Path: `packages/foundation/modeling/lexical`

Existing role: schema-first models of Lexical serialized editor state with
Md/Lexical codecs. Its README locks the current v1 scope to md-core nodes,
tables, `youtube`, and `artifact-ref`; attachments and proposal blocks remain
named follow-ons.

Live-source/README evidence: `@beep/lexical-schema` exports
`SerializedEditorState`, `EditorStateFromJson`, `documentToEditorState`,
`editorStateToDocument`, and plain-text projection helpers; the README locks
the current md-core scope and lossiness profile.

Gap for this exploration: Lexical is downstream. The first proof maps Pandoc to
`@beep/md` only, so the packet can determine whether the current portable AST is
adequate before involving editor state.

### `@beep/editor`

Path: `packages/foundation/ui-system/editor`

Existing role: React editor/viewer kit over Lexical 0.48 and the schema-first
rich-text pipeline.

Gap for this exploration: UI is deliberately out of scope. The editor becomes
relevant after the AST compatibility proof.

### File processing and Tika surfaces

Paths:

- `packages/foundation/capability/file-processing`
- `packages/drivers/tika`
- `goals/file-processing-capability/SPEC.md`

Existing role: file detection/extraction IR and broad document extraction
direction. The file-processing spec says the extraction IR is not a
bidirectional conversion contract and does not promise layout-perfect document
reconstruction.

Gap for this exploration: DOCX round-trip interop is not text extraction. It
needs a document AST mirror and conversion profile, not only extracted text and
metadata.

### NOT FOUND

- No existing `@beep/pandoc-ast` package.
- No existing `@beep/pandoc` driver package.
- No existing DOCX round-trip adapter.
- No existing Pandoc JSON AST schema mirror.

## Constraints Discovered

- The rich-text foundation explicitly rejected a third parallel rich-text AST.
  This exploration must treat that as binding until the compatibility matrix
  proves a richer document interchange AST is necessary.
- A pure Pandoc JSON AST mirror belongs in `foundation/modeling` because it is
  domain-agnostic schema/modeling substrate.
- The future Pandoc executable, Tauri sidecar, or process wrapper belongs in
  `drivers`, likely reserving `@beep/pandoc` for that later boundary.
- First proof should use checked-in JSON fixtures because `pandoc` is not
  installed locally and binary lifecycle is a separate decision.
- Unsupported constructs must surface as path-located issues. Silent dropping
  would make a round-trip proof meaningless.
