/**
 * CommonMark and GFM markdown parse, edit and transform schemas for Effect.
 *
 * **Details**
 *
 * The parse surface covers CommonMark 0.31.2 and the GFM dialect (tables,
 * strikethrough, autolink literals, task-list items and footnotes; `gfm` is
 * the default dialect): {@link Markdown} (the `parseResult` primitive, the
 * `parse` Effect and the `MarkdownFromString` codec), {@link MarkdownDocument}
 * (source, tree, diagnostics, definitions), the mdast-shaped core node
 * schemas, and {@link MarkdownDiagnostic}. Frontmatter is captured raw behind
 * a parse toggle and split by {@link FrontmatterSource}. The edit vocabulary (`MarkdownEdit`, `MarkdownRange` and
 * `MarkdownEdit.applyAll`) carries the cross-package offset-splice parity
 * contract; `Markdown.stringify` serializes trees canonically, and
 * `MarkdownFormat` computes marker-normalization and surgical-replacement
 * edits over it. {@link Mdast} is the remark-ecosystem interop boundary:
 * projection to plain mdast JSON and checked decoding back;
 * {@link MarkdownVisitor} streams a tree walk; and the document's navigation
 * accessors (headings, sections, links) serve outline and link extraction;
 * {@link MarkdownFence} lists fenced code blocks with their source spans.
 *
 * **Gotchas**
 *
 * This barrel is core-only and codec-free: it never reaches `@beep/yaml`,
 * `@beep/toml` or `@beep/jsonc`. Typed frontmatter (`Frontmatter`,
 * `FrontmatterResolver`, `YamlFrontmatter`, `TomlFrontmatter`,
 * `JsonFrontmatter`) and the MDX node vocabulary (`MarkdownMdx`) are
 * subpath-only imports (D-43).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export {
  FrontmatterNewline,
  FrontmatterSource,
  FrontmatterSourceBlock,
  FrontmatterSourceSplit,
} from "./FrontmatterSource.ts";
export {
  Markdown,
  MarkdownDialect,
  MarkdownParseError,
  MarkdownParseOptions,
  MarkdownStringifyError,
} from "./Markdown.ts";
export { MarkdownDiagnostic, MarkdownParseErrorCode } from "./MarkdownDiagnostic.ts";
export {
  DocumentHeading,
  DocumentLink,
  DocumentSection,
  MarkdownDocument,
  SectionQueryOptions,
} from "./MarkdownDocument.ts";
export { MarkdownEdit, MarkdownPath, MarkdownRange, MarkdownSegment } from "./MarkdownEdit.ts";
export { CodeFence, MarkdownFence } from "./MarkdownFence.ts";
export {
  CodeBlockStyle,
  MarkdownFormat,
  MarkdownFormattingOptions,
  MarkdownModificationError,
  MarkdownModificationErrorCode,
} from "./MarkdownFormat.ts";
export {
  Blockquote,
  Break,
  BreakStyle,
  BulletChar,
  Code,
  Definition,
  Delete,
  Emphasis,
  EmphasisChar,
  FenceChar,
  FlowContent,
  FootnoteDefinition,
  FootnoteReference,
  Frontmatter,
  FrontmatterContent,
  FrontmatterFormat,
  Heading,
  HeadingDepth,
  HeadingStyle,
  Html,
  Image,
  ImageReference,
  InlineCode,
  Link,
  LinkReference,
  List,
  ListContent,
  ListDelimiter,
  ListItem,
  MarkdownNode,
  MarkdownNodeKind,
  Paragraph,
  PhrasingContent,
  Point,
  Position,
  ReferenceType,
  Root,
  RowContent,
  Strong,
  Table,
  TableAlign,
  TableCell,
  TableContent,
  TableRow,
  Text,
  ThematicBreak,
  ThematicBreakChar,
} from "./MarkdownNode.ts";
export { HeadingSlug, MarkdownSlug } from "./MarkdownSlug.ts";
export { MarkdownToc, TocEntry, TocOptions } from "./MarkdownToc.ts";
export { MarkdownVisitor, MarkdownVisitorEvent } from "./MarkdownVisitor.ts";
export { Mdast, MdastDecodeError, MdastNode } from "./Mdast.ts";
export type { LinkBearingNode, SectionHeadingMatch } from "./MarkdownDocument.ts";
export type { MarkdownRangeLike } from "./MarkdownFormat.ts";
export type {
  FlowContentEncoded,
  FrontmatterContentEncoded,
  ListContentEncoded,
  MarkdownNodeEncoded,
  MarkdownNodeOfType,
  MarkdownNodeType,
  PhrasingContentEncoded,
  RowContentEncoded,
  TableContentEncoded,
} from "./MarkdownNode.ts";
