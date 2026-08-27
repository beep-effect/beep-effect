/**
 * Zero-dependency JSONC parsing, editing and formatting as Effect schemas.
 *
 * Parse JSONC into values or an AST, strip comments offset-preservingly,
 * compute byte-minimal edits, format, modify by path and visit as a `Stream` —
 * all pure (no IO), with a single aggregate parse error and string→domain
 * schema factories.
 *
 * **Example** (Parse JSONC with a line comment)
 *
 * ```ts
 * import { Jsonc } from "@beep/scratchpad/jsonc";
 * import { Effect } from "effect";
 * import * as S from "effect/Schema";
 *
 * const Config = S.Struct({ port: S.Number });
 * const ConfigFromJsonc = Jsonc.schema(Config);
 * const config = Effect.runSync(
 *   S.decodeUnknownEffect(ConfigFromJsonc)('{ "port": 3000 // dev\n }'),
 * );
 *
 * console.log(config.port); // 3000
 * ```
 *
 * @see {@link Jsonc} for the parse/stringify/schema facade.
 * @packageDocumentation
 * @since 0.0.0
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
export { JsoncEdit, JsoncFormattingOptions, JsoncFormattingOptionsLike, JsoncRange } from "./JsoncEdit.ts";
export {
  JsoncCanonicalizeError,
  JsoncCanonicalizeErrorCode,
  JsoncFingerprint,
  JsoncTextHashOptions,
} from "./JsoncFingerprint.ts";
export { JsoncFormatter } from "./JsoncFormatter.ts";
export { JsoncModificationError, JsoncModifier, JsoncModifyOptions } from "./JsoncModifier.ts";
export { JsoncNode, JsoncNodeType, JsoncPath, JsoncSegment } from "./JsoncNode.ts";
export { JsoncVisitor, JsoncVisitorEvent } from "./JsoncVisitor.ts";
