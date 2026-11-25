/**
 * Ontology session ports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import { Dataset, PrefixMap } from "@beep/rdf/Rdf";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $OntologyUseCasesId.create("aggregates/Session/Session.ports");

const emptyPrefixMap = (): PrefixMap => ({});

const PrefixMapWithEmptyDefault = PrefixMap.pipe(
  S.withConstructorDefault(Effect.succeed(emptyPrefixMap())),
  S.withDecodingDefaultKey(Effect.succeed(emptyPrefixMap()))
);

/**
 * **Example** (Decode ontology file path)
 *
 * ```ts
 * import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl")
 *
 * console.log(path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OntologyFilePath = S.NonEmptyString.pipe(
  S.brand("OntologyFilePath"),
  $I.annoteSchema("OntologyFilePath", {
    description: "Filesystem path for sidecar ontology documents.",
  })
);

/**
 * **Example** (Annotate decoded path type)
 *
 * ```ts
 * import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const path: OntologyFilePath = S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl")
 *
 * console.log(path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OntologyFilePath = typeof OntologyFilePath.Type;

/**
 * **Example** (Decode Turtle source text)
 *
 * ```ts
 * import { TurtleDocumentText } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const source = S.decodeUnknownSync(TurtleDocumentText)("@prefix ex: <https://example.test/> .")
 *
 * console.log(source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TurtleDocumentText = S.String.pipe(
  $I.annoteSchema("TurtleDocumentText", {
    description: "Turtle source text.",
  })
);

/**
 * **Example** (Annotate Turtle source type)
 *
 * ```ts
 * import { TurtleDocumentText } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const source: TurtleDocumentText = "@prefix ex: <https://example.test/> ."
 *
 * console.log(source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TurtleDocumentText = typeof TurtleDocumentText.Type;

/**
 * **Example** (Decode parse failure reason)
 *
 * ```ts
 * import { TurtleCodecErrorReason } from "@beep/ontology-use-cases/aggregates/Session/server"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeUnknownSync(TurtleCodecErrorReason)("parseFailed")
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const TurtleCodecErrorReason = LiteralKit([
  "parseFailed",
  "serializeFailed",
  "unsupportedGraph",
  "unsupportedPartition",
]).pipe(
  $I.annoteSchema("TurtleCodecErrorReason", {
    description: "Turtle codec failure reason.",
  })
);

/**
 * **Example** (Annotate unsupported graph reason)
 *
 * ```ts
 * import type { TurtleCodecErrorReason } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const reason: TurtleCodecErrorReason = "unsupportedGraph"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type TurtleCodecErrorReason = typeof TurtleCodecErrorReason.Type;

/**
 * **Example** (Make parse failed error)
 *
 * ```ts
 * import { TurtleCodecError } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const error = TurtleCodecError.make({
 *   reason: "parseFailed",
 *   message: "Turtle parser rejected the document."
 * })
 *
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TurtleCodecError extends S.TaggedError<TurtleCodecError, { readonly brand: unique symbol }>(
  $I`TurtleCodecError`
)(
  "TurtleCodecError",
  {
    reason: TurtleCodecErrorReason,
    message: S.String,
  },
  $I.annoteError<TurtleCodecError>("TurtleCodecError", {
    description: "Typed Turtle codec error exposed at the use-case boundary.",
  })
) {}

/**
 * **Example** (Make Turtle parse request)
 *
 * ```ts
 * import { ParseTurtleRequest } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const request = ParseTurtleRequest.make({
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(request.source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParseTurtleRequest extends S.Opaque<ParseTurtleRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    source: TurtleDocumentText,
    baseIri: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("ParseTurtleRequest", {
      description: "Turtle parse request.",
    })
  )
) {}

/**
 * **Example** (Make empty dataset result)
 *
 * ```ts
 * import { ParseTurtleResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as HashSet from "effect/HashSet"
 *
 * const result = ParseTurtleResult.make({
 *   dataset: makeDataset([])
 * })
 *
 * console.log(HashSet.size(result.dataset.quads))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParseTurtleResult extends S.Opaque<ParseTurtleResult, { readonly brand: unique symbol }>()(
  S.Struct({
    dataset: Dataset,
    prefixes: PrefixMapWithEmptyDefault,
  }).pipe(
    $I.annoteSchema("ParseTurtleResult", {
      description: "Turtle parse result.",
    })
  )
) {}

/**
 * **Example** (Make serialize dataset request)
 *
 * ```ts
 * import { SerializeTurtleRequest } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as HashSet from "effect/HashSet"
 *
 * const request = SerializeTurtleRequest.make({
 *   dataset: makeDataset([])
 * })
 *
 * console.log(HashSet.size(request.dataset.quads))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SerializeTurtleRequest extends S.Opaque<SerializeTurtleRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    dataset: Dataset,
    prefixes: PrefixMapWithEmptyDefault,
  }).pipe(
    $I.annoteSchema("SerializeTurtleRequest", {
      description: "Turtle serialize request.",
    })
  )
) {}

/**
 * **Example** (Make serialized Turtle result)
 *
 * ```ts
 * import { SerializeTurtleResult } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const result = SerializeTurtleResult.make({
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(result.source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SerializeTurtleResult extends S.Opaque<SerializeTurtleResult, { readonly brand: unique symbol }>()(
  S.Struct({
    source: TurtleDocumentText,
  }).pipe(
    $I.annoteSchema("SerializeTurtleResult", {
      description: "Turtle serialize result.",
    })
  )
) {}

/**
 * Turtle codec service shape.
 *
 * @since 0.0.0
 * @category services
 */
