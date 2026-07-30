/**
 * Structured model of JSON Schema draft-2020-12 documents: a self-recursive
 * {@link Node} class covering the full keyword vocabulary, the
 * {@link NodeCodec} wire codec with lossless unknown-keyword preservation,
 * the {@link SubSchema} boolean-or-node union, the {@link Document} envelope
 * mirroring effect's `JsonSchema.Document<"draft-2020-12">`, and single-hop
 * local `$ref` resolvers.
 *
 * @example
 * ```ts
 * import { NodeCodec } from "@beep/schema/JSONSchema"
 * import * as S from "effect/Schema"
 *
 * const node = S.decodeUnknownResult(NodeCodec)({ type: "object", "x-vendor": 1 })
 * console.log(node._tag)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Node model, wire codec, document envelope, and `$ref` resolvers.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  Document,
  Node,
  NodeCodec,
  resolveDocumentRef,
  resolveLocalRef,
  resolveNodeRef,
  SubSchema,
} from "./JSONSchema.schema.ts";
/**
 * Leaf schemas and keyword vocabulary shared by the node model.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  AbsoluteUriString,
  AnchorName,
  CanonicalKeyword,
  ExtensionKey,
  ExtensionsBag,
  IdUriReferenceString,
  isCanonicalKeyword,
  JsonValue,
  NonNegativeCount,
  PositiveNumber,
  RegexPatternString,
  TypeName,
  TypeNameList,
  Types,
  UriReferenceString,
} from "./JSONSchema.shared.ts";
