/**
 * Collection helpers for conformance annotations on nested schemas.
 *
 * @since 0.0.0
 */

import { pipe, Result, SchemaIssue, SchemaParser } from "effect";
import * as S from "effect/Schema";
import { collectAnnotationsAt } from "../SchemaUtils/collectAnnotationsAt.ts";
import { Annotation } from "./Conformance.annotations.ts";

const CollectedConformanceAnnotations = Annotation.pipe(S.toType, S.Array);
const decodeCollectedConformanceAnnotations = SchemaParser.decodeUnknownResult(CollectedConformanceAnnotations);

const annotationTraversalError = (): S.SchemaError =>
  new S.SchemaError(
    new SchemaIssue.InvalidValue({ message: "Schema annotation traversal failed while evaluating a Suspend thunk" })
  );

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

/**
 * Collect and validate every conformance annotation without throwing.
 *
 * **Example** (Collect a validated Result)
 *
 * ```ts import.meta.vitest name="Collect a validated Result"
 * import { collectAnnotationsResult } from "@beep/schema/Conformance"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = collectAnnotationsResult(S.Array(S.String))
 * Result.isSuccess(result) && result.success.length === 0 // => true
 * ```
 *
 * @param schema - Schema whose public AST graph is traversed.
 * @returns A Result containing decoded annotations in stable root-first order.
 * @invariant Success contains only values accepted by the decoded Annotation schema.
 * @category getters
 * @since 0.0.0
 */
export const collectConformanceAnnotationsResult = (
  schema: S.Top
): Result.Result<ReadonlyArray<Annotation>, S.SchemaError> =>
  pipe(
    Result.try({
      try: () => collectAnnotationsAt(schema, "conformance"),
      catch: annotationTraversalError,
    }),
    Result.flatMap(decodeCollectedConformanceAnnotations),
    Result.mapError(schemaIssueToError)
  );

/**
 * Collect every conformance annotation reachable from an Effect schema.
 *
 * **Details**
 *
 * Results retain the shared collector's deterministic root-first order and
 * recursive-schema cycle safety.
 *
 * **Example** (Collect no annotations)
 *
 * ```ts import.meta.vitest name="Collect no annotations"
 * import { collectAnnotations } from "@beep/schema/Conformance"
 * import * as S from "effect/Schema"
 *
 * collectAnnotations(S.Array(S.String)).length // => 0
 * ```
 *
 * @param schema - Schema whose public AST graph is traversed.
 * @returns Validated annotation payloads in root-first order.
 * @throws A SchemaError when annotation traversal fails or a payload was attached without passing Annotation validation.
 * @invariant Every returned value has passed the decoded Annotation schema.
 * @category getters
 * @since 0.0.0
 */
export const collectConformanceAnnotations = (schema: S.Top): ReadonlyArray<Annotation> =>
  pipe(collectConformanceAnnotationsResult(schema), Result.getOrThrowWith(schemaIssueToError));
