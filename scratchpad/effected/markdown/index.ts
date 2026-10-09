/**
 * CommonMark and GFM markdown parse, edit and transform schemas for Effect.
 *
 * @remarks
 * The parse surface covers CommonMark 0.31.2 and the GFM dialect (tables,
 * strikethrough, autolink literals, task-list items and footnotes; `gfm` is
 * the default dialect): {@link Markdown} (the `parseResult` primitive, the
 * `parse` Effect and the `MarkdownFromString` codec), {@link MarkdownDocument}
 * (source, tree, diagnostics, definitions), the mdast-shaped node classes, and
 * {@link MarkdownDiagnostic}. Frontmatter is captured raw behind a parse
 * toggle and decoded through the free-standing codecs — `YamlFrontmatter`,
 * `TomlFrontmatter`, `JsonFrontmatter` — each peering optionally on its
 * format package. The edit vocabulary (`MarkdownEdit`, `MarkdownRange` and
 * `MarkdownEdit.applyAll`) carries the cross-package offset-splice parity
 * contract; `Markdown.stringify` serializes trees canonically, and
 * `MarkdownFormat` computes marker-normalization and surgical-replacement
 * edits over it. {@link Mdast} is the remark-ecosystem interop boundary:
 * projection to plain mdast JSON and checked decoding back;
 * {@link MarkdownVisitor} streams a tree walk; and the document's navigation
 * accessors (headings, sections, links) serve outline and link extraction.
 *
 * @packageDocumentation
 */

export type { FrontmatterCodec, FrontmatterSchemaError, FrontmatterWriteError } from "./Frontmatter.ts";
export {
	FrontmatterDecodeError,
	FrontmatterEncodeError,
	FrontmatterFormatMismatchError,
	FrontmatterMissingError,
	FrontmatterMissingReason,
	FrontmatterValidationError,
	MarkdownFrontmatter,
} from "./Frontmatter.ts";
export type { FrontmatterResolveError, FrontmatterSchemaResolver } from "./FrontmatterResolver.ts";
export {
	SchemaDeclaration,
	SchemaDeclarationByName,
	SchemaDeclarationByPath,
	SchemaDeclarationByUrl,
	SchemaDeclarationInline,
	SchemaDeclarationInvalidError,
	SchemaDeclarationMissingError,
	SchemaNameUnknownError,
	SchemaResolver,
	SchemaVersionUnresolvableError,
} from "./FrontmatterResolver.ts";
export {
	FrontmatterNewline,
	FrontmatterSource,
	FrontmatterSourceBlock,
	FrontmatterSourceSplit,
} from "./FrontmatterSource.ts";
export { JsonFrontmatter } from "./JsonFrontmatter.ts";
export {
	Markdown,
	MarkdownDialect,
	MarkdownParseError,
	MarkdownParseOptions,
	MarkdownStringifyError,
} from "./Markdown.ts";
export { MarkdownDiagnostic, MarkdownParseErrorCode } from "./MarkdownDiagnostic.ts";
export type {
	DocumentHeading,
	DocumentLink,
	LinkBearingNode,
	SectionHeadingMatch,
	SectionQueryOptions,
} from "./MarkdownDocument.ts";
export { DocumentSection, MarkdownDocument } from "./MarkdownDocument.ts";
export type { MarkdownPath, MarkdownSegment } from "./MarkdownEdit.ts";
export { MarkdownEdit, MarkdownRange } from "./MarkdownEdit.ts";
export type { MarkdownRangeLike } from "./MarkdownFormat.ts";
export {
	CodeBlockStyle,
	MarkdownFormat,
	MarkdownFormattingOptions,
	MarkdownModificationError,
	MarkdownModificationErrorCode,
} from "./MarkdownFormat.ts";
export type { MarkdownNodeOfType, MarkdownNodeType } from "./MarkdownNode.ts";
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
	MdxFlowExpression,
	MdxJsxAttribute,
	MdxJsxAttributeContent,
	MdxJsxAttributeValueExpression,
	MdxJsxExpressionAttribute,
	MdxJsxFlowElement,
	MdxJsxTextElement,
	MdxTextExpression,
	MdxjsEsm,
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
export { MarkdownVisitor, MarkdownVisitorEvent } from "./MarkdownVisitor.ts";
export type { MdastNode } from "./Mdast.ts";
export { Mdast, MdastDecodeError } from "./Mdast.ts";
export { TomlFrontmatter } from "./TomlFrontmatter.ts";
export { YamlFrontmatter } from "./YamlFrontmatter.ts";
