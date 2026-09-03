/**
 * Schema-first models of Lexical serialized editor state with Md ↔ Lexical
 * codecs.
 *
 * @packageDocumentation \@beep/lexical-schema
 * @since 0.0.0
 */

/**
 * Pure plain-text projections over serialized Lexical state.
 *
 * **Example** (Project linebreak to text)
 *
 * ```ts import.meta.vitest name="Project linebreak to text"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LexicalNode, nodeToPlainText } from "@beep/lexical-schema"
 *
 * const result = S.decodeUnknownResult(LexicalNode)({ type: "linebreak", version: 1 })
 * Result.isSuccess(result) && nodeToPlainText(result.success) === "\n" // => true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export { editorStateToPlainText, nodeToPlainText } from "./Lexical.behavior.ts";
/**
 * Md ↔ Lexical codecs over the canonical `@beep/md` AST.
 *
 * **Example** (Read artifact URI prefix)
 *
 * ```ts import.meta.vitest name="Read artifact URI prefix"
 * import { ARTIFACT_URI_PREFIX } from "@beep/lexical-schema"
 *
 * ARTIFACT_URI_PREFIX // => "artifact://"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export {
  ARTIFACT_URI_PREFIX,
  ArtifactUri,
  blockToLexical,
  documentToEditorState,
  editorStateToDocument,
  nodeToBlocks,
} from "./Lexical.codec.ts";
/**
 * Exhaustive strict, normalizable, unsupported, or invalid editor-state classification.
 *
 * @category diagnostics
 * @since 0.0.0
 */
export { inspectEditorStateConformance, LexicalConformanceResult } from "./Lexical.conformance.ts";
/**
 * Schema-first models of Lexical's serialized editor state.
 *
 * **Example** (Decode linebreak node)
 *
 * ```ts import.meta.vitest name="Decode linebreak node"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LexicalNode } from "@beep/lexical-schema"
 *
 * const result = S.decodeUnknownResult(LexicalNode)({ type: "linebreak", version: 1 })
 * Result.isSuccess(result) && result.success.type === "linebreak" // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export {
  ArtifactRefId,
  ArtifactRefNode,
  analyzeEditorStateCompatibility,
  BaseNode,
  CodeNode,
  Direction,
  decodeEditorStateLossless,
  decodeEditorStateStrict,
  EditorStateFromJson,
  EditorStateWireFromJson,
  ElementFormat,
  ElementNode,
  HeadingNode,
  HeadingTag,
  hasTextFormat,
  LexicalCompatibilityIssue,
  LexicalCompatibilityResult,
  LexicalDecodeError,
  LexicalIndentDepth,
  LexicalNode,
  LexicalNodeVersion,
  LexicalNodeWire,
  LineBreakNode,
  LinkNode,
  ListItemNode,
  ListNode,
  ListNodeValue,
  ListTag,
  ListType,
  ParagraphNode,
  QuoteNode,
  RootNode,
  SafeInlineStyle,
  SafeStyleValue,
  SafeUrl,
  SerializedEditorState,
  SerializedEditorStateWire,
  TableCellHeaderState,
  TableCellNode,
  TableCellSpan,
  TableDimension,
  TableNode,
  TableRowNode,
  TabNode,
  TEXT_DETAIL_MASK_ALL,
  TEXT_FORMAT_MASK_ALL,
  TextBase,
  TextDetailBit,
  TextDetailBits,
  TextDetailMask,
  TextFormatBit,
  TextFormatBits,
  TextFormatMask,
  TextMode,
  TextNode,
  withTextFormat,
  YouTubeNode,
} from "./Lexical.model.ts";
export { VERSION } from "./Version.ts";
