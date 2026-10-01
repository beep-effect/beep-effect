import { Result } from "effect";
import * as S from "effect/Schema";

const decodeUnknownNonNegativeIntResult = S.decodeUnknownResult(S.Natural);

const schemaIssueToError = (cause: S.SchemaError | S.SchemaError["issue"]): S.SchemaError =>
  cause instanceof S.SchemaError ? cause : new S.SchemaError(cause);

export const decodeNonNegativeInt = (input: unknown): number =>
  Result.getOrThrowWith(decodeUnknownNonNegativeIntResult(input), schemaIssueToError);
