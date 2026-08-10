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
 * **Example** (Import package version)
 *
 * ```ts
 * import { VERSION } from "@beep/lexical-schema"
 *
 * const packageVersion: "0.0.0" = VERSION
 * console.log(packageVersion) // "0.0.0"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * Pure plain-text projections over serialized Lexical state.
 *
 * **Example** (Project linebreak to text)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LexicalNode, nodeToPlainText } from "@beep/lexical-schema"
 *
 * const result = S.decodeUnknownResult(LexicalNode)({ type: "linebreak", version: 1 })
 * console.log(Result.isSuccess(result) && nodeToPlainText(result.success) === "\n") // true
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
 * ```ts
 * import { ARTIFACT_URI_PREFIX } from "@beep/lexical-schema"
 *
 * console.log(ARTIFACT_URI_PREFIX) // "artifact://"
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
 * Schema-first models of Lexical's serialized editor state.
 *
 * **Example** (Decode linebreak node)
 *
 * ```ts
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 * import { LexicalNode } from "@beep/lexical-schema"
 *
 * const result = S.decodeUnknownResult(LexicalNode)({ type: "linebreak", version: 1 })
 * console.log(Result.isSuccess(result) && result.success.type === "linebreak") // true
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
