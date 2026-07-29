/**
 * Schema-first models of Lexical serialized editor state with Md ↔ Lexical
 * codecs.
 *
 * @packageDocumentation \@beep/lexical-schema
 * @since 0.0.0
 */

/**
 * Package version.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/lexical-schema"
 *
 * const packageVersion: "0.0.0" = VERSION
 * console.log(packageVersion) // "0.0.0"
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const VERSION = "0.0.0" as const;

/**
 * Pure plain-text projections over serialized Lexical state.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { LexicalNode, nodeToPlainText } from "@beep/lexical-schema"
 *
 * const node = S.decodeUnknownSync(LexicalNode)({ type: "linebreak", version: 1 })
 * console.log(JSON.stringify(nodeToPlainText(node))) // "\"\\n\""
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export { editorStateToPlainText, nodeToPlainText } from "./Lexical.behavior.ts";
/**
 * Md ↔ Lexical codecs over the canonical `@beep/md` AST.
 *
 * @example
 * ```ts
 * import { ARTIFACT_URI_PREFIX } from "@beep/lexical-schema"
 *
 * console.log(ARTIFACT_URI_PREFIX) // "artifact://"
 * ```
 *
 * @since 0.0.0
 * @category combinators
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
 * Schema-first models of Lexical's serialized editor state.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { LexicalNode } from "@beep/lexical-schema"
 *
 * const node = S.decodeUnknownSync(LexicalNode)({ type: "linebreak", version: 1 })
 * console.log(node.type) // "linebreak"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export {
  ArtifactRefId,
  ArtifactRefNode,
  analyzeEditorStateCompatibility,
  BaseNode,
  CodeNode,
  Direction,
  decodeEditorStateCompatibility,
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
  StrictSerializedEditorState,
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
