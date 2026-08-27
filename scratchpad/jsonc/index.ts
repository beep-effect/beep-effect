/**
 * Zero-dependency JSONC parsing, editing and formatting as Effect schemas.
 *
 * Parse JSONC into values or an AST, strip comments offset-preservingly,
 * compute byte-minimal edits, format, modify by path and visit as a `Stream` —
 * all pure (no IO), with a single aggregate parse error and string→domain
 * schema factories.
 *
 * @example
 * ```ts
 * import { Jsonc } from "@effected/jsonc";
 * import { Effect, Schema } from "effect";
 *
 * const Config = Schema.Struct({ port: Schema.Number });
 * const ConfigFromJsonc = Jsonc.schema(Config);
 *
 * const program = Effect.gen(function* () {
 *   const config = yield* Schema.decodeUnknownEffect(ConfigFromJsonc)('{ "port": 3000 // dev\n }');
 *   return config; // { port: 3000 }
 * });
 * ```
 *
 * @see {@link https://effect.website | Effect}
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
export type { JsoncFormattingOptionsLike } from "./JsoncEdit.ts";
export { JsoncEdit, JsoncFormattingOptions, JsoncRange } from "./JsoncEdit.ts";
export {
	JsoncCanonicalizeError,
	JsoncCanonicalizeErrorCode,
	JsoncFingerprint,
	JsoncTextHashOptions,
} from "./JsoncFingerprint.ts";
export { JsoncFormatter } from "./JsoncFormatter.ts";
export { JsoncModificationError, JsoncModifier, type JsoncModifyOptions } from "./JsoncModifier.ts";
export { JsoncNode, JsoncNodeType, type JsoncPath, type JsoncSegment } from "./JsoncNode.ts";
export { JsoncVisitor, JsoncVisitorEvent } from "./JsoncVisitor.ts";
