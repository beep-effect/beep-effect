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
 * @since 0.0.0
 * @category models
 */
export type OntologyFilePath = typeof OntologyFilePath.Type;

/**
 * Turtle source text.
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
 * @since 0.0.0
 * @category models
 */
export type TurtleDocumentText = typeof TurtleDocumentText.Type;

/**
 * Turtle codec failure reason.
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
 * @since 0.0.0
 * @category errors
 */
export type TurtleCodecErrorReason = typeof TurtleCodecErrorReason.Type;

/**
 * Typed Turtle codec error exposed at the use-case boundary.
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
 * @since 0.0.0
 * @category services
 */
export class TurtleCodec extends Context.Service<TurtleCodec, TurtleCodecShape>()($I`TurtleCodec`) {}

/**
 * Ontology sidecar file-store failure reason.
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
 * @since 0.0.0
 * @category errors
 */
export type OntologyFileStoreErrorReason = typeof OntologyFileStoreErrorReason.Type;

/**
 * Typed sidecar file-store error.
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
 * @since 0.0.0
 * @category services
 */
export class OntologyFileStore extends Context.Service<OntologyFileStore, OntologyFileStoreShape>()(
  $I`OntologyFileStore`
) {}
