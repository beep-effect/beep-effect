/**
 * Effect Schema annotation helpers for semantic-schema metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { A } from "@beep/utils";
import { pipe, Result, SchemaIssue, SchemaParser } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { SemanticSchemaMetadata } from "./SemanticSchemaMetadata.schema.ts";
import type { O } from "@beep/utils";

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

/**
 * Payload stored in the `semanticSchemaMetadata` annotation key.
 *
 * **Example** (Type-check annotation payload)
 *
 * ```ts
 * import type { SemanticSchemaMetadataAnnotationPayload } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const acceptSemanticSchemaMetadataAnnotationPayload = (value: SemanticSchemaMetadataAnnotationPayload) => value
 * console.log(acceptSemanticSchemaMetadataAnnotationPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SemanticSchemaMetadataAnnotationPayload = SemanticSchemaMetadata;

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly semanticSchemaMetadata?: SemanticSchemaMetadataAnnotationPayload | undefined;
    }
  }
}

/**
 * Validate an unknown semantic-schema metadata payload without throwing.
 *
 * **Example** (Inspect invalid metadata)
 *
 * ```ts import.meta.vitest name="Inspect invalid semantic metadata"
 * import { makeSemanticSchemaMetadataResult } from "@beep/rdf/SemanticSchemaMetadata"
 * import { Result } from "effect"
 *
 * const result = makeSemanticSchemaMetadataResult({ kind: "unknown" })
 * Result.isFailure(result) // => true
 * ```
 *
 * @param metadata - Unknown metadata payload to decode.
 * @returns A Result containing validated metadata or its SchemaError.
 * @category utilities
 * @since 0.0.0
 */
export const makeSemanticSchemaMetadataResult = (
  metadata: unknown
): Result.Result<SemanticSchemaMetadataAnnotationPayload, S.SchemaError> =>
  pipe(SchemaParser.decodeUnknownResult(SemanticSchemaMetadata)(metadata), Result.mapError(schemaIssueToError));

/**
 * Validate a metadata payload before attaching it to a public schema.
 *
 * **Example** (Build validated metadata)
 *
 * ```ts import.meta.vitest name="Build validated metadata"
 * import { makeSemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const metadata = makeSemanticSchemaMetadata({
 *   kind: "identifier",
 *   canonicalName: "ExampleIdentifier",
 *   overview: "Example semantic schema metadata.",
 *   status: "stable",
 *   specifications: [{ name: "Example Profile", disposition: "informative" }],
 *   equivalenceBasis: "String equality.",
 * })
 * metadata.kind // => "identifier"
 * ```
 *
 * @param metadata - Encoded metadata payload.
 * @returns Validated metadata payload.
 * @throws A SchemaError when the payload does not satisfy SemanticSchemaMetadata.
 * @category utilities
 * @since 0.0.0
 */
export const makeSemanticSchemaMetadata = (
  metadata: typeof SemanticSchemaMetadata.Encoded
): SemanticSchemaMetadataAnnotationPayload =>
  pipe(makeSemanticSchemaMetadataResult(metadata), Result.getOrThrowWith(schemaIssueToError));

type Rebuilt<Schema extends S.Top> = Schema["Rebuild"];

/**
 * Attach validated semantic metadata to any Effect schema.
 *
 * **Example** (Attach metadata to schema)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { annotateSemanticSchema } from "@beep/rdf/SemanticSchemaMetadata"
 *
 * const MySchema = annotateSemanticSchema(S.String, {
 *   kind: "identifier",
 *   canonicalName: "ExampleIdentifier",
 *   overview: "Example semantic schema metadata.",
 *   status: "stable",
 *   specifications: [{ name: "Example Profile", disposition: "informative" }],
 *   equivalenceBasis: "String equality.",
 * })
 * console.log(MySchema)
 * ```
 *
 * @param schema - Target schema.
 * @param metadata - Encoded metadata payload.
 * @returns Annotated schema.
 * @throws A SchemaError when the payload does not satisfy SemanticSchemaMetadata.
 * @category utilities
 * @since 0.0.0
 */
export const annotateSemanticSchema: {
  <Schema extends S.Top>(metadata: typeof SemanticSchemaMetadata.Encoded): (schema: Schema) => Rebuilt<Schema>;
  <Schema extends S.Top>(schema: Schema, metadata: typeof SemanticSchemaMetadata.Encoded): Rebuilt<Schema>;
} = dual(
  2,
  <Schema extends S.Top>(schema: Schema, metadata: typeof SemanticSchemaMetadata.Encoded): Rebuilt<Schema> =>
    schema.annotate({ semanticSchemaMetadata: makeSemanticSchemaMetadata(metadata) })
);

