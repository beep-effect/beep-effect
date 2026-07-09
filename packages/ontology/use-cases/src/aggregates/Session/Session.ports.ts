/**
 * Ontology session ports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { make as makeIdentity } from "@beep/identity";
import { Dataset } from "@beep/rdf/Rdf";
import { LiteralKit, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { Effect } from "effect";

const { $OntologyUseCasesId } = makeIdentity("ontology-use-cases");
const $I = $OntologyUseCasesId.create("aggregates/Session/Session.ports");

/**
 * Filesystem path for sidecar ontology documents.
 *
 * @example
 * ```ts
 * import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl")
 *
 * console.log(path)
 * ```
 *
 * @since 0.0.0
 * @category models
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
 * @example
 * ```ts
 * import { OntologyFilePath } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const path: OntologyFilePath = S.decodeUnknownSync(OntologyFilePath)("fixtures/demo.ttl")
 *
 * console.log(path)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type OntologyFilePath = typeof OntologyFilePath.Type;

/**
 * Turtle source text.
 *
 * @example
 * ```ts
 * import { TurtleDocumentText } from "@beep/ontology-use-cases/aggregates/Session"
 * import * as S from "effect/Schema"
 *
 * const source = S.decodeUnknownSync(TurtleDocumentText)("@prefix ex: <https://example.test/> .")
 *
 * console.log(source)
 * ```
 *
 * @since 0.0.0
 * @category models
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
 * @example
 * ```ts
 * import { TurtleDocumentText } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const source: TurtleDocumentText = "@prefix ex: <https://example.test/> ."
 *
 * console.log(source)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TurtleDocumentText = typeof TurtleDocumentText.Type;

/**
 * Turtle codec failure reason.
 *
 * @example
 * ```ts
 * import { TurtleCodecErrorReason } from "@beep/ontology-use-cases/aggregates/Session/server"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeUnknownSync(TurtleCodecErrorReason)("parseFailed")
 *
 * console.log(reason)
 * ```
 *
 * @since 0.0.0
 * @category errors
 */
export const TurtleCodecErrorReason = LiteralKit(["parseFailed", "serializeFailed", "unsupportedGraph"]).pipe(
  $I.annoteSchema("TurtleCodecErrorReason", {
    description: "Turtle codec failure reason.",
  })
);

/**
 * Type for {@link TurtleCodecErrorReason}.
 *
 * @example
 * ```ts
 * import type { TurtleCodecErrorReason } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const reason: TurtleCodecErrorReason = "unsupportedGraph"
 *
 * console.log(reason)
 * ```
 *
 * @since 0.0.0
 * @category errors
 */
export type TurtleCodecErrorReason = typeof TurtleCodecErrorReason.Type;

/**
 * Typed Turtle codec error exposed at the use-case boundary.
 *
 * @example
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
 * @since 0.0.0
 * @category errors
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
 * @example
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
 * @since 0.0.0
 * @category models
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
 * @example
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
 * @since 0.0.0
 * @category models
 */
export class ParseTurtleResult extends S.Class<ParseTurtleResult>($I`ParseTurtleResult`)(
  {
    dataset: Dataset,
  },
  $I.annote("ParseTurtleResult", {
    description: "Turtle parse result.",
  })
) {}

/**
 * Turtle serialize request.
 *
 * @example
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
 * @since 0.0.0
 * @category models
 */
export class SerializeTurtleRequest extends S.Class<SerializeTurtleRequest>($I`SerializeTurtleRequest`)(
  {
    dataset: Dataset,
  },
  $I.annote("SerializeTurtleRequest", {
    description: "Turtle serialize request.",
  })
) {}

/**
 * Turtle serialize result.
 *
 * @example
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
 * @since 0.0.0
 * @category models
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
 * @example
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
 * @since 0.0.0
 * @category services
 */
export class TurtleCodec extends Context.Service<TurtleCodec, TurtleCodecShape>()($I`TurtleCodec`) {}

/**
 * Ontology sidecar file-store failure reason.
 *
 * @example
 * ```ts
 * import { OntologyFileStoreErrorReason } from "@beep/ontology-use-cases/aggregates/Session/server"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeUnknownSync(OntologyFileStoreErrorReason)("readFailed")
 *
 * console.log(reason)
 * ```
 *
 * @since 0.0.0
 * @category errors
 */
export const OntologyFileStoreErrorReason = LiteralKit(["readFailed", "writeFailed"]).pipe(
  $I.annoteSchema("OntologyFileStoreErrorReason", {
    description: "Ontology sidecar file-store failure reason.",
  })
);

/**
 * Type for {@link OntologyFileStoreErrorReason}.
 *
 * @example
 * ```ts
 * import type { OntologyFileStoreErrorReason } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const reason: OntologyFileStoreErrorReason = "writeFailed"
 *
 * console.log(reason)
 * ```
 *
 * @since 0.0.0
 * @category errors
 */
export type OntologyFileStoreErrorReason = typeof OntologyFileStoreErrorReason.Type;

/**
 * Typed sidecar file-store error.
 *
 * @example
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
 * @since 0.0.0
 * @category errors
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
 * @example
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
 * @since 0.0.0
 * @category models
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
 * @example
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
 * @since 0.0.0
 * @category models
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
 * @example
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
 * @since 0.0.0
 * @category models
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
 * @example
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
 * @since 0.0.0
 * @category services
 */
export interface OntologyFileStoreShape {
  readonly read: (request: ReadOntologyFileRequest) => Effect.Effect<ReadOntologyFileResult, OntologyFileStoreError>;
  readonly write: (request: WriteOntologyFileRequest) => Effect.Effect<void, OntologyFileStoreError>;
}

/**
 * Ontology file-store service tag.
 *
 * @example
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
 * @since 0.0.0
 * @category services
 */
export class OntologyFileStore extends Context.Service<OntologyFileStore, OntologyFileStoreShape>()(
  $I`OntologyFileStore`
) {}
