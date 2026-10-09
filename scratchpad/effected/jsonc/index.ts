/**
 * JSONC parsing, editing, formatting and fingerprinting as Effect schemas and
 * pure functions.
 *
 * **Details**
 *
 * Parse JSONC into values or an offset-preserving AST, strip comments, compute
 * byte-minimal edits, format, modify by path, walk a document as a `Stream`,
 * canonicalize and fingerprint, with one aggregate parse error and
 * string-to-domain schema factories. Ported from `@effected/jsonc` to the
 * beep schema-first conventions.
 *
 * @packageDocumentation
 */

export type { JsoncBoundCodec } from "./Jsonc.ts";
export {
  Jsonc,
  JsoncParseError,
  JsoncParseErrorCode,
  JsoncParseErrorDetail,
  JsoncParseOptions,
  JsoncStringifyError,
  JsoncStringifyErrorCode,
  JsoncStringifyOptions,
} from "./Jsonc.ts";
export {
  JsoncEdit,
  JsoncEditOverlapError,
  JsoncFormattingOptions,
  JsoncFormattingOptionsLike,
  JsoncRange,
} from "./JsoncEdit.ts";
export {
  JsoncCanonicalizeError,
  JsoncCanonicalizeErrorCode,
  type JsoncDigest,
  JsoncFingerprint,
  JsoncTextHashOptions,
} from "./JsoncFingerprint.ts";
export { JsoncFormatter } from "./JsoncFormatter.ts";
export { JsoncModificationError, JsoncModifier, JsoncModifyOptions } from "./JsoncModifier.ts";
export { JsoncNode, JsoncNodeType, JsoncPath, JsoncSegment } from "./JsoncNode.ts";
export { JsoncVisitor, JsoncVisitorEvent } from "./JsoncVisitor.ts";
