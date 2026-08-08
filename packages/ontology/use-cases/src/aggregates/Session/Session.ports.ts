/**
 * Ontology session ports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import { Dataset, PrefixMap } from "@beep/rdf/Rdf";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { TaggedErrorClass } from "@beep/schema/TaggedErrorClass";
import { Context, Effect } from "effect";
import * as S from "effect/Schema";

const $I = $OntologyUseCasesId.create("aggregates/Session/Session.ports");

const emptyPrefixMap = (): PrefixMap => ({});

const PrefixMapWithEmptyDefault = PrefixMap.pipe(
  S.withConstructorDefault(Effect.succeed(emptyPrefixMap())),
  S.withDecodingDefaultKey(Effect.succeed(emptyPrefixMap()))
);

/**
 * Filesystem path for sidecar ontology documents.
 *
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
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link OntologyFilePath}.
 *
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
 * Turtle source text.
 *
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
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link TurtleDocumentText}.
 *
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
 * Turtle codec failure reason.
 *
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
 * Type for {@link TurtleCodecErrorReason}.
 *
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
 * Typed Turtle codec error exposed at the use-case boundary.
 *
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
export class TurtleCodecError extends TaggedErrorClass<TurtleCodecError>($I`TurtleCodecError`)(
  "TurtleCodecError",
  {
    reason: TurtleCodecErrorReason,
    message: S.String,
  },
  $I.annote("TurtleCodecError", {
    description: "Typed Turtle codec error exposed at the use-case boundary.",
  })
) {}

/**
 * Turtle parse request.
 *
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
export class ParseTurtleRequest extends S.Class<ParseTurtleRequest>($I`ParseTurtleRequest`)(
  {
    source: TurtleDocumentText,
    baseIri: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ParseTurtleRequest", {
    description: "Turtle parse request.",
  })
) {}

/**
 * Turtle parse result.
 *
 * **Example** (Make empty dataset result)
 *
 * ```ts
 * import { ParseTurtleResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const result = ParseTurtleResult.make({
 *   dataset: makeDataset([])
 * })
 *
 * console.log(result.dataset.quads.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParseTurtleResult extends S.Class<ParseTurtleResult>($I`ParseTurtleResult`)(
  {
    dataset: Dataset,
    prefixes: PrefixMapWithEmptyDefault,
  },
  $I.annote("ParseTurtleResult", {
    description: "Turtle parse result.",
  })
) {}

/**
 * Turtle serialize request.
 *
 * **Example** (Make serialize dataset request)
 *
 * ```ts
 * import { SerializeTurtleRequest } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const request = SerializeTurtleRequest.make({
 *   dataset: makeDataset([])
 * })
 *
 * console.log(request.dataset.quads.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SerializeTurtleRequest extends S.Class<SerializeTurtleRequest>($I`SerializeTurtleRequest`)(
  {
    dataset: Dataset,
    prefixes: PrefixMapWithEmptyDefault,
  },
  $I.annote("SerializeTurtleRequest", {
    description: "Turtle serialize request.",
  })
) {}

/**
 * Turtle serialize result.
 *
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
export class SerializeTurtleResult extends S.Class<SerializeTurtleResult>($I`SerializeTurtleResult`)(
  {
    source: TurtleDocumentText,
  },
  $I.annote("SerializeTurtleResult", {
    description: "Turtle serialize result.",
  })
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
 * import { Effect } from "effect"
 *
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
 * Ontology sidecar file-store failure reason.
 *
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
 * Type for {@link OntologyFileStoreErrorReason}.
 *
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
 * Typed sidecar file-store error.
 *
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
export class OntologyFileStoreError extends TaggedErrorClass<OntologyFileStoreError>($I`OntologyFileStoreError`)(
  "OntologyFileStoreError",
  {
    reason: OntologyFileStoreErrorReason,
    path: OntologyFilePath,
    message: S.String,
  },
  $I.annote("OntologyFileStoreError", {
    description: "Typed sidecar file-store error.",
  })
) {}

/**
 * Read ontology file request.
 *
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
export class ReadOntologyFileRequest extends S.Class<ReadOntologyFileRequest>($I`ReadOntologyFileRequest`)(
  {
    path: OntologyFilePath,
  },
  $I.annote("ReadOntologyFileRequest", {
    description: "Read ontology file request.",
  })
) {}

/**
 * Read ontology file result.
 *
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
export class ReadOntologyFileResult extends S.Class<ReadOntologyFileResult>($I`ReadOntologyFileResult`)(
  {
    path: OntologyFilePath,
    source: TurtleDocumentText,
  },
  $I.annote("ReadOntologyFileResult", {
    description: "Read ontology file result.",
  })
) {}

/**
 * Write ontology file request.
 *
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
export class WriteOntologyFileRequest extends S.Class<WriteOntologyFileRequest>($I`WriteOntologyFileRequest`)(
  {
    path: OntologyFilePath,
    source: TurtleDocumentText,
  },
  $I.annote("WriteOntologyFileRequest", {
    description: "Write ontology file request.",
  })
) {}

/**
 * Ontology file-store service shape.
 *
 * **Example** (Implement file-store shape)
 *
 * ```ts
 * import { ReadOntologyFileResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import type { OntologyFileStoreShape } from "@beep/ontology-use-cases/aggregates/Session"
 * import { Effect } from "effect"
 *
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
 * import { Effect } from "effect"
 *
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