const CollectedSemanticSchemaMetadata = SemanticSchemaMetadata.pipe(S.toType, S.Array);
const decodeCollectedSemanticSchemaMetadata = SchemaParser.decodeUnknownResult(CollectedSemanticSchemaMetadata);
const annotationTraversalError = (): S.SchemaError =>
  new S.SchemaError(
    new SchemaIssue.InvalidValue({ message: "Schema annotation traversal failed while evaluating a Suspend thunk" })
  );

/**
 * Collect and validate semantic metadata from an Effect schema without throwing.
 *
 * **Example** (Collect an empty metadata Result)
 *
 * ```ts import.meta.vitest name="Collect an empty semantic metadata Result"
 * import { collectSemanticSchemaMetadataResult } from "@beep/rdf/SemanticSchemaMetadata"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = collectSemanticSchemaMetadataResult(S.Array(S.String))
 * Result.isSuccess(result) && result.success.length === 0 // => true
 * ```
 *
 * @param schema - Target schema whose public AST graph is traversed.
 * @returns A Result containing decoded metadata in stable root-first order.
 * @invariant Success contains only values accepted by the decoded SemanticSchemaMetadata schema.
 * @category getters
 * @since 0.0.0
 */
export const collectSemanticSchemaMetadataResult = (
  schema: S.Top
): Result.Result<ReadonlyArray<SemanticSchemaMetadataAnnotationPayload>, S.SchemaError> =>
  pipe(
    Result.try({
      try: () => SchemaUtils.collectAnnotationsAt(schema, "semanticSchemaMetadata"),
      catch: annotationTraversalError,
    }),
    Result.flatMap(decodeCollectedSemanticSchemaMetadata),
    Result.mapError(schemaIssueToError)
  );

/**
 * Collect semantic metadata from every annotated node in an Effect schema AST.
 *
 * **Details**
 *
 * Results are deterministic and root-first. Recursive schemas terminate after
 * each AST identity is visited once, and encoded schema targets are included.
 *
 * **Example** (Collect no semantic metadata)
 *
 * ```ts import.meta.vitest name="Collect no semantic metadata"
 * import { collectSemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata"
 * import * as S from "effect/Schema"
 *
 * collectSemanticSchemaMetadata(S.Array(S.String)).length // => 0
 * ```
 *
 * @param schema - Target schema whose public AST graph is traversed.
 * @returns Every semantic metadata payload in root-first order.
 * @throws A SchemaError when annotation traversal fails or metadata does not pass SemanticSchemaMetadata validation.
 * @invariant Every returned value has passed the decoded SemanticSchemaMetadata schema.
 * @category getters
 * @since 0.0.0
 */
export const collectSemanticSchemaMetadata = (schema: S.Top): ReadonlyArray<SemanticSchemaMetadataAnnotationPayload> =>
  pipe(collectSemanticSchemaMetadataResult(schema), Result.getOrThrowWith(schemaIssueToError));

/**
 * Read the first root-most semantic metadata payload without throwing.
 *
 * **Example** (Read a missing metadata Result)
 *
 * ```ts import.meta.vitest name="Read a missing semantic metadata Result"
 * import { getSemanticSchemaMetadataResult } from "@beep/rdf/SemanticSchemaMetadata"
 * import { Result } from "effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const result = getSemanticSchemaMetadataResult(S.String)
 * Result.isSuccess(result) && O.isNone(result.success) // => true
 * ```
 *
 * @param schema - Target schema.
 * @returns A Result containing the root-most metadata payload as an Option.
 * @category utilities
 * @since 0.0.0
 */
export const getSemanticSchemaMetadataResult = (
  schema: S.Top
): Result.Result<O.Option<SemanticSchemaMetadataAnnotationPayload>, S.SchemaError> =>
  pipe(collectSemanticSchemaMetadataResult(schema), Result.map(A.head));

/**
 * Read the first root-most semantic metadata payload from an Effect schema.
 *
 * **Example** (Read missing metadata option)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { getSemanticSchemaMetadata } from "@beep/rdf/SemanticSchemaMetadata"
 * import * as O from "effect/Option"
 *
 * const metadata = getSemanticSchemaMetadata(S.String)
 * console.log(O.isNone(metadata)) // true (no metadata attached)
 * ```
 *
 * @param schema - Target schema.
 * @returns Root-most metadata payload as an Option.
 * @throws A SchemaError when annotation traversal fails or metadata does not pass SemanticSchemaMetadata validation.
 * @category utilities
 * @since 0.0.0
 */
export const getSemanticSchemaMetadata = (schema: S.Top): O.Option<SemanticSchemaMetadataAnnotationPayload> =>
  pipe(collectSemanticSchemaMetadata(schema), A.head);