interface TurtleCodecShape {
  readonly parse: (request: ParseTurtleRequest) => Effect.Effect<ParseTurtleResult, TurtleCodecError>;
  readonly serialize: (request: SerializeTurtleRequest) => Effect.Effect<SerializeTurtleResult, TurtleCodecError>;
}

/**
 * Turtle codec service tag.
 *
 * **Example** (Yield TurtleCodec service)
 *
 * ```ts
 * import { TurtleCodec } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () {
 *   const codec = yield* TurtleCodec
 *   return codec
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TurtleCodec extends Context.Service<TurtleCodec, TurtleCodecShape>()($I`TurtleCodec`) {}

/**
 * **Example** (Decode read failed reason)
 *
 * ```ts
 * import { OntologyFileStoreErrorReason } from "@beep/ontology-use-cases/aggregates/Session/server"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeUnknownSync(OntologyFileStoreErrorReason)("readFailed")
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const OntologyFileStoreErrorReason = LiteralKit(["notFound", "readFailed", "writeFailed"]).pipe(
  $I.annoteSchema("OntologyFileStoreErrorReason", {
    description:
      "Ontology sidecar file-store failure reason. `notFound` is distinct from `readFailed` because callers act on absence (seed a starter document) and must never take that path for a file that exists but could not be read.",
  })
);

/**
 * **Example** (Annotate write failed reason)
 *
 * ```ts
 * import type { OntologyFileStoreErrorReason } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const reason: OntologyFileStoreErrorReason = "writeFailed"
 *
 * console.log(reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export type OntologyFileStoreErrorReason = typeof OntologyFileStoreErrorReason.Type;

/**
 * **Example** (Make read failed store error)
 *
 * ```ts
 * import { OntologyFilePath, OntologyFileStoreError } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const error = OntologyFileStoreError.make({
 *   reason: "readFailed",
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl"),
 *   message: "The Turtle file could not be read."
 * })
 *
 * console.log(error.path)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologyFileStoreError extends S.TaggedError<OntologyFileStoreError, { readonly brand: unique symbol }>(
  $I`OntologyFileStoreError`
)(
  "OntologyFileStoreError",
  {
    reason: OntologyFileStoreErrorReason,
    path: OntologyFilePath,
    message: S.String,
  },
  $I.annoteError<OntologyFileStoreError>("OntologyFileStoreError", {
    description: "Typed sidecar file-store error.",
  })
) {}

/**
 * **Example** (Make read file request)
 *
 * ```ts
 * import { OntologyFilePath, ReadOntologyFileRequest } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const request = ReadOntologyFileRequest.make({
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl")
 * })
 *
 * console.log(request.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReadOntologyFileRequest extends S.Opaque<ReadOntologyFileRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    path: OntologyFilePath,
  }).pipe(
    $I.annoteSchema("ReadOntologyFileRequest", {
      description: "Read ontology file request.",
    })
  )
) {}

/**
 * **Example** (Make read file result)
 *
 * ```ts
 * import { OntologyFilePath, ReadOntologyFileResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const result = ReadOntologyFileResult.make({
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl"),
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(result.source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReadOntologyFileResult extends S.Opaque<ReadOntologyFileResult, { readonly brand: unique symbol }>()(
  S.Struct({
    path: OntologyFilePath,
    source: TurtleDocumentText,
  }).pipe(
    $I.annoteSchema("ReadOntologyFileResult", {
      description: "Read ontology file result.",
    })
  )
) {}

/**
 * **Example** (Make write file request)
 *
 * ```ts
 * import { OntologyFilePath, WriteOntologyFileRequest } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const request = WriteOntologyFileRequest.make({
 *   path: S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl"),
 *   source: "@prefix ex: <https://example.test/> ."
 * })
 *
 * console.log(request.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WriteOntologyFileRequest extends S.Opaque<WriteOntologyFileRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    path: OntologyFilePath,
    source: TurtleDocumentText,
  }).pipe(
    $I.annoteSchema("WriteOntologyFileRequest", {
      description: "Write ontology file request.",
    })
  )
) {}

/**
 * Ontology file-store service shape.
 *
 * **Example** (Implement file-store shape)
 *
 * ```ts
 * import { ReadOntologyFileResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import type { OntologyFileStoreShape } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as Effect from "effect/Effect";
 * const fileStore: OntologyFileStoreShape = {
 *   read: (request) =>
 *     Effect.succeed(
 *       ReadOntologyFileResult.make({
 *         path: request.path,
 *         source: "@prefix ex: <https://example.test/> ."
 *       })
 *     ),
 *   write: () => Effect.void
 * }
 *
 * console.log(fileStore)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OntologyFileStoreShape {
  readonly read: (request: ReadOntologyFileRequest) => Effect.Effect<ReadOntologyFileResult, OntologyFileStoreError>;
  readonly write: (request: WriteOntologyFileRequest) => Effect.Effect<void, OntologyFileStoreError>;
}

/**
 * Ontology file-store service tag.
 *
 * **Example** (Yield OntologyFileStore service)
 *
 * ```ts
 * import { OntologyFileStore } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as Effect from "effect/Effect";
 * const program = Effect.gen(function* () {
 *   const fileStore = yield* OntologyFileStore
 *   return fileStore
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OntologyFileStore extends Context.Service<OntologyFileStore, OntologyFileStoreShape>()(
  $I`OntologyFileStore`
) {}
