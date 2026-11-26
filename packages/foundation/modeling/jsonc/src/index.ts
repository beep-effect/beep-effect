/**
 * JSONC parsing, editing, formatting and fingerprinting as Effect schemas and
 * pure functions.
 *
 * **Details**
 *
 * Parse JSONC into values or an offset-preserving AST, strip comments, compute
 * byte-minimal edits, format, modify by path, walk a document as a `Stream`,
 * canonicalize, fingerprint and mint domain-tagged content hashes, with one
 * aggregate parse error and
 * string-to-domain schema factories. Ported from `@effected/jsonc` to the
 * beep schema-first conventions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export {
  ActivityOutcome,
  ActivityRecord,
  ActivityRecordInvalid,
  ActivityRecordInvalidReason,
  verifyActivityRecord,
} from "./ActivityRecord.ts";
export {
  ActivityPin,
  ActivityPreimage,
  ActivityStart,
  ActivityStartFields,
  type ActivityStartView,
  mintActivityId,
  mintActivityIdResult,
} from "./ActivityStart.ts";
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
  JsoncCanonicalizeOptions,
  type JsoncDigest,
  JsoncFingerprint,
  JsoncTextHashOptions,
} from "./JsoncFingerprint.ts";
export { JsoncFormatter } from "./JsoncFormatter.ts";
export {
  JsoncFormattedModifyOptions,
  JsoncModificationError,
  JsoncModifier,
  JsoncModifyOptions,
  JsoncPlacementError,
  JsoncPlacementFailure,
} from "./JsoncModifier.ts";
export { JsoncNode, JsoncNodeType, JsoncPath, JsoncSegment } from "./JsoncNode.ts";
export { JsoncVisitor, JsoncVisitorEvent } from "./JsoncVisitor.ts";
export {
  DuplicateDomainTag,
  definePreimage,
  mintContentHash,
  mintContentHashResult,
  Preimage,
  type PreimageGoldenError,
  PreimageGoldenMismatch,
  type PreimageMintError,
  PreimageRegistry,
} from "./Mint.ts";
export type { JsoncBoundCodec } from "./Jsonc.ts";
